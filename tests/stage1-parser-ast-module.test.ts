import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

describe("Stage1 parser AST construction (Puffscript)", () => {
  test("builds module with literal→return→block→function chain", () => {
    const source = `
    ${scannerSrc}
    ${parserSrc}

    def node_kind(mod ParseModule, idx int) int {
      var ptr = vec_get_ptr(mod.nodes, idx);
      return (int~(ptr))~;
    }

    def main() {
      var src = "def foo() { return 123; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      var mod = parse_simple_ast(toks);
      print mod.root;            // expect 3
      print mod.nodes.length;    // expect 4
      print node_kind(mod, 0);   // literal
      print node_kind(mod, 1);   // return
      print node_kind(mod, 2);   // block
      print node_kind(mod, 3);   // function
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual([
      "3", // root index
      "4", // node count
      "5", // NODE_LITERAL
      "2", // NODE_RETURN
      "6", // NODE_BLOCK
      "1", // NODE_FUNCTION
    ])
  })
})
