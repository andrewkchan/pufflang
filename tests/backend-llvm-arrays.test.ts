import { compileAndRun } from "../src/harness"

describe("LLVM backend arrays", () => {
  test("list literals and indexing", () => {
    const source = `
    def main() {
      var a = [1, 2, 3];
      print a[0];
      print a[1];
      print a[2];
      a[1] = 5;
      print a[1];
      print len(a);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const expected = ["1","2","3","5","3"]
    const got = res.stdout.trim().split("\n").filter((x) => x.length > 0)
    expect(got).toEqual(expected)
  })

  test("repeat literals", () => {
    const source = `
    def main() {
      var a = [7; 4];
      print a[0];
      print a[3];
      a[2] = 9;
      print a[2];
      print len(a);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const expected = ["7","7","9","4"]
    const got = res.stdout.trim().split("\n").filter((x) => x.length > 0)
    expect(got).toEqual(expected)
  })
})
