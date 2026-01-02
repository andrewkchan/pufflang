# Puffscript LLVM self-hosting – current status

## Progress against the plan
- Phase 1: Parser/type metadata uplift covered in Stage0 and partially mirrored in Stage1; harness is in place (`npm test` runs via clang -x ir).
- Phase 2: Stage0 frontend + LLVM IR backend implemented; all upstream and ported suites pass.
- Phase 3 (ongoing/major):
  - Language/features (Stage0 complete; Stage1 partly mirrored): bitwise ops, ++/--, unary ops, ternary, switch, function overloading (arity/defaults), default args, UTF-8 strings, pointer differencing, import/export parsing, internal linkage for non-exported symbols.
  - Runtime/I/O: libc-backed builtins (__malloc__/__free__/__exit__/__putchar__/__write__/__read__/__open__/__close__/__sqrt__) with stdin/stdout/file round-trip tests; harness can feed stdin.
  - Stdlib growth: generic Vec/VecInt/VecByte, String helpers (eq/starts_with/clone/index_of/contains/slice/trim), StringBuilder helpers (clear/append cstr/int/hex), argv/env/time wrappers, Map<int,int>, MapStr (string->int), VecStr, String interner utilities, file helpers; regression suites cover these.
  - Stage1 status: expression ASTs merge into `parser_full`; typed metadata via `module_type_ids`; resolver seeds scopes and enforces returns; struct dot typing handled. LLVM IR codegen supports literals (int/bool/byte/char), string constant pool with GEP accessors, unary/binary arithmetic (incl. bitwise/shift/comparison), logical short-circuit/ternary (phi), calls, parameter allocas/SSA, locals/assignments, if/while/for with break/continue, pointer arithmetic/equality, deref/index for byte pointers, len() on string literals, globals (int/bool/byte/string), struct field load/store. Helper modules (`types.puff`, `typeenv.puff`, `structlayout.puff`, `typerules.puff`, `literaltypes.puff`, `exprtypes.puff`, `typeparse.puff`) remain the base for full type-aware resolution/codegen. Strict Stage1 still fails due to invalid IR in `cg_function__4`; normal test runs rely on harness fallback when Stage1 emits empty/invalid IR.
- Remaining (Phase 3 tail/4–6): fix Stage1 codegen/resolution for overload/default/import/export parity and array/struct literal lowering; remove harness fallbacks once Stage1 is stable; expand bootstrap pipeline (Stage0 → Stage1 → Stage2) and update docs accordingly.

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
- Full suite: `npm test` (currently 152 suites / 315 tests)
- Strict Stage1 diagnostics (will surface current IR issues): `PUFF_STAGE1_STRICT=1 PUFF_STAGE1_VERIFY=1 npm test -- --runTestsByPath tests/stage1-codegen-minimal.test.ts`

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
