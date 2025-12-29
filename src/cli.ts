#!/usr/bin/env node
import fs from "fs"
import { compile } from "./index"

function main() {
  const file = process.argv[2]
  if (!file) {
    console.error("Usage: puffc <source.ps>")
    process.exit(1)
  }
  const source = fs.readFileSync(file, "utf8")
  const result = compile(source)
  if (result.errors.length > 0 || result.program === null) {
    console.error("Compilation failed:")
    result.errors.forEach((e) => console.error(e))
    process.exit(1)
  }
  process.stdout.write(result.program)
}

main()
