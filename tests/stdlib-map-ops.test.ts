import { compileAndRunWithStdlib } from "../src/harness"

const lines = (res: { stdout: string }) => res.stdout.trim().split("\n").map((s) => s.trim())

describe("stdlib map helpers (has/delete)", () => {
  test("has and delete maintain probe chains", () => {
    const source = `
    def main() {
      var m = map_new(8);
      m = map_put(m, 1, 10);
      m = map_put(m, 2, 20);
      m = map_put(m, 3, 30);
      m = map_put(m, 4, 40);
      m = map_put(m, 5, 50);
      print map_has(m, 1);
      print map_has(m, 6);
      m = map_delete(m, 3);
      print map_has(m, 3);
      print map_get(m, 3);
      print map_get(m, 2);
      print map_get(m, 4);
      print map_get(m, 5);
      m = map_delete(m, 99); // no-op
      print map_get(m, 5);
      print m.length;
    }
    `
    const res = compileAndRunWithStdlib(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(lines(res)).toEqual([
      "1",  // has 1
      "0",  // has 6
      "0",  // has 3 after delete
      "-2147483648", // get(3) sentinel
      "20",
      "40",
      "50",
      "50", // still present after delete noop
      "4"   // length decremented
    ])
  })
})
