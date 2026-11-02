/**
 * BAHN-POD-SPIELTAG (Liga-Verdrahtung 02.11., docs/design/bahn-pod-vier-teams-01-11.md Abschnitt 6).
 *
 * Die eine Stelle, die das echte Vier-Team-Rennen fuer Takeshi's Castle bzw. Staffel produktiv
 * anwirft -- nach dem Muster von `runMiniDmFfaMatchday()` (mini-dm-ffa-matchday.ts): Pods des
 * Spieltags aus `getPodsForMatchday(..., disciplineId)` (dieselbe Quelle wie Spielplan-Tab, Resolve
 * und Arena-Anzeige), Saat je Pod `buildBahnPodMatchSeed()`, Aufstellung je Team aus dem echten
 * Spieltagsentwurf (`buildArenaAufstellung()` im Runner), k aus dem Spielplan-Slot. Ergebnis in der
 * Form, die `berechneBahnPodOverrides()` (bahn-pod-resolve.ts) bucht, plus Spieler-PP aus dem
 * Boxscore des Rennens (Impact-Kurve gegen die Pod-Referenz).
 *
 * Ein strukturell unvollstaendiges Ergebnis verwirft GENAU diesen Pod (Warnung, PPS-Pod-Rueckfall in
 * der Engine), nicht den Spieltag.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  runBahnPodFixtures,
  type BahnPodFixtureInput,
  type BahnPodFixtureResult,
  type RunBahnPodFixturesOptions,
} from "@/lib/battle/arena-headless-runner";
import { buildBahnPodMatchSeed } from "@/lib/battle/arena-seed";
import { getPodsForMatchday, resolvePodPlayerCountForMatchday, type MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";
import {
  istBahnPodDisziplin,
  ppAusBahnPodWert,
  resolveBahnPodSpielerPpReferenz,
  type BahnPodRohdaten,
} from "@/lib/resolve/bahn-pod-resolve";

export type RunBahnPodMatchdayInput = {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  disciplineId: string;
  /** Default `getPodsForMatchday(gameState, matchdayId, disciplineId, {saveId})` -- ueberschreibbar fuer Tests. */
  pods?: readonly MiniDmPod[];
  /** Default `resolvePodPlayerCountForMatchday(...)`. */
  playerCount?: number | null;
  mutatorTraits?: readonly string[];
  runBahnPodFixturesImpl?: typeof runBahnPodFixtures;
  runBahnPodFixturesOptions?: Omit<RunBahnPodFixturesOptions, "k" | "mutatoren" | "matchdayId">;
};

export type RunBahnPodMatchdayErgebnis = {
  rohdatenByPodId: Map<string, BahnPodRohdaten>;
  /** `playerId -> PP` ueber alle Pods (ein Spieler laeuft an einem Spieltag in genau einem Pod). */
  playerPpsByPlayerId: Map<string, number>;
  warnings: string[];
  /** k, mit dem gerechnet wurde (Spielplan-Slot), fuer Hash/Diagnose. */
  playerCount: number | null;
};

/**
 * Prueft ein Motor-Ergebnis gegen seinen Pod: genau die vier Teams, je Team ein gueltiger Platz und
 * mindestens ein Laeufer im Boxscore, keine fremden Teams. Liefert eine Fehlermeldung oder `null`.
 */
export function pruefeBahnPodErgebnis(pod: Pick<MiniDmPod, "id" | "teamIds">, ergebnis: BahnPodFixtureResult): string | null {
  const erwartet = new Set(pod.teamIds);
  if (ergebnis.teams.length !== 4) return `bahn_pod_teamzahl:${pod.id}:${ergebnis.teams.length}`;
  const gesehen = new Set<string>();
  for (const team of ergebnis.teams) {
    if (!erwartet.has(team.teamId)) return `bahn_pod_fremdes_team:${pod.id}:${team.teamId}`;
    if (gesehen.has(team.teamId)) return `bahn_pod_doppeltes_team:${pod.id}:${team.teamId}`;
    gesehen.add(team.teamId);
    if (!Number.isInteger(team.eventPlatz) || team.eventPlatz < 1 || team.eventPlatz > 4) {
      return `bahn_pod_platz_ungueltig:${pod.id}:${team.teamId}`;
    }
  }
  for (const teamId of pod.teamIds) {
    if (!ergebnis.boxscore.some((eintrag) => eintrag.teamId === teamId)) return `bahn_pod_team_ohne_laeufer:${pod.id}:${teamId}`;
  }
  if (ergebnis.boxscore.some((eintrag) => eintrag.teamId == null || !erwartet.has(eintrag.teamId))) {
    return `bahn_pod_fremder_laeufer:${pod.id}`;
  }
  return null;
}

function uebersetze(pod: MiniDmPod, disciplineId: string, k: number | null, ergebnis: BahnPodFixtureResult): BahnPodRohdaten {
  const zeit = disciplineId === "staffel";
  return {
    podId: pod.id,
    disciplineId,
    teamIds: pod.teamIds,
    playerCount: k,
    teams: ergebnis.teams.map((team) => ({
      teamId: team.teamId,
      eventPlatz: team.eventPlatz,
      teamWert: zeit ? team.zielzeit : team.wert,
    })),
  };
}

/** `null` nur, wenn diese Disziplin gar kein Bahn-Pod ist oder an diesem Spieltag keine Pods hat. */
export async function runBahnPodMatchday(input: RunBahnPodMatchdayInput): Promise<RunBahnPodMatchdayErgebnis | null> {
  if (!istBahnPodDisziplin(input.disciplineId)) return null;
  const pods = input.pods ?? getPodsForMatchday(input.gameState, input.matchdayId, input.disciplineId, { saveId: input.saveId });
  if (pods.length === 0) return null;
  const k =
    input.playerCount !== undefined
      ? input.playerCount
      : resolvePodPlayerCountForMatchday(input.gameState, input.matchdayId, input.disciplineId, { saveId: input.saveId });

  const fixtureInputs: BahnPodFixtureInput[] = pods.map((pod) => ({
    podId: pod.id,
    teamIds: pod.teamIds,
    seed: buildBahnPodMatchSeed({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      disciplineId: input.disciplineId,
      podId: pod.id,
    }),
  }));

  const runImpl = input.runBahnPodFixturesImpl ?? runBahnPodFixtures;
  const ergebnisse = await runImpl(input.gameState, input.disciplineId, fixtureInputs, {
    ...input.runBahnPodFixturesOptions,
    mutatoren: input.mutatorTraits ? [...input.mutatorTraits] : undefined,
    k,
    matchdayId: input.matchdayId,
  });

  const referenz = resolveBahnPodSpielerPpReferenz(input.disciplineId, k);
  const rohdatenByPodId = new Map<string, BahnPodRohdaten>();
  const playerPpsByPlayerId = new Map<string, number>();
  const warnings: string[] = [];
  if (!referenz) warnings.push(`bahn_pod_spieler_referenz_fehlt:${input.disciplineId}:${k ?? "?"}`);

  pods.forEach((pod, index) => {
    const ergebnis = ergebnisse[index] ?? null;
    if (!ergebnis) {
      warnings.push(`bahn_pod_ohne_ergebnis:${pod.id}`);
      return;
    }
    const fehler = pruefeBahnPodErgebnis(pod, ergebnis);
    if (fehler) {
      warnings.push(fehler);
      return;
    }
    rohdatenByPodId.set(pod.id, uebersetze(pod, input.disciplineId, k, ergebnis));
    for (const eintrag of ergebnis.boxscore) {
      if (!eintrag.playerId) continue;
      playerPpsByPlayerId.set(eintrag.playerId, ppAusBahnPodWert(eintrag.wert, referenz));
    }
  });

  return { rohdatenByPodId, playerPpsByPlayerId, warnings, playerCount: k };
}
