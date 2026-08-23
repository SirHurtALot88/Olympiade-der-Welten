import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getApronCashByTeam } from "@/lib/finance/apron-settlement-cash-source";
import { buildSeasonGuv } from "@/lib/finance/season-end-guv";
import { zieheSaisonstandGuvNach } from "@/lib/finance/season-guv-nachbuchung";

/**
 * GEMELDET VON CHRIS an der Historie von L-K: „warum so viel minus in der aktiven season?"
 *
 * BEFUND: `standings[team].guvPosten` wird in `writeLocalCashPrizeApply` eingefroren — VOR den
 * Buchungen. Am Abbild `1hf25q` lagen zwischen dem Einfrieren und dem letzten gebuchten Posten
 * 16 Sekunden: Sponsor 0,5 s danach, Apron 0,6 s danach, Vorstandsziele 16,2 s danach. Die Zeile
 * behauptete deshalb dauerhaft „Apron: Hochrechnung, noch nicht gebucht" (und liess ihn aus der
 * Summe) und trug bei den Zielen den Vorschauwert (+3,0), wo −1,0 gebucht wurde.
 *
 * Diese Tests halten zwei Dinge fest: der Apron nimmt nach der Buchung den BELEG, und die
 * gespeicherte Zeile wird aus der gemeinsamen Rechnung neu abgeleitet statt zu veralten.
 */

function baueSpielstand(input: {
  apronLogs?: Array<{ teamId: string; cashDelta: number; kind: "levy" | "payout" }>;
  gespeicherteGuv?: { guv: number; apronCounted: boolean; apronAmount: number };
}): GameState {
  const eingefroren = buildSeasonGuv({
    teamId: "L-K",
    sponsorCash: 31.6,
    apronNetto: input.gespeicherteGuv?.apronAmount ?? 2.11,
    apronRank: 19,
    apronGebucht: input.gespeicherteGuv?.apronCounted ?? false,
    objectiveCashDelta: 3,
    salaryTotal: 67.98,
  });

  return {
    season: { id: "season-2" },
    teams: [{ teamId: "L-K", cash: -31.2 }],
    rosters: [],
    players: [],
    transferHistory: [],
    seasonState: {
      standings: {
        "L-K": { points: 88, rank: 19, guv: eingefroren.guv, guvPosten: eingefroren.posten },
      },
      apronSettlementLogs: (input.apronLogs ?? []).map((log, index) => ({
        id: `apron-settlement:season-2:${log.teamId}:${index}`,
        saveId: "save",
        seasonId: "season-2",
        teamId: log.teamId,
        phase: "season_end",
        kind: log.kind,
        cashDelta: log.cashDelta,
        action: "apply",
        createdAt: "2026-08-10T18:08:29.224Z",
      })),
    },
  } as unknown as GameState;
}

describe("Apron · Beleg vor Nachrechnung", () => {
  it("liest den gebuchten Betrag aus dem Log, nicht aus der Hochrechnung", () => {
    const quelle = getApronCashByTeam(
      baueSpielstand({
        apronLogs: [
          { teamId: "L-K", cashDelta: 2.4, kind: "payout" },
          // Zweite Zeile desselben Teams: Ausgleich und Abgabe werden vorzeichenecht summiert.
          { teamId: "L-K", cashDelta: -0.3, kind: "levy" },
        ],
      }),
    );
    expect(quelle.gebucht).toBe(true);
    expect(quelle.quelle).toBe("beleg");
    expect(quelle.byTeamId.get("L-K")).toBe(2.1);
  });

  it("gibt einem Team ohne eigenen Log die gebuchte 0, sobald die Saison abgerechnet ist", () => {
    // Der Apron ist ein Umverteilungstopf — wer weder zahlt noch bekommt, hat keinen Log. Das ist
    // eine gebuchte Null, kein fehlender Wert.
    const gameState = baueSpielstand({ apronLogs: [{ teamId: "T-G", cashDelta: 5, kind: "payout" }] });
    expect(getApronCashByTeam(gameState).byTeamId.get("L-K")).toBe(0);
  });

  it("bleibt ohne Buchung bei der Hochrechnung", () => {
    const quelle = getApronCashByTeam(baueSpielstand({ apronLogs: [] }));
    expect(quelle.gebucht).toBe(false);
    expect(quelle.quelle).toBe("projektion");
    expect(quelle.byTeamId.size).toBe(0);
  });
});

describe("Saisonstand-GuV · die gespeicherte Zeile veraltet nicht mehr", () => {
  it("zieht die eingefrorene Zeile auf den gebuchten Stand", () => {
    const vorher = baueSpielstand({ apronLogs: [{ teamId: "L-K", cashDelta: 2.4, kind: "payout" }] });
    const apronVorher = (vorher.seasonState.standings?.["L-K"]?.guvPosten ?? []).find((e) => e.key === "apron");
    // Gezaehlt wird der Apron in beiden Zustaenden (Chris: „DAS MUSS MIT REIN!"). Was die Buchung
    // aendert, ist die Notiz und der Betrag — aus der Hochrechnung wird der abgerechnete Wert.
    expect(apronVorher?.counted).toBe(true);
    expect(apronVorher?.note).toContain("noch nicht gebucht");

    const { gameState, geaenderteTeams } = zieheSaisonstandGuvNach(vorher);
    expect(geaenderteTeams).toEqual(["L-K"]);
    const apron = (gameState.seasonState.standings?.["L-K"]?.guvPosten ?? []).find((e) => e.key === "apron");
    expect(apron?.counted).toBe(true);
    expect(apron?.note).toBe("gebucht");
    expect(apron?.amount).toBe(2.4);
  });

  it("ist idempotent — der zweite Lauf aendert nichts mehr", () => {
    const ersterLauf = zieheSaisonstandGuvNach(
      baueSpielstand({ apronLogs: [{ teamId: "L-K", cashDelta: 2.4, kind: "payout" }] }),
    );
    expect(ersterLauf.geaenderteTeams.length).toBeGreaterThan(0);
    const zweiterLauf = zieheSaisonstandGuvNach(ersterLauf.gameState);
    expect(zweiterLauf.geaenderteTeams).toEqual([]);
    expect(zweiterLauf.gameState).toBe(ersterLauf.gameState);
  });

  it("fasst Teams ohne gespeicherte Postenliste nicht an", () => {
    // Die Liste entsteht bei der Saisonende-Buchung. Wo sie fehlt, gab es diese Buchung nicht —
    // dann waere ein geschriebener Wert eine Behauptung ueber eine Abrechnung, die nie stattfand.
    const ohnePosten = baueSpielstand({ apronLogs: [{ teamId: "L-K", cashDelta: 2.4, kind: "payout" }] });
    delete (ohnePosten.seasonState.standings!["L-K"] as { guvPosten?: unknown }).guvPosten;
    const ergebnis = zieheSaisonstandGuvNach(ohnePosten);
    expect(ergebnis.geaenderteTeams).toEqual([]);
    expect(ergebnis.gameState).toBe(ohnePosten);
  });
});
