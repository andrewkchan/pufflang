import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "ast.puff"), "utf8")
const typesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "types.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "parser_expr.puff"), "utf8")
const structLayoutSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "structlayout.puff"), "utf8")
const typeEnvSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeenv.puff"), "utf8")
const typeRulesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typerules.puff"), "utf8")
const literalTypesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "literaltypes.puff"), "utf8")
const exprTypesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "exprtypes.puff"), "utf8")

function stripAstTypeSection(src: string): string {
  const marker = "// ---- Node arena ----"
  const idx = src.indexOf(marker)
  if (idx === -1) return src
  return src.slice(idx)
}

function runProgram() {
  const source = `
${typesSrc}
${stripAstTypeSection(astSrc)}
${scannerSrc}
${parserExprSrc}
${structLayoutSrc}
${typeEnvSrc}
${typeRulesSrc}
${literalTypesSrc}
${exprTypesSrc}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x;
  var buf = vecbyte_new(16);
  if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) {
    buf = vecbyte_push(buf, byte(48 + (n % 10)));
    n = n / 10;
  }
  var i = buf.length - 1;
  while (i >= 0) {
    __putchar__(int((buf.data + i)~));
    i = i - 1;
  }
}

def print_result(expr String) {
  var res = infer_expression_type(typeenv_new(), expr.data, expr.length);
  print_int(res.err);
  __putchar__(58); // ':'
  print_int(res.typeId);
  __putchar__(10);
}

def main() {
  var e1 = "1+2";
  print_result(String{byte~(&e1[0]), len(e1)});

  var e2 = "1.0+2";
  print_result(String{byte~(&e2[0]), len(e2)});

  var e3 = "1==2";
  print_result(String{byte~(&e3[0]), len(e3)});

  var e4 = "1%2.0";
  print_result(String{byte~(&e4[0]), len(e4)});

  var e5 = "1<<1";
  print_result(String{byte~(&e5[0]), len(e5)});

  var e6 = "1&&0";
  print_result(String{byte~(&e6[0]), len(e6)});

  var e7 = "true ? 1 : 2";
  print_result(String{byte~(&e7[0]), len(e7)});

  var e8 = "-1";
  print_result(String{byte~(&e8[0]), len(e8)});

  var e9 = "~1";
  print_result(String{byte~(&e9[0]), len(e9)});

  var e10 = "1[0]";
  print_result(String{byte~(&e10[0]), len(e10)});
}
`
  return compileAndRunWithStdlib(source)
}

describe("Stage1 expression type inference", () => {
  it("infers and validates common expression shapes", () => {
    const res = runProgram()
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    // err:typeId per line
    const expected = [
      "0:5", // 1+2 -> int
      "0:4", // 1.0+2 -> float
      "0:1", // 1==2 -> bool
      "1:-1", // invalid modulo (float)
      "0:5", // shift -> int
      "0:1", // logical and -> bool
      "0:5", // ternary -> int
      "0:5", // unary minus -> int
      "1:-1", // deref of int is invalid
      "1:-1" // invalid index on non-array
    ]
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(expected)
  })
})
