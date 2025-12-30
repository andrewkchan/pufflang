import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

describe("Stage1 parser multiple var decls", () => {
  test("accepts two var decls then return expression", () => {
    const source = `
    ${scannerSrc}
    ${parserSrc}
    def main() {
      var src = "def f(a, b) { var x = a; var y = b; return x + y; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      var ok = parse_simple(toks);
      print ok;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("1")
  })
})
