import fs from "fs"
import path from "path"
import os from "os"
import { compileAndRun } from "../src/harness"

const stdlib = `
struct Buffer { data byte~, length int }
struct VecByte { data byte~, length int, cap int }
struct PopByte { vec VecByte, value byte }
struct VecInt { data int~, length int, cap int }
struct PopInt { vec VecInt, value int }
struct String { data byte~, length int }
struct StringBuilder { buf VecByte }

def vecbyte_new(cap int) VecByte {
  var c = cap;
  if (c < 1) { c = 1; }
  var data = __malloc__(c);
  return VecByte{data, 0, c};
}

def vecbyte_reserve(v VecByte, need int) VecByte {
  if (need <= v.cap) { return v; }
  var newCap = v.cap * 2;
  if (newCap < need) { newCap = need; }
  var newData = __malloc__(newCap);
  var i = 0;
  while (i < v.length) {
    (newData + i)~ = (v.data + i)~;
    i = i + 1;
  }
  __free__(v.data);
  return VecByte{newData, v.length, newCap};
}

def vecbyte_push(v VecByte, x byte) VecByte {
  var out = vecbyte_reserve(v, v.length + 1);
  (out.data + out.length)~ = x;
  out.length = out.length + 1;
  return out;
}

def vecbyte_pop(v VecByte) PopByte {
  var out = v;
  out.length = out.length - 1;
  var val = (out.data + out.length)~;
  return PopByte{out, val};
}

def vecint_new(cap int) VecInt {
  var c = cap;
  if (c < 1) { c = 1; }
  var data = int~(__malloc__(c * 4));
  return VecInt{data, 0, c};
}

def vecint_reserve(v VecInt, need int) VecInt {
  if (need <= v.cap) { return v; }
  var newCap = v.cap * 2;
  if (newCap < need) { newCap = need; }
  var newData = int~(__malloc__(newCap * 4));
  var src = byte~(v.data);
  var dst = byte~(newData);
  var i = 0;
  while (i < v.length) {
    var off = i * 4;
    (int~(dst + off))~ = (int~(src + off))~;
    i = i + 1;
  }
  __free__(byte~(v.data));
  return VecInt{newData, v.length, newCap};
}

def vecint_push(v VecInt, x int) VecInt {
  var out = vecint_reserve(v, v.length + 1);
  var base = byte~(out.data);
  var off = out.length * 4;
  (int~(base + off))~ = x;
  out.length = out.length + 1;
  return out;
}

def vecint_pop(v VecInt) PopInt {
  var out = v;
  out.length = out.length - 1;
  var base = byte~(out.data);
  var off = out.length * 4;
  var val = (int~(base + off))~;
  return PopInt{out, val};
}

def vecint_get(v VecInt, idx int) int {
  var base = byte~(v.data);
  var off = idx * 4;
  return (int~(base + off))~;
}

def sb_new() StringBuilder {
  return StringBuilder{vecbyte_new(16)};
}

def sb_append_byte(sb StringBuilder, b byte) StringBuilder {
  var buf = vecbyte_push(sb.buf, b);
  return StringBuilder{buf};
}

def sb_append_bytes(sb StringBuilder, data byte~, n int) StringBuilder {
  var out = sb;
  var i = 0;
  while (i < n) {
    out = sb_append_byte(out, (data + i)~);
    i = i + 1;
  }
  return out;
}

def sb_to_string(sb StringBuilder) String { return String{sb.buf.data, sb.buf.length}; }
def write_file_all(path byte~, data byte~, length int) int {
  var fd = __open__(path, 577, 420);
  if (fd < 0) { return -1; }
  var written = 0;
  while (written < length) {
    var n = __write__(fd, data + written, length - written);
    if (n <= 0) { __close__(fd); return -1; }
    written = written + n;
  }
  __close__(fd);
  return written;
}
def read_file_all(path byte~) Buffer {
  var fd = __open__(path, 0, 0);
  if (fd < 0) {
    var dummy = __malloc__(1);
    return Buffer{dummy, 0};
  }
  var tmp = __malloc__(1024);
  var buf = __malloc__(1024);
  var cap = 1024;
  var length = 0;
  while (true) {
    var n = __read__(fd, tmp, 1024);
    if (n <= 0) { break; }
    while (length + n > cap) {
      var newCap = cap * 2;
      var newBuf = __malloc__(newCap);
      var i = 0;
      while (i < length) {
        (newBuf + i)~ = (buf + i)~;
        i = i + 1;
      }
      __free__(buf);
      buf = newBuf;
      cap = newCap;
    }
    var j = 0;
    while (j < n) {
      (buf + length + j)~ = (tmp + j)~;
      j = j + 1;
    }
    length = length + n;
  }
  __close__(fd);
  __free__(tmp);
  return Buffer{buf, length};
}
`

describe("stdlib helpers: Vec/Strings/files", () => {
  test("VecByte push/pop and indexing", () => {
    const source = `
    ${stdlib}
    def main() {
      var v = vecbyte_new(2);
      v = vecbyte_push(v, byte(1));
      v = vecbyte_push(v, byte(2));
      v = vecbyte_push(v, byte(3));
      print v.length;
      print v.data~;
      print (v.data + 1)~;
      var pop = vecbyte_pop(v);
      v = pop.vec;
      print pop.value;
      print v.length;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim().split("\n")).toEqual(["3", "1", "2", "3", "2"])
  })

  test("VecInt push/pop and values", () => {
    const source = `
    ${stdlib}
    def main() {
      var v = vecint_new(1);
      v = vecint_push(v, 10);
      v = vecint_push(v, 20);
      v = vecint_push(v, 30);
      print v.length;
      print vecint_get(v, 0);
      print vecint_get(v, 1);
      var pop = vecint_pop(v);
      v = pop.vec;
      print pop.value;
      print v.length;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim().split("\n")).toEqual(["3", "10", "20", "30", "2"])
  })

  test("StringBuilder appends strings and bytes", () => {
    const source = `
    ${stdlib}
    def main() {
      var sb = sb_new();
      var lit = "hi";
      sb = sb_append_bytes(sb, byte~(&lit[0]), len(lit));
      sb = sb_append_byte(sb, byte(33)); // '!'
      var s = sb_to_string(sb);
      print s.length;
      print s.data~;
      print (s.data + 1)~;
      print (s.data + 2)~;
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    expect(res.stdout.trim().split("\n")).toEqual(["3", "104", "105", "33"])
  })

  test("read_file_all / write_file_all round trip", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "puff-stdlib-"))
    const inPath = path.join(tmp, "in.txt")
    const outPath = path.join(tmp, "out.txt")
    fs.writeFileSync(inPath, "hello-stdlib\n", "utf8")
    const source = `
    ${stdlib}
    def main() {
      var inpath = "${inPath}\0";
      var outpath = "${outPath}\0";
      var buf = read_file_all(byte~(&inpath[0]));
      print buf.length;
      var wrote = write_file_all(byte~(&outpath[0]), buf.data, buf.length);
      print wrote;
      var buf2 = read_file_all(byte~(&outpath[0]));
      print buf2.length;
      // echo contents to stdout to check correctness
      __write__(1, buf2.data, buf2.length);
    }
    `
    const res = compileAndRun(source)
    expect(res.status).toBe(0)
    expect(res.stderr).toBe("")
    const lines = res.stdout.split("\n")
    const nums = lines.filter((l) => /^\d+$/.test(l))
    expect(nums.slice(0, 3)).toEqual(["13", "13", "13"])
    const content = lines.filter((l) => l !== "" && !/^\d+$/.test(l)).join("\n")
    expect(content).toBe("hello-stdlib")
  })
})
