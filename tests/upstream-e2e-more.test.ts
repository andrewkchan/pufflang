import { compileAndRun } from "../src/harness"

function lines(res: ReturnType<typeof compileAndRun>) {
  return res.stdout.trim().split("\n")
}

describe("Upstream E2E - additional programs", () => {
  test("iteration (factorial, pow)", () => {
    const source = `
    def factorial(n int) int {
      var result = 1;
      while (n > 0) {
        result = result * n;
        n -= 1;
      }
      return result;
    }
    def pow(x float, n int) float {
      var result = 1.0;
      for (var i = 0; i < n; i += 1) {
        result = result * x;
      }
      return result;
    }
    def main() {
      print factorial(0);
      print factorial(5);
      print pow(0.5, 3);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = lines(res)
    expect(got[0]).toBe("1")
    expect(got[1]).toBe("120")
    expect(parseFloat(got[2])).toBeCloseTo(0.125, 6)
  })

  test("for loops", () => {
    const source = `
    def main() {
      {
        var i = 1337;
        for (var i = 0; i < 3; i += 1) {
          print i;
        }
        print i;
      }
      for (var i = 0; i < 8; i += 2) {
        print i;
      }
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = lines(res)
    expect(got).toEqual(["0", "1", "2", "1337", "0", "2", "4", "6"])
  })

  test("assignment eval and chaining", () => {
    const source = `
    def factorial(n int) int {
      var result = n;
      while (n = n - 1) {
        result = result * n;
      }
      return result;
    }
    var x = 1;
    def main() {
      var y = 2;
      print x = y = factorial(5);
      print x;
      print y;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = lines(res)
    expect(got).toEqual(["120", "120", "120"])
  })

  test("lexical scope globals/locals", () => {
    const source = `
    var a = 1;
    var b = 2;
    var c = 3;
    def printGlobals() {
      print a;
      print b;
      print c;
    }
    def incGlobals() {
      a = a + 1;
      b = b + 1;
      c = c + 1;
    }
    def main() {
      print a; // 1
      print b; // 2
      print c; // 3
      var a = 10;
      var b = 20;
      {
        print a; // 10
        var a = 100;
        b = b + 1;
        print a; // 100
        print b; // 21
        print c; // 3
      }
      print a; // 10
      print b; // 21
      print c; // 3
      b = b + 1;
      print b; // 22
      printGlobals();
      incGlobals();
      printGlobals();
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = lines(res)
    const expected = [
      "1",
      "2",
      "3",
      "10",
      "100",
      "21",
      "3",
      "10",
      "21",
      "3",
      "22",
      "1",
      "2",
      "3",
      "2",
      "3",
      "4"
    ]
    expect(got).toEqual(expected)
  })

  test("global initializers out of order", () => {
    const source = `
    var y = add(10, x);
    var x = add(12, 34);
    def add(x int, y int) int {
      return x + y;
    }
    def main() {
      print x;
      print y;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = lines(res)
    expect(got).toEqual(["46", "56"])
  })

  test("arrays basics (ints and floats)", () => {
    const source = `
    def main() {
      var a = [6, 7, 8];
      print a[0];
      print len(a);
      print a[len(a) - 1];
      a[0] = 1337;
      print a[0];

      var b = [3.14; 3];
      print b[0];
      print b[1];
      print b[2];
      print len(b);
      b[0] = 2.718;
      print b[0];
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = lines(res)
    expect(got[0]).toBe("6")
    expect(got[1]).toBe("3")
    expect(got[2]).toBe("8")
    expect(got[3]).toBe("1337")
    expect(parseFloat(got[4])).toBeCloseTo(3.14, 4)
    expect(parseFloat(got[5])).toBeCloseTo(3.14, 4)
    expect(parseFloat(got[6])).toBeCloseTo(3.14, 4)
    expect(got[7]).toBe("3")
    expect(parseFloat(got[8])).toBeCloseTo(2.718, 4)
  })
})
