/**
 * DIE GuV-SPALTE IM SAISONSTAND WAR IN JEDEM LAUFENDEN SPIELSTAND LEER.
 *
 * Chris am 23.08.2026, nachdem er den GuV-Hover des Team-Profils gezeigt hatte: „in der Teamansicht
 * haben wir ja eine GuV Projektion drinne mit Cash minus Gehälter plus Sponsoren. Das müsste noch
 * mal angepasst werden, dass es auch gleich ist mit dem, was wir im Saisonstand finden." Und auf den
 * Vorschlag hin: „ja bau die drei hovers so und die guv nachbuchung auch."
 *
 * NACHGEMESSEN an den sieben Live-Spielständen: nur EINER (`1hf25q`, abgeschlossen) trug überhaupt
 * `guv`/`guvPosten`. In den sechs laufenden — Chris' eigenem `swnjlk` eingeschlossen — fehlten beide
 * Felder, und die Spalte blieb leer. Daneben zeigte das Team-Profil eine eigene Zahl aus einer
 * eigenen, kürzeren Formel: in `1hf25q` weichen 5 von 6 geprüften Teams ab, bei D-L um 11,1 Mio und
 * mit Vorzeichenwechsel (Saisonstand +8,8, Team-Profil −2,3).
 *
 * URSACHE war ein Riegel in `zieheSaisonstandGuvNach`: Teams ohne gespeicherte Postenliste blieben
 * unberührt, „die Liste entsteht bei der Saisonende-Buchung, und wo sie fehlt, gab es diese Buchung
 * nicht." Der Riegel schützte nicht vor einer falschen Zahl — er verhinderte die richtige.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonGuv } from "@/lib/finance/season-end-guv";
import { zieheSaisonstandGuvNach, zieheSaisonstandGuvNachSpieltag } from "@/lib/finance/season-guv-nachbuchung";

/**
 * Ein LAUFENDER Spielstand, wie Chris ihn hat: Saisonstand vorhanden, aber ohne `guv`/`guvPosten` —
 * die entstehen bisher erst am Saisonende.
 */
function laufenderSpielstand(): GameState {
  return {
    season: { id: "season-2" },
    gamePhase: "season_active",
    teams: [{ teamId: "L-K", cash: -31.2 }],
    rosters: [],
    players: [],
    transferHistory: [],
    seasonState: {
      seasonId: "season-2",
      standings: {
        "L-K": { points: 88, rank: 19 },
      },
    },
  } as unknown as GameState;
}

/** Derselbe Stand, aber mit bereits gespeicherter (veralteter) Zeile. */
function standMitAlterZeile(): GameState {
  const alt = buildSeasonGuv({
    teamId: "L-K",
    sponsorCash: 31.6,
    apronNetto: 2.11,
    apronRank: 19,
    apronGebucht: false,
    objectiveCashDelta: 3,
    salaryTotal: 67.98,
  });
  const basis = laufenderSpielstand();
  return {
    ...basis,
    seasonState: {
      ...basis.seasonState,
      standings: {
        "L-K": { points: 88, rank: 19, guv: alt.guv + 99, guvPosten: alt.posten },
      },
    },
  } as unknown as GameState;
}

describe("GuV erscheint auch in der laufenden Saison", () => {
  it("schreibt guv und guvPosten auch dort, wo noch nie eine Zeile stand", () => {
    const vorher = laufenderSpielstand();
    const zeileVorher = vorher.seasonState.standings!["L-K"];
    // Die Ausgangslage ist echt — sonst prueft der Fall nichts.
    expect(zeileVorher?.guv).toBeUndefined();
    expect(zeileVorher?.guvPosten).toBeUndefined();

    const { gameState, geaenderteTeams } = zieheSaisonstandGuvNach(vorher);
    expect(geaenderteTeams).toContain("L-K");
    const zeile = gameState.seasonState.standings!["L-K"];
    expect(typeof zeile?.guv).toBe("number");
    expect(Array.isArray(zeile?.guvPosten)).toBe(true);
    expect((zeile?.guvPosten ?? []).length).toBeGreaterThan(0);
  });

  it("zieht eine veraltete Zeile weiterhin nach — das alte Verhalten bleibt", () => {
    const { gameState, geaenderteTeams } = zieheSaisonstandGuvNach(standMitAlterZeile());
    expect(geaenderteTeams).toContain("L-K");
    const zeile = gameState.seasonState.standings!["L-K"];
    // Die +99 aus der Fixture darf nicht ueberleben.
    expect(zeile?.guv).not.toBe(standMitAlterZeile().seasonState.standings!["L-K"]?.guv);
  });

  it("bleibt idempotent — der zweite Lauf aendert nichts mehr", () => {
    const einmal = zieheSaisonstandGuvNach(laufenderSpielstand());
    const zweimal = zieheSaisonstandGuvNach(einmal.gameState);
    expect(zweimal.geaenderteTeams).toEqual([]);
    expect(zweimal.gameState).toBe(einmal.gameState);
  });

  it("laesst einen Saisonstand ohne Teams unberuehrt", () => {
    const leer = { ...laufenderSpielstand(), seasonState: { seasonId: "season-2", standings: {} } } as GameState;
    expect(zieheSaisonstandGuvNach(leer).geaenderteTeams).toEqual([]);
  });

  it("laesst die Spieltags-Variante eine Buchung nicht reissen", () => {
    // Ein Stand, auf dem die Ableitung stolpert, darf die Spieltags-Buchung nicht mitnehmen.
    const kaputt = { seasonState: { standings: { "L-K": { points: 1 } } } } as unknown as GameState;
    expect(() => zieheSaisonstandGuvNachSpieltag(kaputt)).not.toThrow();
  });

  it("schreibt ueber die Spieltags-Variante dieselbe Zeile wie der direkte Aufruf", () => {
    const direkt = zieheSaisonstandGuvNach(laufenderSpielstand()).gameState;
    const ueberSpieltag = zieheSaisonstandGuvNachSpieltag(laufenderSpielstand());
    expect(ueberSpieltag.seasonState.standings!["L-K"]?.guv).toBe(
      direkt.seasonState.standings!["L-K"]?.guv,
    );
  });
});
