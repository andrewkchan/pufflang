import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

const NODE = {
  LITERAL: 1,
  VAR_STMT: 6,
  RETURN: 5,
  BLOCK: 8,
  FUNCTION: 7,
}

describe("Stage1 parser AST multiple var decls", () => {
  test("two var inits count into block span", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}

    def node_int(arena NodeArena, idx int, offset int) int {
      var ptr = vec_get_ptr(arena.nodes, idx);
      return (int~(ptr + offset))~;
    }
    def node_kind(arena NodeArena, idx int) int { return node_int(arena, idx, 0); }

    def main() {
      var src = "def foo() { var a = 1; var b = 2; return 3; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      var parsed = parse_simple_ast(toks);
      // node kinds in order
      var i = 0;
      while (i < parsed.arena.nodes.length) {
        print node_kind(parsed.arena, i);
        i = i + 1;
      }
      // block span
      var blkIdx = parsed.arena.nodes.length - 2;
      print node_int(parsed.arena, blkIdx, 4); // start
      print node_int(parsed.arena, blkIdx, 8); // count
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual([
      String(NODE.LITERAL),   // var a init
      String(NODE.VAR_STMT),  // var a stmt
      String(NODE.LITERAL),   // var b init
      String(NODE.VAR_STMT),  // var b stmt
      String(NODE.LITERAL),   // return literal
      String(NODE.RETURN),    // return
      String(NODE.BLOCK),     // block
      String(NODE.FUNCTION),  // function
      "0", // block start
      "6", // block count
    ])
  })
})
