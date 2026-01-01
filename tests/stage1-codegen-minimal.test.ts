import { runStage1CompileToIr, runRawIR } from "../src/harness"

describe("Stage1 codegen (minimal LLVM IR)", () => {
  it("emits runnable IR for a simple return", () => {
    const program = `
      def main() int { return 3; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stderr).toBe("")
    const ir = irRes.stdout.trim()
    expect(ir).toContain("ret i32 3")

    const binRes = runRawIR(ir)
    // main returns 3 -> exit code 3
    expect(binRes.status).toBe(3)
  })
})
