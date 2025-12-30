import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

describe("Stage1 parser S-expr output (Puffscript)", () => {
  test("def with params and return binary", () => {
    const source = `
    ${scannerSrc}
    ${parserSrc}
    def main() {
      var src = "def foo(a, b) { return a + b; }";
      var s = parse_to_sexpr(byte~(&src[0]), len(src));
      __write__(1, s.data, s.length);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("(def foo (params a b) (return a + b))")
  })

  test("def with call and mul", () => {
    const source = `
    ${scannerSrc}
    ${parserSrc}
    def main() {
      var src = "def bar(x) { return foo(x, x * 2); }";
      var s = parse_to_sexpr(byte~(&src[0]), len(src));
      __write__(1, s.data, s.length);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("(def bar (params x) (return foo(x, x * 2)))")
  })
})
