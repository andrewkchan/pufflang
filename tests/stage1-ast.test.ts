import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")

const lines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("Stage1 AST/type scaffolding", () => {
  test("type table basic ops and numeric check", () => {
    const source = `
    ${astSrc}
    def main() {
      var tt = typetable_new();
      // add pointer(int) and array(int,4)
      tt = typetable_make_pointer(tt, 5);
      var ptrId = tt.types.length - 1;
      tt = typetable_make_array(tt, 5, 4);
      var arrId = tt.types.length - 1;
      print type_is_numeric(tt, 5); // int
      print type_equals(tt, ptrId, arrId); // should be 0
      print type_equals(tt, 5, 5); // int == int
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res.stdout)).toEqual(["1", "0", "1"])
  })

  test("scope function overloading and mangling", () => {
    const source = `
    ${astSrc}
    def main() {
      var root = scope_new_root();
      var name = "foo";
      var sname = String{byte~(&name[0]), len(name)};
      var err1 = scope_define_function(root, sname, 1, 5, 1, 0);
      print err1;
      var err2 = scope_define_function(root, sname, 2, 5, 1, 0);
      print err2;
      var errDup = scope_define_function(root, sname, 2, 5, 1, 0);
      print errDup;
      var mangled = mangle_name(sname, 2, 1, 2);
      __write__(1, mangled.data, mangled.length);
      __write__(1, byte~(&"\\n"[0]), 1);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const out = lines(res.stdout).map((s) => s.replace("\\0", "").replace("\u0000", ""))
    expect(out[0]).toBe("foo__2")
    expect(out.slice(1)).toEqual(expect.arrayContaining(["0", "1"]))
  })
})
