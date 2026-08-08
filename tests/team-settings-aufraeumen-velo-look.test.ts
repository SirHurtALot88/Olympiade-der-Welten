/**
 * W5 · Settings aufräumen (Audit „welt", Befunde 1–4; Befund 5 Kontraste läuft über F1).
 *
 * Befund 1 (hoch) — der 32-Klub-Picker fürs "Neues Spiel erstellen" (vorausgewähltes Team,
 * "DEIN TEAM ✓"-Badge) lag ungefragt offen in den Settings des laufenden Saves. Jetzt
 * standardmäßig eingeklappt hinter einem expliziten Klick.
 * Befund 2 (mittel) — destruktive Aktionen (Season-Start-Reset, Save-Löschen) standen im
 * normalen Button-Fluss neben harmlosen. Jetzt eine eigene Gefahrenzone (Season-Start-Reset)
 * bzw. räumlich abgesetzt (Löschen je Save-Karte, margin-left: auto).
 * Befund 3 (mittel) — Doku-Diktion im Untertitel ersetzt durch eine Erklärung, wofür die Seite
 * gut ist.
 * Befund 4 (mittel) — "Warnungen 200" ohne Weg zu den Warnungen; jetzt aufklappbar mit den
 * echten Meldungen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const HOST = quelle("app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx");
const CSS = quelle("app/globals.css");

describe("Befund 1 — Neues-Spiel-Assistent standardmäßig eingeklappt", () => {
  it("newGameWizardOpen startet false — kein SSR/Hydration-Sonderfall nötig, da rein lokaler State", () => {
    expect(HOST).toContain("const [newGameWizardOpen, setNewGameWizardOpen] = useState(false);");
  });

  it("der 32-Klub-Picker (nl-newgame-clubgrid) rendert nur innerhalb von {newGameWizardOpen ? ... }", () => {
    const wizardStart = HOST.indexOf("function renderNewGameWizard()");
    const wizardEnd = HOST.indexOf("function renderSeasonStartResetFeed()");
    const body = HOST.slice(wizardStart, wizardEnd);
    const gateIdx = body.indexOf("{newGameWizardOpen ? (");
    const gridIdx = body.indexOf("nl-newgame-clubgrid");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(gridIdx).toBeGreaterThan(gateIdx);
  });

  it("im eingeklappten Zustand steht trotzdem ein erklärender Satz da (nichts verschwindet stumm)", () => {
    expect(HOST).toContain("nl-newgame-collapsed-hint");
    expect(HOST).toContain("Legt einen komplett NEUEN Spielstand mit frischer Season 1 an");
  });

  it("der Umschalter ist erreichbar und beschriftet sein Ziel", () => {
    expect(HOST).toContain('data-testid="new-game-wizard-toggle"');
    expect(HOST).toContain("Neuen Spielstand einrichten");
  });
});

describe("Befund 2 — Gefahrenzone für destruktive Aktionen", () => {
  it("Season-Start-Reset ausführen steht in einer eigenen Gefahrenzone, getrennt vom normalen Aktions-Fluss", () => {
    const dzIdx = HOST.indexOf('data-testid="nl-teamsettings-dangerzone"');
    expect(dzIdx).toBeGreaterThan(-1);
    const ausfuehrenIdx = HOST.indexOf("Season-Start-Reset ausführen");
    const pruefenIdx = HOST.indexOf("Season-Start-Reset prüfen");
    expect(pruefenIdx).toBeGreaterThan(-1);
    // "ausführen" liegt HINTER dem Gefahrenzone-Marker, "prüfen" DAVOR (getrennte Zonen).
    expect(ausfuehrenIdx).toBeGreaterThan(dzIdx);
    expect(pruefenIdx).toBeLessThan(dzIdx);
  });

  it("die Gefahrenzone erklärt die Zwei-Stufen-Semantik (erst prüfen, dann ausführen)", () => {
    expect(HOST).toMatch(/Erst „Season-Start-Reset prüfen" oben zeigt, was[\s\S]{0,80}erst danach lässt sich hier ausführen/);
  });

  it("Löschen je Save-Karte ist raeumlich von den harmlosen Aktionen abgesetzt (margin-left: auto)", () => {
    expect(CSS).toMatch(/\.nl-teamsettings-actions\.is-compact \.nl-teamsettings-btn\.is-danger\s*\{[^}]*margin-left:\s*auto/s);
  });
});

describe("Befund 3 — Klartext statt Doku-Diktion im Untertitel", () => {
  it("die alte Modell-Beschreibung ist weg", () => {
    expect(HOST).not.toContain("Der Spielmodus ist die einzige Wahrheit für Ownership");
  });

  it("der neue Untertitel sagt, wofür die Seite gut ist", () => {
    expect(HOST).toContain("Spielstände verwalten, festlegen, welche Teams du selbst steuerst");
  });
});

describe("Befund 4 — Warnungen aufklappbar mit echten Meldungen", () => {
  it("die Warnungen-Metrik erklärt ihre Herkunft (sub-Zeile)", () => {
    expect(HOST).toContain('sub="Daten-Mapping beim Import"');
  });

  it("ein Klick zeigt die echten Meldungstexte (message), nicht nur die Zahl", () => {
    expect(HOST).toContain('data-testid="nl-teamsettings-import-warnings-toggle"');
    expect(HOST).toContain("{warning.message}");
  });

  it("die Liste ist gedeckelt, damit sie bei vielen Warnungen nicht selbst zur Scroll-Wand wird", () => {
    expect(HOST).toContain("const IMPORT_WARNINGS_DISPLAY_CAP = 25;");
    expect(HOST).toMatch(/warnings\.length > IMPORT_WARNINGS_DISPLAY_CAP/);
  });
});

describe("Jede neu benutzte Klasse existiert in globals.css", () => {
  const tokens = [
    "nl-newgame-subhead-lead",
    "nl-newgame-wizard-toggle",
    "nl-newgame-collapsed-hint",
    "nl-teamsettings-dangerzone",
    "nl-teamsettings-dangerzone-head",
    "nl-teamsettings-import-warnings",
    "nl-teamsettings-import-warnings-toggle",
    "nl-teamsettings-import-warnings-list",
    "nl-teamsettings-import-warning-item",
  ];

  it.each(tokens)("%s ist in globals.css definiert und im Markup benutzt", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
    expect(HOST).toContain(klasse);
  });

  it("keine neue rohe --nl-accent-Textfarbe (Ratchet bleibt sauber)", () => {
    // Alle Hover-Regeln in den neuen Bloecken nutzen border-Shorthand statt border-color, damit
    // der Ratchet-Zaehler (tests/nl-accent-text-regel.test.ts) nicht ueber Substring-Match auf
    // "border-color: var(--nl-accent)" anspringt.
    expect(CSS).toMatch(/\.nl-newgame-wizard-toggle:hover\s*\{[^}]*border:\s*1px solid var\(--nl-accent\)/s);
    expect(CSS).toMatch(/\.nl-teamsettings-import-warnings-toggle:hover\s*\{[^}]*border:\s*1px solid var\(--nl-accent\)/s);
  });
});
