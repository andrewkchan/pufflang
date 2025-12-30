import { compileAndRunWithStdlib } from "../src/harness"

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("VecStr helpers", () => {
  test("push/get/pop maintains order", () => {
    const source = `
    def make_string_literal(ptr byte~, n int) String { return String{ptr, n}; }
    def main() {
      var a = "alpha";
      var b = "beta";
      var c = "gamma";
      var v = vecstr_new(2);
      v = vecstr_push(v, make_string_literal(byte~(&a[0]), len(a)));
      v = vecstr_push(v, make_string_literal(byte~(&b[0]), len(b)));
      v = vecstr_push(v, make_string_literal(byte~(&c[0]), len(c)));
      var second = vecstr_get(v, 1);
      var nl byte = byte(10);
      __write__(1, second.data, second.length);
      __write__(1, byte~(&nl), 1);
      var popped = vecstr_pop(v);
      v = popped.vec;
      __write__(1, popped.value.data, popped.value.length);
      __write__(1, byte~(&nl), 1);
      var first = vecstr_get(v, 0);
      __write__(1, first.data, first.length);
      __write__(1, byte~(&nl), 1);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["beta", "gamma", "alpha"])
  })
})
