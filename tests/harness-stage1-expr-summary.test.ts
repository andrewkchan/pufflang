import { runStage1ExprSummary } from "../src/harness"

describe("Stage1 harness expr summary", () => {
  test("reports tokens/operators/depth/nodes", () => {
    const res = runStage1ExprSummary("a+(b*(c+d))")
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    // token count includes EOF; depth from sexpr; node count is arena size
    expect(res.stdout.trim()).toBe("12 3 3 9")
  })
})
