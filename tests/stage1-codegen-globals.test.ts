import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 codegen globals", () => {
  it("emits global int and loads in main", () => {
    const program = `
      var g = 3;
      def main() int { return g; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("@g = global i32 3")
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(3)
  })

  it("emits global bool", () => {
    const program = `
      var b = true;
      def main() int { return b; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("@b = global i1 1")
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(1)
  })

  it("emits global byte from char literal", () => {
    const program = `
      var c = 'h';
      def main() int { return c; }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("@c = global i8 104")
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(104)
  })
})
