import { runSource } from '../src/runtime'

describe('IO builtins', () => {
  test('stdout_write emits bytes', async () => {
    const result = await runSource(`
    def main() {
      var msg = "hi";
      __stdout_write__(&msg[0], len(msg));
    }
    `)
    expect(result.output).toBe("hi")
  })

  test('stdin_read consumes provided stdin', async () => {
    const result = await runSource(`
    def main() {
      var buf = [byte(0); 4];
      var n = __stdin_read__(&buf[0], len(buf));
      print n;
      print buf;
    }
    `, { stdin: "abcd" })
    expect(result.output.trim()).toBe(["4", "abcd"].join("\n"))
  })

  test('read_file and write_file round trip', async () => {
    const files = new Map<string, Buffer>()
    const result = await runSource(`
    def main() {
      var path = "file.txt";
      var data = "abc";
      var wrote = __write_file__(&path[0], len(path), &data[0], len(data));
      var buf = [byte(0); 3];
      var read = __read_file__(&path[0], len(path), &buf[0], len(buf));
      print wrote;
      print read;
      print buf;
    }
    `, {
      fs: {
        readFileSync: (p: string) => {
          const data = files.get(p)
          if (!data) throw new Error("missing file")
          return data
        },
        writeFileSync: (p: string, data: Buffer) => {
          files.set(p, data)
        }
      }
    })
    expect(files.get("file.txt")?.toString()).toBe("abc")
    expect(result.output.trim()).toBe(["3", "3", "abc"].join("\n"))
  })

  test('args_count and args_get expose argv', async () => {
    const result = await runSource(`
    def main() {
      var buf = [byte(0); 5];
      var wrote = __args_get__(0, &buf[0], len(buf));
      print __args_count__();
      print wrote;
      print buf;
    }
    `, { args: ["hello"] })
    expect(result.output.trim()).toBe(["1", "5", "hello"].join("\n"))
  })

  test('cat example reads file from fs', async () => {
    const fs = require('fs')
    const os = require('os')
    const path = require('path')
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'puff-io-'))
    const filePath = path.join(tmpdir, 'in.txt')
    fs.writeFileSync(filePath, 'xyz')
    const catSource = fs.readFileSync(path.resolve(__dirname, '..', 'examples', 'cat.puff'), 'utf8')
    const result = await runSource(catSource, { args: [filePath] })
    expect(result.output).toBe('xyz')
  })

  test('echo example reads stdin', async () => {
    const fs = require('fs')
    const path = require('path')
    const echoSource = fs.readFileSync(path.resolve(__dirname, '..', 'examples', 'echo.puff'), 'utf8')
    const result = await runSource(echoSource, { stdin: 'hello\n' })
    expect(result.output).toBe('hello\n')
  })
})
