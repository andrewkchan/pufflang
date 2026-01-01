import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen for loops", () => {
  it("sums in a bounded for loop", () => {
    const program = `
      def main() int {
        var i = 0;
        var s = 0;
        for (; i < 3; i = i + 1) {
          s = s + i;
        }
        return s;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(3)
  })

  it("handles missing cond/step with break", () => {
    const program = `
      def main() int {
        var i = 0;
        for (; ; ) {
          i = i + 1;
          if (i == 2) { break; }
        }
        return i;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(2)
  })
})
