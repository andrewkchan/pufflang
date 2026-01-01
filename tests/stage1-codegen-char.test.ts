import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen char literals", () => {
  it("returns single-quoted byte literal", () => {
    const program = `
      def main() int { return 'a'; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(97)
  })
})
