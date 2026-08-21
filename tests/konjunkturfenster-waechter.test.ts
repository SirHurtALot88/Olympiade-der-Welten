/**
 * CHRIS' AUFTRAG vom 21.08.2026: „3a+b" — erst die Ursache finden, dann einen Wächter einziehen,
 * der die Abweichung meldet statt sie zu schlucken.
 *
 * WAS 3a ERGAB, und es entlastet: die FAKTOREN sind deterministisch. Über zwei Prozesse gemessen
 * liefern alle fünf Live-Abbilder dieselbe Reihe (`h0z7cl`: 1,05 · 1,08 · 1,17 · 0,96 · 1,14).
 * Gewandert ist allein `generatedAt`, und nur bei `h0z7cl` und `n90y4m` — dort fehlte
 * `seasonEconomyFactors` in der gespeicherten Zeile ganz, also baute der Ladepfad die Reihe jedes
 * Mal neu. Beim ersten Speichern heilt sich das von selbst (nachgemessen: vorher „FEHLT", nachher
 * „5 Einträge").
 *
 * WAS TROTZDEM FEHLTE: der Fall „es steht etwas anderes drin, als der Seed ergibt" wurde
 * stillschweigend überschrieben. Der Faktor entscheidet über Sponsorenzahlungen und die
 * Apron-Drosselung — ein Austausch beim Laden ändert rückwirkend die Grundlage von Geld, das schon
 * geflossen ist. Genau diesen Fall hält der Wächter fest.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SeasonEconomyFactorRecord } from "@/lib/data/olyDataTypes";
import { createPersistedSaveRecordForTest } from "@/lib/persistence/save-repository";

const SAVE_ID = "waechter-save";

function reihe(faktoren: number[], seasonId = "season-1"): SeasonEconomyFactorRecord[] {
  return faktoren.map((factor, horizonIndex) => ({
    seasonId,
    seasonLabel: horizonIndex === 0 ? "Aktuell" : `Season +${horizonIndex}`,
    horizonIndex,
    factor,
    source: "rolled",
    rollSeed: `${SAVE_ID}:${seasonId}:season-economy-factor:${horizonIndex + 1}`,
    carriedFromSeasonId: null,
    generatedAt: "2026-08-01T00:00:00.000Z",
  })) as SeasonEconomyFactorRecord[];
}

function baueSpielstand(faktoren?: SeasonEconomyFactorRecord[]): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      ...(faktoren ? { seasonEconomyFactors: faktoren } : {}),
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [],
    teamIdentities: [],
    players: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    disciplines: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-08-21T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 0,
      unmappedPlayers: [],
    },
  } as unknown as GameState;
}

describe("Der Wächter über der Konjunktur-Reihe", () => {
  it("ohne gespeicherte Reihe wird geseedet — das ist die Erstbefüllung, keine Abweichung", () => {
    const ergebnis = createPersistedSaveRecordForTest(baueSpielstand(), SAVE_ID);
    expect(ergebnis.seasonState.seasonEconomyFactors).toHaveLength(5);
    expect(ergebnis.seasonEconomyFactorGuardEvents ?? []).toEqual([]);
  });

  it("eine passende Reihe bleibt unangetastet und meldet nichts", () => {
    const geseedet = createPersistedSaveRecordForTest(baueSpielstand(), SAVE_ID).seasonState
      .seasonEconomyFactors as SeasonEconomyFactorRecord[];
    const ergebnis = createPersistedSaveRecordForTest(baueSpielstand(geseedet), SAVE_ID);
    expect(ergebnis.seasonState.seasonEconomyFactors).toEqual(geseedet);
    expect(ergebnis.seasonEconomyFactorGuardEvents ?? []).toEqual([]);
  });

  it("STRUKTUR: eine lückenhafte Reihe wird gemeldet — und BLEIBT STEHEN", () => {
    // Mit dieser Reihe wurde gerechnet, mit ihr ist Sponsorengeld geflossen. Sie beim Laden
    // auszutauschen änderte rückwirkend die Grundlage, ohne dass jemand davon erführe.
    const luecke = reihe([1.05, 1.08, 1.17]);
    const ergebnis = createPersistedSaveRecordForTest(baueSpielstand(luecke), SAVE_ID);

    expect(ergebnis.seasonState.seasonEconomyFactors).toEqual(luecke);
    const ereignisse = ergebnis.seasonEconomyFactorGuardEvents ?? [];
    expect(ereignisse).toHaveLength(1);
    expect(ereignisse[0]!.reason).toBe("season_economy_factor_mismatch");
    expect(ereignisse[0]!.eventId).toContain("struktur");
    expect(ereignisse[0]!.storedFactors).toEqual([1.05, 1.08, 1.17]);
  });

  it("WERTE in Saison 1: eine vollständige, aber fremde Reihe wird gemeldet", () => {
    const fremd = reihe([1.5, 1.5, 1.5, 1.5, 1.5]);
    const ergebnis = createPersistedSaveRecordForTest(baueSpielstand(fremd), SAVE_ID);

    expect(ergebnis.seasonState.seasonEconomyFactors).toEqual(fremd);
    const ereignisse = ergebnis.seasonEconomyFactorGuardEvents ?? [];
    expect(ereignisse).toHaveLength(1);
    expect(ereignisse[0]!.eventId).toContain("werte");
    expect(ereignisse[0]!.storedFactors).toEqual([1.5, 1.5, 1.5, 1.5, 1.5]);
    expect(ereignisse[0]!.seededFactors).not.toEqual(ereignisse[0]!.storedFactors);
  });

  it("AB SAISON 2 schweigt die Werte-Prüfung — sonst wäre sie dauerhaft rot", () => {
    // Das ist die wichtigste Zusicherung dieses Wächters. `advanceSeasonEconomyFactorWindow` nimmt
    // vier von fünf Horizonten aus der Vorsaison mit, die Reihe SOLL also vom frischen Seed
    // abweichen. Am echten Spielstand `1hf25q` gemessen: gespeichert [1,19 · 0,87 · 0,83 · 0,91 ·
    // 1,24] gegen Seed [1,22 · 0,95 · 1,09 · 1,03 · 1,06]. Ein Wächter, der immer anschlägt, ist
    // keiner — genau das war der Fehler, den er selbst finden soll.
    const fortgeschrieben = reihe([1.19, 0.87, 0.83, 0.91, 1.24], "season-2");
    const stand = baueSpielstand(fortgeschrieben);
    (stand as unknown as { season: { id: string } }).season.id = "season-2";
    (stand.seasonState as unknown as { seasonId: string }).seasonId = "season-2";

    const ergebnis = createPersistedSaveRecordForTest(stand, SAVE_ID);
    expect(ergebnis.seasonEconomyFactorGuardEvents ?? []).toEqual([]);
    expect(ergebnis.seasonState.seasonEconomyFactors).toEqual(fortgeschrieben);
  });

  it("AB SAISON 2 greift die Struktur-Prüfung trotzdem", () => {
    // Eine kaputte Reihe ist kaputt, egal in welcher Saison.
    const kaputt = reihe([1.19, 0.87], "season-2");
    const stand = baueSpielstand(kaputt);
    (stand as unknown as { season: { id: string } }).season.id = "season-2";
    (stand.seasonState as unknown as { seasonId: string }).seasonId = "season-2";

    const ereignisse = createPersistedSaveRecordForTest(stand, SAVE_ID).seasonEconomyFactorGuardEvents ?? [];
    expect(ereignisse).toHaveLength(1);
    expect(ereignisse[0]!.eventId).toContain("struktur");
  });

  it("meldet dieselbe Abweichung nicht bei jedem Laden erneut", () => {
    // Sonst wüchse die Liste bei jedem Öffnen, und der Spielstand wäre nach jedem Laden ein
    // anderer — genau das Wackeln, das der Wächter melden soll, hätte er dann selbst erzeugt.
    const fremd = reihe([1.5, 1.5, 1.5, 1.5, 1.5]);
    const einmal = createPersistedSaveRecordForTest(baueSpielstand(fremd), SAVE_ID);
    const zweimal = createPersistedSaveRecordForTest(
      { ...baueSpielstand(fremd), seasonEconomyFactorGuardEvents: einmal.seasonEconomyFactorGuardEvents },
      SAVE_ID,
    );
    expect(zweimal.seasonEconomyFactorGuardEvents).toHaveLength(1);
  });

  it("der Zeitstempel kommt aus der gespeicherten Reihe, nicht von der Wanduhr", () => {
    const fremd = reihe([1.5, 1.5, 1.5, 1.5, 1.5]);
    const ergebnis = createPersistedSaveRecordForTest(baueSpielstand(fremd), SAVE_ID);
    expect(ergebnis.seasonEconomyFactorGuardEvents?.[0]!.timestamp).toBe("2026-08-01T00:00:00.000Z");
  });
});
