import { compileAndRunWithStdlib } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("stdlib StringBuilder extras", () => {
  test("sb_clear resets length", () => {
    const source = `
    def main() {
      var sb = sb_new();
      var hello = "hello";
      sb = sb_append_string(sb, String{byte~(&hello[0]), len(hello)});
      print sb.buf.length;
      sb = sb_clear(sb);
      print sb.buf.length;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["5", "0"])
  })

  test("sb_append_cstr appends null-terminated string", () => {
    const source = `
    def main() {
      var sb = sb_new();
      var cstr = __malloc__(6);
      (cstr + 0)~ = byte(119); // w
      (cstr + 1)~ = byte(111); // o
      (cstr + 2)~ = byte(114); // r
      (cstr + 3)~ = byte(108); // l
      (cstr + 4)~ = byte(100); // d
      (cstr + 5)~ = byte(0);   // NUL
      sb = sb_append_cstr(sb, cstr);
      var s = sb_to_string(sb);
      var expect = "world";
      print s.length;
      print str_eq(s.data, s.length, byte~(&expect[0]), len(expect));
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["5", "1"])
  })
})
