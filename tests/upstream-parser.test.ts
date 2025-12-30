import { scanTokens } from "../src/scanner"
import { parse } from "../src/parser"
import { resolve } from "../src/resolver"
import { ReportError } from "../src/util"
import * as ast from "../src/nodes"

enum Passes {
  SCAN = 1 << 0,
  PARSE = 1 << 1,
  RESOLVE = 1 << 2,
  THROUGH_PARSE = SCAN | PARSE,
  THROUGH_RESOLVE = SCAN | PARSE | RESOLVE
}

function expectAST(source: string, expected: string) {
  source = source.trim()
  const errors: string[] = []
  const reportError: ReportError = (line, msg) => {
    errors.push(`${line}: ${msg}`)
  }

  const tokens = scanTokens(source, reportError)
  const output = parse(tokens, reportError)

  let sexpr = "("
  output.topLevelStatements.forEach((stmt, i) => {
    if (i > 0) sexpr += " "
    sexpr += ast.astToSExpr(stmt)
  })
  sexpr += ")"
  expect(sexpr).toEqual(expected)
  expect(errors).toEqual([])
}

function expectErrors(source: string, expectedErrors: string[], passes: Passes): ast.Context | null {
  source = source.trim()
  const errors: string[] = []
  const reportError: ReportError = (line, msg) => {
    errors.push(`${line}: ${msg}`)
  }

  const tokens = scanTokens(source, reportError)

  let context: ast.Context | null = null
  if (errors.length === 0 && (passes & Passes.PARSE)) {
    context = parse(tokens, reportError)
    if (errors.length === 0 && (passes & Passes.RESOLVE)) {
      resolve(context, reportError)
    }
  }
  expect(errors).toEqual(expectedErrors)
  return context
}

describe("upstream parser/resolver parity", () => {
  const expectParseErrors = (source: string, expectedErrors: string[]) =>
    expectErrors(source, expectedErrors, Passes.THROUGH_PARSE)

  test("top-level statements", () => {
    expectAST(
      `
    var a = 1;
    var b = 2;
    def foo(x int, y byte) int {}
    var c = true;
    def bar(z bool) {}
    var d = 5.0;
    def main() {}
    var e = -4.0;
    `,
      "(" +
        "(var a 1) " +
        "(var b 2) " +
        "(def foo ((param x int) (param y byte)) ()) " +
        "(var c true) " +
        "(def bar ((param z bool)) ()) " +
        "(var d 5.0) " +
        "(def main () ()) " +
        "(var e (- 4.0))" +
        ")"
    )
  })

  test("operator precedence", () => {
    expectAST(
      `
    var a = 1 + 2 * -(3.5 - -7.0) / (float(1) + 5.) == int(5.0) > -4 || x && !!foo(bar(x, y), foo() && bar());
    `,
      "(" +
        "(var a " +
        "(|| " +
        "(== " +
        "(+ " +
        "1 " +
        "(/ " +
        "(* " +
        "2 " +
        "(- ((- 3.5 (- 7.0))))" +
        ") " +
        "((+ (float 1) 5.0))" +
        ")" +
        ") " +
        "(> (int 5.0) (- 4))" +
        ") " +
        "(&& " +
        "x " +
        "(! (! " +
        "(call " +
        "foo " +
        "(" +
        "(call bar (x y)) " +
        "(&& " +
        "(call foo ()) " +
        "(call bar ())" +
        ")" +
        ")" +
        ")" +
        "))" +
        ")" +
        ")" +
        ")" +
        ")"
    )
  })

  test("operator associativity", () => {
    expectAST(
      `
    var a = 1 + 2 - 3 + 4 - 5;
    `,
      "(" +
        "(var a " +
        "(- " +
        "(+ " +
        "(- (+ 1 2) 3) " +
        "4" +
        ") " +
        "5" +
        ")" +
        ")" +
        ")"
    )

    expectAST(
      `
    var a = 1 * 2 / 3 * 4 / 5;
    `,
      "(" +
        "(var a " +
        "(/ " +
        "(* " +
        "(/ (* 1 2) 3) " +
        "4" +
        ") " +
        "5" +
        ")" +
        ")" +
        ")"
    )
  })

  test("function definitions errors", () => {
    expectParseErrors(
      `
    def foo {}
    def foo() void {}
    def foo(a, b) {}
    def foo(a int, b int) int;
    def foo(a int, b int) int {}
    def foo2(a int, b int) int {
      print 3.14159265358979626;
    `,
      [
        "1: Expect '(' after function name.",
        "2: Invalid type specifier starting at 'void'.",
        "3: Invalid type specifier starting at ','.",
        "4: Expect '{' before function body.",
        "7: Expect '}' after block."
      ]
    )

    expectParseErrors(
      `
    def foo() {
      def bar() {}
      print 123;
    }
    `,
      ["2: Expect expression."]
    )
  })

  test("variable declaration outside block", () => {
    expectParseErrors(
      `
    var allowed1 = 1;
    def foo() {
      var allowed2 = 2;
      if (true) {
        var allowed3 = 3;
      } else var notAllowed1 = 1;
      if (true) var notAllowed2 = 2;
    }
    `,
      ["6: Expect expression.", "7: Expect expression."]
    )
  })

  test("loop syntax", () => {
    expectParseErrors(
      `
    def main() {
      while (foo() == bar()) loop(); // ok
      while (foo() == bar()) { // ok
        loop();
      }
      while (var i = 0) loop(); // error
      while () loop(); // error
      for (;;) loop(); // ok
      for (;;) { // ok
        loop();
      }
      for (var p = n; p != end; p = next(n)) loop(); // ok
      for (var p = n;;) loop(); // ok
      for (; p != end;) loop(); // ok
      for (;; p = next(n)) loop(); // ok
      for (var p = n; var q = n; p = next(n)) loop(); // error
    }
    `,
      [
        "6: Expect expression.",
        "7: Expect expression.",
        "16: Expect expression.",
        // TODO: upstream test expected extra error due to parse recovery
        "16: Expect ';' after expression statement."
      ]
    )
  })

  test("duplicate symbol declaration", () => {
    expectParseErrors(
      `
    var a = 1;
    var b = 2;
    var a = b;
    `,
      ["3: 'a' is already declared in this scope."]
    )

    expectParseErrors(
      `
    var a = 1;
    var b = 2;
    def foo() {
      var a = b;
      var b = 3.14;
      {
        var a = b;
        var b = 42;
        var b = 42;
      }
    }
    def bar() {
      var a = -1;
      var b = 1337;
      var a = 0;
    }
    `,
      ["9: 'b' is already declared in this scope.", "15: 'a' is already declared in this scope."]
    )

    expectParseErrors(
      `
    def foo(a int, b int, a int) {}
    `,
      ["1: 'a' is already declared in this scope."]
    )
  })

  test("invalid assignment target", () => {
    expectParseErrors(
      `
    def foo() int {
      return 1;
    }
    def main() {
      var a = 0;
      var y = true;
      var z = [1, 2, 3];
      var p = &a;
      2 = a; // error
      foo() = a; // error
      &a = p; // error
      false = y; // error
      [4, 5, 6] = z; // error
    }
    `,
      [
        "9: Invalid assignment target.",
        "10: Invalid assignment target.",
        "11: Invalid assignment target.",
        "12: Invalid assignment target.",
        "13: Invalid assignment target."
      ]
    )
  })

  test("invalid variable declaration", () => {
    expectParseErrors(
      `
    def main() {
      var a += 0;
      var 0 = 0;
      var a int;
      var a 1 = 0;
      var a int = 0; // ok
      var b = 0; // ok
    }
    `,
    [
      "2: Invalid type specifier starting at '+='.",
      "3: Expect identifier after 'var'.",
      "4: Expect '=' after variable declaration.",
      "5: Invalid type specifier starting at '1'.",
    ])
  })

  test("hex literals", () => {
    expectParseErrors(
      `
    var x = 0xAABBCCDD; // ok
    var y = 0xAAABBCCDD; // error
    `,
      ["2: Hex literal does not fit in any numeric type."]
    )
  })

  test("character literals", () => {
    expectParseErrors(
      `
    var x = 'h'; // ok
    var y = 'hello'; // error
    var z = 'é'; // error
    `,
      [
        "2: Invalid character literal (use double quotes for strings).",
        "3: Invalid character literal (only ASCII characters allowed)."
      ]
    )
  })
})
