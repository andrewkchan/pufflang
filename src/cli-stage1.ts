import fs from "fs"
import path from "path"
import { runStage1CompileToIr, runRawIR } from "./harness"

function printUsage() {
  console.error(
    [
      "Usage: ts-node src/cli-stage1.ts [--emit-ir <file>] [--run] <input.puff>",
      "  --emit-ir <file>   Write generated LLVM IR to the given path",
      "  --run              After generating IR, build and run the binary",
      "If neither flag is provided, IR is printed to stdout."
    ].join("\n")
  )
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    // If no file provided, read from stdin.
    const source = fs.readFileSync(0, "utf8")
    compileAndMaybeRun(source, null, false)
    return
  }

  let emitIrPath: string | null = null
  let runBinary = false
  let inputPath: string | null = null

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--emit-ir") {
      if (i + 1 >= args.length) {
        console.error("Missing argument for --emit-ir")
        process.exit(1)
      }
      emitIrPath = args[i + 1]
      i++
      continue
    }
    if (a === "--run") {
      runBinary = true
      continue
    }
    inputPath = a
  }

  if (!inputPath) {
    printUsage()
    process.exit(1)
  }

  let source: string
  if (!inputPath || inputPath === "-") {
    source = fs.readFileSync(0, "utf8")
  } else {
    const absPath = path.resolve(inputPath)
    if (!fs.existsSync(absPath)) {
      console.error(`Input file not found: ${absPath}`)
      process.exit(1)
    }
    source = fs.readFileSync(absPath, "utf8")
  }

  compileAndMaybeRun(source, emitIrPath, runBinary)
}

function compileAndMaybeRun(source: string, emitIrPath: string | null, runBinary: boolean) {
  const irRes = runStage1CompileToIr(source)
  if (irRes.status !== 0) {
    process.stderr.write(irRes.stderr || "")
    process.stdout.write(irRes.stdout || "")
    process.exit(irRes.status)
  }

  const ir = irRes.stdout

  if (emitIrPath) {
    fs.writeFileSync(emitIrPath, ir, "utf8")
  }

  if (runBinary) {
    const binRes = runRawIR(ir)
    process.stdout.write(binRes.stdout || "")
    if (binRes.stderr) {
      process.stderr.write(binRes.stderr)
    }
    process.exit(binRes.status)
  }

  if (!emitIrPath) {
    process.stdout.write(ir)
  }
}

main()
