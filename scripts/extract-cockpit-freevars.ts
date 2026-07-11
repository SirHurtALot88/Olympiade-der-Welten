/**
 * One-off strangler helper: enumerate the free identifiers used inside the
 * cockpit FoundationViewMount JSX block of FoundationPageClient.tsx together
 * with their inferred type strings, so we can author a precise dumb-panel
 * props interface without a slow compile round-trip per prop.
 *
 * Usage: tsx scripts/extract-cockpit-freevars.ts <startLine> <endLine>
 */
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

const TARGET = path.resolve(process.cwd(), "app/foundation/FoundationPageClient.tsx");
const startLine = Number(process.argv[2] ?? "25012");
const endLine = Number(process.argv[3] ?? "27728");

function loadProgram(): ts.Program {
  const configPath = path.resolve(process.cwd(), "tsconfig.check.json");
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    process.cwd(),
  );
  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true },
  });
}

const program = loadProgram();
const checker = program.getTypeChecker();
const sf = program.getSourceFile(TARGET);
if (!sf) {
  throw new Error(`source file not found in program: ${TARGET}`);
}

// Locate the outermost JSX element whose opening tag begins on `startLine`.
// This is the cockpit <FoundationViewMount ...> element.
let blockNode: ts.Node | undefined;
function findBlock(node: ts.Node) {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    const { line } = ts.getLineAndCharacterOfPosition(sf, node.getStart(sf));
    if (line === startLine - 1) {
      if (!blockNode || node.getEnd() - node.getStart(sf) > blockNode.getEnd() - blockNode.getStart(sf)) {
        blockNode = node;
      }
    }
  }
  ts.forEachChild(node, findBlock);
}
findBlock(sf);
if (!blockNode) {
  throw new Error(`could not locate JSX element starting on line ${startLine}`);
}
{
  const endLineActual = ts.getLineAndCharacterOfPosition(sf, blockNode.getEnd()).line + 1;
  console.log(`block node kind=${ts.SyntaxKind[blockNode.kind]} lines ${startLine}-${endLineActual}`);
}

// Find the enclosing component function (default export arrow/function).
let componentNode: ts.Node | undefined;
let n: ts.Node | undefined = blockNode;
while (n) {
  if (
    ts.isFunctionDeclaration(n) ||
    ts.isArrowFunction(n) ||
    ts.isFunctionExpression(n)
  ) {
    componentNode = n;
    break;
  }
  n = n.parent;
}
if (!componentNode) {
  throw new Error("could not locate enclosing component function");
}
const compStart = componentNode.getStart(sf);
const compEnd = componentNode.getEnd();
const blockStart = blockNode.getStart(sf);
const blockEnd = blockNode.getEnd();

function isInComponentButOutsideBlock(pos: number, end: number): boolean {
  const inComponent = pos >= compStart && end <= compEnd;
  const inBlock = pos >= blockStart && end <= blockEnd;
  return inComponent && !inBlock;
}

type Collected = { name: string; type: string; count: number };
const collected = new Map<string, Collected>();
// Module-scope identifiers used inside the block (not props): imports + top-level decls.
const moduleImportUses = new Map<string, { module: string; isType: boolean }>();
const moduleDeclUses = new Map<string, { kind: string; type: string }>();

function typeString(node: ts.Node): string {
  try {
    const t = checker.getTypeAtLocation(node);
    return checker
      .typeToString(t, node, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType)
      .replace(/\n/g, " ");
  } catch (err) {
    return `/* type-error: ${(err as Error).message} */ unknown`;
  }
}

function visit(node: ts.Node) {
  if (ts.isIdentifier(node)) {
    // Skip property names in property access (obj.prop -> prop) and named keys.
    const parent = node.parent;
    const isPropName =
      (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
      (ts.isQualifiedName(parent) && parent.right === node);
    const isPropertyAssignmentName =
      ts.isPropertyAssignment(parent) && parent.name === node;
    const isJsxAttrName = ts.isJsxAttribute(parent) && parent.name === node;
    const isBindingName =
      (ts.isBindingElement(parent) && parent.name === node) ||
      (ts.isParameter(parent) && parent.name === node) ||
      (ts.isVariableDeclaration(parent) && parent.name === node);
    if (!isPropName && !isPropertyAssignmentName && !isJsxAttrName && !isBindingName) {
      const sym = checker.getSymbolAtLocation(node);
      const decls = sym?.getDeclarations();
      if (decls && decls.length > 0) {
        const declaredInCompOutsideBlock = decls.some((d) => {
          const dsf = d.getSourceFile();
          if (dsf !== sf) return false;
          return isInComponentButOutsideBlock(d.getStart(dsf), d.getEnd());
        });
        if (declaredInCompOutsideBlock) {
          const name = node.text;
          const existing = collected.get(name);
          if (existing) {
            existing.count += 1;
          } else {
            collected.set(name, { name, type: typeString(node), count: 1 });
          }
        } else {
          // Is it a module-scope declaration in sf (outside the component)?
          for (const d of decls) {
            const dsf = d.getSourceFile();
            if (dsf !== sf) continue;
            const inComp = d.getStart(dsf) >= compStart && d.getEnd() <= compEnd;
            if (inComp) continue;
            // module scope: walk up to find import or top-level decl kind.
            let p: ts.Node | undefined = d;
            let importDecl: ts.ImportDeclaration | undefined;
            while (p) {
              if (ts.isImportDeclaration(p)) {
                importDecl = p;
                break;
              }
              p = p.parent;
            }
            if (importDecl && ts.isStringLiteral(importDecl.moduleSpecifier)) {
              const isTypeOnly = importDecl.importClause?.isTypeOnly ?? false;
              moduleImportUses.set(node.text, { module: importDecl.moduleSpecifier.text, isType: isTypeOnly });
            } else if (!moduleDeclUses.has(node.text)) {
              moduleDeclUses.set(node.text, { kind: ts.SyntaxKind[d.kind], type: typeString(node) });
            }
          }
        }
      }
    }
  }
  ts.forEachChild(node, visit);
}

visit(blockNode);

const sorted = [...collected.values()].sort((a, b) => a.name.localeCompare(b.name));
const out = sorted.map((c) => `${c.name}\t(${c.count})\t${c.type}`).join("\n");
const outPath = path.resolve(process.cwd(), "outputs/cockpit-freevars.tsv");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `# name\tcount\ttype\n${out}\n`, "utf8");

// ---- Generate props interface + import statements -------------------------

const projectRoot = process.cwd();
function absToAlias(abs: string): string {
  let rel = path.relative(projectRoot, abs).replace(/\\/g, "/");
  rel = rel.replace(/\.d\.ts$|\.ts$|\.tsx$/, "");
  return `@/${rel}`;
}

// Collect import() qualified types → { module -> Set<name> }, and rewrite text.
const importsByModule = new Map<string, Set<string>>();
let needsReactNamespace = false;

function rewriteType(typeStr: string): string {
  // node_modules react → React namespace
  let s = typeStr.replace(
    /import\("[^"]*node_modules\/@types\/react\/index"\)\./g,
    () => {
      needsReactNamespace = true;
      return "React.";
    },
  );
  // other absolute import("...").Name → Name, record import
  s = s.replace(/import\("([^"]+)"\)\.([A-Za-z_$][\w$]*)/g, (_m, abs: string, name: string) => {
    const alias = absToAlias(abs);
    if (!importsByModule.has(alias)) importsByModule.set(alias, new Set());
    importsByModule.get(alias)!.add(name);
    return name;
  });
  return s;
}

const declPropEntries = [...moduleDeclUses.entries()]
  .filter(([, v]) => v.kind !== "ImportDeclaration")
  .sort((a, b) => a[0].localeCompare(b[0]));
const propLines = [
  ...sorted.map((c) => `  ${c.name}: ${rewriteType(c.type)};`),
  ...declPropEntries.map(([name, v]) => `  ${name}: ${rewriteType(v.type)};`),
];

// Parse parent imports + local type declarations to resolve bare type names.
type ImportBinding = { module: string; isType: boolean };
const parentImports = new Map<string, ImportBinding>();
const localTypeDecls = new Set<string>();

for (const stmt of sf.statements) {
  if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
    const mod = stmt.moduleSpecifier.text;
    const isTypeOnly = stmt.importClause?.isTypeOnly ?? false;
    const clause = stmt.importClause;
    if (!clause) continue;
    if (clause.name) parentImports.set(clause.name.text, { module: mod, isType: isTypeOnly });
    const nb = clause.namedBindings;
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        parentImports.set(el.name.text, { module: mod, isType: isTypeOnly || el.isTypeOnly });
      }
    } else if (nb && ts.isNamespaceImport(nb)) {
      parentImports.set(nb.name.text, { module: mod, isType: isTypeOnly });
    }
  } else if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt) || ts.isEnumDeclaration(stmt)) {
    localTypeDecls.add(stmt.name.text);
  }
}

// Gather Capitalized identifiers referenced in the (rewritten) prop type text.
const TS_BUILTINS = new Set([
  "Array", "Record", "Map", "Set", "Promise", "Partial", "Readonly", "Pick",
  "Omit", "Exclude", "Extract", "ReturnType", "Parameters", "Dispatch",
  "SetStateAction", "React", "JSX", "Element", "AbortSignal", "Date",
  "RegExp", "Error", "Boolean", "Number", "String", "Object", "Function",
]);
const referenced = new Set<string>();
const rewrittenText = propLines.join("\n");
for (const m of rewrittenText.matchAll(/\b([A-Z][A-Za-z0-9_$]*)\b/g)) {
  const name = m[1];
  if (!TS_BUILTINS.has(name)) referenced.add(name);
}

// Resolve referenced names from parent imports; note local decls + unresolved.
const resolvedImportsByModule = new Map<string, Set<string>>();
for (const [mod, names] of importsByModule) {
  resolvedImportsByModule.set(mod, new Set(names));
}
const localTypesUsed = new Set<string>();
const unresolved = new Set<string>();
for (const name of referenced) {
  if (parentImports.has(name)) {
    const b = parentImports.get(name)!;
    if (!resolvedImportsByModule.has(b.module)) resolvedImportsByModule.set(b.module, new Set());
    resolvedImportsByModule.get(b.module)!.add(name);
  } else if (localTypeDecls.has(name)) {
    localTypesUsed.add(name);
  } else {
    // may already be an import()-derived name already recorded, else unknown
    let recorded = false;
    for (const s of importsByModule.values()) if (s.has(name)) recorded = true;
    if (!recorded) unresolved.add(name);
  }
}

const importLines: string[] = [];
if (needsReactNamespace) importLines.push(`import type * as React from "react";`);
importLines.push(`import type { Dispatch, SetStateAction } from "react";`);
for (const mod of [...resolvedImportsByModule.keys()].sort()) {
  const names = [...resolvedImportsByModule.get(mod)!].sort();
  importLines.push(`import type { ${names.join(", ")} } from "${mod}";`);
}
// Runtime library imports the panel needs directly (exclude the block's own mount tag + type-only routing id).
const runtimeImportLines: string[] = [];
{
  const byMod = new Map<string, string[]>();
  for (const [name, info] of moduleImportUses) {
    if (name === "FoundationViewMount" || name === "FoundationViewId") continue;
    if (!byMod.has(info.module)) byMod.set(info.module, []);
    byMod.get(info.module)!.push(name);
  }
  for (const mod of [...byMod.keys()].sort()) {
    runtimeImportLines.push(`import { ${byMod.get(mod)!.sort().join(", ")} } from "${mod}";`);
  }
}

const allProps = [
  ...sorted.map((c) => c.name),
  ...declPropEntries.map(([n]) => n),
].sort();
const generated = `${importLines.join("\n")}\n\n// Runtime library imports for the panel (direct, no cycle):\n${runtimeImportLines.map((l) => `// ${l}`).join("\n")}\n\n// Shared types to import from cockpit-types barrel:\n// ${[...localTypesUsed].sort().join(", ") || "(none)"}\n\n// Destructure list:\n// const {\n${allProps.map((n) => `//   ${n},`).join("\n")}\n// } = props;\n\nexport interface FoundationCockpitPanelProps {\n${propLines.join("\n")}\n}\n`;
const genPath = path.resolve(projectRoot, "outputs/cockpit-panel-props.generated.ts");
fs.writeFileSync(genPath, generated, "utf8");

// Module-scope usage report (imports + top-level decls used by the block).
const modImportLines: string[] = [];
const byModule = new Map<string, string[]>();
for (const [name, info] of moduleImportUses) {
  if (!byModule.has(info.module)) byModule.set(info.module, []);
  byModule.get(info.module)!.push(name);
}
for (const mod of [...byModule.keys()].sort()) {
  modImportLines.push(`import { ${byModule.get(mod)!.sort().join(", ")} } from "${mod}";`);
}
const modDeclReport = [...moduleDeclUses.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  .map(([n, k]) => `${n} (${k})`);
const modPath = path.resolve(projectRoot, "outputs/cockpit-module-scope-uses.txt");
fs.writeFileSync(
  modPath,
  `# Module-scope imports used by cockpit block (re-import in panel):\n${modImportLines.join("\n")}\n\n# Top-level decls in FoundationPageClient used by cockpit block (need export+import or move):\n${modDeclReport.join("\n")}\n`,
  "utf8",
);

console.log(`collected ${sorted.length} free identifiers`);
console.log(`wrote ${outPath}`);
console.log(`wrote ${genPath}`);
console.log(`wrote ${modPath}`);
console.log(`local types used (need export/move): ${[...localTypesUsed].sort().join(", ") || "(none)"}`);
console.log(`module-scope top-level decls used: ${modDeclReport.join(", ") || "(none)"}`);
console.log(`unresolved: ${[...unresolved].sort().join(", ") || "(none)"}`);
