/**
 * S6 · Einsatzlisten-Feinschliff (Audit Spieltag L2/L3/L4/L5).
 *
 * Die Einsatzliste ist laut Audit "strukturell die stärkste Seite" — hier geht es
 * ausdrücklich NICHT um einen Umbau, sondern um Wording-/Ton-Korrekturen an
 * bestehendem Markup. L1 (Restzähler-Widerspruch) ist bereits in PR #457 behoben
 * und wird hier nicht erneut geprüft.
 *
 * L2: "Spieler fehlt" (roter Chip) war der NORMALZUSTAND jedes noch nicht
 * gefüllten Slots (9× pro Spieltag) — der eigentliche Bug saß im Rendering:
 * `buildSlotIssuesByKey` lieferte bereits einen abgestuften `tone`
 * ("blocked" | "warning"), das Rendering hat ihn bisher ignoriert und JEDES
 * Issue hart auf `is-risk` gemalt.
 * L4: "−0" (Fatigue-Kosten) und ein auf 9ch abgeschnittener Rivalen-Teamname.
 * L3: Attribut-Noten (z. B. "SPE B") ohne jede Erklärung der Skala im Tooltip.
 * L5: "Zelle rechts aktivieren" war die einzige Bedienungshilfe im Formplan.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const AUDIT = quelle("lib/lineups/lineup-audit.ts");
const NEWLOOK = quelle("app/foundation/legacy-lineup-lab/LineupNewLook.tsx");
const CANDIDATE_MODEL = quelle("lib/lineups/lineup-candidate-model.ts");
const FORM_BOARD = quelle("app/foundation/legacy-lineup-lab/FormBoardPanel.tsx");
const CSS = quelle("app/globals.css");

describe("L2: roter Alarm nur für echte Blocker, nicht für den offenen Normalzustand", () => {
  it('der leere, nicht-aktive Slot heißt "Offen" statt "Spieler fehlt"', () => {
    // Der alte Text darf im Kommentar (Begründung) stehen, aber nicht mehr als
    // ausgeliefertes Label.
    expect(AUDIT).not.toContain('label: "Spieler fehlt"');
    expect(AUDIT).not.toContain('"Spieler fehlt",');
    expect(AUDIT).toContain('label: activeSlotKey === slot.key ? "Hier weiter" : "Offen"');
  });

  it("der aktive, wirklich blockierende Slot bleibt unverändert (kein Feature-Verlust)", () => {
    expect(AUDIT).toContain('tone: activeSlotKey === slot.key ? "blocked" : "warning"');
  });

  it("das Rendering folgt jetzt issue.tone statt jedes Issue hart auf is-risk zu malen", () => {
    expect(NEWLOOK).not.toContain('<span className="nl-lineup-chip is-risk" title={issue.detail}>');
    expect(NEWLOOK).toContain('issue.tone === "blocked" ? " is-risk"');
    expect(NEWLOOK).toContain('!player && issue.tone === "warning" ? "" : " is-warn"');
  });

  it("nl-lineup-chip (Basisklasse, neutral ohne is-*-Suffix) ist in globals.css definiert", () => {
    expect(CSS).toMatch(/\.is-new-look \.nl-lineup-chip\s*\{/);
    expect(CSS).toMatch(/\.is-new-look \.nl-lineup-chip\.is-warn\s*\{/);
    expect(CSS).toMatch(/\.is-new-look \.nl-lineup-chip\.is-risk\s*\{/);
  });
});

describe("L4: keine Minus-Null, kein 9-Zeichen-Abschnitt beim Rivalen-Teamnamen", () => {
  it('Fatigue-Kosten zeigt "0" statt "−0", wenn noch niemand aufgestellt ist', () => {
    expect(NEWLOOK).not.toContain('value={`−${formatNlNumber(matchdayPreviewCards.totalFatigue, 1)}`}');
    expect(NEWLOOK).toContain("matchdayPreviewCards.totalFatigue > 0");
  });

  it("der Rivalen-Teamname bekommt mehr Platz (15ch statt 9ch, Median-Teamname passt vollständig)", () => {
    expect(NEWLOOK).not.toContain('maxWidth: "9ch"');
    expect(NEWLOOK).toContain('maxWidth: "15ch"');
  });
});

describe("L3: Attribut-Note trägt jetzt ihre Skala im Tooltip", () => {
  it("die Notenskala steht im Detail-Text, ohne eine neue Skala zu erfinden (dieselbe Notation wie im Datensatz: S+ bis F)", () => {
    expect(CANDIDATE_MODEL).toContain("ratingScaleHint");
    expect(CANDIDATE_MODEL).toContain("Notenskala S+ bis F");
  });
});

describe("L5: die Formplan-Karten-Deck-Instruktion erklärt jetzt Kosten/Wirkung", () => {
  it('"Zelle rechts aktivieren" bleibt als Kurzstatus stehen, bekommt aber eine erklärende Zeile', () => {
    expect(FORM_BOARD).toContain('"Zelle rechts aktivieren"');
    expect(FORM_BOARD).toContain("legacy-lineup-form-resource-note");
    expect(FORM_BOARD).toContain("Formkarten-Budget");
  });

  it("die wiederverwendete Klasse existiert in globals.css (kein neues, unbelegtes CSS)", () => {
    expect(CSS).toMatch(/\.legacy-lineup-form-resource-note\s*\{/);
  });
});
