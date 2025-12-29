import { compileAndRun } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("language extensions - switch and pointer differencing", () => {
  test("switch with cases and default", () => {
    const source = `
    def main() {
      var x = 2;
      switch (x) {
        case 1:
          print 10;
          break;
        case 2:
          print 20;
          break;
        case 3:
          print 30;
          break;
        default:
          print 40;
      }
      switch (5) {
        case 4:
          print 1;
          break;
        default:
          print 2;
      }
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["20", "2"])
  })

  test("pointer differencing yields element delta", () => {
    const source = `
    def main() {
      var arr = [1, 2, 3, 4];
      var p0 = &arr[0];
      var p3 = &arr[3];
      var d1 = p3 - p0;
      var d2 = p0 - p3;
      print d1;
      print d2;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["3", "-3"])
  })
})

