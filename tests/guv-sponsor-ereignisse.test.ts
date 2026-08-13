import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { SEASON_GUV_POSTEN_KEYS, buildSeasonGuv, buildSeasonGuvHoverText } from "@/lib/finance/season-end-guv";
import { getSponsorEventCashByTeam } from "@/lib/sponsor/sponsor-event-cash-source";

/**
 * GEMELDET VON CHRIS: „klauseln bitte mit in die GuV hinzufügen wenn zutreffend!"
 *
 * BEFUND: `maybeGenerateSponsorEvents` verrechnet mitten in der Saison sofort auf `team.cash` —
 * Aktions-Bonus, ausgelöste Vertragsklausel, Partner-Reibung. In der GuV standen sie in KEINEM
 * Posten: die Sponsor-Zeile liest `sponsorPayoutLogs` und die Vertragskomponenten, nie
 * `sponsorEvents`. Am Abbild `1hf25q` betraf das 23 von 32 Teams; L-K verlor über zwei Klauseln
 * 4,0 C, die niemand in der Rechnung sah.
 */

function baueSpielstand(events: Array<Partial<{ teamId: string; seasonId: string; cashDelta: number; status: string; eventType: string }>>): GameState {
  return {
    season: { id: "season-2" },
    teams: [{ teamId: "L-K" }, { teamId: "T-G" }],
    seasonState: {
      sponsorEvents: events.map((event, index) => ({
        eventId: `sponsor-event:${index}`,
        saveId: "save",
        seasonId: event.seasonId ?? "season-2",
        teamId: event.teamId ?? "L-K",
        matchday: index + 1,
        eventType: event.eventType ?? "clause_trigger",
        sponsorName: "MAN Truck & Bus",
        cashDelta: event.cashDelta ?? -2,
        status: event.status ?? "resolved",
        createdAt: "2026-08-09T00:00:00.000Z",
        message: "…",
      })),
    },
  } as unknown as GameState;
}

describe("Sponsor-Ereignisse · nur was verrechnet wurde", () => {
  it("summiert die verrechneten Ereignisse der laufenden Saison vorzeichenecht", () => {
    // L-Ks echter Fall: zwei ausgelöste Klauseln, Spieltag 4 und 10.
    const quelle = getSponsorEventCashByTeam(baueSpielstand([{ cashDelta: -2 }, { cashDelta: -2 }]));
    expect(quelle.byTeamId.get("L-K")).toBe(-4);
    expect(quelle.anzahlByTeamId.get("L-K")).toBe(2);
  });

  it("rechnet Bonus und Malus gegeneinander", () => {
    const quelle = getSponsorEventCashByTeam(
      baueSpielstand([{ cashDelta: 5, eventType: "activation_bonus" }, { cashDelta: -2 }]),
    );
    expect(quelle.byTeamId.get("L-K")).toBe(3);
  });

  it("zaehlt abgelehnte und offene Ereignisse NICHT", () => {
    // `dismissed` heisst: das Team hat abgelehnt, es floss nie Geld. `open` gibt es nur in
    // Altspielstaenden vor dem Auto-Settle — auch dort ist noch nichts gebucht.
    const quelle = getSponsorEventCashByTeam(
      baueSpielstand([{ cashDelta: -2, status: "dismissed" }, { cashDelta: -2, status: "open" }]),
    );
    expect(quelle.byTeamId.get("L-K")).toBeUndefined();
  });

  it("nimmt nur die laufende Saison", () => {
    const quelle = getSponsorEventCashByTeam(baueSpielstand([{ cashDelta: -2, seasonId: "season-1" }]));
    expect(quelle.byTeamId.get("L-K")).toBeUndefined();
  });
});

describe("GuV · der Posten steht immer da", () => {
  it("fuehrt Sponsor-Ereignisse als eigenen Posten direkt hinter dem Sponsor", () => {
    const guv = buildSeasonGuv({ teamId: "L-K", sponsorCash: 52.1, sponsorEventCash: -4, sponsorEventCount: 2, salaryTotal: 68 });
    expect(guv.posten.map((entry) => entry.key)).toEqual([...SEASON_GUV_POSTEN_KEYS]);
    const zeile = guv.posten.find((entry) => entry.key === "sponsorereignisse");
    expect(zeile?.amount).toBe(-4);
    expect(zeile?.counted).toBe(true);
    expect(zeile?.note).toBe("2 verrechnet");
  });

  it("steht auch bei 0 da und sagt, dass es keine gab", () => {
    // Chris' Regel fuer jeden GuV-Posten: „bitte alles was berechnet wird auch in das Hover rein
    // bringen damit man es sieht SELBST WENN ES 0 IST."
    const guv = buildSeasonGuv({ teamId: "T-G", sponsorCash: 72.1, salaryTotal: 59.3 });
    const zeile = guv.posten.find((entry) => entry.key === "sponsorereignisse");
    expect(zeile?.amount).toBe(0);
    expect(zeile?.note).toBe("keine in dieser Saison");
    expect(buildSeasonGuvHoverText(guv)).toContain("Sponsor-Ereignisse (keine in dieser Saison): 0");
  });

  it("zaehlt in die Summe", () => {
    const ohne = buildSeasonGuv({ teamId: "L-K", sponsorCash: 52.1, salaryTotal: 68 });
    const mit = buildSeasonGuv({ teamId: "L-K", sponsorCash: 52.1, sponsorEventCash: -4, sponsorEventCount: 2, salaryTotal: 68 });
    expect(Number((ohne.guv - mit.guv).toFixed(1))).toBe(4);
  });
});
