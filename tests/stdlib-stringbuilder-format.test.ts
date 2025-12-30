import { compileAndRunWithStdlib } from "../src/harness"

const expectLines = (out: string) => out.trim().split("\n").map((s) => s.trim())

describe("stdlib StringBuilder formatting helpers", () => {
  test("append_int and append_hex", () => {
    const source = `
    def main() {
      var sb = sb_new();
      sb = sb_append_int(sb, 0);
      sb = sb_append_byte(sb, byte(44)); // ','
      sb = sb_append_int(sb, -12345);
      sb = sb_append_byte(sb, byte(44));
      sb = sb_append_int(sb, 67890);
      sb = sb_append_byte(sb, byte(44));
      sb = sb_append_hex(sb, 0x1af, 6); // 0001af
      sb = sb_append_byte(sb, byte(44));
      sb = sb_append_hex(sb, 0, 4); // 0000
      var s = sb_to_string(sb);
      __write__(1, s.data, s.length);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim()).toBe("0,-12345,67890,0001af,0000")
  })
})
