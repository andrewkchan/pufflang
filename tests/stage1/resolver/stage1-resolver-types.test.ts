import { runStage1ResolverAst } from "../../../src/harness"

describe("Stage1 resolver type checks", () => {
  it("accepts matching return type", () => {
    const res = runStage1ResolverAst(`
      def main() int {
        var x int = 1;
        return x + 2;
      }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("1")
  })

  it("rejects mismatched return type", () => {
    const res = runStage1ResolverAst(`
      def main() int {
        return 1.5;
      }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })

  it("rejects var initializer type mismatch", () => {
    const res = runStage1ResolverAst(`
      def main() {
        var x int = 1.0;
        return;
      }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })

  it("rejects assignment that widens type incompatibly", () => {
    const res = runStage1ResolverAst(`
      def main() {
        var x = 1;
        x = 2.5;
        return;
      }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })
})
