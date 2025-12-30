import { compileAndRun } from "../src/harness"

describe("Upstream E2E - functions and recursion", () => {
  test("function calls", () => {
    const source = `
    def add(x int, y int) int {
      return x + y;
    }
    def sub(x int, y int) int {
      return x - y;
    }
    def lerp(a float, b float, t float) float {
      return a*(1-t)+b*t;
    }
    def main() {
      print add(42, -1337);
      print sub(42, -1337);
      print lerp(1, 3.14, 0.4);
      print add(add(add(42, -1337), sub(42, -1337)), int(lerp(1, 3.14, 0.4)));
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n")
    expect(got[0]).toBe("-1295")
    expect(got[1]).toBe("1379")
    expect(parseFloat(got[2])).toBeCloseTo(1.8560000658035278, 6)
    expect(got[3]).toBe("85")
  })

  test("fib", () => {
    const source = `
    def fib(n int) int {
      if (n <= 0) {
        return 0;
      } else if (n == 1) {
        return 1;
      }
      return fib(n-1) + fib(n-2);
    }
    def main() {
      print fib(0);
      print fib(1);
      print fib(2);
      print fib(3);
      print fib(4);
      print fib(5);
      print fib(6);
      print fib(7);
      print fib(8);
      print fib(9);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n").map((v) => parseInt(v, 10))
    expect(got).toEqual([0, 1, 1, 2, 3, 5, 8, 13, 21, 34])
  })
})
