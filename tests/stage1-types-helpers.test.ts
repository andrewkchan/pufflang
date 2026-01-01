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
    expect(res.stdout.trim()).toBe("1 1 1 0 0 1 1")
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

  it("checks cast and coerce rules", () => {
    const source = `
${typesSrc}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x;
  var buf = vecbyte_new(16);
  if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) { buf = vecbyte_push(buf, byte(48 + (n % 10))); n = n / 10; }
  var i = buf.length - 1;
  while (i >= 0) { __putchar__(int((buf.data + i)~)); i = i - 1; }
}

def main() {
  var tt = typetable_new();
  var idByte = 2;
  var idInt = 5;
  var idFloat = 4;
  var idBool = 1;
  var ptrInt = tt.types.length; tt = typetable_make_pointer(tt, idInt);
  var ptrByte = tt.types.length; tt = typetable_make_pointer(tt, idByte);
  var arrByte3 = tt.types.length; tt = typetable_make_array(tt, idByte, 3);

  // can_cast
  print_int(type_can_cast(tt, idInt, idFloat)); __putchar__(32);  // 1
  print_int(type_can_cast(tt, idFloat, idByte)); __putchar__(32); // 1
  print_int(type_can_cast(tt, ptrInt, ptrByte)); __putchar__(32); // 1 (any pointer)
  print_int(type_can_cast(tt, idBool, idInt)); __putchar__(32);   // 1
  print_int(type_can_cast(tt, idInt, idBool)); __putchar__(32);   // 1

  // can_coerce
  print_int(type_can_coerce(tt, idByte, idInt)); __putchar__(32);   // 1
  print_int(type_can_coerce(tt, idInt, idByte)); __putchar__(32);   // 0
  print_int(type_can_coerce(tt, idFloat, idInt)); __putchar__(32);  // 0
  print_int(type_can_coerce(tt, idInt, idFloat)); __putchar__(32);  // 1
  print_int(type_can_coerce(tt, arrByte3, ptrByte)); __putchar__(32); //1
  print_int(type_can_coerce(tt, ptrInt, ptrByte)); __putchar__(10); //0
}
`
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("1 1 1 1 1 1 0 0 1 1 0")
  })

  it("computes lowest common numeric types", () => {
    const source = `
${typesSrc}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x; var buf = vecbyte_new(16); if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) { buf = vecbyte_push(buf, byte(48 + (n % 10))); n = n / 10; }
  var i = buf.length - 1; while (i >= 0) { __putchar__(int((buf.data + i)~)); i = i - 1; }
}

def main() {
  var tt = typetable_new();
  var idByte = 2;
  var idInt = 5;
  var idFloat = 4;

  print_int(type_lowest_common_numeric(tt, idByte, idInt)); __putchar__(32);   // 5
  print_int(type_lowest_common_numeric(tt, idInt, idFloat)); __putchar__(32); // 4
  print_int(type_lowest_common_numeric(tt, idByte, idFloat)); __putchar__(32); // 4
  print_int(type_lowest_common_numeric(tt, idByte, idByte)); __putchar__(32); // 2
  print_int(type_lowest_common_numeric(tt, idFloat, idFloat)); __putchar__(10); //4
}
`
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("5 4 4 2 4")
  })

  it("validates element types and sizeof", () => {
    const source = `
${typesSrc}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x; var buf = vecbyte_new(16); if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) { buf = vecbyte_push(buf, byte(48 + (n % 10))); n = n / 10; }
  var i = buf.length - 1; while (i >= 0) { __putchar__(int((buf.data + i)~)); i = i - 1; }
}

def main() {
  var tt = typetable_new();
  var idInt = 5;
  var idByte = 2;
  var idVoid = 8;
  var ptrInt = tt.types.length; tt = typetable_make_pointer(tt, idInt);
  var arrByte4 = tt.types.length; tt = typetable_make_array(tt, idByte, 4);
  var idStruct = tt.types.length;
  tt = TypeTable{typetable_push_raw(tt.types, Type{TYPECATEGORY_STRUCT, -1, 0, 0})};

  var structSizes = vecint_new(1);
  structSizes = vecint_push(structSizes, 12);

  print_int(type_is_valid_element_type(tt, idInt)); __putchar__(32);   // 1
  print_int(type_is_valid_element_type(tt, idVoid)); __putchar__(32);  // 0
  print_int(type_is_valid_element_type(tt, idStruct)); __putchar__(32);// 1

  print_int(type_sizeof(tt, idInt, structSizes)); __putchar__(32);     // 4
  print_int(type_sizeof(tt, ptrInt, structSizes)); __putchar__(32);    // 4
  print_int(type_sizeof(tt, arrByte4, structSizes)); __putchar__(32);  // 4
  print_int(type_sizeof(tt, idStruct, structSizes)); __putchar__(32);  // 12
  print_int(type_sizeof(tt, idVoid, structSizes)); __putchar__(32);    // 0
  print_int(type_sizeof(tt, 3, structSizes)); __putchar__(10);         // -1 (error type)
}
`
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("1 0 1 4 4 4 12 0 -1")
  })
})
