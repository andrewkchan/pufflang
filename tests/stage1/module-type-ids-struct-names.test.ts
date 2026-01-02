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

function runNames() {
  const program = `struct Point { x int, y byte };`
  const source = `
${stage1Parts.join("\n")}

def print_str(s String) { var i = 0; while (i < s.length) { __putchar__(int((s.data + i)~)); i = i + 1; } __putchar__(10); }

def main() {
  var src = "${program}";
  var pmr = parse_module_source(byte~(&src[0]), len(src));
  var tm = module_type_ids(pmr);
  var sIdx = 0;
  var name0 = tm_struct_field_name(tm, sIdx, 0, pmr.tokens, pmr.src);
  var name1 = tm_struct_field_name(tm, sIdx, 1, pmr.tokens, pmr.src);
  print_str(name0);
  print_str(name1);
}
`
  return compileAndRunWithStdlib(source)
}

describe("module_type_ids struct field names", () => {
  it("returns names for struct fields", () => {
    const res = runNames()
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    expect(lines[0]).toBe("x")
    expect(lines[1]).toBe("y")
  })
})
