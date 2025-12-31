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
})
