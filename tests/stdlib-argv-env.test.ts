import { compileAndRunWithStdlib } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("stdlib argv/env helpers", () => {
  test("argv_count and argv_at reflect provided args", () => {
    const source = `
    def main(argc int, argv byte~~) {
      print argv_count();
      var a1 = argv_at(1);
      var a2 = argv_at(2);
      var one = "one";
      var two = "two";
      print str_eq(a1.data, a1.length, byte~(&one[0]), len(one));
      print str_eq(a2.data, a2.length, byte~(&two[0]), len(two));
    }
    `
    const res = compileAndRunWithStdlib(source, undefined, undefined, ["one", "two"])
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const out = lines(res)
    expect(out).toEqual(["3", "1", "1"])
  })

  test("getenv_clone reads environment variable", () => {
    const key = "PATH"
    const source = `
    def main() {
      var key = "${key}\\0";
      var v = getenv_clone(byte~(&key[0]));
      // Even if env is missing, ensure wrapper does not crash.
      print v.length;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
  })
})
