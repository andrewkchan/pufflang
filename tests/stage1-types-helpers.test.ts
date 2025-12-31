import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const typesSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "types.puff"), "utf8")

function runTypes() {
  const source = `
${typesSrc}

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
  var tt = typetable_new();
  // builtin ids
  var idBool = 1;
  var idByte = 2;
  var idFloat = 4;
  var idInt = 5;
  var idVoid = 8;
  var idPtr = tt.types.length;
  tt = typetable_make_pointer(tt, idInt);
  var idArr = tt.types.length;
  tt = typetable_make_array(tt, idByte, 3);

  // Emit: numeric(bool? int? float?), scalar flags, and categories for constructed types.
  print_int(type_is_numeric(tt, idBool)); __putchar__(32);
  print_int(type_is_numeric(tt, idInt)); __putchar__(32);
  print_int(type_is_numeric(tt, idFloat)); __putchar__(32);
  print_int(type_is_numeric(tt, idVoid)); __putchar__(32);

  print_int(type_is_scalar(tt, idArr)); __putchar__(32);
  print_int(type_is_scalar(tt, idPtr)); __putchar__(32);
  print_int(type_is_scalar(tt, idInt)); __putchar__(10);
}
`
  return compileAndRunWithStdlib(source)
}

describe("Stage1 types helpers", () => {
  it("classifies numeric and scalar types", () => {
    const res = runTypes()
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("0 1 1 0 0 1 1")
  })

  it("compares types structurally", () => {
    const source = `
${typesSrc}

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
  var tt = typetable_new();
  var idInt = 5;
  var idFloat = 4;
  var idPtrInt = tt.types.length; tt = typetable_make_pointer(tt, idInt);
  var idPtrByte = tt.types.length; tt = typetable_make_pointer(tt, 2);
  var idArrInt3 = tt.types.length; tt = typetable_make_array(tt, idInt, 3);
  var idArrInt4 = tt.types.length; tt = typetable_make_array(tt, idInt, 4);
  var idArrByte3 = tt.types.length; tt = typetable_make_array(tt, 2, 3);

  print_int(type_equals(tt, idInt, idInt)); __putchar__(32);      // 1
  print_int(type_equals(tt, idInt, idFloat)); __putchar__(32);    // 0
  print_int(type_equals(tt, idPtrInt, idPtrInt)); __putchar__(32);// 1
  print_int(type_equals(tt, idPtrInt, idPtrByte)); __putchar__(32);//0
  print_int(type_equals(tt, idArrInt3, idArrInt3)); __putchar__(32);//1
  print_int(type_equals(tt, idArrInt3, idArrInt4)); __putchar__(32);//0
  print_int(type_equals(tt, idArrInt3, idArrByte3)); __putchar__(10);//0
}
`
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("1 0 1 0 1 0 0")
  })
})
