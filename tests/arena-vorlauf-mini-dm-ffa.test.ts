import { describe, expect, it } from "vitest";

import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { kickoffArenaVorlauf, stelleArenaVorlaufSicher } from "@/lib/battle/arena-vorlauf-service";
import { kickoffArenaMatchdayApply } from "@/lib/season/arena-matchday-resolve-service";
import { MINI_DM_FFA_ROLLEN6 } from "@/lib/resolve/mini-dm-pod-resolve";
import type { MiniDmFfaPodFixtureInput, MiniDmFfaPodFixtureResult } from "@/lib/battle/arena-headless-runner";
import { bauFrischenBattleSaveMitMiniDmAnSpieltag1, buildHarmlosenArenaFakeRunner } from "@/tests/helpers/mini-dm-ffa-battle-save";

/**
 * MINI-DM-FFA-VORLAUF-VERDRAHTUNG (PR 5 des 6-PR-Opus-Plans 21.10.). Dasselbe Grundgeruest wie
 * `tests/arena-eingabe-stabil.test.ts`/`tests/arena-vorlauf-service.test.ts` (echter Liga-/
 * Lineup-Pfad, KEIN echtes Chromium -- injizierter `runMiniDmFfaPodFixturesImpl`), angepasst auf
 * die Mini-DM-Pod-Suche statt der Zweier-Fixture-Suche.
 *
 * Fester, leicht nachrechenbarer Fake-Motor: `beitrag = (3-podSide)*100 + runde` -- Team an
 * `pod.teamIds[0]` (podSide 0) liefert in JEDER Runde den hoechsten Beitrag, muss also IMMER
 * Platz 1/2 Liga-Punkte bekommen, wenn die FFA-Buchung (statt der PPS-Bruecke) tatsaechlich greift.
 * WICHTIG: `berechneMiniDmFfaRundenAkkumulation()` (mini-dm-pod-resolve.ts) rankt NACH `beitrag`
 * selbst (nicht nach den hier gesetzten `rundenPlatz`/`rundenPunkte`-Feldern, die beim Uebersetzen
 * in Rohdaten verworfen werden, s. `uebersetzeMotorErgebnisZuRohdaten()`) -- die Formel MUSS deshalb
 * den tatsaechlichen `beitrag`-Wert und nicht nur die kosmetischen Platzfelder treffen. Die KI
 * fuellt mit `applyAiLegacyLineupBatchLocally()` ALLE Rollen (kein Team bleibt ohne Aufstellung),
 * jedes Team nimmt deshalb an jeder Runde teil (a(t,r) = 1 fuer alle t,r).
 */
function buildFakeMiniDmFfaRunner(k: number) {
  return async (
    _gameState: unknown,
    pods: readonly MiniDmFfaPodFixtureInput[],
  ): Promise<Array<MiniDmFfaPodFixtureResult | null>> =>
    pods.map((pod) => ({
      podId: pod.podId,
      teamIds: pod.teamIds,
      teams: pod.teamIds.map((teamId, podSide) => ({ teamId, podSide, rundenPunkteSumme: 0, beitragSumme: 0, eventPlatz: podSide + 1, ligaPunkte: 0 })),
      boxscore: Array.from({ length: k }, (_v, rundenIndex) =>
        pod.teamIds.map((teamId, podSide) => ({
          slotId: MINI_DM_FFA_ROLLEN6[rundenIndex]!,
          name: `fake-${teamId}-${rundenIndex}`,
          playerId: null,
          teamId,
          podSide,
          rundenPlatz: podSide + 1,
          rundenPunkte: 4 - podSide,
          beitrag: (3 - podSide) * 100 + rundenIndex,
        })),
      ).flat(),
    }));
}

/**
 * `bauFrischenBattleSaveMitMiniDmAnSpieltag1()`/`TEST_K` wohnen jetzt in
 * `tests/helpers/mini-dm-ffa-battle-save.ts` (OPUS-REVIEW, PR 5, Pflicht-Fix 3) -- ausgelagert, weil
 * `tests/mini-dm-ffa-e2e-real-chromium.test.ts` denselben Aufbau braucht, UND ein Import einer
 * `.test.ts`-Datei als Modul deren `describe()`/`it()`-Aufrufe ein zweites Mal registriert hätte
 * (s. ausführlicher Kommentar an der Helfer-Datei).
 */

describe("Arena-Vorlauf-Service · Mini-DM-FFA (PR 5 des 6-PR-Opus-Plans, 'Vorlauf-Verdrahtung')", () => {
  it(
    "Mini-DM-Pod-Teams werden ueber die ECHTEN FFA-Rohdaten gebucht (quelle: 'ffa'), nicht ueber den PPS-Pod-Rueckfall",
    async () => {
      const { persistence, scope, k, pods } = await bauFrischenBattleSaveMitMiniDmAnSpieltag1();
      ensureMatchdayResolveSnapshot(scope, persistence);

      const vorlauf = await stelleArenaVorlaufSicher(
        scope,
        // CI-FIX (25.10., dedizierte Root-Cause-Untersuchung): IMMER beide Runner-Typen faken, nie
        // nur den fuer diesen Testzweck relevanten -- `discipline2` ist seit dem Helfer-Fix fest auf
        // "hockey" gepinnt (nicht arena-aufgeloest), der Arena-Fake wird hier also im Normalfall nie
        // aufgerufen, dient aber als Sicherheitsnetz statt stillschweigend auf echtes Chromium
        // zurueckzufallen, falls sich das je aendert.
        { runMiniDmFfaPodFixturesImpl: buildFakeMiniDmFfaRunner(k), runArenaFixturesImpl: buildHarmlosenArenaFakeRunner() },
        persistence,
      );
      expect(vorlauf.applicable).toBe(true);
      expect(vorlauf.status).toBe("ready");
      expect(vorlauf.record?.disziplinen["mini-dm"]?.status).toBe("arena");

      const gebucht = await kickoffArenaMatchdayApply({
        persistence,
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        matchdayId: scope.matchdayId,
        forceReplace: true,
        allowIncompleteOverride: true,
        logPrefix: "[arena-vorlauf-mini-dm-ffa-test]",
      });
      if (!gebucht.applicable || !gebucht.booked) {
        throw new Error(`Arena-Matchday-Apply nicht gebucht: ${JSON.stringify(gebucht).slice(0, 500)}`);
      }

      const stand = persistence.getSaveById(scope.saveId)!.gameState;
      const miniDmZeilen = (stand.seasonState.disciplineResults ?? []).filter(
        (zeile) => zeile.matchdayResultId?.includes(scope.matchdayId) && zeile.disciplineId === "mini-dm",
      );
      expect(miniDmZeilen.length).toBeGreaterThan(0);

      for (const pod of pods) {
        const podZeilen = miniDmZeilen.filter((zeile) => pod.teamIds.includes(zeile.teamId));
        expect(podZeilen).toHaveLength(4);
        for (const zeile of podZeilen) {
          expect(zeile.resolutionSource).toBe("mini_dm_pod");
          // DIE zentrale Behauptung dieser PR: die Buchung kommt aus `berechneMiniDmFfaPodOverride()`
          // (PR 4), NICHT mehr aus dem alten PPS-Pod-Pfad -- erkennbar an `quelle: "ffa"`.
          expect(zeile.miniDmPod?.quelle).toBe("ffa");
        }
        // Team an `teamIds[0]` liefert in JEDER Runde den hoechsten Fake-Beitrag -> Platz 1, 2
        // Liga-Punkte (Chris' 2-1-0-0-Vorgabe).
        const bester = podZeilen.find((zeile) => zeile.teamId === pod.teamIds[0]);
        expect(bester?.miniDmPod?.platz).toBe(1);
        expect(bester?.teamPoints).toBe(2);
      }
    },
    420_000,
  );

  it(
    "ein Mini-DM-FFA-Ausfall (werfender Runner) faellt pro Pod defensiv auf den PPS-Pod-Pfad zurueck -- kein ungebuchter Spieltag",
    async () => {
      const { persistence, scope, pods } = await bauFrischenBattleSaveMitMiniDmAnSpieltag1();
      ensureMatchdayResolveSnapshot(scope, persistence);

      const werfenderRunner = async (): Promise<never> => {
        throw new Error("mini-dm-ffa-test: absichtlicher Ausfall");
      };

      const vorlauf = await stelleArenaVorlaufSicher(
        scope,
        { runMiniDmFfaPodFixturesImpl: werfenderRunner, runArenaFixturesImpl: buildHarmlosenArenaFakeRunner() },
        persistence,
      );
      expect(vorlauf.applicable).toBe(true);
      // "failed" ist hier KEIN Blocker (s. matchday-auto-run-service.ts: `"failed"` -> "warning",
      // nicht "blocked") -- nur das Signal, dass mindestens eine Teil-Disziplin (hier Mini-DM)
      // nicht per Arena/FFA aufgeloest werden konnte.
      expect(vorlauf.status).toBe("failed");
      expect(vorlauf.record?.disziplinen["mini-dm"]?.status).toBe("ausgefallen");

      const gebucht = await kickoffArenaMatchdayApply({
        persistence,
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        matchdayId: scope.matchdayId,
        forceReplace: true,
        allowIncompleteOverride: true,
        logPrefix: "[arena-vorlauf-mini-dm-ffa-test]",
      });
      if (!gebucht.applicable || !gebucht.booked) {
        throw new Error(`Arena-Matchday-Apply nicht gebucht: ${JSON.stringify(gebucht).slice(0, 500)}`);
      }

      const stand = persistence.getSaveById(scope.saveId)!.gameState;
      const miniDmZeilen = (stand.seasonState.disciplineResults ?? []).filter(
        (zeile) => zeile.matchdayResultId?.includes(scope.matchdayId) && zeile.disciplineId === "mini-dm",
      );
      expect(miniDmZeilen.length).toBe(pods.length * 4);
      for (const zeile of miniDmZeilen) {
        // Rueckfall: weiterhin als Pod gewertet (2-1-0-0), aber ueber den unveraenderten PPS-Score,
        // nicht ueber FFA-Rohdaten.
        expect(zeile.resolutionSource).toBe("mini_dm_pod");
        expect(zeile.miniDmPod?.quelle).toBeUndefined();
      }
    },
    420_000,
  );

  it(
    "Mini-DM ALLEIN (ohne jede andere arena-aufgeloeste Disziplin am selben Spieltag) macht den Vorlauf bereits anwendbar",
    async () => {
      const { persistence, scope, andereArenaDisziplinPraesent } = await bauFrischenBattleSaveMitMiniDmAnSpieltag1();
      if (andereArenaDisziplinPraesent) {
        // Dieser konkrete Save hat zufaellig eine zweite arena-aufgeloeste Disziplin an D1/D2 --
        // die eigentliche Behauptung (Mini-DM allein reicht) ist dann durch DIESEN Save nicht
        // trennscharf pruefbar. `determineArenaDisciplineContexts()` wird stattdessen direkt
        // (ohne Save) in einem separaten Test unten geprueft.
        return;
      }
      ensureMatchdayResolveSnapshot(scope, persistence);
      const kickoff = kickoffArenaVorlauf(
        scope,
        { runMiniDmFfaPodFixturesImpl: buildFakeMiniDmFfaRunner(4), runArenaFixturesImpl: buildHarmlosenArenaFakeRunner() },
        persistence,
      );
      expect(kickoff.applicable).toBe(true);
    },
    420_000,
  );
});

describe("determineArenaDisciplineContexts · Mini-DM-Praesenz ohne Set-Mitgliedschaft (PR 5)", () => {
  it("meldet miniDmPresent, OHNE 'mini-dm' in arenaDisciplineIds aufzunehmen", async () => {
    const { determineArenaDisciplineContexts } = await import("@/lib/battle/arena-vorlauf-service");
    const fakeContext = {
      ok: true as const,
      context: {
        saveId: "s",
        seasonId: "se",
        matchdayId: "m1",
        contextMeta: { d1DisciplineId: "mini-dm", d2DisciplineId: "showcase" },
      },
    };
    const ergebnis = determineArenaDisciplineContexts([fakeContext] as unknown as Parameters<typeof determineArenaDisciplineContexts>[0]);
    expect(ergebnis.miniDmPresent).toBe(true);
    expect(ergebnis.arenaDisciplineIds).toContain("showcase");
    expect(ergebnis.arenaDisciplineIds).not.toContain("mini-dm");
    expect(ergebnis.mutatorTraitsByDisciplineId.has("mini-dm")).toBe(true);
  });

  it("miniDmPresent bleibt false, wenn gar kein Mini-DM-Slot an D1/D2 steht", async () => {
    const { determineArenaDisciplineContexts } = await import("@/lib/battle/arena-vorlauf-service");
    const fakeContext = {
      ok: true as const,
      context: {
        saveId: "s",
        seasonId: "se",
        matchdayId: "m1",
        contextMeta: { d1DisciplineId: "showcase", d2DisciplineId: "tennis" },
      },
    };
    const ergebnis = determineArenaDisciplineContexts([fakeContext] as unknown as Parameters<typeof determineArenaDisciplineContexts>[0]);
    expect(ergebnis.miniDmPresent).toBe(false);
  });
});

describe("Manager-Mode bleibt unberuehrt (CLAUDE.md-Pflichtpruefung)", () => {
  it("ein Manager-Mode-Save ist weiterhin NIE anwendbar, selbst wenn Mini-DM an D1/D2 steht", async () => {
    // `getDatabase()` (lib/persistence/sqlite.ts) cached die SQLite-Verbindung PROZESSWEIT bei
    // ihrem ERSTEN Aufruf -- ein neuer `OLY_APP_SQLITE_PATH` allein wirkt deshalb NICHT mehr, wenn
    // (wie hier, nach den vorherigen `it()`-Blocks in dieser Datei) schon eine Verbindung offen
    // ist: `bootstrapSingleplayerSave()`s `getActiveSave()` haette sonst eine Battle-Mode-Save aus
    // einem FRUEHEREN Test zurueckgegeben, nicht eine frische Manager-Mode-Save -- genau der Fund,
    // der diesen Kommentar ausgeloest hat (Testfehler, kein Produktionsfehler). `resetDatabaseForTests()`
    // schliesst die alte Verbindung explizit, bevor die naechste `getDatabase()` sie mit dem NEUEN Pfad
    // neu aufbaut.
    resetDatabaseForTests();
    process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-arena-vorlauf-mini-dm-ffa-manager-${Math.random().toString(36).slice(2)}.sqlite`;
    const persistence = createPersistenceService();
    const { save } = persistence.bootstrapSingleplayerSave();
    const saveId = save.saveId;
    const aktuell = persistence.getSaveById(saveId)!;
    const scope = {
      saveId,
      seasonId: aktuell.gameState.season.id,
      matchdayId: aktuell.gameState.matchdayState.matchdayId,
    };
    // Ein frischer Bootstrap-Save ist Manager Mode (kein `gameMode: "battle"`) -- `isBattleModeSave()`
    // greift ganz vorne in `ermittleAnwendbarkeit()`, UNVERAENDERT durch diese PR. Mini-DM muss an
    // diesem Save nicht einmal real geplant sein: der Gate-Check endet schon davor.
    const kickoff = kickoffArenaVorlauf(scope, {}, persistence);
    expect(kickoff.applicable).toBe(false);
    const inline = await stelleArenaVorlaufSicher(scope, {}, persistence);
    expect(inline.applicable).toBe(false);
  });
});
