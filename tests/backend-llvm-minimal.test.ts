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
    expect(res.stdout).toBe(
      ["42", "3", "3.500000", "1", "hi"].map((l) => l + "\n").join("")
    )
  })
})
