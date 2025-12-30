import fs from "fs"
import path from "path"
import { compileToLl, buildWithClang, runBinary } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("e2e multi-file import/export with internal helpers", () => {
  test("link two modules with internal helper retained", () => {
    const modA = `
    // module A: exported inc, internal add
    export def inc(x int) int { return add(x, 1); }
    def add(a int, b int) int { return a + b; }
    // dummy main to satisfy compiler; will be renamed in IR to avoid conflicts
    def main() { return; }
    `
    const modB = `
    // module B: imports inc and uses it
    import def inc(x int) int;
    def main() {
      print inc(10);
      print inc(-2);
    }
    `
    const irA = compileToLl(modA)
    // rename main symbol in module A to avoid duplicate main during linking
    let irAContent = fs.readFileSync(irA, "utf8").replace(/@main\(/g, "@modA_dummy_main(")
    // Strip runtime globals/funcs to avoid duplicate definitions when linking
    irAContent = irAContent
      .replace(/@__puff_argc = [^\n]*\n/, "")
      .replace(/@__puff_argv = [^\n]*\n/, "")
      .replace(/define .*@__argc__[\s\S]*?^}/m, "")
      .replace(/define .*@__argv__[\s\S]*?^}/m, "")
      .replace(/define .*@__argv_at[\s\S]*?^}/m, "")
    fs.writeFileSync(irA, irAContent, "utf8")
    const irB = compileToLl(modB)
    const bin = buildWithClang([irA, irB])
    const res = runBinary(bin)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["11", "-1"])
    // verify internal linkage for add remains internal
    const irContent = fs.readFileSync(irA, "utf8")
    expect(irContent).toMatch(/define internal i32 @add/)
    expect(irContent).toMatch(/define i32 @inc\(/)
  })
})
