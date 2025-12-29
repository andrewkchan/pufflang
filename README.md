# Puffscript (I/O-enabled, bootstrappable)

This repository contains a TypeScript implementation of the Puffscript language plus a Node-friendly runtime and CLI. It preserves the original language semantics (parser/resolver/backend) while adding host I/O so Puffscript programs can interact with files, stdin/stdout, and argv — enough to bootstrap and run real tooling.

## Quick start

```bash
npm install
npm test          # runs the full original suite + new I/O tests
npm run build     # emits dist/

# Run a Puffscript program
node dist/cli.js run examples/cat.puff --args myfile.txt

# Compile a program to wasm
node dist/cli.js build examples/cat.puff --out-wasm cat.wasm --out-wat cat.wat
```

`npm test` runs all original upstream tests (parser, resolver, runtime) plus new coverage for file/stdin/stdout/argv builtins.

## New built-in I/O surface

All imports live under the `io` module in the generated WASM:

| Builtin | Signature | Behavior |
| --- | --- | --- |
| `__stdin_read__(dst byte~, len int) int` | Reads up to `len` bytes from stdin into `dst`; returns bytes read (0 on EOF, -1 on error). |
| `__stdout_write__(src byte~, len int) int` | Writes `len` bytes from `src` to stdout; returns bytes written or -1 on error. |
| `__read_file__(path byte~, pathLen int, dst byte~, dstLen int) int` | Reads a file into `dst`, up to `dstLen` bytes; returns bytes read or -1 on error. |
| `__write_file__(path byte~, pathLen int, src byte~, srcLen int) int` | Writes `srcLen` bytes to a file (overwrite); returns bytes written or -1 on error. |
| `__args_count__() int` | Number of argv entries. |
| `__args_get__(index int, dst byte~, dstLen int) int` | Copies argv entry at `index` into `dst` (truncated to `dstLen`); returns bytes written or -1 if out of range. |

Existing printing imports remain (`log`, `putchar`, `putf`, `puti`, `flush`), and memory is now exported for host-side access.

## CLI commands

- `puff run <file> [--args a b c] [--stdin text] [--emit-wat out.wat] [--emit-wasm out.wasm]`  
  Compiles and executes a Puffscript source file with the Node host I/O.

- `puff build <file> [--out-wat path] [--out-wasm path]`  
  Compiles source to WAT/WASM (writes to stdout if `--out-wasm` is omitted).

After `npm run build`, `puff` is available at `dist/cli.js` (bin entry).

## Examples

- `examples/cat.puff` – simple cat: reads from `argv[0]` if present, else stdin, writes to stdout.
- `examples/echo.puff` – echoes up to 256 bytes from stdin to stdout.

Run them with:

```bash
npm run build
node dist/cli.js run examples/echo.puff --stdin "hello!"
node dist/cli.js run examples/cat.puff --args myfile.txt
```

## Bootstrapping workflow

1. Build the TypeScript toolchain: `npm run build`.
2. Compile Puffscript sources to WAT/WASM:
   - `node dist/cli.js build examples/cat.puff --out-wasm cat.wasm --out-wat cat.wat`
3. Execute the resulting WASM with the same host runtime:
   - `node dist/cli.js run examples/cat.puff --args input.txt`
4. Automated demo: `npm run bootstrap:demo` will compile `examples/cat.puff` to WASM, write a temporary input file, and run the produced WASM with the host runtime to prove the pipeline end-to-end.
5. For self-hosting experiments, use the CLI to compile Puffscript programs that themselves use the new I/O builtins (e.g., file copying, lexing) and chain the outputs in your scripts.

## Testing

- `npm test` (Jest, ts-jest) runs:
  - All original upstream parser/resolver/runtime tests.
  - New I/O tests covering stdin/stdout, file read/write, and argv.
- `npm run build` ensures the CLI and runtime compile.

## Upstream reference

The full upstream language reference is preserved in `README.upstream.md`. Language semantics (types, pointers, arrays, structs, control flow) are unchanged; only I/O imports and memory export were added.
