import { compileAndRunWithStdlib } from "../src/harness"

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Interner (string -> index)", () => {
  test("deduplicates strings and preserves data", () => {
    const source = `
    def make_string_literal(ptr byte~, n int) String { return String{ptr, n}; }
    def write_int_ln(x int) {
      var sb = sb_new();
      sb = sb_append_int(sb, x);
      sb = sb_append_byte(sb, byte(10));
      var s = sb_to_string(sb);
      __write__(1, s.data, s.length);
    }
    def main() {
      var a = "alpha";
      var b = "beta";
      var c = "alpha";
      var inter = interner_new(4);
      var r1 = interner_intern(inter, make_string_literal(byte~(&a[0]), len(a)));
      inter = r1.interner;
      var r2 = interner_intern(inter, make_string_literal(byte~(&b[0]), len(b)));
      inter = r2.interner;
      var r3 = interner_intern(inter, make_string_literal(byte~(&c[0]), len(c)));
      inter = r3.interner;
      write_int_ln(r1.index);
      write_int_ln(r2.index);
      write_int_ln(r3.index);
      var got = interner_get(inter, r1.index);
      __write__(1, got.data, got.length);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const out = lines(res.stdout)
    expect(out[0]).toBe("0")
    expect(out[1]).toBe("1")
    expect(out[2]).toBe("0")
    expect(out[3]).toBe("alpha")
  })
})
