import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const typesSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "types.puff"), "utf8")
const layoutSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "structlayout.puff"), "utf8")

function runLayout() {
  const source = `
${typesSrc}
${layoutSrc}

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
  var ptrInt = tt.types.length; tt = typetable_make_pointer(tt, idInt); // size 4
  var arrByte3 = tt.types.length; tt = typetable_make_array(tt, idByte, 3); // size 3
  var idStruct = tt.types.length; tt = TypeTable{typetable_push_raw(tt.types, Type{TYPECATEGORY_STRUCT, -1, 0, 0})}; // structId=0

  var fields = vecint_new(4);
  fields = vecint_push(fields, idInt);
  fields = vecint_push(fields, arrByte3);
  fields = vecint_push(fields, ptrInt);
  fields = vecint_push(fields, idStruct);

  var structSizes = vecint_new(1);
  structSizes = vecint_push(structSizes, 12); // size of structId 0

  // validate elements
  print_int(struct_validate_fields(tt, fields)); __putchar__(32); // 1

  var res = struct_compute_layout(tt, fields, structSizes);
  print_int(res.err); __putchar__(32);   // 0
  print_int(res.size); __putchar__(32);  // 23
  print_int(res.offsets.length); __putchar__(32); // 4
  var i = 0;
  while (i < res.offsets.length) {
    print_int(vecint_get(res.offsets, i));
    if (i + 1 < res.offsets.length) { __putchar__(32); }
    i = i + 1;
  }
  __putchar__(10);

  // failure case: invalid (error) type
  var badFields = vecint_new(1);
  badFields = vecint_push(badFields, 3); // TYPECATEGORY_ERROR id
  print_int(struct_validate_fields(tt, badFields)); __putchar__(32); // 1 (error allowed for now)
  var badRes = struct_compute_layout(tt, badFields, structSizes);
  print_int(badRes.err); __putchar__(32); // 1
  print_int(badRes.size); __putchar__(32); // -1
  print_int(badRes.offsets.length); __putchar__(10); // 0
}
`
  return compileAndRunWithStdlib(source)
}

describe("Stage1 struct layout helpers", () => {
  it("computes offsets and sizes, and reports failures", () => {
    const res = runLayout()
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("1 0 23 4 0 4 7 11\n1 1 -1 0")
  })
})
