import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

describe("Stage1 parser AST construction (Puffscript)", () => {
  test("builds module with literal→return→block→function chain", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}

    def node_kind(arena NodeArena, idx int) int {
      var ptr = vec_get_ptr(arena.nodes, idx);
      return (int~(ptr))~;
    }

    def main() {
      var src = "def foo() { return 123; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      var parsed = parse_simple_ast(toks);
      print parsed.root;                // expect 3
      print parsed.arena.nodes.length;  // expect 4
      print node_kind(parsed.arena, 0); // literal
      print node_kind(parsed.arena, 1); // return
      print node_kind(parsed.arena, 2); // block
      print node_kind(parsed.arena, 3); // function
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual([
      "3", // root index
      "4", // node count
      "1", // NODE_LITERAL
      "5", // NODE_RETURN
      "8", // NODE_BLOCK
      "7", // NODE_FUNCTION
    ])
  })
})
