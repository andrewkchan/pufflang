import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../../src/harness"

const typeparseSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeparse.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "scanner.puff"), "utf8")
const typesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "types.puff"), "utf8")
const structLayoutSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "structlayout.puff"), "utf8")
const typeEnvSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeenv.puff"), "utf8")

function run() {
  const samplesStr = [
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
  const samplesId = [
    "int",
    "byte",
    "int~",
    "int~~",
    "[byte;2]",
    "[int;3]~",
    "float",
    "void",
    "len" // invalid
  ]
  const body = `
${scannerSrc}
${typesSrc}
${structLayoutSrc}
${typeEnvSrc}
${typeparseSrc}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x;
  var buf = vecbyte_new(16);
  if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) {
    buf = vecbyte_push(buf, byte(48 + (n % 10)));
    n = n / 10;
  }
  var i = buf.length - 1;
  while (i >= 0) {
    __putchar__(int((buf.data + i)~));
    i = i - 1;
  }
}

def print_str(s String) {
  var i = 0;
  while (i < s.length) {
    __putchar__(int((s.data + i)~));
    i = i + 1;
  }
  __putchar__(10);
}

def main() {
  ${samplesStr
    .map((s, i) => {
      const lit = JSON.stringify(s)
      return `
  var s${i} = ${lit};
  print_str(parse_type_to_string(byte~(&s${i}[0]), len(s${i})));
`
    })
    .join("")}

  // type ids
  var env = typeenv_new();
  ${samplesId
    .map((s, i) => {
      const lit = JSON.stringify(s)
      return `
  var t${i} = ${lit};
  var res${i} = parse_type_to_id(env, byte~(&t${i}[0]), len(t${i}));
  env = res${i}.env;
  print_int(res${i}.err); __putchar__(58); print_int(res${i}.typeId); __putchar__(10);
`
    })
    .join("")}

  // param list parsing: two ints, then int~, then float
  var paramSrc = "int, int, int~, float";
  var pres = parse_param_types(env, byte~(&paramSrc[0]), len(paramSrc));
  var j = 0;
  while (j < pres.ids.length) {
    print_int(vecint_get(pres.ids, j));
    __putchar__(32);
    j = j + 1;
  }
  print_int(pres.err);
  __putchar__(10);

  // invalid param list (double comma)
  var badSrc = "int, , byte";
  var bad = parse_param_types(env, byte~(&badSrc[0]), len(badSrc));
  print_int(bad.err);
  __putchar__(10);

  // function type parsing
  var fnSrc = "(int, byte) float";
  var fnRes = parse_fn_types(env, byte~(&fnSrc[0]), len(fnSrc));
  var p = 0;
  while (p < fnRes.params.length) {
    print_int(vecint_get(fnRes.params, p));
    __putchar__(32);
    p = p + 1;
  }
  print_int(fnRes.ret); __putchar__(32); print_int(fnRes.err); __putchar__(10);

  var fnBad = "(int)";
  var fnBadRes = parse_fn_types(env, byte~(&fnBad[0]), len(fnBad));
  print_int(fnBadRes.err); __putchar__(58); print_int(fnBadRes.ret); __putchar__(10);

  // type id to string roundtrip (best-effort)
  print_str(type_id_to_string(env.tt, env.structSizes, res0.typeId));
  print_str(type_id_to_string(env.tt, env.structSizes, res1.typeId));
  print_str(type_id_to_string(env.tt, env.structSizes, res2.typeId));
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
    // first block: strings (11 lines including two invalid blanks)
    const typeStrLines = lines.slice(0, expected.length)
    expect(typeStrLines).toEqual(expected)

    const expectedIds = [
      "0:5",  // int
      "0:2",  // byte
      "0:9",  // int pointer (ids grow as we allocate)
      "0:11", // ptr to ptr
      "0:12", // array byte[2]
      "0:14", // ptr to array
      "0:4",  // float
      "0:8",  // void
      "1:-1"  // invalid
    ]
    const idStart = expected.length
    const idLines = lines.slice(idStart, idStart + expectedIds.length)
    expect(idLines).toEqual(expectedIds)

    const paramLine = lines[idStart + expectedIds.length]
    expect(paramLine.trim()).toMatch(/^5 5 [0-9]+ 4 0$/)

    const badLine = lines[idStart + expectedIds.length + 1]
    expect(badLine.trim()).toBe("1")

    const fnLine = lines[idStart + expectedIds.length + 2]
    // params int + byte, ret float, err 0
    expect(fnLine.trim()).toMatch(/^5 [0-9]+ 4 0$/)

    const fnBadLine = lines[idStart + expectedIds.length + 3]
    expect(fnBadLine.trim()).toBe("0:8") // defaults to void

    const roundtrip = lines.slice(idStart + expectedIds.length + 4, idStart + expectedIds.length + 7)
    expect(roundtrip).toEqual([
      "int",
      "byte",
      "(ptr int)"
    ])
  })
})
