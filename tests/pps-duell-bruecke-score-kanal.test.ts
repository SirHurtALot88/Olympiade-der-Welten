import { describe, expect, it } from "vitest";

import { calculateRawDisciplineScore } from "@/lib/player-formulas/discipline-rating-engine";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import { resolveDisciplineWeightProfile } from "@/lib/player-generator/spiel-eignung-overrides";
import { playerGeneratorAttributeKeys, type OfficialDisciplineWeightId } from "@/lib/player-generator/official-discipline-weights";
import { outcomeAusPunkten, DUELL_TEAM_PUNKTE } from "@/lib/resolve/battle-mode-pps-duell";

/**
 * ABNAHME DER PPS-DUELL-BRUECKE, TEIL B (docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md,
 * Nachtrag Abnahme der Bruecke selbst; Messung: scripts/miss-pps-duell-bruecke-abnahme.ts).
 *
 * WARUM DIESER TEST NICHT tests/disziplin-abnahme-guard.test.ts ERWEITERT: jener Waechter prueft
 * Mitgliedschaft einzelner Disziplinen in `ARENA_RESOLVED_DISCIPLINE_IDS` — ein Kipp-Schalter mit
 * Alternative (Arena-Ergebnis vs. Bruecke). Die Bruecke selbst hat keine Alternative; sie ist der
 * UNBEDINGTE Rueckfall fuer jede Disziplin ohne (noch) gezaehltes Arena-Ergebnis UND dauerhaft fuer
 * mindestens fuenf Disziplinen (Football, I-Spy, Battlefield, TDM, Mini-DM — nie arena-angeschlossen).
 * Ein "bestehen/nicht bestehen" schaltet hier nichts ab. Dieser Test ist deshalb ein
 * REGRESSIONS-WAECHTER auf den Kanal, den die Bruecke tatsaechlich konsumiert
 * (`scoreLegacyLineupDisciplineSide`, gefuettert aus `calculateRawDisciplineScore` — der alte,
 * Arena-unabhaengige PPS-Pfad), nicht ein zweiter Eintrag in der Abnahmetabelle.
 *
 * DIE ZENTRALE BEOBACHTUNG (gemessen, scripts/miss-pps-duell-bruecke-abnahme.ts Teil B): dieser
 * Kanal ist eine LINEARE, matrixgewichtete Summe plus attributunabhaengige Modifikatoren (Form-
 * Jitter, Slot-Rolle, Team-Power, Mutator — alle an Spieler/Slot gebunden, keiner an ein
 * bestimmtes Attribut). Eine Attribut-Luecke (wie bei den Arena-Chassis-Engines, s.
 * data/generated/disziplin-abnahme.json) kann hier also strukturell nicht entstehen — die Pp-
 * Abweichung dieses Kanals ist bei neutralen Modifikatoren exakt 0, nicht nur "klein". Faellt das
 * hier rot, hat jemand `calculateRawDisciplineScore`, `resolveDisciplineWeightProfile` oder
 * `scoreLegacyLineupDisciplineSide` so veraendert, dass ein Attribut nicht mehr proportional zu
 * seinem Matrixgewicht (bzw. seinem Override, s. spiel-eignung-overrides.ts) in den Score einfliesst
 * — und genau das wuerde die Bruecke in JEDEM Battle-Save, bei JEDER Disziplin, sofort weiterreichen.
 */

function neutraleSeite(disciplineId: string, attribute: Record<string, number>[]) {
  const disciplineScores = attribute.map((attrs, i) => ({
    playerId: `p${i}`,
    disciplineId,
    score: calculateRawDisciplineScore(attrs as never, disciplineId as OfficialDisciplineWeightId) ?? 0,
  }));
  const entries = attribute.map((_, i) => ({
    disciplineId, disciplineSide: "d1" as const, slotIndex: i, playerId: `p${i}`, activePlayerId: `p${i}`,
  }));
  const ergebnis = scoreLegacyLineupDisciplineSide({
    disciplineId, disciplineSide: "d1", entries, disciplineScores,
    requiredPlayers: attribute.length, intensity: "normal", formModifier: 0, formPerPlayer: 0, formCardStatus: "ready",
    mutatorMode: "legacy_selected_traits", mutatorModifier: 0, teamPowerStatus: "ready", teamPowerModifier: 0,
    captainMode: "selected_captain", captainStatus: "mapped",
  });
  return ergebnis.finalPreviewScore ?? ergebnis.totalScore;
}

function flacheSeite(n: number): Record<string, number>[] {
  return Array.from({ length: n }, () => Object.fromEntries(playerGeneratorAttributeKeys.map((k) => [k, 50])));
}

describe("PPS-Duell-Bruecke: der konsumierte Score-Kanal reicht Matrixgewichte unverzerrt durch", () => {
  it.each(["spurt", "fechten", "battlefield", "tdm", "football", "i-spy", "mini-dm"] as const)(
    "%s: eine Attribut-Anhebung wirkt EXAKT proportional zum Matrixgewicht (bzw. Override)",
    (disziplinId) => {
      const profil = resolveDisciplineWeightProfile(disziplinId);
      const matrixSumme = Object.values(profil).reduce((s, w) => s + Math.max(0, w ?? 0), 0);
      if (matrixSumme <= 0) return; // Disziplin ganz ohne Gewichte -- nichts zu pruefen.

      const basis = flacheSeite(3);
      const basisScore = neutraleSeite(disziplinId, basis)!;

      // Fuer JEDES Attribut: dieselbe Anhebung (+15) auf denselben Spieler. Der resultierende
      // Einfluss MUSS sich exakt wie das Matrixgewicht verhalten (linearer Kanal) -- kein Toleranz-
      // Fenster, weil die Formel es nicht braucht: calculateRawDisciplineScore ist eine gewichtete
      // Summe, und scoreLegacyLineupDisciplineSide skaliert bei neutralen Modifikatoren 1:1 durch.
      const einfluss: Record<string, number> = {};
      for (const attr of playerGeneratorAttributeKeys) {
        const angehoben = basis.map((spieler, i) => (i === 0 ? { ...spieler, [attr]: spieler[attr]! + 15 } : spieler));
        einfluss[attr] = neutraleSeite(disziplinId, angehoben)! - basisScore;
      }
      const einflussSumme = Object.values(einfluss).reduce((s, v) => s + v, 0);

      for (const attr of playerGeneratorAttributeKeys) {
        const matrixPct = (Math.max(0, (profil as Record<string, number>)[attr] ?? 0) / matrixSumme) * 100;
        const gemessenPct = einflussSumme > 0 ? (einfluss[attr]! / einflussSumme) * 100 : 0;
        // Toleranz nur fuer Rundung (roundPreviewScore rundet auf 0,1) -- keine strukturelle
        // Abweichung ist hier physikalisch moeglich.
        expect(Math.abs(matrixPct - gemessenPct), `${disziplinId}/${attr}`).toBeLessThan(2);
      }
    },
  );

  it("der Bruecken-Vergleich selbst ist eine reine Vorzeichen-Funktion ohne eigene Attribut-Logik", () => {
    // outcomeAusPunkten/DUELL_TEAM_PUNKTE kennen nur die zwei fertigen Scores -- kein Attribut, kein
    // Gewicht, keine Disziplin-ID geht in die Entscheidung ein. Das ist die Begruendung, warum eine
    // klassische Pp-Einfluss-Messung (einflussVon-Stil) auf der Bruecke selbst keinen Sinn ergibt:
    // sie haette nichts zu messen, das nicht schon vom Score-Kanal (oben) bestimmt ist.
    expect(outcomeAusPunkten(10, 5)).toBe("win");
    expect(outcomeAusPunkten(5, 10)).toBe("loss");
    expect(outcomeAusPunkten(7, 7)).toBe("draw");
    expect(DUELL_TEAM_PUNKTE).toEqual({ win: 2, draw: 1, loss: 0 });
  });
});
