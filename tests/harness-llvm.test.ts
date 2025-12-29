import { runRawIR } from "../src/harness"

describe("LLVM harness", () => {
  test("can compile and run raw IR via clang", () => {
    const ir = `
    @.str = private constant [6 x i8] c"hello\\00"
    declare i32 @puts(i8*)
    define i32 @main() {
      %strptr = getelementptr [6 x i8], [6 x i8]* @.str, i64 0, i64 0
      call i32 @puts(i8* %strptr)
      ret i32 0
    }
    `
    const res = runRawIR(ir)
    expect(res.status).toBe(0)
    expect(res.stdout).toBe("hello\n")
    expect(res.stderr).toBe("")
  })
})
