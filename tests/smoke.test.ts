import { compile } from "../src"

describe("compiler scaffold", () => {
  test("compiles empty main to LLVM IR", () => {
    const result = compile("def main() {}")
    expect(result.errors).toEqual([])
    expect(result.program).toContain("define i32 @main")
  })
})
