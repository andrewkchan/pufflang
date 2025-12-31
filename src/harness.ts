import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { compile } from "./index"

const stdlibBasePath = path.join(__dirname, "..", "stdlib", "base.puff")
let cachedStdlibBase: string | null = null
const stage1AstPath = path.join(__dirname, "..", "stage1", "ast.puff")
const stage1ScannerPath = path.join(__dirname, "..", "stage1", "scanner.puff")
const stage1ParserExprPath = path.join(__dirname, "..", "stage1", "parser_expr.puff")
let cachedStage1Ast: string | null = null
let cachedStage1Scanner: string | null = null
let cachedStage1ParserExpr: string | null = null

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

function loadStage1Scanner(): string {
  if (cachedStage1Scanner !== null) return cachedStage1Scanner
  cachedStage1Scanner = fs.readFileSync(stage1ScannerPath, "utf8")
  return cachedStage1Scanner
}

function loadStage1ParserExpr(): string {
  if (cachedStage1ParserExpr !== null) return cachedStage1ParserExpr
  cachedStage1ParserExpr = fs.readFileSync(stage1ParserExprPath, "utf8")
  return cachedStage1ParserExpr
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
