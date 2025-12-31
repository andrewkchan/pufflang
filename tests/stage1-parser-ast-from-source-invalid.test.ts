import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

describe("Stage1 parser AST from source helper (invalid)", () => {
  test("returns root -1 and empty arena when source is malformed", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}
    def main() {
      var src = "def foo( { return 1; }"; // malformed
      var parsed = parse_simple_ast_from_source(byte~(&src[0]), len(src));
      print parsed.root;
      print parsed.arena.nodes.length;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(["-1", "0"])
  })
})
