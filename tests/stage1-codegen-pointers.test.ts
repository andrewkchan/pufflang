import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen pointers", () => {
  it("emits GEP for pointer add", () => {
    const program = `
      def off(p byte~, i int) byte~ { return p + i; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("getelementptr i8, i8* %p0, i32 %p1")
  })

  it("emits ptrtoint diff for pointer subtraction", () => {
    const program = `
      def diff(a byte~, b byte~) int { return a - b; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("ptrtoint i8* %p0 to i64")
    expect(irRes.stdout).toContain("ptrtoint i8* %p1 to i64")
  })

  it("emits pointer equality compare", () => {
    const program = `
      def eqp(a byte~, b byte~) int { return a == b; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("icmp eq i8* %p0, %p1")
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(0)
  })
})
