import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_expr.puff"), "utf8")

describe("Stage1 parse_expr_ast_ok", () => {
  test("returns 1 on valid expression and 0 on invalid", () => {
    const source = `
${astSrc}
${scannerSrc}
${parserExprSrc}

def main() {
  var good = byte~(&"1+2*3"[0]);
  var lg = cstr_len(good);
  var bad = byte~(&"1+"[0]);
  var lb = cstr_len(bad);
  var ok1 = parse_expr_ast_ok(good, lg);
  var ok2 = parse_expr_ast_ok(bad, lb);
  if (ok1 != 1 || ok2 != 0) { __exit__(3); }
}
`
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
  })
})
