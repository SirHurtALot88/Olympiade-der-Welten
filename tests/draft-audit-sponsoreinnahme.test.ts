/**
 * GEMELDET (aus dem Sandbox-Lauf, nicht aus einer Bug-Meldung): der Draft-Audit lief seit jeher RED
 * mit „Cash/Fee-Mismatch" und blockierte damit den Sandbox-Lauf nach Saison 1 — also genau die
 * Messung, mit der die Verkaufsseite am Saisonende geprueft wird.
 *
 * BEFUND: es fehlte kein Geld. Die Pruefung rechnete „ausgegeben = Budget minus Cash" und unterstellte
 * damit, dass Cash beim Budget startet und waehrend des Drafts nur sinkt. Sponsoren zahlen aber schon
 * in der Draftphase einen Vorschuss aus (`sponsorPayoutLogs`, Komponente `v4_advance`, rund 35 Prozent
 * — DIESEN VORSCHUSS GIBT ES NICHT MEHR, siehe sponsor-v3-model.ts; die Logs leben aber in laufenden
 * Spielständen weiter, und der Audit muss sie weiterhin richtig lesen
 * der Basiszahlung).
 *
 * GEMESSEN am Sandbox-Lauf (fresh-season-1-1786177854562, 32 Teams): genau 10 Teams hatten eine
 * Auszahlung, und genau diese 10 meldete der Audit als Mismatch. Neun davon auf den Cent identisch
 * mit der Auszahlung:
 *
 *     W-W 17.7  V-V 19.3  V-D 17.8  S-S 17.3  R-L 17.1
 *     N-W 20.1  L-R 18.9  H-R 19.7  D-P 19.5
 *
 * Die uebrigen 22 Teams stimmten exakt (Abweichung 0.00). Nach der Korrektur sind 31 von 32 Teams
 * innerhalb der Toleranz — der Rest ist unten als offener Punkt vermerkt.
 */
import { describe, expect, it } from "vitest";

import { runPhaseAuditDe } from "@/lib/season/long-run-phase-audit";

const TEAM_ID = "T-1";

/** Minimaler Save: ein Team, ein bezahlter Draft-Kauf, optional ein Sponsorenvorschuss. */
function baueSave(sponsorVorschuss: number | null) {
  const spieler = Array.from({ length: 9 }, (_, index) => ({
    id: `player-${index}`,
    name: `Spieler ${index}`,
    marketValue: 10,
    position: "MF",
  }));
  return {
    saveId: "audit-test",
    gameState: {
      season: { id: "season-1", name: "Saison 1" },
      matchdayState: { matchdayId: null },
      teams: [
        {
          teamId: TEAM_ID,
          shortCode: "T-1",
          name: "Testteam",
          // Budget 100, davon 90 verbaut. Ohne Vorschuss blieben 10 Cash; mit Vorschuss 30.
          budget: 100,
          cash: sponsorVorschuss == null ? 10 : 10 + sponsorVorschuss,
        },
      ],
      teamIdentities: [{ teamId: TEAM_ID, playerMin: 8, playerOpt: 9, playerMax: 14 }],
      players: spieler,
      rosters: spieler.map((player, index) => ({
        id: `roster-${index}`,
        teamId: TEAM_ID,
        playerId: player.id,
        purchasePrice: 10,
        salary: 1,
      })),
      transferHistory: spieler.map((player, index) => ({
        id: `transfer-${index}`,
        playerId: player.id,
        seasonId: "season-1",
        transferType: "buy",
        source: "ai_roster_fill",
        fromTeamId: null,
        toTeamId: TEAM_ID,
        fee: 10,
        salary: 1,
      })),
      logs: [],
      seasonState: {
        sponsorPayoutLogs:
          sponsorVorschuss == null
            ? []
            : [
                {
                  id: "sponsor-payout:season-1:T-1:advance",
                  seasonId: "season-1",
                  teamId: TEAM_ID,
                  phase: "base_first",
                  componentId: "v4_advance",
                  cashDelta: sponsorVorschuss,
                },
              ],
      },
    },
  } as never;
}

function cashPruefung(sponsorVorschuss: number | null) {
  const ergebnis = runPhaseAuditDe(baueSave(sponsorVorschuss), "draft");
  return ergebnis.checks.find((eintrag) => eintrag.id === "draft_cash_deducted");
}

describe("Draft-Audit rechnet Sponsoreneinnahmen gegen", () => {
  it("ohne Einnahme passt der Cash-Abzug wie bisher", () => {
    expect(cashPruefung(null)?.status).toBe("PASS");
  });

  it("ein Sponsorenvorschuss ist kein fehlender Cash-Abzug", () => {
    // Der gemessene Fall: 20 Mio auf dem Konto, die nicht vom Budget kommen. Vor der Korrektur
    // meldete der Audit hier RED, obwohl jeder Kauf korrekt bezahlt wurde.
    expect(cashPruefung(20)?.status).toBe("PASS");
  });

  it("ein echter Fehlbetrag wird weiterhin gemeldet", () => {
    // Gegenrichtung: die Korrektur darf die Pruefung nicht zahnlos machen. 40 Mio zusaetzlich bei
    // nur 20 Mio protokollierter Einnahme sind 20 Mio ohne Deckung — das bleibt RED.
    const save = baueSave(20) as unknown as { gameState: { teams: Array<{ cash: number }> } };
    save.gameState.teams[0].cash += 20;
    const ergebnis = runPhaseAuditDe(save as never, "draft");
    expect(ergebnis.checks.find((eintrag) => eintrag.id === "draft_cash_deducted")?.status).toBe("RED");
  });
});
