import { compileAndRunWithStdlib } from "../src/harness"

describe("stdlib string search helpers", () => {
  test("str_index_of finds first occurrence", () => {
    const source = `
    def main() {
      var s = "hello world";
      var n = "lo";
      print str_index_of(byte~(&s[0]), len(s), byte~(&n[0]), len(n));
      var n2 = "world";
      print str_index_of(byte~(&s[0]), len(s), byte~(&n2[0]), len(n2));
      var n3 = "zzz";
      print str_index_of(byte~(&s[0]), len(s), byte~(&n3[0]), len(n3));
      var n4 = "";
      print str_index_of(byte~(&s[0]), len(s), byte~(&n4[0]), len(n4));
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(["3", "6", "-1", "0"])
  })

  test("str_contains wraps index check", () => {
    const source = `
    def main() {
      var s = "puffscript";
      var a = "puff";
      var b = "script";
      var c = "puffscript";
      var d = "x";
      print str_contains(byte~(&s[0]), len(s), byte~(&a[0]), len(a));
      print str_contains(byte~(&s[0]), len(s), byte~(&b[0]), len(b));
      print str_contains(byte~(&s[0]), len(s), byte~(&c[0]), len(c));
      print str_contains(byte~(&s[0]), len(s), byte~(&d[0]), len(d));
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(["1", "1", "1", "0"])
  })
})
