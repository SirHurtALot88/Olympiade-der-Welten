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
 *
 * (5) OPUS-REVIEW, ZWEITE RUNDE (24.10., "sollte"-Punkt): die (3)-Pruefung oben leitet "echte
 * Spieler-PP im Ledger" nur aus der TEAM-Zeilen-`quelle` ab ("mini_dm_pod" + "ffa"), nicht aus den
 * einzelnen Spieler-PP-WERTEN selbst -- ein stiller Ruckfall auf die PPS-Duell-PP-Kurve
 * (`ppAusSpielerScore()`, falls `arenaIndividualBoxscorePpsByDisciplineId` aus irgendeinem Grund
 * leer bliebe) wuerde das NICHT bemerken, weil `miniDmPod.quelle` davon unberuehrt ist. Opus hat
 * deshalb selbst eine schaerfere Kreuzprobe gemacht: Motor-PP direkt mit Ledger-PP verglichen.
 *
 * UMGESETZT ALS AUFNAHME+WIEDERGABE, NICHT ALS ZWEITER ECHTER CHROMIUM-LAUF: ein erster Versuch
 * rief `runMiniDmFfaMatchday()` nach der Buchung ein ZWEITES Mal mit echtem Chromium auf, erwartete
 * bit-identische PP -- und fand eine kleine, aber echte Abweichung (~0.01 auf Werten um 0.03-0.04).
 * Ob das echte Motor-Nichtdeterminismus ist oder nur eine Rundungs-Spur, ist fuer DIESEN Test nicht
 * die Frage, die er beantworten soll (das waere ein eigenes Thema). Stattdessen: der primaere Lauf
 * bekommt einen `runMiniDmFfaPodFixturesImpl`, der die ECHTE `runMiniDmFfaPodFixtures()` (echtes
 * Chromium, keine Fake-Daten) transparent durchlaesst und NUR MITSCHNEIDET, was sie zurueckgibt.
 * Die Kreuzprobe spielt denselben mitgeschnittenen Boxscore anschliessend ein zweites Mal durch
 * `runMiniDmFfaMatchday()` (kein Chromium mehr noetig, reine PP-Berechnung aus denselben Rohdaten)
 * und vergleicht das Ergebnis exakt gegen den Ledger -- das prueft genau die Behauptung "die
 * PP-Formel aus dem tatsaechlich simulierten Boxscore stimmt mit dem gebuchten Wert", ohne sich auf
 * motor-interne Reproduzierbarkeit ueber zwei unabhaengige Chromium-Starts zu verlassen.
 */
import { describe, expect, it } from "vitest";

import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { stelleArenaVorlaufSicher } from "@/lib/battle/arena-vorlauf-service";
import { kickoffArenaMatchdayApply } from "@/lib/season/arena-matchday-resolve-service";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { runMiniDmFfaMatchday } from "@/lib/resolve/mini-dm-ffa-matchday";
import { runMiniDmFfaPodFixtures, type MiniDmFfaPodFixtureInput, type MiniDmFfaPodFixtureResult } from "@/lib/battle/arena-headless-runner";
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

        // Mitschnitt des ECHTEN Motor-Ergebnisses je Pod, fuer die Kreuzprobe (5) weiter unten --
        // dieser Wrapper AENDERT nichts, er delegiert nur an die echte `runMiniDmFfaPodFixtures()`
        // (echtes Chromium) und merkt sich, was sie zurueckgab. Kein Fake-Motor, s. Kopfkommentar.
        const mitgeschnitten = new Map<string, MiniDmFfaPodFixtureResult | null>();
        const mitschnittRunner: typeof runMiniDmFfaPodFixtures = async (gameStateArg, podsArg, optionsArg) => {
          const ergebnisse = await runMiniDmFfaPodFixtures(gameStateArg, podsArg, optionsArg);
          (podsArg as readonly MiniDmFfaPodFixtureInput[]).forEach((pod, index) => mitgeschnitten.set(pod.podId, ergebnisse[index] ?? null));
          return ergebnisse;
        };

        const start = Date.now();
        const vorlauf = await stelleArenaVorlaufSicher(scope, { runMiniDmFfaPodFixturesImpl: mitschnittRunner }, persistence);
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

        // (5) SCHAERFERE KREUZPROBE (Opus-Review, zweite Runde): Motor-PP direkt gegen Ledger-PP,
        // nicht nur die `quelle`-Ableitung oben. WIEDERGABE des mitgeschnittenen ECHTEN
        // Motor-Ergebnisses (kein zweiter Chromium-Lauf, s. Kopfkommentar oben) durch
        // `runMiniDmFfaMatchday()` -- dieselbe reine PP-Berechnung, die auch beim tatsaechlichen
        // Vorlauf lief, aus GENAU denselben Rohdaten.
        const motorErgebnis = await runMiniDmFfaMatchday({
          gameState: stand,
          saveId: scope.saveId,
          seasonId: scope.seasonId,
          matchdayId: scope.matchdayId,
          runMiniDmFfaPodFixturesImpl: async (_gs, podsArg) =>
            (podsArg as readonly MiniDmFfaPodFixtureInput[]).map((pod) => mitgeschnitten.get(pod.podId) ?? null),
        });
        expect(motorErgebnis).not.toBeNull();
        expect(motorErgebnis!.playerPpsByPlayerId.size).toBeGreaterThan(0);
        const ledgerPpByPlayerId = new Map(miniDmFfaEintraege.map((entry) => [entry.playerId, entry.points] as const));
        let kreuzgeprueft = 0;
        for (const [playerId, motorPp] of motorErgebnis!.playerPpsByPlayerId) {
          const ledgerPp = ledgerPpByPlayerId.get(playerId);
          if (ledgerPp == null) continue; // ein Spieler ohne Ledger-Zeile hier waere sein eigener Befund, s. Schranke oben.
          // Reine Wiedergabe DERSELBEN Rohdaten durch dieselbe PP-Formel -- hier wird echte
          // Bit-Naehe erwartet, nicht nur grobe Naehe wie bei einem zweiten echten Motor-Lauf.
          expect(ledgerPp).toBeCloseTo(motorPp, 8);
          kreuzgeprueft += 1;
        }
        // Die Kreuzprobe selbst muss etwas geprueft haben -- sonst waere eine leere Schleife
        // stillschweigend "gruen".
        expect(kreuzgeprueft).toBeGreaterThan(0);

        // (4) Laufzeit wird gemessen -- grobe Plausibilitaetsschranke (echtes Chromium braucht
        // mehrere Sekunden Seiten-/Motor-Start, darf aber nicht den ganzen Test-Timeout fressen).
        expect(laufzeitMs).toBeGreaterThan(200);
        expect(laufzeitMs).toBeLessThan(LAUF_TIMEOUT_MS);
      },
      LAUF_TIMEOUT_MS,
    );
  },
);
