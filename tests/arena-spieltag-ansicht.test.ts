import { describe, expect, it } from "vitest";

import {
  beschreibeGebuchtesArenaErgebnis,
  bestimmeArenaSpieltagAnsicht,
  findeEigeneWertungsZeilen,
  grundOhneMotorSpiel,
  zeigtArenaDenGebuchtenSieger,
} from "@/lib/foundation/battle-arena/arena-spieltag-ansicht";
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

/**
 * Battle Mode: die Arena des Spieltags zeigt das GEBUCHTE Motor-Spiel (02.11.). Diese Tests pruefen
 * die eine Entscheidung, an der das haengt: welches Spiel, in welcher Orientierung -- und wann keins.
 */
const MD = "matchday-1";
const gameState = {
  seasonState: {
    schedule: [
      { matchdayId: MD, homeTeamId: "GEG", awayTeamId: "EIG" },
      { matchdayId: MD, homeTeamId: "X1", awayTeamId: "X2" },
    ],
  },
} as never;

function zeile(teamId: string, extra: Record<string, unknown>) {
  return { teamId, teamName: teamId, disciplineId: "spurt", disciplineSide: "d1", ...extra };
}
function preview(teamResults: unknown[], disciplineId = "spurt"): LegacyMatchdayResolvePreview {
  return {
    matchdayId: MD,
    disciplinePreviews: [{ disciplineId, disciplineName: disciplineId, disciplineSide: "d1", teamResults, topPlayers: [], highlightCandidates: [] }],
  } as unknown as LegacyMatchdayResolvePreview;
}

describe("bestimmeArenaSpieltagAnsicht", () => {
  it("Arena-Duell: Heim/Gast folgen dem Fixture, nicht dem eigenen Team", () => {
    const p = preview([
      zeile("EIG", { resolutionSource: "arena", opponentTeamId: "GEG", teamPoints: 2, duellSeiten: [36, 19] }),
      zeile("GEG", { resolutionSource: "arena", opponentTeamId: "EIG", teamPoints: 0, duellSeiten: [19, 36] }),
    ]);
    const e = bestimmeArenaSpieltagAnsicht({ gameState, matchdayId: MD, disciplineId: "spurt", ownTeamId: "EIG", preview: p });
    expect(e).toMatchObject({ art: "duell", heimTeamId: "GEG", gastTeamId: "EIG", podTeamId: "EIG" });
    const gebucht = beschreibeGebuchtesArenaErgebnis(e!, (id) => id);
    expect(gebucht.ausgang).toBe("sieg");
    // Eigenes Team ist GAST (Seite 1): Motor-Sieger 1 heisst Sieg, 0 heisst Niederlage.
    expect(zeigtArenaDenGebuchtenSieger(e!, gebucht, 1)).toBe(true);
    expect(zeigtArenaDenGebuchtenSieger(e!, gebucht, 0)).toBe(false);
  });

  it("PPS-Duell-Bruecke: kein Motor-Spiel, also keine Arena-Wiedergabe", () => {
    const p = preview([zeile("EIG", { resolutionSource: "pps_duell", opponentTeamId: "GEG", teamPoints: 1 })]);
    expect(bestimmeArenaSpieltagAnsicht({ gameState, matchdayId: MD, disciplineId: "spurt", ownTeamId: "EIG", preview: p })).toBeNull();
    const zeilen = findeEigeneWertungsZeilen({ preview: p, disciplineId: "spurt", ownTeamId: "EIG" });
    expect(zeilen?.art).toBe("duell");
    expect(grundOhneMotorSpiel({ zeilen, vorlaufLaeuft: false })).toBe("bruecke");
    expect(grundOhneMotorSpiel({ zeilen, vorlaufLaeuft: true })).toBe("vorlauf");
  });

  it("Motor-Pod (ffa/bahn) wird gezeigt, PPS-Pod nicht", () => {
    const pod = { podId: "p1", platz: 2, teamIds: ["EIG", "A", "B", "C"], wert: 0 };
    const mitMotor = preview([zeile("EIG", { resolutionSource: "mini_dm_pod", miniDmPod: { ...pod, quelle: "bahn" }, teamPoints: 1 })], "staffel");
    const e = bestimmeArenaSpieltagAnsicht({ gameState, matchdayId: MD, disciplineId: "staffel", ownTeamId: "EIG", preview: mitMotor });
    expect(e).toMatchObject({ art: "pod", heimTeamId: "EIG", podTeamId: "EIG" });
    expect(beschreibeGebuchtesArenaErgebnis(e!, (id) => id).text).toContain("Platz 2 von 4");
    const ohneMotor = preview([zeile("EIG", { resolutionSource: "mini_dm_pod", miniDmPod: pod, teamPoints: 1 })], "staffel");
    expect(bestimmeArenaSpieltagAnsicht({ gameState, matchdayId: MD, disciplineId: "staffel", ownTeamId: "EIG", preview: ohneMotor })).toBeNull();
  });

  it("Snapshot eines anderen Spieltags zeigt nichts", () => {
    const p = { ...preview([zeile("EIG", { resolutionSource: "arena", opponentTeamId: "GEG" })]), matchdayId: "matchday-2" };
    expect(bestimmeArenaSpieltagAnsicht({ gameState, matchdayId: MD, disciplineId: "spurt", ownTeamId: "EIG", preview: p })).toBeNull();
  });
});
