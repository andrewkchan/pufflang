import { compileAndRun } from "../src/harness"

describe("LLVM backend control flow and calls", () => {
  test("function call and return", () => {
    const source = `
    def add(a int, b int) int {
      return a + b;
    }
    def main() {
      print add(2, 3);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout).toBe("5\n")
  })

  test("if/while with ints", () => {
    const source = `
    def main() int {
      var x = 0;
      var i = 0;
      while (i < 3) {
        if (i == 1) {
          x = x + 2;
        } else {
          x = x + 1;
        }
        i = i + 1;
      }
      return x;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(4)
    expect(res.stderr).toBe("")
    expect(res.stdout).toBe("")
  })
})
