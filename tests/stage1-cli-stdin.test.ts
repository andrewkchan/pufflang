import { spawnSync } from "child_process"
import path from "path"

describe("Stage1 CLI stdin", () => {
  it("reads program from stdin when path is '-'", () => {
    const program = "def main() int { return 6; }"
    const res = spawnSync("npm", ["run", "stage1", "--", "--run", "-"], {
      cwd: path.join(__dirname, ".."),
      input: program,
      encoding: "utf8"
    })
    expect(res.status).toBe(6)
    expect(res.stderr).toBe("")
  })
})
