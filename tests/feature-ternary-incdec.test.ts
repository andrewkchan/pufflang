import { compileAndRun } from "../src/harness"

function lines(res: { stdout: string }) {
  return res.stdout.trim().split("\n").map((s) => s.trim())
}

describe("language extensions - ternary and ++/--", () => {
  test("prefix and postfix ++/-- on ints", () => {
    const source = `
    def main() {
      var x = 1;
      var y = ++x; // x = 2, y = 2
      print x;
      print y;
      var z = x++; // x = 3, z = 2
      print x;
      print z;
      var w = --x; // x = 2, w = 2
      print x;
      print w;
      var q = x--; // x = 1, q = 2
      print x;
      print q;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["2", "2", "3", "2", "2", "2", "1", "2"])
  })

  test("++/-- on bytes and expression contexts", () => {
    const source = `
    def main() {
      var b = byte(255);
      print b;
      var c = b++;
      print b;
      print c;
      var d = --b;
      print b;
      print d;
      var e = (b++ + 2);
      print b;
      print e;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["255", "0", "255", "255", "255", "0", "257"])
  })

  test("ternary operator chooses matching branch types", () => {
    const source = `
    def main() {
      var a = 5;
      var b = 10;
      var c = a < b ? a : b;
      var d = a > b ? a : b;
      print c;
      print d;
      var e = (c < d ? c + d : c - d);
      print e;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["5", "10", "15"])
  })
})

