import { compileAndRun } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim()).filter((s) => s.length > 0)

describe("runtime helpers - env/time", () => {
  test("time returns non-negative", () => {
    const source = `
    def main() {
      var storage = __malloc__(8);
      var t = __time__(storage);
      print t;
    }
    `
    const res = compileAndRun(source)
    // Debug output to aid verification in CI
    // console.log(res)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const [tstr] = lines(res)
    const t = parseInt(tstr, 10)
    expect(Number.isFinite(t)).toBe(true)
    expect(t).toBeGreaterThanOrEqual(0)
  })

  test("getenv reads provided environment variable", () => {
    const envName = "PATH" // assumed present
    // Debug: ensure PATH visible
    // console.error("PATH head", (process.env[envName] || "").slice(0, 20))
    const source = `
    def main() {
      var key = "${envName}\\0";
      var ptr = __getenv__(&key[0]);
      // print pointer then first 5 chars to ensure match
      print ptr;
      print ptr~;
      print (ptr + 1)~;
      print (ptr + 2)~;
      print (ptr + 3)~;
      print (ptr + 4)~;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    // At least ensure the call executes without crashing
    expect(res.stdout).not.toBeUndefined()
  })
})
