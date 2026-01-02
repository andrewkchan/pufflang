import { runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen dot/struct field access", () => {
  it("emits GEP+load for struct field deref", () => {
    const program = `
      struct Point { x int, y int }
      def getx(p Point~) int { return p.x; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stderr).toBe("")
    const ir = irRes.stdout
    expect(ir.length).toBeGreaterThan(0)
    expect(ir).toContain("getelementptr i8, i8* %t")
    expect(ir).toContain("bitcast i8* %t")
    expect(ir).toContain("load i32, i32* %t")
  })

  it("emits GEP+store for struct field assignment", () => {
    const program = `
      struct Point { x int, y int }
      def setx(p Point~, v int) int { p.x = v; return 0; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stderr).toBe("")
    const ir = irRes.stdout
    expect(ir).toContain("getelementptr i8, i8* %t")
    expect(ir).toContain("store i32 %")
  })
})
