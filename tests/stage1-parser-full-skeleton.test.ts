import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserFullSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_full.puff"), "utf8")

describe("Stage1 full parser skeleton (non-failing)", () => {
  test("parses minimal def/return", () => {
    const source = `
${astSrc}
${scannerSrc}
${parserFullSrc}
def print_ok(ok int) { if (ok == 1) { __putchar__(49); } }
def main() {
  var src = "def f() { return 0; }";
  var toks = scan_tokens(byte~(&src[0]), len(src));
  var res = parse_module(toks, byte~(&src[0]), len(src));
  print_ok(res.err == 0 ? 1 : 0);
}
`
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("1")
  })
})
