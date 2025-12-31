import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserFullSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser_full.puff"), "utf8")

describe("Stage1 full parser skeleton (non-failing)", () => {
  test("parses minimal def/return", () => {
    const source = `
${astSrc}
${scannerSrc}
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
