import { spawnSync } from "child_process"
import path from "path"

describe("Stage1 bootstrap smoke", () => {
  it("runs bootstrap:stage1 and exits with 42", () => {
    const res = spawnSync("npm", ["run", "bootstrap:stage1"], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8"
    })
    expect(res.status).toBe(42)
    expect(res.stderr).toBe("")
  })
})
