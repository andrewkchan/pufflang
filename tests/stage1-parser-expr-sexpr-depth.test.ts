import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_expr.puff"), "utf8")

describe("Stage1 expr sexpr depth helper", () => {
  test("computes max nesting depth from sexpr", () => {
    const source = `
${astSrc}
${scannerSrc}
${parserExprSrc}

def print_int(x int) { if (x == 0) { __putchar__(48); return; } var n = x; var buf = vecbyte_new(16); if (n < 0) { __putchar__(45); n = 0 - n; } while (n > 0) { buf = vecbyte_push(buf, byte(48 + (n % 10))); n = n / 10; } var i = buf.length - 1; while (i >= 0) { __putchar__(int((buf.data + i)~)); i = i - 1; } }

def main() {
  var s1 = byte~(&"1+2*3"[0]); // sexpr depth 2: (+ 1 (* 2 3))
  var s2 = byte~(&"a+(b+(c*d))"[0]); // sexpr depth 3: (+ a (+ b (* c d)))
  print_int(expr_sexpr_depth(s1, cstr_len(s1)));
  __putchar__(32);
  print_int(expr_sexpr_depth(s2, cstr_len(s2)));
  __putchar__(10);
}
`
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("2 3")
  })
})
