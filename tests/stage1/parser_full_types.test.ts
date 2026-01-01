import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "parser_expr.puff"), "utf8")
const typesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "types.puff"), "utf8")
const structLayoutSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "structlayout.puff"), "utf8")
const typeEnvSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeenv.puff"), "utf8")
const typeparseSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeparse.puff"), "utf8")
const parserFullSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "parser_full.puff"), "utf8")

function stripAstTypeSection(src: string): string {
  const marker = "// ---- Node arena ----"
  const idx = src.indexOf(marker)
  if (idx === -1) return src
  return src.slice(idx)
}

function run() {
  const body = `
${typesSrc}
${stripAstTypeSection(astSrc)}
${scannerSrc}
${structLayoutSrc}
${typeEnvSrc}
${parserExprSrc}
${typeparseSrc}
${parserFullSrc}

def print_str(s String) {
  var i = 0;
  while (i < s.length) {
    __putchar__(int((s.data + i)~));
    i = i + 1;
  }
  __putchar__(10);
}

def main() {
  var sb = sb_new();
  sb = sb_append_cstr(sb, byte~(&"export def foo(a int, b [byte;2] = 7) float {"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"  var x byte = 1;"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"  return a;"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"}"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"import def bar(c int~);"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"struct Pair { left int, right [byte;4] }"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"def baz(z int) { return z; }"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"var g int = 3;"[0]));

  var srcStr = sb_to_string(sb);
  var res = parse_module_source(srcStr.data, srcStr.length);
  print_str(module_counts(res));
  print_str(module_type_summary(res));
}
`
  return compileAndRunWithStdlib(body)
}

describe("Stage1 parser_full types and defaults", () => {
  it("captures parameter/return/struct/var type metadata", () => {
    const res = run()
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.split("\n").filter((l) => l !== "")
    const expected = [
      "funcs=3 imports=1 exports=1 structs=1 vars=2",
      "fn foo params=int,(array 2 byte)=default ret=float export=1 import=0",
      "fn bar params=(ptr int) ret=void export=0 import=1",
      "fn baz params=int ret=void export=0 import=0",
      "var x type=byte",
      "var g type=int",
      "struct Pair fields=int,(array 4 byte)"
    ]
    expect(lines).toEqual(expected)
  })
})
