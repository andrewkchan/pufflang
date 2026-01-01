import { runStage1ModuleSummary } from "../src/harness"

describe("Stage1 parser_full module summary", () => {
  it("parses functions with vars, if/else, while, and return", () => {
    const program = `
def main(a int, b int) int {
  var x = a + b;
  if (a) { print x; } else { print b; }
  x = x + 1;
  while (b) { b = b - 1; }
  for (i = 0; i < 3; i = i + 1) { print i; }
  break;
  continue;
  return x;
}
`

    const res = runStage1ModuleSummary(program)
    expect(res.status).toBe(0)

    const lines = res.stdout.trim().split("\n")
    expect(lines[0]).toMatch(/root=\d+ count=\d+/)
    const headerMatch = lines[0].match(/root=(\d+)\s+count=(\d+)/)
    expect(headerMatch).not.toBeNull()
    if (!headerMatch) return
    const count = Number(headerMatch[2])
    expect(lines.length - 1).toBe(count)

    const hasFunction = lines.some(
      (l) => l.includes("kind=FUNCTION") && l.includes("name=main") && l.includes("params=2") && l.includes("export=0")
    )
    expect(hasFunction).toBe(true)

    const hasVar = lines.some((l) => l.includes("kind=VAR_STMT") && l.includes("name=x"))
    expect(hasVar).toBe(true)

    const hasAssign = lines.some((l) => l.includes("kind=ASSIGN") && l.includes("name=x"))
    expect(hasAssign).toBe(true)

    const hasIf = lines.some((l) => l.includes("kind=IF") && l.includes("then=") && l.includes("else="))
    expect(hasIf).toBe(true)

    const hasWhile = lines.some((l) => l.includes("kind=WHILE") && l.includes("body="))
    expect(hasWhile).toBe(true)

    const hasFor = lines.some((l) => l.includes("kind=FOR") && l.includes("body="))
    expect(hasFor).toBe(true)

    const hasBreak = lines.some((l) => l.includes("kind=BREAK"))
    expect(hasBreak).toBe(true)

    const hasContinue = lines.some((l) => l.includes("kind=CONTINUE"))
    expect(hasContinue).toBe(true)

    const hasReturn = lines.some((l) => l.includes("kind=RETURN"))
    expect(hasReturn).toBe(true)
  })

  it("parses multiple functions and tracks export flags", () => {
    const program = `
export def foo(a int) int { return a; }
def bar() int { return 0; }
`

    const res = runStage1ModuleSummary(program)
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    expect(lines[0]).toMatch(/root=\d+ count=\d+/)

    const hasExportBlock = lines.some((l) => l.includes("export=1"))
    const hasFoo = lines.some(
      (l) => l.includes("kind=FUNCTION") && l.includes("name=foo") && l.includes("params=1") && l.includes("export=1")
    )
    const hasBar = lines.some(
      (l) => l.includes("kind=FUNCTION") && l.includes("name=bar") && l.includes("params=0") && l.includes("export=0")
    )
    expect(hasExportBlock).toBe(true)
    expect(hasFoo).toBe(true)
    expect(hasBar).toBe(true)
  })

  it("emits parameter names in summary", () => {
    const program = `
def alpha(a int, b int, c int) int { return a; }
def beta() int { return 0; }
`
    const res = runStage1ModuleSummary(program)
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    const alphaLine = lines.find((l) => l.includes("name=alpha"))
    const betaLine = lines.find((l) => l.includes("name=beta"))
    expect(alphaLine).toBeDefined()
    expect(betaLine).toBeDefined()
    expect(alphaLine).toContain("names=a,b,c")
    expect(betaLine).toContain("names=")
  })

  it("parses imported functions", () => {
    const program = `
import def ext0();
import def ext1(a int, b int);
def main() int { return 0; }
`
    const res = runStage1ModuleSummary(program)
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    expect(lines[0]).toMatch(/root=\d+ count=\d+/)
    const hasExt0 = lines.some((l) => l.includes("name=ext0") && l.includes("import=1") && l.includes("params=0"))
    const hasExt1 = lines.some((l) => l.includes("name=ext1") && l.includes("import=1") && l.includes("params=2"))
    const hasMain = lines.some((l) => l.includes("name=main") && l.includes("import=0"))
    expect(hasExt0).toBe(true)
    expect(hasExt1).toBe(true)
    expect(hasMain).toBe(true)
  })

  it("parses struct declarations with field count", () => {
    const program = `
export struct Point { x int, y int, z int }
struct Empty { }
def main() int { return 0; }
`
    const res = runStage1ModuleSummary(program)
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    const hasPoint = lines.some((l) => l.includes("kind=STRUCT_DECL") && l.includes("name=Point") && l.includes("fields=3") && l.includes("export=1") && l.includes("names=x,y,z"))
    const hasEmpty = lines.some((l) => l.includes("kind=STRUCT_DECL") && l.includes("name=Empty") && l.includes("fields=0") && l.includes("export=0") && l.includes("names="))
    expect(hasPoint).toBe(true)
    expect(hasEmpty).toBe(true)
  })

  it("parses top-level var declarations", () => {
    const program = `
var g = 1 + 2;
def main() { return g; }
`
    const res = runStage1ModuleSummary(program)
    expect(res.status).toBe(0)
    const lines = res.stdout.trim().split("\n")
    const hasGlobal = lines.some((l) => l.includes("kind=VAR_STMT") && l.includes("name=g"))
    expect(hasGlobal).toBe(true)
  })
})
