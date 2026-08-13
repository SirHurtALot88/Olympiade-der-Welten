/**
 * DIE TOP-SPIELER UNTER DER SPIELTAGS-WERTUNG ZEIGEN PLAYER-POINTS — UND SONST KEINE ZAHL.
 *
 * GEWÜNSCHT VON CHRIS: „bei den top players brauch ich gar nicht die scores, sondern nur die PPs
 * die sie in beiden Diszis gesammelt haben ich meine die tabelle UNTERHALB der Spieltags-Tabelle
 * der teams".
 *
 * VORHER stand in jeder Zeile unter den PP noch „(Score 142,8)". Der Score ist in dieser Liste
 * keine Aussage: sortiert wird nach PP, gebucht werden PP — aber er war die größere Zahl und wurde
 * gelesen wie das Ergebnis. Er ist hier weg (Spielerkarte und Spieltags-Wertung zeigen ihn weiter).
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

describe("Die Liste zeigt Player-Points statt Scores", () => {
  it("bringt die PP mit Einheit — und den Score nirgends", () => {
    const markup = rendere([spieler({ rank: 1, name: "Ghorok", points: 6.3589, score: 117.8 })]);
    expect(markup).toContain("6,4 PP");
    // Weder als Klartext noch als nackte Zahl: 117,8 taucht in dieser Zeile nicht mehr auf.
    expect(markup).not.toContain("Score");
    expect(markup).not.toContain("117,8");
  });

  it("traegt den PP-Wert auch maschinenlesbar, damit die Anzeige pruefbar bleibt", () => {
    const markup = rendere([spieler({ rank: 1, name: "Ghorok", points: 6.3589 })]);
    expect(markup).toContain('data-player-points="6.3589"');
  });

  it("ohne gebuchte PP steht ein Strich — kein Score als Ersatzzahl", () => {
    // Vorher fiel die Zeile auf den Score zurueck; die Zahl wurde dann als PP gelesen.
    const markup = rendere([spieler({ rank: 1, name: "Ohnepunkte", points: null, score: 99.9 })]);
    expect(markup).toContain("— PP");
    expect(markup).not.toContain("99,9");
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
