import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../../../src/harness"

const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "scanner.puff"), "utf8")
const astSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "ast.puff"), "utf8")
const typesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "types.puff"), "utf8")
const structLayoutSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "structlayout.puff"), "utf8")
const typeEnvSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "stage1", "typeenv.puff"), "utf8")
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
  ${parserExprSrc}
  ${typeparseSrc}
  ${parserFullSrc}
  ${resolverSrc}
  `
}

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 resolver with scopes", () => {
  test("passes with unique vars and return", () => {
    const source = `
    ${stage1Prelude()}
    def main() {
      var src = "def foo() { var x = 1; var y = 2; return y; }";
      var ok = resolve_with_scopes(byte~(&src[0]), len(src));
      print ok;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["1"])
  })

  test("fails on duplicate var in same scope", () => {
    const source = `
    ${stage1Prelude()}
    def main() {
      var src = "def foo() { var x = 1; var x = 2; return x; }";
      var ok = resolve_with_scopes(byte~(&src[0]), len(src));
      print ok;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["0"])
  })

  test("fails when missing return", () => {
    const source = `
    ${stage1Prelude()}
    def main() {
      var src = "def foo() { var x = 1; }";
      var ok = resolve_with_scopes(byte~(&src[0]), len(src));
      print ok;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["0"])
  })
})
