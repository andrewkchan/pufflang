import { runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen dot/struct field load", () => {
  it("emits GEP for struct field access via pointer", () => {
    const program = `
      struct Point { x int, y byte }
      def getx(p Point~) int { return p.x; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("getelementptr i8, i8*")
    expect(irRes.stdout).toContain("load i32")
  })
})
