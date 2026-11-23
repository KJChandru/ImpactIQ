import * as ts from "typescript";
import type {
  ImportEdge,
  IndexedFile,
  IntakeResult,
  RepoIndex,
  SupportedLanguage,
  SymbolInfo,
  SymbolKind,
} from "@/types";

/**
 * Module B — Code Indexing Engine.
 *
 * Converts the files from Module A into structured FACTS using the TypeScript
 * Compiler API (real ASTs, not regex): import/export edges with resolved target
 * files, and top-level symbols — every item carrying file + line evidence.
 *
 * This layer never calls the LLM. Its output (`RepoIndex`) is the ground truth
 * that later modules reason over and validate against.
 */
export function indexRepo(intake: IntakeResult): RepoIndex {
  const files: IndexedFile[] = [];
  const symbols: SymbolInfo[] = [];
  const edges: ImportEdge[] = [];

  // Known file set drives relative-import resolution.
  const fileSet = new Set(intake.files.map((f) => f.path));

  for (const f of intake.files) {
    const source = ts.createSourceFile(
      f.path,
      f.content,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      scriptKindOf(f.ext)
    );

    const lineAt = (node: ts.Node): number =>
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

    files.push({
      path: f.path,
      language: languageOf(f.ext),
      lines: f.content.length === 0 ? 0 : f.content.split("\n").length,
      isTest: isTestPath(f.path),
    });

    // Top-level declarations → symbols.
    for (const stmt of source.statements) {
      collectSymbols(stmt, f.path, lineAt, symbols);
    }

    // Walk the whole tree for static + dynamic imports and requires.
    const visit = (node: ts.Node): void => {
      const edge = edgeFromNode(node, f.path, fileSet, lineAt);
      if (edge) edges.push(edge);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return {
    files,
    symbols,
    edges,
    stats: {
      fileCount: files.length,
      symbolCount: symbols.length,
      edgeCount: edges.length,
      externalEdgeCount: edges.filter((e) => e.external).length,
      unresolvedEdgeCount: edges.filter((e) => !e.external && e.to === null).length,
    },
  };
}

// ─── Symbols ───────────────────────────────────────────────────

function collectSymbols(
  node: ts.Node,
  file: string,
  lineAt: (n: ts.Node) => number,
  out: SymbolInfo[]
): void {
  if (ts.isFunctionDeclaration(node) && node.name) {
    out.push(sym(node.name.text, "function", file, lineAt(node), isExported(node)));
  } else if (ts.isClassDeclaration(node) && node.name) {
    out.push(sym(node.name.text, "class", file, lineAt(node), isExported(node)));
  } else if (ts.isInterfaceDeclaration(node)) {
    out.push(sym(node.name.text, "interface", file, lineAt(node), isExported(node)));
  } else if (ts.isTypeAliasDeclaration(node)) {
    out.push(sym(node.name.text, "type", file, lineAt(node), isExported(node)));
  } else if (ts.isEnumDeclaration(node)) {
    out.push(sym(node.name.text, "enum", file, lineAt(node), isExported(node)));
  } else if (ts.isVariableStatement(node)) {
    const exported = isExported(node);
    const kind: SymbolKind =
      (node.declarationList.flags & ts.NodeFlags.Const) !== 0 ? "const" : "variable";
    for (const decl of node.declarationList.declarations) {
      collectBindingNames(decl.name, kind, file, lineAt(decl), exported, out);
    }
  }
}

/** Handles plain identifiers plus `const { a, b } = …` / `const [x] = …`. */
function collectBindingNames(
  name: ts.BindingName,
  kind: SymbolKind,
  file: string,
  line: number,
  exported: boolean,
  out: SymbolInfo[]
): void {
  if (ts.isIdentifier(name)) {
    out.push(sym(name.text, kind, file, line, exported));
    return;
  }
  for (const el of name.elements) {
    if (ts.isOmittedExpression(el)) continue;
    collectBindingNames(el.name, kind, file, line, exported, out);
  }
}

function isExported(node: ts.Node): boolean {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function sym(
  name: string,
  kind: SymbolKind,
  file: string,
  line: number,
  exported: boolean
): SymbolInfo {
  return { name, kind, file, line, exported };
}

// ─── Import / export edges ─────────────────────────────────────

function edgeFromNode(
  node: ts.Node,
  from: string,
  fileSet: Set<string>,
  lineAt: (n: ts.Node) => number
): ImportEdge | null {
  // import ... from "x"   (including side-effect `import "x"`)
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    return makeEdge(from, node.moduleSpecifier.text, importedNames(node.importClause), lineAt(node), fileSet);
  }

  // export ... from "x"   (re-export is a real dependency)
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    const imported =
      node.exportClause && ts.isNamedExports(node.exportClause)
        ? node.exportClause.elements.map((e) => e.name.text)
        : ["*"];
    return makeEdge(from, node.moduleSpecifier.text, imported, lineAt(node), fileSet);
  }

  // Dynamic import("x")
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments[0] &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return makeEdge(from, node.arguments[0].text, ["*"], lineAt(node), fileSet);
  }

  // CommonJS require("x")
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "require" &&
    node.arguments[0] &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return makeEdge(from, node.arguments[0].text, ["*"], lineAt(node), fileSet);
  }

  return null;
}

function importedNames(clause: ts.ImportClause | undefined): string[] {
  if (!clause) return []; // side-effect import: `import "x"`
  const names: string[] = [];
  if (clause.name) names.push("default");
  const bindings = clause.namedBindings;
  if (bindings) {
    if (ts.isNamespaceImport(bindings)) {
      names.push("*");
    } else {
      for (const el of bindings.elements) names.push(el.name.text);
    }
  }
  return names;
}

function makeEdge(
  from: string,
  specifier: string,
  imported: string[],
  line: number,
  fileSet: Set<string>
): ImportEdge {
  // "internal style" = relative path or the common "@/" Next.js root alias.
  const internalStyle = specifier.startsWith(".") || specifier.startsWith("@/");
  const to = internalStyle ? resolveSpecifier(specifier, from, fileSet) : null;
  return { from, to, specifier, external: !internalStyle, imported, line };
}

/** Resolve a repo-internal specifier to an actual indexed file, or null. */
function resolveSpecifier(spec: string, importer: string, fileSet: Set<string>): string | null {
  let base: string;
  if (spec.startsWith(".")) {
    base = joinPosix(dirname(importer), spec);
  } else if (spec.startsWith("@/")) {
    base = spec.slice(2); // "@/" → repo root (tsconfig paths convention)
  } else {
    return null;
  }

  base = normalizeRel(base);
  const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

  if (fileSet.has(base)) return base;
  for (const e of exts) if (fileSet.has(base + e)) return base + e;
  for (const e of exts) if (fileSet.has(`${base}/index${e}`)) return `${base}/index${e}`;
  return null;
}

// ─── Small path utilities (POSIX, repo-relative) ───────────────

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

function joinPosix(a: string, b: string): string {
  return a ? `${a}/${b}` : b;
}

/** Collapse "." and ".." segments without touching the filesystem. */
function normalizeRel(p: string): string {
  const out: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}

// ─── Language classification ───────────────────────────────────

function languageOf(ext: string): SupportedLanguage {
  switch (ext) {
    case ".ts":
      return "typescript";
    case ".tsx":
      return "tsx";
    case ".jsx":
      return "jsx";
    default:
      return "javascript"; // .js .mjs .cjs
  }
}

function scriptKindOf(ext: string): ts.ScriptKind {
  switch (ext) {
    case ".ts":
      return ts.ScriptKind.TS;
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.JS;
  }
}

function isTestPath(p: string): boolean {
  const base = p.split("/").pop() ?? "";
  if (/\.(test|spec)\.[cm]?[tj]sx?$/.test(base)) return true;
  return p.split("/").some((s) => s === "__tests__" || s === "__test__");
}
