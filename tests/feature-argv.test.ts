import { compileAndRun } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("runtime argv/argc helpers", () => {
  test("argc/argv reflect process args", () => {
    const source = `
    def main(argc int, argv byte~~) {
      var c = __argc__();
      print c;
      var arg1 = __argv_at__(1); // argv[1]
      var arg2 = __argv_at__(2); // argv[2]
      print arg1~;
      print arg2~;
    }
    `
    const res = compileAndRun(source, undefined, undefined, ["one", "two"])
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const out = lines(res).map((x) => parseInt(x, 10))
    expect(out[0]).toBe(3) // program name + two args
    expect(out[1]).toBe("one".charCodeAt(0))
    expect(out[2]).toBe("two".charCodeAt(0))
  })
})
