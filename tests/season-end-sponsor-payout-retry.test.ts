import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getSeasonEndPayoutStatus,
  hasCashPrizeApplyLog,
  hasSeasonEndSponsorPayout,
} from "@/lib/season/season-end-sponsor-payout-status";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

function gameState(input: { applyLog?: boolean; payout?: boolean }) {
  return {
    season: { id: "season-1" },
    seasonState: {
      cashPrizeApplyLogs: input.applyLog ? [{ seasonId: "season-1" }] : [],
      sponsorPayoutLogs: input.payout
        ? [{ seasonId: "season-1", teamId: "C-C", phase: "season_end" }]
        : [{ seasonId: "season-1", teamId: "C-C", phase: "matchday" }],
    },
  } as never;
}

/**
 * GEMELDET: „ich habe den button gedrueckt vom saisonuebergang! Aber er hat nicht
 * funktioniert" — und danach: „reaktiviere den button dass ich ihn noch mal druecken
 * kann wenn er gefixt wurde".
 *
 * Der Schritt schrieb frueher nur Tabellen-Spalten und ein Audit-Log; das Sponsorgeld
 * floss nicht. Seit #282 bucht er wirklich — aber Spielstaende, in denen er VORHER lief,
 * tragen ein Audit-Log ohne Zahlung. Genau diese Kombination galt an zwei Stellen als
 * „erledigt" und sperrte die Nachbuchung aus:
 *
 *   1. Die Oberflaeche fragte „gibt es ein `cashPrizeApplyLog`?" → Knopf verschwunden.
 *   2. Der Dienst wertete dasselbe Log als Duplikat → `canApply: false`.
 *
 * Am Spielstand des Melders gemessen (Spieltag 10, `season_completed`,
 * `cashPrizeApplyLogs: 1`, `sponsorPayoutLogs(season_end): 0`):
 *
 *   origin/main : canApply=false, duplicate_apply_for_save_season_block
 *   mit Fix     : canApply=true,  Warnung apply_log_without_sponsor_payout_retry
 */
describe("Saisonende: „angestossen\" und „bezahlt\" sind verschiedene Zustaende", () => {
  it("unterscheidet die beiden Fragen ueberhaupt erst", () => {
    const stale = gameState({ applyLog: true, payout: false });
    expect(hasCashPrizeApplyLog(stale, "season-1")).toBe(true);
    expect(hasSeasonEndSponsorPayout(stale, "season-1")).toBe(false);
  });

  it("meldet den gemeldeten Spielstand als nachholbar, nicht als erledigt", () => {
    expect(getSeasonEndPayoutStatus(gameState({ applyLog: true, payout: false }), "season-1")).toBe("pending_payout");
  });

  it("meldet erledigt erst, wenn das Geld geflossen ist", () => {
    expect(getSeasonEndPayoutStatus(gameState({ applyLog: true, payout: true }), "season-1")).toBe("paid");
  });

  it("meldet offen, solange nichts angestossen wurde", () => {
    expect(getSeasonEndPayoutStatus(gameState({ applyLog: false, payout: false }), "season-1")).toBe("open");
  });

  it("zaehlt eine Spieltags-Zahlung nicht als Saisonende-Abrechnung", () => {
    // `sponsorPayoutLogs` enthaelt auch `phase: "matchday"` — die beantwortet eine
    // andere Frage und darf den Saisonende-Schritt nicht als erledigt markieren.
    const onlyMatchdayPayout = gameState({ applyLog: true, payout: false });
    expect(hasSeasonEndSponsorPayout(onlyMatchdayPayout, "season-1")).toBe(false);
  });

  it("haelt eine fremde Saison auseinander", () => {
    const other = {
      season: { id: "season-2" },
      seasonState: {
        cashPrizeApplyLogs: [{ seasonId: "season-1" }],
        sponsorPayoutLogs: [{ seasonId: "season-1", teamId: "C-C", phase: "season_end" }],
      },
    } as never;
    expect(getSeasonEndPayoutStatus(other, "season-2")).toBe("open");
  });
});

describe("Duplikat-Riegel: ein Log ohne Zahlung sperrt die Buchung nicht mehr", () => {
  const SERVICE = read("lib/season/cash-prize-apply-service.ts");

  it("macht die Sperre von der tatsaechlichen Zahlung abhaengig", () => {
    expect(SERVICE).toContain(
      "const duplicateDetected = existingAuditLog != null && (phase === \"matchday\" || sponsorPayoutSettled);",
    );
    expect(SERVICE).toContain("hasSeasonEndSponsorPayout(resolveLocalSave(persistence, scope.saveId).gameState");
  });

  it("holt still nichts nach, sondern weist die Wiederholung aus", () => {
    expect(SERVICE).toContain('warnings.push("apply_log_without_sponsor_payout_retry")');
  });

  /**
   * Der Riegel war NIE die eigentliche Wache gegen Doppelbuchung — das ist
   * `applySponsorSettlement` selbst, das je Team einen `season_end`-Eintrag prueft.
   * Diese Erwartung haelt fest, dass diese Wache steht; sonst waere die Lockerung oben
   * gefaehrlich.
   */
  it("laesst die echte Doppelbuchungs-Sperre unberuehrt", () => {
    const settlement = read("lib/sponsor/sponsor-settlement-service.ts");
    expect(settlement).toContain("function hasSeasonEndPayoutLog(gameState: GameState, seasonId: string, teamId: string)");
    expect(settlement).toContain('log.phase === "season_end"');
    // Und der Saisonabschluss ueberspringt seinerseits bei vorhandener Zahlung.
    const completion = read("lib/season/season-completion-service.ts");
    expect(completion).toContain("existingSponsorEndPayout");
    expect(completion).toContain("!existingSponsorEndPayout");
  });

  it("laesst den Spieltags-Pfad gesperrt — dort wird nie gebucht", () => {
    expect(SERVICE).toContain('phase === "matchday" || sponsorPayoutSettled');
  });
});

describe("Oberflaeche: der Knopf kommt zurueck, solange das Geld fehlt", () => {
  const PANEL = read("app/foundation/season-v2/FoundationSeasonFinalePanel.tsx");
  const BODY = read("app/foundation/FoundationShellRouterBody.tsx");

  it("fragt nach der Zahlung statt nach dem Audit-Log", () => {
    expect(BODY).toContain("seasonEndPayoutStatus={getSeasonEndPayoutStatus(gameState, gameState.season.id)}");
    expect(BODY).not.toContain("prizeApplied={(gameState.seasonState.cashPrizeApplyLogs");
  });

  it("bietet im Nachhol-Fall einen Knopf an", () => {
    expect(PANEL).toContain('seasonEndPayoutStatus === "pending_payout" ? "Jetzt nachbuchen"');
    // „done" nur bei tatsaechlicher Zahlung — sonst waere der Knopf wieder weg.
    expect(PANEL).toContain('seasonEndPayoutStatus === "paid" ? "done"');
    expect(PANEL).toContain('seasonEndPayoutStatus === "paid" || readOnly\n          ? null');
  });

  it("sagt im Nachhol-Fall, was passiert ist", () => {
    expect(PANEL).toContain("das Geld ist nie geflossen");
  });

  it("behaelt den Nur-Lesen-Riegel", () => {
    expect(PANEL.replace(/\s+/g, " ")).toContain('seasonEndPayoutStatus === "paid" || readOnly ? null');
  });
});
