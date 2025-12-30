import { compileAndRun } from "../src/harness"

describe("I/O builtins - read", () => {
  test("read from stdin echoes correct bytes", () => {
    const source = `
    def main() {
      var buf = [0; 16];
      var n = __read__(0, byte~(&buf[0]), 16);
      __write__(1, byte~(&buf[0]), n);
    }
    `
    const res = compileAndRun(source, "hello!\n")
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout).toBe("hello!\n")
  })
})

