# Puffscript LLVM self-hosting – current status

## Progress against the plan
- Phase 1: Completed. Harness (`npm test`/compile-and-run via clang -x ir) in place; original spec mirrored.
- Phase 2: Stage0 frontend + LLVM IR backend implemented; all original and ported suites now pass.
- Phase 3 (partial/major): Added bitwise ops, ++/--, ternary, switch, function overloading (arity, defaults), default args, UTF-8 strings, pointer differencing, import/export parsing, internal linkage for non-exported symbols.
- Runtime/I/O: Added libc-backed builtins (__malloc__/__free__/__exit__/__putchar__/__write__/__read__/__open__/__close__/__sqrt__) and tests for stdin, stdout, file round-trip. Harness can feed stdin.
- Remaining (Phases 3 tail/4–6): export codegen polish, pointer hex printing, fuller stdlib (Vec/String/Map), argv/env/time/file helpers, Stage1 compiler in Puffscript, bootstrap pipeline.

## How to run tests
- Full suite: `npm test`

## Notes
- Builtin names are double-underscore prefixed and map to libc where relevant.
- Non-exported functions/globals are emitted with internal linkage; overloading is mangled by arity.
