import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

const NODE = {
  LITERAL: 1,
  VARIABLE: 2,
  BINARY: 3,
  CALL: 4,
  RETURN: 5,
  VAR_STMT: 6,
  FUNCTION: 7,
  BLOCK: 8,
}

describe("Stage1 parser AST var decls in block", () => {
  test("var init + return are included in block span", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}

    def node_int(arena NodeArena, idx int, offset int) int {
      var ptr = vec_get_ptr(arena.nodes, idx);
      return (int~(ptr + offset))~; // offset bytes into Node
    }

    def node_kind(arena NodeArena, idx int) int { return node_int(arena, idx, 0); }

    def main() {
      var src = "def foo() { var x = 1; return 2; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      var parsed = parse_simple_ast(toks);
      // node kinds order
      var i = 0;
      while (i < parsed.arena.nodes.length) {
        print node_kind(parsed.arena, i);
        i = i + 1;
      }
      // block metadata
      print node_int(parsed.arena, 4, 4); // block start
      print node_int(parsed.arena, 4, 8); // block count
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual([
      String(NODE.LITERAL),   // var init
      String(NODE.VAR_STMT),  // var stmt
      String(NODE.LITERAL),   // return literal
      String(NODE.RETURN),    // return
      String(NODE.BLOCK),     // block
      String(NODE.FUNCTION),  // function
      "0", // block start
      "4", // block count (literal, var_stmt, literal, return)
    ])
  })
})
