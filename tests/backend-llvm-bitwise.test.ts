import { compileAndRun } from "../src/harness"

describe("LLVM backend bitwise and shifts", () => {
  test("int bitwise and shifts", () => {
    const source = `
    def main() {
      print 6 & 3;   // 2
      print 6 | 3;   // 7
      print 6 ^ 3;   // 5
      print ~6;      // -7 (two's complement)
      print 8 << 1;  // 16
      print 8 >> 1;  // 4
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n").map((x) => parseInt(x, 10))
    expect(got).toEqual([2, 7, 5, -7, 16, 4])
  })

  test("byte bitwise and shifts", () => {
    const source = `
    def main() {
      print byte(6) & byte(3);  // 2
      print byte(6) | byte(3);  // 7
      print byte(6) ^ byte(3);  // 5
      print ~byte(6);           // 249 (0xF9)
      print byte(8) << byte(1); // 16 (truncated)
      print byte(8) >> byte(1); // 4 (logical shift)
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const got = res.stdout.trim().split("\n").map((x) => parseInt(x, 10))
    expect(got).toEqual([2, 7, 5, 249, 16, 4])
  })
})
