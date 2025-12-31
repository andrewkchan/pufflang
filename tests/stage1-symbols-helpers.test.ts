import fs from "fs"
import path from "path"
import { compileAndRunWithStdlib } from "../src/harness"

const symbolsSrc = fs.readFileSync(path.join(__dirname, "..", "stage1", "symbols.puff"), "utf8")

function runSymbols() {
  const source = `
${symbolsSrc}

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
  var st = symtab_new();
  // var duplicate
  var res1 = symtab_define_var(st, String{byte~(&"x"[0]), 1});
  st = res1.tab;
  var res2 = symtab_define_var(st, String{byte~(&"x"[0]), 1});
  print_int(res2.err); __putchar__(32);
  // shadow in inner scope
  st = symtab_enter(st);
  var res3 = symtab_define_var(st, String{byte~(&"x"[0]), 1});
  st = res3.tab;
  print_int(res3.err); __putchar__(32);
  st = symtab_exit(st);

  // function overloads
  var f1 = symtab_define_function(st, String{byte~(&"foo"[0]), 3}, 1);
  st = f1.tab;
  var f2 = symtab_define_function(st, String{byte~(&"foo"[0]), 3}, 2);
  st = f2.tab;
  var f3 = symtab_define_function(st, String{byte~(&"foo"[0]), 3}, 2); // duplicate arity
  print_int(f3.err); __putchar__(32);
  var f4 = symtab_define_function(st, String{byte~(&"foo"[0]), 3}, 3); // third overload rejected
  print_int(f4.err); __putchar__(32);
  print_int(symtab_overload_count(st, String{byte~(&"foo"[0]), 3})); __putchar__(10);
}
`
  return compileAndRunWithStdlib(source)
}

describe("Stage1 symbols helpers", () => {
  it("handles vars and overloads with depth", () => {
    const res = runSymbols()
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("1 0 1 1 2")
  })
})
