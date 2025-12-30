import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const scopeSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scope.puff"), "utf8")

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 scope helpers", () => {
  test("lookup across nested scopes and shadowing", () => {
    const source = `
    ${scopeSrc}
    def make_string_literal(ptr byte~, n int) String { return String{ptr, n}; }
    def main() {
      var a = "alpha";
      var b = "beta";
      var c = "alpha";
      var s = scope_new();
      s = scope_define(s, make_string_literal(byte~(&a[0]), len(a))); // depth 0
      s = scope_enter(s);
      s = scope_define(s, make_string_literal(byte~(&b[0]), len(b))); // depth 1
      print scope_lookup(s, make_string_literal(byte~(&a[0]), len(a))); // 1
      print scope_lookup(s, make_string_literal(byte~(&b[0]), len(b))); // 1
      print scope_lookup_current(s, make_string_literal(byte~(&a[0]), len(a))); // 0
      print scope_lookup_current(s, make_string_literal(byte~(&b[0]), len(b))); // 1
      // shadow alpha
      s = scope_define(s, make_string_literal(byte~(&c[0]), len(c)));
      print scope_lookup_current(s, make_string_literal(byte~(&a[0]), len(a))); // 1
      s = scope_exit(s); // back to depth 0
      print scope_lookup(s, make_string_literal(byte~(&b[0]), len(b))); // 1? (removed) expect 0
      print scope_lookup(s, make_string_literal(byte~(&a[0]), len(a))); // 1
      print scope_lookup_current(s, make_string_literal(byte~(&a[0]), len(a))); // 1
      print scope_lookup_current(s, make_string_literal(byte~(&b[0]), len(b))); // 0
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual([
      "1",
      "1",
      "0",
      "1",
      "1",
      "0",
      "1",
      "1",
      "0"
    ])
  })
})
