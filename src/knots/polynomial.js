const EPSILON = 1e-10;

export function parseLaurentPolynomial(input) {
  const source = normalizeInput(input);
  if (!source) {
    throw new Error("请输入多项式。");
  }
  const parser = new PolynomialParser(tokenize(source));
  const polynomial = parser.parseExpression();
  if (!parser.atEnd()) {
    throw new Error(`无法识别 "${parser.peek().value}"。`);
  }
  return polynomial;
}

export function polynomialsEqual(first, second) {
  const keys = new Set([...first.keys(), ...second.keys()]);
  return [...keys].every((key) =>
    Math.abs((first.get(key) || 0) - (second.get(key) || 0)) < EPSILON
  );
}

function normalizeInput(input) {
  const raw = String(input || "").trim();
  const expression = raw.includes("=") ? raw.slice(raw.lastIndexOf("=") + 1) : raw;
  return expression
    .toLowerCase()
    .replaceAll("−", "-")
    .replaceAll("–", "-")
    .replaceAll("·", "*")
    .replaceAll("**", "^")
    .replaceAll("{", "(")
    .replaceAll("}", ")")
    .replace(/\s+/g, "");
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (/\d/.test(character)) {
      let end = index + 1;
      while (end < source.length && /\d/.test(source[end])) end += 1;
      tokens.push({ type: "number", value: source.slice(index, end) });
      index = end;
      continue;
    }
    if (character === "a" || character === "z") {
      tokens.push({ type: "variable", value: character });
      index += 1;
      continue;
    }
    if ("+-*/^()".includes(character)) {
      tokens.push({ type: character, value: character });
      index += 1;
      continue;
    }
    throw new Error(`无法识别字符 "${character}"。`);
  }
  return tokens;
}

class PolynomialParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  parseExpression() {
    let value = this.parseTerm();
    while (this.match("+") || this.match("-")) {
      const operator = this.previous().type;
      const right = this.parseTerm();
      value = add(value, operator === "+" ? right : scale(right, -1));
    }
    return value;
  }

  parseTerm() {
    let value = this.parseFactor();
    while (true) {
      if (this.match("*")) {
        value = multiply(value, this.parseFactor());
      } else if (this.match("/")) {
        value = multiply(value, power(this.parseFactor(), -1));
      } else if (this.startsPrimary()) {
        value = multiply(value, this.parseFactor());
      } else {
        return value;
      }
    }
  }

  parseFactor() {
    let sign = 1;
    while (this.match("+") || this.match("-")) {
      if (this.previous().type === "-") sign *= -1;
    }

    let value = this.parsePrimary();
    if (this.match("^")) {
      value = power(value, this.parseExponent());
    }
    return sign === 1 ? value : scale(value, -1);
  }

  parsePrimary() {
    if (this.match("number")) {
      return constant(Number(this.previous().value));
    }
    if (this.match("variable")) {
      return variable(this.previous().value);
    }
    if (this.match("(")) {
      const value = this.parseExpression();
      this.consume(")", "缺少右括号。");
      return value;
    }
    throw new Error("此处需要数字、变量或括号。");
  }

  parseExponent() {
    const parenthesized = this.match("(");
    let sign = 1;
    if (this.match("+") || this.match("-")) {
      if (this.previous().type === "-") sign = -1;
    }
    const token = this.consume("number", "指数必须是整数。");
    if (parenthesized) this.consume(")", "指数缺少右括号。");
    return sign * Number(token.value);
  }

  startsPrimary() {
    return ["number", "variable", "("].includes(this.peek()?.type);
  }

  match(type) {
    if (this.peek()?.type !== type) return false;
    this.index += 1;
    return true;
  }

  consume(type, message) {
    if (!this.match(type)) throw new Error(message);
    return this.previous();
  }

  previous() {
    return this.tokens[this.index - 1];
  }

  peek() {
    return this.tokens[this.index];
  }

  atEnd() {
    return this.index >= this.tokens.length;
  }
}

function constant(value) {
  return value === 0 ? new Map() : new Map([[key(0, 0), value]]);
}

function variable(name) {
  return new Map([[name === "a" ? key(1, 0) : key(0, 1), 1]]);
}

function add(first, second) {
  const result = new Map(first);
  second.forEach((coefficient, monomial) => {
    setCoefficient(result, monomial, (result.get(monomial) || 0) + coefficient);
  });
  return result;
}

function scale(polynomial, amount) {
  const result = new Map();
  polynomial.forEach((coefficient, monomial) => {
    setCoefficient(result, monomial, coefficient * amount);
  });
  return result;
}

function multiply(first, second) {
  const result = new Map();
  first.forEach((firstCoefficient, firstKey) => {
    const [firstA, firstZ] = exponents(firstKey);
    second.forEach((secondCoefficient, secondKey) => {
      const [secondA, secondZ] = exponents(secondKey);
      const monomial = key(firstA + secondA, firstZ + secondZ);
      setCoefficient(
        result,
        monomial,
        (result.get(monomial) || 0) + firstCoefficient * secondCoefficient,
      );
    });
  });
  return result;
}

function power(polynomial, exponent) {
  if (!Number.isInteger(exponent)) throw new Error("指数必须是整数。");
  if (exponent < 0) return power(invertMonomial(polynomial), -exponent);
  let result = constant(1);
  let factor = polynomial;
  let remaining = exponent;
  while (remaining > 0) {
    if (remaining % 2 === 1) result = multiply(result, factor);
    remaining = Math.floor(remaining / 2);
    if (remaining > 0) factor = multiply(factor, factor);
  }
  return result;
}

function invertMonomial(polynomial) {
  if (polynomial.size !== 1) {
    throw new Error("负指数或除法只能用于单项式。");
  }
  const [[monomial, coefficient]] = polynomial.entries();
  if (Math.abs(coefficient) < EPSILON) throw new Error("不能除以零。");
  const [aExponent, zExponent] = exponents(monomial);
  return new Map([[key(-aExponent, -zExponent), 1 / coefficient]]);
}

function setCoefficient(polynomial, monomial, coefficient) {
  if (Math.abs(coefficient) < EPSILON) polynomial.delete(monomial);
  else polynomial.set(monomial, coefficient);
}

function key(aExponent, zExponent) {
  return `${aExponent},${zExponent}`;
}

function exponents(monomial) {
  return monomial.split(",").map(Number);
}
