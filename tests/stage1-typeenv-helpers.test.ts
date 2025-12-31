import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const typesSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "types.puff"), "utf8")
const layoutSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "structlayout.puff"), "utf8")
const envSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "typeenv.puff"), "utf8")

function runEnv() {
  const source = `
${typesSrc}
${layoutSrc}
${envSrc}

def print_int(x int) {
  if (x == 0) { __putchar__(48); return; }
  var n = x; var buf = vecbyte_new(16); if (n < 0) { __putchar__(45); n = 0 - n; }
  while (n > 0) { buf = vecbyte_push(buf, byte(48 + (n % 10))); n = n / 10; }
  var i = buf.length - 1; while (i >= 0) { __putchar__(int((buf.data + i)~)); i = i - 1; }
}

def main() {
  var env = typeenv_new();
  var tt = env.tt;
  var idInt = 5;
  var idByte = 2;
  var ptrInt = tt.types.length; tt = typetable_make_pointer(tt, idInt);
  var arrByte4 = tt.types.length; tt = typetable_make_array(tt, idByte, 4);
  // sync env.tt with new entries
  env = TypeEnv{tt, env.structSizes};

  var fields = vecint_new(4);
  fields = vecint_push(fields, idInt);     // 4 bytes
  fields = vecint_push(fields, arrByte4);  // 4 bytes
  fields = vecint_push(fields, ptrInt);    // 4 bytes
  fields = vecint_push(fields, idByte);    // 1 byte

  var res = typeenv_define_struct(env, fields);
  env = res.env;
  print_int(res.err); __putchar__(32);          // 0
  print_int(res.typeId); __putchar__(32);       // struct type id
  print_int(res.size); __putchar__(32);         // 13
  print_int(res.offsets.length); __putchar__(32); // 4
  var i = 0;
  while (i < res.offsets.length) {
    print_int(vecint_get(res.offsets, i));
    if (i + 1 < res.offsets.length) { __putchar__(32); }
    i = i + 1;
  }
  __putchar__(32);
  // type_sizeof should use structSizes
  print_int(type_sizeof(env.tt, res.typeId, env.structSizes)); __putchar__(32); // 13

  // Verify typetable entry is struct with correct structId
  var t = typetable_get(env.tt, res.typeId);
  print_int(t.category); __putchar__(32); // TYPECATEGORY_STRUCT (7)
  print_int(t.structId); __putchar__(10); // 0

  // invalid: void field
  var badFields = vecint_new(1);
  badFields = vecint_push(badFields, 8); // void
  var res2 = typeenv_define_struct(env, badFields);
  print_int(res2.err); __putchar__(32);
  print_int(res2.typeId); __putchar__(32);
  print_int(res2.size); __putchar__(10);
}
`
  return compileAndRunWithStdlib(source)
}

describe("Stage1 type env helpers", () => {
  it("defines structs, records sizes, and rejects invalid fields", () => {
    const res = runEnv()
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("0 11 13 4 0 4 8 12 13 7 0\n1 -1 -1")
  })
})
