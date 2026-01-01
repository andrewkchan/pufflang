import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen locals and assignments", () => {
  it("stores and assigns locals", () => {
    const program = `
      def main() int {
        var x = 1;
        var y = 2;
        x = x + y;
        return x;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(3)
  })

  // Parameter slot assignment support is now present; an end-to-end
  // invocation would require passing args via a wrapper. Covered indirectly
  // by param slotting behavior in other codegen tests.
})
