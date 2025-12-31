import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

describe("Stage1 parser AST literal value", () => {
  test("stores return literal value in Node value slot", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}

    def node_value(arena NodeArena, idx int) int {
      var ptr = vec_get_ptr(arena.nodes, idx);
      return (int~(ptr + 20))~; // value field
    }

    def main() {
      var src = "def foo() { return 42; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      var parsed = parse_simple_ast(toks);
      print parsed.root;                 // expect 3
      print parsed.arena.nodes.length;   // expect 4
      print node_value(parsed.arena, 0); // literal token kind (NUMBER)
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(["3", "4", "5"])
  })
})
