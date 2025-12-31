import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 parser meta counts", () => {
  test("counts params, vars, returns", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}
    def main() {
      var src = "def foo(a, b, c) { var x = 1; var y = 2; return a; }";
      var meta = parse_meta_counts(byte~(&src[0]), len(src));
      print meta.params;
      print meta.vars;
      print meta.hasReturn;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["3", "2", "1"])
  })

  test("zero params and no vars", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}
    def main() {
      var src = "def foo() { return 0; }";
      var meta = parse_meta_counts(byte~(&src[0]), len(src));
      print meta.params;
      print meta.vars;
      print meta.hasReturn;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["0", "0", "1"])
  })
})
