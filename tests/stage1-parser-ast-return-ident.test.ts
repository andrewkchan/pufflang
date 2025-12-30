import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

const NODE = {
  LITERAL: 1,
  VARIABLE: 2,
  RETURN: 5,
  BLOCK: 8,
  FUNCTION: 7,
}

describe("Stage1 parser AST return identifier", () => {
  test("return ident stored as VARIABLE node", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}

    def node_int(arena NodeArena, idx int, offset int) int {
      var ptr = vec_get_ptr(arena.nodes, idx);
      return (int~(ptr + offset))~; // offset bytes into Node
    }

    def node_kind(arena NodeArena, idx int) int { return node_int(arena, idx, 0); }
    def node_val(arena NodeArena, idx int) int { return node_int(arena, idx, 20); }

    def main() {
      var src = "def foo() { return x; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      var parsed = parse_simple_ast(toks);
      print parsed.root;                      // expect 3
      print parsed.arena.nodes.length;        // expect 5 (var count 0 => literal absent)
      // node kinds
      print node_kind(parsed.arena, 0); // return expr VARIABLE
      print node_val(parsed.arena, 0);  // token kind (IDENT = 0)
      print node_kind(parsed.arena, 1); // RETURN
      print node_kind(parsed.arena, 2); // BLOCK
      print node_kind(parsed.arena, 3); // FUNCTION
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual([
      "3",
      "4",
      String(NODE.VARIABLE),
      "0", // token kind for IDENT
      String(NODE.RETURN),
      String(NODE.BLOCK),
      String(NODE.FUNCTION),
    ])
  })
})
