import { compileAndRun } from "../src/harness"

describe("LLVM backend builtins", () => {
  test("sqrt builtin", () => {
    const source = `
    def main() {
      print __sqrt__(4.0);
      print __sqrt__(2.25);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n")
    expect(got.length).toBe(2)
    expect(parseFloat(got[0])).toBeCloseTo(2.0)
    expect(parseFloat(got[1])).toBeCloseTo(1.5)
  })
})
