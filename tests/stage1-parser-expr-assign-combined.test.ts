import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_expr.puff"), "utf8")

function runSummary(expr: string) {
  const source = `
${astSrc}
${scannerSrc}
${parserExprSrc}

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
  var src = "${expr}";
  var res = parse_expr_ast(byte~(&src[0]), len(src));
  if (res.err == 1 || res.root == -1) { __exit__(1); }
  var count = res.arena.nodes.length;
  var root = nodearena_get(res.arena, res.root);
  var bin = nodearena_get(res.arena, res.root - 1);
  print_int(count); __putchar__(10);
  print_int(root.kind); __putchar__(10);
  print_int(bin.kind); __putchar__(10);
}
`
  return compileAndRunWithStdlib(source)
}

describe("Stage1 parser_expr combined assignments", () => {
  it("desugars +=", () => {
    const res = runSummary("a += b")
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(["4", "9", "3"])
  })

  it("desugars -=", () => {
    const res = runSummary("x -= y")
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(["4", "9", "3"])
  })

  it("desugars *=", () => {
    const res = runSummary("p *= q")
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(["4", "9", "3"])
  })

  it("desugars /=", () => {
    const res = runSummary("m /= n")
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(["4", "9", "3"])
  })

  it("desugars %=", () => {
    const res = runSummary("i %= k")
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(["4", "9", "3"])
  })
})
