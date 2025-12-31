import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 scope struct helpers", () => {
  test("struct type lookup and duplicate detection", () => {
    const source = `
    ${astSrc}
    def main() {
      var root = scope_new_root();
      var name = "S";
      var sname = String{byte~(&name[0]), len(name)};
      var r1 = scope_define_struct(root, sname, 21);
      root = r1.scope;
      print r1.err;
      var rDup = scope_define_struct(root, sname, 22);
      root = rDup.scope;
      print rDup.err;
      print scope_struct_type(root, sname);
      var missing = "T";
      var sm = String{byte~(&missing[0]), len(missing)};
      print scope_struct_type(root, sm);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["0", "1", "21", "-1"])
  })
})
