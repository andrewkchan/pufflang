import fs from 'fs'
import { compile } from '../index'
import { UTF8Codec } from './util'

// wabt is a factory function that returns a promise. Cache the instance.
let wabtInstance: any = null
async function getWabt(): Promise<any> {
  if (wabtInstance) return wabtInstance
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const wabtFactory = require('wabt')
  wabtInstance = await wabtFactory()
  return wabtInstance
}

export async function watToWasm(wat: string): Promise<Uint8Array> {
  const wabt = await getWabt()
  const parsed = wabt.parseWat('module.wat', wat)
  parsed.resolveNames()
  parsed.validate()
  const { buffer } = parsed.toBinary({ log: false })
  return buffer
}

export async function compileSourceToWasm(source: string): Promise<Uint8Array> {
  const result = compile(source)
  if (result.errors.length > 0 || !result.program) {
    throw new Error(`Compilation failed:\n${result.errors.join('\n')}`)
  }
  return watToWasm(result.program)
}

export interface HostOptions {
  args?: string[]
  stdin?: Uint8Array | Buffer | string
  stdout?: (chunk: string | Uint8Array) => void
  stderr?: (chunk: string) => void
  fs?: {
    readFileSync(path: string): Buffer
    writeFileSync(path: string, data: Buffer): void
  }
}

function normalizeBuffer(data: Uint8Array | Buffer | string | undefined): Uint8Array {
  if (data === undefined) return new Uint8Array()
  if (typeof data === 'string') return new TextEncoder().encode(data)
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

export interface Instantiated {
  instance: WebAssembly.Instance
  memory: WebAssembly.Memory
  getOutput: () => string
}

export interface RunResult {
  output: string
  instance: WebAssembly.Instance
  memory: WebAssembly.Memory
}

export async function instantiateWithHost(
  wasm: Uint8Array,
  opts: HostOptions = {}
): Promise<Instantiated> {
  const codec = new UTF8Codec()
  const stdoutCollector: Array<string | Uint8Array> = []
  const writeStdout = opts.stdout ?? ((chunk: string | Uint8Array) => stdoutCollector.push(chunk))
  const stdinBuf = normalizeBuffer(opts.stdin)
  let stdinOffset = 0
  const fsImpl = opts.fs ?? {
    readFileSync: fs.readFileSync,
    writeFileSync: fs.writeFileSync,
  }
  const args = opts.args ?? []

  let memory: WebAssembly.Memory | null = null

  const ioImports = {
    log: (x: any) => {
      writeStdout(String(x) + '\n')
    },
    putchar: (x: number) => {
      writeStdout(codec.decodeASCIIChar(x))
    },
    putf: (x: number) => {
      writeStdout(String(x))
    },
    puti: (x: number) => {
      writeStdout(String(x))
    },
    flush: () => {
      writeStdout('\n')
    },
    stdin_read: (dst: number, len: number) => {
      if (!memory) return -1
      const remaining = stdinBuf.length - stdinOffset
      if (remaining <= 0) return 0
      const toRead = Math.min(len, remaining)
      const view = new Uint8Array(memory.buffer, dst, toRead)
      view.set(stdinBuf.subarray(stdinOffset, stdinOffset + toRead))
      stdinOffset += toRead
      return toRead
    },
    stdout_write: (src: number, len: number) => {
      if (!memory) return -1
      const view = new Uint8Array(memory.buffer, src, len)
      const copy = new Uint8Array(view)
      writeStdout(copy)
      return len
    },
    read_file: (pathPtr: number, pathLen: number, dst: number, dstLen: number) => {
      if (!memory) return -1
      const pathBytes = new Uint8Array(memory.buffer, pathPtr, pathLen)
      const path = new TextDecoder().decode(pathBytes)
      try {
        const data = fsImpl.readFileSync(path)
        const toCopy = Math.min(dstLen, data.length)
        const dstView = new Uint8Array(memory.buffer, dst, toCopy)
        dstView.set(new Uint8Array(data.slice(0, toCopy)))
        return toCopy
      } catch (err) {
        const stderr = opts.stderr ?? (() => {})
        stderr(String(err))
        return -1
      }
    },
    write_file: (pathPtr: number, pathLen: number, src: number, srcLen: number) => {
      if (!memory) return -1
      const pathBytes = new Uint8Array(memory.buffer, pathPtr, pathLen)
      const path = new TextDecoder().decode(pathBytes)
      const srcView = new Uint8Array(memory.buffer, src, srcLen)
      try {
        fsImpl.writeFileSync(path, Buffer.from(srcView))
        return srcLen
      } catch (err) {
        const stderr = opts.stderr ?? (() => {})
        stderr(String(err))
        return -1
      }
    },
    args_count: () => args.length,
    args_get: (index: number, dst: number, dstLen: number) => {
      if (!memory) return -1
      if (index < 0 || index >= args.length) return -1
      const encoded = new TextEncoder().encode(args[index])
      const toCopy = Math.min(dstLen, encoded.length)
      const dstView = new Uint8Array(memory.buffer, dst, toCopy)
      dstView.set(encoded.subarray(0, toCopy))
      return toCopy
    },
  }

  const instantiateResult: any = await WebAssembly.instantiate(wasm, { io: ioImports })
  const instance: WebAssembly.Instance =
    'instance' in instantiateResult ? instantiateResult.instance : instantiateResult
  memory = (instance.exports as any).memory as WebAssembly.Memory

  const getOutput = () =>
    stdoutCollector
      .map((chunk) => (typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)))
      .join('')

  return { instance, memory, getOutput }
}

export async function runWasm(
  wasm: Uint8Array,
  opts: HostOptions = {}
): Promise<RunResult> {
  const instantiated = await instantiateWithHost(wasm, opts)
  const exports = instantiated.instance.exports as any
  if (exports.__init_globals__) {
    exports.__init_globals__()
  }
  if (exports.main) {
    exports.main()
  }
  return {
    output: instantiated.getOutput(),
    instance: instantiated.instance,
    memory: instantiated.memory,
  }
}

export async function runSource(
  source: string,
  opts: HostOptions = {}
): Promise<RunResult> {
  const wasm = await compileSourceToWasm(source)
  return runWasm(wasm, opts)
}
