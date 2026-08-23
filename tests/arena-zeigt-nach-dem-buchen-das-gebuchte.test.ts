import { describe, expect, it } from "vitest";

import type { GameState, MatchdayResolveSnapshotRecord } from "@/lib/data/olyDataTypes";
import {
  markMatchdayResolveSnapshotAsBooked,
  readMatchdayResolveSnapshot,
  resolveMatchdayPreviewToBook,
} from "@/lib/foundation/matchday-resolve-snapshot";
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

/**
 * GEMELDET VON CHRIS an der Arena, mit zwei Screenshots im Abstand von etwa einer Minute:
 * „Screenshot 1 zeigt die Ergebnisse. Screenshot 2 zeigt andere ergebnisse […] nachdem gebucht
 * wurde. […] vorher wird S-S mit MEHR punkten angezeigt als C-S und man wundert sich warum die
 * Positionen tauschen […] ich will keinen switch mehr sehen dass die punkte sich ändern."
 *
 * URSACHE. Ein durchgebuchter Spieltag machte die Vorberechnung ungültig — mit gutem Grund: ein
 * veralteter Snapshot darf die gebuchte Wahrheit nicht überstimmen. Die Arena fiel damit aber auf
 * den LIVE-Pfad zurück und rechnete den Spieltag NEU, gegen den Zustand NACH der Buchung. Und die
 * Buchung schreibt die Nach-Spieltags-Fatigue: dieselbe Disziplin kommt danach anders heraus. Am
 * Screenshot messbar — Malagor 98,8 → 92,1, Silver Soldiers 14,9 → 14,2, Cold Steel 14,4 → 14,9,
 * samt getauschter Plätze.
 *
 * DIE LÖSUNG IST EIN BELEG, KEINE HEURISTIK. Der Apply stempelt die Rechnung, aus der er gebucht
 * hat (`bookedAt` + Ergebnis-ID). Zum ANZEIGEN ist sie ab da die einzig richtige Quelle; zum
 * BUCHEN bleibt sie gesperrt, sonst schriebe ein Re-Apply sie ein zweites Mal fest.
 */

const scope = { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-3" } as const;

function preview(score: number): LegacyMatchdayResolvePreview {
  return {
    saveId: scope.saveId,
    seasonId: scope.seasonId,
    matchdayId: scope.matchdayId,
    status: "ready",
    disciplinePreviews: [],
    teamResults: [
      {
        teamId: "S-S",
        teamName: "Silver Soldiers",
        status: "ready",
        d1DisciplineId: "d-1",
        d1Status: "ready",
        d1Score: score,
        d1Points: score,
        d2DisciplineId: "d-2",
        d2Status: "ready",
        d2Score: 0,
        d2Points: 0,
        totalScore: score,
        totalPoints: score,
        rank: 1,
        warnings: [],
        missingLineup: false,
        missingScores: [],
      },
    ],
    warnings: [],
    missingLineups: [],
    incompleteLineups: [],
    missingScores: [],
  } as unknown as LegacyMatchdayResolvePreview;
}

/** Ein Spielstand, in dem BEIDE Disziplin-Seiten des Spieltags gebucht sind. */
function baueDurchgebuchtenSpielstand(record: MatchdayResolveSnapshotRecord | null): GameState {
  return {
    season: { id: scope.seasonId },
    teams: [],
    rosters: [],
    players: [],
    seasonState: {
      matchdayResults: [
        { id: "res-1", saveId: scope.saveId, seasonId: scope.seasonId, matchdayId: scope.matchdayId },
      ],
      disciplineResults: [
        { matchdayResultId: "res-1", disciplineSide: "d1" },
        { matchdayResultId: "res-1", disciplineSide: "d2" },
      ],
      matchdayResolveSnapshots: record ? [record] : [],
    },
  } as unknown as GameState;
}

function baueDatensatz(input: { gestempelt: boolean; score: number }): MatchdayResolveSnapshotRecord {
  return {
    id: "snap-1",
    saveId: scope.saveId,
    seasonId: scope.seasonId,
    matchdayId: scope.matchdayId,
    // Absichtlich eine Signatur, die NICHT mehr passt: nach der Buchung tut sie das nie. Genau
    // deshalb entscheidet hier der Stempel und nicht die Signatur.
    signature: "veraltet",
    sideSignatures: { d1: "veraltet", d2: "veraltet" },
    previewStatus: "ready",
    readinessByTeamId: {},
    payload: { preview: preview(input.score), summary: { marker: "aus dem Bestand" } },
    ...(input.gestempelt ? { bookedAt: "2026-08-22T10:00:00.000Z", bookedMatchdayResultId: "res-1" } : {}),
    createdAt: "2026-08-22T09:00:00.000Z",
  } as MatchdayResolveSnapshotRecord;
}

describe("Arena · nach dem Buchen zaehlt der Beleg, nicht eine Neuberechnung", () => {
  it("gibt die gebuchte Rechnung zum ANZEIGEN heraus, obwohl der Spieltag durch ist", () => {
    const gameState = baueDurchgebuchtenSpielstand(baueDatensatz({ gestempelt: true, score: 14.9 }));
    const gelesen = readMatchdayResolveSnapshot(gameState, scope, { zweck: "anzeigen" });
    expect(gelesen).not.toBeNull();
    expect(gelesen?.payload.preview.teamResults[0]?.d1Points).toBe(14.9);
  });

  it("gibt sie zum BUCHEN NICHT heraus — ein Re-Apply darf sie nicht erneut festschreiben", () => {
    const gameState = baueDurchgebuchtenSpielstand(baueDatensatz({ gestempelt: true, score: 14.9 }));
    expect(readMatchdayResolveSnapshot(gameState, scope)).toBeNull();
    expect(readMatchdayResolveSnapshot(gameState, scope, { zweck: "buchen" })).toBeNull();
    // Und der Buchungsweg faellt damit auf die frisch gerechnete Vorschau zurueck, wie bisher.
    const entscheidung = resolveMatchdayPreviewToBook({ gameState, scope, livePreview: preview(1.1) });
    expect(entscheidung.source).toBe("live");
    expect(entscheidung.preview.teamResults[0]?.d1Points).toBe(1.1);
  });

  it("laesst einen UNGESTEMPELTEN Datensatz nach der Buchung weiter aussen vor", () => {
    // Das ist die alte Sicherung, und sie bleibt: ein Snapshot ohne Beleg kann Zahlen tragen, die
    // nie gebucht wurden (am Abbild `1hf25q` waren es 20 von 32 d1-Zeilen).
    const gameState = baueDurchgebuchtenSpielstand(baueDatensatz({ gestempelt: false, score: 99 }));
    expect(readMatchdayResolveSnapshot(gameState, scope, { zweck: "anzeigen" })).toBeNull();
    expect(readMatchdayResolveSnapshot(gameState, scope)).toBeNull();
  });

  it("stempelt die GEBUCHTE Rechnung und ueberschreibt dabei eine verfallene", () => {
    // Der Fall „Apply hat live gerechnet, weil die Vorberechnung verfallen war": danach muss der
    // Beleg die gebuchte Rechnung tragen — nicht die verfallene, die noch dalag.
    const vorher = baueDurchgebuchtenSpielstand(baueDatensatz({ gestempelt: false, score: 99 }));
    const nachher = markMatchdayResolveSnapshotAsBooked({
      gameState: vorher,
      scope,
      preview: preview(14.9),
      matchdayResultId: "res-1",
      bookedAt: "2026-08-22T10:00:00.000Z",
    });

    const record = nachher.seasonState.matchdayResolveSnapshots?.[0];
    expect(record?.bookedAt).toBe("2026-08-22T10:00:00.000Z");
    expect(record?.bookedMatchdayResultId).toBe("res-1");
    const gelesen = readMatchdayResolveSnapshot(nachher, scope, { zweck: "anzeigen" });
    expect(gelesen?.payload.preview.teamResults[0]?.d1Points).toBe(14.9);
    // Der uebrige Payload des Bestands bleibt erhalten — er beschreibt dasselbe Feld, und ihn neu
    // zu bauen hiesse, den Spieltag ein zweites Mal aufzuloesen.
    expect((record?.payload as { summary?: { marker?: string } })?.summary?.marker).toBe("aus dem Bestand");
    // Und der Spielstand traegt weiterhin GENAU EINEN Datensatz, nicht zwei.
    expect(nachher.seasonState.matchdayResolveSnapshots).toHaveLength(1);
  });

  it("legt einen Beleg auch dann an, wenn gar keine Vorberechnung existierte", () => {
    const vorher = baueDurchgebuchtenSpielstand(null);
    const nachher = markMatchdayResolveSnapshotAsBooked({
      gameState: vorher,
      scope,
      preview: preview(14.9),
      matchdayResultId: "res-1",
      bookedAt: "2026-08-22T10:00:00.000Z",
    });
    const gelesen = readMatchdayResolveSnapshot(nachher, scope, { zweck: "anzeigen" });
    expect(gelesen?.payload.preview.teamResults[0]?.d1Points).toBe(14.9);
  });
});
