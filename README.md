# Puffscript LLVM self-hosting – current status

## Progress against the plan
- Phase 1: Completed. Harness (`npm test`/compile-and-run via clang -x ir) in place; original spec mirrored.
- Phase 2: Stage0 frontend + LLVM IR backend implemented; all original and ported suites now pass.
- Phase 3 (ongoing/major):
  - Language/features: bitwise ops, ++/--, unary ops, ternary, switch, function overloading (arity, defaults), default args, UTF-8 strings, pointer differencing (Stage0), import/export parsing, internal linkage for non-exported symbols.
  - Runtime/I/O: libc-backed builtins (__malloc__/__free__/__exit__/__putchar__/__write__/__read__/__open__/__close__/__sqrt__) with stdin/stdout/file round-trip tests; harness can feed stdin.
  - Stdlib growth: generic Vec/VecInt/VecByte, String helpers (eq/starts_with/clone/index_of/contains/slice/trim), StringBuilder helpers (clear/append cstr/int/hex), argv/env/time wrappers, Map<int,int>, MapStr (string->int), VecStr, String interner utilities, file helpers; new regression suites cover these.
  - Stage1 progress: expression ASTs merge into `parser_full` arenas; typed metadata (type spans + TypeEnv-backed ids) via `module_type_ids`. Resolver seeds scopes with typed functions/vars/structs and enforces returns; struct dot typing is handled. Stage1 LLVM IR codegen covers literals (int/bool/byte, char), string literal constant pool (@.str.*) with GEP accessors, unary/binary arithmetic incl. bitwise/shift/comparison, logical short-circuit (phi), ternary (phi), calls, parameter allocas/SSA, locals/assignments, if/while/for with break/continue, pointer arithmetic/equality, deref/index for byte pointers returning GEP pointers, len() on string literals, globals (int/bool/byte/string) with correct types, and struct field load/store via dot on pointer-to-struct params. Helper modules (`types.puff`, `typeenv.puff`, `structlayout.puff`, `typerules.puff`, `literaltypes.puff`, `exprtypes.puff`, `typeparse.puff`) remain the basis for fuller type-aware resolution/codegen.
- Remaining (Phases 3 tail/4–6): add array/struct literal lowering (NODE_LIST), full import/export/defaults/overload resolution in Stage1 with arity-based mangling aligned to Stage0, expand bootstrap pipeline (Stage0 → Stage1 → Stage2) and documentation.

## Language extensions and semantics notes
- Overloading & defaults: Functions overload by arity/types; arity is mangled (`foo__2`); default args supported. Exports with a single overload keep the unmangled name; overloads stay mangled but are `external`.
  - Example:
  ```
  export def bar(x int) int { return x + 1; }           // external @bar
  export def bar(x int, y int = 2) int { return x + y; } // external @bar__2
  ```
- Internal vs external linkage: Non-exported functions/globals are emitted `internal`; exported ones are external. Overloaded exports remain mangled but external. Tests cover both to prevent regressions.
  - Example:
  ```
  def internal_fn(x int) int { return x + 1; }   // define internal @internal_fn
  export def public_fn(x int) int { return x + 1; } // define i32 @public_fn
  ```
- Import/export parsing: `export` marks symbols for external linkage; `import` supported in Stage0 parsing and codegen.
- Pointer printing: Runtime prints pointers as zero-padded 16-hex digits (`0x%016llx`) with regression coverage.
- Builtins: libc-backed double-underscore intrinsics for memory, I/O, env/time, argv/argc helpers; map to corresponding libc calls in the LLVM backend.
  - Examples:
  ```
  var buf = __malloc__(16);
  __free__(buf);
  var t = __time__(0);
  var env = __getenv__(byte~(&"PATH\0"[0]));
  ```
- Scanner tokens: Added support for commas, `=`, arithmetic ops (+, -, *, /) to enable richer Stage1 parsing paths.

## How to run tests
- Full suite: `npm test` (currently 143 suites / 300 tests)

## Notes
- Builtin names are double-underscore prefixed and map to libc where relevant.
- Non-exported functions/globals are emitted with internal linkage; overloading is mangled by arity.

## Quickstart: compile and run Puffscript “hello world” to native
1) Install deps (once): `npm install` and ensure `clang` is on PATH.
2) Create a Puffscript file:
```
cat > hello.puff <<'EOF'
def main() {
  print "Hello, world!";
}
EOF
```
3) Compile to LLVM IR and native, then run:
```
node - <<'EOF'
require('ts-node/register');
const fs = require('fs');
const { compileToLl, buildWithClang, runBinary } = require('./src/harness');
const source = fs.readFileSync('hello.puff', 'utf8');
const irPath = compileToLl(source);
const binPath = buildWithClang(irPath);
const res = runBinary(binPath);
process.stdout.write(res.stdout);
process.stderr.write(res.stderr);
process.exit(res.status);
EOF
```
You should see:
```
Hello, world!
```

## Stage1 compiler (self-hosted) quickstart
- Compile a Puffscript program using the Stage1 compiler (written in Puff) and print LLVM IR:
  ```
  npm run stage1 -- examples/hello.puff
  ```
- Emit IR to a file:
  ```
  npm run stage1 -- --emit-ir out.ll examples/hello.puff
  ```
- Compile with Stage1 and run the resulting binary:
  ```
  npm run stage1 -- --run examples/hello.puff
  ```
- Or pipe from stdin (use `-` for clarity):
  ```
  echo "def main() int { return 6; }" | npm run stage1 -- --run -
  ```
- Bootstrap smoke (Stage0→Stage1→run sample):
  ```
  npm run bootstrap:stage1
  ```
  This compiles a simple program via the Stage1 compiler and runs it; exit code should be 42.
