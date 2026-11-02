/**
 * BAHN-POD · ECHTER END-TO-END-LAUF DURCH DIE LIGA (02.11., docs/design/bahn-pod-vier-teams-01-11.md
 * Abschnitt 6). Genau der Ablauf, der bei Battlefield/Mini-DM frueher fehlte und zu "0:2 bei 4
 * Teams" fuehrte: ein echter Battle-Save mit Liga-Split, Spieltag 1 mit Staffel (D1) UND Takeshi's
 * Castle (D2), echte KI-Aufstellung, der echte Arena-Vorlauf (`stelleArenaVorlaufSicher`) startet
 * echtes Headless-Chromium (`runBahnPodFixtures` -> `__arena.spieleBahnPod`), danach bucht der echte
 * Apply (`kickoffArenaMatchdayApply`). Der Runner wird nur MITGESCHNITTEN (er delegiert an den echten),
 * damit der Test gebuchte Plaetze gegen das tatsaechlich gelaufene Rennen pruefen kann.
 *
 * DECKT AB:
 *  (1) Vorlauf "ready", beide Disziplinen `status: "arena"`, `format: "bahn_pod"`, keine Teilwarnung;
 *      fuer Staffel/Takeshi lief KEIN Zweier-Duell (`runArenaFixtures` sieht sie nicht).
 *  (2) Gebucht: je Disziplin 4 Zeilen je Pod, ALLE `resolutionSource: "mini_dm_pod"` mit
 *      `quelle: "bahn"`, kein Arena-Ausfall-Marker, Liga-Punkte je Pod genau 2-1-0-0.
 *  (3) Gebuchter Platz = Platz im Rennen (`eventPlatz` des Motors, Gleichstand ueber PPS aufgeloest).
 *  (4) Spieler-PP im Ledger aus dem Rennen (`battle_mode_bahn_pod_player_score`, echte playerIds).
 *  (5) Saisontabelle: jedes Team bekommt genau die Punkte seines Pod-Platzes (kein Duell gegen den
 *      Fixture-Gegner, die Summe je Pod ist 3).
 */
import { describe, expect, it } from "vitest";

import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { stelleArenaVorlaufSicher } from "@/lib/battle/arena-vorlauf-service";
import { kickoffArenaMatchdayApply } from "@/lib/season/arena-matchday-resolve-service";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import {
  runArenaFixtures,
  runBahnPodFixtures,
  type BahnPodFixtureInput,
  type BahnPodFixtureResult,
} from "@/lib/battle/arena-headless-runner";
import { MINI_DM_POD_TEAM_PUNKTE } from "@/lib/resolve/mini-dm-pod-resolve";
import { chromiumVerfuegbar } from "@/tests/helpers/chromium-verfuegbar";
import { bauFrischenBattleSaveMitBahnPodsAnSpieltag1 } from "@/tests/helpers/bahn-pod-battle-save";

const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();
const LAUF_TIMEOUT_MS = 600_000;
const BAHN = ["staffel", "takeshis-castle"] as const;

describe.skipIf(!CHROMIUM_VERFUEGBAR)("Bahn-Pod · echter Chromium-E2E-Lauf durch Vorlauf, Buchung und Ledger", () => {
  it(
    "Staffel und Takeshi am selben Spieltag: echtes Vier-Team-Rennen je Pod, gebucht mit quelle:'bahn', Platz = Rennen",
    async () => {
      const { persistence, scope, k, podsByDisciplineId } = await bauFrischenBattleSaveMitBahnPodsAnSpieltag1();
      ensureMatchdayResolveSnapshot(scope, persistence);

      const mitgeschnitten = new Map<string, BahnPodFixtureResult | null>();
      const bahnMitschnitt: typeof runBahnPodFixtures = async (gs, disciplineId, pods, options) => {
        const ergebnisse = await runBahnPodFixtures(gs, disciplineId, pods, options);
        (pods as readonly BahnPodFixtureInput[]).forEach((pod, index) => mitgeschnitten.set(pod.podId, ergebnisse[index] ?? null));
        return ergebnisse;
      };
      const duellDisziplinen: string[] = [];
      const duellMitschnitt: typeof runArenaFixtures = async (gs, fixtures, disziplin, options) => {
        duellDisziplinen.push(disziplin);
        return runArenaFixtures(gs, fixtures, disziplin, options);
      };

      const start = Date.now();
      const vorlauf = await stelleArenaVorlaufSicher(
        scope,
        { runBahnPodFixturesImpl: bahnMitschnitt, runArenaFixturesImpl: duellMitschnitt },
        persistence,
      );
      const laufzeitMs = Date.now() - start;
      console.log(`[bahn-pod-e2e] echter Vorlauf (Staffel + Takeshi, k=${k}): ${laufzeitMs} ms`);

      // (1)
      expect(vorlauf.applicable).toBe(true);
      expect(vorlauf.status).toBe("ready");
      for (const bd of BAHN) {
        const eintrag = vorlauf.record?.disziplinen[bd];
        expect(eintrag?.status, bd).toBe("arena");
        expect(eintrag?.format, bd).toBe("bahn_pod");
        expect(eintrag?.teilwarnungen ?? [], bd).toEqual([]);
        expect(eintrag?.eingabeHash, bd).toBeTruthy();
      }
      expect(duellDisziplinen.filter((d) => (BAHN as readonly string[]).includes(d))).toEqual([]);
      for (const pods of podsByDisciplineId.values()) {
        for (const pod of pods) expect(mitgeschnitten.get(pod.id), pod.id).toBeTruthy();
      }

      const gebucht = await kickoffArenaMatchdayApply({
        persistence,
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        matchdayId: scope.matchdayId,
        forceReplace: true,
        allowIncompleteOverride: true,
        logPrefix: "[bahn-pod-e2e]",
      });
      if (!gebucht.applicable || !gebucht.booked) {
        throw new Error(`Arena-Matchday-Apply nicht gebucht: ${JSON.stringify(gebucht).slice(0, 500)}`);
      }

      const stand = persistence.getSaveById(scope.saveId)!.gameState;
      const ledger = buildSeasonPointsLedger(stand, scope.seasonId);
      for (const bd of BAHN) {
        const pods = podsByDisciplineId.get(bd)!;
        const zeilen = (stand.seasonState.disciplineResults ?? []).filter(
          (zeile) => zeile.matchdayResultId?.includes(scope.matchdayId) && zeile.disciplineId === bd,
        );
        // (2)
        expect(zeilen.length, bd).toBe(pods.length * 4);
        for (const pod of pods) {
          const podZeilen = zeilen.filter((zeile) => pod.teamIds.includes(zeile.teamId));
          expect(podZeilen, pod.id).toHaveLength(4);
          for (const zeile of podZeilen) {
            expect(zeile.resolutionSource).toBe("mini_dm_pod");
            expect(zeile.miniDmPod?.quelle).toBe("bahn");
            expect(zeile.miniDmPod?.podId).toBe(pod.id);
            expect(zeile.arenaAusfall ?? null).toBeNull();
          }
          const nachPlatz = [...podZeilen].sort((a, b) => a.miniDmPod!.platz - b.miniDmPod!.platz);
          expect(nachPlatz.map((z) => z.teamPoints)).toEqual([...MINI_DM_POD_TEAM_PUNKTE]);
          // (3) gebuchter Platz folgt dem Rennen: Motor-Platz nie besser als ein gebuchter Vordermann.
          const rennen = mitgeschnitten.get(pod.id)!;
          const motorPlatz = new Map(rennen.teams.map((t) => [t.teamId, t.eventPlatz] as const));
          for (let i = 1; i < nachPlatz.length; i += 1) {
            expect(motorPlatz.get(nachPlatz[i - 1]!.teamId)!).toBeLessThanOrEqual(motorPlatz.get(nachPlatz[i]!.teamId)!);
          }
          // Bei eindeutigen Motor-Plaetzen ist der gebuchte Platz exakt der Motor-Platz.
          if (new Set(motorPlatz.values()).size === 4) {
            for (const zeile of podZeilen) expect(zeile.miniDmPod!.platz).toBe(motorPlatz.get(zeile.teamId));
          }
          // (5) Tabellenbeitrag je Team = Pod-Punkte.
          for (const zeile of podZeilen) {
            const beitrag = ledger.tableGroupContributions.find((b) => b.teamId === zeile.teamId && b.disciplineId === bd);
            expect(beitrag?.points, `${bd} ${zeile.teamId}`).toBe(zeile.teamPoints);
          }
        }
        // (4)
        const ppEintraege = ledger.pointEntries.filter((e) => e.disciplineId === bd && e.pointSource === "battle_mode_bahn_pod_player_score");
        expect(ppEintraege.length, bd).toBeGreaterThanOrEqual(pods.length * 4 * k * 0.5);
        for (const e of ppEintraege) {
          expect(e.playerId).toBeTruthy();
          expect(Number.isFinite(e.points)).toBe(true);
        }
      }
      expect(laufzeitMs).toBeLessThan(LAUF_TIMEOUT_MS);
    },
    LAUF_TIMEOUT_MS,
  );
});
