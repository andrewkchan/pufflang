import * as ast from "./nodes"
import { UTF8Codec } from "./util"

type LlvmType = "i1" | "i8" | "i32" | "float" | "double" | "i8*"

interface Value {
  type: LlvmType
  repr: string
}

const codec = new UTF8Codec()

function llvmTypeFromAst(type: ast.Type): LlvmType {
  switch (type.category) {
    case ast.TypeCategory.BOOL:
      return "i1"
    case ast.TypeCategory.BYTE:
      return "i8"
    case ast.TypeCategory.INT:
      return "i32"
    case ast.TypeCategory.FLOAT:
      return "float"
    case ast.TypeCategory.POINTER:
      return "i8*" // placeholder until pointer support
    case ast.TypeCategory.ARRAY:
    case ast.TypeCategory.STRUCT:
    case ast.TypeCategory.VOID:
    case ast.TypeCategory.ERROR:
      throw new Error(`Unsupported type in LLVM backend: ${ast.typeToString(type)}`)
  }
}

function llvmReturnTypeFromAst(type: ast.Type): LlvmType | "void" {
  if (ast.isEqual(type, ast.VoidType)) return "void"
  return llvmTypeFromAst(type)
}

function formatFloatLiteral(value: number): string {
  const s = value.toExponential(6)
  const match = s.match(/^([0-9.]+)e([+-]?)(\d+)$/)
  if (!match) return value.toString()
  const [, mantissa, sign, exp] = match
  const paddedExp = exp.padStart(2, "0")
  return `${mantissa}e${sign || "+"}${paddedExp}`
}

class LlvmModuleBuilder {
  private globals: string[] = []
  private declarations: string[] = []
  private functions: string[] = []
  private stringLiterals: Map<string, { name: string; len: number }> = new Map()
  private strCounter = 0

  declare(line: string) {
    this.declarations.push(line)
  }

  addGlobal(line: string) {
    this.globals.push(line)
  }

  addFunction(body: string) {
    this.functions.push(body)
  }

  private escapeCString(str: string): { literal: string; len: number } {
    const bytes = codec.encodeString(str)
    const data: string[] = []
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i]
      if (b === 92 /* \ */) data.push("\\5C")
      else if (b === 34 /* " */) data.push("\\22")
      else if (b >= 32 && b < 127) data.push(String.fromCharCode(b))
      else {
        const hex = b.toString(16).padStart(2, "0").toUpperCase()
        data.push(`\\${hex}`)
      }
    }
    data.push("\\00")
    return { literal: data.join(""), len: bytes.length + 1 }
  }

  private getOrAddCString(str: string): { name: string; len: number } {
    const existing = this.stringLiterals.get(str)
    if (existing) return existing
    const name = `@.str.${this.strCounter++}`
    const escaped = this.escapeCString(str)
    this.addGlobal(`${name} = private constant [${escaped.len} x i8] c"${escaped.literal}"`)
    const entry = { name, len: escaped.len }
    this.stringLiterals.set(str, entry)
    return entry
  }

  gepStringPtr(str: string): string {
    const { name, len } = this.getOrAddCString(str)
    return `getelementptr inbounds ([${len} x i8], [${len} x i8]* ${name}, i64 0, i64 0)`
  }

  build(): string {
    return [
      "; ModuleID = 'puffscript'",
      "declare i32 @printf(i8*, ...)",
      "declare i32 @puts(i8*)",
      ...this.declarations,
      ...this.globals,
      ...this.functions
    ].join("\n") + "\n"
  }
}

class FunctionBuilder {
  private allocas: string[] = []
  private lines: string[] = []
  private tempCounter = 0
  private locals: Map<number, { ptr: string; type: LlvmType }> = new Map()
  private hasReturn = false
  private functionRetType: LlvmType | "void" = "i32"

  constructor(private readonly module: LlvmModuleBuilder) {}

  fresh(prefix = "t"): string {
    return `%${prefix}${this.tempCounter++}`
  }

  emit(line: string) {
    this.lines.push(line)
  }

  private addAlloca(line: string) {
    this.allocas.push(line)
  }

  private getLocal(symbol: ast.VariableSymbol | ast.ParamSymbol): { ptr: string; type: LlvmType } {
    const existing = this.locals.get(symbol.id)
    if (!existing) throw new Error("Missing local slot for symbol")
    return existing
  }

  private ensureLocal(symbol: ast.VariableSymbol | ast.ParamSymbol, type: LlvmType): { ptr: string; type: LlvmType } {
    const existing = this.locals.get(symbol.id)
    if (existing) return existing
    const ptr = this.fresh("var")
    this.addAlloca(`${ptr} = alloca ${type}`)
    const entry = { ptr, type }
    this.locals.set(symbol.id, entry)
    return entry
  }

  private storeValue(dest: { ptr: string; type: LlvmType }, value: Value) {
    const valCast = this.cast(value, dest.type)
    this.emit(`store ${dest.type} ${valCast.repr}, ${dest.type}* ${dest.ptr}`)
  }

  private loadValue(slot: { ptr: string; type: LlvmType }): Value {
    const out = this.fresh("ld")
    this.emit(`${out} = load ${slot.type}, ${slot.type}* ${slot.ptr}`)
    return { type: slot.type, repr: out }
  }

  emitExpr(node: ast.Expr): Value {
    switch (node.kind) {
      case ast.NodeKind.LITERAL_EXPR: {
        const lit = node as ast.LiteralExpr
        switch (lit.type.category) {
          case ast.TypeCategory.INT:
            return { type: "i32", repr: `${lit.value}` }
          case ast.TypeCategory.BYTE:
            return { type: "i8", repr: `${lit.value}` }
          case ast.TypeCategory.BOOL:
            return { type: "i1", repr: lit.value ? "1" : "0" }
          case ast.TypeCategory.FLOAT:
            return { type: "float", repr: `${formatFloatLiteral(lit.value)}` }
          case ast.TypeCategory.ARRAY: {
            if (ast.isEqual(lit.type.elementType, ast.ByteType)) {
              const strPtr = this.module.gepStringPtr(String(lit.value))
              return { type: "i8*", repr: strPtr }
            }
            throw new Error("Array literals not yet supported in LLVM backend.")
          }
          default:
            throw new Error(`Unsupported literal type: ${ast.typeToString(lit.type)}`)
        }
      }
      case ast.NodeKind.VARIABLE_EXPR: {
        const v = node as ast.VariableExpr
        const symbol = v.resolvedSymbol
        if (!symbol || (symbol.kind !== ast.SymbolKind.VARIABLE && symbol.kind !== ast.SymbolKind.PARAM)) {
          throw new Error("Variable expression missing symbol")
        }
        const slot = this.getLocal(symbol as any)
        return this.loadValue(slot)
      }
      case ast.NodeKind.ASSIGN_EXPR: {
        const a = node as ast.AssignExpr
        if (a.left.kind !== ast.NodeKind.VARIABLE_EXPR) {
          throw new Error("Assignment supported only to variables in minimal backend.")
        }
        const leftVar = a.left as ast.VariableExpr
        const symbol = leftVar.resolvedSymbol
        if (!symbol || (symbol.kind !== ast.SymbolKind.VARIABLE && symbol.kind !== ast.SymbolKind.PARAM)) {
          throw new Error("Assignment target missing symbol")
        }
        const targetType = llvmTypeFromAst(a.left.resolvedType!)
        const slot = this.ensureLocal(symbol as any, targetType)
        const rval = this.emitExpr(a.right)
        this.storeValue(slot, rval)
        return this.cast(rval, targetType)
      }
      case ast.NodeKind.CAST_EXPR: {
        const c = node as ast.CastExpr
        const inner = this.emitExpr(c.value)
        const target = llvmTypeFromAst(c.type)
        return this.cast(inner, target)
      }
      case ast.NodeKind.GROUP_EXPR: {
        const g = node as ast.GroupExpr
        return this.emitExpr(g.expression)
      }
      case ast.NodeKind.UNARY_EXPR: {
        const u = node as ast.UnaryExpr
        const val = this.emitExpr(u.value)
        if (u.operator.lexeme === "-") {
          if (val.type === "i32") {
            const out = this.fresh("neg")
            this.emit(`${out} = sub nsw i32 0, ${val.repr}`)
            return { type: "i32", repr: out }
          } else if (val.type === "float") {
            const out = this.fresh("fneg")
            this.emit(`${out} = fsub float -0.0, ${val.repr}`)
            return { type: "float", repr: out }
          }
          throw new Error("Unary minus only supported for int/float right now.")
        }
        if (u.operator.lexeme === "!") {
          if (val.type === "i1") {
            const out = this.fresh("not")
            this.emit(`${out} = xor i1 ${val.repr}, true`)
            return { type: "i1", repr: out }
          }
          throw new Error("Logical not supported only for bool currently.")
        }
        throw new Error(`Unsupported unary operator ${u.operator.lexeme}`)
      }
      case ast.NodeKind.BINARY_EXPR: {
        const b = node as ast.BinaryExpr
        const left = this.emitExpr(b.left)
        const right = this.emitExpr(b.right)
        if (left.type !== right.type) {
          throw new Error(`Type mismatch in binary expression: ${left.type} vs ${right.type}`)
        }
        switch (b.operator.lexeme) {
          case "+":
          case "-":
          case "*":
          case "/": {
            if (left.type === "i32") {
              const op = b.operator.lexeme === "+" ? "add nsw" :
                b.operator.lexeme === "-" ? "sub nsw" :
                  b.operator.lexeme === "*" ? "mul nsw" : "sdiv"
              const out = this.fresh("iop")
              this.emit(`${out} = ${op} i32 ${left.repr}, ${right.repr}`)
              return { type: "i32", repr: out }
            } else if (left.type === "i8") {
              const op = b.operator.lexeme === "+" ? "add" :
                b.operator.lexeme === "-" ? "sub" :
                  b.operator.lexeme === "*" ? "mul" : "udiv"
              const out = this.fresh("bop")
              this.emit(`${out} = ${op} i8 ${left.repr}, ${right.repr}`)
              return { type: "i8", repr: out }
            } else if (left.type === "float") {
              const op = b.operator.lexeme === "+" ? "fadd" :
                b.operator.lexeme === "-" ? "fsub" :
                  b.operator.lexeme === "*" ? "fmul" : "fdiv"
              const out = this.fresh("fop")
              this.emit(`${out} = ${op} float ${left.repr}, ${right.repr}`)
              return { type: "float", repr: out }
            }
            throw new Error("Binary arithmetic only implemented for int/float/byte so far.")
          }
          default:
            throw new Error(`Unsupported binary operator ${b.operator.lexeme}`)
        }
      }
      default:
        throw new Error(`Unsupported expression kind ${ast.NodeKind[node.kind]}`)
    }
  }

  private cast(value: Value, target: LlvmType): Value {
    if (value.type === target) return value
    const out = this.fresh("cast")
    if (value.type === "i1" && target === "i32") {
      this.emit(`${out} = zext i1 ${value.repr} to i32`)
      return { type: "i32", repr: out }
    }
    if (value.type === "i8" && target === "i32") {
      this.emit(`${out} = zext i8 ${value.repr} to i32`)
      return { type: "i32", repr: out }
    }
    if (value.type === "i32" && target === "i8") {
      this.emit(`${out} = trunc i32 ${value.repr} to i8`)
      return { type: "i8", repr: out }
    }
    if (value.type === "float" && target === "double") {
      this.emit(`${out} = fpext float ${value.repr} to double`)
      return { type: "double", repr: out }
    }
    if (value.type === "i32" && target === "float") {
      this.emit(`${out} = sitofp i32 ${value.repr} to float`)
      return { type: "float", repr: out }
    }
    if (value.type === "float" && target === "i32") {
      this.emit(`${out} = fptosi float ${value.repr} to i32`)
      return { type: "i32", repr: out }
    }
    throw new Error(`Unsupported cast from ${value.type} to ${target}`)
  }

  emitPrint(expr: ast.Expr) {
    const val = this.emitExpr(expr)
    const resolvedType = expr.resolvedType
    if (!resolvedType) throw new Error("Missing resolved type on print expression")
    switch (resolvedType.category) {
      case ast.TypeCategory.INT: {
        const fmtPtr = this.module.gepStringPtr("%d\n")
        this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, i32 ${val.repr})`)
        break
      }
      case ast.TypeCategory.BYTE: {
        const widened = this.cast(val, "i32")
        const fmtPtr = this.module.gepStringPtr("%d\n")
        this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, i32 ${widened.repr})`)
        break
      }
      case ast.TypeCategory.BOOL: {
        const widened = this.cast(val, "i32")
        const fmtPtr = this.module.gepStringPtr("%d\n")
        this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, i32 ${widened.repr})`)
        break
      }
      case ast.TypeCategory.FLOAT: {
        const widened = this.cast(val, "double")
        const fmtPtr = this.module.gepStringPtr("%f\n")
        this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, double ${widened.repr})`)
        break
      }
      case ast.TypeCategory.ARRAY: {
        if (ast.isEqual(resolvedType.elementType, ast.ByteType)) {
          const fmtPtr = this.module.gepStringPtr("%s\n")
          this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, i8* ${val.repr})`)
          break
        }
        throw new Error("Printing non-byte arrays is not supported yet.")
      }
      default:
        throw new Error(`Printing unsupported type ${ast.typeToString(resolvedType)}`)
    }
  }

  emitStmt(stmt: ast.Stmt) {
    switch (stmt.kind) {
      case ast.NodeKind.PRINT_STMT: {
        const p = stmt as ast.PrintStmt
        this.emitPrint(p.expression)
        break
      }
      case ast.NodeKind.VAR_STMT: {
        const v = stmt as ast.VarStmt
        const symbol = v.symbol
        if (!symbol) throw new Error("VarStmt missing symbol")
        const ty = llvmTypeFromAst(v.type!)
        const slot = this.ensureLocal(symbol, ty)
        const init = this.emitExpr(v.initializer)
        this.storeValue(slot, init)
        break
      }
      case ast.NodeKind.EXPRESSION_STMT: {
        const e = stmt as ast.ExpressionStmt
        this.emitExpr(e.expression)
        break
      }
      case ast.NodeKind.RETURN_STMT: {
        const r = stmt as ast.ReturnStmt
        if (r.value) {
          const val = this.emitExpr(r.value)
          const casted = this.cast(val, this.functionRetType as LlvmType)
          this.emit(`ret ${casted.type} ${casted.repr}`)
        } else {
          if (this.functionRetType === "void") this.emit("ret void")
          else {
            const zero = this.functionRetType === "float" || this.functionRetType === "double" ? "0.0" : "0"
            this.emit(`ret ${this.functionRetType} ${zero}`)
          }
        }
        this.hasReturn = true
        break
      }
      default:
        throw new Error(`Unsupported statement kind ${ast.NodeKind[stmt.kind]} in minimal LLVM backend.`)
    }
  }

  buildFunction(fn: ast.FunctionStmt): string {
    // Force main to return i32 for proper process exit codes.
    if (fn.name.lexeme === "main") {
      this.functionRetType = "i32"
    } else {
      this.functionRetType = llvmReturnTypeFromAst(fn.returnType)
    }
    const retTy = this.functionRetType
    const header = `define ${retTy} @${fn.name.lexeme}() {`
    // collect body
    if (fn.body) {
      for (const stmt of fn.body.block) {
        this.emitStmt(stmt)
      }
    }
    if (!this.hasReturn) {
      if (retTy === "void") this.emit("ret void")
      else {
        const zero = retTy === "float" || retTy === "double" ? "0.0" : "0"
        this.emit(`ret ${retTy} ${zero}`)
      }
    }
    const body = [
      header,
      "entry:",
      ...this.allocas.map((l) => `  ${l}`),
      ...this.lines.map((l) => `  ${l}`),
      "}"
    ]
    return body.join("\n")
  }
}

export function emitLlvm(context: ast.Context): string {
  const module = new LlvmModuleBuilder()
  const functions = context.topLevelStatements.filter(
    (s) => s.kind === ast.NodeKind.FUNCTION_STMT
  ) as ast.FunctionStmt[]
  const mainFn = functions.find((fn) => fn.name.lexeme === "main")
  if (!mainFn) {
    throw new Error("Program must define a 'main' function.")
  }
  const fnBuilder = new FunctionBuilder(module)
  module.addFunction(fnBuilder.buildFunction(mainFn))
  return module.build()
}
