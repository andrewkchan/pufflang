import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 parser function shape extraction", () => {
  test("captures name, params, vars, return expr", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}
    def main() {
      var src = "def foo(alpha, beta, gamma) { var x = 1; var y = 2; return alpha + gamma; }";
      var shape = parse_function_shape(byte~(&src[0]), len(src));
      var nl byte = byte(10);
      __write__(1, shape.name.data, shape.name.length);
      __write__(1, byte~(&nl), 1);
      var i = 0;
      while (i < shape.params.length) {
        var p = vecstr_get(shape.params, i);
        __write__(1, p.data, p.length);
        __write__(1, byte~(&nl), 1);
        i = i + 1;
      }
      __write__(1, shape.returnExpr.data, shape.returnExpr.length);
      __write__(1, byte~(&nl), 1);
      print shape.vars;
      print shape.hasReturn;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual([
      "foo",
      "alpha",
      "beta",
      "gamma",
      "alpha + gamma",
      "2",
      "1"
    ])
  })
})
