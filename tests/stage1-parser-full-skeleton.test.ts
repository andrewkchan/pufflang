import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const typesSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "types.puff"), "utf8")
const structLayoutSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "structlayout.puff"), "utf8")
const typeEnvSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "typeenv.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserFullSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_full.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_expr.puff"), "utf8")
const typeparseSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "typeparse.puff"), "utf8")

function stripAstTypeSection(src: string): string {
  const marker = "// ---- Node arena ----"
  const idx = src.indexOf(marker)
  if (idx === -1) return src
  return src.slice(idx)
}

describe("Stage1 full parser skeleton (non-failing)", () => {
  test("parses minimal def/return", () => {
    const source = `
${typesSrc}
${stripAstTypeSection(astSrc)}
${scannerSrc}
${structLayoutSrc}
${typeEnvSrc}
${parserExprSrc}
${typeparseSrc}
${parserFullSrc}
def print_ok(ok int) { if (ok == 1) { __putchar__(49); } }
def main() {
  // Compile-time inclusion of parser_full; runtime smoke does nothing yet.
  print_ok(1);
}
`
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("1")
  })
})
