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

const expectResolveErrors = (source: string, expectedErrors: string[]) =>
  expectErrors(source, expectedErrors, Passes.THROUGH_RESOLVE)

describe("upstream type checking parity (subset)", () => {
  test("operators", () => {
    expectResolveErrors(
      `
    var u = 1.0 == false;
    var v = -true;
    var w = !1.5; // err
    var x = 1 + true;
    var y = true / false;
    var z = true > false;
    // ok
    var a = 1.0 == 0.5;
    var b = -1;
    var c = !false;
    var d = 1 + 2;
    var e = 1.0 / 2.0;
    var f = 1.0 > 2.0;

    var g = 5 % 2;
    var h = 5 % -2;
    var i = 5.0 % -2.0; // err

    var j1 = [1.0] == [2.0]; // err
    var j2 = [1.0] != [2.0]; // err
    struct Point{ x float, y float }
    var k1 = Point{1.0, 2.0} == Point{2.0, 3.0}; // err
    var k2 = Point{1.0, 2.0} != Point{2.0, 3.0}; // err
    `,
      [
        "1: Cannot compare float to bool.",
        "2: Invalid operand type for unary operator '-'.",
        "3: Cannot implicitly convert operand to 'bool'.",
        "4: Invalid operand types for binary operator '+'.",
        "5: Invalid operand types for binary operator '/'.",
        "6: Invalid operand types for binary operator '>'.",
        "17: Invalid operand types for binary operator '%'.",
        "19: Cannot compare [float; 1] to [float; 1].",
        "20: Cannot compare [float; 1] to [float; 1].",
        "22: Cannot compare Point to Point.",
        "23: Cannot compare Point to Point."
      ]
    )
  })

  test("operators 2", () => {
    expectResolveErrors(
      `
    def main() {
      var i = 1;
      var f = 1.5;
      var bt = 'c';
      i += 1; // ok
      i += 1.5; // error
      i += true; // error
      i -= 1; // ok
      i -= 1.5; // error
      i -= true; // error
      i *= 1; // ok
      i *= 1.5; // error
      i *= true; // error
      i /= 1; // ok
      i /= 1.5; // error
      i /= true; // error
      i %= 1; // ok
      i %= 1.5; // error
      i %= true; // error
      f += 1; // ok
      f += 1.5; // ok
      f += true; // error
      f -= 1; // ok
      f -= 1.5; // ok
      f -= true; // error
      f *= 1; // ok
      f *= 1.5; // ok
      f *= true; // error
      f /= 1; // ok
      f /= 1.5; // ok
      f /= true; // error
      f %= 1; // error
      f %= 1.5; // error
      f %= true; // error
      bt += byte(1); // ok
      bt += 1.5; // error
      bt += true; // error
      bt -= byte(1); // ok
      bt -= 1.5; // error
      bt -= true; // error
      bt *= byte(1); // ok
      bt *= 1.5; // error
      bt *= true; // error
      bt /= byte(1); // ok
      bt /= 1.5; // error
      bt /= true; // error
      bt %= byte(1); // ok
      bt %= 1.5; // error
      bt %= true; // error
    }
    `,
      [
        "6: Cannot implicitly convert operand to 'int'.",
        "7: Invalid operand types for binary operator '+'.",
        "9: Cannot implicitly convert operand to 'int'.",
        "10: Invalid operand types for binary operator '-'.",
        "12: Cannot implicitly convert operand to 'int'.",
        "13: Invalid operand types for binary operator '*'.",
        "15: Cannot implicitly convert operand to 'int'.",
        "16: Invalid operand types for binary operator '/'.",
        "18: Invalid operand types for binary operator '%'.",
        "19: Invalid operand types for binary operator '%'.",
        "22: Invalid operand types for binary operator '+'.",
        "25: Invalid operand types for binary operator '-'.",
        "28: Invalid operand types for binary operator '*'.",
        "31: Invalid operand types for binary operator '/'.",
        "32: Invalid operand types for binary operator '%'.",
        "33: Invalid operand types for binary operator '%'.",
        "34: Invalid operand types for binary operator '%'.",
        "36: Cannot implicitly convert operand to 'byte'.",
        "37: Invalid operand types for binary operator '+'.",
        "39: Cannot implicitly convert operand to 'byte'.",
        "40: Invalid operand types for binary operator '-'.",
        "42: Cannot implicitly convert operand to 'byte'.",
        "43: Invalid operand types for binary operator '*'.",
        "45: Cannot implicitly convert operand to 'byte'.",
        "46: Invalid operand types for binary operator '/'.",
        "48: Invalid operand types for binary operator '%'.",
        "49: Invalid operand types for binary operator '%'."
      ]
    )
  })

  test("variable type annotation", () => {
    expectResolveErrors(
      `
    def returnsInt() int {
      return 42;
    }
    var x int = true;
    var y bool = 5.0;
    var z bool = returnsInt();
    `,
      [
        "4: Cannot assign value of type 'bool' to variable of type 'int'.",
        "5: Cannot assign value of type 'float' to variable of type 'bool'.",
        "6: Cannot assign value of type 'int' to variable of type 'bool'."
      ]
    )
  })

  test("type inference from initializer", () => {
    expectResolveErrors(
      `
    var x = 5;
    var y int = x;
    def foo() int {
      return 1;
    }
    var z = foo();
    var p = z;
    def bar(x int) {
      print x;
    }
    def main() {
      bar(z);
      bar(p);
    }
    `,
      [/* no errors*/]
    )
  })

  test("parameter mismatch", () => {
    expectResolveErrors(
      `
    def foo(x int, y int) {}
    def main() {
      foo(1, 2); // ok
      foo(1);
      foo(true, false);
    }
    `,
      [
        "4: Expected 2 arguments but got 1 in call to foo.",
        "5: Cannot implicitly convert operand to 'int'.",
        "5: Cannot implicitly convert operand to 'int'."
      ]
    )
  })

  test("non-callable symbol", () => {
    expectResolveErrors(
      `
    var foo = 1;
    def main() {
      foo();
      bar();
    }
    `,
      ["3: Cannot call this type.", "4: Undefined symbol 'bar'."]
    )
  })

  test("return type mismatch", () => {
    expectResolveErrors(
      `
    def foo() {
      return 1;
    }
    def bar(x bool) int {
      if (x) {
        return 1;
      }
      return false;
    }
    def returnsFloat() float { return 5.0; }
    def foobar(x bool) bool {
      if (x) {
        return;
      }
      return returnsFloat();
    }
    `,
      [
        "2: Expected a value of type 'void'.",
        "8: Expected a value of type 'int'.",
        "13: Expected a value of type 'bool'.",
        "15: Expected a value of type 'bool'."
      ]
    )
  })

  test("missing return", () => {
    expectResolveErrors(
      `
    def foo() {
      print 1337;
      // ok to not return
    }
    def foo2() int {
      print 1337;
      // missing return
    }
    def bar(x bool) int {
      if (x) {
        return 1;
      } else {
        return 0;
      }
      // all paths satisfied
    }
    def bar2(x bool, y bool) int {
      if (x && y) {
        return 1;
      } else if (!x && !y) {
        return 2;
      }
      // missing return
    }
    def bar3(x bool, y bool) int {
      if (x && y) {
        return 1;
      }
      print x;
      if (x) {
        return 2;
      } else {
        return 3;
      }
      // all paths satisfied
    }
    `,
      [
        "5: All control paths for foo2 must return a value of type 'int'.",
        "17: All control paths for bar2 must return a value of type 'int'."
      ]
    )
  })

  test("return from void function", () => {
    expectResolveErrors(
      `
    def foobar() {
      return 1; // error
    }
    def foo() {
      print 1234;
      return;
    }
    def bar(x int) {
      if (x) {
        return;
      }
      foo();
    }
    `,
      ["2: Expected a value of type 'void'."]
    )
  })

  test("global scope", () => {
    expectResolveErrors(
      `
    // ok for dependent globals to be declared out-of-order
    var x = y;
    var y = 1;
    // undeclared symbol is still an error
    var z1 = missing;
    var z2 = x * (y - missing);
    // missing global is reported in function body
    def foo() int {
      missing = 5; // implicit declaration not allowed
      return missing;
    }
    var z3 = foo();
    `,
      [
        "5: Undefined symbol 'missing'.",
        "6: Undefined symbol 'missing'.",
        "6: Invalid operand types for binary operator '-'.",
        "9: Undefined symbol 'missing'.",
        "10: Undefined symbol 'missing'.",
        "10: Expected a value of type 'int'."
      ]
    )
  })

  test("function scope", () => {
    expectResolveErrors(
      `
    def inner(outerAndInnerParam bool, innerParam int) {
      var inner1 = 1;
      var outerAndInner = true;
      // cannot refer to vars declared only inside outer
      print outerBeforeInner;
      print outerParam;
      // ok
      print inner1;
      // wrong type
      print outerAndInner == 1.5;
      print outerAndInnerParam == 0.99;
      // ok
      print outerAndInner == true;
      print outerAndInnerParam == true;
    }
    def outer(outerAndInnerParam float, outerParam int) {
      var outerAndInner = 1.5;
      var outerBeforeInner = 1;
      inner(true, 2);
      // cannot refer to vars declared only inside inner
      print inner1;
      print innerParam;
      // ok
      print outerBeforeInner;
      // ok
      var outerAfterInner = 2;
      print outerAfterInner;
      // ok
      print outerAndInner == 1.5;
      print outerAndInnerParam == 0.99;
      // wrong type
      print outerAndInner == true;
      print outerAndInnerParam == true;
    }
    `,
      [
        "5: Undefined symbol 'outerBeforeInner'.",
        "6: Undefined symbol 'outerParam'.",
        "10: Cannot compare bool to float.",
        "11: Cannot compare bool to float.",
        "21: Undefined symbol 'inner1'.",
        "22: Undefined symbol 'innerParam'.",
        "32: Cannot compare float to bool.",
        "33: Cannot compare float to bool."
      ]
    )
  })

  test("block scope", () => {
    expectResolveErrors(
      `
    def main() {
      var a = 5.0;
      var b = 2.0;
      print a == true; // wrong type
      print a == 5.0; // ok
      print x; // undefined symbol
      {
        var a = true;
        var x = b;
        print a == true; // ok
        print a == 5.0; // wrong type
        print x; // ok
        print x == b; // ok
        print x == 5.0; // ok
        print x == a; // wrong type
      }
      print a == true; // wrong type
      print a == 5.0; // ok
      print x; // undefined symbol
    }
    `,
      [
        "4: Cannot compare float to bool.",
        "6: Undefined symbol 'x'.",
        "11: Cannot compare bool to float.",
        "15: Cannot compare float to bool.",
        "17: Cannot compare float to bool.",
        "19: Undefined symbol 'x'."
      ]
    )
  })

  test("lexical scope", () => {
    expectResolveErrors(
      `
    def main() {
      var a = 1;
      var b = c; // error to reference locals out-of-order
      var c = a; // ok
      {
        var x = a; // ok
        var y = d; // error
        var z = x; // ok
      }
      var d = c; // ok
      {
        var p = x; // error
        var q = d; // ok
        var r = c; // ok
      }
    }
    `,
      ["3: Undefined symbol 'c'.", "7: Undefined symbol 'd'.", "12: Undefined symbol 'x'."]
    )
  })

  test("lexical scope 2", () => {
    expectResolveErrors(
      `
    def main() {
      var a = 1.5;
      {
        print a == true; // error
        var a = true;
        print a == true; // ok
      }
    }
    `,
      ["4: Cannot compare float to bool."]
    )
  })

  test("for loop scope", () => {
    expectResolveErrors(
      `
    def main() {
      {
        var i = 1337;
        for (var i = 0; i < 3; i = i + 1) {
          print i;
        }
      }
      for (var i = 0; i < 3; i = i + 1) {
        print i;
      }
      print i; // error
    }
    `,
      ["11: Undefined symbol 'i'."]
    )
  })

  test("scope change due to out-of-order resolution", () => {
    expectResolveErrors(
      `
    def foo(y int) int {
      var localAndGlobal = true;
      var local = 1;
      var x = globalVar1 + y;
      var z = globalVar2;
      if (globalVar3) {
        return x + y;
      }
      return x + z;
    }
    var globalVar1 = int(y);
    var globalVar2 = int(local);
    var globalVar3 = localAndGlobal == 3.14;
    var localAndGlobal = 3.14;
    `,
      ["11: Undefined symbol 'y'.", "12: Undefined symbol 'local'."]
    )
  })

  test("cyclic variable declaration", () => {
    expectResolveErrors(
      `
    var x = x;
    var y = z;
    var z = y;
    var a = foo();
    def foo() int {
      return bar();
    }
    def bar() int {
      return int(b);
    }
    var b = int(a);
    var p = foobar();
    def foobar() int {
      return int(q);
    }
    var q = foobar();
    def getGlobalG() int {
      return g;
    }
    var g = 1337;
    def main() {
      var g = getGlobalG(); // ok
    }
    `,
      [
        "1: Declaration of 'x' is cyclic. Defined here:\n" + "var x = x;\n" + "    ^",
        "2: Declaration of 'y' is cyclic. Defined here:\n" + "    var y = z;\n" + "        ^",
        "4: Declaration of 'a' is cyclic. Defined here:\n" + "    var a = foo();\n" + "        ^",
        "16: Declaration of 'q' is cyclic. Defined here:\n" + "    var q = foobar();\n" + "        ^"
      ]
    )
  })

  test("cyclic variable declaration inside block", () => {
    expectResolveErrors(
      `
    def main() {
      var a = 1;
      {
        var a = a; // --> error!
      }
    }
    `,
      [
        "4: Declaration of 'a' is cyclic. Defined here:\n" +
          "        var a = a; // --> error!\n" +
          "            ^"
      ]
    )
  })

  test("recursive functions", () => {
    expectResolveErrors(
      `
    def fib(n int) int {
      if (n <= 1) {
        return 1;
      }
      return fib(n-1) + fib(n-2);
    }
    def isEven(n int) bool {
      if (n == 0) {
        return true;
      }
      return !isOdd(n-1);
    }
    def isOdd(n int) bool {
      if (n == 1) {
        return true;
      }
      return !isEven(n-1);
    }
    `,
      [/* no errors */]
    )
  })

  test("cyclic variable declaration with mutually recursive functions", () => {
    expectResolveErrors(
      `
    def foo(p int) int {
      if (p == 0) {
        return x;
      }
      return bar(p-1);
    }
    var x = int(bar(1));
    def bar(p int) int {
      return foo(p-1);
    }
    `,
      [
        "7: Declaration of 'x' is cyclic. Defined here:\n" +
          "    var x = int(bar(1));\n" +
          "        ^"
      ]
    )
  })

  test("valid variable declaration with mutually recursive functions", () => {
    expectResolveErrors(
      `
    var x = isEven(100);
    def isEven(n int) bool {
      if (n == 0) {
        return true;
      }
      return !isOdd(n-1);
    }
    def isOdd(n int) bool {
      if (n == 1) {
        return true;
      }
      return !isEven(n-1);
    }
    `,
      [/* no errors */]
    )
  })

  test("array literals", () => {
    expectResolveErrors(
      `
    var a = [1, 2, 3]; // ok
    var b [int; 3] = [1, 2, 3]; // ok
    var c = [1, 2, true]; // err
    var d = [1+2+3; 5]; // ok
    var e [int; 5] = [1+2+3; 5]; // ok
    var f [bool; 5] = [1+2+3; 5]; // err
    var g = [[1, 2, 3], [4, 5, 6]]; // ok
    var h [[int; 3]; 2] = [[1, 2, 3], [4, 5, 6]]; // ok
    var i = [[1, 2], [1]]; // err
    var j = []; // err
    var k [int; 0] = []; // err
    var l = [-1; 0]; // err
    var m = [foo(), foo()]; // err
    def foo() {}
    `,
      [
        "3: Cannot infer type for literal.",
        "6: Cannot assign value of type '[int; 5]' to variable of type '[bool; 5]'.",
        "9: Cannot infer type for literal.",
        "10: Zero-length arrays are not allowed.",
        "11: Zero-length arrays are not allowed.",
        "12: Zero-length arrays are not allowed.",
        "13: Cannot infer type for literal."
      ]
    )
  })

  test("array operations", () => {
    expectResolveErrors(
      `
    var arr = [1, 2, 3];
    var x = arr[0]; // ok
    var y = arr[1+1]; // ok
    var z = arr[3.14]; // err
    var p int = len(arr); // ok
    `,
      ["4: Index operator requires int or byte type."]
    )
  })

  test("N-D array operations", () => {
    expectResolveErrors(
      `
    def main() {
      var arr = [[1, 2, 3], [4, 5, 6]]; // ok
      var x1 [int; 3] = arr[0]; // ok
      var x2 int = arr[0]; // err
      var y1 [int; 3] = arr[1+1][0]; // err
      var y2 int = arr[1+1][0]; // ok
      var p int = len(arr); // ok
      var q int = len(arr[0]); // ok
      arr[0] = [7, 8, 9]; // ok
      arr[0] = [1, 2]; // err
    }
    `,
      [
        "4: Cannot assign value of type '[int; 3]' to variable of type 'int'.",
        "5: Cannot assign value of type 'int' to variable of type '[int; 3]'.",
        "10: Cannot implicitly convert operand to '[int; 3]'."
      ]
    )
  })

  test("assign pointer to non-address", () => {
    expectResolveErrors(
      `
    def main() {
      var p int~ = 1;
    }
    `,
      ["2: Cannot assign value of type 'int' to variable of type 'int~'."]
    )
  })

  test("address-of operator", () => {
    expectResolveErrors(
      `
    var g = 1;
    var ag = &g; // ok
    var f1 = &1; // error
    var f2 = &(g + 1); // error
    var f3 = &foo(); // error
    var f4 = &bar(); // error
    var f5 = &foo; // error
    def foo() int {
      return 1;
    }
    def bar() {}
    def main() {
      var x = 1;
      var arr = [1, 2, 3];
      var ax = &x; // ok
      var acx = &bool(x); // error
      var aarr = &arr; // ok
      var aarr0 = &arr[0]; // ok
      var aag = &ag; // ok
      var fa = &[1, 2, 3]; // error
    }
    def foobar(x int, arr [int; 2]) {
      var px = &x; // ok
      var parr = &arr; // ok
    }
    `,
      [
        "3: Invalid operand for unary operator '&'.",
        "4: Invalid operand for unary operator '&'.",
        "5: Invalid operand for unary operator '&'.",
        "6: Invalid operand for unary operator '&'.",
        "7: Invalid operand for unary operator '&'.",
        "16: Invalid operand for unary operator '&'.",
        "20: Invalid operand for unary operator '&'."
      ]
    )
  })

  test("dereferencing rval variables", () => {
    expectResolveErrors(
      `
    def main() {
      var x = 5;
      var y = true;
      var mat = [[1, 2], [3, 4]];
      var arrp [int~; 2] = [&x, &x];

      var px int~ = &x;
      var py bool~ = &y;
      var pmat [[int; 2]; 2]~ = &mat;
      var prow [int; 2]~ = &mat[0];
      var pel int~ = &mat[0][0];
      var arrpel int~ = arrp[0];
      var pp int~~ = &px;

      print x~; // error
      var dpx int = px~; // ok
      print y~; // error
      var dpy bool = py~; // ok
      print mat~; // error
      var dpmat [[int; 2]; 2] = pmat~; // ok
      print mat[0]~; // error
      var dprow [int; 2] = prow~; // ok
      print mat[0][0]~; // error
      var dpel int = pel~; // ok
      var darrp int = arrp[0]~; // ok
      var dpp int~ = pp~; // ok
      var xdpp int = pp~; // error
      var ddpp int = pp~~; // ok
      print pp~~~; // error
    }
    `,
      [
        "15: Invalid operand for dereferencing operator '~'.",
        "17: Invalid operand for dereferencing operator '~'.",
        "19: Invalid operand for dereferencing operator '~'.",
        "21: Invalid operand for dereferencing operator '~'.",
        "23: Invalid operand for dereferencing operator '~'.",
        "27: Cannot assign value of type 'int~' to variable of type 'int'.",
        "29: Invalid operand for dereferencing operator '~'."
      ]
    )
  })

  test("dereferencing lval variables", () => {
    expectResolveErrors(
      `
    def main() {
      var x = 5;
      var y = true;
      var mat = [[1, 2], [3, 4]];
      var arrp [int~; 2] = [&x, &x];

      var px int~ = &x;
      var py bool~ = &y;
      var pmat [[int; 2]; 2]~ = &mat;
      var prow [int; 2]~ = &mat[0];
      var pel int~ = &mat[0][0];
      var arrpel int~ = arrp[0];
      var pp int~~ = &px;

      x~ = 6; // error
      px~ = 6; // ok
      y~ = false; // error
      py~ = false; // ok
      mat~ = [[5, 6], [7, 8]]; // error
      pmat~ = [[5, 6], [7, 8]]; // ok
      mat[0]~ = [5, 6]; // error
      prow~ = [5, 6]; // ok
      mat[0][0]~ = 5; // error
      pel~ = 5; // ok
      arrp[0]~ = 6; // ok
      pp~ = &x; // ok
      pp~~ = 1337; // ok
      pp~~ = &px; // error
      pp~~~ = 1; // error
    }
    `,
      [
        "15: Invalid operand for dereferencing operator '~'.",
        "17: Invalid operand for dereferencing operator '~'.",
        "19: Invalid operand for dereferencing operator '~'.",
        "21: Invalid operand for dereferencing operator '~'.",
        "23: Invalid operand for dereferencing operator '~'.",
        "28: Cannot implicitly convert operand to 'int'.",
        "29: Invalid operand for dereferencing operator '~'."
      ]
    )
  })

  test("pointer arithmetic", () => {
    expectResolveErrors(
      `
    def printAddr(p int~ ) {
      print p~;
    }
    def main() {
      var x = [1,2,3];
      var p = &x[1];
      printAddr(1 + p); // ok
      printAddr(p + 1); // ok
      printAddr(1 - p); // error
      printAddr(p - 1); // ok
      printAddr(2 * p); // error
      printAddr(p * 2); // error
      printAddr(2 / p); // error
      printAddr(p / 2); // error
      var q = &x[0];
      printAddr(p + q); // error
      printAddr(p - q); // error
    }
    `,
      [
        "9: Invalid operand types for binary operator '-'.",
        "11: Invalid operand types for binary operator '*'.",
        "12: Invalid operand types for binary operator '*'.",
        "13: Invalid operand types for binary operator '/'.",
        "14: Invalid operand types for binary operator '/'.",
        "16: Invalid operand types for binary operator '+'.",
        "17: Invalid operand types for binary operator '-'."
      ]
    )
  })

  test("dereferencing lval expressions", () => {
    expectResolveErrors(
      `
    var g = 1;
    def globalLoc() int~ {
      return &g;
    }
    def global() int {
      return g;
    }
    def main() {
      var x = 5;
      var y = true;
      var mat = [[1, 2], [3, 4]];
      var arrp [int~; 2] = [&x, &x];

      1~ = 6; // error
      (&1)~ = 6; // error
      (&x)~ = 6; // ok
      (&x + 1)~ = 6; // ok
      false~ = false; // error
      (&false)~ = false; // error
      (&y)~ = false; // ok
      [[1, 2], [3, 4]]~ = [[5, 6], [7, 8]]; // error
      (&[[1, 2], [3, 4]])~ = [[5, 6], [7, 8]]; // error
      (&mat)~ = [[5, 6], [7, 8]]; // ok
      (&mat[0] + 1)~ = [5, 6]; // ok
      (&mat[0][0] + 1)~ = 5; // ok
      (arrp[0] + 1)~ = 6; // ok

      var px int~ = &x;
      (px + 1)~ = 1; // ok
      (&px + 1)~ = &x; // ok

      globalLoc()~ = 2; // ok
      global()~ = 2; // error
      (&global())~ = 2; // error
    }
    `,
      [
        "14: Invalid operand for dereferencing operator '~'.",
        "15: Invalid operand for unary operator '&'.",
        "18: Invalid operand for dereferencing operator '~'.",
        "19: Invalid operand for unary operator '&'.",
        "21: Invalid operand for dereferencing operator '~'.",
        "22: Invalid operand for unary operator '&'.",
        "33: Invalid operand for dereferencing operator '~'.",
        "34: Invalid operand for unary operator '&'."
      ]
    )
  })

  test("non-printable type", () => {
    expectResolveErrors(
      `
    def main() {
      print foo(); // error
    }
    def foo() {}
    `,
      ["2: Cannot print value of type 'void'."]
    )
  })

  test("break/continue outside loop", () => {
    expectResolveErrors(
      `
    def main() {
      break; // error
      continue; // error
      foo(1, 2);
    }
    def foo(x int, y int) {
      break; // error
      var i = 0;
      while (i < 5) {
        if (i == y) {
          break; // ok
        }
        if (i == x) {
          continue; // ok
        }
        for (var j = 0; j < i; j += 1) {
          if (j == y) {
            break; // ok
          }
          if (j == x) {
            continue; // ok
          }
          print j;
        }
      }
    }
    `,
      [
        "2: Cannot break outside a loop.",
        "3: Cannot continue outside a loop.",
        "7: Cannot break outside a loop."
      ]
    )
  })

  test("structs: constructor and member access type inference", () => {
    expectResolveErrors(
      `
    def main() {
      var p = Point{1, 2}; // ok
      var t = Ticket{1, 'a', true}; // ok
      p.x = true; // error
      p.x = 3.14; // ok
      var f float = p.y; // ok
      var bl bool = p.y; // error
      t.id = false; // error
      t.id = 42; // ok
      t.group = 3.14; // error
      t.group = 'b'; // ok
      t.isDeluxe = 3.14; // error
      t.isDeluxe = false; // ok
    }
    struct Point { x float, y float }
    struct Ticket { id int, group byte, isDeluxe bool }
    `,
      [
        "4: Cannot implicitly convert operand to 'float'.",
        "7: Cannot assign value of type 'float' to variable of type 'bool'.",
        "8: Cannot implicitly convert operand to 'int'.",
        "10: Cannot implicitly convert operand to 'byte'.",
        "12: Cannot implicitly convert operand to 'bool'."
      ]
    )
  })
})
