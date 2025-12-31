import { runStage1ResolverModule } from "../../../src/harness"

describe("harness: Stage1 resolver module", () => {
  it("accepts valid program", () => {
    const res = runStage1ResolverModule("var a = 1; { var b = 2; } return a;")
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("1")
  })

  it("rejects duplicate var", () => {
    const res = runStage1ResolverModule("var a = 1; var a = 2; return a;")
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })

  it("rejects missing return", () => {
    const res = runStage1ResolverModule("var a = 1;")
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })
})
