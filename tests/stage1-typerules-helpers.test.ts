import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const typesSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "types.puff"), "utf8")
const rulesSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "typerules.puff"), "utf8")

function runRules() {
  const source = `
${typesSrc}
${rulesSrc}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x; var buf = vecbyte_new(16); if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) { buf = vecbyte_push(buf, byte(48 + (n % 10))); n = n / 10; }
  var i = buf.length - 1; while (i >= 0) { __putchar__(int((buf.data + i)~)); i = i - 1; }
}

def main() {
  var tt = typetable_new();
  var idBool = 1;
  var idByte = 2;
  var idFloat = 4;
  var idInt = 5;
  var ptrInt = tt.types.length; tt = typetable_make_pointer(tt, idInt);
  var ptrByte = tt.types.length; tt = typetable_make_pointer(tt, idByte);
  var ptrFloat = tt.types.length; tt = typetable_make_pointer(tt, idFloat);

  // arithmetic
  print_int(type_binary_arith_result(tt, idByte, idInt, OP_ADD)); __putchar__(32); // 5
  print_int(type_binary_arith_result(tt, idFloat, idInt, OP_ADD)); __putchar__(32); // 4
  print_int(type_binary_arith_result(tt, ptrInt, idInt, OP_ADD)); __putchar__(32); // ptrInt id
  print_int(type_binary_arith_result(tt, idInt, ptrInt, OP_ADD)); __putchar__(32); // ptrInt id
  print_int(type_binary_arith_result(tt, ptrInt, ptrByte, OP_SUB)); __putchar__(32); // -1 (different elem)
  print_int(type_binary_arith_result(tt, ptrInt, ptrInt, OP_SUB)); __putchar__(32); // 5 (int)
  print_int(type_binary_arith_result(tt, idFloat, idInt, OP_MOD)); __putchar__(32); // -1 (mod float)

  // comparisons
  print_int(type_binary_compare_result(tt, idInt, idFloat, OP_LT)); __putchar__(32); // bool
  print_int(type_binary_compare_result(tt, ptrInt, ptrByte, OP_EQ)); __putchar__(32); // bool
  print_int(type_binary_compare_result(tt, idBool, idBool, OP_EQ)); __putchar__(32); // bool
  print_int(type_binary_compare_result(tt, ptrInt, idInt, OP_EQ)); __putchar__(32); // -1

  // unary
  print_int(type_unary_result(tt, idInt, UOP_NEG)); __putchar__(32); // int
  print_int(type_unary_result(tt, idBool, UOP_NEG)); __putchar__(32); // -1
  print_int(type_unary_result(tt, idInt, UOP_NOT)); __putchar__(32); // bool
  print_int(type_unary_result(tt, idBool, UOP_NOT)); __putchar__(32); // bool
  print_int(type_unary_result(tt, ptrFloat, UOP_DEREF)); __putchar__(32); // float
  print_int(type_unary_result(tt, idInt, UOP_DEREF)); __putchar__(10); // -1
}
`
  return compileAndRunWithStdlib(source)
}

describe("Stage1 type rules helpers", () => {
  it("computes binary arithmetic and comparison result types", () => {
    const res = runRules()
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("5 4 9 9 -1 5 -1 1 1 1 -1 5 -1 1 1 4 -1")
  })
})
