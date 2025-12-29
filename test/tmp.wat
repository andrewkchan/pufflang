(module
  (import "io" "log" (func $__log_i32__ (param i32)))
  (import "io" "log" (func $__log_f32__ (param f32)))
  (import "io" "putchar" (func $__putc__ (param i32)))
  (import "io" "putf" (func $__putf__ (param f32)))
  (import "io" "puti" (func $__puti__ (param i32)))
  (import "io" "flush" (func $__flush__))
  (memory $memory 128)
  (global $__stack_ptr__ (mut i32) i32.const 524288)
  (func (export "__init_globals__")
    (local $__base_ptr__ i32)
    (local $__tee_i32__ i32)
    (local $__tee_f32__ f32)
    (local $__swapa_i32__ i32)
    (local $__swapb_i32__ i32)
    (local $__swapb_f32__ f32)
    (local $__swapa_f32__ f32)
    global.get $__stack_ptr__
    local.set $__base_ptr__
    local.get $__base_ptr__
    global.set $__stack_ptr__
  )
  (func $__memcpy__ (param $src i32) (param $dst i32) (param $numBytes i32)
    (block $0
      (loop $1
        local.get $numBytes
        i32.const 0
        i32.gt_s
        i32.eqz
        br_if $0
        local.get $dst
        local.get $src
        i32.load8_u
        i32.store8
        local.get $src
        i32.const 1
        i32.add
        local.set $src
        local.get $dst
        i32.const 1
        i32.add
        local.set $dst
        local.get $numBytes
        i32.const 1
        i32.sub
        local.set $numBytes
        
        br $1
      )
    )
  )
  (func $__sqrt__ (param $x f32) (result f32)
  local.get $x
  f32.sqrt
  )
  
  ;; visit FUNCTION_STMT
  ;; (def mul ((param A (struct ((mat (arraytype 2 (arraytype 2 float)))))) (param v (struct ((x float)(y float))))) ((return (call Vector ((+ (* (index (index (. A mat) 0) 0) (. v x)) (* (index (index (. A mat) 0) 1) (. v y))) (+ (* (index (index (. A mat) 1) 0) (. v x)) (* (index (index (. A mat) 1) 1) (. v y))))))))
  
  (func $mul
    (param $A_2 i32)
    (param $v_3 i32)
    (result i32)
    (local $__base_ptr__ i32)
    (local $__tee_i32__ i32)
    (local $__tee_f32__ f32)
    (local $__swapa_i32__ i32)
    (local $__swapb_i32__ i32)
    (local $__swapb_f32__ f32)
    (local $__swapa_f32__ f32)
    global.get $__stack_ptr__
    local.set $__base_ptr__
    global.get $__stack_ptr__
    i32.const 24
    i32.sub
    global.set $__stack_ptr__
    local.get $A_2
    local.get $__base_ptr__
    i32.const 16
    i32.sub
    i32.const 16
    call $__memcpy__
    local.get $__base_ptr__
    i32.const 16
    i32.sub
    local.get $v_3
    local.get $__base_ptr__
    i32.const 24
    i32.sub
    i32.const 8
    call $__memcpy__
    local.get $__base_ptr__
    i32.const 24
    i32.sub
    
    ;; visit RETURN_STMT
    ;; (return (call Vector ((+ (* (index (index (. A mat) 0) 0) (. v x)) (* (index (index (. A mat) 0) 1) (. v y))) (+ (* (index (index (. A mat) 1) 0) (. v x)) (* (index (index (. A mat) 1) 1) (. v y))))))
    
    
    ;; visit CALL_EXPR
    ;; (call Vector ((+ (* (index (index (. A mat) 0) 0) (. v x)) (* (index (index (. A mat) 0) 1) (. v y))) (+ (* (index (index (. A mat) 1) 0) (. v x)) (* (index (index (. A mat) 1) 1) (. v y)))))
    
    global.get $__stack_ptr__
    i32.const 8
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    
    ;; visit INDEX_EXPR
    ;; (index (index (. A mat) 0) 0)
    
    ;;       return Vector{A.mat[0][0] * v.x + A.mat[0][1] * v.y,
    ;;                             ^
    
    
    ;; visit INDEX_EXPR
    ;; (index (. A mat) 0)
    
    ;;       return Vector{A.mat[0][0] * v.x + A.mat[0][1] * v.y,
    ;;                          ^
    
    
    ;; visit DOT_EXPR
    ;; (. A mat)
    
    ;;       return Vector{A.mat[0][0] * v.x + A.mat[0][1] * v.y,
    ;;                      ^
    
    local.get $__base_ptr__
    i32.const 16
    i32.sub
    i32.const 0
    i32.add
    i32.const 0
    i32.const 8
    i32.mul
    i32.add
    i32.const 0
    i32.const 4
    i32.mul
    i32.add
    f32.load
    
    ;; visit DOT_EXPR
    ;; (. v x)
    
    ;;       return Vector{A.mat[0][0] * v.x + A.mat[0][1] * v.y,
    ;;                                    ^
    
    local.get $__base_ptr__
    i32.const 24
    i32.sub
    i32.const 0
    i32.add
    f32.load
    f32.mul
    
    ;; visit INDEX_EXPR
    ;; (index (index (. A mat) 0) 1)
    
    ;;       return Vector{A.mat[0][0] * v.x + A.mat[0][1] * v.y,
    ;;                                                 ^
    
    
    ;; visit INDEX_EXPR
    ;; (index (. A mat) 0)
    
    ;;       return Vector{A.mat[0][0] * v.x + A.mat[0][1] * v.y,
    ;;                                              ^
    
    
    ;; visit DOT_EXPR
    ;; (. A mat)
    
    ;;       return Vector{A.mat[0][0] * v.x + A.mat[0][1] * v.y,
    ;;                                          ^
    
    local.get $__base_ptr__
    i32.const 16
    i32.sub
    i32.const 0
    i32.add
    i32.const 0
    i32.const 8
    i32.mul
    i32.add
    i32.const 1
    i32.const 4
    i32.mul
    i32.add
    f32.load
    
    ;; visit DOT_EXPR
    ;; (. v y)
    
    ;;       return Vector{A.mat[0][0] * v.x + A.mat[0][1] * v.y,
    ;;                                                        ^
    
    local.get $__base_ptr__
    i32.const 24
    i32.sub
    i32.const 4
    i32.add
    f32.load
    f32.mul
    f32.add
    f32.store
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 4
    i32.add
    
    ;; visit INDEX_EXPR
    ;; (index (index (. A mat) 1) 0)
    
    ;;                     A.mat[1][0] * v.x + A.mat[1][1] * v.y};
    ;;                             ^
    
    
    ;; visit INDEX_EXPR
    ;; (index (. A mat) 1)
    
    ;;                     A.mat[1][0] * v.x + A.mat[1][1] * v.y};
    ;;                          ^
    
    
    ;; visit DOT_EXPR
    ;; (. A mat)
    
    ;;                     A.mat[1][0] * v.x + A.mat[1][1] * v.y};
    ;;                      ^
    
    local.get $__base_ptr__
    i32.const 16
    i32.sub
    i32.const 0
    i32.add
    i32.const 1
    i32.const 8
    i32.mul
    i32.add
    i32.const 0
    i32.const 4
    i32.mul
    i32.add
    f32.load
    
    ;; visit DOT_EXPR
    ;; (. v x)
    
    ;;                     A.mat[1][0] * v.x + A.mat[1][1] * v.y};
    ;;                                    ^
    
    local.get $__base_ptr__
    i32.const 24
    i32.sub
    i32.const 0
    i32.add
    f32.load
    f32.mul
    
    ;; visit INDEX_EXPR
    ;; (index (index (. A mat) 1) 1)
    
    ;;                     A.mat[1][0] * v.x + A.mat[1][1] * v.y};
    ;;                                                 ^
    
    
    ;; visit INDEX_EXPR
    ;; (index (. A mat) 1)
    
    ;;                     A.mat[1][0] * v.x + A.mat[1][1] * v.y};
    ;;                                              ^
    
    
    ;; visit DOT_EXPR
    ;; (. A mat)
    
    ;;                     A.mat[1][0] * v.x + A.mat[1][1] * v.y};
    ;;                                          ^
    
    local.get $__base_ptr__
    i32.const 16
    i32.sub
    i32.const 0
    i32.add
    i32.const 1
    i32.const 8
    i32.mul
    i32.add
    i32.const 1
    i32.const 4
    i32.mul
    i32.add
    f32.load
    
    ;; visit DOT_EXPR
    ;; (. v y)
    
    ;;                     A.mat[1][0] * v.x + A.mat[1][1] * v.y};
    ;;                                                        ^
    
    local.get $__base_ptr__
    i32.const 24
    i32.sub
    i32.const 4
    i32.add
    f32.load
    f32.mul
    f32.add
    f32.store
    local.get $__base_ptr__
    global.set $__stack_ptr__
    return
    local.get $__base_ptr__
    global.set $__stack_ptr__
  )
  
  ;; visit FUNCTION_STMT
  ;; (def ident () ((return (call Matrix ((list-initializer (list-initializer 1.0 0.0) (list-initializer 0.0 1.0)))))))
  
  (func $ident
    (result i32)
    (local $__base_ptr__ i32)
    (local $__tee_i32__ i32)
    (local $__tee_f32__ f32)
    (local $__swapa_i32__ i32)
    (local $__swapb_i32__ i32)
    (local $__swapb_f32__ f32)
    (local $__swapa_f32__ f32)
    global.get $__stack_ptr__
    local.set $__base_ptr__
    global.get $__stack_ptr__
    i32.const 0
    i32.sub
    global.set $__stack_ptr__
    
    ;; visit RETURN_STMT
    ;; (return (call Matrix ((list-initializer (list-initializer 1.0 0.0) (list-initializer 0.0 1.0)))))
    
    
    ;; visit CALL_EXPR
    ;; (call Matrix ((list-initializer (list-initializer 1.0 0.0) (list-initializer 0.0 1.0))))
    
    global.get $__stack_ptr__
    i32.const 16
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    
    ;; visit LIST_EXPR
    ;; (list-initializer (list-initializer 1.0 0.0) (list-initializer 0.0 1.0))
    
    global.get $__stack_ptr__
    i32.const 16
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    
    ;; visit LIST_EXPR
    ;; (list-initializer 1.0 0.0)
    
    global.get $__stack_ptr__
    i32.const 8
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    f32.const 1
    f32.store
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 4
    i32.add
    f32.const 0
    f32.store
    local.set $__swapa_i32__
    local.set $__swapb_i32__
    local.get $__swapa_i32__
    local.get $__swapb_i32__
    i32.const 8
    call $__memcpy__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 8
    i32.add
    
    ;; visit LIST_EXPR
    ;; (list-initializer 0.0 1.0)
    
    global.get $__stack_ptr__
    i32.const 8
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    f32.const 0
    f32.store
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 4
    i32.add
    f32.const 1
    f32.store
    local.set $__swapa_i32__
    local.set $__swapb_i32__
    local.get $__swapa_i32__
    local.get $__swapb_i32__
    i32.const 8
    call $__memcpy__
    local.set $__swapa_i32__
    local.set $__swapb_i32__
    local.get $__swapa_i32__
    local.get $__swapb_i32__
    i32.const 16
    call $__memcpy__
    local.get $__base_ptr__
    global.set $__stack_ptr__
    return
    local.get $__base_ptr__
    global.set $__stack_ptr__
  )
  
  ;; visit FUNCTION_STMT
  ;; (def rot90CCW () ((return (call Matrix ((list-initializer (list-initializer 0.0 (- 1.0)) (list-initializer 1.0 0.0)))))))
  
  (func $rot90CCW
    (result i32)
    (local $__base_ptr__ i32)
    (local $__tee_i32__ i32)
    (local $__tee_f32__ f32)
    (local $__swapa_i32__ i32)
    (local $__swapb_i32__ i32)
    (local $__swapb_f32__ f32)
    (local $__swapa_f32__ f32)
    global.get $__stack_ptr__
    local.set $__base_ptr__
    global.get $__stack_ptr__
    i32.const 0
    i32.sub
    global.set $__stack_ptr__
    
    ;; visit RETURN_STMT
    ;; (return (call Matrix ((list-initializer (list-initializer 0.0 (- 1.0)) (list-initializer 1.0 0.0)))))
    
    
    ;; visit CALL_EXPR
    ;; (call Matrix ((list-initializer (list-initializer 0.0 (- 1.0)) (list-initializer 1.0 0.0))))
    
    global.get $__stack_ptr__
    i32.const 16
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    
    ;; visit LIST_EXPR
    ;; (list-initializer (list-initializer 0.0 (- 1.0)) (list-initializer 1.0 0.0))
    
    global.get $__stack_ptr__
    i32.const 16
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    
    ;; visit LIST_EXPR
    ;; (list-initializer 0.0 (- 1.0))
    
    global.get $__stack_ptr__
    i32.const 8
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    f32.const 0
    f32.store
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 4
    i32.add
    f32.const 0
    f32.const 1
    f32.sub
    f32.store
    local.set $__swapa_i32__
    local.set $__swapb_i32__
    local.get $__swapa_i32__
    local.get $__swapb_i32__
    i32.const 8
    call $__memcpy__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 8
    i32.add
    
    ;; visit LIST_EXPR
    ;; (list-initializer 1.0 0.0)
    
    global.get $__stack_ptr__
    i32.const 8
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    f32.const 1
    f32.store
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 4
    i32.add
    f32.const 0
    f32.store
    local.set $__swapa_i32__
    local.set $__swapb_i32__
    local.get $__swapa_i32__
    local.get $__swapb_i32__
    i32.const 8
    call $__memcpy__
    local.set $__swapa_i32__
    local.set $__swapb_i32__
    local.get $__swapa_i32__
    local.get $__swapb_i32__
    i32.const 16
    call $__memcpy__
    local.get $__base_ptr__
    global.set $__stack_ptr__
    return
    local.get $__base_ptr__
    global.set $__stack_ptr__
  )
  
  ;; visit FUNCTION_STMT
  ;; (def main () ((var I (struct ((mat (arraytype 2 (arraytype 2 float))))) (call ident ())) (var x (struct ((x float)(y float))) (call Vector (1.0 0.0))) (var Ix (struct ((x float)(y float))) (call mul (I x))) (print (list-initializer (. Ix x) (. Ix y))) (var R (struct ((mat (arraytype 2 (arraytype 2 float))))) (call rot90CCW ())) (block (var i int 0) (while (< i 4) (block (block (assign x (call mul (R x))) (print (list-initializer (. x x) (. x y))))) (assign i (+ i 1))))))
  
  (func $main (export "main")
    (local $__base_ptr__ i32)
    (local $__tee_i32__ i32)
    (local $__tee_f32__ f32)
    (local $__swapa_i32__ i32)
    (local $__swapb_i32__ i32)
    (local $__swapb_f32__ f32)
    (local $__swapa_f32__ f32)
    (local $i_11 i32)
    global.get $__stack_ptr__
    local.set $__base_ptr__
    global.get $__stack_ptr__
    i32.const 48
    i32.sub
    global.set $__stack_ptr__
    
    ;; visit VAR_STMT
    ;; (var I (struct ((mat (arraytype 2 (arraytype 2 float))))) (call ident ()))
    
    
    ;; visit CALL_EXPR
    ;; (call ident ())
    
    global.get $__stack_ptr__
    i32.const 16
    i32.sub
    global.set $__stack_ptr__
    call $ident
    global.get $__stack_ptr__
    i32.const 16
    call $__memcpy__
    global.get $__stack_ptr__
    local.get $__base_ptr__
    i32.const 16
    i32.sub
    i32.const 16
    call $__memcpy__
    local.get $__base_ptr__
    i32.const 16
    i32.sub
    drop
    
    ;; visit VAR_STMT
    ;; (var x (struct ((x float)(y float))) (call Vector (1.0 0.0)))
    
    
    ;; visit CALL_EXPR
    ;; (call Vector (1.0 0.0))
    
    global.get $__stack_ptr__
    i32.const 8
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    f32.const 1
    f32.store
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 4
    i32.add
    f32.const 0
    f32.store
    local.get $__base_ptr__
    i32.const 24
    i32.sub
    i32.const 8
    call $__memcpy__
    local.get $__base_ptr__
    i32.const 24
    i32.sub
    drop
    
    ;; visit VAR_STMT
    ;; (var Ix (struct ((x float)(y float))) (call mul (I x)))
    
    
    ;; visit CALL_EXPR
    ;; (call mul (I x))
    
    local.get $__base_ptr__
    i32.const 16
    i32.sub
    ;; emitPushMem(Matrix)
    global.get $__stack_ptr__
    i32.const 16
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    i32.const 16
    call $__memcpy__
    global.get $__stack_ptr__
    local.get $__base_ptr__
    i32.const 24
    i32.sub
    ;; emitPushMem(Vector)
    global.get $__stack_ptr__
    i32.const 8
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    i32.const 8
    call $__memcpy__
    global.get $__stack_ptr__
    global.get $__stack_ptr__
    i32.const 8
    i32.sub
    global.set $__stack_ptr__
    call $mul
    global.get $__stack_ptr__
    i32.const 8
    call $__memcpy__
    global.get $__stack_ptr__
    local.get $__base_ptr__
    i32.const 32
    i32.sub
    i32.const 8
    call $__memcpy__
    local.get $__base_ptr__
    i32.const 32
    i32.sub
    drop
    
    ;; visit PRINT_STMT
    ;; (print (list-initializer (. Ix x) (. Ix y)))
    
    
    ;; visit LIST_EXPR
    ;; (list-initializer (. Ix x) (. Ix y))
    
    global.get $__stack_ptr__
    i32.const 8
    i32.sub
    global.set $__stack_ptr__
    global.get $__stack_ptr__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    
    ;; visit DOT_EXPR
    ;; (. Ix x)
    
    ;;       print [Ix.x, Ix.y];
    ;;                ^
    
    local.get $__base_ptr__
    i32.const 32
    i32.sub
    i32.const 0
    i32.add
    f32.load
    f32.store
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 4
    i32.add
    
    ;; visit DOT_EXPR
    ;; (. Ix y)
    
    ;;       print [Ix.x, Ix.y];
    ;;                      ^
    
    local.get $__base_ptr__
    i32.const 32
    i32.sub
    i32.const 4
    i32.add
    f32.load
    f32.store
    i32.const 91
    call $__putc__
    local.tee $__tee_i32__
    local.get $__tee_i32__
    i32.const 0
    i32.add
    f32.load
    call $__putf__
    i32.const 44
    call $__putc__
    i32.const 32
    call $__putc__
    i32.const 4
    i32.add
    f32.load
    call $__putf__
    i32.const 93
    call $__putc__
    call $__flush__
    
    ;; visit VAR_STMT
    ;; (var R (struct ((mat (arraytype 2 (arraytype 2 float))))) (call rot90CCW ()))
    
    
    ;; visit CALL_EXPR
    ;; (call rot90CCW ())
    
    global.get $__stack_ptr__
    i32.const 16
    i32.sub
    global.set $__stack_ptr__
    call $rot90CCW
    global.get $__stack_ptr__
    i32.const 16
    call $__memcpy__
    global.get $__stack_ptr__
    local.get $__base_ptr__
    i32.const 48
    i32.sub
    i32.const 16
    call $__memcpy__
    local.get $__base_ptr__
    i32.const 48
    i32.sub
    drop
    
    ;; visit BLOCK_STMT
    ;; (block (var i int 0) (while (< i 4) (block (block (assign x (call mul (R x))) (print (list-initializer (. x x) (. x y))))) (assign i (+ i 1))))
    
    
    ;; visit VAR_STMT
    ;; (var i int 0)
    
    i32.const 0
    local.tee $i_11
    drop
    
    ;; visit WHILE_STMT
    ;; (while (< i 4) (block (block (assign x (call mul (R x))) (print (list-initializer (. x x) (. x y))))) (assign i (+ i 1)))
    
    (block $2
      (loop $3
        local.get $i_11
        i32.const 4
        i32.lt_s
        i32.eqz
        br_if $2
        (block $4
          
          ;; visit BLOCK_STMT
          ;; (block (block (assign x (call mul (R x))) (print (list-initializer (. x x) (. x y)))))
          
          
          ;; visit BLOCK_STMT
          ;; (block (assign x (call mul (R x))) (print (list-initializer (. x x) (. x y))))
          
          
          ;; visit EXPRESSION_STMT
          ;; (assign x (call mul (R x)))
          
          
          ;; visit ASSIGN_EXPR
          ;; (assign x (call mul (R x)))
          
          ;;         x = mul(R, x);
          ;;           ^
          
          
          ;; visit CALL_EXPR
          ;; (call mul (R x))
          
          local.get $__base_ptr__
          i32.const 48
          i32.sub
          ;; emitPushMem(Matrix)
          global.get $__stack_ptr__
          i32.const 16
          i32.sub
          global.set $__stack_ptr__
          global.get $__stack_ptr__
          i32.const 16
          call $__memcpy__
          global.get $__stack_ptr__
          local.get $__base_ptr__
          i32.const 24
          i32.sub
          ;; emitPushMem(Vector)
          global.get $__stack_ptr__
          i32.const 8
          i32.sub
          global.set $__stack_ptr__
          global.get $__stack_ptr__
          i32.const 8
          call $__memcpy__
          global.get $__stack_ptr__
          global.get $__stack_ptr__
          i32.const 8
          i32.sub
          global.set $__stack_ptr__
          call $mul
          global.get $__stack_ptr__
          i32.const 8
          call $__memcpy__
          global.get $__stack_ptr__
          local.get $__base_ptr__
          i32.const 24
          i32.sub
          i32.const 8
          call $__memcpy__
          local.get $__base_ptr__
          i32.const 24
          i32.sub
          drop
          
          ;; visit PRINT_STMT
          ;; (print (list-initializer (. x x) (. x y)))
          
          
          ;; visit LIST_EXPR
          ;; (list-initializer (. x x) (. x y))
          
          global.get $__stack_ptr__
          i32.const 8
          i32.sub
          global.set $__stack_ptr__
          global.get $__stack_ptr__
          local.tee $__tee_i32__
          local.get $__tee_i32__
          i32.const 0
          i32.add
          
          ;; visit DOT_EXPR
          ;; (. x x)
          
          ;;         print [x.x, x.y];
          ;;                 ^
          
          local.get $__base_ptr__
          i32.const 24
          i32.sub
          i32.const 0
          i32.add
          f32.load
          f32.store
          local.tee $__tee_i32__
          local.get $__tee_i32__
          i32.const 4
          i32.add
          
          ;; visit DOT_EXPR
          ;; (. x y)
          
          ;;         print [x.x, x.y];
          ;;                      ^
          
          local.get $__base_ptr__
          i32.const 24
          i32.sub
          i32.const 4
          i32.add
          f32.load
          f32.store
          i32.const 91
          call $__putc__
          local.tee $__tee_i32__
          local.get $__tee_i32__
          i32.const 0
          i32.add
          f32.load
          call $__putf__
          i32.const 44
          call $__putc__
          i32.const 32
          call $__putc__
          i32.const 4
          i32.add
          f32.load
          call $__putf__
          i32.const 93
          call $__putc__
          call $__flush__
        )
        
        ;; visit EXPRESSION_STMT
        ;; (assign i (+ i 1))
        
        
        ;; visit ASSIGN_EXPR
        ;; (assign i (+ i 1))
        
        ;;       for (var i = 0; i < 4; i += 1) {
        ;;                                ^
        
        local.get $i_11
        i32.const 1
        i32.add
        local.tee $i_11
        drop
        br $3
      )
    )
    local.get $__base_ptr__
    global.set $__stack_ptr__
  )
  
  ;; visit STRUCT_STMT
  ;; (struct Matrix ((mat (arraytype 2 (arraytype 2 float)))))
  
  
  ;; visit STRUCT_STMT
  ;; (struct Vector ((x float)(y float)))
  
)
