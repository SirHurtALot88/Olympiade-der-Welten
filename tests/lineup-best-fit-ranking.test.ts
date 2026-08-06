/**
 * GEMELDET AUS DEM SPIEL (Franky, Einsatzliste): „bester fit wird nich immer korrekt angezeigt"
 *
 * Der Knopf „Best Fit" an einem leeren Slot schlug den Spieler mit dem hoechsten ROHEN
 * Disziplin-Skill vor (`sortOptionsByDisciplineSkill`) — angezeigt hat er daneben aber den
 * PROJIZIERTEN Score, der ganz andere Dinge einrechnet: Rolle, Attribute, Fatigue, Intensitaet der
 * Disziplin, Rivalitaetsdruck. Zwei verschiedene Massstaebe fuer dieselbe Aussage.
 *
 * Der Schnitt machte es endgueltig: `.slice(0, 3)` stand VOR dem `.map(...)`, das die Projektion
 * ueberhaupt erst berechnet. Wer nach Skill nicht unter die ersten drei kam, wurde also nie
 * projiziert — auch wenn er nach Projektion der beste gewesen waere. Ein frischer Spieler mit
 * etwas weniger Grund-Skill, aber passender Rolle, projiziert regelmaessig hoeher.
 *
 * Sichtbar wurde das als Widerspruch am Knopf selbst: der Vorschlag stand oben, seine eigene Zahl
 * behauptete eine andere Reihenfolge. Dasselbe traf „Optimieren" (`lineupUpgrades`), das den Gewinn
 * aus derselben Projektion rechnet, den Kandidaten aber aus derselben skill-sortierten Liste nahm.
 *
 * WAS HIER GEPRUEFT WIRD: die Reihenfolge der Schritte am Quelltext — projizieren, DANN nach der
 * projizierten Zahl ordnen, DANN schneiden. Die Funktion sass urspruenglich in einem sehr grossen
 * Client-Bauteil und war nicht isoliert aufrufbar; inzwischen ist sie als reine Funktion
 * (`buildSlotCandidateSummaryByKey`) nach lib/lineups/lineup-candidate-model.ts verschoben — die
 * eigentliche Verhaltenspruefung liegt jetzt zusaetzlich in tests/lineup-candidate-model.test.ts.
 * Diese Quelltext-Kontrolle bleibt bestehen und zeigt jetzt auf den neuen Ort; sie belegt nicht,
 * welchen Namen der Knopf im Browser zeigt — sie haelt fest, dass Auswahl und angezeigte Zahl
 * denselben Massstab benutzen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "lib/lineups/lineup-candidate-model.ts"),
  "utf8",
);

/** Nur der Block, der die Slot-Kandidaten baut. */
const BLOCK = SOURCE.slice(
  SOURCE.indexOf("export function buildSlotCandidateSummaryByKey(input: {"),
  SOURCE.indexOf("/** Vormals `playerBestSlotSummaryByActivePlayerId`"),
);

/**
 * Derselbe Block OHNE Zeilenkommentare — fuer die Reihenfolge-Pruefung unverzichtbar.
 *
 * Der erste Entwurf dieses Tests ist genau darueber gestolpert: der Kommentar am Fix schreibt
 * woertlich „Hier stand `.slice(0, 3)` VOR dem `.map(...)`", und `indexOf` fand diese Erwaehnung
 * statt des Aufrufs. Der Test schlug fehl, obwohl der Code richtig war — im umgekehrten Fall
 * (Kommentar nennt die richtige Reihenfolge, Code hat die falsche) waere er gruen geblieben und
 * haette nichts geprueft.
 */
const CODE = BLOCK.split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

describe("Einsatzliste — „Best Fit\" und seine Zahl benutzen denselben Massstab", () => {
  it("der Ausschnitt wurde gefunden", () => {
    expect(BLOCK.length, "Marken passen nicht mehr — der Test wuerde sonst nichts pruefen").toBeGreaterThan(500);
  });

  /** DER KERN: nach der projizierten Zahl ordnen, nicht nach dem rohen Skill. */
  it("ordnet die Kandidaten nach dem projizierten Score", () => {
    expect(BLOCK).toContain("right.projectedScore ?? Number.NEGATIVE_INFINITY");
    expect(BLOCK).toContain("left.projectedScore ?? Number.NEGATIVE_INFINITY");
  });

  /**
   * DIE EIGENTLICHE URSACHE: der Schnitt lag vor der Projektion. Wer nach Skill nicht unter die
   * ersten drei kam, wurde nie projiziert — und konnte den Vergleich gar nicht gewinnen.
   */
  it("schneidet ERST nach dem Projizieren und Sortieren", () => {
    const map = CODE.indexOf(".map((option) => {");
    const sort = CODE.indexOf(".sort((left, right) =>");
    const slice = CODE.indexOf(".slice(0, 3)");
    expect(map, "map nicht gefunden").toBeGreaterThan(-1);
    expect(sort, "sort nicht gefunden").toBeGreaterThan(-1);
    expect(slice, "slice nicht gefunden").toBeGreaterThan(-1);
    expect(map, "die Projektion muss vor dem Sortieren stehen").toBeLessThan(sort);
    expect(sort, "der Schnitt muss nach dem Sortieren stehen").toBeLessThan(slice);
  });

  /**
   * Die Vorsortierung nach Skill bleibt — als stabile Ausgangsreihenfolge, auf die ein Gleichstand
   * der Projektionen zurueckfaellt. Sie darf nur nicht mehr die Auswahl entscheiden.
   */
  it("die Skill-Sortierung bleibt als Ausgangsreihenfolge", () => {
    expect(CODE).toContain("sortOptionsByDisciplineSkill(");
    expect(CODE.indexOf("sortOptionsByDisciplineSkill(")).toBeLessThan(CODE.indexOf(".map((option) => {"));
  });

  /**
   * Ein Vorschlag ohne Projektion (kein Basis-Score in dieser Diszi) darf nicht vorne stehen —
   * sonst schluege der Knopf jemanden vor, zu dem er keine Zahl zeigen kann.
   */
  it("Kandidaten ohne Projektion landen hinten", () => {
    expect(BLOCK).toContain("Number.NEGATIVE_INFINITY");
  });
});
