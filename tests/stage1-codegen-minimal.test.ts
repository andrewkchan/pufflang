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

  it("emits IR that references parameters", () => {
    const program = `
      def foo(x int) int { return x; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stderr).toBe("")
    const ir = irRes.stdout.trim()
    expect(ir).toContain("%p0")
    expect(ir).toContain("define i32 @foo")
  })

  it("emits IR for simple arithmetic on params", () => {
    const program = `
      def add(x int, y int) int { return x + y; }
      def main() int { return 0; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stderr).toBe("")
    const ir = irRes.stdout.trim()
    expect(ir).toContain("add i32 %p0, %p1")
  })

  it("produces runnable IR for literal arithmetic", () => {
    const program = `
      def main() int { return 2 + 3; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stderr).toBe("")
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(5)
  })
})
