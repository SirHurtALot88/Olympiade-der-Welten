/**
 * GEMELDET (Team-Audit, Paket T3): "Beim Scrollen nach rechts verliert man die
 * Namensspalte" (P1) und "Die PPs-Spalte ist dauerhaft rot hervorgehoben,
 * enthält am Spieltag 1 aber nur '—'" (P2) — dazu P3 ("Spaltengruppen als
 * Reiter statt 19-Spalten-Endlosscroll") und P6 ("Abkürzungen einmal sichtbar
 * erklärt").
 *
 * Der Umbau: Vgl./Bild/Name werden `position: sticky` mit aus dem echten DOM
 * gemessenen Offsets (Spaltenbreiten sind nicht fest — Bild folgt der
 * Zeilenhöhe, Name dem Spielernamen); die vier bestehenden Spalten-Presets
 * bekommen eine sichtbare Reiterleiste (plus ein neues fünftes Preset
 * "Saison": genau die Spalten, die am Spieltag 1 noch leer sind); PPs/MVS
 * verlieren ihre laute Akzent-/Bronze-Fläche, sobald der GESAMTE Liga-Pool
 * leer ist (kein einzelner Spieler ohne Wert — die ganze Saison ohne Wert);
 * eine Legende unter der Tabelle erklärt die Abkürzungen einmal sichtbar.
 *
 * Testmuster wie `tests/transferhistorie-velo-look.test.ts`: jede im Markup
 * benutzte Klasse muss in globals.css existieren (CSS-Klassen fallen sonst
 * still durch — kein Fehler, nur unformatierter/unstylter Text), dazu die
 * tragenden Strukturaussagen des Umbaus als String-Assertions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const MARKUP = quelle("app/foundation/players-table/FoundationPlayersTableNewLook.tsx");
const PRESETS = quelle("app/foundation/players-table/foundation-players-column-presets.ts");
const CSS = quelle("app/globals.css");

describe("Jede im Markup benutzte T3-Klasse existiert in globals.css", () => {
  // Wörtlich im Quelltext stehende Klassen.
  const literalTokens = [
    "nl-players-colgroups",
    "nl-players-colgroup-tab",
    "is-season-pending",
    "nl-players-scroll-fade",
    "nl-players-legend",
  ];

  it.each(literalTokens)("%s ist in globals.css definiert", (klasse) => {
    expect(MARKUP).toMatch(new RegExp(klasse.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")));
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });

  // Template-Fragment `nl-players-th-sticky-${column.id}` (wie `is-medal-${…}`
  // in transferhistorie-velo-look.test.ts): das Präfix steht wörtlich im
  // Markup, die drei echten Varianten (compare/image/name) werden über ihre
  // konkreten Klassennamen in globals.css geprüft.
  it("das Sticky-Klassen-Template steht im Markup", () => {
    expect(MARKUP).toContain(" nl-players-th-sticky nl-players-th-sticky-${column.id}");
  });

  const stickyVarianten = ["nl-players-th-sticky-compare", "nl-players-th-sticky-image", "nl-players-th-sticky-name"];
  it.each(stickyVarianten)("%s (Sticky-Variante) ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });
});

describe("P1: Vgl./Bild/Name bleiben beim horizontalen Scrollen stehen (sticky)", () => {
  it("Körperzellen sind sticky mit gemessenen, nicht geratenen Offsets", () => {
    expect(MARKUP).toContain('<td className="nl-players-td-compare" style={{ left: 0 }}>');
    expect(MARKUP).toContain('<td className="nl-players-td-image" style={{ left: stickyOffsets.image }}>');
    expect(MARKUP).toContain('style={{ left: stickyOffsets.name }}');
    // Kein hartkodierter px-Wert für Bild/Name — beide werden aus dem DOM gemessen
    // (Bild folgt der Zeilenhöhe/aspect-ratio, Name dem Spielernamen).
    expect(MARKUP).toContain("const compareWidth = compareCell.getBoundingClientRect().width;");
    expect(MARKUP).toContain("const imageWidth = imageCell.getBoundingClientRect().width;");
  });

  it("Kopf- und Körperzellen der drei Spalten sind beide position:sticky", () => {
    expect(CSS).toMatch(
      /\.is-new-look \.nl-players-td-compare,\s*\n\.is-new-look \.nl-players-th-sticky-compare,[\s\S]*?position: sticky;/,
    );
  });

  it("die Namensspalte trägt einen Kantenschatten als Scroll-Grenze", () => {
    expect(CSS).toMatch(/\.nl-players-td-name,\s*\n\.is-new-look \.nl-players-th-sticky-name \{\s*\n\s*box-shadow: 3px 0 8px/);
  });

  it("Zeilen-Zustände (Hover/Vergleich) malen ihren Wasch explizit auf die opaken Sticky-Zellen", () => {
    expect(CSS).toContain(".is-new-look .nl-players-row:hover .nl-players-td-compare,");
    expect(CSS).toContain(".is-new-look .nl-players-row.is-compare-selected .nl-players-td-compare,");
  });

  it("Perf: die Observer/Listener bauen sich nicht bei jedem Render neu auf (Callback-Ref statt Deps-loses Effekt)", () => {
    expect(MARKUP).toContain("const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);");
    expect(MARKUP).toContain("}, [tableEl]);");
    expect(MARKUP).toContain("const [tableShellEl, setTableShellEl] = useState<HTMLDivElement | null>(null);");
    expect(MARKUP).toContain("}, [tableShellEl]);");
    // Scroll-Events sind rAF-gebündelt (max. 1 Recompute pro Frame) statt pro nativem Event.
    expect(MARKUP).toContain("rafId = requestAnimationFrame(() => {");
  });
});

describe("P2: leere Saison-Spalten (PPs/MVS) verlieren ihre laute Akzentfläche, wenn der ganze Liga-Pool leer ist", () => {
  it("die Bedingung ist der LIGA-Pool, nicht ein einzelner fehlender Wert", () => {
    expect(MARKUP).toContain("const ppsSeasonPending = leaguePlayerHeatPools.pps.length === 0;");
    expect(MARKUP).toContain("const mvsSeasonPending = leaguePlayerHeatPools.mvs.length === 0;");
  });

  it("Kopf- UND Körperzellen bekommen `is-season-pending`, mit erklärendem Tooltip statt stillem Verstecken", () => {
    expect(MARKUP).toContain('isSeasonPending ? " is-season-pending" : ""');
    expect(MARKUP).toContain("ppsSeasonPending ? \" is-season-pending\" : \"\"");
    expect(MARKUP).toContain("mvsSeasonPending ? \" is-season-pending\" : \"\"");
    expect(MARKUP).toContain("PPS_PENDING_HINT");
    expect(MARKUP).toContain("MVS_PENDING_HINT");
    // "—" bleibt sichtbar (Chris' Regel: erklären statt verstecken) — keine Textänderung, nur die Fläche wird gedämpft.
    expect(MARKUP).toContain('formatPpsValue(row.playerPps) : "—"');
  });

  it("die Basis-Farbregeln der Kennzahl-Spalten bleiben unangetastet (nur additiv erweitert)", () => {
    // Exakt derselbe Rumpf, den tests/spielerliste-kennzahlen-kontrast.test.ts prüft —
    // T3 darf ihn nicht verändern, nur eine zusätzliche `.is-season-pending`-Regel danebensetzen.
    expect(CSS).toContain(
      ".is-new-look td.nl-players-td-metric.nl-players-td-pps {\n  background: color-mix(in srgb, var(--nl-accent) 10%, transparent);\n  color: var(--nl-ink);",
    );
    expect(CSS).toContain(".is-new-look td.nl-players-td-metric.nl-players-td-pps.is-season-pending,");
  });
});

describe("P3: Spaltengruppen als sichtbare Reiterleiste, inkl. neuem Preset \"Saison\"", () => {
  it("die Reiterleiste rendert alle Presets aus derselben Quelle wie das Spalten-Menü", () => {
    expect(MARKUP).toContain("NL_PLAYERS_COLUMN_PRESETS.map((preset) => (");
    expect(MARKUP).toContain('role="tablist"');
    expect(MARKUP).toContain('onClick={() => applyColumnPreset(preset.id)}');
  });

  it('das Preset "saison" bündelt genau PPs/MVS/Einsätze — die am Spieltag 1 leeren Spalten', () => {
    expect(PRESETS).toContain('id: "saison"');
    expect(PRESETS).toContain('visible: ["pps", "mvs", "appearances"]');
  });

  it("das neue Preset ist im Präferenz-Typ und im Storage-Reader bekannt (kein stiller Rückfall auf 'custom')", () => {
    expect(PRESETS).toContain(
      'export type NlPlayersColumnPresetId = "kompakt" | "scouting" | "finanzen" | "alles" | "saison" | "custom";',
    );
    expect(PRESETS).toContain('presetRaw === "saison" ||');
  });
});

describe("P6: Legende erklärt die Abkürzungen einmal sichtbar", () => {
  it("die Legende steht unter der Tabelle und nennt die Kern-Abkürzungen", () => {
    expect(MARKUP).toContain('<div className="nl-players-legend">');
    expect(MARKUP).toMatch(/<b>OVR<\/b>/);
    expect(MARKUP).toMatch(/<b>PPs<\/b>/);
    expect(MARKUP).toMatch(/<b>MVS<\/b>/);
    expect(MARKUP).toMatch(/<b>CA\/PO<\/b>/);
  });
});

describe("Q3-Nachzügler (T3-Scope): informationstragender --nl-mut-2-Text auf --nl-mut angehoben", () => {
  // Kommentare erklären bewusst die --nl-mut-2-Abgrenzung ("nicht die Deko-
  // Stufe --nl-mut-2") — der Erklärtext selbst darf die Prüfung nicht triggern,
  // nur eine tatsächliche `color: var(--nl-mut-2)`-Deklaration soll es.
  const CSS_OHNE_KOMMENTARE = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const faelle = [
    ".nl-players-pps-detail-note",
    ".nl-players-status",
    ".nl-players-salary-season",
    ".nl-players-career small",
    ".nl-podium-value-label",
  ];

  it.each(faelle)("%s nutzt --nl-mut, nicht die Deko-Stufe --nl-mut-2", (selektor) => {
    const escaped = selektor.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const match = CSS_OHNE_KOMMENTARE.match(new RegExp(`${escaped} \\{([^}]*)\\}`));
    expect(match, `Regel fehlt: ${selektor}`).not.toBeNull();
    const rumpf = match![1];
    expect(rumpf).toContain("color: var(--nl-mut);");
    expect(rumpf).not.toContain("--nl-mut-2");
  });
});
