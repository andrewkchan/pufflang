import { compileAndRun } from "../src/harness"

const stdlibMap = `
var MAP_EMPTY int = -2147483648;
struct Map { data byte~, cap int, length int }
def map_new(cap int) Map {
  var c = cap;
  if (c < 8) { c = 8; }
  var pow = 8;
  while (pow < c) { pow = pow * 2; }
  c = pow;
  var data = __malloc__(c * 8);
  var i = 0;
  while (i < c) {
    var off = i * 8;
    (int~(data + off))~ = MAP_EMPTY;
    (int~(data + off + 4))~ = 0;
    i = i + 1;
  }
  return Map{data, c, 0};
}
def map_hash(k int, mask int) int { return (k * 2654435761) & mask; }
def map_resize(m Map, newCap int) Map {
  var nm = map_new(newCap);
  var i = 0;
  while (i < m.cap) {
    var off = i * 8;
    var k = (int~(m.data + off))~;
    if (k != MAP_EMPTY) {
      var v = (int~(m.data + off + 4))~;
      nm = map_put(nm, k, v);
    }
    i = i + 1;
  }
  __free__(m.data);
  return nm;
}
def map_load_too_high(m Map) int { if (m.length * 10 >= m.cap * 7) { return 1; } return 0; }
def map_put(m Map, key int, value int) Map {
  var mask = m.cap - 1;
  var idx = map_hash(key, mask);
  while (true) {
    var off = idx * 8;
    var k = (int~(m.data + off))~;
    if (k == MAP_EMPTY || k == key) {
      var newLen = m.length;
      if (k == MAP_EMPTY) { newLen = newLen + 1; }
      (int~(m.data + off))~ = key;
      (int~(m.data + off + 4))~ = value;
      var out = Map{m.data, m.cap, newLen};
      if (map_load_too_high(out) == 1) { return map_resize(out, m.cap * 2); }
      return out;
    }
    idx = (idx + 1) & mask;
  }
  return m;
}
def map_get(m Map, key int) int {
  var mask = m.cap - 1;
  var idx = map_hash(key, mask);
  var start = idx;
  while (true) {
    var off = idx * 8;
    var k = (int~(m.data + off))~;
    if (k == MAP_EMPTY) { return MAP_EMPTY; }
    if (k == key) { return (int~(m.data + off + 4))~; }
    idx = (idx + 1) & mask;
    if (idx == start) { return MAP_EMPTY; }
  }
  return MAP_EMPTY;
}
`

describe("stdlib map (int -> int)", () => {
  test("put/get basic and overwrite", () => {
    const source = `
    ${stdlibMap}
    def main() {
      var m = map_new(8);
      m = map_put(m, 1, 10);
      m = map_put(m, 2, 20);
      m = map_put(m, 3, 30);
      print map_get(m, 1);
      print map_get(m, 2);
      print map_get(m, 3);
      m = map_put(m, 2, 200);
      print map_get(m, 2);
      print map_get(m, 99); // not found sentinel
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n")
    expect(lines).toEqual(["10", "20", "30", "200", "-2147483648"])
  })

  test("resizes and retains entries", () => {
    const source = `
    ${stdlibMap}
    def main() {
      var m = map_new(4);
      var i = 0;
      while (i < 50) {
        m = map_put(m, i, i + 1000);
        i = i + 1;
      }
      var ok = 1;
      var j = 0;
      while (j < 50) {
        var v = map_get(m, j);
        if (v != j + 1000) { ok = 0; }
        j = j + 1;
      }
      print m.cap;
      print m.length;
      print ok;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.trim().split("\n").map((x) => parseInt(x, 10))
    expect(lines[0]).toBeGreaterThanOrEqual(64)
    expect(lines[1]).toBe(50)
    expect(lines[2]).toBe(1)
  })
})
