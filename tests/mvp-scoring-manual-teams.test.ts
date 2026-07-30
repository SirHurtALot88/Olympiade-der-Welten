/**
 * KEIN KI-GRIFF IN SPIELER-TEAMS — der dritte und letzte Pfad dieser Sorte.
 *
 * GEMELDET: „ich habe plötzlich nicht mehr die möglichkeit formkarten einzusetzen!"
 *
 * #266 hat zwei Stellen geschlossen, an denen die KI in die Aufstellung eines menschlich geführten
 * Teams schrieb: die invertierte `manual`-Sperre im Spieltagswechsel-Batch und den stillen
 * `autoFillFormCardModifiers` im Speicherpfad. `matchday-mvp-scoring-service` war die dritte —
 * dort wurde `controlMode` zwar ermittelt, aber ausschließlich ins Protokoll geschrieben
 * (`lineupTeams[].controlMode`), nie als Bedingung geprüft.
 *
 * WARUM DAS MEHR IST ALS BEVORMUNDUNG: über `buildFormCardUsageMap` gilt eine Karte als verbraucht,
 * sobald ihre Id in irgendeinem Draft der Saison steht — und seit #256 fallen verbrauchte Karten
 * aus der Auswahl. Schreibt die KI ungefragt Karten in den Draft des Spielers, verliert er Karten,
 * die er nie gespielt hat. Genau dieses Symptom wurde gemeldet.
 *
 * WAS DIESE DATEI PRÜFT UND WAS NICHT: `runMatchdayMvpScoring` braucht Persistenz, einen
 * vollständigen Spielstand und den kompletten Aufstellungs-Kontext; ein Lauf davon prüft hier
 * nichts, was er nicht auch bei kaputter Sperre bestünde. Geprüft wird deshalb die Form am
 * Quelltext — dieselbe Bauart, die dieses Repo für andere Verdrahtungen benutzt. Das belegt nicht
 * das Laufzeitverhalten; es verhindert, dass die Sperre unbemerkt wieder verschwindet.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(join(process.cwd(), "lib/season/matchday-mvp-scoring-service.ts"), "utf8");

/** Nur die Team-Schleife — sonst greifen die Zusicherungen in Protokoll- und Typcode. */
const LOOP = SOURCE.slice(SOURCE.indexOf("for (const team of ["), SOURCE.indexOf("const replacingIncompleteDraft"));

describe("Spieltagswertung — die KI stellt keine Spieler-Teams auf", () => {
  it("überspringt manuell geführte Teams", () => {
    expect(LOOP).toContain("if (manualTeamIds.has(team.teamId)) {");
    expect(LOOP).toContain('status: "skipped_manual"');
  });

  /**
   * Die Sperre muss VOR dem Bauen und Schreiben stehen. Stünde sie danach, wären die Karten
   * bereits im Draft — und damit verbraucht.
   */
  it("die Sperre greift, bevor eine KI-Aufstellung gebaut wird", () => {
    const guard = LOOP.indexOf("if (manualTeamIds.has(team.teamId)) {");
    const build = SOURCE.indexOf("buildAiLegacyLineupModifiers(contextResult.context");
    const write = SOURCE.indexOf("upsertDraftInGameState(");
    expect(guard).toBeGreaterThan(-1);
    expect(guard, "die Sperre steht hinter dem Modifier-Bau").toBeLessThan(build);
    expect(guard, "die Sperre steht hinter dem Draft-Schreiben").toBeLessThan(write);
  });

  /**
   * Der eigentliche Fehler war nicht ein fehlendes Feld, sondern ein Feld, das nur PROTOKOLLIERT
   * und nie geprüft wurde. Diese Erwartung hält fest, dass es jetzt auch entscheidet.
   */
  it("controlMode wird nicht mehr nur protokolliert", () => {
    expect(SOURCE).toContain("const manualTeamIds = getManualControlTeamIds(nextGameState);");
    expect(SOURCE).toContain('import { getManualControlTeamIds } from "@/lib/foundation/team-control-settings";');
  });

  /** Für KI-Teams bleibt alles wie es war — die Sperre darf nicht den ganzen Lauf lahmlegen. */
  it("KI-Teams werden weiterhin aufgestellt", () => {
    expect(SOURCE).toContain("buildAiLegacyLineupModifiers(contextResult.context, preview.entries)");
    expect(SOURCE).toContain('status: "auto_lineup_source"');
  });
});
