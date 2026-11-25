/**
 * Tiny, dependency-free TypeScript/JavaScript highlighter for the evidence
 * viewer. Tokenizes a single line into colored segments — good enough for the
 * short code windows we show. Not a full parser; swap for Shiki/highlight.js
 * later if richer fidelity is needed.
 */
export type TokenKind = "comment" | "string" | "keyword" | "type" | "number" | "plain";

export interface Token {
  text: string;
  kind: TokenKind;
}

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "switch", "case", "break", "continue", "class", "extends", "implements", "interface",
  "type", "enum", "import", "export", "from", "as", "default", "new", "typeof",
  "instanceof", "in", "of", "async", "await", "yield", "try", "catch", "finally",
  "throw", "delete", "super", "public", "private", "protected", "readonly", "static",
  "get", "set", "declare", "namespace", "abstract", "is", "keyof", "infer", "satisfies",
]);

const TYPES = new Set([
  "string", "number", "boolean", "void", "unknown", "any", "never", "object", "symbol",
  "bigint", "null", "undefined", "true", "false", "this", "Promise", "Array", "Map",
  "Set", "Record", "Readonly", "Partial",
]);

const ID_START = /[A-Za-z_$]/;
const ID_PART = /[A-Za-z0-9_$]/;

/** Tokenize one line of source into highlight segments. */
export function highlightLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = line.length;

  while (i < n) {
    const c = line[i];

    // Line comment
    if (c === "/" && line[i + 1] === "/") {
      tokens.push({ text: line.slice(i), kind: "comment" });
      break;
    }

    // Block comment (within this line; to end if unterminated)
    if (c === "/" && line[i + 1] === "*") {
      const close = line.indexOf("*/", i + 2);
      const end = close === -1 ? n : close + 2;
      tokens.push({ text: line.slice(i, end), kind: "comment" });
      i = end;
      continue;
    }

    // String / template (single line)
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && line[j] !== c) {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push({ text: line.slice(i, Math.min(j + 1, n)), kind: "string" });
      i = Math.min(j + 1, n);
      continue;
    }

    // Number
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < n && /[0-9._xXa-fA-F]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), kind: "number" });
      i = j;
      continue;
    }

    // Identifier / keyword / type
    if (ID_START.test(c)) {
      let j = i + 1;
      while (j < n && ID_PART.test(line[j])) j++;
      const word = line.slice(i, j);
      const kind: TokenKind = KEYWORDS.has(word) ? "keyword" : TYPES.has(word) ? "type" : "plain";
      tokens.push({ text: word, kind });
      i = j;
      continue;
    }

    // Everything else — accumulate plain run until the next interesting char.
    let j = i + 1;
    while (j < n && !ID_START.test(line[j]) && !/[0-9"'`]/.test(line[j]) && !(line[j] === "/" && (line[j + 1] === "/" || line[j + 1] === "*"))) {
      j++;
    }
    tokens.push({ text: line.slice(i, j), kind: "plain" });
    i = j;
  }

  return tokens;
}
