import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen while loops", () => {
  it("counts up in a simple while loop", () => {
    const program = `
      def main() int {
        var i = 0;
        while (i < 3) {
          i = i + 1;
        }
        return i;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("br label %L")
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(3)
  })

  it("skips body when condition false initially", () => {
    const program = `
      def main() int {
        var x = 5;
        while (0) {
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
})
