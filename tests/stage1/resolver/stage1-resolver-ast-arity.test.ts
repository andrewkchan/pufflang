import { runStage1ResolverAst } from "../../../src/harness"

describe("Stage1 AST resolver arity checks", () => {
  it("rejects wrong arity in call", () => {
    const res = runStage1ResolverAst(`
      def foo(x) { return x; }
      def main() { return foo(); }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })
})
