/**
 * DIE MERKLISTE — Lesezeichen auf Teams und Spieler.
 *
 * GEWUENSCHT (Chris): „man sollte sich aussuchen können welche teams getrackt werden, dass man so
 * ne wishlist option bei teams und spielern hat wie so lesezeichen und sich die dann noch mal
 * angucken kann · in der Arena dann die angezeigt werden die ich gewishlistet habe zusätzlich zu
 * den menschlichen teams".
 *
 * WAS HIER FESTGEHALTEN WIRD, ist genau das, was beim Nachbauen kaputtgehen wuerde:
 *
 *   - Die Liste haengt am BESITZER. Im Koop darf Frankys Lesezeichen nicht in Chris' Liste
 *     auftauchen und schon gar nicht seins ueberschreiben.
 *   - Sie ueberlebt den Saisonwechsel. Deshalb steht sie auf der obersten Ebene des Spielstands
 *     und nicht im `seasonState` — ein Test dafuer ist die Stelle, an der ein spaeterer Umzug
 *     nach `seasonState` auffiele.
 *   - Der Umschalter ist idempotent. Die Oberflaeche darf zweimal dasselbe senden, ohne dass ein
 *     zweiter Eintrag entsteht oder die Reihenfolge springt.
 *   - Die eigenen Teams lassen sich nicht abwaehlen. Sie sind der Ausgangspunkt, keine Auswahl.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  istGemerkt,
  leseArenaTeamAuswahl,
  leseGemerkteIds,
  leseMerkliste,
  merke,
  schalteMerkliste,
  vergiss,
} from "@/lib/merkliste/merkliste-service";

const CHRIS = "owner-chris";
const FRANKY = "owner-franky";

function leererStand(): GameState {
  return { merkliste: [] } as unknown as GameState;
}

describe("Merkliste", () => {
  it("merkt ein Team und findet es wieder", () => {
    const stand = merke({ gameState: leererStand(), ownerId: CHRIS, art: "team", id: "D-P", jetzt: "2026-08-23T08:00:00.000Z" });
    expect(istGemerkt(stand, { ownerId: CHRIS, art: "team", id: "D-P" })).toBe(true);
    expect([...leseGemerkteIds(stand, CHRIS, "team")]).toEqual(["D-P"]);
  });

  it("haelt Teams und Spieler auseinander", () => {
    // Dieselbe ID koennte theoretisch in beiden Raeumen vorkommen; die Art gehoert deshalb in den
    // Vergleich und nicht nur in die Anzeige.
    let stand = merke({ gameState: leererStand(), ownerId: CHRIS, art: "team", id: "X-1" });
    stand = merke({ gameState: stand, ownerId: CHRIS, art: "spieler", id: "X-1" });
    expect(leseMerkliste(stand, CHRIS)).toHaveLength(2);
    expect([...leseGemerkteIds(stand, CHRIS, "team")]).toEqual(["X-1"]);
    expect([...leseGemerkteIds(stand, CHRIS, "spieler")]).toEqual(["X-1"]);

    stand = vergiss({ gameState: stand, ownerId: CHRIS, art: "team", id: "X-1" });
    expect(istGemerkt(stand, { ownerId: CHRIS, art: "team", id: "X-1" })).toBe(false);
    expect(istGemerkt(stand, { ownerId: CHRIS, art: "spieler", id: "X-1" })).toBe(true);
  });

  it("trennt die Listen zweier Besitzer vollstaendig", () => {
    let stand = merke({ gameState: leererStand(), ownerId: CHRIS, art: "team", id: "D-P" });
    stand = merke({ gameState: stand, ownerId: FRANKY, art: "team", id: "T-T" });

    expect([...leseGemerkteIds(stand, CHRIS, "team")]).toEqual(["D-P"]);
    expect([...leseGemerkteIds(stand, FRANKY, "team")]).toEqual(["T-T"]);

    // Und Frankys Entfernen darf Chris' Eintrag nicht anfassen — das ist der Fall, der im Koop
    // wehtut und den man ohne zwei Besitzer im Test nie sieht.
    stand = vergiss({ gameState: stand, ownerId: FRANKY, art: "team", id: "D-P" });
    expect(istGemerkt(stand, { ownerId: CHRIS, art: "team", id: "D-P" })).toBe(true);
  });

  it("behandelt Solo (ohne Anmeldung) als eigenen, einzigen Eimer", () => {
    let stand = merke({ gameState: leererStand(), ownerId: null, art: "team", id: "D-P" });
    expect(istGemerkt(stand, { ownerId: null, art: "team", id: "D-P" })).toBe(true);
    // Ein angemeldeter Besitzer sieht den Solo-Eintrag NICHT — sonst liefen beide Welten
    // ineinander, sobald jemand die Anmeldung einschaltet.
    expect(istGemerkt(stand, { ownerId: CHRIS, art: "team", id: "D-P" })).toBe(false);
    stand = vergiss({ gameState: stand, ownerId: null, art: "team", id: "D-P" });
    expect(leseMerkliste(stand, null)).toHaveLength(0);
  });

  it("ist idempotent: zweimal merken legt keinen zweiten Eintrag an und verschiebt nichts", () => {
    const einmal = merke({
      gameState: leererStand(),
      ownerId: CHRIS,
      art: "team",
      id: "D-P",
      jetzt: "2026-08-23T08:00:00.000Z",
    });
    const zweimal = merke({
      gameState: einmal,
      ownerId: CHRIS,
      art: "team",
      id: "D-P",
      jetzt: "2026-08-23T09:00:00.000Z",
    });
    expect(leseMerkliste(zweimal, CHRIS)).toHaveLength(1);
    // Der Zeitstempel bleibt der erste: die Liste steht nach Anlage-Reihenfolge, und ein zweiter
    // Klick darf einen Eintrag nicht nach oben schieben.
    expect(leseMerkliste(zweimal, CHRIS)[0]?.angelegtAm).toBe("2026-08-23T08:00:00.000Z");
  });

  it("ist idempotent: etwas zu vergessen, das nicht da ist, aendert nichts", () => {
    const stand = leererStand();
    expect(vergiss({ gameState: stand, ownerId: CHRIS, art: "team", id: "D-P" })).toBe(stand);
  });

  it("schaltet hin und her", () => {
    const hin = schalteMerkliste({ gameState: leererStand(), ownerId: CHRIS, art: "spieler", id: "p-1" });
    expect(hin.gemerkt).toBe(true);
    const zurueck = schalteMerkliste({ gameState: hin.gameState, ownerId: CHRIS, art: "spieler", id: "p-1" });
    expect(zurueck.gemerkt).toBe(false);
    expect(leseMerkliste(zurueck.gameState, CHRIS)).toHaveLength(0);
  });

  it("ignoriert eine leere ID, statt einen Geistereintrag anzulegen", () => {
    const stand = leererStand();
    expect(merke({ gameState: stand, ownerId: CHRIS, art: "team", id: "   " })).toBe(stand);
  });

  it("liegt auf der obersten Ebene des Spielstands, nicht im seasonState", () => {
    // Der halbe Zweck der Liste ist, den Saisonwechsel zu ueberleben. Waere sie im seasonState,
    // waere sie danach weg — und genau das faellt sonst erst im Spiel auf.
    const stand = merke({ gameState: leererStand(), ownerId: CHRIS, art: "team", id: "D-P" });
    expect(Array.isArray(stand.merkliste)).toBe(true);
    expect((stand as unknown as { seasonState?: { merkliste?: unknown } }).seasonState?.merkliste).toBeUndefined();
  });
});

describe("Arena-Auswahl", () => {
  it("zeigt die menschlichen Teams UND die gemerkten", () => {
    let stand = merke({ gameState: leererStand(), ownerId: CHRIS, art: "team", id: "D-P" });
    stand = merke({ gameState: stand, ownerId: CHRIS, art: "team", id: "T-T" });

    const auswahl = leseArenaTeamAuswahl({ gameState: stand, ownerId: CHRIS, menschlicheTeamIds: ["V-W", "M-M"] });
    expect([...auswahl].sort()).toEqual(["D-P", "M-M", "T-T", "V-W"]);
  });

  it("zaehlt ein gemerktes eigenes Team nicht doppelt", () => {
    const stand = merke({ gameState: leererStand(), ownerId: CHRIS, art: "team", id: "V-W" });
    const auswahl = leseArenaTeamAuswahl({ gameState: stand, ownerId: CHRIS, menschlicheTeamIds: ["V-W"] });
    expect([...auswahl]).toEqual(["V-W"]);
  });

  it("laesst die eigenen Teams nicht abwaehlen", () => {
    // Es gibt keinen Weg, ein menschlich gefuehrtes Team aus der Arena-Auswahl zu entfernen:
    // die Merkliste kann nur HINZUFUEGEN. Das ist Absicht — die eigenen Teams sind der
    // Ausgangspunkt und keine Auswahl.
    const stand = vergiss({ gameState: leererStand(), ownerId: CHRIS, art: "team", id: "V-W" });
    const auswahl = leseArenaTeamAuswahl({ gameState: stand, ownerId: CHRIS, menschlicheTeamIds: ["V-W"] });
    expect([...auswahl]).toEqual(["V-W"]);
  });

  it("nimmt die Merkliste eines anderen Besitzers nicht mit in die Arena", () => {
    const stand = merke({ gameState: leererStand(), ownerId: FRANKY, art: "team", id: "T-T" });
    const auswahl = leseArenaTeamAuswahl({ gameState: stand, ownerId: CHRIS, menschlicheTeamIds: ["V-W"] });
    expect([...auswahl]).toEqual(["V-W"]);
  });

  it("kommt ohne jede Merkliste aus — dann sind es genau die menschlichen Teams", () => {
    const auswahl = leseArenaTeamAuswahl({
      gameState: {} as unknown as GameState,
      ownerId: CHRIS,
      menschlicheTeamIds: ["V-W", "M-M"],
    });
    expect([...auswahl].sort()).toEqual(["M-M", "V-W"]);
  });
});
