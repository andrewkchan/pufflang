import { runStage1ResolverAst } from "../../../src/harness"

describe("Stage1 AST resolver (parse_full)", () => {
  it("accepts simple function with return and locals", () => {
    const res = runStage1ResolverAst(`
      def main(a) { var b = a; return b; }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("1")
  })

  it("rejects duplicate var in function scope", () => {
    const res = runStage1ResolverAst(`
      def main() { var x = 1; var x = 2; return x; }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })

  it("rejects undefined variable usage", () => {
    const res = runStage1ResolverAst(`
      def main() { return z; }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })

  it("checks simple arity on calls", () => {
    const ok = runStage1ResolverAst(`
      def foo(x) { return x; }
      def main() { return foo(1); }
    `)
    expect(ok.status).toBe(0)
    expect(ok.stdout.trim()).toBe("1")

    const bad = runStage1ResolverAst(`
      def foo(x) { return x; }
      def main() { return foo(); }
    `)
    expect(bad.status).toBe(0)
    expect(bad.stdout.trim()).toBe("0")
  })
})
