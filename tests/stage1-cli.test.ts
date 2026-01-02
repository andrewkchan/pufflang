import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"

describe("Stage1 CLI smoke test", () => {
  it("compiles and runs a simple program via npm run stage1 -- --run", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "puff-stage1-cli-"))
    const srcPath = path.join(tmpDir, "prog.puff")
    fs.writeFileSync(
      srcPath,
      `
      def main() int { return 7; }
    `,
      "utf8"
    )

    const res = spawnSync("npm", ["run", "stage1", "--", "--run", srcPath], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8"
    })

    // npm prefixes output; ensure exit code matches program's return.
    expect(res.status).toBe(7)
    expect(res.stderr).toBe("")
  })
})
