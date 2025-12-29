import { compileAndRun } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("language extensions - function overloading", () => {
  test("overload by arity and defaults", () => {
    const source = `
    def foo(a int) int { return a + 1; }
    def foo(a int, b int) int { return a + b; }
    def foo(a int, b int, c int = 5) int { return a + b + c; }
    def main() {
      print foo(1);
      print foo(2, 3);
      print foo(1, 1, 1);
      print foo(1, 1);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["2", "5", "3", "2"])
  })
})

