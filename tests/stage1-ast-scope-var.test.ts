import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 scope variable helpers", () => {
  test("variable_type returns type id", () => {
    const source = `
    ${astSrc}
    def main() {
      var root = scope_new_root();
      var name = "v";
      var sname = String{byte~(&name[0]), len(name)};
      var res = scope_define_var(root, sname, 9);
      root = res.scope;
      print res.err;
      print scope_variable_type(root, sname);
      var missing = "m";
      var sm = String{byte~(&missing[0]), len(missing)};
      print scope_variable_type(root, sm);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["0", "9", "-1"])
  })
})
