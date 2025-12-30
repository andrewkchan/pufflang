import { compileAndRun } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("language extensions - import declarations", () => {
  test("import libc abs", () => {
    const source = `
    import def abs(x int) int;
    def main() {
      print abs(-5);
      print abs(7);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["5", "7"])
  })
})

