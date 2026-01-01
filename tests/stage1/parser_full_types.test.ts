import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../../src/harness"

const astSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "ast.puff"), "utf8")
const scannerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "scanner.puff"), "utf8")
const parserExprSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "parser_expr.puff"), "utf8")
const typesSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "types.puff"), "utf8")
const structLayoutSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "structlayout.puff"), "utf8")
const typeEnvSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeenv.puff"), "utf8")
const typeparseSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "typeparse.puff"), "utf8")
const parserFullSrc = fs.readFileSync(path.join(__dirname, "..", "..", "stage1", "parser_full.puff"), "utf8")

function stripAstTypeSection(src: string): string {
  const marker = "// ---- Node arena ----"
  const idx = src.indexOf(marker)
  if (idx === -1) return src
  return src.slice(idx)
}

function run() {
  const body = `
${typesSrc}
${stripAstTypeSection(astSrc)}
${scannerSrc}
${structLayoutSrc}
${typeEnvSrc}
${parserExprSrc}
${typeparseSrc}
${parserFullSrc}

def print_str(s String) {
  var i = 0;
  while (i < s.length) {
    __putchar__(int((s.data + i)~));
    i = i + 1;
  }
  __putchar__(10);
}

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

def main() {
  var sb = sb_new();
  sb = sb_append_cstr(sb, byte~(&"export def foo(a int, b [byte;2] = 7) float {"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"  var x byte = 1;"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"  return a;"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"}"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"import def bar(c int~);"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"struct Pair { left int, right [byte;4] }"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"def baz(z int) { return z; }"[0]));
  sb = sb_append_byte(sb, byte(10));
  sb = sb_append_cstr(sb, byte~(&"var g int = 3;"[0]));

  var srcStr = sb_to_string(sb);
  var res = parse_module_source(srcStr.data, srcStr.length);

  // type parser s-expr + ids
  var s0 = "int"; print_str(parse_type_to_string(byte~(&s0[0]), len(s0)));
  var s1 = "byte"; print_str(parse_type_to_string(byte~(&s1[0]), len(s1)));
  var s2 = "Foo"; print_str(parse_type_to_string(byte~(&s2[0]), len(s2)));
  var s3 = "int~"; print_str(parse_type_to_string(byte~(&s3[0]), len(s3)));
  var s4 = "int~~"; print_str(parse_type_to_string(byte~(&s4[0]), len(s4)));
  var s5 = "[int;3]"; print_str(parse_type_to_string(byte~(&s5[0]), len(s5)));
  var s6 = "[byte;4]~"; print_str(parse_type_to_string(byte~(&s6[0]), len(s6)));
  var s7 = "[[int;2];3]"; print_str(parse_type_to_string(byte~(&s7[0]), len(s7)));
  var s8 = "[int;0]"; print_str(parse_type_to_string(byte~(&s8[0]), len(s8)));
  var s9 = "len"; print_str(parse_type_to_string(byte~(&s9[0]), len(s9)));
  var s10 = "[int;x]"; print_str(parse_type_to_string(byte~(&s10[0]), len(s10)));

  var envIds = typeenv_new();
  var t0 = "int"; var r0 = parse_type_to_id(envIds, byte~(&t0[0]), len(t0)); envIds = r0.env; print_int(r0.err); __putchar__(58); print_int(r0.typeId); __putchar__(10);
  var t1 = "byte"; var r1 = parse_type_to_id(envIds, byte~(&t1[0]), len(t1)); envIds = r1.env; print_int(r1.err); __putchar__(58); print_int(r1.typeId); __putchar__(10);
  var t2 = "int~"; var r2 = parse_type_to_id(envIds, byte~(&t2[0]), len(t2)); envIds = r2.env; print_int(r2.err); __putchar__(58); print_int(r2.typeId); __putchar__(10);
  var t3 = "int~~"; var r3 = parse_type_to_id(envIds, byte~(&t3[0]), len(t3)); envIds = r3.env; print_int(r3.err); __putchar__(58); print_int(r3.typeId); __putchar__(10);
  var t4 = "[byte;2]"; var r4 = parse_type_to_id(envIds, byte~(&t4[0]), len(t4)); envIds = r4.env; print_int(r4.err); __putchar__(58); print_int(r4.typeId); __putchar__(10);
  var t5 = "[int;3]~"; var r5 = parse_type_to_id(envIds, byte~(&t5[0]), len(t5)); envIds = r5.env; print_int(r5.err); __putchar__(58); print_int(r5.typeId); __putchar__(10);
  var t6 = "float"; var r6 = parse_type_to_id(envIds, byte~(&t6[0]), len(t6)); envIds = r6.env; print_int(r6.err); __putchar__(58); print_int(r6.typeId); __putchar__(10);
  var t7 = "void"; var r7 = parse_type_to_id(envIds, byte~(&t7[0]), len(t7)); envIds = r7.env; print_int(r7.err); __putchar__(58); print_int(r7.typeId); __putchar__(10);
  var t8 = "len"; var r8 = parse_type_to_id(envIds, byte~(&t8[0]), len(t8)); envIds = r8.env; print_int(r8.err); __putchar__(58); print_int(r8.typeId); __putchar__(10);

  // param list parsing: two ints, then int~, then float
  var paramSrc = "int, int, int~, float";
  var pres = parse_param_types(envIds, byte~(&paramSrc[0]), len(paramSrc));
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
  var bad = parse_param_types(envIds, byte~(&badSrc[0]), len(badSrc));
  print_int(bad.err);
  __putchar__(10);

  // function type parsing
  var fnSrc = "(int, byte) float";
  var fnRes = parse_fn_types(envIds, byte~(&fnSrc[0]), len(fnSrc));
  var p = 0;
  while (p < fnRes.params.length) {
    print_int(vecint_get(fnRes.params, p));
    __putchar__(32);
    p = p + 1;
  }
  print_int(fnRes.ret); __putchar__(32); print_int(fnRes.err); __putchar__(10);

  var fnBad = "(int)";
  var fnBadRes = parse_fn_types(envIds, byte~(&fnBad[0]), len(fnBad));
  print_int(fnBadRes.err); __putchar__(58); print_int(fnBadRes.ret); __putchar__(10);

  // type id to string roundtrip (best-effort)
  print_str(type_id_to_string(envIds.tt, envIds.structSizes, 5)); // int
  print_str(type_id_to_string(envIds.tt, envIds.structSizes, 2)); // byte
  print_str(type_id_to_string(envIds.tt, envIds.structSizes, 9)); // ptr int

  // module type ids from parser_full metadata
  var typed = module_type_ids(res);
  var fooStart = vecint_get(typed.fnParamTypeStart, 0);
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.paramTypeIds, fooStart)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.paramTypeIds, fooStart + 1)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.fnReturnTypeId, 0)));
  var barStart = vecint_get(typed.fnParamTypeStart, 1);
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.paramTypeIds, barStart)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.fnReturnTypeId, 1)));
  var bazStart = vecint_get(typed.fnParamTypeStart, 2);
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.paramTypeIds, bazStart)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.fnReturnTypeId, 2)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.varTypeIds, 0)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.varTypeIds, 1)));
  var pairStart = vecint_get(typed.structFieldTypeStart, 0);
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.structFieldTypeIds, pairStart)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, vecint_get(typed.structFieldTypeIds, pairStart + 1)));

  // helper accessors
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, tm_fn_param_type(typed, 0, 0)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, tm_fn_param_type(typed, 0, 1)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, tm_fn_return_type(typed, 0)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, tm_var_type(typed, 0)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, tm_struct_type(typed, 0)));
  print_str(type_id_to_string(typed.env.tt, typed.env.structSizes, tm_struct_field_type(typed, 0, 1)));

  print_str(module_counts(res));
  print_str(module_type_summary(res));
}
`
  return compileAndRunWithStdlib(body)
}

describe("Stage1 parser_full types and defaults", () => {
  it("captures parameter/return/struct/var type metadata", () => {
    const res = run()
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.split("\n").filter((l) => l !== "")
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
      "0:5",
      "0:2",
      "0:9",
      "0:11",
      "0:12",
      "0:14",
      "0:4",
      "0:8",
      "1:-1",
      expect.stringMatching(/^5 5 [0-9]+ 4 0$/),
      "1",
      expect.stringMatching(/^5 2 4 0$/),
      "0:8",
      "int",
      "byte",
      "(ptr int)",
      "int",
      "(array 2 byte)",
      "float",
      "(ptr int)",
      "void",
      "int",
      "void",
      "byte",
      "int",
      "int",
      "(array 4 byte)",
      "int",
      "(array 2 byte)",
      "float",
      "byte",
      "(struct 0)",
      "(array 4 byte)",
      "funcs=3 imports=1 exports=1 structs=1 vars=2",
      "fn foo params=int,(array 2 byte)=default ret=float export=1 import=0",
      "fn bar params=(ptr int) ret=void export=0 import=1",
      "fn baz params=int ret=void export=0 import=0",
      "var x type=byte",
      "var g type=int",
      "struct Pair fields=int,(array 4 byte)"
    ]
    expect(lines.length).toBe(expected.length)
    expected.forEach((exp, idx) => {
      const got = lines[idx]
      if (typeof exp === "string") {
        expect(got).toBe(exp)
      } else {
        expect(got).toEqual(exp)
      }
    })
  })
})
