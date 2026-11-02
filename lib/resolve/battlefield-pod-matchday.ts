/**
 * BATTLEFIELD-POD-SPIELTAG (02.11. abends, docs/design/battlefield-pod-ffa-02-11.md Abschnitt 7).
 *
 * DIE EINE STELLE, DIE DAS GEFECHT JE ORT FUER BATTLEFIELD PRODUKTIV ANWIRFT — dieselbe Rolle wie
 * `runMiniDmFfaMatchday()` (mini-dm-ffa-matchday.ts) fuer Mini-DM. Nimmt die Pods EINES Spieltags
 * (`getPodsForMatchday(..., "battlefield")`, dieselbe Quelle wie Spielplan, PPS-Pod und Arena-Host),
 * laesst sie mit echter Aufstellung, echtem k und dem echten Mutator-Wurf durch den Motor laufen
 * (`runBattlefieldPodFixtures()`) und uebersetzt das Ergebnis in `BattlefieldPodRohdaten` — die Form,
 * die `berechneMiniDmPodOverrides({ battlefieldRohdatenByPodId })` bucht.
 *
 * TEILNAHME: der Motor spielt je Team die gesetzten Battlefield-Spieler (`place[n].d ===
 * "battlefield"`, s. `bfPodBau()`), ohne jede Battlefield-Aufstellung die besten k nach Eignung. Ein
 * Pod, in dem ein Team GAR KEINE Battlefield-Aufstellung hat, wird NICHT aus dem Motor gebucht (es
 * kaempfte ein Ersatzkader, den der Manager nie aufgestellt hat) — er faellt mit Warnung auf den
 * bisherigen Pfad zurueck (PPS-Pod bzw. PPS-Duell-Bruecke, wie heute). Spieler-PP bekommen nur
 * aufgestellte Spieler, wie bei Mini-DM.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import {
  runBattlefieldPodFixtures,
  type BattlefieldPodFixtureInput,
  type BattlefieldPodFixtureResult,
  type RunBattlefieldPodFixturesOptions,
} from "@/lib/battle/arena-headless-runner";
import { buildBattlefieldPodMatchSeed } from "@/lib/battle/arena-seed";
import { getPodsForMatchday, resolvePodPlayerCountForMatchday, type MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";
import { BATTLEFIELD_DISCIPLINE_ID } from "@/lib/season/season-discipline-schedule";
import {
  ppAusBattlefieldPodWertung,
  resolveBattlefieldPodSpielerPpReferenz,
  type BattlefieldPodRohdaten,
} from "@/lib/resolve/mini-dm-pod-resolve";

/** Namen der fuer Battlefield gesetzten Spieler eines Teams — dieselbe Pruefung wie `bfPodBau()` im Motor. */
function gesetzteBattlefieldNamen(gameState: GameState, teamId: string, matchdayId: string): Set<string> {
  const aufstellung = buildArenaAufstellung(gameState, teamId, matchdayId);
  const namen = new Set<string>();
  for (const [name, eintrag] of Object.entries(aufstellung)) {
    if (eintrag.d === BATTLEFIELD_DISCIPLINE_ID) namen.add(name);
  }
  return namen;
}

/**
 * Strukturpruefung des Motor-Ergebnisses VOR der Uebersetzung: genau die vier Pod-Teams, Plaetze
 * 1..4, je Team mindestens ein Kaempfer im Boxscore und hoechstens k. `null` = in Ordnung, sonst
 * eine Warnung (der Pod wird dann verworfen und faellt auf den bisherigen Pfad zurueck).
 */
export function pruefeBattlefieldMotorErgebnis(
  pod: Pick<MiniDmPod, "id" | "teamIds">,
  k: number,
  ergebnis: BattlefieldPodFixtureResult,
): string | null {
  const erwartet = new Set<string>(pod.teamIds);
  const gesehen = new Set<string>();
  for (const team of ergebnis.teams) {
    if (!erwartet.has(team.teamId) || gesehen.has(team.teamId)) return `battlefield_pod_fremdes_team:${pod.id}:${team.teamId}`;
    gesehen.add(team.teamId);
    if (!Number.isInteger(team.eventPlatz) || team.eventPlatz < 1 || team.eventPlatz > 4) {
      return `battlefield_pod_platz_ungueltig:${pod.id}:${team.teamId}`;
    }
  }
  if (gesehen.size !== 4) return `battlefield_pod_unvollstaendig:${pod.id}:${gesehen.size}/4`;
  for (const teamId of pod.teamIds) {
    const kopf = ergebnis.boxscore.filter((eintrag) => eintrag.teamId === teamId).length;
    if (kopf < 1 || kopf > k) return `battlefield_pod_kopfzahl:${pod.id}:${teamId}:${kopf}/${k}`;
  }
  return null;
}

export type RunBattlefieldPodMatchdayInput = {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  /** Default `getPodsForMatchday(gameState, matchdayId, "battlefield", {saveId})` — ueberschreibbar fuer Tests. */
  pods?: readonly MiniDmPod[];
  /** Default `resolvePodPlayerCountForMatchday(gameState, matchdayId, "battlefield", {saveId})`. */
  playerCount?: number | null;
  mutatorTraits?: readonly string[];
  runBattlefieldPodFixturesImpl?: typeof runBattlefieldPodFixtures;
  runBattlefieldPodFixturesOptions?: Omit<RunBattlefieldPodFixturesOptions, "k" | "mutatoren" | "matchdayId">;
};

export type RunBattlefieldPodMatchdayErgebnis = {
  rohdatenByPodId: Map<string, BattlefieldPodRohdaten>;
  /** `playerId -> PP` ueber alle Pods des Spieltags (nur aufgestellte Spieler). */
  playerPpsByPlayerId: Map<string, number>;
  warnings: string[];
};

/**
 * DER HAUPTAUFRUF: alle Battlefield-Pods eines Spieltags in EINEM Motor-Batch. `null` nur bei
 * struktureller Unmoeglichkeit (keine Pods, kein gueltiges k) — ein Teilausfall laesst
 * `rohdatenByPodId` einfach unvollstaendig.
 */
export async function runBattlefieldPodMatchday(input: RunBattlefieldPodMatchdayInput): Promise<RunBattlefieldPodMatchdayErgebnis | null> {
  const pods = input.pods ?? getPodsForMatchday(input.gameState, input.matchdayId, BATTLEFIELD_DISCIPLINE_ID, { saveId: input.saveId });
  if (pods.length === 0) return null;
  const k =
    input.playerCount ?? resolvePodPlayerCountForMatchday(input.gameState, input.matchdayId, BATTLEFIELD_DISCIPLINE_ID, { saveId: input.saveId });
  if (k == null || !Number.isInteger(k) || k < 2 || k > 6) return null;

  const fixtureInputs: BattlefieldPodFixtureInput[] = pods.map((pod) => ({
    podId: pod.id,
    teamIds: pod.teamIds,
    seed: buildBattlefieldPodMatchSeed({ saveId: input.saveId, seasonId: input.seasonId, matchdayId: input.matchdayId, podId: pod.id }),
  }));
  const runImpl = input.runBattlefieldPodFixturesImpl ?? runBattlefieldPodFixtures;
  const ergebnisse = await runImpl(input.gameState, fixtureInputs, {
    ...input.runBattlefieldPodFixturesOptions,
    mutatoren: input.mutatorTraits ? [...input.mutatorTraits] : undefined,
    k,
    matchdayId: input.matchdayId,
  });

  const rohdatenByPodId = new Map<string, BattlefieldPodRohdaten>();
  const playerPpsByPlayerId = new Map<string, number>();
  const warnings: string[] = [];
  const referenz = resolveBattlefieldPodSpielerPpReferenz(k);

  pods.forEach((pod, index) => {
    const ergebnis = ergebnisse[index] ?? null;
    if (!ergebnis) {
      warnings.push(`battlefield_pod_ohne_ergebnis:${pod.id}`);
      return;
    }
    const fehler = pruefeBattlefieldMotorErgebnis(pod, k, ergebnis);
    if (fehler) {
      warnings.push(fehler);
      return;
    }
    const gesetztJeTeam = new Map(pod.teamIds.map((teamId) => [teamId, gesetzteBattlefieldNamen(input.gameState, teamId, input.matchdayId)] as const));
    const ohneAufstellung = pod.teamIds.filter((teamId) => (gesetztJeTeam.get(teamId)?.size ?? 0) === 0);
    if (ohneAufstellung.length > 0) {
      warnings.push(`battlefield_pod_team_ohne_aufstellung:${pod.id}:${ohneAufstellung.join(",")}`);
      return;
    }
    rohdatenByPodId.set(pod.id, {
      podId: pod.id,
      teamIds: pod.teamIds,
      playerCount: k,
      teams: ergebnis.teams.map((team) => ({
        teamId: team.teamId,
        eventPlatz: team.eventPlatz,
        punkte: team.punkte,
        lebend: team.lebend,
        wertung: team.wertung,
      })),
    });
    for (const eintrag of ergebnis.boxscore) {
      if (!eintrag.playerId || !eintrag.teamId) continue;
      if (!gesetztJeTeam.get(eintrag.teamId)?.has(eintrag.name)) continue;
      playerPpsByPlayerId.set(eintrag.playerId, ppAusBattlefieldPodWertung(eintrag.wertung, referenz));
    }
  });

  return { rohdatenByPodId, playerPpsByPlayerId, warnings };
}
