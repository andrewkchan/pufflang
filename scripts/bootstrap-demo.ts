import fs from 'fs'
import os from 'os'
import path from 'path'
import { compile } from '../index'
import { compileSourceToWasm, runWasm } from '../src/runtime'

async function main() {
  const repoRoot = path.resolve(__dirname, '..', '..')
  const samplePath = path.resolve(repoRoot, 'examples', 'cat.puff')
  const sampleSource = fs.readFileSync(samplePath, 'utf8')

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puff-bootstrap-'))
  const inputPath = path.join(tmpDir, 'input.txt')
  fs.writeFileSync(inputPath, 'bootstrap-echo\n')

  const compileResult = compile(sampleSource)
  if (compileResult.errors.length > 0 || !compileResult.program) {
    throw new Error(`Compilation failed:\n${compileResult.errors.join('\n')}`)
  }

  const wasm = await compileSourceToWasm(sampleSource)
  const { output } = await runWasm(wasm, { args: [inputPath] })

  process.stdout.write('Bootstrapping demo output:\n')
  process.stdout.write(output)
  process.stdout.write('\n')
  process.stdout.write(`Temp dir: ${tmpDir}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
