# Puffscript LLVM self-hosting – current status

## Progress against the plan
- Phase 1: Completed. Harness (`npm test`/compile-and-run via clang -x ir) in place; original spec mirrored.
- Phase 2: Stage0 frontend + LLVM IR backend implemented; all original and ported suites now pass.
- Phase 3 (ongoing/major):
  - Language/features: bitwise ops, ++/--, unary ops, ternary, switch, function overloading (arity, defaults), default args, UTF-8 strings, pointer differencing, import/export parsing, internal linkage for non-exported symbols.
  - Runtime/I/O: libc-backed builtins (__malloc__/__free__/__exit__/__putchar__/__write__/__read__/__open__/__close__/__sqrt__) with stdin/stdout/file round-trip tests; harness can feed stdin.
  - Stdlib growth: generic Vec/VecInt/VecByte, String helpers (eq/starts_with/clone/index_of/contains/slice/trim), StringBuilder helpers (clear/append cstr/int/hex), argv/env/time wrappers, Map<int,int>, MapStr (string->int), VecStr, String interner utilities, file helpers; new regression suites cover these.
  - Stage1 progress: expression parser now covers precedence, logical/bitwise/shift, unary, and ++/-- with harness helpers (`runStage1ExprSexpr`) and dedicated tests. Scanner parity and parser helper suites remain green. Added a non-runtime scaffold `parser_full.puff` to begin full Stage1 parsing work without touching the stable minimal parser; smoke test ensures it compiles.
- Remaining (Phases 3 tail/4–6): integrate parser_full with parser_expr for real expression spans, extend Stage1 parser/AST + resolver parity, export codegen polish, Stage1 codegen/CLI, bootstrap pipeline (Stage0 → Stage1 → Stage2).

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
- Full suite: `npm test` (currently 103 suites / 205 tests)

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
