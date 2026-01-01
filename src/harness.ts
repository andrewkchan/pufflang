import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { compile } from "./index"

const stdlibBasePath = path.join(__dirname, "..", "stdlib", "base.puff")
let cachedStdlibBase: string | null = null
const stage1AstPath = path.join(__dirname, "..", "stage1", "ast.puff")
const stage1ScannerPath = path.join(__dirname, "..", "stage1", "scanner.puff")
const stage1TypesPath = path.join(__dirname, "..", "stage1", "types.puff")
const stage1StructLayoutPath = path.join(__dirname, "..", "stage1", "structlayout.puff")
const stage1TypeEnvPath = path.join(__dirname, "..", "stage1", "typeenv.puff")
const stage1TypeparsePath = path.join(__dirname, "..", "stage1", "typeparse.puff")
const stage1ParserExprPath = path.join(__dirname, "..", "stage1", "parser_expr.puff")
const stage1ParserFullPath = path.join(__dirname, "..", "stage1", "parser_full.puff")
const stage1CodegenPath = path.join(__dirname, "..", "stage1", "codegen.puff")
const stage1DriverPath = path.join(__dirname, "..", "stage1", "driver.puff")
let cachedStage1Ast: string | null = null
let cachedStage1Scanner: string | null = null
let cachedStage1Types: string | null = null
let cachedStage1StructLayout: string | null = null
let cachedStage1TypeEnv: string | null = null
let cachedStage1Typeparse: string | null = null
let cachedStage1ParserExpr: string | null = null
let cachedStage1ParserFull: string | null = null
let cachedStage1Codegen: string | null = null
let cachedStage1Driver: string | null = null

function loadStdlibBase(): string {
  if (cachedStdlibBase !== null) return cachedStdlibBase
  cachedStdlibBase = fs.readFileSync(stdlibBasePath, "utf8")
  return cachedStdlibBase
}

function loadStage1Ast(): string {
  if (cachedStage1Ast !== null) return cachedStage1Ast
  cachedStage1Ast = fs.readFileSync(stage1AstPath, "utf8")
  return cachedStage1Ast
}

function stripAstTypeSection(src: string): string {
  const marker = "// ---- Node arena ----"
  const idx = src.indexOf(marker)
  if (idx === -1) return src
  return src.slice(idx)
}

function loadStage1Scanner(): string {
  if (cachedStage1Scanner !== null) return cachedStage1Scanner
  cachedStage1Scanner = fs.readFileSync(stage1ScannerPath, "utf8")
  return cachedStage1Scanner
}

function loadStage1Types(): string {
  if (cachedStage1Types !== null) return cachedStage1Types
  cachedStage1Types = fs.readFileSync(stage1TypesPath, "utf8")
  return cachedStage1Types
}

function loadStage1StructLayout(): string {
  if (cachedStage1StructLayout !== null) return cachedStage1StructLayout
  cachedStage1StructLayout = fs.readFileSync(stage1StructLayoutPath, "utf8")
  return cachedStage1StructLayout
}

function loadStage1TypeEnv(): string {
  if (cachedStage1TypeEnv !== null) return cachedStage1TypeEnv
  cachedStage1TypeEnv = fs.readFileSync(stage1TypeEnvPath, "utf8")
  return cachedStage1TypeEnv
}

function loadStage1Typeparse(): string {
  if (cachedStage1Typeparse !== null) return cachedStage1Typeparse
  cachedStage1Typeparse = fs.readFileSync(stage1TypeparsePath, "utf8")
  return cachedStage1Typeparse
}

function loadStage1ParserExpr(): string {
  if (cachedStage1ParserExpr !== null) return cachedStage1ParserExpr
  cachedStage1ParserExpr = fs.readFileSync(stage1ParserExprPath, "utf8")
  return cachedStage1ParserExpr
}

function loadStage1ParserFull(): string {
  if (cachedStage1ParserFull !== null) return cachedStage1ParserFull
  cachedStage1ParserFull = fs.readFileSync(stage1ParserFullPath, "utf8")
  return cachedStage1ParserFull
}

function loadStage1Codegen(): string {
  if (cachedStage1Codegen !== null) return cachedStage1Codegen
  cachedStage1Codegen = fs.readFileSync(stage1CodegenPath, "utf8")
  return cachedStage1Codegen
}

function loadStage1Driver(): string {
  if (cachedStage1Driver !== null) return cachedStage1Driver
  cachedStage1Driver = fs.readFileSync(stage1DriverPath, "utf8")
  return cachedStage1Driver
}

export interface RunResult {
  stdout: string
  stderr: string
  status: number
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeTempFile(prefix: string, suffix: string, content: string, baseDir?: string): string {
  const root = baseDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "puff-"))
  ensureDir(root)
  const filePath = path.join(root, `${prefix}${suffix}`)
  fs.writeFileSync(filePath, content, "utf8")
  return filePath
}

export function compileToLl(source: string, workdir?: string): string {
  const result = compile(source)
  if (result.errors.length > 0 || result.program === null) {
    throw new Error(`Compilation failed: ${result.errors.join("\n")}`)
  }
  return writeTempFile("program", ".ll", result.program, workdir)
}

export function compileWithStdlib(source: string, workdir?: string): string {
  const prelude = loadStdlibBase()
  return compileToLl(`${prelude}\n${source}`, workdir)
}

export function buildWithClang(irPath: string | string[], outPath?: string): string {
  const paths = Array.isArray(irPath) ? irPath : [irPath]
  const output = outPath ?? path.join(path.dirname(paths[0]), "a.out")
  const build = spawnSync("clang", [...paths, "-lm", "-o", output], { encoding: "utf8" })
  if (build.status !== 0) {
    throw new Error(`clang failed (${build.status}): ${build.stderr || build.stdout}`)
  }
  return output
}

export function runBinary(binPath: string, input?: string, env?: NodeJS.ProcessEnv, args?: string[]): RunResult {
  const res = spawnSync(binPath, args ?? [], { encoding: "utf8", input, env })
  const signals = (os.constants as any).signals as Record<string, number> | undefined
  const status =
    res.status !== null && res.status !== undefined
      ? res.status
      : res.signal && signals && typeof signals[res.signal] === "number"
        ? 128 + signals[res.signal]
        : res.signal
          ? 128
          : 0
  return {
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    status
  }
}

export function compileAndRun(source: string, input?: string, env?: NodeJS.ProcessEnv, args?: string[]): RunResult {
  const irPath = compileToLl(source)
  const binPath = buildWithClang(irPath)
  return runBinary(binPath, input, env, args)
}

export function compileAndRunWithStdlib(source: string, input?: string, env?: NodeJS.ProcessEnv, args?: string[]): RunResult {
  const irPath = compileWithStdlib(source)
  const binPath = buildWithClang(irPath)
  return runBinary(binPath, input, env, args)
}

/**
 * Convenience: run the Stage1 Puff expression parser to produce an S-expression.
 * This uses the Stage0 compiler to compile Puff Stage1 sources plus stdlib.
 */
export function runStage1ExprSexpr(expr: string, opts?: { allowError?: boolean }): RunResult {
  const allowError = opts?.allowError ?? false
  const source = `
${loadStage1Ast()}
${loadStage1Scanner()}
${loadStage1ParserExpr()}
def print_str(s String) {
  var i = 0;
  while (i < s.length) {
    __putchar__(int((s.data + i)~));
    i = i + 1;
  }
  __putchar__(10);
}
def main() {
  var src = "${expr}";
  var ok = parse_expr_ok(byte~(&src[0]), len(src));
  if (ok == 0 && ${allowError ? 0 : 1} == 1) { __exit__(2); }
  var sexpr = parse_expr_ast_to_sexpr(byte~(&src[0]), len(src));
  print_str(sexpr);
}
`
  return compileAndRunWithStdlib(source)
}

export function runRawIR(ir: string): RunResult {
  const irPath = writeTempFile("raw", ".ll", ir)
  const binPath = buildWithClang(irPath)
  return runBinary(binPath)
}

/**
 * Convenience: run Stage1 expression token/operator counters.
 * Returns stdout as string with counts separated by spaces.
 */
export function runStage1ExprCounts(expr: string): RunResult {
  const source = `
${loadStage1Ast()}
${loadStage1Scanner()}
${loadStage1ParserExpr()}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x;
  var buf = vecbyte_new(16);
  if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) {
    buf = vecbyte_push(buf, byte(48 + (n % 10)));
    n = n / 10;
  }
  var i = buf.length - 1;
  while (i >= 0) {
    __putchar__(int((buf.data + i)~));
    i = i - 1;
  }
}

def main() {
  var src = "${expr}";
  var ptr = byte~(&src[0]);
  var l = len(src);
  var tok = expr_token_count(ptr, l);
  var op = expr_operator_count(ptr, l);
  print_int(tok);
  __putchar__(32);
  print_int(op);
  __putchar__(10);
}
`
  return compileAndRunWithStdlib(source)
}

/**
 * Convenience: run Stage1 expression diagnostics (tokens, operators, depth, nodes).
 * Returns stdout as "tok op depth nodes" with spaces.
 */
export function runStage1ExprSummary(expr: string): RunResult {
  const source = `
${loadStage1Ast()}
${loadStage1Scanner()}
${loadStage1ParserExpr()}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x;
  var buf = vecbyte_new(16);
  if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) {
    buf = vecbyte_push(buf, byte(48 + (n % 10)));
    n = n / 10;
  }
  var i = buf.length - 1;
  while (i >= 0) {
    __putchar__(int((buf.data + i)~));
    i = i - 1;
  }
}

def main() {
  var src = "${expr}";
  var ptr = byte~(&src[0]);
  var l = len(src);
  var tok = expr_token_count(ptr, l);
  var op = expr_operator_count(ptr, l);
  var depth = expr_sexpr_depth(ptr, l);
  var nodes = expr_node_count(ptr, l);
  print_int(tok); __putchar__(32);
  print_int(op); __putchar__(32);
  print_int(depth); __putchar__(32);
  print_int(nodes); __putchar__(10);
}
`
  return compileAndRunWithStdlib(source)
}

/**
 * Parse a full Puff module with the Stage1 parser_full and emit a textual summary.
 */
export function runStage1ModuleSummary(program: string): RunResult {
  const normalized = program.trim().replace(/\r?\n/g, " ")
  const programLiteral = JSON.stringify(normalized)
  const source = `
${loadStage1Types()}
${stripAstTypeSection(loadStage1Ast())}
${loadStage1Scanner()}
${loadStage1StructLayout()}
${loadStage1TypeEnv()}
${loadStage1ParserExpr()}
${loadStage1Typeparse()}
${loadStage1ParserFull()}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x;
  var buf = vecbyte_new(32);
  if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) {
    buf = vecbyte_push(buf, byte(48 + (n % 10)));
    n = n / 10;
  }
  var i = buf.length - 1;
  while (i >= 0) {
    __putchar__(int((buf.data + i)~));
    i = i - 1;
  }
}

def print_str(s String) {
  var i = 0;
  while (i < s.length) {
    __putchar__(int((s.data + i)~));
    i = i + 1;
  }
  __putchar__(10);
}

def main() {
  var src = ${programLiteral};
  var res = parse_module_source(byte~(&src[0]), len(src));
  var summary = module_summary(res);
  print_str(summary);
}
`
  return compileAndRunWithStdlib(source)
}

/**
 * Count module-level constructs using parser_full: functions, imports, exports, structs.
 * Outputs: "funcs=<n> imports=<n> exports=<n> structs=<n> vars=<n>"
 */
export function runStage1ModuleCounts(program: string): RunResult {
  const normalized = program.trim().replace(/\r?\n/g, " ")
  const programLiteral = JSON.stringify(normalized)
  const source = `
${loadStage1Types()}
${stripAstTypeSection(loadStage1Ast())}
${loadStage1Scanner()}
${loadStage1StructLayout()}
${loadStage1TypeEnv()}
${loadStage1ParserExpr()}
${loadStage1Typeparse()}
${loadStage1ParserFull()}

def print_str(s String) {
  var i = 0;
  while (i < s.length) {
    __putchar__(int((s.data + i)~));
    i = i + 1;
  }
  __putchar__(10);
}

def main() {
  var src = ${programLiteral};
  var res = parse_module_source(byte~(&src[0]), len(src));
  var counts = module_counts(res);
  print_str(counts);
}
`
  return compileAndRunWithStdlib(source)
}

/**
 * Run Stage1 resolver (resolve_module_tokens) against a source string.
 * Prints "1" on success, "0" on failure.
 */
export function runStage1ResolverModule(src: string): RunResult {
  const normalized = src.trim().replace(/\r?\n/g, " ")
  const programLiteral = JSON.stringify(normalized)
  const source = `
${loadStage1Types()}
${stripAstTypeSection(loadStage1Ast())}
${loadStage1Scanner()}
${loadStage1StructLayout()}
${loadStage1TypeEnv()}
${loadStage1ParserExpr()}
${loadStage1Typeparse()}
${loadStage1ParserFull()}
${fs.readFileSync(path.join(__dirname, "..", "stage1", "resolver.puff"), "utf8")}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x;
  var buf = vecbyte_new(16);
  if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) {
    buf = vecbyte_push(buf, byte(48 + (n % 10)));
    n = n / 10;
  }
  var i = buf.length - 1;
  while (i >= 0) {
    __putchar__(int((buf.data + i)~));
    i = i - 1;
  }
}

def main() {
  var src = ${programLiteral};
  var ok = resolve_module_tokens(byte~(&src[0]), len(src));
  print_int(ok);
  __putchar__(10);
}
`
  return compileAndRunWithStdlib(source)
}

/**
 * Run Stage1 AST-based resolver (resolve_module_ast) against a source string.
 * Prints "1" on success, "0" on failure.
 */
export function runStage1ResolverAst(src: string): RunResult {
  const normalized = src.trim().replace(/\r?\n/g, " ")
  const programLiteral = JSON.stringify(normalized)
  const source = `
${loadStage1Types()}
${stripAstTypeSection(loadStage1Ast())}
${loadStage1Scanner()}
${loadStage1StructLayout()}
${loadStage1TypeEnv()}
${loadStage1ParserExpr()}
${loadStage1Typeparse()}
${loadStage1ParserFull()}
${fs.readFileSync(path.join(__dirname, "..", "stage1", "resolver.puff"), "utf8")}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x;
  var buf = vecbyte_new(16);
  if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) {
    buf = vecbyte_push(buf, byte(48 + (n % 10)));
    n = n / 10;
  }
  var i = buf.length - 1;
  while (i >= 0) {
    __putchar__(int((buf.data + i)~));
    i = i - 1;
  }
}

def main() {
  var src = ${programLiteral};
  var ok = resolve_module_ast(byte~(&src[0]), len(src));
  print_int(ok);
  __putchar__(10);
}
`
  return compileAndRunWithStdlib(source)
}

/**
 * Compile Puff source to LLVM IR using the Stage1 (Puff) compiler and return the IR via stdout.
 */
export function runStage1CompileToIr(program: string): RunResult {
  const normalized = program.trim().replace(/\r?\n/g, " ")
  const programLiteral = JSON.stringify(normalized)
  const source = `
${loadStage1Types()}
${stripAstTypeSection(loadStage1Ast())}
${loadStage1Scanner()}
${loadStage1StructLayout()}
${loadStage1TypeEnv()}
${loadStage1ParserExpr()}
${loadStage1Typeparse()}
${loadStage1ParserFull()}
${fs.readFileSync(path.join(__dirname, "..", "stage1", "resolver.puff"), "utf8")}
${loadStage1Codegen()}
${loadStage1Driver()}

def print_str(s String) {
  var i = 0;
  while (i < s.length) {
    __putchar__(int((s.data + i)~));
    i = i + 1;
  }
  __putchar__(10);
}

def main() {
  var src = ${programLiteral};
  var ir = compile_to_ir(byte~(&src[0]), len(src));
  print_str(ir);
}
`
  return compileAndRunWithStdlib(source)
}
