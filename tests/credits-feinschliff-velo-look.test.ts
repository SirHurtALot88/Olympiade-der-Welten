/**
 * M4 · Kredite-Feinschliff (Audit „markt", Befunde K2–K5).
 *
 * Vier chirurgische Fixes auf einer strukturell gesunden Seite — die Gehalts-Quelle (K1) war
 * bereits durch PR #457 (`getTeamActualSalaryTotal`) behoben, hier geht es nur noch um:
 *
 * K2 — "Bestes Angebot"-Badge landete mitten im Anbieternamen (Flex-Umbruch riss die Zeile
 *      zwischen den beiden Namensteilen auf). Fix: Identität (Wappen+Name) und Badges sind zwei
 *      getrennte Flex-Gruppen, der Name selbst einzeilig mit Ellipsis.
 * K3 — Die "Einnahmen"-Referenzlinie im Belastungsbalken war ein rotiert wirkender SVG-Text, der
 *      am rechten Kartenrand abgeschnitten wurde (`preserveAspectRatio="none"` verzerrt Text
 *      nicht-uniform). Fix: derselbe gestrichelte Marker bleibt im SVG, die Beschriftung zieht in
 *      die Legende um (Legendenpunkt statt Vertikaltext).
 * K4 — Der Admin-Vorschau-Schalter ("Kredite trotz Season-1- & Phasen-Sperre freischalten") ist
 *      ein Entwicklerwerkzeug und gehörte mitten ins Spieler-UI. Chris: hinter einen Dev-Modus,
 *      nicht sichtbar im normalen Spiel — dieselbe `?dev`-URL/localStorage-Konvention wie die
 *      Arena-Dev-Chrome in `DisciplineStageArena.tsx`.
 * K5 — "Zins-Range" bekam ohne explizites `title` den Lexikon-Fuzzy-Match von "Rang"
 *      untergeschoben (Substring-Bug wie SCH/Schach in den Ranks) und "Beziehung 0" erklärte
 *      seine Skala nicht. Beide Chips tragen jetzt einen expliziten, korrekten Tooltip.
 *
 * Wie `tests/transferhistorie-velo-look.test.ts`: reine String-Assertions auf den Quelltext,
 * plus die beidseitige Absicherung "jede benutzte Klasse existiert in globals.css".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const MARKUP = quelle("app/foundation/credits/FoundationCreditsNewLook.tsx");
const CSS = quelle("app/globals.css");

describe("Jede in diesem Paket NEU eingeführte Klasse existiert in globals.css", () => {
  // Nur die für K2/K3 neu eingeführten Klassen — ein voller Sweep der Datei würde auch
  // vorbestehende, hier unangetastete "-card"-Scoping-Klassen (nur Namespacing für
  // Kind-Selektoren, keine eigene Regel) fälschlich als Regression melden.
  const tokens = ["nl-credits-offer-identity", "nl-credits-offer-badges", "nl-credits-burden-legend-marker"];

  it.each(tokens)("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
    expect(MARKUP).toContain(klasse);
  });
});

describe("K2 — Badge liegt neben statt über dem Anbieternamen", () => {
  it("Identität (Wappen+Name) und Badges sind getrennte Flex-Gruppen", () => {
    expect(MARKUP).toContain('<span className="nl-credits-offer-identity">');
    expect(MARKUP).toContain('<span className="nl-credits-offer-badges">');
  });

  it("der Name ist einzeilig mit Ellipsis begrenzt (CSS) und trägt den vollen Namen als title", () => {
    expect(MARKUP).toContain('<span className="nl-credits-offer-name" title={offer.lenderName}>');
    expect(CSS).toMatch(/\.nl-credits-offer-name\s*\{[^}]*text-overflow:\s*ellipsis/s);
  });

  it("die Badges-Gruppe bricht als Ganzes um, nie mitten im Namen (flex-wrap auf dem Header)", () => {
    expect(CSS).toMatch(/\.nl-credits-offer-header\s*\{[^}]*flex-wrap:\s*wrap/s);
  });
});

describe("K3 — Einnahmen-Marker als Legendenpunkt statt abgeschnittenem SVG-Text", () => {
  it("kein <text>Einnahmen</text> mehr im SVG-Balken", () => {
    expect(MARKUP).not.toMatch(/<text[^>]*>\s*Einnahmen\s*<\/text>/);
  });

  it("die gestrichelte Referenzlinie bleibt im SVG erhalten", () => {
    expect(MARKUP).toContain('<g className="nl-credits-burden-marker">');
    expect(MARKUP).toContain("<line x1={incomeX}");
  });

  it("Einnahmen stehen jetzt als eigener Legendenpunkt mit echtem Wert", () => {
    expect(MARKUP).toContain('<span className="nl-credits-burden-legend-marker" aria-hidden="true" />');
    // Durchklick-Fix „eine Quelle pro Größe": das nackte „Einnahmen (Referenz)" kollidierte mit
    // „Einnahmen (Saison)" der Finanzen-Seite (61,6 vs. 64,1 Mio — beides richtig, zwei Größen).
    // Die Kredit-Zahl heißt jetzt nach ihrer echten Rolle: Bemessungsgrundlage des Kreditsystems
    // aus der Vorsaison-Sponsor-Abrechnung.
    expect(MARKUP).toContain("Einnahmen-Bemessung (Sponsor Vorsaison)");
    expect(MARKUP).not.toContain(">Einnahmen (Referenz)<");
    expect(MARKUP).toContain("{formatNlMoney(safeRevenue)}");
  });
});

describe("K4 — Admin-Vorschau-Schalter hinter Dev-Modus, nicht im normalen Spiel sichtbar", () => {
  it("devMode startet false und wird erst im Effect aus ?dev/localStorage gelesen (kein SSR-Mismatch)", () => {
    expect(MARKUP).toContain("const [devMode, setDevMode] = useState(false);");
    expect(MARKUP).toContain('new URLSearchParams(window.location.search).has("dev")');
    expect(MARKUP).toContain('window.localStorage.getItem("oly-credits-dev") === "1"');
  });

  it("der Admin-Toggle rendert nur noch innerhalb von {devMode ? ... : null}", () => {
    const idx = MARKUP.indexOf('data-testid="nl-credits-admin-toggle"');
    expect(idx).toBeGreaterThan(-1);
    const before = MARKUP.slice(Math.max(0, idx - 200), idx);
    expect(before).toContain("{devMode ? (");
  });

  it("adminOverride selbst ist unveraendert (kein Verhaltens-, nur ein Sichtbarkeits-Fix)", () => {
    expect(MARKUP).toContain("checked={adminOverride}");
    expect(MARKUP).toContain("onChange={(event) => onToggleAdminOverride(event.target.checked)}");
  });
});

describe("K5 — unerklärte Kürzel/Chips bekommen einen korrekten Tooltip", () => {
  it("Zins-Range bekommt ein explizites, korrektes title (kein Lexikon-Fuzzy-Match auf 'Rang')", () => {
    expect(MARKUP).toMatch(/label="Zins-Range"[\s\S]{0,120}title="Zinsspanne je nach Laufzeit/);
  });

  it("Beziehung erklärt ihre Skala im Tooltip", () => {
    expect(MARKUP).toMatch(/Beziehung zum Verleiher-Team, Skala -5 \(feindselig\) bis \+5 \(freundschaftlich\)/);
  });
});
