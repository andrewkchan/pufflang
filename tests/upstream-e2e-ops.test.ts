import { compileAndRun } from "../src/harness"

describe("Upstream E2E - operators", () => {
  test("int operators", () => {
    const source = `
    def main() {
      print -5;

      print 5+3;
      print 5-3;
      print 5*3;
      print 5/3;

      print 5==3;
      print 5==5;
      print 5!=3;
      print 5>3;
      print 5>=3;
      print 5<3;
      print 5<=3;

      print 10%3;
      print 10%-3;
      print -10%3;
    }
    `
    const expected = [
      "-5",
      "8",
      "2",
      "15",
      "1",
      "0",
      "1",
      "1",
      "1",
      "1",
      "0",
      "0",
      "1",
      "1",
      "-1"
    ]
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n")
    expect(got).toEqual(expected)
  })

  test("byte operators", () => {
    const source = `
    def main() {
      print byte(5)+byte(3);
      print byte(5)-byte(3);
      print byte(5)*byte(3);
      print byte(5)/byte(3);

      print byte(5)==byte(3);
      print byte(5)==byte(5);
      print byte(5)!=byte(3);
      print byte(5)>byte(3);
      print byte(5)>=byte(3);
      print byte(5)<byte(3);
      print byte(5)<=byte(3);

      print byte(10)%byte(3);
      print byte(10)%byte(-3);
      print byte(-10)%byte(3);
    }
    `
    const expected = [
      "8",
      "2",
      "15",
      "1",
      "0",
      "1",
      "1",
      "1",
      "1",
      "0",
      "0",
      "1",
      "10",
      "0"
    ]
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n")
    expect(got).toEqual(expected)
  })

  test("float operators", () => {
    const source = `
    def main() {
      print -5.5;

      print 5.5+3.0;
      print 5.5-3.0;
      print 5.5*3.0;
      print 5.0/3.0;

      print 5.0==3.0;
      print 5.0==5.0;
      print 5.0!=3.0;
      print 5.0>3.0;
      print 5.0>=3.0;
      print 5.0<3.0;
      print 5.0<=3.0;
    }
    `
    const expected = [
      -5.5,
      8.5,
      2.5,
      16.5,
      1.6666666269302368,
      0,
      1,
      1,
      1,
      1,
      0,
      0
    ]
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n").map(parseFloat)
    expect(got.length).toBe(expected.length)
    got.forEach((v, i) => {
      if (Number.isInteger(expected[i])) {
        expect(v).toBeCloseTo(expected[i])
      } else {
        expect(v).toBeCloseTo(expected[i], 5)
      }
    })
  })
})
