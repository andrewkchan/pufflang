import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

const NODE = {
  LITERAL: 1,
  VARIABLE: 2,
  VAR_STMT: 6,
  RETURN: 5,
  BLOCK: 8,
  FUNCTION: 7,
}

describe("Stage1 parser AST var decl with identifier init", () => {
  test("var x = y; return z; stored in block", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}

    def node_int(arena NodeArena, idx int, offset int) int {
      var ptr = vec_get_ptr(arena.nodes, idx);
      return (int~(ptr + offset))~;
    }
    def node_kind(arena NodeArena, idx int) int { return node_int(arena, idx, 0); }
    def node_val(arena NodeArena, idx int) int { return node_int(arena, idx, 20); }

    def main() {
      var src = "def foo() { var x = y; return z; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      var parsed = parse_simple_ast(toks);
      // node kinds in order
      var i = 0;
      while (i < parsed.arena.nodes.length) {
        print node_kind(parsed.arena, i);
        i = i + 1;
      }
      // value fields for var init and return expr should be IDENT kind (0)
      print node_val(parsed.arena, 0); // var init VARIABLE
      print node_val(parsed.arena, 2); // return expr VARIABLE
      // block span
      print node_int(parsed.arena, parsed.arena.nodes.length - 2, 4); // block start
      print node_int(parsed.arena, parsed.arena.nodes.length - 2, 8); // block count
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual([
      String(NODE.VARIABLE), // init expr
      String(NODE.VAR_STMT),
      String(NODE.VARIABLE), // return expr
      String(NODE.RETURN),
      String(NODE.BLOCK),
      String(NODE.FUNCTION),
      "0",
      "0",
      "0", // block start
      "4", // block count
    ])
  })
})
