import * as ast from "./nodes"
import { UTF8Codec } from "./util"

type LlvmType = "i1" | "i8" | "i32" | "float" | "double" | "i8*" | `%struct.${string}*`

interface ArrayInfo {
  elem: LlvmType // base element LLVM type (non-array)
  length: number // length of this dimension
  elemAst: ast.Type // base element AST type (non-array)
  stride: number // number of base elements per element at this dimension (product of inner lengths)
}

interface StructInfo {
  name: string
  fields: { name: string; type: LlvmType }[]
}

interface PointerInfo {
  elem: LlvmType
}

interface Value {
  type: LlvmType
  repr: string
  array?: ArrayInfo
  struct?: StructInfo
  ptr?: PointerInfo
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
    case ast.TypeCategory.ARRAY: {
      const arr = type as ast.ArrayType
      const baseTy = baseElemType(arr)
      return `${llvmTypeFromAst(baseTy)}*` as LlvmType
    }
    case ast.TypeCategory.STRUCT:
      return `%struct.${type.name.lexeme}*`
    case ast.TypeCategory.VOID:
    case ast.TypeCategory.ERROR:
      throw new Error(`Unsupported type in LLVM backend: ${ast.typeToString(type)}`)
  }
}

function llvmReturnTypeFromAst(type: ast.Type): LlvmType | "void" {
  if (ast.isEqual(type, ast.VoidType)) return "void"
  return llvmTypeFromAst(type)
}

function formatDoubleLiteral(value: number): string {
  if (Number.isFinite(value)) {
    // Emit with enough precision for double; LLVM accepts decimal for doubles.
    return value.toPrecision(17)
  }
  if (Number.isNaN(value)) return "0x7ff8000000000000"
  return value > 0 ? "0x7ff0000000000000" : "-0x7ff0000000000000"
}

function baseElemType(arr: ast.ArrayType): ast.Type {
  let t: ast.Type = arr.elementType
  while (t.category === ast.TypeCategory.ARRAY) {
    t = (t as ast.ArrayType).elementType
  }
  return t
}

function flattenArrayInfo(type: ast.ArrayType): ArrayInfo {
  const base = baseElemType(type)
  function strideOf(t: ast.Type): number {
    if (t.category !== ast.TypeCategory.ARRAY) return 1
    const inner = t as ast.ArrayType
    return inner.length * strideOf(inner.elementType)
  }
  const stride = strideOf(type.elementType)
  return {
    elem: llvmTypeFromAst(base),
    elemAst: base,
    length: type.length,
    stride
  }
}

class LlvmModuleBuilder {
  private globals: string[] = []
  private declarations: string[] = []
  private functions: string[] = []
  private typeDefs: string[] = []
  private stringLiterals: Map<string, { name: string; len: number }> = new Map()
  private strCounter = 0
  private hasRuntime = false

  declare(line: string) {
    this.declarations.push(line)
  }

  addTypeDef(line: string) {
    this.typeDefs.push(line)
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

  emitRuntime() {
    if (this.hasRuntime) return
    this.hasRuntime = true
    // sqrt via libm
    this.declare("declare double @sqrt(double)")
    // malloc/free
    this.declare("declare i8* @malloc(i64)")
    this.declare("declare void @free(i8*)")
    // memcpy
    this.declare("declare void @llvm.memcpy.p0.p0.i64(i8*, i8*, i64, i1)")
  }

  build(): string {
    return [
      "; ModuleID = 'puffscript'",
      "declare i32 @printf(i8*, ...)",
      "declare i32 @puts(i8*)",
      ...this.typeDefs,
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
  private locals: Map<number, { ptr: string; type: LlvmType; array?: ArrayInfo; ptrInfo?: PointerInfo; struct?: StructInfo }> = new Map()
  private hasReturn = false
  private functionRetType: LlvmType | "void" = "i32"
  private fnReturnTypeAst: ast.Type | null = null
  private arrayReturnDest: { ptr: string; type: LlvmType; array: ArrayInfo } | null = null
  private terminated = false
  private paramArgsByName: Map<string, { type: LlvmType; repr: string }> = new Map()
  private paramSlotsByName: Map<string, { ptr: string; type: LlvmType; array?: ArrayInfo; ptrInfo?: PointerInfo; struct?: StructInfo }> = new Map()
  private currentFunctionName: string = ""
  private globals: Map<number, { ptr: string; type: LlvmType; array?: ArrayInfo; ptrInfo?: PointerInfo; struct?: StructInfo }>
  private globalsByName: Map<string, { ptr: string; type: LlvmType; array?: ArrayInfo; ptrInfo?: PointerInfo; struct?: StructInfo }>
  private structs: Map<string, StructInfo>
  private loopStack: { breakLabel: string; continueLabel: string }[] = []

  constructor(
    private readonly module: LlvmModuleBuilder,
    private readonly fnSigs: Map<string, { ret: LlvmType | "void"; params: LlvmType[]; retAst: ast.Type; mangled: string }>,
    globals: Map<number, { ptr: string; type: LlvmType; array?: ArrayInfo }>,
    globalsByName: Map<string, { ptr: string; type: LlvmType; array?: ArrayInfo }>,
    structs: Map<string, StructInfo>
  ) {
    this.globals = globals
    this.globalsByName = globalsByName
    this.structs = structs
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

  private getLocal(symbol: ast.VariableSymbol | ast.ParamSymbol, fallbackType?: LlvmType): { ptr: string; type: LlvmType; array?: ArrayInfo; ptrInfo?: PointerInfo; struct?: StructInfo } {
    if (symbol.kind === ast.SymbolKind.PARAM) {
      const name = (symbol as ast.ParamSymbol).param.name.lexeme
      const byName = this.paramSlotsByName.get(name)
      if (byName) return byName
    }
    if (symbol.kind === ast.SymbolKind.VARIABLE && (symbol as ast.VariableSymbol).isGlobal) {
      const name = (symbol as ast.VariableSymbol).node.name.lexeme
      const g = this.globalsByName.get(name) ?? this.globals.get(symbol.id)
      if (g) return g
      throw new Error(`Missing global slot for symbol ${name}`)
    }
    const existing = this.locals.get(symbol.id)
    if (existing) return existing
    if (!fallbackType) throw new Error("Missing local slot for symbol")
    return this.ensureLocal(symbol, fallbackType)
  }

  private ensureLocal(symbol: ast.VariableSymbol | ast.ParamSymbol, type: LlvmType, init?: Value, array?: ArrayInfo, struct?: StructInfo, ptrInfo?: PointerInfo): { ptr: string; type: LlvmType; array?: ArrayInfo; struct?: StructInfo; ptrInfo?: PointerInfo } {
    if (symbol.kind === ast.SymbolKind.PARAM) {
      const name = (symbol as ast.ParamSymbol).param.name.lexeme
      const byName = this.paramSlotsByName.get(name)
      if (byName) return byName
    }
    if (symbol.kind === ast.SymbolKind.VARIABLE && (symbol as ast.VariableSymbol).isGlobal) {
      return this.getLocal(symbol, type)
    }
    const existing = this.locals.get(symbol.id)
    if (existing) return existing
    let ptr: string
    if (array) {
      ptr = this.fresh("arrslot")
      const total = array.length * array.stride
      this.addAlloca(`${ptr} = alloca ${array.elem}, i32 ${total}`)
    } else {
      ptr = this.fresh("var")
      this.addAlloca(`${ptr} = alloca ${type}`)
    }
    const entry = { ptr, type, array, struct, ptrInfo }
    this.locals.set(symbol.id, entry)
    if (symbol.kind === ast.SymbolKind.PARAM) {
      const name = (symbol as ast.ParamSymbol).param.name.lexeme
      this.paramSlotsByName.set(name, entry)
    }
    if (init) {
      this.storeValue(entry, init)
    }
    return entry
  }

  private storeValue(dest: { ptr: string; type: LlvmType; array?: ArrayInfo; struct?: StructInfo }, value: Value) {
    if (dest.array && value.array) {
      const bytes = this.arrayBytes(dest.array)
      const dstPtr = this.fresh("dstbc")
      const srcPtr = this.fresh("srcbc")
      this.emit(`${dstPtr} = bitcast ${dest.array.elem}* ${dest.ptr} to i8*`)
      this.emit(`${srcPtr} = bitcast ${value.array.elem}* ${value.repr} to i8*`)
      this.emit(
        `call void @llvm.memcpy.p0.p0.i64(i8* ${dstPtr}, i8* ${srcPtr}, i64 ${bytes}, i1 0)`
      )
      return
    }
    if (dest.struct && value.struct) {
      const bytes = this.sizeofStruct(dest.struct)
      const dstPtr = this.fresh("dstbc")
      const srcPtr = this.fresh("srcbc")
      this.emit(`${dstPtr} = bitcast ${this.structPtrType(dest.struct)} ${dest.ptr} to i8*`)
      this.emit(`${srcPtr} = bitcast ${this.structPtrType(value.struct)} ${value.repr} to i8*`)
      this.emit(
        `call void @llvm.memcpy.p0.p0.i64(i8* ${dstPtr}, i8* ${srcPtr}, i64 ${bytes}, i1 0)`
      )
      return
    }
    const valCast = this.cast(value, dest.type)
    this.emit(`store ${dest.type} ${valCast.repr}, ${dest.type}* ${dest.ptr}`)
  }

  private loadValue(slot: { ptr: string; type: LlvmType; array?: ArrayInfo; ptrInfo?: PointerInfo; struct?: StructInfo }): Value {
    const out = this.fresh("ld")
    this.emit(`${out} = load ${slot.type}, ${slot.type}* ${slot.ptr}`)
    return { type: slot.type, repr: out, array: slot.array, ptr: slot.ptrInfo, struct: slot.struct }
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
      default:
        // struct pointer size (assume 8 on 64-bit)
        if (ty.startsWith("%struct.")) return 8
        throw new Error(`Unknown llvm type size for ${ty}`)
    }
  }

  private sizeofAst(type: ast.Type): number {
    switch (type.category) {
      case ast.TypeCategory.BOOL:
      case ast.TypeCategory.BYTE:
        return 1
      case ast.TypeCategory.INT:
      case ast.TypeCategory.FLOAT:
        return 4
      case ast.TypeCategory.POINTER:
        return 8
      case ast.TypeCategory.ARRAY: {
        const arr = type as ast.ArrayType
        return arr.length * this.sizeofAst(arr.elementType)
      }
      case ast.TypeCategory.STRUCT: {
        const info = this.structs.get((type as ast.StructType).name.lexeme)
        if (!info) throw new Error(`Unknown struct ${type}`)
        return info.fields.reduce((acc, f) => acc + this.sizeofLlvm(f.type), 0)
      }
      default:
        throw new Error(`Unsupported type for sizeof ${ast.typeToString(type)}`)
    }
  }

  private arrayBytes(info: ArrayInfo): number {
    return info.length * info.stride * this.sizeofLlvm(info.elem)
  }

  private arrayInfoFromType(type: ast.ArrayType): ArrayInfo {
    const base = baseElemType(type)
    function strideOf(t: ast.Type): number {
      if (t.category !== ast.TypeCategory.ARRAY) return 1
      const inner = t as ast.ArrayType
      return inner.length * strideOf(inner.elementType)
    }
    return {
      elem: llvmTypeFromAst(base),
      elemAst: type.elementType,
      length: type.length,
      stride: strideOf(type.elementType)
    }
  }

  private structPtrType(info: StructInfo): `%struct.${string}*` {
    return `%struct.${info.name}*`
  }

  private sizeofStruct(info: StructInfo): number {
    let sz = 0
    info.fields.forEach((f) => {
      sz += this.sizeofLlvm(f.type)
    })
    return sz
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
            const trunc = this.fresh("flt")
            this.emit(`${trunc} = fptrunc double ${formatDoubleLiteral(lit.value)} to float`)
            return { type: "float", repr: trunc }
          case ast.TypeCategory.ARRAY: {
            if (ast.isEqual(lit.type.elementType, ast.ByteType)) {
              const strPtr = this.module.gepStringPtr(String(lit.value))
              return {
                type: "i8*",
                repr: strPtr,
                array: { elem: "i8", length: (lit.type as ast.ArrayType).length, elemAst: ast.ByteType, stride: 1 }
              }
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
        let slot: { ptr: string; type: LlvmType; array?: ArrayInfo; ptrInfo?: PointerInfo; struct?: StructInfo }
        const llvmTy = llvmTypeFromAst(v.resolvedType!)
        if (symbol.kind === ast.SymbolKind.PARAM) {
          const argInit = this.paramArgsByName.get(v.name.lexeme)
          // ensure param slot exists with proper metadata; prefer existing
          const arrInfo =
            v.resolvedType?.category === ast.TypeCategory.ARRAY
              ? this.arrayInfoFromType(v.resolvedType as ast.ArrayType)
              : undefined
          const ptrInfo =
            v.resolvedType?.category === ast.TypeCategory.POINTER
              ? { elem: llvmTypeFromAst((v.resolvedType as ast.PointerType).elementType) }
              : undefined
          slot =
            this.getLocal(symbol as any, llvmTy) ||
            this.ensureLocal(
              symbol as any,
              llvmTy,
              argInit ? { type: argInit.type, repr: argInit.repr } : undefined,
              arrInfo,
              undefined,
              ptrInfo
            )
        } else {
          slot = this.getLocal(symbol as any)
        }
        if (v.resolvedType?.category === ast.TypeCategory.ARRAY) {
          const arrType = v.resolvedType as ast.ArrayType
          const arrayInfo = slot.array ?? this.arrayInfoFromType(arrType)
          return { type: `${arrayInfo.elem}*` as LlvmType, repr: slot.ptr, array: arrayInfo }
        }
        const loaded = this.loadValue(slot)
        if (v.resolvedType?.category === ast.TypeCategory.POINTER) {
          const elemTy = llvmTypeFromAst((v.resolvedType as ast.PointerType).elementType)
          loaded.ptr = { elem: elemTy }
        }
        return loaded
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
          if (a.left.resolvedType?.category === ast.TypeCategory.ARRAY) {
            return { type: targetType, repr: slot.ptr, array: slot.array }
          }
          return this.cast(rval, targetType)
        } else if (a.left.kind === ast.NodeKind.INDEX_EXPR) {
          const idx = a.left as ast.IndexExpr
          const base = this.emitExpr(idx.callee)
          if (!base.array) throw new Error("Index assignment requires array")
          const indexVal = this.emitExpr(idx.index)
          const idx32 = this.cast(indexVal, "i32")
          const elemTy = base.array.elem
          const offset = this.fresh("off")
          if (base.array.stride !== 1) {
            this.emit(`${offset} = mul nsw i32 ${idx32.repr}, ${base.array.stride}`)
          }
          const idxFinal = base.array.stride === 1 ? idx32.repr : offset
          const elemPtr = this.fresh("elemPtr")
          this.emit(
            `${elemPtr} = getelementptr ${elemTy}, ${elemTy}* ${base.repr}, i32 ${idxFinal}`
          )
          const rval = this.emitExpr(a.right)
          if (base.array.elemAst.category === ast.TypeCategory.ARRAY) {
            if (!rval.array) throw new Error("Assignment of array requires array value")
            const bytes = this.arrayBytes(rval.array)
            const dstPtr = this.fresh("dstbc")
            const srcPtr = this.fresh("srcbc")
            this.emit(`${dstPtr} = bitcast ${rval.array.elem}* ${elemPtr} to i8*`)
            this.emit(`${srcPtr} = bitcast ${rval.array.elem}* ${rval.repr} to i8*`)
            this.emit(`call void @llvm.memcpy.p0.p0.i64(i8* ${dstPtr}, i8* ${srcPtr}, i64 ${bytes}, i1 0)`)
            return { type: base.array.elem, repr: elemPtr, array: rval.array }
          } else {
            const casted = this.cast(rval, elemTy)
            this.emit(`store ${elemTy} ${casted.repr}, ${elemTy}* ${elemPtr}`)
            return casted
          }
        } else if (a.left.kind === ast.NodeKind.DOT_EXPR) {
          const d = a.left as ast.DotExpr
          const base = this.emitExpr(d.callee)
          if (!base.struct) throw new Error("Member assignment requires struct")
          const idx = base.struct.fields.findIndex((f) => f.name === d.identifier.lexeme)
          if (idx < 0) throw new Error("No such field")
          const field = base.struct.fields[idx]
          const fieldPtr = this.fresh("field")
          this.emit(
            `${fieldPtr} = getelementptr %struct.${base.struct.name}, %struct.${base.struct.name}* ${base.repr}, i32 0, i32 ${idx}`
          )
          const rval = this.emitExpr(a.right)
          const casted = this.cast(rval, field.type)
          this.emit(`store ${field.type} ${casted.repr}, ${field.type}* ${fieldPtr}`)
          return casted
        } else if (a.left.kind === ast.NodeKind.DEREF_EXPR) {
          const d = a.left as ast.DerefExpr
          const ptrVal = this.emitExpr(d.value)
          if (!ptrVal.ptr) throw new Error("Dereference target is not pointer")
          const elemTy = ptrVal.ptr.elem
          const castedPtr = this.fresh("castptr")
          this.emit(`${castedPtr} = bitcast i8* ${ptrVal.repr} to ${elemTy}*`)
          const rval = this.emitExpr(a.right)
          const casted = this.cast(rval, elemTy)
          this.emit(`store ${elemTy} ${casted.repr}, ${elemTy}* ${castedPtr}`)
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
      case ast.NodeKind.TERNARY_EXPR: {
        const t = node as ast.TernaryExpr
        const cond = this.toBool(this.emitExpr(t.condition))
        const thenLabel = this.freshLabel("tern.then")
        const elseLabel = this.freshLabel("tern.else")
        const endLabel = this.freshLabel("tern.end")
        this.emit(`br i1 ${cond.repr}, label %${thenLabel}, label %${elseLabel}`)
        this.emitLabel(thenLabel)
        const thenVal = this.emitExpr(t.thenBranch)
        this.emit(`br label %${endLabel}`)
        this.emitLabel(elseLabel)
        const elseVal = this.emitExpr(t.elseBranch)
        this.emit(`br label %${endLabel}`)
        this.emitLabel(endLabel)
        if (thenVal.type !== elseVal.type) {
          throw new Error("Ternary branch type mismatch in backend.")
        }
        const out = this.fresh("tern")
        this.emit(`${out} = phi ${thenVal.type} [ ${thenVal.repr}, %${thenLabel} ], [ ${elseVal.repr}, %${elseLabel} ]`)
        return { type: thenVal.type, repr: out }
      }
      case ast.NodeKind.GROUP_EXPR: {
        const g = node as ast.GroupExpr
        return this.emitExpr(g.expression)
      }
      case ast.NodeKind.UPDATE_EXPR: {
        const u = node as ast.UpdateExpr
        const operand = u.operand
        const targetType = llvmTypeFromAst(operand.resolvedType!)
        let ptr: string
        if (operand.kind === ast.NodeKind.VARIABLE_EXPR) {
          const sym = (operand as ast.VariableExpr).resolvedSymbol!
          ptr = this.getLocal(sym as any, targetType).ptr
        } else if (operand.kind === ast.NodeKind.INDEX_EXPR) {
          const idx = operand as ast.IndexExpr
          const base = this.emitExpr(idx.callee)
          if (!base.array) throw new Error("Update on non-array index")
          const indexVal = this.cast(this.emitExpr(idx.index), "i32")
          const offset = this.fresh("idxoff")
          if (base.array.stride === 1) this.emit(`${offset} = add i32 0, ${indexVal.repr}`)
          else this.emit(`${offset} = mul nsw i32 ${indexVal.repr}, ${base.array.stride}`)
          const elemPtr = this.fresh("idxptr")
          this.emit(`${elemPtr} = getelementptr ${base.array.elem}, ${base.array.elem}* ${base.repr}, i32 ${offset}`)
          ptr = elemPtr
        } else if (operand.kind === ast.NodeKind.DEREF_EXPR) {
          const dv = this.emitExpr((operand as ast.DerefExpr).value)
          if (!dv.ptr) throw new Error("Dereference target is not pointer")
          const castPtr = this.fresh("updcast")
          this.emit(`${castPtr} = bitcast i8* ${dv.repr} to ${dv.ptr.elem}*`)
          ptr = castPtr
        } else if (operand.kind === ast.NodeKind.DOT_EXPR) {
          const d = operand as ast.DotExpr
          const base = this.emitExpr(d.callee)
          if (!base.struct) throw new Error("Member update requires struct")
          const idx = base.struct.fields.findIndex((f) => f.name === d.identifier.lexeme)
          if (idx < 0) throw new Error("No such field")
          const fieldPtr = this.fresh("fldptr")
          this.emit(
            `${fieldPtr} = getelementptr %struct.${base.struct.name}, %struct.${base.struct.name}* ${base.repr}, i32 0, i32 ${idx}`
          )
          ptr = fieldPtr
        } else {
          throw new Error("Invalid update target")
        }
        const loadedName = this.fresh("upold")
        this.emit(`${loadedName} = load ${targetType}, ${targetType}* ${ptr}`)
        const delta = targetType === "i8" ? "1" : "1"
        const outName = this.fresh("upnew")
        if (u.operator.lexeme === "++") {
          this.emit(`${outName} = add ${targetType} ${loadedName}, ${delta}`)
        } else {
          this.emit(`${outName} = sub ${targetType} ${loadedName}, ${delta}`)
        }
        this.emit(`store ${targetType} ${outName}, ${targetType}* ${ptr}`)
        const resultRepr = u.isPrefix ? outName : loadedName
        return { type: targetType, repr: resultRepr }
      }
      case ast.NodeKind.UNARY_EXPR: {
        const u = node as ast.UnaryExpr
        const val = this.emitExpr(u.value)
        if (u.operator.lexeme === "-") {
          if (val.type === "i32") {
            const out = this.fresh("neg")
            this.emit(`${out} = sub nsw i32 0, ${val.repr}`)
            return { type: "i32", repr: out }
          } else if (val.type === "i8") {
            const widened = this.cast(val, "i32")
            const out = this.fresh("neg")
            this.emit(`${out} = sub nsw i32 0, ${widened.repr}`)
            return { type: "i32", repr: out }
          } else if (val.type === "float") {
            const out = this.fresh("fneg")
            this.emit(`${out} = fsub float -0.0, ${val.repr}`)
            return { type: "float", repr: out }
          }
          throw new Error("Unary minus only supported for int/byte/float right now.")
        }
        if (u.operator.lexeme === "!") {
          if (val.type === "i1") {
            const out = this.fresh("not")
            this.emit(`${out} = xor i1 ${val.repr}, true`)
            return { type: "i1", repr: out }
          }
          throw new Error("Logical not supported only for bool currently.")
        }
        if (u.operator.lexeme === "~") {
          if (val.type === "i32") {
            const out = this.fresh("not")
            this.emit(`${out} = xor i32 ${val.repr}, -1`)
            return { type: "i32", repr: out }
          } else if (val.type === "i8") {
            const out = this.fresh("notb")
            this.emit(`${out} = xor i8 ${val.repr}, 255`)
            return { type: "i8", repr: out }
          }
          throw new Error("Bitwise not supported only for int/byte.")
        }
        if (u.operator.lexeme === "&") {
          if (u.value.kind === ast.NodeKind.VARIABLE_EXPR) {
            const v = u.value as ast.VariableExpr
            const sym = v.resolvedSymbol
            if (!sym || (sym.kind !== ast.SymbolKind.VARIABLE && sym.kind !== ast.SymbolKind.PARAM)) {
              throw new Error("Address-of unsupported target")
            }
            const slot = this.getLocal(sym as any, llvmTypeFromAst(v.resolvedType!))
            const elemTy = slot.array ? slot.array.elem : slot.type
            return this.pointerValue(slot.ptr, elemTy)
          } else if (u.value.kind === ast.NodeKind.INDEX_EXPR) {
            const idx = u.value as ast.IndexExpr
            const base = this.emitExpr(idx.callee)
            if (!base.array) throw new Error("Address-of index requires array")
            const indexVal = this.emitExpr(idx.index)
            const idx32 = this.cast(indexVal, "i32")
            const elemTy = base.array.elem
            const elemPtr = this.fresh("addr_idx")
            this.emit(`${elemPtr} = getelementptr ${elemTy}, ${elemTy}* ${base.repr}, i32 ${idx32.repr}`)
            return this.pointerValue(elemPtr, elemTy)
          } else if (u.value.kind === ast.NodeKind.DOT_EXPR) {
            const d = u.value as ast.DotExpr
            const base = this.emitExpr(d.callee)
            if (!base.struct) throw new Error("Address-of struct field requires struct")
            const structInfo = base.struct
            const idx = structInfo.fields.findIndex((f) => f.name === d.identifier.lexeme)
            if (idx < 0) throw new Error(`No such field ${d.identifier.lexeme}`)
            const field = structInfo.fields[idx]
            const fieldPtr = this.fresh("addr_field")
            this.emit(`${fieldPtr} = getelementptr %struct.${structInfo.name}, %struct.${structInfo.name}* ${base.repr}, i32 0, i32 ${idx}`)
            return this.pointerValue(fieldPtr, field.type)
          } else {
            throw new Error("Address-of unsupported operand")
          }
        }
        throw new Error(`Unsupported unary operator ${u.operator.lexeme}`)
      }
      case ast.NodeKind.DEREF_EXPR: {
        const d = node as ast.DerefExpr
        const ptrVal = this.emitExpr(d.value)
        if (!ptrVal.ptr) throw new Error("Dereference target is not pointer")
        const elemTy = ptrVal.ptr.elem
        const castedPtr = this.fresh("deref")
        this.emit(`${castedPtr} = bitcast i8* ${ptrVal.repr} to ${elemTy}*`)
        const out = this.fresh("ldderef")
        this.emit(`${out} = load ${elemTy}, ${elemTy}* ${castedPtr}`)
        return { type: elemTy, repr: out }
      }
      case ast.NodeKind.BINARY_EXPR: {
        const b = node as ast.BinaryExpr
        let left = this.emitExpr(b.left)
        let right = this.emitExpr(b.right)
        switch (b.operator.lexeme) {
          case "+":
          case "-":
          case "*":
          case "/":
          case "%": {
            // Numeric promotions
            if (left.type === "float" && right.type !== "float") {
              right = this.cast(right.type === "i8" ? this.cast(right, "i32") : right, "float")
            } else if (right.type === "float" && left.type !== "float") {
              left = this.cast(left.type === "i8" ? this.cast(left, "i32") : left, "float")
            } else if ((left.type === "i32" && right.type === "i8") || (left.type === "i8" && right.type === "i32")) {
              left = this.cast(left, "i32")
              right = this.cast(right, "i32")
            }
            if (left.ptr && right.ptr && b.operator.lexeme === "-") {
              if (left.ptr.elem !== right.ptr.elem) throw new Error("Pointer subtraction requires same element type")
              const lpi = this.fresh("lptrint")
              const rpi = this.fresh("rptrint")
              this.emit(`${lpi} = ptrtoint i8* ${left.repr} to i64`)
              this.emit(`${rpi} = ptrtoint i8* ${right.repr} to i64`)
              const diff = this.fresh("ptrdiff")
              this.emit(`${diff} = sub i64 ${lpi}, ${rpi}`)
              const elemSize = this.sizeofLlvm(left.ptr.elem)
              const div = this.fresh("ptrdiv")
              this.emit(`${div} = sdiv i64 ${diff}, ${elemSize}`)
              const out = this.fresh("ptrtrunc")
              this.emit(`${out} = trunc i64 ${div} to i32`)
              return { type: "i32", repr: out }
            }
            // Pointer arithmetic: pointer +/- integer
            if ((left.ptr && right.type === "i32") || (right.ptr && left.type === "i32")) {
              const basePtr = left.ptr ? left : right
              const offsetVal = left.ptr ? right : left
              const elemSize = this.sizeofLlvm(basePtr.ptr!.elem)
              const scale = this.fresh("offset")
              const offCast = this.cast(offsetVal, "i32")
              this.emit(`${scale} = mul nsw i32 ${offCast.repr}, ${elemSize}`)
              const ptrInt = this.fresh("ptrint")
              this.emit(`${ptrInt} = ptrtoint i8* ${basePtr.repr} to i64`)
              const scaled64 = this.fresh("scale64")
              this.emit(`${scaled64} = sext i32 ${scale} to i64`)
              const adjusted = this.fresh("ptradj")
              const op = b.operator.lexeme === "-" ? "sub" : "add"
              this.emit(`${adjusted} = ${op} i64 ${ptrInt}, ${scaled64}`)
              const outPtr = this.fresh("ptrout")
              this.emit(`${outPtr} = inttoptr i64 ${adjusted} to i8*`)
              return this.pointerValue(outPtr, basePtr.ptr!.elem)
            }
            if (left.type === "i32") {
              const op =
                b.operator.lexeme === "+" ? "add nsw" :
                b.operator.lexeme === "-" ? "sub nsw" :
                b.operator.lexeme === "*" ? "mul nsw" :
                b.operator.lexeme === "/" ? "sdiv" : "srem"
              const out = this.fresh("iop")
              this.emit(`${out} = ${op} i32 ${left.repr}, ${right.repr}`)
              return { type: "i32", repr: out }
            } else if (left.type === "i8") {
              const op =
                b.operator.lexeme === "+" ? "add" :
                b.operator.lexeme === "-" ? "sub" :
                b.operator.lexeme === "*" ? "mul" :
                b.operator.lexeme === "/" ? "udiv" : "urem"
              const out = this.fresh("bop")
              this.emit(`${out} = ${op} i8 ${left.repr}, ${right.repr}`)
              return { type: "i8", repr: out }
            } else if (left.type === "float") {
              if (b.operator.lexeme === "%") {
                throw new Error("Remainder not supported for float.")
              }
              const op = b.operator.lexeme === "+" ? "fadd" :
                b.operator.lexeme === "-" ? "fsub" :
                  b.operator.lexeme === "*" ? "fmul" : "fdiv"
              const out = this.fresh("fop")
              this.emit(`${out} = ${op} float ${left.repr}, ${right.repr}`)
              return { type: "float", repr: out }
            }
            throw new Error("Binary arithmetic only implemented for int/float/byte so far.")
          }
          case "&":
          case "|":
          case "^": {
            // bitwise for int/byte
            if (left.type !== right.type) {
              // coerce byte to int if mixed
              if ((left.type === "i8" && right.type === "i32") || (left.type === "i32" && right.type === "i8")) {
                left = this.cast(left, "i32")
                right = this.cast(right, "i32")
              } else {
                throw new Error(`Type mismatch for bitwise op: ${left.type} vs ${right.type}`)
              }
            }
            if (left.type === "i32" || left.type === "i8") {
              const op = b.operator.lexeme === "&" ? "and" : b.operator.lexeme === "|" ? "or" : "xor"
              const out = this.fresh("bop")
              this.emit(`${out} = ${op} ${left.type} ${left.repr}, ${right.repr}`)
              return { type: left.type, repr: out }
            }
            throw new Error("Bitwise ops only supported for int/byte.")
          }
          case "<<":
          case ">>": {
            if (left.type !== right.type) {
              if ((left.type === "i8" && right.type === "i32") || (left.type === "i32" && right.type === "i8")) {
                right = this.cast(right, left.type)
              } else {
                throw new Error(`Type mismatch for shift: ${left.type} vs ${right.type}`)
              }
            }
            if (left.type === "i32") {
              const op = b.operator.lexeme === "<<" ? "shl" : "ashr"
              const out = this.fresh("shift")
              this.emit(`${out} = ${op} i32 ${left.repr}, ${right.repr}`)
              return { type: "i32", repr: out }
            } else if (left.type === "i8") {
              const op = b.operator.lexeme === "<<" ? "shl" : "lshr"
              const out = this.fresh("shiftb")
              this.emit(`${out} = ${op} i8 ${left.repr}, ${right.repr}`)
              return { type: "i8", repr: out }
            }
            throw new Error("Shift ops only supported for int/byte.")
          }
          case "==":
          case "!=": {
            if ((left.type === "float" && right.type !== "float") || (right.type === "float" && left.type !== "float")) {
              left = left.type === "float" ? left : this.cast(left.type === "i8" ? this.cast(left, "i32") : left, "float")
              right = right.type === "float" ? right : this.cast(right.type === "i8" ? this.cast(right, "i32") : right, "float")
            } else if ((left.type === "i32" && right.type === "i8") || (left.type === "i8" && right.type === "i32")) {
              left = this.cast(left, "i32")
              right = this.cast(right, "i32")
            }
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
            if ((left.type === "float" && right.type !== "float") || (right.type === "float" && left.type !== "float")) {
              left = left.type === "float" ? left : this.cast(left.type === "i8" ? this.cast(left, "i32") : left, "float")
              right = right.type === "float" ? right : this.cast(right.type === "i8" ? this.cast(right, "i32") : right, "float")
            } else if ((left.type === "i32" && right.type === "i8") || (left.type === "i8" && right.type === "i32")) {
              left = this.cast(left, "i32")
              right = this.cast(right, "i32")
            }
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
        if (c.callee.kind === ast.NodeKind.VARIABLE_EXPR) {
          const name = (c.callee as ast.VariableExpr).name.lexeme
          // struct construction if name matches struct
          const structInfo = this.structs.get(name)
          if (structInfo) {
            const ptr = this.fresh("struct")
            const structTy = this.structPtrType(structInfo)
            this.addAlloca(`${ptr} = alloca %struct.${structInfo.name}`)
            structInfo.fields.forEach((f, i) => {
              const argVal = this.cast(this.emitExpr(c.args[i]), f.type)
              const fieldPtr = this.fresh("field")
              this.emit(`${fieldPtr} = getelementptr %struct.${structInfo.name}, %struct.${structInfo.name}* ${ptr}, i32 0, i32 ${i}`)
              this.emit(`store ${f.type} ${argVal.repr}, ${f.type}* ${fieldPtr}`)
            })
            return { type: structTy, repr: ptr, struct: structInfo }
          }

          // builtin sqrt
          if (name === "__sqrt__") {
            const arg = this.emitExpr(c.args[0])
            const argd = this.cast(arg, "double")
            const out = this.fresh("sqrt")
            this.emit(`${out} = call double @sqrt(double ${argd.repr})`)
            const outf = this.fresh("sqrtf")
            this.emit(`${outf} = fptrunc double ${out} to float`)
            return { type: "float", repr: outf }
          }
          if (name === "__malloc__") {
            const arg = this.emitExpr(c.args[0])
            const i64v = this.fresh("sz")
            const argi = this.cast(arg, "i32")
            this.emit(`${i64v} = sext i32 ${argi.repr} to i64`)
            const out = this.fresh("malloc")
            this.emit(`${out} = call i8* @malloc(i64 ${i64v})`)
            return { type: "i8*", repr: out, ptr: { elem: "i8" } }
          }
          if (name === "__free__") {
            const arg = this.emitExpr(c.args[0])
            const casted = this.cast(arg, "i8*")
            this.emit(`call void @free(i8* ${casted.repr})`)
            return { type: "i32", repr: "0" }
          }

          const sig =
            this.fnSigs.get(`${name}/${c.args.length}`) ||
            this.fnSigs.get(name) // fallback for builtins or legacy
          if (!sig) {
            throw new Error(`Unknown function ${name}`)
          }
          const args: Value[] = c.args.map((a) => this.emitExpr(a))
          const expectedArgs = sig.retAst.category === ast.TypeCategory.ARRAY ? sig.params.length - 1 : sig.params.length
          if (args.length !== expectedArgs) {
            throw new Error(`Arity mismatch calling ${name}`)
          }
          if (sig.retAst.category === ast.TypeCategory.ARRAY) {
            const arr = sig.retAst as ast.ArrayType
            const info = this.arrayInfoFromType(arr)
            const retAlloca = this.fresh("retarr")
            const total = info.length * info.stride
            this.addAlloca(`${retAlloca} = alloca ${info.elem}, i32 ${total}`)
            const castedArgs = args.map((v, i) => `${sig.params[i + 1]} ${this.cast(v, sig.params[i + 1]).repr}`)
            const argStr = [`${info.elem}* ${retAlloca}`, ...castedArgs].join(", ")
            this.emit(`call void @${sig.mangled ?? name}(${argStr})`)
            return { type: `${info.elem}*` as LlvmType, repr: retAlloca, array: info }
          }
            const argStr = args.map((v, i) => `${sig.params[i]} ${this.cast(v, sig.params[i]).repr}`).join(", ")
          if (sig.ret === "void") {
            this.emit(`call void @${sig.mangled ?? name}(${argStr})`)
            return { type: "i32", repr: "0" }
          } else {
            const out = this.fresh("call")
            this.emit(`${out} = call ${sig.ret} @${sig.mangled ?? name}(${argStr})`)
            if (sig.retAst.category === ast.TypeCategory.POINTER) {
              return { type: sig.ret as LlvmType, repr: out, ptr: { elem: llvmTypeFromAst((sig.retAst as ast.PointerType).elementType) } }
            } else if (sig.retAst.category === ast.TypeCategory.STRUCT) {
              const info = this.structs.get((sig.retAst as ast.StructType).name.lexeme)
              return { type: sig.ret as LlvmType, repr: out, struct: info }
            }
            return { type: sig.ret as LlvmType, repr: out }
          }
        } else {
          throw new Error("Only simple function/struct calls supported")
        }
      }
      case ast.NodeKind.DOT_EXPR: {
        const d = node as ast.DotExpr
        const base = this.emitExpr(d.callee)
        if (!base.struct) {
          throw new Error("Member access on non-struct")
        }
        const structInfo = base.struct
        const idx = structInfo.fields.findIndex((f) => f.name === d.identifier.lexeme)
        if (idx < 0) throw new Error(`No such field ${d.identifier.lexeme}`)
        const field = structInfo.fields[idx]
        const fieldPtr = this.fresh("field")
        this.emit(
          `${fieldPtr} = getelementptr %struct.${structInfo.name}, %struct.${structInfo.name}* ${base.repr}, i32 0, i32 ${idx}`
        )
        const out = this.fresh("ldfld")
        this.emit(`${out} = load ${field.type}, ${field.type}* ${fieldPtr}`)
        return { type: field.type, repr: out }
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
        const offset = this.fresh("idxoff")
        if (base.array.stride === 1) {
          this.emit(`${offset} = add i32 0, ${idx32.repr}`)
        } else {
          this.emit(`${offset} = mul nsw i32 ${idx32.repr}, ${base.array.stride}`)
        }
        const elemPtr = this.fresh("elemPtr")
        this.emit(
          `${elemPtr} = getelementptr ${elemTy}, ${elemTy}* ${base.repr}, i32 ${offset}`
        )
        const calleeType = idx.callee.resolvedType as ast.ArrayType | undefined
        if (calleeType && calleeType.category === ast.TypeCategory.ARRAY && calleeType.elementType.category === ast.TypeCategory.ARRAY) {
          const info = this.arrayInfoFromType(calleeType.elementType as ast.ArrayType)
          return {
            type: `${info.elem}*` as LlvmType,
            repr: elemPtr,
            array: info
          }
        }
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
          const arrType = list.resolvedType as ast.ArrayType
          const info = this.arrayInfoFromType(arrType)
          const total = info.length * info.stride
          const elemTy = info.elem
          const allocaPtr = this.fresh("arr")
          this.addAlloca(`${allocaPtr} = alloca ${elemTy}, i32 ${total}`)
          for (let i = 0; i < elems.length; i++) {
            const val = this.emitExpr(elems[i])
            const offset = this.fresh("eloff")
            if (info.stride === 1) {
              this.emit(`${offset} = add i32 0, ${i}`)
            } else {
              this.emit(`${offset} = mul nsw i32 ${i}, ${info.stride}`)
            }
            const dstPtr = this.fresh("dst")
            this.emit(`${dstPtr} = getelementptr ${elemTy}, ${elemTy}* ${allocaPtr}, i32 ${offset}`)
            if (val.array) {
              const bytes = this.arrayBytes(val.array)
              const dstbc = this.fresh("dstbc")
              const srcbc = this.fresh("srcbc")
              this.emit(`${dstbc} = bitcast ${val.array.elem}* ${dstPtr} to i8*`)
              this.emit(`${srcbc} = bitcast ${val.array.elem}* ${val.repr} to i8*`)
              this.emit(`call void @llvm.memcpy.p0.p0.i64(i8* ${dstbc}, i8* ${srcbc}, i64 ${bytes}, i1 0)`)
            } else {
              const casted = this.cast(val, elemTy)
              this.emit(`store ${elemTy} ${casted.repr}, ${elemTy}* ${dstPtr}`)
            }
          }
          return { type: `${elemTy}*` as LlvmType, repr: allocaPtr, array: info }
        } else {
          const arrType = list.resolvedType as ast.ArrayType
          const info = this.arrayInfoFromType(arrType)
          const initVal = this.emitExpr(list.initializer.value)
          const length = list.initializer.length
          const total = length * info.stride
          const elemTy = info.elem
          const allocaPtr = this.fresh("arrrep")
          this.addAlloca(`${allocaPtr} = alloca ${elemTy}, i32 ${total}`)
          for (let i = 0; i < length; i++) {
            const offset = this.fresh("idxoff")
            if (info.stride === 1) this.emit(`${offset} = add i32 0, ${i}`)
            else this.emit(`${offset} = mul nsw i32 ${i}, ${info.stride}`)
            const idxPtr = this.fresh("idxptr")
            this.emit(`${idxPtr} = getelementptr ${elemTy}, ${elemTy}* ${allocaPtr}, i32 ${offset}`)
            if (initVal.array) {
              const bytes = this.arrayBytes(initVal.array)
              const dstbc = this.fresh("dstbc")
              const srcbc = this.fresh("srcbc")
              this.emit(`${dstbc} = bitcast ${initVal.array.elem}* ${idxPtr} to i8*`)
              this.emit(`${srcbc} = bitcast ${initVal.array.elem}* ${initVal.repr} to i8*`)
              this.emit(`call void @llvm.memcpy.p0.p0.i64(i8* ${dstbc}, i8* ${srcbc}, i64 ${bytes}, i1 0)`)
            } else {
              const casted = this.cast(initVal, elemTy)
              this.emit(`store ${elemTy} ${casted.repr}, ${elemTy}* ${idxPtr}`)
            }
          }
          return { type: `${elemTy}*` as LlvmType, repr: allocaPtr, array: info }
        }
      }
      default:
        throw new Error("Unsupported expression kind")
    }
  }

  private cast(value: Value, target: LlvmType): Value {
    if (value.type === target) return value
    const isPtr = (t: LlvmType) => t.endsWith("*")
    if (isPtr(value.type) && isPtr(target)) {
      const out = this.fresh("bitcast")
      this.emit(`${out} = bitcast ${value.type} ${value.repr} to ${target}`)
      return { type: target, repr: out, array: value.array, ptr: value.ptr, struct: value.struct }
    }
    if (isPtr(value.type) && target === "i32") {
      const out = this.fresh("ptrtoi32")
      this.emit(`${out} = ptrtoint ${value.type} ${value.repr} to i32`)
      return { type: "i32", repr: out }
    }
    const out = this.fresh("cast")
    if (value.type === "i1" && target === "i32") {
      this.emit(`${out} = zext i1 ${value.repr} to i32`)
      return { type: "i32", repr: out }
    }
    if (value.type === "i8" && target === "i32") {
      this.emit(`${out} = zext i8 ${value.repr} to i32`)
      return { type: "i32", repr: out }
    }
    if (value.type === "i8" && target === "float") {
      const ext = this.fresh("castzext")
      this.emit(`${ext} = zext i8 ${value.repr} to i32`)
      this.emit(`${out} = sitofp i32 ${ext} to float`)
      return { type: "float", repr: out }
    }
    if (value.type === "i8" && target === "double") {
      const ext = this.fresh("castzext")
      this.emit(`${ext} = zext i8 ${value.repr} to i32`)
      this.emit(`${out} = sitofp i32 ${ext} to double`)
      return { type: "double", repr: out }
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

  private pointerValue(ptrRepr: string, elem: LlvmType): Value {
    return { type: "i8*", repr: ptrRepr, ptr: { elem } }
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
        const fmtPtr = this.module.gepStringPtr("%.9g\n")
        this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, double ${widened.repr})`)
        break
      }
      case ast.TypeCategory.ARRAY: {
        if (ast.isEqual(resolvedType.elementType, ast.ByteType)) {
          const fmtPtr = this.module.gepStringPtr("%.*s\n")
          const lenConst = resolvedType.length
          this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, i32 ${lenConst}, i8* ${val.repr})`)
          break
        }
        // Print numeric arrays recursively: [a, b, c]
        const elemTy = resolvedType.elementType
        const len = resolvedType.length
        this.emitPrintArray(val, elemTy, len)
        break
      }
      case ast.TypeCategory.POINTER: {
        const fmtPtr = this.module.gepStringPtr("%p\n")
        const casted = this.cast(val, "i8*")
        this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, i8* ${casted.repr})`)
        break
      }
      default:
        throw new Error(`Printing unsupported type ${ast.typeToString(resolvedType)}`)
    }
  }

  private emitPrintArray(arr: Value, elemTyAst: ast.Type, length: number, stride?: number, trailingNewline = true) {
    const info =
      arr.array && arr.array.elemAst
        ? arr.array
        : elemTyAst.category === ast.TypeCategory.ARRAY
          ? this.arrayInfoFromType(elemTyAst as ast.ArrayType)
          : { elem: llvmTypeFromAst(elemTyAst), elemAst: elemTyAst, length, stride: 1 }
    const elemTy = info.elem
    const effStride = stride ?? info.stride
    this.emitPrintRawString("[")
    for (let i = 0; i < length; i++) {
      const offset = this.fresh("printoff")
      if (effStride === 1) this.emit(`${offset} = add i32 0, ${i}`)
      else this.emit(`${offset} = mul nsw i32 ${i}, ${effStride}`)
      const idxPtr = this.fresh("idxptr")
      this.emit(`${idxPtr} = getelementptr ${elemTy}, ${elemTy}* ${arr.repr}, i32 ${offset}`)
      if (elemTyAst.category === ast.TypeCategory.ARRAY) {
        const inner = elemTyAst as ast.ArrayType
        const innerInfo = this.arrayInfoFromType(inner)
        const innerStride = innerInfo.stride
        this.emitPrintArray({ type: innerInfo.elem, repr: idxPtr, array: innerInfo }, inner.elementType, inner.length, innerStride, false)
      } else {
        const ld = this.fresh("ldel")
        this.emit(`${ld} = load ${elemTy}, ${elemTy}* ${idxPtr}`)
        this.emitPrintScalar({ type: elemTy, repr: ld })
      }
      if (i !== length - 1) this.emitPrintRawString(", ")
    }
    this.emitPrintRawString(trailingNewline ? "]\n" : "]")
  }

  private emitPrintRawString(s: string) {
    const fmtPtr = this.module.gepStringPtr(s.includes("%") ? s.replace(/%/g, "%%") : s)
    this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr})`)
  }

  private emitPrintScalar(val: Value) {
    switch (val.type) {
      case "i32": {
        const fmtPtr = this.module.gepStringPtr("%d")
        this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, i32 ${val.repr})`)
        break
      }
      case "i8": {
        const fmtPtr = this.module.gepStringPtr("%d")
        const widened = this.cast(val, "i32")
        this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, i32 ${widened.repr})`)
        break
      }
      case "float": {
        const fmtPtr = this.module.gepStringPtr("%.9g")
        const widened = this.cast(val, "double")
        this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, double ${widened.repr})`)
        break
      }
      case "i1": {
        const fmtPtr = this.module.gepStringPtr("%d")
        const widened = this.cast(val, "i32")
        this.emit(`call i32 (i8*, ...) @printf(i8* ${fmtPtr}, i32 ${widened.repr})`)
        break
      }
      default:
        throw new Error("Unsupported scalar print")
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
        if (initVal.array) {
          const slot = this.ensureLocal(symbol, ty, undefined, initVal.array)
          this.storeValue(slot, initVal)
        } else {
          const slot = this.getLocal(symbol, ty)
          this.storeValue(slot, initVal)
        }
        break
      }
      case ast.NodeKind.EXPRESSION_STMT: {
        const e = stmt as ast.ExpressionStmt
        this.emitExpr(e.expression)
        break
      }
      case ast.NodeKind.RETURN_STMT: {
        const r = stmt as ast.ReturnStmt
        if (this.fnReturnTypeAst?.category === ast.TypeCategory.ARRAY && this.arrayReturnDest) {
          const val = r.value ? this.emitExpr(r.value) : { type: this.arrayReturnDest.type, repr: "undef", array: this.arrayReturnDest.array }
          this.storeValue(this.arrayReturnDest, val)
          this.emit("ret void")
        } else {
          if (r.value) {
            const val = this.emitExpr(r.value)
            if (this.functionRetType === "void") {
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
      case ast.NodeKind.SWITCH_STMT: {
        const sw = stmt as ast.SwitchStmt
        const condVal = this.emitExpr(sw.expression)
        let condRepr = condVal.repr
        let condType = condVal.type
        if (condType === "i8" || condType === "i1") {
          const widened = this.cast(condVal, "i32")
          condRepr = widened.repr
          condType = "i32"
        }
        if (condType !== "i32") {
          throw new Error("Switch condition must be int/byte/bool")
        }
        const endLabel = this.freshLabel("switch.end")
        this.loopStack.push({ breakLabel: endLabel, continueLabel: endLabel })
        const caseLabels = sw.cases.map((_, i) => this.freshLabel(`case${i}`))
        const defaultIdx = sw.cases.findIndex((c) => c.value === null)
        const defaultLabel = defaultIdx >= 0 ? caseLabels[defaultIdx] : endLabel
        const valueCases = sw.cases
          .map((c, i) => ({ c, i }))
          .filter((ci) => ci.c.value !== null)
        const checkLabels = valueCases.map((_, i) => this.freshLabel(`switch.check${i}`))
        if (checkLabels.length === 0) {
          this.emit(`br label %${defaultLabel}`)
        } else {
          this.emit(`br label %${checkLabels[0]}`)
          valueCases.forEach((vc, idx) => {
            this.emitLabel(checkLabels[idx])
            const val = this.emitExpr(vc.c.value!)
            const casted = this.cast(val, condType as LlvmType)
            const cmp = this.fresh("swcmp")
            this.emit(`${cmp} = icmp eq ${condType} ${condRepr}, ${casted.repr}`)
            const nextLabel = idx + 1 < checkLabels.length ? checkLabels[idx + 1] : defaultLabel
            this.emit(`br i1 ${cmp}, label %${caseLabels[vc.i]}, label %${nextLabel}`)
          })
        }
        // emit cases
        sw.cases.forEach((c, idx) => {
          const label = c.value === null ? defaultLabel : caseLabels[idx]
          this.emitLabel(label)
          c.statements.forEach((s) => this.emitStmt(s))
          if (!this.terminated) this.emit(`br label %${endLabel}`)
          this.terminated = false
        })
        this.loopStack.pop()
        this.emitLabel(endLabel)
        break
      }
      case ast.NodeKind.WHILE_STMT: {
        const w = stmt as ast.WhileStmt
        const condLabel = this.freshLabel("loop.cond")
        const bodyLabel = this.freshLabel("loop.body")
        const incLabel = w.increment ? this.freshLabel("loop.inc") : condLabel
        const endLabel = this.freshLabel("loop.end")
        this.emit(`br label %${condLabel}`)
        this.emitLabel(condLabel)
        const cond = this.emitCondition(w.expression)
        this.emit(`br i1 ${cond}, label %${bodyLabel}, label %${endLabel}`)
        this.loopStack.push({ breakLabel: endLabel, continueLabel: incLabel })
        this.emitLabel(bodyLabel)
        this.emitStmt(w.body)
        if (!this.terminated) {
          this.emit(`br label %${incLabel}`)
        }
        this.terminated = false
        if (w.increment) {
          this.emitLabel(incLabel)
          this.emitExpr(w.increment.expression)
          this.emit(`br label %${condLabel}`)
        }
        this.loopStack.pop()
        this.emitLabel(endLabel)
        break
      }
      case ast.NodeKind.BLOCK_STMT: {
        const b = stmt as ast.BlockStmt
        b.statements.forEach((s) => this.emitStmt(s))
        break
      }
      case ast.NodeKind.LOOP_CONTROL_STMT: {
        const lc = stmt as ast.LoopControlStmt
        if (this.loopStack.length === 0) {
          throw new Error("Loop control used outside of loop")
        }
        const top = this.loopStack[this.loopStack.length - 1]
        if (lc.keyword.lexeme === "break") {
          this.emit(`br label %${top.breakLabel}`)
        } else {
          this.emit(`br label %${top.continueLabel}`)
        }
        this.terminated = true
        break
      }
      default:
        const _exhaustive: never = stmt as never
        throw new Error(`Unsupported statement kind in LLVM backend.`)
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

  buildFunction(fn: ast.FunctionStmt, mangledName: string, isExported = false): string {
    this.paramSlotsByName.clear()
    this.paramArgsByName.clear()
    this.currentFunctionName = mangledName
    this.arrayReturnDest = null
    // Force main to return i32 for proper process exit codes.
    if (fn.name.lexeme === "main") {
      this.functionRetType = "i32"
    } else if (fn.returnType.category === ast.TypeCategory.ARRAY) {
      this.functionRetType = "void"
    } else {
      this.functionRetType = llvmReturnTypeFromAst(fn.returnType)
    }
    this.fnReturnTypeAst = fn.returnType
    const retTy = this.functionRetType
    // Build function signature with named params
    const paramNames: string[] = []
    const paramTypes: LlvmType[] = []
    if (fn.returnType.category === ast.TypeCategory.ARRAY) {
      const arr = fn.returnType as ast.ArrayType
      const info = this.arrayInfoFromType(arr)
      paramNames.push(this.fresh("retptr"))
      paramTypes.push(`${info.elem}*` as LlvmType)
      this.arrayReturnDest = { ptr: paramNames[0], type: info.elem, array: info }
    }
    fn.params.forEach((p) => {
      if (p.type.category === ast.TypeCategory.ARRAY) {
        const info = this.arrayInfoFromType(p.type as ast.ArrayType)
        paramNames.push(this.fresh(p.name.lexeme.replace(/[^a-zA-Z0-9]/g, "p")))
        paramTypes.push(`${info.elem}*` as LlvmType)
      } else {
        paramNames.push(this.fresh(p.name.lexeme.replace(/[^a-zA-Z0-9]/g, "p")))
        paramTypes.push(llvmTypeFromAst(p.type))
      }
    })
    const paramSig = paramTypes.map((t, i) => `${t} ${paramNames[i]}`).join(", ")
    const realHeader = `${isExported ? "define" : "define internal"} ${retTy} @${mangledName}(${paramSig}) {`
    this.lines.push(realHeader)
    this.lines.push("entry:")
    // params allocas and stores
    let paramOffset = 0
    if (fn.returnType.category === ast.TypeCategory.ARRAY) {
      paramOffset = 1
    }
    fn.params.forEach((p, i) => {
      const isArr = p.type.category === ast.TypeCategory.ARRAY
      const llvmTy = isArr ? (`${llvmTypeFromAst(baseElemType(p.type as ast.ArrayType))}*` as LlvmType) : llvmTypeFromAst(p.type)
      let arrayInfo: ArrayInfo | undefined
      let structInfo: StructInfo | undefined
      let ptrInfo: PointerInfo | undefined
      if (isArr) {
        arrayInfo = this.arrayInfoFromType(p.type as ast.ArrayType)
      } else if (p.type.category === ast.TypeCategory.STRUCT) {
        structInfo = this.structs.get(p.type.name.lexeme)
      } else if (p.type.category === ast.TypeCategory.POINTER) {
        ptrInfo = { elem: llvmTypeFromAst((p.type as ast.PointerType).elementType) }
      }
      const ptr = this.fresh("param")
      if (isArr && arrayInfo) {
        const total = arrayInfo.length * arrayInfo.stride
        this.addAlloca(`${ptr} = alloca ${arrayInfo.elem}, i32 ${total}`)
      } else {
        this.addAlloca(`${ptr} = alloca ${llvmTy}`)
      }
      const incoming = paramNames[i + paramOffset]
      if (isArr && arrayInfo) {
        const dstbc = this.fresh("dstbc")
        const srcbc = this.fresh("srcbc")
        const bytes = this.arrayBytes(arrayInfo)
        this.lines.push(`  ${dstbc} = bitcast ${arrayInfo.elem}* ${ptr} to i8*`)
        this.lines.push(`  ${srcbc} = bitcast ${llvmTy} ${incoming} to i8*`)
        this.lines.push(`  call void @llvm.memcpy.p0.p0.i64(i8* ${dstbc}, i8* ${srcbc}, i64 ${bytes}, i1 0)`)
      } else {
        this.lines.push(`  store ${llvmTy} ${incoming}, ${llvmTy}* ${ptr}`)
      }
      const entry = { ptr, type: llvmTy, array: arrayInfo, struct: structInfo, ptrInfo }
      this.paramSlotsByName.set(p.name.lexeme, entry)
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
  module.emitRuntime()
  const functions = context.topLevelStatements.filter(
    (s) => s.kind === ast.NodeKind.FUNCTION_STMT
  ) as ast.FunctionStmt[]
  const fnSigs = new Map<string, { ret: LlvmType | "void"; params: LlvmType[]; retAst: ast.Type; mangled: string }>()
  const globalsMap = new Map<number, { ptr: string; type: LlvmType; array?: ArrayInfo; ptrInfo?: PointerInfo; struct?: StructInfo }>()
  const globalsByName = new Map<string, { ptr: string; type: LlvmType; array?: ArrayInfo; ptrInfo?: PointerInfo; struct?: StructInfo }>()
  const structInfos = new Map<string, StructInfo>()

  const structs = context.topLevelStatements.filter(
    (s) => s.kind === ast.NodeKind.STRUCT_STMT
  ) as ast.StructStmt[]

  structs.forEach((s) => {
    const fields = s.members.map((m) => ({
      name: m.name.lexeme,
      type: llvmTypeFromAst(m.type)
    }))
    const info: StructInfo = { name: s.name.lexeme, fields }
    structInfos.set(s.name.lexeme, info)
    const fieldsStr = fields.map((f) => f.type).join(", ")
    module.addTypeDef(`%struct.${s.name.lexeme} = type { ${fieldsStr} }`)
  })

  const arrayInfoFromTypeFn = (arr: ast.ArrayType): ArrayInfo => {
    const base = baseElemType(arr)
    const strideOf = (t: ast.Type): number => {
      if (t.category !== ast.TypeCategory.ARRAY) return 1
      const inner = t as ast.ArrayType
      return inner.length * strideOf(inner.elementType)
    }
    return { elem: llvmTypeFromAst(base), elemAst: arr.elementType, length: arr.length, stride: strideOf(arr.elementType) }
  }

  const globalVars = context.topLevelStatements.filter(
    (s) => s.kind === ast.NodeKind.VAR_STMT
  ) as ast.VarStmt[]

  globalVars.forEach((v) => {
    if (!v.symbol) return
    if (!(v.symbol as ast.VariableSymbol).isGlobal) return
    const llvmTy = llvmTypeFromAst(v.type!)
    const name = v.name.lexeme
    const linkage = v.isExported ? "" : "internal "
    let initVal = "0"
    if (llvmTy === "float" || llvmTy === "double") initVal = "0.0"
    if (v.type?.category === ast.TypeCategory.ARRAY) {
      const arr = v.type as ast.ArrayType
      const info = arrayInfoFromTypeFn(arr)
      const total = info.length * info.stride
      module.addGlobal(`@${name} = ${linkage}global [${total} x ${info.elem}] zeroinitializer`)
      const elemPtr = `getelementptr inbounds ([${total} x ${info.elem}], [${total} x ${info.elem}]* @${name}, i64 0, i64 0)`
      globalsMap.set(v.symbol.id, { ptr: elemPtr, type: info.elem, array: info })
      globalsByName.set(name, { ptr: elemPtr, type: info.elem, array: info })
    } else if (v.type?.category === ast.TypeCategory.POINTER) {
      module.addGlobal(`@${name} = ${linkage}global i8* null`)
      const elemTy = llvmTypeFromAst((v.type as ast.PointerType).elementType)
      globalsMap.set(v.symbol.id, { ptr: `@${name}`, type: "i8*", ptrInfo: { elem: elemTy } })
      globalsByName.set(name, { ptr: `@${name}`, type: "i8*", ptrInfo: { elem: elemTy } })
    } else {
      module.addGlobal(`@${name} = ${linkage}global ${llvmTy} ${initVal}`)
      globalsMap.set(v.symbol.id, { ptr: `@${name}`, type: llvmTy })
      globalsByName.set(name, { ptr: `@${name}`, type: llvmTy })
    }
  })

  functions.forEach((fn) => {
    const isArrayRet = fn.returnType.category === ast.TypeCategory.ARRAY
    let ret: LlvmType | "void"
    if (fn.name.lexeme === "main") ret = "i32"
    else ret = isArrayRet ? "void" : llvmReturnTypeFromAst(fn.returnType)
    let params = fn.params.map((p) =>
      p.type.category === ast.TypeCategory.ARRAY
        ? (`${llvmTypeFromAst(baseElemType(p.type as ast.ArrayType))}*` as LlvmType)
        : llvmTypeFromAst(p.type)
    )
    if (isArrayRet) {
      const arr = fn.returnType as ast.ArrayType
      const elemTy = llvmTypeFromAst(baseElemType(arr))
      params = [`${elemTy}*` as LlvmType, ...params]
    }
    const key = `${fn.name.lexeme}/${fn.params.length}`
    const mangled = fn.isImported ? fn.name.lexeme : (fn.name.lexeme === "main" ? "main" : `${fn.name.lexeme}__${fn.params.length}`)
    fnSigs.set(key, { ret, params, retAst: fn.returnType, mangled })
  })
  // Built-ins
  fnSigs.set("__sqrt__/1", { ret: "float", params: ["float"], retAst: ast.FloatType, mangled: "__sqrt__" })
  fnSigs.set("__malloc__/1", { ret: "i8*", params: ["i32"], retAst: ast.ptrType(ast.ByteType), mangled: "__malloc__" })
  fnSigs.set("__free__/1", { ret: "void", params: ["i8*"], retAst: ast.VoidType, mangled: "__free__" })
  const mainFn = functions.find((fn) => fn.name.lexeme === "main")
  if (!mainFn) {
    throw new Error("Program must define a 'main' function.")
  }

  if (context.globalInitOrder && context.globalInitOrder.length > 0) {
    fnSigs.set("__init_globals__", { ret: "void", params: [], retAst: ast.VoidType, mangled: "__init_globals__" })
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
    const initBuilder = new FunctionBuilder(module, fnSigs, globalsMap, globalsByName, structInfos)
    module.addFunction(initBuilder.buildFunction(initFn, "__init_globals__"))
  }

  functions.forEach((fn) => {
    if (!fn.body) {
      // imported function: declare externally
      const sig = fnSigs.get(`${fn.name.lexeme}/${fn.params.length}`)!
      const paramSig = sig.params.map((t, i) => `${t} %p${i}`).join(", ")
      module.addFunction(`declare ${sig.ret} @${sig.mangled}(${paramSig})`)
      return
    }
    const fnBuilder = new FunctionBuilder(module, fnSigs, globalsMap, globalsByName, structInfos)
    const mangled = fn.isImported ? fn.name.lexeme : (fn.name.lexeme === "main" ? "main" : `${fn.name.lexeme}__${fn.params.length}`)
    module.addFunction(fnBuilder.buildFunction(fn, mangled, !!fn.isExported || fn.name.lexeme === "main"))
  })
  return module.build()
}
