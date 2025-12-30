import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")

describe("Stage1 scanner (Puffscript) comma token", () => {
  test("emits comma between params", () => {
    const source = `
    ${scannerSrc}
    def main() {
      var src = "def foo(a, b) { return a; }";
      var toks = scan_tokens(byte~(&src[0]), len(src));
      var i = 0;
      while (i < toks.length) {
        print token_kind_at(toks, i);
        i = i + 1;
      }
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const out = res.stdout.trim().split("\n").map((s) => parseInt(s, 10))
    expect(out).toEqual([
      50, // def
      0,  // foo
      7,  // (
      0,  // a
      13, // ,
      0,  // b
      8,  // )
      9,  // {
      61, // return
      0,  // a
      17, // ;
      10, // }
      70  // EOF
    ])
  })
})
