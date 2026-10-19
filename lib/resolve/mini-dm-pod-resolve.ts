/**
 * MINI-DM-POD-RESOLVE (19.10., Auftrag Chris 19.10., woertlich: "3 -> umbauen dass die 4er teams da
 * drin sind!!!"). Konzept: docs/design/battle-mode-20-spieltage-liga-mechanik-16-10.md Abschnitt 5.3.
 *
 * BEFUND (zwei unabhaengige Konzept-Agenten, Opus UND Fable, uebereinstimmend): Mini-DM wird im
 * Spielplan-Tab als 4-Team-Gruppe ("Pod") angekuendigt (lib/season/mini-dm-pod-schedule.ts,
 * `getMiniDmPodsForMatchday()`), tatsaechlich gebucht wurde aber bis hierher ein gewoehnliches
 * 2-Team-PPS-Duell (lib/resolve/battle-mode-pps-duell.ts, `resolutionSource: "pps_duell"`) gegen
 * den normalen Spieltags-Fixture-Gegner -- der oft gar nicht Teil des angekuendigten Pods war. Diese
 * Datei ersetzt das NUR fuer Mini-DM: die vier Teams eines Pods werden GEMEINSAM aufgeloest,
 * Liga-Punkte 2-1-0-0 nach Platzierung (Chris' Entscheidung 14.09., zitiert in
 * docs/design/mini-dm-nachtkonzept-03-10.md:62).
 *
 * WARUM AUF DEM PPS-SCORE STATT DEM FFA-KAMPFMOTOR (`runMiniDmFfaPodFixtures()`,
 * lib/battle/arena-headless-runner.ts): der FFA-Motor besteht seit 13.10. zwar rho (0,80/0,82) UND
 * Pp (8,7/9,0, battle-mode-20-spieltage-liga-mechanik-16-10.md Abschnitt 5.3/5.4) -- aber NUR als
 * Chromium-basierte Browser-Simulation (Playwright), bisher ausschliesslich fuer
 * Praesentationszwecke (Kopfkommentar an `runMiniDmFfaPodFixtures()`: "kein Aufrufer bucht sein
 * Ergebnis heute in die Saisontabelle"). Ihn in den synchronen Resolve-Pfad zu haengen braucht
 * dieselbe Vorlauf-/Cache-Infrastruktur wie die arena-aufgeloesten Disziplinen
 * (lib/battle/arena-vorlauf-service.ts, `ArenaVorlaufRecord`) -- das ist NICHT Teil dieser Runde,
 * s. PR-Report ("Was nicht fertig wurde"). Stattdessen nutzt dieser Pod-Resolve DENSELBEN
 * deterministischen PPS-Score, der die PPS-Duell-Bruecke schon traegt
 * (battle-mode-20-spieltage-liga-mechanik-16-10.md Abschnitt 5.2, woertlich: "Der PPS-Pfad ist kein
 * Motor, [...] sie IST die Eignung") -- NUR korrekt als Vierergruppe statt als falsch gepaartes
 * Zweier-Duell. Das behebt exakt Chris' Befund ("0:2 bei 4 Teams") ohne ein neues rho/Pp-Risiko
 * einzugehen: der Score ist exakt derselbe, nach dem auch die anderen 19 Disziplinen schon gewertet
 * werden (`scoreLegacyLineupDisciplineSide()`), nur die GRUPPIERUNG (4 statt 2 Teams) und die
 * PUNKTEVERGABE (2-1-0-0 statt 2-1-0) aendern sich. Der echte FFA-Motor bleibt als Praesentations-
 * schicht erreichbar (`runMiniDmFfaPodFixtures()`) und ist ein moeglicher spaeterer Ausbau, sobald
 * die Vorlauf-Infrastruktur dafuer steht.
 *
 * Rein, synchron, keine Playwright-/`node:fs`-Importe (wie battle-mode-pps-duell.ts) --
 * `legacy-matchday-resolve-engine.ts` darf diese Datei importieren.
 */
import {
  berechneVerhaeltnisBetrag,
  interpoliereNiveau,
  resolveMargeReferenz,
  resolveNiveauReferenz,
} from "@/lib/resolve/battle-mode-pps-duell";
import type { MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";

/** Chris' Sonderregel fuer Mini-DM (14.09.): 2-1-0-0 nach Platzierung im Pod, Summe 3 je Pod. */
export const MINI_DM_POD_TEAM_PUNKTE: readonly [number, number, number, number] = [2, 1, 0, 0];

export type MiniDmPodOverride = {
  teamId: string;
  /** 1 = bester Platz im Pod, 4 = schlechtester. */
  platz: 1 | 2 | 3 | 4;
  teamPoints: number;
  /** Der rohe PPS-Score, nach dem der Platz vergeben wurde. */
  score: number;
  /** Roher Abstand zum naechstbesseren Platz, 0 bei Platz 1. */
  margeZumNaechstbesserenPlatz: number;
  /** Zero-sum signierte Tiebreaker-Groesse (±), analog `verhaeltnis` bei einem 2-Team-Duell --
   *  Summe ueber alle vier Teams eines Pods ist IMMER exakt 0. */
  verhaeltnis: number;
  /** 0..10, Ordnungsgarantie: platz 1 >= platz 2 >= platz 3 >= platz 4 (s. `berechneErgebnisNormiertNTeam`). */
  wert: number;
  podId: string;
  teamIds: readonly [string, string, string, string];
  warnings: string[];
};

function clamp(wert: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, wert));
}

/** teamId -> Platz, deterministisch (Score absteigend, teamId alphabetisch als Tiebreak -- ein
 *  exaktes PPS-Score-Gleichstand ist praktisch ausgeschlossen, s. battle-mode-pps-duell.ts
 *  Kopfkommentar, bleibt aber defensiv geordnet statt insertion-order-abhaengig). */
function sortierePodTeams(
  pod: Pick<MiniDmPod, "teamIds">,
  scoreByTeamId: ReadonlyMap<string, number>,
): Array<{ teamId: string; score: number }> {
  return pod.teamIds
    .map((teamId) => ({ teamId, score: scoreByTeamId.get(teamId) ?? 0 }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.teamId.localeCompare(b.teamId)));
}

/**
 * N-TEAM-0-10-NORMIERUNG MIT GARANTIERTER PLATZIERUNGS-ORDNUNG -- Verallgemeinerung von
 * `berechneErgebnisNormiert()` (battle-mode-pps-duell.ts Teil B, Opus/Fable "Niveau + Marge") auf
 * mehr als zwei Teams, "Leiter"-Verfahren: Teams nach Platz sortiert (Platz 1 zuerst), LUECKEN
 * zwischen aufeinanderfolgenden Plaetzen aus der rohen Marge (gegen M90 skaliert, dieselbe Formel
 * wie beim 2-Team-Duell) abgeleitet, kumulativ vom LETZTEN Platz (Baseline 0) aufwaerts aufaddiert,
 * dann GEMEINSAM (ein einziger Skalierungsfaktor fuer alle Plaetze) ins Intervall [0,10] gelegt und
 * um das Pod-Niveau (Mittel der Niveau-CDF aller Rohscores) zentriert.
 *
 * ORDNUNGSGARANTIE (by construction, UNABHAENGIG von der Guete der gezogenen Referenz oder der
 * Teamzahl): jede Stufe dieser Rechnung ist eine MONOTON NICHT-FALLENDE Funktion ihres
 * Eingabewerts -- die kumulative Summe nicht-negativer Luecken (nicht-steigend von Platz 1 zu
 * Platz n), die Skalierung mit einem einzigen POSITIVEN Faktor, die additive Verschiebung um einen
 * fuer alle Plaetze GLEICHEN Betrag, `clamp()` und `Math.round()`. Eine Verkettung monoton
 * nicht-fallender Funktionen ist wieder monoton nicht-fallend: `wert[0] >= wert[1] >= ... >=
 * wert[n-1]` gilt deshalb IMMER, nicht nur im Erwartungswert -- s. Property-Test
 * `tests/mini-dm-pod-resolve.test.ts`.
 */
export function berechneErgebnisNormiertNTeam(input: {
  /** Bereits nach Platz sortiert, Platz 1 (bester) zuerst. Laenge >= 1. */
  sortiert: ReadonlyArray<{ teamId: string; score: number }>;
  m90: number | null;
  niveauReferenz: { p: readonly [number, number, number]; w: readonly [number, number, number] } | null;
}): number[] {
  const n = input.sortiert.length;
  if (n === 0) return [];
  if (n === 1) return [5]; // entartet (kommt in der Praxis nie vor -- ein Mini-DM-Pod hat immer vier Teams)

  // Luecken zwischen Platz k und Platz k+1, in 0..10-Einheiten (dieselbe Formel wie beim
  // 2-Team-Duell, `berechneVerhaeltnisBetrag`), 0 bei EXAKT gleichem Score.
  const luecken: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const differenz = input.sortiert[i]!.score - input.sortiert[i + 1]!.score;
    luecken.push(differenz <= 0 ? 0 : berechneVerhaeltnisBetrag({ outcome: "win", marge: differenz, m90: input.m90 }));
  }

  // Kumulative Leiter von UNTEN (letzter Platz = 0) nach OBEN -- nicht-steigend von Index 0 (Platz 1).
  const leiterVonUnten = new Array<number>(n).fill(0);
  for (let i = n - 2; i >= 0; i -= 1) {
    leiterVonUnten[i] = leiterVonUnten[i + 1]! + luecken[i]!;
  }
  const spanne = leiterVonUnten[0]!; // >= 0, Abstand Platz 1 zu Platz n (vor Skalierung)

  // GEMEINSAME Skalierung: passt die GESAMTE Spanne (nicht jede Luecke einzeln) ins Intervall
  // [0,10] -- ein einziger, fuer alle Plaetze gleicher, POSITIVER Faktor (s. Ordnungsgarantie oben).
  const skalierungsfaktor = spanne > 10 ? 10 / spanne : 1;
  const skaliert = leiterVonUnten.map((wert) => wert * skalierungsfaktor);
  const skalierteSpanne = skaliert[0]!; // <= 10, >= 0

  // NIVEAU: Mittel der Niveau-CDF ueber ALLE Teams des Pods (verallgemeinert "mu = Mittel aus
  // Sieger- und Verlierer-Niveau" bei `berechneErgebnisNormiert()` auf n statt 2 Teams).
  const mu = input.sortiert.reduce((summe, team) => summe + interpoliereNiveau(team.score, input.niveauReferenz), 0) / n;
  const mitte = 10 * mu;
  const untereGrenze = clamp(mitte - skalierteSpanne / 2, 0, 10 - skalierteSpanne);

  return skaliert.map((wert) => Math.round(clamp(untereGrenze + wert, 0, 10)));
}

/**
 * EIN Pod -> die vier `MiniDmPodOverride`s (eins je Team, Platz 1..4, Ligapunkte 2-1-0-0). `null`,
 * wenn fuer eine der vier Team-IDs kein PPS-Score vorliegt (z. B. fehlende Aufstellung) -- dann
 * bleibt der GESAMTE Pod unaufgeloest und faellt beim Aufrufer defensiv auf die alte PPS-Duell-
 * Bruecke zurueck (konsistent mit dem bestehenden `battleOhneDuell`-Verhalten in
 * legacy-matchday-resolve-engine.ts), statt drei von vier Teams zu buchen und eines falsch.
 */
export function berechneMiniDmPodOverride(input: {
  pod: MiniDmPod;
  scoreByTeamId: ReadonlyMap<string, number>;
  disciplineId: string;
  playerCount: number | null | undefined;
}): Map<string, MiniDmPodOverride> | null {
  if (input.pod.teamIds.some((teamId) => !input.scoreByTeamId.has(teamId))) {
    return null;
  }
  const sortiert = sortierePodTeams(input.pod, input.scoreByTeamId);
  const referenz = resolveMargeReferenz("pps", input.disciplineId, input.playerCount);
  const niveauReferenz = resolveNiveauReferenz("pps", input.disciplineId, input.playerCount);
  const warnings: string[] = referenz ? [] : [`verhaeltnis_referenz_fehlt:pps:${input.disciplineId}`];

  const werte = berechneErgebnisNormiertNTeam({ sortiert, m90: referenz?.m90 ?? null, niveauReferenz });
  const mittelwert = werte.reduce((summe, wert) => summe + wert, 0) / werte.length;
  // ZERO-SUM-VERHAELTNIS (analog `berechneDuellVerhaeltnis()`/`berechneErgebnisNormiert()`s "nur
  // EINE Seite rundet"): die ersten drei Abweichungen vom Pod-Mittel werden normal gerundet, die
  // VIERTE wird aus der negativen Summe der anderen drei abgeleitet -- erzwingt eine EXAKTE Summe 0
  // je Pod (und damit ligaweit ueber alle Pods), unabhaengig von Rundungsfehlern.
  const abweichungenGerundet = werte.slice(0, 3).map((wert) => Math.round(wert - mittelwert));
  const letzteAbweichung = -abweichungenGerundet.reduce((summe, wert) => summe + wert, 0);
  const verhaeltnisse = [...abweichungenGerundet, letzteAbweichung];

  const overrides = new Map<string, MiniDmPodOverride>();
  sortiert.forEach((team, index) => {
    const platz = (index + 1) as 1 | 2 | 3 | 4;
    const vorheriger = sortiert[index - 1];
    overrides.set(team.teamId, {
      teamId: team.teamId,
      platz,
      teamPoints: MINI_DM_POD_TEAM_PUNKTE[index] ?? 0,
      score: team.score,
      margeZumNaechstbesserenPlatz: vorheriger ? Math.round(Math.max(0, vorheriger.score - team.score) * 1000) / 1000 : 0,
      verhaeltnis: verhaeltnisse[index] ?? 0,
      wert: werte[index] ?? 0,
      podId: input.pod.id,
      teamIds: input.pod.teamIds,
      warnings: [...warnings],
    });
  });
  return overrides;
}

/**
 * ALLE Pods EINES Spieltags -> EINE teamId -> Override-Map (fuer `legacy-matchday-resolve-engine.ts`,
 * dieselbe Form wie `berechnePpsDuellOverrides()`s Rueckgabe, s. battle-mode-pps-duell.ts). Pods,
 * fuer die kein PPS-Score fuer alle vier Teams vorliegt (`berechneMiniDmPodOverride` liefert
 * `null`), tragen schlicht KEINE Eintraege -- ihre Teams fallen beim Aufrufer auf die alte
 * PPS-Duell-Bruecke zurueck.
 */
export function berechneMiniDmPodOverrides(input: {
  pods: readonly MiniDmPod[];
  scoreByTeamId: ReadonlyMap<string, number>;
  disciplineId: string;
  playerCount: number | null | undefined;
}): Map<string, MiniDmPodOverride> {
  const overrides = new Map<string, MiniDmPodOverride>();
  for (const pod of input.pods) {
    const podOverrides = berechneMiniDmPodOverride({
      pod,
      scoreByTeamId: input.scoreByTeamId,
      disciplineId: input.disciplineId,
      playerCount: input.playerCount,
    });
    if (!podOverrides) continue;
    for (const [teamId, override] of podOverrides) {
      overrides.set(teamId, override);
    }
  }
  return overrides;
}
