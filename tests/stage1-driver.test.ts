import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "scanner.puff"), "utf8")
const astSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "ast.puff"), "utf8")
const parserSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "parser.puff"), "utf8")
const resolverSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "resolver.puff"), "utf8")
const codegenSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "codegen.puff"), "utf8")
const driverSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "driver.puff"), "utf8")

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("Stage1 driver (scan+parse)", () => {
  test("compile_simple returns 1 for valid source", () => {
    const source = `
    ${scannerSrc}
    ${astSrc}
    ${parserSrc}
    ${resolverSrc}
    ${codegenSrc}
    ${driverSrc}
    def main() {
      var src = "def foo() { return 123; }";
      var ok = compile_simple(byte~(&src[0]), len(src));
      print ok;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["1"])
  })

  test("compile_simple returns 0 for invalid source", () => {
    const source = `
    ${scannerSrc}
    ${astSrc}
    ${parserSrc}
    ${resolverSrc}
    ${codegenSrc}
    ${driverSrc}
    def main() {
      var src = "def foo( { return 123; }"; // missing )
      var ok = compile_simple(byte~(&src[0]), len(src));
      print ok;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["0"])
  })
})
