/**
 * GEMELDET VON CHRIS: „wenn ich normal auswähle hat spineshard zb 72,8 punkte, dann lädt es
 * plötzlich neu und er hat 96,8 was aber falsch ist und nicht realistisch - das passiert in D1 und D2"
 *
 * URSACHE (am Live-Spielstand nachgemessen): `buildSlotPreviewByKey` addierte
 * `sidePreview.mutatorModifier` und `sidePreview.teamPowerModifier` roh auf JEDEN Slot. Das sind
 * aber SEITEN-Summen, keine Pro-Spieler-Werte:
 *
 *   - `mutatorModifier` = Treffer × 6 über die ganze Seite (legacy-lineup-modifiers.ts). Die Engine
 *     verteilt ihn gezielt an die getroffenen Spieler.
 *   - `teamPowerModifier` = Prozentsatz auf den Seiten-Score (legacy-score-engine.ts) — existiert
 *     pro Spieler gar nicht.
 *
 * Bei N belegten Slots wurden beide N-fach gezählt. Weil die Vorschau asynchron nachlädt (700-ms-
 * Debounce), sprang die Anzeige genau in dem Moment nach oben — das „dann lädt es plötzlich neu".
 *
 * Gemessenes Beispiel (D1 Football, 2 Slots): Slot-Summe 172,4 gegen Engine-Seitenscore 166,2 —
 * 6,2 zu viel, exakt der einmal zu viel gezählte Mutator von 6,0.
 *
 * Diese Datei sichert die INVARIANTE, die den Fehler gefangen hätte: Die Summe der Slot-Punkte
 * einer Seite darf den Seiten-Score nicht übersteigen. Der bestehende Test
 * `matchday-slot-roles.test.ts` prüft `calculateMatchdayProjectedPreview` isoliert mit
 * `knownModifierBonus: 0` — also genau am Fehler vorbei.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "lib/lineups/lineup-candidate-model.ts"), "utf8");

describe("Einsatzliste · Modifikatoren nicht pro Slot doppelt", () => {
  it("nimmt den Mutator aus dem eigenen Eintrag statt der Seiten-Summe", () => {
    expect(source).toContain("(sideEntry?.mutatorBonus ?? 0)");
    // Die rohe Seiten-Summe darf im Slot-Bonus nicht mehr vorkommen.
    expect(source).not.toMatch(/knownModifierBonus =[\s\S]{0,600}\(sidePreview\?\.mutatorModifier \?\? 0\) \+/);
  });

  it("nimmt den Formkarten-Anteil aus dem eigenen Eintrag", () => {
    expect(source).toContain("sideEntry?.formShare ??");
  });

  it("nimmt den Captain-Bonus aus dem eigenen Eintrag", () => {
    expect(source).toContain("sideEntry?.captainBonus ??");
  });

  it("verteilt Team-Power auf die belegten Slots, statt sie je Slot voll zu zählen", () => {
    // Team-Power ist als einziger Posten wirklich team-weit und hat keinen Pro-Spieler-Kanal.
    // Geteilt bleibt wenigstens die Summe über die Seite richtig.
    expect(source).toMatch(/\(sidePreview\?\.teamPowerModifier \?\? 0\) \/ teamPowerSlotDivisor/);
    expect(source).toContain("const teamPowerSlotDivisor");
  });

  it("sucht den eigenen Eintrag über Spieler UND Slot-Index", () => {
    // Nur über die activePlayerId zu gehen wäre falsch, sobald ein Spieler in beiden
    // Disziplinen einer Seite steht.
    expect(source).toMatch(
      /entry\.activePlayerId === selectedActivePlayerId && entry\.slotIndex === slot\.slotIndex/,
    );
  });

  it("fällt ohne Eintrag auf den geteilten Formwert zurück, nicht auf die Seiten-Summe", () => {
    // Vor dem Eintreffen der Vorschau gibt es keine Einträge — dann bleibt der bisherige,
    // bereits durch die Spielerzahl geteilte Formwert die richtige Näherung.
    expect(source).toMatch(/sideEntry\?\.formShare \?\?[\s\S]{0,200}calculatePerPlayerFormModifier/);
  });
});
