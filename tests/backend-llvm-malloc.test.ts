import { compileAndRun } from "../src/harness"

describe("LLVM backend malloc/free builtins", () => {
  test("malloc, store, load, and free", () => {
    const source = `
    def main() {
      var p = __malloc__(4);
      p~ = 65;
      print p~;
      var p1 = p + 1;
      p1~ = 66;
      print p1~;
      __free__(p);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n").map((x) => parseInt(x, 10))
    expect(got).toEqual([65, 66])
  })
})
