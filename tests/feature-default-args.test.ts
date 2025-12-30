import { compileAndRun } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("language extensions - default arguments", () => {
  test("default args fill trailing parameters", () => {
    const source = `
    def add(a int, b int = 2, c int = 3) int {
      return a + b + c;
    }
    def main() {
      print add(1);
      print add(1, 5);
      print add(1, 5, 7);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["6", "9", "13"])
  })
})

