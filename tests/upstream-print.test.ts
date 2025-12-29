import { compileAndRun } from "../src/harness"

describe("Upstream E2E - print", () => {
  test("prints various literals", () => {
    const source = `
    def main() {
      var bt = byte(256 + 42);
      var bl = true;
      var i = 256 + 42;
      var f = 3.1415927410125732;
      var arr = [1,2,3];
      var ih = 0xAABBCCDD;
      var bt_ascii = 'a';
      var str = "hello world";
      print bt;
      print bl;
      print i;
      print f;
      print arr;
      print ih;
      print bt_ascii;
      print str;
    }
    `
    const expected = [
      "42",
      "1",
      "298",
      "3.141593",
      "[1, 2, 3]",
      "-1430532899",
      "97",
      "hello world",
    ]
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n")
    expect(got).toEqual(expected)
  })
})
