## Executive summary
Deliver a self-hosted Puffscript toolchain that matches the original language semantics and tests, adds the README/TODO features, provides richer I/O, and bootstraps itself. The approach: build a new Stage0 compiler in TypeScript that targets LLVM IR (text `.ll`) with a tiny runtime in IR/asm, using `llc` + `ld` to produce binaries; port/extend the test suite to this backend; then re-implement the compiler in Puffscript (Stage1) using a Puffscript stdlib (vectors/strings/maps). Stage0 will compile Stage1; Stage1 will compile itself (Stage2) to prove self-hosting. New tests cover added features and I/O/bootstrapping.

## Phases and tasks

### Phase 1 — Baseline setup and spec capture
- Mirror the original language spec and tests into the new repo; decide on directory layout (stage0 compiler, runtime, stdlib, stage1 sources, tests).
- Build a new test harness that can compile a Puffscript snippet to LLVM IR, lower it with `llc` + `ld` (or `clang -x ir`), run it, and capture stdout/stderr/exit codes.
- Acceptance: Harness can compile and execute a “hello world” and a simple arithmetic/array program; original test corpus is runnable (even if failing) through the new harness.

### Phase 2 — Stage0 frontend + LLVM IR backend
- Re-implement/port scanner, parser, resolver/type-checker in TypeScript, keeping original semantics.
- Define a typed IR and emit LLVM IR (i32/i8/f32) with a small runtime in LLVM IR/asm: print/len/memcpy/sqrt, stack/heap helpers, syscalls via libc or direct; use `llc` + `ld` (or `clang -x ir`) to produce binaries.
- Add built-ins for heap and I/O (malloc/free/realloc or mmap/brk helpers, fopen/fread/fwrite/close or syscall-backed, read_file_all, write_file, putchar/puts, exit/status).
- Acceptance: Original end-to-end tests (unmodified semantics) pass when compiled to LLVM IR and executed via harness; pointer/array/struct semantics match reference outputs.

### Phase 3 — Language feature extensions
- Implement README/TODO items: bitwise ops (& | ^ ~ >> <<), ++/--, ternary operator, switch statement, function overloading (by arity/types), default arguments, exported/imported functions, UTF-8/non-ASCII strings, pointer printing (hex) and pointer differencing (where defined).
- Update grammar, resolver rules, and codegen; document new built-ins or desugarings.
- Acceptance: New targeted parser/typechecker/codegen tests for each feature; runtime output tests demonstrating behavior; no regressions in original suite.

- ### Phase 4 — Runtime + stdlib for self-hosting
- Flesh out LLVM-level runtime for file/argv/env/time and robust error handling; expose Puffscript built-ins for heap/I/O.
- Implement Puffscript stdlib (Vec, String/Builder, HashMap or trie for symbols, file helpers, formatting utilities) using the new built-ins.
- Acceptance: Stdlib unit tests (push/pop/grow, string append/UTF-8, map insert/lookup); I/O tests (read/write files, round-trip binary/text); still green on existing suites.

### Phase 5 — Stage1 compiler in Puffscript
- Port scanner/parser/resolver/codegen to Puffscript using stdlib; keep parity with Stage0 features.
- Provide a CLI in Puffscript (compile files to LLVM IR, lower with `llc` + `ld`/`clang -x ir`; optional run helper).
- Acceptance: Stage0 compiles Stage1 to a working binary that can compile and run sample programs; outputs for a sample program match Stage0; integration tests exercise Stage1 CLI.

### Phase 6 — Bootstrapping proof
- Use Stage1 to compile itself (Stage2); compare Stage1 vs Stage2 artifacts (byte-for-byte or hash of emitted C/IR) to assert fixed point.
- Add a `bootstrap.sh`/CI job running Stage0 → Stage1 → Stage2 and running the test suite with Stage1.
- Acceptance: Bootstrap pipeline passes; Stage1-produced binaries pass all tests; documented steps reproducible locally/CI.

### Phase 7 — Documentation and polish
- Update README with language spec delta, new features, backend/runtime description, and bootstrap instructions.
- Provide examples (I/O, bitwise, switch, default args, overloading).
- Clean repo (remove upstream clone, ensure no sensitive/unneeded files); finalize scripts.
- Acceptance: Docs reviewed; examples build and run; `npm test`/`npm run bootstrap` (or equivalent) green; git status clean.

## Testing strategy
- Unit tests: scanner/parser/resolver for old and new grammar; stdlib data structures; runtime helpers.
- Integration/e2e: compile-and-run tests for original suite plus new feature cases; I/O/file tests; pointer/array/struct behaviors.
- Bootstrap test: Stage0 builds Stage1, Stage1 builds itself (Stage2), hash/AST/codegen equivalence; run suites under Stage1.
- Tooling: leverage LLVM toolchain (`llc`, `ld`, or `clang -x ir`) for builds; capture stdout/stderr/exit codes; optional sanitizer builds for debugging.

## Risks and mitigations
- **Scope/complexity of self-hosting:** Break work into stages; keep Stage0 solid and feature-compatible; implement Stage1 incrementally.
- **LLVM backend correctness/UB:** Use fixed-width types, bounds checks in runtime, optional ASan/UBSan builds; add regression tests for pointer/array semantics.
- **New feature interactions:** Add targeted tests and spec notes; ensure resolver/codegen handle precedence and overload resolution deterministically.
- **UTF-8/string handling:** Centralize encoding/decoding in runtime; add tests for multibyte sequences; avoid undefined pointer arithmetic on string data.
- **Bootstrap brittleness:** Script the pipeline; compare artifacts deterministically; pin compiler flags; run in CI.
