import { runRawIR, runStage1CompileToIr } from "../src/harness"

describe("Stage1 new features: defaults, mangling, literals", () => {
  it("fills default arguments at call sites", () => {
    const program = `
      def add(x int, y int = 5) int { return x + y; }
      def main() int { return add(3); }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(8)
  })

  it("mangles overloads by arity for exports", () => {
    const program = `
      export def foo(x int) int { return x; }
      export def foo(x int, y int = 2) int { return x + y; }
      def main() int { return foo(7, 1); }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    expect(irRes.stdout).toContain("define i32 @foo__1")
    expect(irRes.stdout).toContain("define i32 @foo__2")
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(8)
  })

  it("lowers array literals and supports indexing", () => {
    const program = `
      def main() int {
        var arr = [1, 2, 3];
        return arr[1];
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(2)
  })

  it("constructs structs via brace-call literals", () => {
    const program = `
      struct Pair { x int, y int }
      def main() int {
        var p = Pair{5, 7};
        return p.y;
      }
    `
    const irRes = runStage1CompileToIr(program)
    expect(irRes.status).toBe(0)
    const bin = runRawIR(irRes.stdout)
    expect(bin.status).toBe(7)
  })
})

