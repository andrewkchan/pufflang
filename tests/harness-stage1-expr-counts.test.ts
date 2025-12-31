import { runStage1ExprCounts } from "../src/harness"

describe("Stage1 harness expr counts", () => {
  test("reports token and operator counts", () => {
    const res = runStage1ExprCounts("a||b&&c?d:e")
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("10 3")
  })
})
