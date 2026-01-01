import { runStage1ModuleCounts } from "../src/harness"

describe("Stage1 parser_full module counts", () => {
  it("counts funcs/imports/exports/structs", () => {
    const program = `
export def foo(a int) int { return a; }
def bar() int { return 0; }
import def ext0();
import def ext1(a int, b int);
export struct P { x int, y int }
struct Q { z int }
var g int = 1;
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

  it("handles empty module", () => {
    const res = runStage1ModuleCounts("")
    expect(res.status).toBe(0)
    const out = res.stdout.trim()
    expect(out).toBe("funcs=0 imports=0 exports=0 structs=0 vars=0")
  })
})
