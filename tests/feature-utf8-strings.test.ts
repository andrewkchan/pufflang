import { compileAndRun } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("language extensions - UTF-8 strings", () => {
  test("print and len handle non-ASCII", () => {
    const source = `
    def main() {
      var s = "héllo ☕️🚀";
      print s;
      print len(s);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const out = lines(res)
    expect(out[0]).toBe("héllo ☕️🚀")
    // UTF-8 byte length: h e (2 bytes for é) l l o space (2 bytes for ☕) (3 bytes for variation selector?) (4 bytes for 🚀)
    // Let's compute: "h"(1) "é"(2) "l"(1) "l"(1) "o"(1) " "(1) "☕"(3) "️"(3) "🚀"(4) => 17 bytes
    expect(parseInt(out[1], 10)).toBe(17)
  })
})

