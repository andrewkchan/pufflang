#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { compile } from '../index'
import { compileSourceToWasm, runWasm, watToWasm } from './runtime'

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('puff')
    .command(
      'run <file>',
      'Compile and run a Puffscript program',
      (y) =>
        y
          .positional('file', { type: 'string', desc: 'Source file to execute' })
          .option('emit-wat', { type: 'string', desc: 'Write WAT output to file' })
          .option('emit-wasm', { type: 'string', desc: 'Write WASM output to file' })
          .option('args', { type: 'array', desc: 'Arguments to pass to program', default: [] })
          .option('stdin', { type: 'string', desc: 'String to feed to stdin' }),
    )
    .command(
      'build <file>',
      'Compile a Puffscript program to WASM',
      (y) =>
        y
          .positional('file', { type: 'string', desc: 'Source file to compile' })
          .option('out-wat', { type: 'string', desc: 'Write WAT output to file' })
          .option('out-wasm', { type: 'string', desc: 'Write WASM output to file' }),
    )
    .demandCommand(1)
    .help()
    .parse()

  const command = argv._[0]
  if (command === 'run') {
    const file = path.resolve(String(argv.file))
    const source = fs.readFileSync(file, 'utf8')
    const compileResult = compile(source)
    if (compileResult.errors.length > 0 || !compileResult.program) {
      console.error('Compilation failed:\n' + compileResult.errors.join('\n'))
      process.exit(1)
    }

    if (argv['emit-wat']) {
      fs.writeFileSync(String(argv['emit-wat']), compileResult.program, 'utf8')
    }
    let wasm = await watToWasm(compileResult.program)
    if (argv['emit-wasm']) {
      fs.writeFileSync(String(argv['emit-wasm']), Buffer.from(wasm))
    }

    const { output } = await runWasm(wasm, {
      args: (argv.args as string[]).map(String),
      stdin: argv.stdin ? String(argv.stdin) : undefined,
      stdout: (chunk) => {
        if (typeof chunk === 'string') {
          process.stdout.write(chunk)
        } else {
          process.stdout.write(Buffer.from(chunk))
        }
      },
      stderr: (chunk) => {
        process.stderr.write(chunk + '\n')
      },
    })

    // ensure we flush any buffered newline-only writes
    if (output && output.length > 0) {
      // already emitted via stdout callback above, nothing to do
    }
  } else if (command === 'build') {
    const file = path.resolve(String(argv.file))
    const source = fs.readFileSync(file, 'utf8')
    const compileResult = compile(source)
    if (compileResult.errors.length > 0 || !compileResult.program) {
      console.error('Compilation failed:\n' + compileResult.errors.join('\n'))
      process.exit(1)
    }
    if (argv['out-wat']) {
      fs.writeFileSync(String(argv['out-wat']), compileResult.program, 'utf8')
    }
    const wasm = await compileSourceToWasm(source)
    if (argv['out-wasm']) {
      fs.writeFileSync(String(argv['out-wasm']), Buffer.from(wasm))
    } else {
      // default to stdout
      process.stdout.write(Buffer.from(wasm))
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
