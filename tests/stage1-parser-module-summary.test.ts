import { runStage1ModuleSummary } from "../src/harness"

describe("Stage1 parser_full module summary", () => {
  it("parses functions with vars, if/else, while, and return", () => {
    const program = `
def main(a, b) {
  var x = a + b;
  if (a) { print x; } else { print b; }
  while (b) { b = b - 1; }
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

    const hasIf = lines.some((l) => l.includes("kind=IF") && l.includes("then=") && l.includes("else="))
    expect(hasIf).toBe(true)

    const hasWhile = lines.some((l) => l.includes("kind=WHILE") && l.includes("body="))
    expect(hasWhile).toBe(true)

    const hasReturn = lines.some((l) => l.includes("kind=RETURN"))
    expect(hasReturn).toBe(true)
  })
})
