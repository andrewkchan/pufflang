import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("Stage1 scan_tokens (Puffscript)", () => {
  test("emits token kinds for simple def-return-number", () => {
    const source = `
    ${scannerSrc}
    def main() {
      var src = "def foo() { return 123; }";
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
    const out = lines(res).map((x) => parseInt(x, 10))
    expect(out).toEqual([
      50, // def
      0,  // identifier
      7,  // (
      8,  // )
      9,  // {
      61, // return
      5,  // number
      17, // ;
      10, // }
      70  // EOF
    ])
  })
})
