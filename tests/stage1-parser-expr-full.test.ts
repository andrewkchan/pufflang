import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_expr.puff"), "utf8")

function runCase(expr: string): string {
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
def main() {
  var src = "${expr}";
  var sexpr = parse_expr_to_sexpr(byte~(&src[0]), len(src));
  print_str(sexpr);
}
`
  const res = compileAndRunWithStdlib(source)
  if (res.status !== 0) {
    throw new Error(`Program failed: ${res.status} stderr=${res.stderr}`)
  }
  if (res.stderr) {
    throw new Error(`stderr not empty: ${res.stderr}`)
  }
  return res.stdout.trim()
}

describe("Stage1 expression parser S-expressions", () => {
  test("respects precedence of * over +", () => {
    const out = runCase("1 + 2 * 3")
    expect(out).toBe("(+ 1 (* 2 3))")
  })

  test("parses ternary with nested binary", () => {
    const out = runCase("a ? b : c + d")
    expect(out).toBe("(?: a b (+ c d))")
  })

  test("parses bitwise/shift with correct precedence", () => {
    const out = runCase("x << 1 | y & z")
    expect(out).toBe("(| (<< x 1) (& y z))")
  })
})
