import { runStage1ExprSexpr } from "../src/harness"

describe("Stage1 expression parser via harness", () => {
  test("handles precedence", () => {
    const res = runStage1ExprSexpr("1 + 2 * 3")
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("(+ 1 (* 2 3))")
  })

  test("handles ternary", () => {
    const res = runStage1ExprSexpr("a ? b : c + d")
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("(?: a b (+ c d))")
  })

  test("handles bitwise/shift", () => {
    const res = runStage1ExprSexpr("x << 1 | y & z")
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("(| (<< x 1) (& y z))")
  })

  test("fails on invalid expression", () => {
    const res = runStage1ExprSexpr("1 +", { allowError: false })
    expect(res.status).not.toBe(0)
  })
})
