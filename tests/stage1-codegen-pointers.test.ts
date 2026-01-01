import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen pointers", () => {
  it("emits GEP for pointer add", () => {
    const program = `
      def off(p byte~, i int) byte~ { return p + i; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("getelementptr i8, i8* %t2, i32 %t3")
  })

  it("emits ptrtoint diff for pointer subtraction", () => {
    const program = `
      def diff(a byte~, b byte~) int { return a - b; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("ptrtoint i8* %t2 to i64")
    expect(irRes.stdout).toContain("ptrtoint i8* %t3 to i64")
  })

  it("emits pointer equality compare", () => {
    const program = `
      def eqp(a byte~, b byte~) int { return a == b; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("icmp eq i8* %t2, %t3")
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(0)
  })
})
