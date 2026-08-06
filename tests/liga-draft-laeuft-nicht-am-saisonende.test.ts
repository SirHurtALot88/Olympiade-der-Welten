/**
 * GEMELDET: „die sind ja sogar mit 4.8. und 5.8. datiert die käufe! und das kann ja nicht sein da
 * sind sehr viele falsche käufe bei" — dazu die Tabellenansicht des Deal-Stroms mit der Quelle
 * „Setup / AI Roster Fill" auf Kaeufe ins EIGENE Team, datiert einen Tag nach dem Anlegen des
 * Spielstands.
 *
 * BEFUND, am echten Spielstand gemessen (`new-game-1785823388048-1hf25q`):
 *
 *   04.08.  329 x ai_roster_fill          Erst-Draft beim Anlegen — richtig
 *   04.08.    9 x manual_transfermarkt_buy  Chris' eigene Kaeufe
 *   05.08.    4 x ai_preseason_market_buy   Preseason-Markt — falsch
 *   05.08.   14 x ai_roster_fill          LIGA-DRAFT, EINEN TAG ZU SPAET — falsch
 *
 * Die 14 (und weitere aus spaeteren Laeufen, u. a. drei ins Team des Spielers) stammen aus dem
 * „chunked league-setup completion"-Effekt in `use-foundation-shell-router-body-scope.tsx`. Der
 * sollte einen ABGEBROCHENEN ERST-DRAFT zu Ende bringen und war ueber zwei Bedingungen abgesichert:
 * `gamePhase === "preseason_management"` und „mindestens 4 Teams unter Kadermindestgroesse".
 *
 * Beide greifen am Saisonende NICHT: `preseason_management` ist seit der Saisonende-Kette die
 * erste Station JEDES Saisonendes, und dort stehen nach den KI-Verkaeufen reihenweise Teams unter
 * Minimum. Der Ref-Guard haelt nur pro Browser-Sitzung — jedes Neuladen scharfte ihn neu, daher
 * mehrere Laeufe.
 *
 * Der belastbare Unterschied ist nicht die Phase, sondern ob schon gespielt wurde.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = () =>
  readFileSync(join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8");

/** Der Wachblock des Auto-Finish-Effekts — von seinem Ref bis zum Ende der Bedingung. */
function wachblock(text: string) {
  const start = text.indexOf("const leagueSetupAutoFinishRef");
  expect(start, "Auto-Finish-Effekt nicht gefunden — wurde er umbenannt?").toBeGreaterThan(-1);
  const ende = text.indexOf("const rosterCountByTeamId", start);
  expect(ende).toBeGreaterThan(start);
  return text.slice(start, ende);
}

describe("Liga-Draft laeuft nicht am Saisonende erneut", () => {
  it("bricht ab, sobald ein Spieltagsergebnis vorliegt", () => {
    // Der Kern: ein abgebrochener Erst-Draft hat noch KEIN Ergebnis. Jedes Saisonende hat welche.
    // Ohne diese Zeile ist der Effekt am Saisonende scharf — genau der gemeldete Fehler.
    expect(wachblock(quelle())).toContain("matchdayResults");
  });

  it("verlaesst sich nicht mehr allein auf Phase und Kaderluecke", () => {
    // Beide alten Gates sind am Saisonende erfuellt und trugen den Schutz deshalb nicht. Sie
    // duerfen bleiben (sie schliessen andere Faelle aus), aber nicht als einzige Absicherung.
    const block = wachblock(quelle());
    expect(block).toContain('gameState.gamePhase !== "preseason_management"');
    expect(
      block.includes("matchdayResults"),
      "Phase + Kaderluecke allein reichen nicht — beide sind am Saisonende erfuellt",
    ).toBe(true);
  });

  it("der Grund steht am Code, nicht nur im Commit", () => {
    // Der urspruengliche Kommentar behauptete ausdruecklich, ein „normal mid-season load" sei
    // ausgeschlossen. Genau diese Annahme war falsch und hat den Fehler ueberlebt, weil sie
    // plausibel klang. Wer die Bedingung das naechste Mal anfasst, soll das lesen.
    expect(wachblock(quelle())).toContain("Saisonende");
  });
});
