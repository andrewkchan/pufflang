import { compileAndRunWithStdlib } from "../../../src/harness"
import fs from "fs"
import path from "path"

function runResolver(src: string): { status: number; stdout: string } {
  const ast = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "ast.puff"), "utf8")
  const types = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "types.puff"), "utf8")
  const structLayout = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "structlayout.puff"), "utf8")
  const typeEnv = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "typeenv.puff"), "utf8")
  const typerules = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "typerules.puff"), "utf8")
  const literalTypes = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "literaltypes.puff"), "utf8")
  const scanner = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "scanner.puff"), "utf8")
  const parserExpr = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "parser_expr.puff"), "utf8")
  const typeparse = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "typeparse.puff"), "utf8")
  const parserFull = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "parser_full.puff"), "utf8")
  const resolver = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "resolver.puff"), "utf8")
  const stripAstTypeSection = (src: string) => {
    const marker = "// ---- Node arena ----"
    const idx = src.indexOf(marker)
    if (idx === -1) return src
    return src.slice(idx)
  }
  const code = `
${types}
${stripAstTypeSection(ast)}
${scanner}
${structLayout}
${typeEnv}
${typerules}
${literalTypes}
${parserExpr}
${typeparse}
${parserFull}
${resolver}

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

def main() {
  var src = "${src}";
  var ok = resolve_module_tokens(byte~(&src[0]), len(src));
  print_int(ok);
  __putchar__(10);
}
`
  return compileAndRunWithStdlib(code)
}

describe("Stage1 resolver module tokens", () => {
  it("accepts valid blocks and returns", () => {
    const res = runResolver("var a = 1; { var b = 2; } return a;")
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("1")
  })

  it("rejects duplicate vars in same scope", () => {
    const res = runResolver("var a = 1; var a = 2; return a;")
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })

  it("rejects missing return", () => {
    const res = runResolver("var a = 1;")
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("0")
  })
})
