import { compileAndRun } from "../src/harness"

describe("LLVM backend globals", () => {
  test("global scalar initialization and use", () => {
    const source = `
    var g = 2;
    def inc(x int) int { return x + g; }
    def main() {
      g = g + 1;
      print inc(3);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout).toBe("6\n")
  })
})
