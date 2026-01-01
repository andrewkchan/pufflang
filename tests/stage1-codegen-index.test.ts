import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen index loads", () => {
  it("indexes string literal pointer (GEP present)", () => {
    const program = `
      def main() int {
        var p byte~ = "hi";
        var q byte~ = p[1];
        return 0;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("getelementptr i8, i8*")
  })
})
