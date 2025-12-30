import { compileAndRun } from "../src/harness"

describe("LLVM backend pointer printing", () => {
  test("print pointer address", () => {
    const source = `
    var g = 1;
    def main() {
      var p = &g;
      print p;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const line = res.stdout.trim()
    // should be zero-padded to 16 hex digits (64-bit) per backend format string
    expect(line).toMatch(/^0x[0-9a-f]{16}$/)
  })
})
