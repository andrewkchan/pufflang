import { runStage1ResolverAst } from "../../../src/harness"

describe("Stage1 AST resolver function checks", () => {
  it("rejects function without return", () => {
    const res = runStage1ResolverAst(`
      def foo() { var x = 1; }
      def main() { return 1; }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })

  it("rejects duplicate function with same arity", () => {
    const res = runStage1ResolverAst(`
      def foo(x) { return x; }
      def foo(y) { return y; }
      def main() { return foo(1); }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })

  it("rejects overloads (duplicate name different arity) for now", () => {
    const res = runStage1ResolverAst(`
      def foo(x) { return x; }
      def foo(x, y) { return x; }
      def main() { return foo(1, 2); }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })
})
