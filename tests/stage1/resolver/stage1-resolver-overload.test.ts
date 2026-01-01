import { runStage1ResolverAst } from "../../../src/harness"

describe("Stage1 resolver overloads by arity", () => {
  it("allows distinct arity overloads", () => {
    const res = runStage1ResolverAst(`
      def foo(a int) int { return a; }
      def foo(a int, b int) int { return a; }
      def main() int { return foo(1, 2); }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("1")
  })

  it("rejects duplicate arity", () => {
    const res = runStage1ResolverAst(`
      def foo(a int) int { return a; }
      def foo(b int) int { return b; }
      def main() int { return foo(1); }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })
})
