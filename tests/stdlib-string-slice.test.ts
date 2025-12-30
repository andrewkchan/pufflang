import { compileAndRunWithStdlib } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("stdlib string slicing", () => {
  test("slice in-bounds and clamped", () => {
    const source = `
    def main() {
      var s = "puffscript";
      var sub = str_slice(byte~(&s[0]), len(s), 4, 6); // "script"
      var expect = "script";
      print sub.length;
      print str_eq(sub.data, sub.length, byte~(&expect[0]), len(expect));

      var sub2 = str_slice(byte~(&s[0]), len(s), 0, 4); // "puff"
      var expect2 = "puff";
      print sub2.length;
      print str_eq(sub2.data, sub2.length, byte~(&expect2[0]), len(expect2));

      var sub3 = str_slice(byte~(&s[0]), len(s), 20, 5); // past end -> empty
      print sub3.length;

      var sub4 = str_slice(byte~(&s[0]), len(s), 3, 100); // clamp
      var expect4 = "fscript";
      print sub4.length;
      print str_eq(sub4.data, sub4.length, byte~(&expect4[0]), len(expect4));
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["6", "1", "4", "1", "0", "7", "1"])
  })
})
