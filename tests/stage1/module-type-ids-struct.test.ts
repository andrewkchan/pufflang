import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../../src/harness"

const astSrcFull = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "parser_expr.puff"), "utf8")
const parserFullSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "parser_full.puff"), "utf8")
const typesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "types.puff"), "utf8")
const typeEnvSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeenv.puff"), "utf8")
const structLayoutSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "structlayout.puff"), "utf8")
const typeParseSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeparse.puff"), "utf8")

function stripAstTypeSection(src: string): string {
  const marker = "// ---- Node arena ----"
  const idx = src.indexOf(marker)
  if (idx === -1) return src
  return src.slice(idx)
}

const astSrc = stripAstTypeSection(astSrcFull)

function runStructOffsets() {
  const source = `
${typesSrc}
${structLayoutSrc}
${typeEnvSrc}
${astSrc}
${scannerSrc}
${parserExprSrc}
${typeParseSrc}
${parserFullSrc}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x; var buf = vecbyte_new(16); if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) { buf = vecbyte_push(buf, byte(48 + (n % 10))); n = n / 10; }
  var i = buf.length - 1; while (i >= 0) { __putchar__(int((buf.data + i)~)); i = i - 1; }
}

def main() {
  var src = "struct Point { x int, y byte }";
  var pmr = parse_module_source(byte~(&src[0]), len(src));
  var tm = module_type_ids(pmr);
  print_int(tm.err); __putchar__(32);
  print_int(tm.structTypeIds.length); __putchar__(32);
  print_int(vecint_get(tm.structFieldCount, 0)); __putchar__(32);
  var offStart = vecint_get(tm.structFieldOffsetStart, 0);
  print_int(vecint_get(tm.structFieldOffsets, offStart)); __putchar__(32);
  print_int(vecint_get(tm.structFieldOffsets, offStart + 1)); __putchar__(32);
  var tStart = vecint_get(tm.structFieldTypeStart, 0);
  print_int(vecint_get(tm.structFieldTypeIds, tStart)); __putchar__(32);
  print_int(vecint_get(tm.structFieldTypeIds, tStart + 1));
  __putchar__(10);
}
`
  return compileAndRunWithStdlib(source)
}

describe("module_type_ids struct support", () => {
  it("captures struct field offsets and types", () => {
    const res = runStructOffsets()
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("0 1 2 0 4 5 2")
  })
})
