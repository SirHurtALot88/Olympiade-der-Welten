/**
 * GEMELDET: „Kannst du dafür sorgen, dass nach MD10 bevor man verkaufen kann die
 * Trainingsupgrades der spieler schon durch laufen und die neuen Marktwerte dann verfügbar sind?
 * erst DANN darf wirklich verkauft werden."
 *
 * Die Reihenfolge in der Kette stimmte längst — `player_development` liegt vor
 * `transfer_sell_phase`. Nur tat der Schritt seine Arbeit nicht: er schaltete die Phase weiter
 * und schrieb ausdrücklich nichts („preview_only_no_attribute_writes"). Gerechnet wurde erst
 * beim Start der NEUEN Saison, also hinter dem Transferfenster. Man verkaufte damit zu
 * Marktwerten, die der Spieler zu dem Zeitpunkt schon nicht mehr hatte.
 *
 * Diese Suite hält beide Hälften fest: dass gerechnet wird, BEVOR das Fenster aufgeht — und dass
 * es bei einem Mal bleibt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SEASON_TRANSITION_STEPS } from "@/lib/season/season-transition-steps";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

describe("Die Entwicklung läuft vor dem Transferfenster", () => {
  it("hat den Entwicklungsschritt vor der Verkaufsphase in der Kette", () => {
    const schritte = [...SEASON_TRANSITION_STEPS];
    expect(schritte.indexOf("player_development")).toBeGreaterThanOrEqual(0);
    expect(schritte.indexOf("player_development")).toBeLessThan(schritte.indexOf("transfer_sell_phase"));
    // Auch vor `season_end_management` — dort öffnet das Verkaufsfenster bereits.
    expect(schritte.indexOf("player_development")).toBeLessThan(schritte.indexOf("season_end_management"));
  });

  it("rechnet im Schritt wirklich, statt nur die Phase zu schalten", () => {
    const text = quelle("lib/season/season-transition-service.ts");
    expect(text).toContain("runSeasonEndProgressionBatch");
    expect(text).toContain('currentStep === "player_development" && !entwicklungSchonGelaufen');
  });

  /**
   * Die naheliegende Fassung wäre, bei einem Fehlschlag abzubrechen. Genau das wäre hier aber
   * die schlechtere Entscheidung: dieser Ablauf hatte schon einmal eine Sackgasse („ich hänge
   * in MD10, wie komme ich sauber in den nächsten schritt"), und ein blockierter Saisonübergang
   * sperrt Vertragsverlängerungen und Verkäufe gleich mit aus.
   */
  it("versperrt den Weg NICHT, wenn die Entwicklung scheitert", () => {
    const text = quelle("lib/season/season-transition-service.ts");
    const block = text.slice(text.indexOf('currentStep === "player_development" && !entwicklungSchonGelaufen'), text.indexOf("const transition: SeasonTransitionState"));
    // Kein Abbruch: weder ein früher Rückgabewert noch ein Blocker aus dem Batch.
    expect(block).not.toContain("applied: false");
    expect(block).not.toContain("blockingReasons: [...new Set([...preview.blockingReasons, ...batch");
    // Stattdessen: Warnung, und eine Ausnahme reisst den Uebergang nicht mit.
    expect(block).toContain("season_end_progression_deferred");
    expect(block).toContain("season_end_progression_failed");
    expect(block).toContain("catch (error)");
  });

  it("setzt den Marker nur, wenn wirklich gerechnet wurde", () => {
    // Sonst ginge die Entwicklung still verloren: der Saisonstart wuerde sie ueberspringen,
    // obwohl sie nie gelaufen ist.
    const text = quelle("lib/season/season-transition-service.ts");
    expect(text).toContain("progressionAppliedForSeasonId: entwicklungGelaufen");
    expect(text).toContain("entwicklungGelaufen = true;");
  });
});

describe("Und sie läuft nur EINMAL", () => {
  it("merkt sich die abgeschlossene Saison, nicht bloß ein Ja/Nein", () => {
    // Ein Schalter wäre über Saisongrenzen hinweg falsch und würde die Entwicklung der nächsten
    // Saison blockieren.
    const typen = quelle("lib/data/olyDataTypes.ts");
    expect(typen).toContain("progressionAppliedForSeasonId?: string | null;");
    const service = quelle("lib/season/season-transition-service.ts");
    expect(service).toContain("progressionAppliedForSeasonId === abgeschlosseneSaisonId");
  });

  it("lässt den Saisonstart die Materialisierung überspringen, wenn sie schon lief", () => {
    const text = quelle("lib/season/preseason-workflow-service.ts");
    expect(text).toContain("progressionAppliedForSeasonId === save.gameState.season.id");
    expect(text).toContain("season_end_progression_already_applied_in_transition_step");
  });

  it("meldet das Überspringen, statt es zu verschweigen", () => {
    // Eine stille Nulloperation im Saisonstart wäre später nicht mehr nachvollziehbar — die
    // Warnung sagt, warum hier nichts passiert ist.
    const text = quelle("lib/season/preseason-workflow-service.ts");
    const block = text.slice(text.indexOf("function materializeSeasonEndProgressionBeforeNextSeason"));
    expect(block.slice(0, 1800)).toContain('warnings: ["season_end_progression_already_applied_in_transition_step"]');
    expect(block.slice(0, 1800)).toContain("blockingReasons: []");
  });
});
