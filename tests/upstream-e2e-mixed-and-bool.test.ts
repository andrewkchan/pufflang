import { compileAndRun } from "../src/harness"

describe("Upstream E2E - mixed numeric and bool ops", () => {
  test("mixed int-and-float operators", () => {
    const source = `
    def main() {
      print 5.5+3;
      print 5+3.5;
      print 5-2.5;
      print 5.5-3;
      print 5*1.5;
      print 1.5*5;
      print 5.0/3;
      print 5/3.0;
    }
    `
    const expected = [
      8.5, 8.5, 2.5, 2.5, 7.5, 7.5, 1.6666666269302368, 1.6666666269302368
    ]
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n").map(parseFloat)
    expect(got.length).toBe(expected.length)
    got.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 5))
  })

  test("mixed int-and-byte operators", () => {
    const source = `
    def main() {
      print -byte(5);

      print byte(5)       + int(3);
      print byte(256 + 5) + int(3);

      print byte(3)       - int(5);
      print byte(256 + 3) - int(5);
      print int(3)        - byte(5);
      print int(3)        - byte(256 + 5);
      print byte(5)       * int(3);
      print byte(256 + 5) * int(3);

      print byte(5)       / int(3);
      print byte(256 + 5) / int(3);
      print int(5)        / byte(3);
      print int(5)        / byte(256 + 3);

      print int(5)        ==  byte(3);
      print int(5)        ==  byte(256+3);
      print int(5)        ==  byte(5);
      print int(5)        ==  byte(256+5);
      print int(256+3)    !=  byte(3);
      print int(256+3)    !=  byte(256+3);

      print int(5)        >   byte(3);
      print int(5)        >   byte(256+3);
      print int(5)        >=  byte(3);
      print int(5)        >=  byte(256+3);
      print int(5)        <   byte(3);
      print int(5)        <   byte(256+3);
      print int(5)        <=  byte(3);
      print int(5)        <=  byte(256+3);

      print byte(10)      % int(3);
      print byte(256 + 10)% int(3);
      print int(10)       % byte(3);
      print int(10)       % byte(256 + 3);
    }
    `
    const expected = [
      "-5",
      "8",
      "8",
      "-2",
      "-2",
      "-2",
      "-2",
      "15",
      "15",
      "1",
      "1",
      "1",
      "1",
      "0",
      "0",
      "1",
      "1",
      "1",
      "1",
      "1",
      "1",
      "1",
      "1",
      "0",
      "0",
      "0",
      "0",
      "1",
      "1",
      "1",
      "1"
    ]
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n")
    expect(got).toEqual(expected)
  })

  test("bool operators", () => {
    const source = `
    def main() {
      print !true;
      print !false;
      print true && true;
      print true && false;
      print false && true;
      print false && false;
      print true || true;
      print true || false;
      print false || true;
      print false || false;
      print true == true;
      print true == false;
      print false == true;
      print false == false;
    }
    `
    const expected = [
      "0",
      "1",
      "1",
      "0",
      "0",
      "0",
      "1",
      "1",
      "1",
      "0",
      "1",
      "0",
      "0",
      "1"
    ]
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n")
    expect(got).toEqual(expected)
  })

  test("bool short-circuiting", () => {
    const source = `
    def yes(r bool) bool {
      print 1337;
      return r;
    }
    def no(r bool) bool {
      print -1;
      return r;
    }
    def main() {
      print yes(true) && yes(true);
      print yes(true) && yes(false);
      print yes(false) && no(true);
      print yes(false) && no(false);
      print yes(true) || no(true);
      print yes(true) || no(false);
      print yes(false) || yes(true);
      print yes(false) || yes(false);
    }
    `
    const expected = [
      "1337",
      "1337",
      "1",
      "1337",
      "1337",
      "0",
      "1337",
      "0",
      "1337",
      "0",
      "1337",
      "1",
      "1337",
      "1",
      "1337",
      "1337",
      "1",
      "1337",
      "1337",
      "0"
    ]
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n")
    expect(got).toEqual(expected)
  })
})
