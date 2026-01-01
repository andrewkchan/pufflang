import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen logical short-circuit", () => {
  it("short-circuits && on false left", () => {
    const program = `
      def main() int {
        return 0 && (1 / 0);
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(0)
  })

  it("short-circuits || on true left", () => {
    const program = `
      def main() int {
        return 1 || (1 / 0);
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(1)
  })

  it("evaluates rhs when needed", () => {
    const program = `
      def main() int {
        return 0 || 5;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(1) // bool coercion: any nonzero -> true => 1
  })
})
