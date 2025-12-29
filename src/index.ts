export interface CompileResult {
  program: string | null
  errors: string[]
}

/**
 * Placeholder compile entrypoint.
 * Will be replaced by full Stage0 frontend + LLVM IR backend.
 */
export function compile(_source: string): CompileResult {
  return {
    program: null,
    errors: ["Compiler not implemented yet."]
  }
}
