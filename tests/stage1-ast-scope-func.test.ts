import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 scope function helpers", () => {
  test("lookup kind, overload count, return type", () => {
    const source = `
    ${astSrc}
    def main() {
      var root = scope_new_root();
      var name = "foo";
      var sname = String{byte~(&name[0]), len(name)};
      var r1 = scope_define_function(root, sname, 1, 7, 1, 0);
      root = r1.scope;
      var r2 = scope_define_function(root, sname, 2, 7, 1, 0);
      root = r2.scope;
      print scope_lookup_kind(root, sname);
      print scope_function_overload_count(root, sname);
      print scope_function_return_type(root, sname);
      var bar = "bar";
      var sbar = String{byte~(&bar[0]), len(bar)};
      print scope_lookup_kind(root, sbar);
      print scope_function_overload_count(root, sbar);
      print scope_function_return_type(root, sbar);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["4", "2", "7", "0", "0", "-1"])
  })
})
