import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { compile } from "./index"

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

export function buildWithClang(irPath: string, outPath?: string): string {
  const output = outPath ?? path.join(path.dirname(irPath), "a.out")
  const build = spawnSync("clang", ["-x", "ir", irPath, "-lm", "-o", output], { encoding: "utf8" })
  if (build.status !== 0) {
    throw new Error(`clang failed (${build.status}): ${build.stderr || build.stdout}`)
  }
  return output
}

export function runBinary(binPath: string): RunResult {
  const res = spawnSync(binPath, { encoding: "utf8" })
  return {
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    status: res.status ?? 0
  }
}

export function compileAndRun(source: string): RunResult {
  const irPath = compileToLl(source)
  const binPath = buildWithClang(irPath)
  return runBinary(binPath)
}

export function runRawIR(ir: string): RunResult {
  const irPath = writeTempFile("raw", ".ll", ir)
  const binPath = buildWithClang(irPath)
  return runBinary(binPath)
}
