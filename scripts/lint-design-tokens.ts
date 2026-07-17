/**
 * Design-Token / Formatter-Linter mit Ratchet.
 *
 * Scannt `app/foundation/**` und `components/foundation/**` auf drei Klassen
 * verbotener Ad-hoc-Muster, die den etablierten Neuer-Look/velo-Standard
 * umgehen:
 *
 *   - EUR:    rohes "€"-Zeichen statt eines Formatters
 *   - LOCALE: `.toLocaleString(` oder `new Intl.NumberFormat(` statt der
 *             geteilten Formatter (`formatNlMoney`, `formatNlNumber`,
 *             `formatNlSignedNumber`, `formatNlSignedPercent`, ...)
 *   - HEX:    hartkodierte Hex-Farben (`#rgb` / `#rrggbb`) statt CSS-Tokens
 *             (`var(--nl-*)`, `NL_TONE_VAR`)
 *
 * Ausgenommene Dateien (die Formatter/Token-Quellen selbst — siehe
 * ALLOWED_FILES unten) sowie Test-Dateien und `.next/`-Build-Output werden
 * nicht gescannt.
 *
 * --- Ratchet-Mechanik ---
 * Der heutige Bestand an Verstößen ist bekannt und wird geduldet
 * ("Baseline"), damit das Skript sofort scharf geschaltet werden kann, ohne
 * ~90 Altlasten refactoren zu müssen. Neue Verstöße (nicht in der Baseline)
 * lassen den Lauf fehlschlagen; der Bestand darf nur schrumpfen, nie wachsen.
 *
 * Baseline-Key-Format: `<relativer Pfad>:<Zeilennummer>:<Regel>`
 *   Beispiel: "app/foundation/PlayerDetailDrawer.tsx:42:HEX"
 *
 * Das ist robust gegen Umsortierung der Baseline-Datei selbst (sie ist eine
 * Menge, keine Liste), aber NICHT robust gegen das Verschieben/Einfügen von
 * Zeilen in einer bereits erfassten Datei (jede Zeilenverschiebung zählt als
 * neuer Fund an der alten Zeile + Verschwinden des alten Funds). Das ist
 * gewollt: sobald jemand eine betroffene Datei anfasst, soll der Linter
 * erneut hinschauen und ermutigt dazu, den Treffer bei der Gelegenheit zu
 * bereinigen statt ihn nur zu verschieben.
 *
 * Flags:
 *   --update-baseline   schreibt den aktuellen Bestand als neue Baseline (Exit 0)
 *   --report            listet kompletten Bestand + "davon neu", failt nie
 *   (Standardlauf)       nur NEUE Treffer (nicht in Baseline) -> Exit 1
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_ROOTS = ["app/foundation", "components/foundation"];
const BASELINE_PATH = path.join(ROOT, "scripts/design-token-baseline.json");

type RuleId = "EUR" | "LOCALE" | "HEX";

interface Violation {
  file: string;
  line: number;
  rule: RuleId;
  excerpt: string;
}

// Formatter-/Token-Quelldateien, die die geteilten Neuer-Look/velo-Primitive
// definieren. Sie dürfen naturgemäß Intl.NumberFormat, "€" (als Suffix/Text)
// und Hex-Fallbackfarben (`var(--nl-x, #hex)`) enthalten — sie SIND der
// Standard, den alle anderen Dateien benutzen sollen.
const ALLOWED_FILES = new Set<string>([
  // Geteilte Geld-/Zahl-Formatter "Neuer Look".
  "components/foundation/new-look/nl-format.ts",
  // Ton-/Farb-Tokens "Neuer Look" inkl. Intl-Zahlformat (formatNlNumber) und
  // Hex-Fallbacks für `var(--nl-*, #hex)` (Storybook/Isolation-Rendering
  // außerhalb von `.is-new-look`).
  "components/foundation/new-look/nl-tones.ts",
]);

// CSS-Dateien definieren die Tokens selbst (z.B. `--nl-pow: #ff6b6b;` in
// app/globals.css) und werden generell nicht als TS/TSX-Quellcode behandelt
// — die Hex-Regel gilt nur für `.ts`/`.tsx`, CSS ist strukturell ausgenommen.
const SCAN_EXTENSIONS = /\.(tsx|ts)$/;

const EXCLUDED_NAME_PATTERNS = [/\.test\./, /\.spec\./];
const EXCLUDED_DIR_NAMES = new Set([".next", "node_modules"]);

const EUR_PATTERN = /€/;
const LOCALE_PATTERN = /\.toLocaleString\(|new Intl\.NumberFormat\(/;
// #rgb or #rrggbb, word-boundary-ish: not immediately preceded/followed by a
// hex digit (avoids matching inside longer alphanumeric tokens/ids).
const HEX_PATTERN = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) {
        continue;
      }
      files.push(...collectSourceFiles(path.join(dir, entry.name)));
      continue;
    }
    if (SCAN_EXTENSIONS.test(entry.name) && !EXCLUDED_NAME_PATTERNS.some((p) => p.test(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function scanFile(relativePath: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const lines = source.split("\n");

  lines.forEach((lineText, index) => {
    const lineNumber = index + 1;
    const excerpt = lineText.trim().slice(0, 160);

    if (EUR_PATTERN.test(lineText)) {
      violations.push({ file: relativePath, line: lineNumber, rule: "EUR", excerpt });
    }
    if (LOCALE_PATTERN.test(lineText)) {
      violations.push({ file: relativePath, line: lineNumber, rule: "LOCALE", excerpt });
    }
    if (HEX_PATTERN.test(lineText)) {
      violations.push({ file: relativePath, line: lineNumber, rule: "HEX", excerpt });
    }
  });

  return violations;
}

function scanAll(): Violation[] {
  const violations: Violation[] = [];

  for (const root of SCAN_ROOTS) {
    const absoluteRoot = path.join(ROOT, root);
    for (const filePath of collectSourceFiles(absoluteRoot)) {
      const relativePath = path.relative(ROOT, filePath).split(path.sep).join("/");
      if (ALLOWED_FILES.has(relativePath)) {
        continue;
      }
      const source = fs.readFileSync(filePath, "utf8");
      violations.push(...scanFile(relativePath, source));
    }
  }

  return violations;
}

function violationKey(v: Violation): string {
  return `${v.file}:${v.line}:${v.rule}`;
}

function loadBaseline(): Set<string> {
  if (!fs.existsSync(BASELINE_PATH)) {
    return new Set();
  }
  const raw = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) as { violations?: string[] };
  return new Set(raw.violations ?? []);
}

function writeBaseline(keys: string[]) {
  const sorted = [...keys].sort();
  const payload = {
    _comment:
      "Ratchet-Baseline fuer scripts/lint-design-tokens.ts. Key-Format: '<datei>:<zeile>:<regel>'. " +
      "Regel-IDs: EUR (rohes Euro-Zeichen), LOCALE (toLocaleString/Intl.NumberFormat), HEX (hartkodierte Hex-Farbe). " +
      "Neu generieren mit: npx tsx scripts/lint-design-tokens.ts --update-baseline",
    generatedAt: new Date().toISOString(),
    count: sorted.length,
    violations: sorted,
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function summarizeByRule(violations: Violation[]): Record<RuleId, number> {
  const counts: Record<RuleId, number> = { EUR: 0, LOCALE: 0, HEX: 0 };
  for (const v of violations) {
    counts[v.rule] += 1;
  }
  return counts;
}

function printViolationList(title: string, violations: Violation[]) {
  console.log(title);
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line} [${v.rule}]  ${v.excerpt}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const updateBaseline = args.includes("--update-baseline");
  const report = args.includes("--report");

  const violations = scanAll();
  const counts = summarizeByRule(violations);
  const countsLine = `EUR=${counts.EUR} LOCALE=${counts.LOCALE} HEX=${counts.HEX} TOTAL=${violations.length}`;

  if (updateBaseline) {
    writeBaseline(violations.map(violationKey));
    console.log(`Design-Token-Baseline aktualisiert (${BASELINE_PATH}).`);
    console.log(`Bestand: ${countsLine}`);
    process.exit(0);
  }

  const baseline = loadBaseline();
  const newViolations = violations.filter((v) => !baseline.has(violationKey(v)));

  if (report) {
    printViolationList("Design-Token-Bestand (gesamt, inkl. geduldeter Baseline-Treffer):", violations);
    console.log(`Bestand: ${countsLine}`);
    console.log(`Baseline-Groesse: ${baseline.size}`);
    console.log(`Davon neu (nicht in Baseline): ${newViolations.length}`);
    if (newViolations.length > 0) {
      printViolationList("Neue Treffer:", newViolations);
    }
    process.exit(0);
  }

  if (newViolations.length > 0) {
    printViolationList("Design-Token-Lint: neue Verstoesse (nicht in Baseline):", newViolations);
    console.error(
      `\n${newViolations.length} neue(r) Design-Token-Verstoss/Verstoesse gefunden. ` +
        "Bitte geteilte Formatter (formatNlMoney/formatNlNumber/formatNlSignedNumber) bzw. CSS-Tokens " +
        "(var(--nl-*), NL_TONE_VAR) verwenden, oder falls es sich um einen bewusst geduldeten " +
        "Altbestand handelt: npx tsx scripts/lint-design-tokens.ts --update-baseline",
    );
    process.exit(1);
  }

  console.log(`Design-Token-Lint OK. Keine neuen Verstoesse. Bestand: ${countsLine}`);
  process.exit(0);
}

main();
