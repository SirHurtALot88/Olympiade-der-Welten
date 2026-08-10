/**
 * APRON-HOCHRECHNUNG (GuV-Hover) — was hier geprüft wird, ist NICHT die Apron-Arithmetik (die hat
 * ihre eigenen Tests in apron-service.test.ts), sondern die eine Eigenschaft, die die Hochrechnung
 * überhaupt erst zeigbar macht:
 *
 *   Die Zahl im Hover ist dieselbe, die die Abrechnung am Saisonende buchen würde — wenn der
 *   aktuelle Rang der Endrang bliebe.
 *
 * Wäre sie es nicht, zeigte der Saisonstand eine Vorhersage, die das Spiel später nicht einlöst.
 * Deshalb wird gegen `previewApronSettlement` gegengerechnet, nicht gegen selbst aufgestellte
 * Erwartungswerte.
 */
import { describe, expect, it } from "vitest";

import { buildApronProjection } from "@/lib/finance/apron-projection";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { computeApronLines } from "@/lib/season/apron-service";
import { ensureSeasonApronLinesFrozen, previewApronSettlement } from "@/lib/season/apron-settlement-service";

function buildRankMap(gameState: ReturnType<typeof createSingleplayerGameState>) {
  return new Map(buildTeamSeasonOverviewRows({ gameState }).map((row) => [row.teamId, row.rank ?? null] as const));
}

describe("Apron-Hochrechnung deckt sich mit der Saisonende-Abrechnung", () => {
  it("liefert bei gleichem Rang exakt die Netto-Deltas der echten Vorschau", () => {
    const gameState = ensureSeasonApronLinesFrozen(structuredClone(createSingleplayerGameState()));
    const settlement = previewApronSettlement(gameState);
    const projection = buildApronProjection({ gameState, rankByTeamId: buildRankMap(gameState) });

    expect(settlement.rows.length).toBeGreaterThan(0);
    for (const row of settlement.rows) {
      const projected = projection.byTeamId.get(row.teamId);
      expect(projected, `${row.teamId} fehlt in der Hochrechnung`).toBeDefined();
      expect(projected?.nettoDelta).toBeCloseTo(row.nettoDelta, 9);
      expect(projected?.abgabe).toBeCloseTo(row.abgabe, 9);
      expect(projected?.ausgleich).toBeCloseTo(row.ausgleich, 9);
    }
    expect(projection.topf).toBeCloseTo(settlement.topf, 9);
    expect(projection.zahlerCount).toBe(settlement.zahlerCount);
    expect(projection.empfaengerCount).toBe(settlement.empfaengerCount);
  });

  /**
   * FRÜHER lautete dieser Fall „benutzt die EINGEFRORENEN Linien, sobald es sie gibt". Der Snapshot
   * allein taugt aber nicht als Signal: er entsteht im Saisonübergang, also noch VOR dem Kaderbau.
   * Die Anzeige meldete dadurch „eingefroren", während die Liga die Linie reihenweise überholte
   * (Chris' Save: Median 45,0 eingefroren, 69,8 tatsächlich, 28 von 32 Teams darüber).
   *
   * Verbindlich ist die Linie ab dem ersten abgerechneten Spieltag — und genau das prüft der Fall.
   */
  it("benutzt die EINGEFRORENEN Linien, sobald der erste Spieltag abgerechnet ist", () => {
    const basis = ensureSeasonApronLinesFrozen(structuredClone(createSingleplayerGameState()));
    const gameState = {
      ...basis,
      seasonState: {
        ...basis.seasonState,
        matchdayResults: [
          ...(basis.seasonState.matchdayResults ?? []),
          { id: "md-1-result", seasonId: basis.season.id, matchdayId: basis.matchdayState.matchdayId },
        ],
      },
    } as typeof basis;
    const projection = buildApronProjection({ gameState, rankByTeamId: buildRankMap(gameState) });
    expect(projection.frozenLines).toBe(true);
    expect(projection.lines.line1).toBeCloseTo(gameState.seasonState.apronLinesSnapshot?.line1 ?? -1, 9);
  });

  it("während des Kaderbaus sind die Linien noch nicht verbindlich und sagen das", () => {
    // Snapshot vorhanden, aber kein Spieltag abgerechnet: die Anzeige muss sich als vorläufig
    // ausweisen, sonst liest man eine Grenze als fest, die noch mitwandert.
    const gameState = ensureSeasonApronLinesFrozen(structuredClone(createSingleplayerGameState()));
    const projection = buildApronProjection({ gameState, rankByTeamId: buildRankMap(gameState) });
    expect(projection.frozenLines).toBe(false);
  });

  it("ohne Snapshot rechnet sie aus dem aktuellen Stand und sagt es", () => {
    // Anders als die Abrechnung (die ohne Snapshot blockiert) darf die ANZEIGE weiterrechnen —
    // sonst bliebe der Hover vor dem ersten Einfrieren leer, obwohl die Grenze bestimmbar ist.
    // Bedingung: sie muss sich als nicht-verbindlich zu erkennen geben.
    const gameState = structuredClone(createSingleplayerGameState());
    expect(gameState.seasonState.apronLinesSnapshot).toBeUndefined();
    const projection = buildApronProjection({ gameState, rankByTeamId: buildRankMap(gameState) });
    expect(projection.frozenLines).toBe(false);
    expect(projection.lines.line1).toBeCloseTo(computeApronLines(gameState).line1, 9);
  });

  it("Erhaltung: Abgaben und Ausgleiche heben sich über die ganze Liga auf", () => {
    const gameState = ensureSeasonApronLinesFrozen(structuredClone(createSingleplayerGameState()));
    const projection = buildApronProjection({ gameState, rankByTeamId: buildRankMap(gameState) });
    const summe = [...projection.byTeamId.values()].reduce((total, row) => total + row.nettoDelta, 0);
    expect(summe).toBeCloseTo(0, 6);
  });

  it("ein Team ohne bekannten Rang fällt auf den letzten Platz zurück, statt zu verschwinden", () => {
    const gameState = ensureSeasonApronLinesFrozen(structuredClone(createSingleplayerGameState()));
    const projection = buildApronProjection({ gameState, rankByTeamId: new Map() });
    expect(projection.byTeamId.size).toBe(gameState.teams.length);
    for (const row of projection.byTeamId.values()) {
      expect(row.rank).toBeNull();
      // Letzter Platz = kleinster Wertungsanteil = niedrigster Deckel: die Abgabe kann dadurch
      // nur kleiner werden, nie größer. Ein zu hoher Wert im Hover wäre die schädliche Richtung.
      expect(row.abgabe).toBeGreaterThanOrEqual(0);
    }
  });
});
