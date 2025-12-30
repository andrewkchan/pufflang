import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("Stage1 scanner (Puffscript)", () => {
  test("scans def/return/parens/braces/numbers", () => {
    const source = `
    ${scannerSrc}
    def main() {
      var src = "def foo() { return 123; }";
      var toks = scan_kinds(byte~(&src[0]), len(src));
      var i = 0;
      while (i < toks.length) {
        print vecint_get(toks, i);
        i = i + 1;
      }
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const out = lines(res).map((x) => parseInt(x, 10))
    expect(out).toEqual([
      50, // DEF
      0,  // IDENTIFIER
      7,  // (
      8,  // )
      9,  // {
      61, // RETURN
      5,  // NUMBER
      17, // ;
      10, // }
      70  // EOF
    ])
  })
})
