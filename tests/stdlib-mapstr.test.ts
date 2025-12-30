import { compileAndRunWithStdlib } from "../src/harness"

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("stdlib MapStr (string -> int)", () => {
  test("put/get/overwrite/delete", () => {
    const source = `
    def make_string_literal(ptr byte~, n int) String { return String{ptr, n}; }

    def main() {
      var m = mapstr_new(4);
      var a = "alpha";
      var b = "beta";
      var c = "gamma";
      var d = "beta";
      m = mapstr_put(m, make_string_literal(byte~(&a[0]), len(a)), 1);
      m = mapstr_put(m, make_string_literal(byte~(&b[0]), len(b)), 2);
      m = mapstr_put(m, make_string_literal(byte~(&c[0]), len(c)), 3);
      // overwrite beta
      m = mapstr_put(m, make_string_literal(byte~(&d[0]), len(d)), 4);
      // delete gamma
      m = mapstr_delete(m, make_string_literal(byte~(&c[0]), len(c)));
      var va = mapstr_get(m, make_string_literal(byte~(&a[0]), len(a)));
      var vb = mapstr_get(m, make_string_literal(byte~(&b[0]), len(b)));
      var vc = mapstr_get(m, make_string_literal(byte~(&c[0]), len(c)));
      print va;
      print vb;
      print vc;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["1", "4", "-2147483648"])
  })
})
