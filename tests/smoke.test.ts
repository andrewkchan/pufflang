import { compile } from "../src"

describe("compiler scaffold", () => {
  test("returns not implemented error for now", () => {
    const result = compile("def main() {}")
    expect(result.program).toBeNull()
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
