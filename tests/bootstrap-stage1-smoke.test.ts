import { spawnSync } from "child_process"
import path from "path"
import fs from "fs"
import os from "os"

describe("Stage1 bootstrap smoke", () => {
  it("runs bootstrap:stage1 and exits with 42", () => {
    const res = spawnSync("npm", ["run", "bootstrap:stage1"], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8"
    })
    expect(res.status).toBe(42)
    expect(res.stderr).toBe("")
  })

  it("runs bootstrap:stage1 with custom program path", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "puff-bootstrap-test-"))
    const progPath = path.join(tmpDir, "prog.puff")
    fs.writeFileSync(progPath, "def main() int { return 9; }", "utf8")
    const res = spawnSync("npm", ["run", "bootstrap:stage1", "--", progPath], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8"
    })
    expect(res.status).toBe(9)
    expect(res.stderr).toBe("")
  })
})
