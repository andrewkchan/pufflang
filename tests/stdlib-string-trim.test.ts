import { compileAndRunWithStdlib } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("stdlib string trim ascii", () => {
  test("trims leading and trailing whitespace", () => {
    const source = `
    def main() {
      var buf = __malloc__(15);
      (buf + 0)~ = byte(32);
      (buf + 1)~ = byte(32);
      (buf + 2)~ = byte(9);
      (buf + 3)~ = byte(104); // h
      (buf + 4)~ = byte(101); // e
      (buf + 5)~ = byte(108); // l
      (buf + 6)~ = byte(108); // l
      (buf + 7)~ = byte(111); // o
      (buf + 8)~ = byte(32);  // space
      (buf + 9)~ = byte(119); // w
      (buf + 10)~ = byte(111);// o
      (buf + 11)~ = byte(114);// r
      (buf + 12)~ = byte(108);// l
      (buf + 13)~ = byte(100);// d
      (buf + 14)~ = byte(10); // newline
      var t = str_trim_ascii(buf, 15);
      var expect = "hello world";
      print t.length;
      print str_eq(t.data, t.length, byte~(&expect[0]), len(expect));

      var s2 = "nospaces";
      var t2 = str_trim_ascii(byte~(&s2[0]), len(s2));
      print t2.length;
      print str_eq(t2.data, t2.length, byte~(&s2[0]), len(s2));

      var s3 = "   ";
      var t3 = str_trim_ascii(byte~(&s3[0]), len(s3));
      print t3.length;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["11", "1", "8", "1", "0"])
  })
})
