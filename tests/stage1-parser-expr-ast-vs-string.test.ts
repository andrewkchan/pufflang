import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_expr.puff"), "utf8")

describe("Stage1 expr AST vs string sexpr parity", () => {
  test("matches direct sexpr builder", () => {
    const exprs = [
      "1+2*3",
      "a||b&&c",
      "x ? y : z + w",
      "++p - --q",
      "~a & b | c ^ d",
      "a<<2 + b>>1",
      "!(a==b)"
    ]

    const cases = exprs
      .map(
        (e, i) => `
  {
    var src${i} = byte~(&"${e}"[0]);
    var len${i} = cstr_len(src${i});
    var sexpr_str${i} = parse_expr_to_sexpr(src${i}, len${i});
    var sexpr_ast${i} = parse_expr_ast_to_sexpr(src${i}, len${i});
    var ok${i} = str_eq(sexpr_str${i}.data, sexpr_str${i}.length, sexpr_ast${i}.data, sexpr_ast${i}.length);
    if (ok${i} == 0) { __exit__(3); }
    __putchar__(byte(48 + ${i}));
    __putchar__(byte(58)); // ':'
    __putchar__(byte(32));
    print_str(sexpr_ast${i});
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
  __putchar__(10);
}

def main() {${cases}
}
`

    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines.length).toBe(exprs.length)
    lines.forEach((l, idx) => {
      expect(l.startsWith(String(idx) + ":")).toBe(true)
    })
  })
})
