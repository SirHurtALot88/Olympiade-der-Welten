/**
 * MINI-DM-FFA-SPIELTAG-ORCHESTRIERUNG (PR 5 des 6-PR-Opus-Plans 21.10., "Vorlauf-Verdrahtung").
 *
 * DIE EINE STELLE, DIE DEN FFA-KAMPFMOTOR FUER MINI-DM PRODUKTIV ANWIRFT. Vorher (PR A #1299, PR 2
 * #1302, PR 4 #1301) gab es den Motor (`runMiniDmFfaPodFixtures()`, arena-headless-runner.ts) und
 * die Buchungsformel (`berechneMiniDmFfaPodOverride()`, mini-dm-pod-resolve.ts) schon — aber keinen
 * Aufrufer, der beide verbindet. Diese Datei ist diese Verbindung: nimmt die Pods EINES
 * Mini-DM-Spieltags, laesst sie mit der ECHTEN Aufstellung und dem ECHTEN Spieltags-k (2..6) durch
 * den Kampfmotor laufen, und uebersetzt das Ergebnis in `MiniDmFfaPodRohdaten` — die Form, die
 * `berechneMiniDmPodOverrides({ ffaRohdatenByPodId })` (PR 4) erwartet.
 *
 * TEILNAHME a(t,r) KOMMT AUS DER ECHTEN AUFSTELLUNG, NICHT AUS DEM MOTOR-BOXSCORE. Der Motor selbst
 * (`spieleMiniDmFfaEvent()`/`mdffaWaehleVier()`, battle-mode.engine.js) faellt fuer eine Rolle ohne
 * gesetzten Kaempfer auf Eignungs-Reihum zurueck (PR A, "echte Aufstellung UND Spieltagswurf, kein
 * Erzwungen-leer-Resultat") — jedes Team tritt in jeder Runde tatsaechlich an, sonst gaebe es keinen
 * sinnvollen Vierer-Kampf. Die Buchungsformel (mini-dm-pod-resolve.ts, Kopfkommentar zu
 * `MiniDmFfaRundenTeamRohdaten`) will davon aber ausdruecklich NUR die ECHTEN Lineup-Eintraege sehen
 * ("a(t,r) = 1 genau dann, wenn Team t fuer Runde r einen Aufstellungseintrag hat -- KEIN
 * Reihum-Fallback hier, anders als die Praesentationsschicht aus PR A"). Diese Datei haelt diese
 * Trennung ein: sie liest `buildArenaAufstellung()` (dieselbe Funktion, die der Motor-Aufruf selbst
 * als `platzJeTeam` bekommt) UNABHAENGIG vom Motor-Ergebnis, genau wie `mdffaGesetzteRolle()` im
 * Motor es tut (`e.d==="mini-dm"&&MINI_DM_FFA_ROLLEN6.includes(e.slot)`) — und setzt `beitrag` auf 0,
 * sobald diese Pruefung fuer eine Runde/Team negativ ausfaellt, unabhaengig davon, was der Motor dort
 * (ueber den Reihum-Fallback) tatsaechlich simuliert hat. Der Motor-Lauf bleibt trotzdem fuer ALLE
 * vier Teams/alle k Runden ECHT (kein `nurGesetzte`) — die uebrigen drei Teams einer Runde kaempfen
 * schliesslich wirklich gegen diesen Reihum-Kaempfer, das Ergebnis fuer SIE ist nicht erfunden.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import {
  runMiniDmFfaPodFixtures,
  type MiniDmFfaPodFixtureInput,
  type MiniDmFfaPodFixtureResult,
  type RunMiniDmFfaPodFixturesOptions,
} from "@/lib/battle/arena-headless-runner";
import { buildMiniDmFfaPodMatchSeed } from "@/lib/battle/arena-seed";
import { getMiniDmPodsForMatchday, type MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";
import { getSeasonDisciplineScheduleEntry, MINI_DM_DISCIPLINE_ID } from "@/lib/season/season-discipline-schedule";
import {
  MINI_DM_FFA_ROLLEN6,
  ppAusMiniDmFfaBeitrag,
  resolveMiniDmFfaSpielerPpReferenz,
  type MiniDmFfaPodRohdaten,
  type MiniDmFfaRundeRohdaten,
} from "@/lib/resolve/mini-dm-pod-resolve";

/**
 * DER SPIELPLAN-SLOT-K EINES MINI-DM-SPIELTAGS — `null`, wenn an diesem Spieltag gar kein
 * Mini-DM-Slot steht (D1 UND D2 sind etwas anderes) oder der Slot keine gueltige Kadergroesse
 * traegt. Dieselbe Quelle wie `findMiniDmOccurrenceForMatchday()` (mini-dm-pod-schedule.ts) --
 * EIGENSTAENDIGE, kleine Kopie statt eines Imports von dort, weil jene Funktion privat ist und nur
 * das Vorkommen (1|2) liefert, nicht den Spieler-Zahl-Wert selbst. `legacyScorePlayerCount` zuerst
 * (seit PR 1 der 2-6-Spieler-Rueckkehr, 21.10., IDENTISCH zu `playerCount` fuer Mini-DM -- s.
 * Kommentar an `SeasonDisciplineScheduleSlot.legacyScorePlayerCount`, olyDataTypes.ts), `playerCount`
 * als Rueckfall fuer einen aelteren, noch nicht normalisierten Spielplan-Eintrag.
 */
export function resolveMiniDmFfaPlayerCountForMatchday(
  gameState: GameState,
  matchdayId: string,
  options?: { saveId?: string | null },
): number | null {
  const entry = getSeasonDisciplineScheduleEntry(gameState, matchdayId, options);
  if (!entry) return null;
  const slot = [entry.discipline1, entry.discipline2].find((candidate) => candidate?.disciplineId === MINI_DM_DISCIPLINE_ID);
  if (!slot) return null;
  const k = slot.legacyScorePlayerCount ?? slot.playerCount ?? null;
  return Number.isInteger(k) && k != null && k >= 2 && k <= 6 ? k : null;
}

/** Slot-Ids (`MINI_DM_FFA_ROLLEN6.slice(0, k)`, 1-indexiert ueber den Rueckgabe-Index) fuer eine
 *  gegebene Kadergroesse -- dieselbe Teilliste, die der Motor fuer `opt.k` spielt (s.
 *  `MINI_DM_FFA_SLOTS_JE_K`/`MINI_DM_FFA_ROLLEN6`-Spiegeltest, mini-dm-pod-resolve.ts). */
function rollenFuerK(k: number): readonly string[] {
  return MINI_DM_FFA_ROLLEN6.slice(0, k);
}

/** `teamId -> Set<slotId>`, fuer DIESES Team explizit im Aufstellungsentwurf gesetzte Mini-DM-Rollen
 *  -- exakt dieselbe Pruefung wie `mdffaGesetzteRolle()` im Motor (battle-mode.engine.js):
 *  `place[name].d === "mini-dm" && MINI_DM_FFA_ROLLEN6.includes(place[name].slot)`. */
function baueGesetzteRollenFuerTeam(gameState: GameState, teamId: string, matchdayId: string): Set<string> {
  const aufstellung = buildArenaAufstellung(gameState, teamId, matchdayId);
  const gesetzt = new Set<string>();
  for (const eintrag of Object.values(aufstellung)) {
    if (eintrag.d === MINI_DM_DISCIPLINE_ID && MINI_DM_FFA_ROLLEN6.includes(eintrag.slot as (typeof MINI_DM_FFA_ROLLEN6)[number])) {
      gesetzt.add(eintrag.slot);
    }
  }
  return gesetzt;
}

/**
 * EIN Motor-Ergebnis (`MiniDmFfaPodFixtureResult`, bereits ECHTE k Runden mit `k`-spezifischen
 * Rollen) -> `MiniDmFfaPodRohdaten` -- UNTER ANWENDUNG der Teilnahme-Pruefung aus der ECHTEN
 * Aufstellung (s. Datei-Kopfkommentar). Der `boxscore` ist flach ueber alle Runden/Teams, deshalb
 * zuerst zu `(slotId, teamId) -> beitrag` indiziert.
 */
function uebersetzeMotorErgebnisZuRohdaten(
  gameState: GameState,
  matchdayId: string,
  pod: Pick<MiniDmPod, "id" | "teamIds">,
  k: number,
  ergebnis: MiniDmFfaPodFixtureResult,
): MiniDmFfaPodRohdaten {
  const gesetzteRollenJeTeam = new Map(pod.teamIds.map((teamId) => [teamId, baueGesetzteRollenFuerTeam(gameState, teamId, matchdayId)] as const));
  const beitragByRoleAndTeam = new Map<string, number>();
  for (const eintrag of ergebnis.boxscore) {
    if (!eintrag.teamId) continue;
    beitragByRoleAndTeam.set(`${eintrag.slotId}|${eintrag.teamId}`, eintrag.beitrag);
  }

  const rollen = rollenFuerK(k);
  const runden: MiniDmFfaRundeRohdaten[] = rollen.map((rolle, index) => ({
    runde: index + 1,
    rolle,
    teams: pod.teamIds.map((teamId) => {
      const teilnahme = gesetzteRollenJeTeam.get(teamId)?.has(rolle) ?? false;
      return {
        teamId,
        teilnahme,
        beitrag: teilnahme ? beitragByRoleAndTeam.get(`${rolle}|${teamId}`) ?? 0 : 0,
      };
    }),
  }));

  return { podId: pod.id, teamIds: pod.teamIds, playerCount: k, runden };
}

/** `playerId -> PP`, nur fuer Spieler mit mindestens einer ECHT gesetzten Runde (s.
 *  `ppAusMiniDmFfaBeitrag()`-Kommentar, mini-dm-pod-resolve.ts: "Wer NICHT aufgestellt ist, bekommt
 *  keine PP"). Ein Spieler kann nur in GENAU einer Rolle/einem Slot stehen (`buildArenaAufstellung()`
 *  schluesselt `{d, slot}` eindeutig je Name), also hoechstens ein Boxscore-Eintrag je Spieler. */
function berechnePlayerPpsAusMotorErgebnis(
  pod: Pick<MiniDmPod, "id" | "teamIds">,
  k: number,
  ergebnis: MiniDmFfaPodFixtureResult,
  gesetzteRollenJeTeam: ReadonlyMap<string, Set<string>>,
): Map<string, number> {
  const referenz = resolveMiniDmFfaSpielerPpReferenz(k);
  const ppByPlayerId = new Map<string, number>();
  for (const eintrag of ergebnis.boxscore) {
    if (!eintrag.playerId || !eintrag.teamId) continue;
    const gesetzt = gesetzteRollenJeTeam.get(eintrag.teamId)?.has(eintrag.slotId) ?? false;
    if (!gesetzt) continue; // Reihum-Fallback-Kaempfer bekommt KEINE PP, s. Datei-Kopfkommentar.
    ppByPlayerId.set(eintrag.playerId, ppAusMiniDmFfaBeitrag(eintrag.beitrag, referenz));
  }
  return ppByPlayerId;
}

export type RunMiniDmFfaMatchdayInput = {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  /** Default `getMiniDmPodsForMatchday(gameState, matchdayId, {saveId})` — ueberschreibbar fuer Tests. */
  pods?: readonly MiniDmPod[];
  /** Default `resolveMiniDmFfaPlayerCountForMatchday(gameState, matchdayId)`. */
  playerCount?: number | null;
  mutatorTraits?: readonly string[];
  runMiniDmFfaPodFixturesImpl?: typeof runMiniDmFfaPodFixtures;
  runMiniDmFfaPodFixturesOptions?: Omit<RunMiniDmFfaPodFixturesOptions, "k" | "mutatoren">;
};

export type RunMiniDmFfaMatchdayErgebnis = {
  /** Pods, fuer die ein VOLLSTAENDIGES, strukturell gueltiges Ergebnis vorliegt -- ein fehlender
   *  Eintrag (z.B. ein Team ganz ohne einsatzfaehigen Kader) faellt beim Aufrufer defensiv auf den
   *  bestehenden PPS-Pod-Pfad zurueck (`berechneMiniDmPodOverrides()`, PR 4), GENAUSO wie ein Pod
   *  ganz ohne FFA-Rohdaten. */
  rohdatenByPodId: Map<string, MiniDmFfaPodRohdaten>;
  /** `playerId -> PP` ueber ALLE Pods dieses Spieltags zusammen (Team-IDs sind pod-eindeutig, nicht
   *  Spieler-IDs global -- aber ein Spieler steht an einem Spieltag in genau EINEM Pod). */
  playerPpsByPlayerId: Map<string, number>;
  warnings: string[];
};

/**
 * DER HAUPTAUFRUF. Laeuft ALLE Pods eines Mini-DM-Spieltags in EINEM Motor-Batch (dieselbe
 * Chromium-Seite, s. `runMiniDmFfaPodFixtures()`). `null`-Rueckgabe NUR bei einer strukturellen
 * Unmoeglichkeit (kein gueltiges k, keine Pods) — ein TEILAUSFALL (ein einzelner Pod ohne
 * einsatzfaehigen Kader) bleibt `rohdatenByPodId` einfach unvollstaendig, kein Fehler, kein `null`.
 */
export async function runMiniDmFfaMatchday(input: RunMiniDmFfaMatchdayInput): Promise<RunMiniDmFfaMatchdayErgebnis | null> {
  const pods = input.pods ?? getMiniDmPodsForMatchday(input.gameState, input.matchdayId, { saveId: input.saveId });
  if (pods.length === 0) {
    return null;
  }
  const k = input.playerCount ?? resolveMiniDmFfaPlayerCountForMatchday(input.gameState, input.matchdayId, { saveId: input.saveId });
  if (k == null || !Number.isInteger(k) || k < 2 || k > 6) {
    return null;
  }

  const fixtureInputs: MiniDmFfaPodFixtureInput[] = pods.map((pod) => ({
    podId: pod.id,
    teamIds: pod.teamIds,
    seed: buildMiniDmFfaPodMatchSeed({ saveId: input.saveId, seasonId: input.seasonId, matchdayId: input.matchdayId, podId: pod.id }),
  }));

  const runImpl = input.runMiniDmFfaPodFixturesImpl ?? runMiniDmFfaPodFixtures;
  const ergebnisse = await runImpl(input.gameState, fixtureInputs, {
    ...input.runMiniDmFfaPodFixturesOptions,
    mutatoren: input.mutatorTraits ? [...input.mutatorTraits] : undefined,
    k,
    // AUFSTELLUNG ECHT (PR A, Default -- hier nicht ueberschrieben): der Motor braucht die reale
    // Aufstellung als `platzJeTeam`, DAMIT die Reihum-Auswahl ueberhaupt die richtigen Spieler
    // uebrig laesst/ausschliesst. Die Teilnahme-Pruefung DIESER Datei (s. Kopfkommentar) ist davon
    // unabhaengig -- sie liest dieselbe Aufstellung noch einmal direkt, nicht ueber den Motor.
  });

  const rohdatenByPodId = new Map<string, MiniDmFfaPodRohdaten>();
  const playerPpsByPlayerId = new Map<string, number>();
  const warnings: string[] = [];

  pods.forEach((pod, index) => {
    const ergebnis = ergebnisse[index] ?? null;
    if (!ergebnis) {
      warnings.push(`mini_dm_ffa_matchday_pod_ohne_ergebnis:${pod.id}`);
      return;
    }
    rohdatenByPodId.set(pod.id, uebersetzeMotorErgebnisZuRohdaten(input.gameState, input.matchdayId, pod, k, ergebnis));
    const gesetzteRollenJeTeam = new Map(pod.teamIds.map((teamId) => [teamId, baueGesetzteRollenFuerTeam(input.gameState, teamId, input.matchdayId)] as const));
    for (const [playerId, pp] of berechnePlayerPpsAusMotorErgebnis(pod, k, ergebnis, gesetzteRollenJeTeam)) {
      playerPpsByPlayerId.set(playerId, pp);
    }
  });

  return { rohdatenByPodId, playerPpsByPlayerId, warnings };
}
