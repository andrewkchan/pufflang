import { runStage1ModuleCounts } from "../src/harness"

describe("Stage1 parser_full module counts", () => {
  it("counts funcs/imports/exports/structs", () => {
    const program = `
export def foo(a) { return a; }
def bar() { return 0; }
import def ext0();
import def ext1(a, b);
export struct P { x; y; }
struct Q { z; }
var g = 1;
`
    const res = runStage1ModuleCounts(program)
    expect(res.status).toBe(0)
    const out = res.stdout.trim()
    expect(out).toMatch(/funcs=4/)
    expect(out).toMatch(/imports=2/)
    expect(out).toMatch(/exports=1/)
    expect(out).toMatch(/structs=2/)
    expect(out).toMatch(/vars=1/)
  })
})
