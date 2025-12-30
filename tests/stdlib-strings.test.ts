import { compileAndRunWithStdlib } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("stdlib string and generic vec helpers", () => {
  test("str_eq / str_clone / sb_append_string", () => {
    const source = `
    def main() {
      var a = "hello";
      var b = "hello";
      var c = "hell";
      print str_eq(byte~(&a[0]), len(a), byte~(&b[0]), len(b));
      print str_eq(byte~(&a[0]), len(a), byte~(&c[0]), len(c));

      var clone = str_clone(byte~(&a[0]), len(a));
      print clone.length;
      // mutate original to ensure clone is independent
      (byte~(&a[0]))~ = byte(72); // 'H'
      print (clone.data)~; // should remain 'h'

      var sb = sb_new();
      sb = sb_append_string(sb, clone);
      var bang = "!";
      sb = sb_append_string(sb, String{byte~(&bang[0]), len(bang)});
      var s = sb_to_string(sb);
      print s.length;
      print (s.data)~; // 'h'
      print (s.data + s.length - 1)~; // '!'
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["1", "0", "5", "104", "6", "104", "33"])
  })

  test("generic Vec push/set/get bytes for struct-like payload", () => {
    const source = `
    def main() {
      // store fixed-size 2-byte records
      var v = vec_new(2, 1);
      var r1 = "ab";
      v = vec_push(v, byte~(&r1[0]));
      var r2 = "cd";
      v = vec_push(v, byte~(&r2[0]));
      // overwrite first record
      var r3 = "ef";
      v = vec_set(v, 0, byte~(&r3[0]));

      print v.length;
      var p0 = vec_get_ptr(v, 0);
      var p1 = vec_get_ptr(v, 1);
      print p0~;           // 'e'
      print (p0 + 1)~;     // 'f'
      print p1~;           // 'c'
      print (p1 + 1)~;     // 'd'
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["2", "101", "102", "99", "100"])
  })
})
