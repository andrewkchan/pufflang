import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../../src/harness"

const typeparseSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeparse.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "scanner.puff"), "utf8")

function run() {
  const samples = [
    "int",
    "byte",
    "Foo",
    "int~",
    "int~~",
    "[int;3]",
    "[byte;4]~",
    "[[int;2];3]",
    "[int;0]",
    "len", // invalid
    "[int;x]" // invalid
  ]
  const body = `
${scannerSrc}
${typeparseSrc}

def print_str(s String) {
  var i = 0;
  while (i < s.length) {
    __putchar__(int((s.data + i)~));
    i = i + 1;
  }
  __putchar__(10);
}

def main() {
  ${samples
    .map((s, i) => {
      const lit = JSON.stringify(s)
      return `
  var s${i} = ${lit};
  print_str(parse_type_to_string(byte~(&s${i}[0]), len(s${i})));
`
    })
    .join("")}
}
`
  return compileAndRunWithStdlib(body)
}

describe("Stage1 type parser", () => {
  it("parses primitive, pointer, and array types to s-expr strings", () => {
    const res = run()
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const expected = [
      "int",
      "byte",
      "(struct Foo)",
      "(ptr int)",
      "(ptr (ptr int))",
      "(array 3 int)",
      "(ptr (array 4 byte))",
      "(array 3 (array 2 int))",
      "(array 0 int)",
      "", // invalid
      "" // invalid
    ]
    const lines = res.stdout.split("\n")
    if (lines.length > 0 && lines[lines.length - 1] === "") { lines.pop() }
    expect(lines).toEqual(expected)
  })
})
