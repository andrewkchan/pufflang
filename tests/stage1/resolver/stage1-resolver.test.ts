import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../../../src/harness"

const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "scanner.puff"), "utf8")
const astSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "ast.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "parser.puff"), "utf8")
const resolverSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "resolver.puff"), "utf8")

describe("Stage1 resolver (Puffscript minimal)", () => {
  test("returns 1 for well-formed tokens with return + EOF", () => {
    const source = `
    ${scannerSrc}
    ${astSrc}
    ${parserSrc}
    ${resolverSrc}
    def main() {
      var src = "def foo() { return 1; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      print resolve_simple(toks);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("1")
  })

  test("returns 0 when missing return token", () => {
    const source = `
    ${scannerSrc}
    ${astSrc}
    ${resolverSrc}
    def main() {
      var toks = vecint_new(2);
      toks = vecint_push(toks, TOKEN_DEF);
      toks = vecint_push(toks, TOKEN_EOF);
      print resolve_simple(toks);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("0")
  })
})
