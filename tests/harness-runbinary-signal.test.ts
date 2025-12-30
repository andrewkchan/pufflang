import { runBinary } from "../src/harness"

describe("runBinary signal handling", () => {
  test("returns non-zero status when process is signaled", () => {
    // Use /bin/sh to self-signal with SIGSEGV; spawnSync reports status=null and signal="SIGSEGV".
    const res = runBinary("/bin/sh", undefined, undefined, ["-c", "kill -SEGV $$"])
    expect(res.status).toBeGreaterThanOrEqual(128)
    expect(res.stdout).toBeDefined()
    expect(res.stderr).toBeDefined()
  })
})
