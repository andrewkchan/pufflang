import os from "os"
import path from "path"
import fs from "fs"
import { runStage1CompileToIr, runRawIR } from "./harness"

function usage() {
  console.error("Usage: npm run bootstrap:stage1 -- [path-to-program.puff]")
  console.error("If no path is provided, a default program returns 42.")
}

function loadProgram(): string {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    return "def main() int { return 42; }"
  }
  if (args[0] === "-h" || args[0] === "--help") {
    usage()
    process.exit(1)
  }
  const p = path.resolve(args[0])
  if (!fs.existsSync(p)) {
    console.error(`Program not found: ${p}`)
    process.exit(1)
  }
  return fs.readFileSync(p, "utf8")
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "puff-bootstrap-"))
  const irPath = path.join(tmp, "stage1-output.ll")
  const prog = loadProgram()

  const res = runStage1CompileToIr(prog)
  if (res.status !== 0) {
    process.stderr.write(res.stderr)
    process.exit(res.status)
  }
  const ir = res.stdout
  if (!ir || ir.trim().length === 0) {
    console.error("Stage1 compile produced empty IR")
    process.exit(1)
  }
  if (!ir.includes("@main")) {
    console.error("Stage1 IR missing main")
    process.exit(1)
  }

  fs.writeFileSync(irPath, ir, "utf8")

  const runRes = runRawIR(ir)
  if (runRes.stderr) process.stderr.write(runRes.stderr)
  if (runRes.stdout) process.stdout.write(runRes.stdout)
  process.exit(runRes.status)
}

main()
