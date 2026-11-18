import { describe, expect, it } from "vitest";

import {
  beschreibeGebuchtesArenaErgebnis,
  bestimmeArenaSpieltagAnsicht,
  findeEigeneWertungsZeilen,
  grundOhneMotorSpiel,
  waehleArenaFlaeche,
  zeigtArenaDenGebuchtenSieger,
} from "@/lib/foundation/battle-arena/arena-spieltag-ansicht";
import { baueWechselSpielliste, waehleWechselStandard } from "@/lib/foundation/battle-arena/arena-wechsel";
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
    expect(e).toMatchObject({ art: "pod", heimTeamId: "EIG", podTeamId: "EIG", gastTeamId: "A" });
    expect(beschreibeGebuchtesArenaErgebnis(e!, (id) => id).text).toContain("Platz 2 von 4");
    const ohneMotor = preview([zeile("EIG", { resolutionSource: "mini_dm_pod", miniDmPod: pod, teamPoints: 1 })], "staffel");
    expect(bestimmeArenaSpieltagAnsicht({ gameState, matchdayId: MD, disciplineId: "staffel", ownTeamId: "EIG", preview: ohneMotor })).toBeNull();
  });

  it("Snapshot eines anderen Spieltags zeigt nichts", () => {
    const p = { ...preview([zeile("EIG", { resolutionSource: "arena", opponentTeamId: "GEG" })]), matchdayId: "matchday-2" };
    expect(bestimmeArenaSpieltagAnsicht({ gameState, matchdayId: MD, disciplineId: "spurt", ownTeamId: "EIG", preview: p })).toBeNull();
  });
});

describe("Wechsel Disziplin 1 -> Disziplin 2 landet auf dem eigenen Spiel (18.11.)", () => {
  // D1: Duell gegen GEG (Fixture). D2: Vierergruppe, in der der Fixture-Gegner NICHT sitzt.
  const pod = { podId: "bf-2", platz: 1, teamIds: ["A", "EIG", "B", "C"], wert: 0, quelle: "ffa" };
  const d2 = preview([zeile("EIG", { resolutionSource: "mini_dm_pod", miniDmPod: pod, teamPoints: 2 })], "battlefield");

  it("Pod ohne Fixture-Gegner: Gast ist ein Mitglied der gebuchten Gruppe, nicht der D1-Gegner", () => {
    const e = bestimmeArenaSpieltagAnsicht({ gameState, matchdayId: MD, disciplineId: "battlefield", ownTeamId: "EIG", preview: d2 });
    expect(e?.art).toBe("pod");
    expect(e?.podTeamIds).toEqual(["A", "EIG", "B", "C"]);
    expect(e?.podTeamIds).toContain(e!.heimTeamId);
    expect(e?.podTeamIds).toContain(e!.gastTeamId);
    expect(e?.gastTeamId).not.toBe("GEG");
  });

  it("Pod mit Fixture-Gegner in der Gruppe: der bleibt Gast (Vorstellung hebt ihn hervor)", () => {
    const mit = preview([zeile("EIG", { resolutionSource: "mini_dm_pod", miniDmPod: { ...pod, teamIds: ["EIG", "GEG", "B", "C"] }, teamPoints: 2 })], "battlefield");
    const e = bestimmeArenaSpieltagAnsicht({ gameState, matchdayId: MD, disciplineId: "battlefield", ownTeamId: "EIG", preview: mit });
    expect(e?.gastTeamId).toBe("GEG");
  });

  it("Gruppe ohne das eigene Team ist ein fremdes Spiel und wird nie gezeigt", () => {
    const fremd = preview([zeile("EIG", { resolutionSource: "mini_dm_pod", miniDmPod: { ...pod, teamIds: ["A", "B", "C", "D"] }, teamPoints: 2 })], "battlefield");
    expect(bestimmeArenaSpieltagAnsicht({ gameState, matchdayId: MD, disciplineId: "battlefield", ownTeamId: "EIG", preview: fremd })).toBeNull();
  });

  it("Spielliste: eigenes Spiel zuerst und als Standard, fremde nur zur Wahl", () => {
    const p = preview([
      zeile("X1", { resolutionSource: "mini_dm_pod", miniDmPod: { ...pod, podId: "bf-1", teamIds: ["X1", "X2", "X3", "X4"] } }),
      zeile("EIG", { resolutionSource: "mini_dm_pod", miniDmPod: pod }),
      zeile("A", { resolutionSource: "mini_dm_pod", miniDmPod: pod }),
    ], "battlefield");
    const liste = baueWechselSpielliste({ preview: p, disciplineId: "battlefield", ownTeamId: "EIG" });
    expect(liste.map((s) => s.id)).toEqual(["pod:bf-2", "pod:bf-1"]);
    expect(waehleWechselStandard(liste)?.teamIds).toContain("EIG");
    expect(liste[1].eigenes).toBe(false);
  });
});

describe("waehleArenaFlaeche (Keine Demos mehr, 11.11.)", () => {
  const basis = { istBattleSave: true, echteWerte: true, adminTestmodus: false, hatMotorSpiel: true };

  it("Battle-Save mit gebuchtem Motor-Spiel: echte Battle Arena", () => {
    expect(waehleArenaFlaeche(basis)).toBe("battle-motor");
  });

  it("Admin-Testmodus schaltet die echte Battle Arena NICHT mehr ab (Chris' Climbing-Fund 11.11.)", () => {
    expect(waehleArenaFlaeche({ ...basis, adminTestmodus: true })).toBe("battle-motor");
  });

  it("Battle-Save ohne Motor-Spiel: ehrlicher Hinweis, im Testmodus die Buehne", () => {
    expect(waehleArenaFlaeche({ ...basis, hatMotorSpiel: false })).toBe("battle-ohne-motor");
    expect(waehleArenaFlaeche({ ...basis, hatMotorSpiel: false, adminTestmodus: true })).toBe("buehne");
  });

  it("Manager-Save und Zufallsmodus bleiben bei der Buehne", () => {
    expect(waehleArenaFlaeche({ ...basis, istBattleSave: false })).toBe("buehne");
    expect(waehleArenaFlaeche({ ...basis, echteWerte: false })).toBe("buehne");
  });
});
