import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_expr.puff"), "utf8")

describe("Stage1 expression AST builder", () => {
  test("builds AST with correct precedence and updates", () => {
    const exprs = [
      { src: "1+2*3", expect: "(+ 1 (* 2 3))" },
      { src: "a||b&&c", expect: "(|| a (&& b c))" },
      { src: "++x + y--", expect: "(+ (pre++ x) (post-- y))" },
      { src: "a ? b : c + d", expect: "(?: a b (+ c d))" },
      { src: "-~x", expect: "(- (~ x))" },
      { src: "(a+b)*(c-d)", expect: "(* (+ a b) (- c d))" }
    ]

    const printCases = exprs
      .map(
        (e, i) => `
  {
    var s${i} = byte~(&"${e.src}"[0]);
    var l${i} = cstr_len(s${i});
    var out${i} = parse_expr_ast_to_sexpr(s${i}, l${i});
    print_str(out${i});
    __putchar__(10);
  }`
      )
      .join("")

    const source = `
${astSrc}
${scannerSrc}
${parserExprSrc}

def print_str(s String) {
  var i = 0;
  while (i < s.length) {
    __putchar__(int((s.data + i)~));
    i = i + 1;
  }
}

def main() {${printCases}
}
`

    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(exprs.map((e) => e.expect))
  })
})
