import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 parser param extraction helpers", () => {
  test("extracts params and return expression", () => {
    const source = `
    ${astSrc}
    ${scannerSrc}
    ${parserSrc}
    def main() {
      var src = "def foo(alpha, beta, gamma) { var x = 1; return alpha + gamma; }";
      var params = parse_params_vec(byte~(&src[0]), len(src));
      var i = 0;
      var nl byte = byte(10);
      while (i < params.length) {
        var s = vecstr_get(params, i);
        __write__(1, s.data, s.length);
        __write__(1, byte~(&nl), 1);
        i = i + 1;
      }
      var ret = parse_return_expr_str(byte~(&src[0]), len(src));
      __write__(1, ret.data, ret.length);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["alpha", "beta", "gamma", "alpha + gamma"])
  })
})
