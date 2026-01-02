import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../../src/harness"

const stripAst = (src: string) => {
  const marker = "// ---- Node arena ----"
  const idx = src.indexOf(marker)
  return idx === -1 ? src : src.slice(idx)
}

const stage1Parts = [
  fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "types.puff"), "utf8"),
  fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "structlayout.puff"), "utf8"),
  fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeenv.puff"), "utf8"),
  stripAst(fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "ast.puff"), "utf8")),
  fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "scanner.puff"), "utf8"),
  fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "parser_expr.puff"), "utf8"),
  fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeparse.puff"), "utf8"),
  fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "parser_full.puff"), "utf8")
]

function runIndex() {
  const program = `struct Point { x int, y byte };`
  const source = `
${stage1Parts.join("\n")}

def print_int(x int) { if (x == 0) { __putchar__(48); return; } var n=x; var b=vecbyte_new(16); if (n<0){__putchar__(45); n=0-n;} while(n>0){b=vecbyte_push(b, byte(48+(n%10))); n=n/10;} var i=b.length-1; while(i>=0){ __putchar__(int((b.data+i)~)); i=i-1; } }

def main() {
  var src = "${program}";
  var pmr = parse_module_source(byte~(&src[0]), len(src));
  var tm = module_type_ids(pmr);
  var sIdx = 0;
  var tokY = tm_struct_field_name_tok(tm, sIdx, 1);
  var idx = tm_struct_field_index_by_name(tm, sIdx, pmr.tokens, pmr.src, tokY);
  print_int(idx);
  __putchar__(10);
}
`
  return compileAndRunWithStdlib(source)
}

describe("module_type_ids struct field index helper", () => {
  it("finds field index by name", () => {
    const res = runIndex()
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe("1")
  })
})
