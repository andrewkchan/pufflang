import { runStage1ResolverAst } from "../../../src/harness"

describe("Stage1 resolver AST loop checks", () => {
  it("rejects break/continue outside loop", () => {
    const res1 = runStage1ResolverAst(`def main(){ break; }`)
    expect(res1.status).toBe(0)
    expect(res1.stdout.trim()).toBe("0")

    const res2 = runStage1ResolverAst(`def main(){ continue; }`)
    expect(res2.status).toBe(0)
    expect(res2.stdout.trim()).toBe("0")
  })

  it("accepts break/continue inside loops", () => {
    const res = runStage1ResolverAst(`
      def main(){
        var i = 0;
        while (i < 3) {
          if (i == 1) { i = i + 1; continue; }
          if (i == 2) { break; }
          i = i + 1;
        }
        return i;
      }
    `)
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("1")
  })
})
