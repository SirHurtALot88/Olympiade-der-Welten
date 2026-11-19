import { describe, expect, it } from "vitest";

import { countExpiringContracts } from "@/app/foundation/season-v2/FoundationSeasonFinalePanel";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * ABNAHME 19.11., Fehler F7 (docs/design/abnahme-saison-19-11.md): nach dem letzten Spieltag zeigte das Saisonfinale
 * „Verträge — nichts läuft aus · erledigt“, obwohl alle elf Draft-Verträge des Mensch-Teams mit Saison 1 endeten — der
 * Countdown sinkt erst mit der Alterung („Verträge öffnen“). Gezählt wird jetzt nach der Endsaison, wie auf der Startseite.
 */
function stand(phase: string, eintraege: Array<{ contractLength: number; contractEndSeasonNumber?: number }>): GameState {
  return {
    season: { id: "season-1", name: "Season 1", matchdayIds: [] },
    gamePhase: phase,
    rosters: eintraege.map((e, i) => ({ id: `r${i}`, teamId: "M-M", playerId: `p${i}`, salary: 1, ...e })),
  } as unknown as GameState;
}

describe("Saisonfinale: auslaufende Verträge nach der Endsaison", () => {
  it("vor der Alterung (Countdown noch 1, Endsaison 1): läuft aus", () => {
    expect(countExpiringContracts(stand("season_completed", [{ contractLength: 1, contractEndSeasonNumber: 1 }, { contractLength: 1 }]), "M-M")).toBe(2);
  });

  it("nach der Alterung (Countdown 0): läuft weiterhin aus — keine Doppelzählung, kein Sprung", () => {
    expect(countExpiringContracts(stand("season_end_management", [{ contractLength: 0, contractEndSeasonNumber: 1 }, { contractLength: 0 }]), "M-M")).toBe(2);
  });

  it("Mehrjahresvertrag und Verlängerung (Endsaison 2) laufen nicht aus", () => {
    expect(countExpiringContracts(stand("season_completed", [{ contractLength: 2, contractEndSeasonNumber: 2 }, { contractLength: 3 }]), "M-M")).toBe(0);
    expect(countExpiringContracts(stand("season_end_management", [{ contractLength: 1, contractEndSeasonNumber: 2 }]), "M-M")).toBe(0);
  });

  it("ohne Team: 0", () => {
    expect(countExpiringContracts(stand("season_completed", [{ contractLength: 1 }]), null)).toBe(0);
  });
});
