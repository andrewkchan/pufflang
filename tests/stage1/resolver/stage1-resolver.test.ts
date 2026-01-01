import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../../../src/harness"

const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "scanner.puff"), "utf8")
const astSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "ast.puff"), "utf8")
const typesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "types.puff"), "utf8")
const structLayoutSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "structlayout.puff"), "utf8")
const typeEnvSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "typeenv.puff"), "utf8")
const typerulesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "typerules.puff"), "utf8")
const literalTypesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "literaltypes.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "parser_expr.puff"), "utf8")
const typeparseSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "typeparse.puff"), "utf8")
const parserFullSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "parser_full.puff"), "utf8")
const resolverSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "resolver.puff"), "utf8")

function stripAstTypeSection(src: string): string {
  const marker = "// ---- Node arena ----"
  const idx = src.indexOf(marker)
  if (idx === -1) return src
  return src.slice(idx)
}

function stage1Prelude() {
  return `
  ${typesSrc}
  ${stripAstTypeSection(astSrc)}
  ${scannerSrc}
  ${structLayoutSrc}
  ${typeEnvSrc}
  ${typerulesSrc}
  ${literalTypesSrc}
  ${parserExprSrc}
  ${typeparseSrc}
  ${parserFullSrc}
  ${resolverSrc}
  `
}

describe("Stage1 resolver (Puffscript minimal)", () => {
  test("returns 1 for well-formed tokens with return + EOF", () => {
    const source = `
    ${stage1Prelude()}
    def main() {
      var src = "def foo() { return 1; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      print resolve_simple(toks);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("1")
  })

  test("returns 0 when missing return token", () => {
    const source = `
    ${stage1Prelude()}
    def main() {
      var toks = vecint_new(2);
      toks = vecint_push(toks, TOKEN_DEF);
      toks = vecint_push(toks, TOKEN_EOF);
      print resolve_simple(toks);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("0")
  })
})
