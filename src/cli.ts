#!/usr/bin/env node
import fs from "fs"
import path from "path"
import { compile } from "./index"
import { compileWithStdlib } from "./harness"

function main() {
  const args = process.argv.slice(2)
  const withStdlib = args.includes("--with-stdlib")
  const file = args.find((a) => !a.startsWith("-"))
  if (!file) {
    console.error("Usage: puffc [--with-stdlib] <source.puff>")
    process.exit(1)
  }
  const source = fs.readFileSync(path.resolve(file), "utf8")
  if (withStdlib) {
    const irPath = compileWithStdlib(source)
    const ir = fs.readFileSync(irPath, "utf8")
    process.stdout.write(ir)
    return
  }
  const result = compile(source)
  if (result.errors.length > 0 || result.program === null) {
    console.error("Compilation failed:")
    result.errors.forEach((e) => console.error(e))
    process.exit(1)
  }
  process.stdout.write(result.program)
}

main()
