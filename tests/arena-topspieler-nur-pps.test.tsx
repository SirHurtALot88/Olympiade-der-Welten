/**
 * DIE TOP-SPIELER UNTER DER SPIELTAGS-WERTUNG: PP UND SCORE, BEIDE ÜBER BEIDE DISZIPLINEN
 * SUMMIERT, SORTIERT NACH PP-SUMME.
 *
 * HIER STAND ERST DAS GEGENTEIL — „und sonst keine Zahl", der Score sei zu entfernen. Das war
 * MEIN Lesefehler an Chris' Satz „bei den top players brauch ich gar nicht die scores, sondern nur
 * die PPs die sie in beiden Diszis gesammelt haben", und der Test hat ihn festgeschrieben.
 *
 * Chris' Klarstellung: „nein die score darf da stehen bleiben mir ging es nur darum dass die PPs
 * und Score aus der anderen diszi beim spieler ergänzt werden und dann die Summe da steht und nach
 * PPs Total geordnet ist."
 *
 * Gemeint war also nicht „Score weg", sondern „Score ist nicht das Maßgebliche". Die Summierung
 * über beide Disziplinen und die Sortierung nach PP-Summe macht `summiereSpieltagsTopSpieler`
 * bereits (der Score ist dort nur der Gleichstand-Brecher) — gefehlt hat, dass BEIDE Zahlen
 * dastehen.
 *
 * ZWEITER PUNKT DIESER DATEI: die Überschrift nennt die Disziplinen, aus denen die PP-Summe
 * stammt. Genau daran hing Chris' wiederkehrender Verdacht („zeigt noch immer 1 Diszi") — einer
 * summierten Zahl sieht man nicht an, worüber summiert wurde, solange es nirgends dransteht.
 *
 * GEPRÜFT WIRD MARKUP, nicht Quelltext: die Zeilen werden wirklich gerendert und die Zahlen darin
 * gelesen.
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DisciplineStageTopPlayers, {
  type DisciplineStageTopPlayer,
} from "@/app/foundation/discipline-stage/DisciplineStageTopPlayers";

function spieler(input: Partial<DisciplineStageTopPlayer> & { rank: number; name: string }): DisciplineStageTopPlayer {
  return {
    teamCode: "A-A",
    logoUrl: null,
    portraitUrl: null,
    score: 142.8,
    points: 5.8,
    mutatorPoints: null,
    isMvp: false,
    isOwn: false,
    ovrRank: null,
    ...input,
  };
}

function rendere(
  players: DisciplineStageTopPlayer[],
  disciplineNames?: readonly string[] | null,
) {
  // React setzt zwischen zwei Textstuecken einen Kommentar-Trenner (`6,4<!-- --> PP`). Der ist
  // reine SSR-Mechanik und im Browser unsichtbar — er wird entfernt, sonst prueft der Test die
  // Aufteilung der JSX-Ausdruecke statt der gelesenen Zeile.
  return renderToString(
    <DisciplineStageTopPlayers players={players} disciplineNames={disciplineNames} />,
  ).replaceAll("<!-- -->", "");
}

describe("Die Liste zeigt PP und Score, geordnet nach PP", () => {
  it("bringt die PP mit Einheit UND den Score daneben", () => {
    const markup = rendere([spieler({ rank: 1, name: "Ghorok", points: 6.3589, score: 117.8 })]);
    expect(markup).toContain("6,4 PP");
    // Der Score bleibt sichtbar — er ist die zweite Haelfte der Leistung, nur nicht die
    // massgebliche. Beide Zahlen sind bereits ueber beide Disziplinen summiert.
    expect(markup).toContain("117,8");
    expect(markup).toContain("Score");
  });

  it("traegt den PP-Wert auch maschinenlesbar, damit die Anzeige pruefbar bleibt", () => {
    const markup = rendere([spieler({ rank: 1, name: "Ghorok", points: 6.3589 })]);
    expect(markup).toContain('data-player-points="6.3589"');
  });

  it("ohne gebuchte PP steht ein Strich — der Score wird NICHT zur Ersatz-PP", () => {
    // Der eigentliche Fehler war nie der Score an sich, sondern dass die Zeile ohne gebuchte
    // Punkte auf ihn zurueckfiel: die Zahl stand dann dort, wo die PP steht, und wurde als PP
    // gelesen. Der Score darf danebenstehen — er darf die PP nicht ERSETZEN.
    const markup = rendere([spieler({ rank: 1, name: "Ohnepunkte", points: null, score: 99.9 })]);
    expect(markup).toContain("— PP");
    expect(markup).not.toContain("99,9 PP");
  });

  it("die Reihenfolge, die hereinkommt, ist die Reihenfolge, die dasteht", () => {
    const markup = rendere([
      spieler({ rank: 1, name: "Erster", points: 6.4 }),
      spieler({ rank: 2, name: "Zweiter", points: 6 }),
    ]);
    expect(markup.indexOf("Erster")).toBeLessThan(markup.indexOf("Zweiter"));
  });
});

describe("Die Ueberschrift sagt, worueber summiert wurde", () => {
  it("nennt beide aufgedeckten Disziplinen", () => {
    const markup = rendere([spieler({ rank: 1, name: "Ghorok" })], ["Hockey", "Basketball"]);
    expect(markup).toContain('data-disciplines="Hockey + Basketball"');
    expect(markup).toContain("Hockey + Basketball");
  });

  it("nennt bei nur einer aufgedeckten Seite auch nur die eine — keine Summe behaupten", () => {
    const markup = rendere([spieler({ rank: 1, name: "Ghorok" })], ["Hockey"]);
    expect(markup).toContain('data-disciplines="Hockey"');
    expect(markup).not.toContain("Basketball");
  });

  it("ohne Namen bleibt die Ueberschrift stumm statt zu raten", () => {
    const markup = rendere([spieler({ rank: 1, name: "Ghorok" })], null);
    expect(markup).toContain('data-disciplines=""');
  });
});

/**
 * DER KERN VON CHRIS' WUNSCH — und er sitzt nicht in der Anzeige, sondern in der Summierung:
 * „dass die PPs und Score aus der anderen diszi beim spieler ergänzt werden und dann die Summe
 * da steht und nach PPs Total geordnet ist."
 *
 * Ein Spieler, der in BEIDEN Disziplinen antrat, muss EINMAL dastehen — mit der Summe beider
 * Zahlen. Und geordnet wird nach der PP-Summe, nicht nach dem Score. Genau das wird hier an
 * Werten geprueft, nicht an gerendertem Markup: die Anzeige kann nur zeigen, was diese Rechnung
 * hergibt.
 */
describe("Die Summierung ueber beide Disziplinen", () => {
  const ZEILEN = [
    // Ein Spieler, zwei Disziplinen — muss zu EINER Zeile mit der Summe werden.
    { playerId: "p1", playerName: "Doppelstarter", teamId: "T1", disciplineId: "d1", finalPlayerScore: 100, pointsAwarded: 2, mutatorPpsBonus: null, isMvpCandidate: false },
    { playerId: "p1", playerName: "Doppelstarter", teamId: "T1", disciplineId: "d2", finalPlayerScore: 50, pointsAwarded: 3, mutatorPpsBonus: null, isMvpCandidate: false },
    // Hoher Score, wenig PP — darf NICHT vor dem Doppelstarter stehen.
    { playerId: "p2", playerName: "Scorekoenig", teamId: "T2", disciplineId: "d1", finalPlayerScore: 400, pointsAwarded: 4, mutatorPpsBonus: null, isMvpCandidate: false },
  ];

  it("fasst denselben Spieler aus beiden Disziplinen zu einer Zeile mit der Summe zusammen", async () => {
    const { summiereSpieltagsTopSpieler } = await import(
      "@/lib/foundation/discipline-stage/discipline-stage-matchday-top-players"
    );
    const zeilen = summiereSpieltagsTopSpieler(ZEILEN as never, new Set(["d1", "d2"]));
    const doppel = zeilen.find((z) => z.playerId === "p1");
    expect(zeilen.filter((z) => z.playerId === "p1")).toHaveLength(1);
    expect(doppel!.points).toBeCloseTo(5, 4); // 2 + 3
    expect(doppel!.score).toBeCloseTo(150, 4); // 100 + 50
    expect(doppel!.disciplineIds.sort()).toEqual(["d1", "d2"]);
  });

  it("ordnet nach PP-Summe, nicht nach Score", async () => {
    const { summiereSpieltagsTopSpieler } = await import(
      "@/lib/foundation/discipline-stage/discipline-stage-matchday-top-players"
    );
    const zeilen = summiereSpieltagsTopSpieler(ZEILEN as never, new Set(["d1", "d2"]));
    // Doppelstarter: 5 PP / 150 Score. Scorekoenig: 4 PP / 400 Score.
    expect(zeilen[0]!.playerId).toBe("p1");
    expect(zeilen[1]!.playerId).toBe("p2");
    // Waere nach Score sortiert worden, stuende der Scorekoenig vorn.
    expect(zeilen[0]!.score).toBeLessThan(zeilen[1]!.score);
  });

  it("zaehlt nur aufgedeckte Disziplinen — kein Spoiler auf die noch laufende", async () => {
    const { summiereSpieltagsTopSpieler } = await import(
      "@/lib/foundation/discipline-stage/discipline-stage-matchday-top-players"
    );
    const nurD1 = summiereSpieltagsTopSpieler(ZEILEN as never, new Set(["d1"]));
    const doppel = nurD1.find((z) => z.playerId === "p1");
    expect(doppel!.points).toBeCloseTo(2, 4);
    expect(doppel!.score).toBeCloseTo(100, 4);
  });
});
