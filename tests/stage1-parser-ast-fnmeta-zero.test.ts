import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

describe("Stage1 parser AST function metadata (no params)", () => {
  test("zero params and block span recorded", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}

    def node_int(arena NodeArena, idx int, offset int) int {
      var ptr = vec_get_ptr(arena.nodes, idx);
      return (int~(ptr + offset))~; // offset bytes into Node
    }

    def main() {
      var src = "def foo() { return 9; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      var parsed = parse_simple_ast(toks);
      print parsed.root;                      // expect 3
      print parsed.arena.nodes.length;        // expect 4
      // block fields: start idx, count
      print node_int(parsed.arena, 2, 4);     // block start (litIdx)
      print node_int(parsed.arena, 2, 8);     // block count
      // function fields: block idx, param count
      print node_int(parsed.arena, 3, 4);     // blk idx
      print node_int(parsed.arena, 3, 8);     // param count (0)
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual([
      "3", // root index
      "4", // node count
      "0", // block start
      "2", // block count (literal + return)
      "2", // block idx
      "0", // param count
    ])
  })
})
