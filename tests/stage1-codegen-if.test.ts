import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen if/else", () => {
  it("executes then branch when condition is true", () => {
    const program = `
      def main() int {
        var x = 0;
        if (1) {
          x = 3;
        } else {
          x = 5;
        }
        return x;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("br i1 ")
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(3)
  })

  it("executes else branch when condition is false", () => {
    const program = `
      def main() int {
        var x = 1;
        if (0) {
          x = 9;
        } else {
          x = 4;
        }
        return x;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(4)
  })
})
