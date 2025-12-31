import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 scope info", () => {
  test("lookup_info reports var kind and type id", () => {
    const source = `
    ${astSrc}
    def main() {
      var root = scope_new_root();
      var name = "x";
      var sname = String{byte~(&name[0]), len(name)};
      var r = scope_define_var(root, sname, 5);
      root = r.scope;
      print r.err;
      var info = scope_lookup_info(root, sname);
      print info.kind;
      print info.typeId;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["0", "1", "5"])
  })
})
