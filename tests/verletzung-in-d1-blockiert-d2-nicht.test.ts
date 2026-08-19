/**
 * GEMELDET VON CHRIS (Saison 1, Spieltag 8): „wir hängen in Diszi 2 … das darf nicht passieren."
 * Auf dem Schirm stand: „Die Punkte wurden nicht gebucht — Mindestens eine Einsatzliste ist noch
 * unvollständig. · ai lineup apply disabled".
 *
 * DER HAENGER, nachgerechnet statt vermutet:
 *
 * Ein Team mit weniger Spielern als die beiden Disziplinen zusammen fordern darf regelkonform
 * KURZ antreten — „wenn alle Spieler eingesetzt sind die das team zur Verfügung hat ist es auch
 * grün" (Owner-Entscheidung, s. `legacy-matchday-partial-lineup-rule.ts`). Geprueft wurde das,
 * indem die Zahl der aufgestellten Namen mit der Zahl der verfuegbaren Spieler verglichen wurde.
 *
 * Verletzt sich nun einer der Aufgestellten IN D1, laufen die beiden Zahlen auseinander: der
 * abgegebene Entwurf nennt weiterhin alle Namen, verfuegbar ist einer weniger. Die Regel war
 * damit unerfuellbar — nicht nur an diesem Spieltag, sondern dauerhaft.
 *
 * Wirkung: D1 ist gebucht, D2 meldet fuer immer `resolve_status:incomplete_lineups`. Und die
 * Arena kommt da nicht heraus: sie ueberschreibt bestehende Aufstellungen bewusst nicht (sonst
 * buchte sie andere als die gespielten) und laesst Warn-Aufstellungen bewusst nicht zu. Kein
 * Ausweg auf dem Schirm — genau Chris' Lage.
 *
 * Die Regel meint die Schnittmenge: „alle, die es hat" sind die Aufgestellten, die noch spielen
 * koennen. Ein Verletzter ist keiner, den das Team hat.
 */
import { describe, expect, it } from "vitest";

import {
  countSelectedAvailablePlayers,
  isPartialLineupComplete,
} from "@/lib/lineups/legacy-matchday-partial-lineup-rule";

describe("Verletzung in D1 blockiert D2 nicht", () => {
  const AUFGESTELLT = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"];
  const GEFORDERT = 12; // 6 + 6 ueber beide Seiten

  it("ein kurzes Team mit allen verfuegbaren Spielern gilt als vollstaendig", () => {
    const verfuegbar = [...AUFGESTELLT];
    expect(
      isPartialLineupComplete({
        activePlayersCount: verfuegbar.length,
        requiredTotalUniquePlayers: GEFORDERT,
        selectedAvailablePlayerCount: countSelectedAvailablePlayers(AUFGESTELLT, verfuegbar),
      }),
    ).toBe(true);
  });

  it("DER GEMELDETE FALL: eine Verletzung in D1 laesst D2 nicht unvollstaendig werden", () => {
    // p9 hat sich beim D1-Wurf verletzt. Sein Name bleibt im Entwurf stehen — das ist richtig so,
    // die bereits gebuchte D1 rechnet mit ihm weiter (s. #505).
    const verfuegbarNachD1 = AUFGESTELLT.filter((id) => id !== "p9");

    expect(
      isPartialLineupComplete({
        activePlayersCount: verfuegbarNachD1.length,
        requiredTotalUniquePlayers: GEFORDERT,
        selectedAvailablePlayerCount: countSelectedAvailablePlayers(AUFGESTELLT, verfuegbarNachD1),
      }),
      "D2 gilt als unvollstaendig, obwohl das Team alle einsetzt, die es noch hat",
    ).toBe(true);
  });

  it("auch mehrere Ausfaelle an einem Spieltag halten den Spieltag nicht an", () => {
    const verfuegbarNachD1 = AUFGESTELLT.filter((id) => !["p7", "p8", "p9"].includes(id));
    expect(
      isPartialLineupComplete({
        activePlayersCount: verfuegbarNachD1.length,
        requiredTotalUniquePlayers: GEFORDERT,
        selectedAvailablePlayerCount: countSelectedAvailablePlayers(AUFGESTELLT, verfuegbarNachD1),
      }),
    ).toBe(true);
  });

  it("aber ein Team, das jemanden daheim laesst, gilt weiterhin NICHT als vollstaendig", () => {
    // Die Regel darf nicht zum Freibrief werden: hier sind 9 verfuegbar, aufgestellt sind nur 7.
    // Das ist eine Entscheidung des Managers, kein Ausfall — und bleibt unvollstaendig.
    const verfuegbar = [...AUFGESTELLT];
    const nurSieben = AUFGESTELLT.slice(0, 7);
    expect(
      isPartialLineupComplete({
        activePlayersCount: verfuegbar.length,
        requiredTotalUniquePlayers: GEFORDERT,
        selectedAvailablePlayerCount: countSelectedAvailablePlayers(nurSieben, verfuegbar),
      }),
    ).toBe(false);
  });

  it("zaehlt jeden Spieler einmal, auch wenn er auf beiden Seiten steht", () => {
    // Ein Spieler darf in D1 UND D2 antreten; der Entwurf nennt ihn dann zweimal.
    const doppelt = [...AUFGESTELLT, "p1", "p2"];
    const verfuegbar = [...AUFGESTELLT];
    expect(countSelectedAvailablePlayers(doppelt, verfuegbar)).toBe(AUFGESTELLT.length);
  });
});
