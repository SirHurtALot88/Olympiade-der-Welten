/**
 * BAHN-POD-RESOLVE (Liga-Verdrahtung 02.11., docs/design/bahn-pod-vier-teams-01-11.md Abschnitt 6).
 *
 * Takeshi's Castle und Staffel stehen seit 02.11. in `VIERER_POD_DISCIPLINE_IDS`: an jedem Spieltag,
 * an dem sie laufen, werden sie als Vierergruppe (Pod, `getPodsForMatchday()`) gewertet, Liga-Punkte
 * 2-1-0-0 nach Platz. ANDERS ALS BATTLEFIELD (PPS-Pod, der Vier-Team-Motor fiel in der Abnahme durch)
 * und wie Mini-DM bucht die Liga hier das ERGEBNIS DES ECHTEN MOTORS: das Vier-Team-Rennen
 * (`__arena.spieleBahnPod`) besteht im Pod-Format beide Pflichtpruefungen (rho 0,84-0,93 je Rennen
 * bei jeder Kadergroesse, Pp 9,3-22,0, s. Dokument Abschnitt 5.3).
 *
 * Diese Datei ist die Buchungsformel, rein und synchron (keine Playwright-/`node:fs`-Importe), damit
 * `legacy-matchday-resolve-engine.ts` sie importieren darf. Die Rohdaten liefert der Vorlauf
 * (`lib/resolve/bahn-pod-matchday.ts` -> `lib/battle/arena-vorlauf-service.ts`). Fehlen sie fuer
 * einen Pod (Vorlauf aus/ausgefallen, Team ohne Kader), faellt GENAU dieser Pod auf den PPS-Pod
 * (`berechneMiniDmPodOverrides()`) zurueck -- nie ein geworfener Fehler, nie ein ungebuchter Spieltag.
 *
 * PLATZ: die Rangfolge des Rennens selbst -- Takeshi nach Burgpunkte-Summe, Staffel nach Zieleinlauf
 * (`eventPlatz` aus dem Motor, `bahnPodErgebnis()`). Ein exakter Gleichstand (bei Takeshi auf eine
 * Nachkommastelle moeglich, bei der Staffel praktisch nie) wird ueber den PPS-Team-Score und zuletzt
 * die Team-ID aufgeloest, damit die Liga-Punkte 2-1-0-0 strikt vergeben werden (wie beim Mini-DM-FFA-
 * Pod: dort teilen die Motor-`ligaPunkte` bei Gleichstand, gebucht wird trotzdem strikt nach Platz).
 *
 * 0-10-WERT (Anzeige, `berechneErgebnisNormiertNTeam`): Luecken aus dem Teamwert des Rennens
 * (Burgpunkte bzw. Zielzeit-Abstand in Sekunden) gegen die gezogene m90 je Kadergroesse
 * (`data/generated/bahn-pod-referenz.json`), Niveau aus dem PPS-Team-Score (dieselbe Quelle wie beim
 * Duell dieser beiden Disziplinen, `niveauAusPps` in der Resolve-Engine, und wie beim Mini-DM-FFA-Pod).
 * `mindestLuecke` 1 ueberall dort, wo sich die Liga-Punkte zweier Nachbarplaetze unterscheiden.
 */
import { ppAusSpielerScore, resolveNiveauReferenz } from "@/lib/resolve/battle-mode-pps-duell";
import { berechneErgebnisNormiertNTeam, MINI_DM_POD_TEAM_PUNKTE, type MiniDmPodOverride } from "@/lib/resolve/mini-dm-pod-resolve";
import type { MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";
import bahnPodReferenzJson from "@/data/generated/bahn-pod-referenz.json";

/** Die zwei Bahn-Disziplinen, die als ECHTES Vier-Team-Rennen gebucht werden (Motor: `BAHN_POD_DISZIPLINEN`). */
export const BAHN_POD_DISCIPLINE_IDS: ReadonlySet<string> = new Set(["takeshis-castle", "staffel"]);

export function istBahnPodDisziplin(disciplineId: string | null | undefined): boolean {
  return disciplineId != null && BAHN_POD_DISCIPLINE_IDS.has(disciplineId);
}

/** Ergebnis EINES Teams in EINEM Pod-Rennen, so wie der Motor es liefert. */
export type BahnPodTeamRohdaten = {
  teamId: string;
  /** Platz 1..4 aus dem Motor (`eventPlatz`, bei exaktem Gleichstand geteilt). */
  eventPlatz: number;
  /** Takeshi: Burgpunkte-Summe. Staffel: Zielzeit in Sim-Sekunden, `null` ohne Zieleinlauf. */
  teamWert: number | null;
};

/** Die Rohdaten EINES Bahn-Pods -- genau die vier `pod.teamIds`. */
export type BahnPodRohdaten = {
  podId: string;
  disciplineId: string;
  teamIds: readonly [string, string, string, string];
  /** k des Spielplan-Slots (2..6) oder `null`, wenn nicht ermittelbar. */
  playerCount: number | null;
  teams: readonly BahnPodTeamRohdaten[];
};

/** Wertung des Rennens: Takeshi mehr Burgpunkte besser, Staffel fruehere Zielzeit besser. */
function istZeitWertung(disciplineId: string): boolean {
  return disciplineId === "staffel";
}

type BahnPodReferenzFeldgroesse = { m90?: number; spieler?: { p50: number; p995: number } };
type BahnPodReferenzJson = { disziplinen?: Record<string, { feldgroessen?: Record<string, BahnPodReferenzFeldgroesse> }> };
const BAHN_POD_REFERENZ = bahnPodReferenzJson as unknown as BahnPodReferenzJson;

function resolveNaechsteBahnPodFeldgroesse(
  disciplineId: string,
  playerCount: number | null | undefined,
  gueltigFilter: (eintrag: BahnPodReferenzFeldgroesse) => boolean,
): BahnPodReferenzFeldgroesse | null {
  const feldgroessen = BAHN_POD_REFERENZ.disziplinen?.[disciplineId]?.feldgroessen;
  if (!feldgroessen) return null;
  const gueltig = Object.entries(feldgroessen)
    .map(([n, eintrag]) => [Number(n), eintrag] as const)
    .filter(([n, eintrag]) => Number.isFinite(n) && Boolean(eintrag) && gueltigFilter(eintrag))
    .sort((a, b) => a[0] - b[0]);
  if (gueltig.length === 0) return null;
  const ziel = typeof playerCount === "number" && Number.isFinite(playerCount) ? Math.round(playerCount) : gueltig[0]![0];
  let bester = gueltig[0]!;
  for (const kandidat of gueltig) {
    if (Math.abs(kandidat[0] - ziel) < Math.abs(bester[0] - ziel)) bester = kandidat;
  }
  return bester[1];
}

/** m90 der Teamwert-Luecken zwischen Nachbarplaetzen je k (Burgpunkte bzw. Sekunden). */
export function resolveBahnPodMargeReferenz(disciplineId: string, playerCount: number | null | undefined): { m90: number } | null {
  const eintrag = resolveNaechsteBahnPodFeldgroesse(disciplineId, playerCount, (e) => Number.isFinite(e.m90) && (e.m90 as number) > 0);
  return eintrag ? { m90: eintrag.m90 as number } : null;
}

/** p50/p99,5 des Laeuferwerts im Pod-Rennen je k -- fuer die Spieler-PP (Impact-Kurve). */
export function resolveBahnPodSpielerPpReferenz(
  disciplineId: string,
  playerCount: number | null | undefined,
): { p50: number; p995: number } | null {
  const eintrag = resolveNaechsteBahnPodFeldgroesse(disciplineId, playerCount, (e) => Boolean(e.spieler) && e.spieler!.p995 > e.spieler!.p50);
  return eintrag?.spieler ?? null;
}

/**
 * SPIELER-PP im Bahn-Pod: dieselbe Impact-Kurve wie Arena-Duell und PPS-Duell (`ppAusSpielerScore`),
 * nur gegen die Pod-Referenz -- der Laeuferwert hat im 4k-Feld eine andere Spannweite als im 2k-Duell
 * (Staffel-Rangpunkte N..1 ueber doppelt so viele Laeufer, Takeshi-Zielbonus nach Platz im groesseren
 * Feld). Rein leistungsbasiert, unabhaengig vom Pod-Platz des eigenen Teams.
 */
export function ppAusBahnPodWert(wert: number | null | undefined, referenz: { p50: number; p995: number } | null): number {
  return ppAusSpielerScore(wert, referenz);
}

function pruefeBahnPodRohdaten(pod: Pick<MiniDmPod, "teamIds">, rohdaten: BahnPodRohdaten): boolean {
  const podTeamIds = new Set(pod.teamIds);
  if (podTeamIds.size !== 4 || rohdaten.teams.length !== 4) return false;
  const rohTeamIds = new Set(rohdaten.teams.map((team) => team.teamId));
  if (rohTeamIds.size !== 4) return false;
  for (const teamId of rohTeamIds) {
    if (!podTeamIds.has(teamId)) return false;
  }
  return rohdaten.teams.every(
    (team) =>
      Number.isInteger(team.eventPlatz) &&
      team.eventPlatz >= 1 &&
      team.eventPlatz <= 4 &&
      (team.teamWert === null || Number.isFinite(team.teamWert)),
  );
}

/**
 * EIN Pod -> die vier Overrides aus dem ECHTEN Rennen (`quelle: "bahn"`). `null` bei strukturell
 * kaputten Rohdaten oder fehlendem PPS-Score eines Teams (fuer Gleichstand und Niveau gebraucht) --
 * der Aufrufer bucht diesen Pod dann ueber den PPS-Pod.
 */
export function berechneBahnPodOverride(input: {
  pod: MiniDmPod;
  rohdaten: BahnPodRohdaten;
  ppsScoreByTeamId: ReadonlyMap<string, number>;
  disciplineId: string;
  playerCount: number | null | undefined;
}): Map<string, MiniDmPodOverride> | null {
  if (!pruefeBahnPodRohdaten(input.pod, input.rohdaten)) return null;
  if (input.pod.teamIds.some((teamId) => !input.ppsScoreByTeamId.has(teamId))) return null;

  const zeit = istZeitWertung(input.disciplineId);
  const rohByTeamId = new Map(input.rohdaten.teams.map((team) => [team.teamId, team] as const));
  const endlicheZeiten = input.rohdaten.teams.map((team) => team.teamWert).filter((w): w is number => w != null && Number.isFinite(w));
  // Ohne Zieleinlauf (kam in der Messung nie vor): hinter dem langsamsten Zieleinlauf, mit Abstand.
  const ohneZielZeit = (endlicheZeiten.length ? Math.max(...endlicheZeiten) : 0) + 10;
  const vergleichswert = (team: BahnPodTeamRohdaten): number =>
    zeit ? -(team.teamWert ?? ohneZielZeit) : team.teamWert ?? 0;

  const sortiertRoh = input.pod.teamIds
    .map((teamId) => {
      const roh = rohByTeamId.get(teamId)!;
      return { teamId, roh, score: vergleichswert(roh), ppsScore: input.ppsScoreByTeamId.get(teamId) ?? 0 };
    })
    .sort((a, b) => {
      if (a.roh.eventPlatz !== b.roh.eventPlatz) return a.roh.eventPlatz - b.roh.eventPlatz;
      if (b.score !== a.score) return b.score - a.score;
      if (b.ppsScore !== a.ppsScore) return b.ppsScore - a.ppsScore;
      return a.teamId.localeCompare(b.teamId);
    });

  const k = input.rohdaten.playerCount ?? input.playerCount ?? null;
  const margeReferenz = resolveBahnPodMargeReferenz(input.disciplineId, k);
  const niveauReferenz = resolveNiveauReferenz("pps", input.disciplineId, input.playerCount);

  const sortiert = sortiertRoh.map((team, index) => {
    const naechster = sortiertRoh[index + 1];
    const eigenePunkte = MINI_DM_POD_TEAM_PUNKTE[index] ?? 0;
    const naechstePunkte = naechster ? MINI_DM_POD_TEAM_PUNKTE[index + 1] ?? 0 : eigenePunkte;
    return {
      teamId: team.teamId,
      // Monoton zur Platzierung: der Teamwert des Rennens kann der Platzierung nach eventPlatz nicht
      // widersprechen (der Motor vergibt den Platz genau danach); bei exaktem Gleichstand traegt die
      // Luecke 0, `mindestLuecke` hebt sie an, sobald die Liga-Punkte verschieden sind.
      score: team.score,
      niveauScore: team.ppsScore,
      mindestLuecke: naechster && eigenePunkte !== naechstePunkte ? 1 : 0,
    };
  });
  // Traegt ein spaeterer Platz einen hoeheren Teamwert (nur bei kaputten Rohdaten denkbar), waere die
  // Luecke negativ -- `berechneErgebnisNormiertNTeam` behandelt sie als 0, die Ordnungsgarantie bleibt.
  const werte = berechneErgebnisNormiertNTeam({ sortiert, m90: margeReferenz?.m90 ?? null, niveauReferenz });
  const mittelwert = werte.reduce((summe, wert) => summe + wert, 0) / werte.length;
  const abweichungenGerundet = werte.slice(0, 3).map((wert) => Math.round(wert - mittelwert));
  const letzteAbweichung = -abweichungenGerundet.reduce((summe, wert) => summe + wert, 0);
  const verhaeltnisse = [...abweichungenGerundet, letzteAbweichung];

  const overrides = new Map<string, MiniDmPodOverride>();
  sortiertRoh.forEach((team, index) => {
    const vorheriger = sortiertRoh[index - 1];
    const warnings: string[] = [];
    if (!margeReferenz) warnings.push(`bahn_pod_referenz_fehlt:${input.disciplineId}:${k ?? "?"}`);
    if (zeit && team.roh.teamWert == null) warnings.push("bahn_pod_ohne_zieleinlauf");
    overrides.set(team.teamId, {
      teamId: team.teamId,
      platz: (index + 1) as 1 | 2 | 3 | 4,
      teamPoints: MINI_DM_POD_TEAM_PUNKTE[index] ?? 0,
      score: team.score,
      margeZumNaechstbesserenPlatz: vorheriger ? Math.round(Math.max(0, vorheriger.score - team.score) * 1000) / 1000 : 0,
      verhaeltnis: verhaeltnisse[index] ?? 0,
      wert: werte[index] ?? 0,
      podId: input.pod.id,
      teamIds: input.pod.teamIds,
      warnings,
      quelle: "bahn",
      teamWert: team.roh.teamWert == null ? null : Math.round(team.roh.teamWert * 1000) / 1000,
    });
  });
  return overrides;
}

/**
 * ALLE Pods EINES Spieltags einer Bahn-Disziplin -> teamId -> Override, NUR fuer Pods mit gueltigen
 * Rohdaten. Pods ohne (oder mit kaputten) Rohdaten tragen hier keinen Eintrag -- der Aufrufer reicht
 * sie an `berechneMiniDmPodOverrides()` (PPS-Pod) weiter.
 */
export function berechneBahnPodOverrides(input: {
  pods: readonly MiniDmPod[];
  rohdatenByPodId: ReadonlyMap<string, BahnPodRohdaten> | null | undefined;
  ppsScoreByTeamId: ReadonlyMap<string, number>;
  disciplineId: string;
  playerCount: number | null | undefined;
}): Map<string, MiniDmPodOverride> {
  const overrides = new Map<string, MiniDmPodOverride>();
  if (!input.rohdatenByPodId || !istBahnPodDisziplin(input.disciplineId)) return overrides;
  for (const pod of input.pods) {
    const rohdaten = input.rohdatenByPodId.get(pod.id);
    if (!rohdaten || rohdaten.disciplineId !== input.disciplineId) continue;
    const podOverrides = berechneBahnPodOverride({
      pod,
      rohdaten,
      ppsScoreByTeamId: input.ppsScoreByTeamId,
      disciplineId: input.disciplineId,
      playerCount: input.playerCount,
    });
    if (!podOverrides) continue;
    for (const [teamId, override] of podOverrides) overrides.set(teamId, override);
  }
  return overrides;
}
