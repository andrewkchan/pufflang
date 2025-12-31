import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

describe("Stage1 parser params (Puffscript)", () => {
  test("accepts function with parameters and return identifier", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}
    def main() {
      var src = "def add(a, b, c) { return a; }";
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
