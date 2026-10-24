/**
 * OPUS-REVIEW, PFLICHT-FIX 3 (PR 5 des 6-PR-Opus-Plans 21.10., "Vorlauf-Verdrahtung"): echter
 * Chromium-E2E-Lauf vor dem Merge.
 *
 * BEFUND, DER DIESEN TEST NOETIG MACHT: der bisherige Integrationstest
 * (`tests/arena-vorlauf-mini-dm-ffa.test.ts`) injiziert ÜBERALL einen FAKE-Motor
 * (`runMiniDmFfaPodFixturesImpl`) mit `playerId: null` im Boxscore -- echtes Chromium lief NIE, und
 * der Spieler-PP-Pfad (`berechnePlayerPpsAusMotorErgebnis()`, mini-dm-ffa-matchday.ts, braucht
 * `playerId` im Boxscore, um `arenaIndividualBoxscorePpsByDisciplineId` ueberhaupt zu befuellen) war
 * dadurch NIE integrationsgetestet -- genau das liess den B1-Blocker (einseitige Formkarten-Vergabe)
 * unentdeckt. DIESER Test laeuft deshalb OHNE jede Injektion: echter Battle-Save, echter
 * Liga-/KI-Lineup-Pfad, erzwungener Mini-DM-Spieltag, `stelleArenaVorlaufSicher()` ruft den echten
 * `runMiniDmFfaMatchday()` -> echten `runMiniDmFfaPodFixtures()` -> echtes Headless-Chromium
 * (`battle-mode.engine.js` im Browser) auf -- keine Fake-Motor-Option.
 *
 * DECKT AB: (1) alle Pods eines vollen Spieltags liefern ein echtes Ergebnis UND werden mit
 * `quelle: "ffa"` gebucht (nicht der PPS-Rueckfall), (2) `kickoffArenaMatchdayApply()` bucht
 * erfolgreich, (3) mindestens ein Spieler-PP-Eintrag mit `pointSource:
 * "battle_mode_mini_dm_ffa_player_score"` UND einer echten `playerId` (nicht `null`) landet im
 * Season-Points-Ledger (`buildSeasonPointsLedger()`), (4) die Laufzeit wird gemessen und geloggt.
 *
 * Der B1-Positions-Permutationstest (`tests/mini-dm-ffa-formkarten-position-fix.test.ts`) deckt mit
 * synthetischen Kadern denselben echten Motor-Pfad ab wie dieser Test -- beide zusammen sind der
 * geforderte "echte Chromium-E2E-Lauf ... mit Positions-Permutationstest".
 */
import { describe, expect, it } from "vitest";

import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { stelleArenaVorlaufSicher } from "@/lib/battle/arena-vorlauf-service";
import { kickoffArenaMatchdayApply } from "@/lib/season/arena-matchday-resolve-service";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { chromiumVerfuegbar } from "@/tests/helpers/chromium-verfuegbar";
import { bauFrischenBattleSaveMitMiniDmAnSpieltag1 } from "@/tests/helpers/mini-dm-ffa-battle-save";

const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();
const LAUF_TIMEOUT_MS = 420_000;

describe.skipIf(!CHROMIUM_VERFUEGBAR)(
  "Mini-DM-FFA · echter Chromium-E2E-Lauf, kein injizierter Motor (OPUS-REVIEW Pflicht-Fix 3)",
  () => {
    it(
      "ein voller Mini-DM-Spieltag laeuft ECHT durch Chromium, bucht quelle:'ffa' fuer jeden Pod, und erzeugt echte Spieler-PP im Ledger",
      async () => {
        const { persistence, scope, k, pods } = await bauFrischenBattleSaveMitMiniDmAnSpieltag1();
        ensureMatchdayResolveSnapshot(scope, persistence);

        const start = Date.now();
        // KEIN `runMiniDmFfaPodFixturesImpl` -- das ist der Punkt dieses Tests: der echte Motor
        // (`runMiniDmFfaPodFixtures()`, arena-headless-runner.ts) startet echtes Headless-Chromium.
        const vorlauf = await stelleArenaVorlaufSicher(scope, {}, persistence);
        const laufzeitMs = Date.now() - start;
        console.log(`[mini-dm-ffa-e2e] echter Chromium-Vorlauf fuer ${pods.length} Pod(s), k=${k}: ${laufzeitMs} ms`);

        expect(vorlauf.applicable).toBe(true);
        expect(vorlauf.status).toBe("ready");
        expect(vorlauf.record?.disziplinen["mini-dm"]?.status).toBe("arena");
        // Pflicht-Fix 1 (Boxscore-Vollstaendigkeit): ein voller, echter Motor-Lauf mit vollstaendiger
        // KI-Aufstellung darf KEINE Teilwarnung erzeugen -- jede Rolle jedes Pod-Teams ist gesetzt.
        expect(vorlauf.record?.disziplinen["mini-dm"]?.teilwarnungen ?? []).toEqual([]);

        const gebucht = await kickoffArenaMatchdayApply({
          persistence,
          saveId: scope.saveId,
          seasonId: scope.seasonId,
          matchdayId: scope.matchdayId,
          forceReplace: true,
          allowIncompleteOverride: true,
          logPrefix: "[mini-dm-ffa-e2e-real-chromium-test]",
        });
        if (!gebucht.applicable || !gebucht.booked) {
          throw new Error(`Arena-Matchday-Apply nicht gebucht: ${JSON.stringify(gebucht).slice(0, 500)}`);
        }

        const stand = persistence.getSaveById(scope.saveId)!.gameState;
        const miniDmZeilen = (stand.seasonState.disciplineResults ?? []).filter(
          (zeile) => zeile.matchdayResultId?.includes(scope.matchdayId) && zeile.disciplineId === "mini-dm",
        );
        expect(miniDmZeilen.length).toBe(pods.length * 4);

        // (1) ALLE Pods eines vollen Spieltags liefern ein echtes Ergebnis UND werden mit
        // `quelle: "ffa"` gebucht -- nicht der PPS-Rueckfall (der bei einem Motor-Ausfall griffe).
        for (const pod of pods) {
          const podZeilen = miniDmZeilen.filter((zeile) => pod.teamIds.includes(zeile.teamId));
          expect(podZeilen).toHaveLength(4);
          for (const zeile of podZeilen) {
            expect(zeile.resolutionSource).toBe("mini_dm_pod");
            expect(zeile.miniDmPod?.quelle).toBe("ffa");
          }
        }

        // (3) echte Spieler-PP im Ledger: der Fake-Motor der Geschwisterdatei setzt `playerId: null`
        // im Boxscore (s. Kopfkommentar dort) -- `berechnePlayerPpsAusMotorErgebnis()` kann daraus
        // NIE eine `playerId -> pp`-Zuordnung bauen. Der ECHTE Motor liefert echte `playerId`s
        // (`baueEindeutigeNamenZuordnungFuerTeam()`, arena-headless-runner.ts) -- dieser Test prueft
        // deshalb, dass der Ledger TATSAECHLICH mindestens einen Mini-DM-FFA-Spieler-PP-Eintrag mit
        // einer echten `playerId` traegt, nicht nur, dass die Pod-Zeile `quelle: "ffa"` zeigt.
        const ledger = buildSeasonPointsLedger(stand, scope.seasonId);
        const miniDmFfaEintraege = ledger.pointEntries.filter(
          (entry) => entry.disciplineId === "mini-dm" && entry.pointSource === "battle_mode_mini_dm_ffa_player_score",
        );
        expect(miniDmFfaEintraege.length).toBeGreaterThan(0);
        for (const entry of miniDmFfaEintraege) {
          expect(entry.playerId).toBeTruthy();
          expect(typeof entry.points).toBe("number");
        }
        // Erwartete Untergrenze: jedes Pod-Team hat `k` gesetzte Rollen (die KI fuellt alle), also
        // mindestens `pods.length * 4 * k` Performance-Zeilen -- von denen landen alle MIT echter
        // Teilnahme als Mini-DM-FFA-Ledger-Eintrag (s. `derivePlayerPointsForDuellGroup()`).
        expect(miniDmFfaEintraege.length).toBeGreaterThanOrEqual(pods.length * 4 * k * 0.5);

        // (4) Laufzeit wird gemessen -- grobe Plausibilitaetsschranke (echtes Chromium braucht
        // mehrere Sekunden Seiten-/Motor-Start, darf aber nicht den ganzen Test-Timeout fressen).
        expect(laufzeitMs).toBeGreaterThan(200);
        expect(laufzeitMs).toBeLessThan(LAUF_TIMEOUT_MS);
      },
      LAUF_TIMEOUT_MS,
    );
  },
);
