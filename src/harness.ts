import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { compile } from "./index"

const stdlibBasePath = path.join(__dirname, "..", "stdlib", "base.puff")
let cachedStdlibBase: string | null = null

function loadStdlibBase(): string {
  if (cachedStdlibBase !== null) return cachedStdlibBase
  cachedStdlibBase = fs.readFileSync(stdlibBasePath, "utf8")
  return cachedStdlibBase
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
  return {
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    status: res.status ?? 0
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

export function runRawIR(ir: string): RunResult {
  const irPath = writeTempFile("raw", ".ll", ir)
  const binPath = buildWithClang(irPath)
  return runBinary(binPath)
}
