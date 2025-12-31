import { runStage1ResolverAst } from "../../../src/harness"

describe("Stage1 AST resolver undefined function handling", () => {
  it("rejects call to undefined function", () => {
    const res = runStage1ResolverAst(`
      def main() {
        return foo(1);
      }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })

  it("accepts call to defined function", () => {
    const res = runStage1ResolverAst(`
      def foo(x) { return x; }
      def main() { return foo(3); }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("1")
  })
})
