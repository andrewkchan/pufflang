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
