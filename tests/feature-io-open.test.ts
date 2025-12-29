import { compileAndRun } from "../src/harness"
import fs from "fs"

const TMP_PATH = "/tmp/puff-io-test.txt"

describe("I/O builtins - open/close with read/write", () => {
  test("write then read back", () => {
    try {
      fs.unlinkSync(TMP_PATH)
    } catch {}
    const source = `
    def main() {
      var path = "${TMP_PATH}";
      var msg [byte; 3] = [byte(104), byte(105), byte(10)];
      var fd = __open__(byte~(&path[0]), 577, 420); // O_WRONLY|O_CREAT|O_TRUNC, 0644
      __write__(fd, byte~(&msg[0]), 3);
      __close__(fd);
      var buf = [0; 8];
      fd = __open__(byte~(&path[0]), 0, 0); // O_RDONLY
      var n = __read__(fd, byte~(&buf[0]), 8);
      __close__(fd);
      __write__(1, byte~(&buf[0]), n);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout).toBe("hi\n")
  })
})

