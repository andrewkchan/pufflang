import os from "os"
import path from "path"
import fs from "fs"
import { runStage1CompileToIr, runRawIR } from "./harness"

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "puff-bootstrap-"))
  const irPath = path.join(tmp, "stage1-output.ll")
  const prog = `def main() int { return 42; }`

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
