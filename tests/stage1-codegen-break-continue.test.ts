import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen break/continue", () => {
  it("break exits loop early", () => {
    const program = `
      def main() int {
        var x = 5;
        while (1) {
          break;
          x = 9;
        }
        return x;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(5)
  })

  it("continue jumps to next iteration", () => {
    const program = `
      def main() int {
        var i = 0;
        var s = 0;
        while (i < 3) {
          i = i + 1;
          if (i == 2) { continue; }
          s = s + 10;
        }
        return s;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(20)
  })
})
