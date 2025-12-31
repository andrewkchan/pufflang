## Executive summary
Deliver a self-hosted Puffscript toolchain: a solid Stage0 (TypeScript → LLVM IR) that mirrors/extends the original language; a growing Stage1 (Puffscript) compiler with stdlib/runtime; and a repeatable bootstrap (Stage0 → Stage1 → Stage2). Stage0 is green across all feature suites; Stage1 now has richer parsing/summarization and resolver scaffolding. Next focus: Stage1 AST-based parsing/resolution/codegen and the bootstrap script.

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

### Phase 3 — Language feature extensions (Stage0 complete)
- Status: Stage0 implements bitwise/shift, ++/--, ternary, switch, overloading + default args, import/export, UTF-8 strings, pointer printing/diff; all tests green.
- Acceptance: Already met in Stage0; keep regression tests green.

### Phase 4 — Runtime + stdlib (Stage0 complete, Stage1 growing)
- Status: libc-backed runtime and stdlib (Vec/VecInt/VecByte/VecStr, String/Builder, Map/MapStr, Interner, file/argv/env/time helpers) in place and tested.
- Next: keep stdlib stable; add any missing helpers needed by Stage1 codegen.
- Acceptance: Stdlib tests remain green.

### Phase 5 — Stage1 compiler in Puffscript (in progress)
- Status: scanner parity; expression parser covers precedence/logical/bitwise/shift/unary/++/--; parser_full parses defs/import defs/structs/vars, var/return/print/if/while/for/break/continue/assign/expr, summaries/counts with names/flags; resolver scaffolding for EOF/return + duplicate vars; harness helpers for summaries/counts/resolver.
- Next:
  - Integrate parser_full with expression AST (not just spans); build real NodeArena for statements/expressions.
  - Extend resolver to types/overloads/default args/import/export/structs; enforce return coverage.
  - Begin Stage1 codegen scaffolding (LLVM IR emitters mirroring Stage0) and CLI to compile .puff → .ll → binary.
- Acceptance: Stage0 builds Stage1 binary that can compile sample programs; Stage1 passes a focused subset of Stage0 tests via harness/CLI.

### Phase 6 — Bootstrapping proof
- Script Stage0 → Stage1 → Stage2; hash/compare IR or binaries; run selected suites under Stage1-produced compiler.
- Acceptance: Bootstrap script passes locally; Stage1-built compiler passes agreed test subset; documented steps reproducible/CI-ready.

### Phase 7 — Documentation and polish
- Keep README/PLAN aligned with progress and add CLI/bootstrap usage once ready; ensure `npm test` and bootstrap script are green; repo clean.

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
