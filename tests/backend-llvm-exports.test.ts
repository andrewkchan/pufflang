import { compile } from "../src"
import { compileAndRun } from "../src/harness"

describe("LLVM backend exports and mangling", () => {
  test("exported function uses external linkage and unmangled name when unique", () => {
    const source = `
    export def foo(x int) int { return x + 1; }
    export var g = 3;
    def main() {
      print foo(g);
    }
    `
    const res = compile(source)
    expect(res.errors).toEqual([])
    const ir = res.program!
    expect(ir).toMatch(/define i32 @foo\(/)
    expect(ir).not.toMatch(/@foo__1\(/)
    expect(ir).toMatch(/@g = global/)
    expect(ir).not.toMatch(/@g = internal/)
    const run = compileAndRun(source)
    expect(run.status).toBe(0)
    expect(run.stderr).toBe("")
    expect(run.stdout.trim()).toBe("4")
  })

  test("exported overloaded functions remain mangled but external", () => {
    const source = `
    export def bar(x int) int { return x + 1; }
    export def bar(x int, y int) int { return x + y; }
    def main() {
      print bar(2);
      print bar(2, 3);
    }
    `
    const res = compile(source)
    expect(res.errors).toEqual([])
    const ir = res.program!
    expect(ir).toMatch(/define i32 @bar__1\(/)
    expect(ir).toMatch(/define i32 @bar__2\(/)
    expect(ir).not.toMatch(/define internal .*@bar__1/)
    expect(ir).not.toMatch(/define internal .*@bar__2/)
    const run = compileAndRun(source)
    expect(run.status).toBe(0)
    expect(run.stderr).toBe("")
    const lines = run.stdout.trim().split("\n")
    expect(lines).toEqual(["3", "5"])
  })

  test("non-exported function/global use internal linkage and mangled name", () => {
    const source = `
    def foo(x int) int { return x + 2; }
    var g = 5;
    def main() {
      print foo(g);
    }
    `
    const res = compile(source)
    expect(res.errors).toEqual([])
    const ir = res.program!
    // function should be internal and mangled with arity suffix
    expect(ir).toMatch(/define internal i32 @foo__1\(/)
    expect(ir).not.toMatch(/define i32 @foo\(/)
    // global should be internal
    expect(ir).toMatch(/@g = internal global i32/)
    const run = compileAndRun(source)
    expect(run.status).toBe(0)
    expect(run.stderr).toBe("")
    expect(run.stdout.trim()).toBe("7")
  })
})
