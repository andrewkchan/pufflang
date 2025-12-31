import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_expr.puff"), "utf8")

describe("Stage1 expr token count helper", () => {
  test("counts tokens for simple expressions", () => {
    const source = `
${astSrc}
${scannerSrc}
${parserExprSrc}

def print_int(x int) { if (x == 0) { __putchar__(48); return; } var n = x; var buf = vecbyte_new(16); if (n < 0) { __putchar__(45); n = 0 - n; } while (n > 0) { buf = vecbyte_push(buf, byte(48 + (n % 10))); n = n / 10; } var i = buf.length - 1; while (i >= 0) { __putchar__(int((buf.data + i)~)); i = i - 1; } }

def main() {
  var a = byte~(&"1+2"[0]);
  var b = byte~(&"a||b&&c"[0]);
  print_int(expr_token_count(a, cstr_len(a)));
  __putchar__(32);
  print_int(expr_token_count(b, cstr_len(b)));
  __putchar__(10);
}
`
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("4 6")
  })
})
