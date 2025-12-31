import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 scope nested lookup", () => {
  test("inner scope sees outer bindings, shadowing works", () => {
    const source = `
    ${astSrc}
    def main() {
      var root = scope_new_root();
      var outerName = "a";
      var sa = String{byte~(&outerName[0]), len(outerName)};
      var r = scope_define_var(root, sa, 11);
      root = r.scope;
      // enter inner scope by cloning and bumping depth
      var inner = scope_enter(root);
      var innerName = "b";
      var sb = String{byte~(&innerName[0]), len(innerName)};
      var r2 = scope_define_var(inner, sb, 12);
      inner = r2.scope;
      // shadow a
      var r3 = scope_define_var(inner, sa, 13);
      inner = r3.scope;
      var infoA = scope_lookup_info(inner, sa);
      var infoB = scope_lookup_info(inner, sb);
      print infoA.typeId; // should be 13 (shadow)
      print infoB.typeId; // should be 12
      // exit inner scope, shadow removed
      var back = scope_exit(inner);
      var infoAOuter = scope_lookup_info(back, sa);
      print infoAOuter.typeId; // should be 11
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["13", "12", "11"])
  })
})
