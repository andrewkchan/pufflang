import { compileAndRun } from "../src/harness"

describe("I/O builtins - putchar", () => {
  test("putchar outputs a character", () => {
    const source = `
    def main() {
      __putchar__(65);
      __putchar__(10);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout).toBe("A\n")
  })
})

