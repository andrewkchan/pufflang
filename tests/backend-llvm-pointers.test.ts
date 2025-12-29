import { compileAndRun } from "../src/harness"

describe("LLVM backend pointers", () => {
  test("address-of, deref, and pointer arithmetic on arrays", () => {
    const source = `
    def main() {
      var arr = [10, 20, 30];
      var p = &arr[0];
      print p~;
      p~ = 15;
      print arr[0];
      var p1 = p + 1;
      print p1~;
      var p2 = p1 - 1;
      print p2~;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const expected = ["10","15","20","15"]
    const got = res.stdout.trim().split("\n").filter((x)=>x.length>0)
    expect(got).toEqual(expected)
  })
})
