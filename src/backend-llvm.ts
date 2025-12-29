import * as ast from "./nodes"
import { UTF8Codec } from "./util"

type LlvmType = "i1" | "i8" | "i32" | "float" | "double" | "i8*"

interface ArrayInfo {
  elem: LlvmType
  length: number
}

interface Value {
  type: LlvmType
  repr: string
  array?: ArrayInfo
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
      return "i8*" // arrays represented by pointer with ArrayInfo metadata
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
  private locals: Map<number, { ptr: string; type: LlvmType; array?: ArrayInfo }> = new Map()
  private hasReturn = false
  private functionRetType: LlvmType | "void" = "i32"
  private fnReturnTypeAst: ast.Type | null = null
  private terminated = false
  private paramArgsByName: Map<string, { type: LlvmType; repr: string }> = new Map()
  private currentFunctionName: string = ""
  private globals: Map<number, { ptr: string; type: LlvmType; array?: ArrayInfo }>
  private globalsByName: Map<string, { ptr: string; type: LlvmType; array?: ArrayInfo }>

  constructor(
    private readonly module: LlvmModuleBuilder,
    private readonly fnSigs: Map<string, { ret: LlvmType | "void"; params: LlvmType[] }>,
    globals: Map<number, { ptr: string; type: LlvmType; array?: ArrayInfo }>,
    globalsByName: Map<string, { ptr: string; type: LlvmType; array?: ArrayInfo }>
  ) {
    this.globals = globals
    this.globalsByName = globalsByName
  }

  fresh(prefix = "t"): string {
    return `%${prefix}${this.tempCounter++}`
  }

  freshLabel(prefix = "L"): string {
    return `${prefix}${this.tempCounter++}`
  }

  emit(line: string) {
    if (this.terminated) {
      throw new Error("Attempting to emit after terminator")
    }
    this.lines.push(line)
  }

  private addAlloca(line: string) {
    this.allocas.push(line)
  }

  private getLocal(symbol: ast.VariableSymbol | ast.ParamSymbol, fallbackType?: LlvmType): { ptr: string; type: LlvmType; array?: ArrayInfo } {
    if (symbol.kind === ast.SymbolKind.VARIABLE) {
      const name = (symbol as ast.VariableSymbol).node.name.lexeme
      const g = this.globalsByName.get(name) ?? this.globals.get(symbol.id)
      if (g) return g
      if ((symbol as ast.VariableSymbol).isGlobal) {
        throw new Error(`Missing global slot for symbol ${name}`)
      }
    }
    const existing = this.locals.get(symbol.id)
    if (existing) return existing
    if (!fallbackType) throw new Error("Missing local slot for symbol")
    return this.ensureLocal(symbol, fallbackType)
  }

  private ensureLocal(symbol: ast.VariableSymbol | ast.ParamSymbol, type: LlvmType, init?: Value, array?: ArrayInfo): { ptr: string; type: LlvmType; array?: ArrayInfo } {
    if (symbol.kind === ast.SymbolKind.VARIABLE && (symbol as ast.VariableSymbol).isGlobal) {
      return this.getLocal(symbol, type)
    }
    const existing = this.locals.get(symbol.id)
    if (existing) return existing
    const ptr = this.fresh("var")
    this.addAlloca(`${ptr} = alloca ${type}`)
    const entry = { ptr, type, array }
    this.locals.set(symbol.id, entry)
    if (init) {
      this.storeValue(entry, init)
    }
    return entry
  }

  private storeValue(dest: { ptr: string; type: LlvmType; array?: ArrayInfo }, value: Value) {
    if (dest.array && value.array) {
      const bytes = dest.array.length * this.sizeofLlvm(dest.array.elem)
      const dstPtr = dest.ptr
      const srcPtr = value.repr
      this.emit(
        `call void @llvm.memcpy.p0.p0.i64(i8* ${dstPtr}, i8* ${srcPtr}, i64 ${bytes}, i1 0)`
      )
      return
    }
    const valCast = this.cast(value, dest.type)
    this.emit(`store ${dest.type} ${valCast.repr}, ${dest.type}* ${dest.ptr}`)
  }

  private loadValue(slot: { ptr: string; type: LlvmType; array?: ArrayInfo }): Value {
    const out = this.fresh("ld")
    this.emit(`${out} = load ${slot.type}, ${slot.type}* ${slot.ptr}`)
    return { type: slot.type, repr: out, array: slot.array }
  }

  private toBool(val: Value): Value {
    if (val.type === "i1") return val
    if (val.type === "i8" || val.type === "i32") {
      const out = this.fresh("tobool")
      this.emit(`${out} = icmp ne ${val.type} ${val.repr}, 0`)
      return { type: "i1", repr: out }
    }
    throw new Error("Cannot convert to bool")
  }

  private sizeofLlvm(ty: LlvmType): number {
    switch (ty) {
      case "i1":
      case "i8":
        return 1
      case "i32":
      case "float":
        return 4
      case "double":
      case "i8*":
        return 8
    }
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
        let slot: { ptr: string; type: LlvmType }
        if (symbol.kind === ast.SymbolKind.PARAM) {
          const argInit = this.paramArgsByName.get(v.name.lexeme)
          const llvmTy = llvmTypeFromAst(v.resolvedType!)
          slot = this.ensureLocal(symbol as any, llvmTy, argInit ? { type: argInit.type, repr: argInit.repr } : undefined)
        } else {
          slot = this.getLocal(symbol as any)
        }
        return this.loadValue(slot)
      }
      case ast.NodeKind.ASSIGN_EXPR: {
        const a = node as ast.AssignExpr
        if (a.left.kind === ast.NodeKind.VARIABLE_EXPR) {
          const leftVar = a.left as ast.VariableExpr
          const symbol = leftVar.resolvedSymbol
          if (!symbol || (symbol.kind !== ast.SymbolKind.VARIABLE && symbol.kind !== ast.SymbolKind.PARAM)) {
            throw new Error("Assignment target missing symbol")
          }
          const targetType = llvmTypeFromAst(a.left.resolvedType!)
          const slot = this.getLocal(symbol as any, targetType)
          const rval = this.emitExpr(a.right)
          this.storeValue(slot, rval)
          return this.cast(rval, targetType)
        } else if (a.left.kind === ast.NodeKind.INDEX_EXPR) {
          const idx = a.left as ast.IndexExpr
          const base = this.emitExpr(idx.callee)
          if (!base.array) throw new Error("Index assignment requires array")
          const indexVal = this.emitExpr(idx.index)
          const idx32 = this.cast(indexVal, "i32")
          const elemTy = base.array.elem
          const elemPtr = this.fresh("elemPtr")
          this.emit(
            `${elemPtr} = getelementptr ${elemTy}, ${elemTy}* ${base.repr}, i32 ${idx32.repr}`
          )
          const rval = this.emitExpr(a.right)
          const casted = this.cast(rval, elemTy)
          this.emit(`store ${elemTy} ${casted.repr}, ${elemTy}* ${elemPtr}`)
          return casted
        } else {
          throw new Error("Assignment target unsupported in backend.")
        }
      }
      case ast.NodeKind.CAST_EXPR: {
        const c = node as ast.CastExpr
        const inner = this.emitExpr(c.value)
        const target = llvmTypeFromAst(c.type)
        return this.cast(inner, target)
      }
      case ast.NodeKind.LEN_EXPR: {
        const lenExpr = node as ast.LenExpr
        const lenVal = lenExpr.resolvedLength ?? 0
        return { type: "i32", repr: `${lenVal}` }
      }
      case ast.NodeKind.LOGICAL_EXPR: {
        const l = node as ast.LogicalExpr
        const left = this.toBool(this.emitExpr(l.left))
        const result = this.fresh("logic")
        const evalRight = this.freshLabel("logic.right")
        const endLabel = this.freshLabel("logic.end")
        if (l.operator.lexeme === "&&") {
          const falseLabel = this.freshLabel("logic.false")
          this.emit(`br i1 ${left.repr}, label %${evalRight}, label %${falseLabel}`)
          this.emitLabel(evalRight)
          const right = this.toBool(this.emitExpr(l.right))
          this.emit(`br label %${endLabel}`)
          this.emitLabel(falseLabel)
          this.emit(`br label %${endLabel}`)
          this.emitLabel(endLabel)
          this.emit(`${result} = phi i1 [ ${right.repr}, %${evalRight} ], [ 0, %${falseLabel} ]`)
          return { type: "i1", repr: result }
        } else if (l.operator.lexeme === "||") {
          const trueLabel = this.freshLabel("logic.true")
          this.emit(`br i1 ${left.repr}, label %${trueLabel}, label %${evalRight}`)
          this.emitLabel(evalRight)
          const right = this.toBool(this.emitExpr(l.right))
          this.emit(`br label %${endLabel}`)
          this.emitLabel(trueLabel)
          this.emit(`br label %${endLabel}`)
          this.emitLabel(endLabel)
          this.emit(`${result} = phi i1 [ 1, %${trueLabel} ], [ ${right.repr}, %${evalRight} ]`)
          return { type: "i1", repr: result }
        } else {
          throw new Error("Unknown logical operator")
        }
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
          case "==":
          case "!=": {
            if (left.type === "i32" || left.type === "i8" || left.type === "i1") {
              const op = b.operator.lexeme === "==" ? "icmp eq" : "icmp ne"
              const out = this.fresh("icmp")
              this.emit(`${out} = ${op} ${left.type} ${left.repr}, ${right.repr}`)
              return { type: "i1", repr: out }
            } else if (left.type === "float") {
              const op = b.operator.lexeme === "==" ? "fcmp oeq" : "fcmp one"
              const out = this.fresh("fcmp")
              this.emit(`${out} = ${op} float ${left.repr}, ${right.repr}`)
              return { type: "i1", repr: out }
            }
            throw new Error("Equality not supported for this type.")
          }
          case "<":
          case "<=":
          case ">":
          case ">=": {
            if (left.type === "i32" || left.type === "i8") {
              const op =
                b.operator.lexeme === "<" ? "icmp slt" :
                b.operator.lexeme === "<=" ? "icmp sle" :
                b.operator.lexeme === ">" ? "icmp sgt" : "icmp sge"
              const out = this.fresh("icmp")
              this.emit(`${out} = ${op} ${left.type} ${left.repr}, ${right.repr}`)
              return { type: "i1", repr: out }
            } else if (left.type === "float") {
              const op =
                b.operator.lexeme === "<" ? "fcmp olt" :
                b.operator.lexeme === "<=" ? "fcmp ole" :
                b.operator.lexeme === ">" ? "fcmp ogt" : "fcmp oge"
              const out = this.fresh("fcmp")
              this.emit(`${out} = ${op} float ${left.repr}, ${right.repr}`)
              return { type: "i1", repr: out }
            }
            throw new Error("Comparison not supported for this type.")
          }
          default:
            throw new Error(`Unsupported binary operator ${b.operator.lexeme}`)
        }
      }
      case ast.NodeKind.CALL_EXPR: {
        const c = node as ast.CallExpr
        if (c.callee.kind !== ast.NodeKind.VARIABLE_EXPR) {
          throw new Error("Only simple function calls supported")
        }
        const name = (c.callee as ast.VariableExpr).name.lexeme
        const sig = this.fnSigs.get(name)
        if (!sig) {
          throw new Error(`Unknown function ${name}`)
        }
        const args: Value[] = c.args.map((a) => this.emitExpr(a))
        if (args.length !== sig.params.length) {
          throw new Error(`Arity mismatch calling ${name}`)
        }
        const argStr = args.map((v, i) => `${sig.params[i]} ${this.cast(v, sig.params[i]).repr}`).join(", ")
        if (sig.ret === "void") {
          this.emit(`call void @${name}(${argStr})`)
          return { type: "i32", repr: "0" }
        } else {
          const out = this.fresh("call")
          this.emit(`${out} = call ${sig.ret} @${name}(${argStr})`)
          return { type: sig.ret, repr: out }
        }
      }
      case ast.NodeKind.INDEX_EXPR: {
        const idx = node as ast.IndexExpr
        const base = this.emitExpr(idx.callee)
        if (!base.array) {
          throw new Error("Indexing non-array not supported yet")
        }
        const indexVal = this.emitExpr(idx.index)
        const idx32 = this.cast(indexVal, "i32")
        const elemTy = base.array.elem
        const elemPtr = this.fresh("elemPtr")
        this.emit(
          `${elemPtr} = getelementptr ${elemTy}, ${elemTy}* ${base.repr}, i32 ${idx32.repr}`
        )
        const outVal = this.fresh("ldelem")
        this.emit(`${outVal} = load ${elemTy}, ${elemTy}* ${elemPtr}`)
        return { type: elemTy, repr: outVal }
      }
      case ast.NodeKind.LIST_EXPR: {
        const list = node as ast.ListExpr
        if (list.initializer.kind === ast.ListKind.LIST) {
          const elems = list.initializer.values
          if (elems.length === 0) {
            throw new Error("Empty array literal unsupported")
          }
          const first = this.emitExpr(elems[0])
          const elemTy = first.type
          const length = elems.length
          const allocaPtr = this.fresh("arr")
          this.addAlloca(`${allocaPtr} = alloca ${elemTy}, i32 ${length}`)
          this.storeValue({ ptr: allocaPtr, type: elemTy, array: { elem: elemTy, length } }, first)
          for (let i = 1; i < length; i++) {
            const val = this.emitExpr(elems[i])
            const idx = this.fresh("idxptr")
            this.emit(`${idx} = getelementptr ${elemTy}, ${elemTy}* ${allocaPtr}, i32 ${i}`)
            const casted = this.cast(val, elemTy)
            this.emit(`store ${elemTy} ${casted.repr}, ${elemTy}* ${idx}`)
          }
          return { type: "i8*", repr: allocaPtr, array: { elem: elemTy, length } }
        } else {
          throw new Error("Repeat initializer unsupported in LLVM backend yet")
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
        const initVal = this.emitExpr(v.initializer)
        const slot = this.getLocal(symbol, ty)
        this.storeValue(slot, initVal)
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
          if (this.functionRetType === "void") {
            // ignore value
            this.emit("ret void")
          } else {
            const casted = this.cast(val, this.functionRetType as LlvmType)
            this.emit(`ret ${casted.type} ${casted.repr}`)
          }
        } else {
          if (this.functionRetType === "void") this.emit("ret void")
          else {
            const zero = this.functionRetType === "float" || this.functionRetType === "double" ? "0.0" : "0"
            this.emit(`ret ${this.functionRetType} ${zero}`)
          }
        }
        this.hasReturn = true
        this.terminated = true
        break
      }
      case ast.NodeKind.IF_STMT: {
        const ifs = stmt as ast.IfStmt
        const cond = this.emitCondition(ifs.expression)
        const thenLabel = this.freshLabel("then")
        const elseLabel = this.freshLabel("else")
        const endLabel = this.freshLabel("endif")
        if (ifs.elseBranch) {
          this.emit(`br i1 ${cond}, label %${thenLabel}, label %${elseLabel}`)
          this.emitLabel(thenLabel)
          this.emitStmt(ifs.thenBranch)
          if (!this.terminated) this.emit(`br label %${endLabel}`)
          this.terminated = false
          this.emitLabel(elseLabel)
          this.emitStmt(ifs.elseBranch)
          if (!this.terminated) this.emit(`br label %${endLabel}`)
          this.terminated = false
        } else {
          this.emit(`br i1 ${cond}, label %${thenLabel}, label %${endLabel}`)
          this.emitLabel(thenLabel)
          this.emitStmt(ifs.thenBranch)
          if (!this.terminated) this.emit(`br label %${endLabel}`)
          this.terminated = false
        }
        this.emitLabel(endLabel)
        break
      }
      case ast.NodeKind.WHILE_STMT: {
        const w = stmt as ast.WhileStmt
        const condLabel = this.freshLabel("loop.cond")
        const bodyLabel = this.freshLabel("loop.body")
        const endLabel = this.freshLabel("loop.end")
        this.emit(`br label %${condLabel}`)
        this.emitLabel(condLabel)
        const cond = this.emitCondition(w.expression)
        this.emit(`br i1 ${cond}, label %${bodyLabel}, label %${endLabel}`)
        this.emitLabel(bodyLabel)
        this.emitStmt(w.body)
        if (w.increment) {
          if (!this.terminated) this.emitExpr(w.increment.expression)
        }
        if (!this.terminated) this.emit(`br label %${condLabel}`)
        this.terminated = false
        this.emitLabel(endLabel)
        break
      }
      case ast.NodeKind.BLOCK_STMT: {
        const b = stmt as ast.BlockStmt
        b.statements.forEach((s) => this.emitStmt(s))
        break
      }
      default:
        throw new Error(`Unsupported statement kind ${ast.NodeKind[stmt.kind]} in minimal LLVM backend.`)
    }
  }

  private emitLabel(name: string) {
    this.lines.push(`${name}:`)
    this.terminated = false
  }

  private emitCondition(expr: ast.Expr): string {
    const val = this.emitExpr(expr)
    if (val.type === "i1") return val.repr
    if (val.type === "i8" || val.type === "i32") {
      const zero = val.type === "i8" ? "i8 0" : "i32 0"
      const out = this.fresh("tobool")
      this.emit(`${out} = icmp ne ${val.type} ${val.repr}, ${zero.split(" ")[1]}`)
      return out
    }
    throw new Error("Unsupported condition type")
  }

  buildFunction(fn: ast.FunctionStmt): string {
    this.currentFunctionName = fn.name.lexeme
    // Force main to return i32 for proper process exit codes.
    if (fn.name.lexeme === "main") {
      this.functionRetType = "i32"
    } else {
      this.functionRetType = llvmReturnTypeFromAst(fn.returnType)
    }
    this.fnReturnTypeAst = fn.returnType
    const retTy = this.functionRetType
    const header = `define ${retTy} @${fn.name.lexeme}() {`
    // Build function signature with named params
    const paramNames: string[] = []
    fn.params.forEach((p) => {
      paramNames.push(this.fresh(p.name.lexeme.replace(/[^a-zA-Z0-9]/g, "p")))
    })
    const paramSig = fn.params.map((p, i) => `${llvmTypeFromAst(p.type)} ${paramNames[i]}`).join(", ")
    const realHeader = `define ${retTy} @${fn.name.lexeme}(${paramSig}) {`
    this.lines.push(realHeader)
    this.lines.push("entry:")
    // params allocas and stores
    fn.params.forEach((p, i) => {
      const llvmTy = llvmTypeFromAst(p.type)
      const slot = this.ensureLocal(p as any, llvmTy)
      const incoming = paramNames[i]
      this.lines.push(`  store ${llvmTy} ${incoming}, ${llvmTy}* ${slot.ptr}`)
      this.paramArgsByName.set(p.name.lexeme, { type: llvmTy, repr: incoming })
    })
    if (this.currentFunctionName === "main" && this.fnSigs.has("__init_globals__")) {
      this.lines.push("  call void @__init_globals__()")
    }
    // body
    if (fn.body) {
      for (const stmt of fn.body.block) {
        this.emitStmt(stmt)
      }
    }
    if (!this.hasReturn) {
      if (retTy === "void") this.lines.push("  ret void")
      else {
        const zero = retTy === "float" || retTy === "double" ? "0.0" : "0"
        this.lines.push(`  ret ${retTy} ${zero}`)
      }
    }
    const bodyLines = this.lines.filter((l) => l !== realHeader && l !== "entry:")
    const body = [
      realHeader,
      "entry:",
      ...this.allocas.map((l) => `  ${l}`),
      ...bodyLines.map((l) => l.endsWith(":") ? l : (l.startsWith("  ") ? l : `  ${l}`)),
      "}"
    ]
    return body.join("\n")
  }
}

export function emitLlvm(context: ast.Context): string {
  const module = new LlvmModuleBuilder()
  module.declare("declare void @llvm.memcpy.p0.p0.i64(i8*, i8*, i64, i1)")
  const functions = context.topLevelStatements.filter(
    (s) => s.kind === ast.NodeKind.FUNCTION_STMT
  ) as ast.FunctionStmt[]
  const fnSigs = new Map<string, { ret: LlvmType | "void"; params: LlvmType[] }>()
  const globalsMap = new Map<number, { ptr: string; type: LlvmType; array?: ArrayInfo }>()
  const globalsByName = new Map<string, { ptr: string; type: LlvmType; array?: ArrayInfo }>()

  const globalVars = context.topLevelStatements.filter(
    (s) => s.kind === ast.NodeKind.VAR_STMT
  ) as ast.VarStmt[]

  globalVars.forEach((v) => {
    if (!v.symbol) return
    if (!(v.symbol as ast.VariableSymbol).isGlobal) return
    const llvmTy = llvmTypeFromAst(v.type!)
    const name = v.name.lexeme
    let initVal = "0"
    if (llvmTy === "float" || llvmTy === "double") initVal = "0.0"
    if (v.type?.category === ast.TypeCategory.ARRAY) {
      const arr = v.type as ast.ArrayType
      const elemTy = llvmTypeFromAst(arr.elementType)
      module.addGlobal(`@${name} = global [${arr.length} x ${elemTy}] zeroinitializer`)
      globalsMap.set(v.symbol.id, { ptr: `@${name}`, type: "i8*", array: { elem: elemTy, length: arr.length } })
      globalsByName.set(name, { ptr: `@${name}`, type: "i8*", array: { elem: elemTy, length: arr.length } })
    } else {
      module.addGlobal(`@${name} = global ${llvmTy} ${initVal}`)
      globalsMap.set(v.symbol.id, { ptr: `@${name}`, type: llvmTy })
      globalsByName.set(name, { ptr: `@${name}`, type: llvmTy })
    }
  })

  functions.forEach((fn) => {
    const ret = fn.name.lexeme === "main" ? ("i32" as const) : llvmReturnTypeFromAst(fn.returnType)
    const params = fn.params.map((p) => llvmTypeFromAst(p.type))
    fnSigs.set(fn.name.lexeme, { ret, params })
  })
  const mainFn = functions.find((fn) => fn.name.lexeme === "main")
  if (!mainFn) {
    throw new Error("Program must define a 'main' function.")
  }

  if (context.globalInitOrder && context.globalInitOrder.length > 0) {
    fnSigs.set("__init_globals__", { ret: "void", params: [] })
    const initFn: ast.FunctionStmt = {
      kind: ast.NodeKind.FUNCTION_STMT,
      name: { lexeme: "__init_globals__" } as any,
      params: [],
      returnType: ast.VoidType,
      body: {
        block: context.globalInitOrder,
        scope: new ast.Scope(null)
      },
      symbol: null,
      hoistedLocals: null
    }
    const initBuilder = new FunctionBuilder(module, fnSigs, globalsMap, globalsByName)
    module.addFunction(initBuilder.buildFunction(initFn))
  }

  functions.forEach((fn) => {
    const fnBuilder = new FunctionBuilder(module, fnSigs, globalsMap, globalsByName)
    module.addFunction(fnBuilder.buildFunction(fn))
  })
  return module.build()
}
