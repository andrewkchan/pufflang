import { compileAndRun } from "../src/harness"

describe("language extensions - exit builtin", () => {
  test("exit sets process status", () => {
    const source = `
    def main() {
      __exit__(5);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(5)
    expect(res.stdout).toBe("")
  })
})

