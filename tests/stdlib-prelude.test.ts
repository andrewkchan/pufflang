import { compileAndRunWithStdlib } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("stdlib prelude integration", () => {
  test("Vec/Map/StringBuilder from base prelude", () => {
    const source = `
    def main() {
      // VecByte
      var vb = vecbyte_new(2);
      vb = vecbyte_push(vb, byte(1));
      vb = vecbyte_push(vb, byte(2));
      print vb.length;

      // VecInt
      var vi = vecint_new(1);
      vi = vecint_push(vi, 10);
      vi = vecint_push(vi, 20);
      print vecint_get(vi, 0);
      print vecint_get(vi, 1);

      // StringBuilder
      var sb = sb_new();
      sb = sb_append_bytes(sb, "hi", 2);
      sb = sb_append_byte(sb, byte(33));
      var s = sb_to_string(sb);
      print s.length;

      // Map
      var m = map_new(4);
      m = map_put(m, 5, 50);
      print map_get(m, 5);
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual(["2", "10", "20", "3", "50"])
  })
})
