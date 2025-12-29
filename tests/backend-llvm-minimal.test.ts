import { compileAndRun } from "../src/harness"

describe("LLVM backend minimal pipeline", () => {
  test("prints simple literals and arithmetic", () => {
    const source = `
    def main() {
      print 42;
      print 1 + 2;
      print 3.5;
      print true;
      print "hi";
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines[0]).toBe("42")
    expect(lines[1]).toBe("3")
    expect(parseFloat(lines[2])).toBeCloseTo(3.5)
    expect(lines[3]).toBe("1")
    expect(lines[4]).toBe("hi")
  })
})
