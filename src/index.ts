import { scanTokens } from "./scanner"
import { parse } from "./parser"
import { resolve } from "./resolver"
import { emitLlvm } from "./backend-llvm"
import { ReportError } from "./util"
import * as ast from "./nodes"

export interface CompileResult {
  program: string | null
  errors: string[]
}

export function compile(source: string): CompileResult {
  const errors: string[] = []
  const reportError: ReportError = (line, msg) => {
    errors.push(`${line}: ${msg}`)
  }

  const tokens = scanTokens(source, reportError)
  if (errors.length > 0) {
    return { program: null, errors }
  }

  let context: ast.Context | null = null
  try {
    context = parse(tokens, reportError)
  } catch (e) {
    // parser already reports errors via callback
  }
  if (errors.length > 0 || !context) {
    return { program: null, errors }
  }

  resolve(context, reportError)
  if (errors.length > 0) {
    return { program: null, errors }
  }

  try {
    const program = emitLlvm(context)
    return { program, errors }
  } catch (e: any) {
    errors.push(e?.message ?? String(e))
    return { program: null, errors }
  }
}
