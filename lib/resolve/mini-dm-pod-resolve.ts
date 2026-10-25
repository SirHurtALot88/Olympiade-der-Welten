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
  ppAusSpielerScore,
  resolveMargeReferenz,
  resolveNiveauReferenz,
} from "@/lib/resolve/battle-mode-pps-duell";
import type { MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";
import miniDmFfaReferenzJson from "@/data/generated/mini-dm-ffa-referenz.json";

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
  /**
   * PR 4 (Opus-Plan 21.10., Mini-DM-6-Rollen-Umbau): zusaetzlich, optional -- `undefined` fuer
   * jeden Override aus dem (unveraenderten) PPS-Pod-Pfad `berechneMiniDmPodOverride()` oben, damit
   * dessen Rueckgabe (und alles, was sie serialisiert -- `DisciplineResultRecord.miniDmPod`)
   * byte-identisch zum Stand vor diesem PR bleibt (`JSON.stringify` laesst `undefined`-Werte weg).
   * Nur `berechneMiniDmFfaPodOverride()` (neu, s. unten) setzt sie wirklich. `quelle === "ffa"` ist
   * das Signal, an dem `derivePlayerPointsForDuellGroup()` (season-points-ledger.ts) und die UI
   * zwischen den beiden Pod-Pfaden unterscheiden.
   */
  quelle?: "pps" | "ffa";
  /** R_t, Summe der Rundenpunkte ueber alle k Runden (nur `quelle: "ffa"`). */
  rundenPunkteSumme?: number;
  /** a(t,r) je Runde 1..k, in Rundenreihenfolge (nur `quelle: "ffa"`). */
  teilnahme?: readonly boolean[];
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
 *
 * STRENG (Opus-Review PR #1297): die Luecken werden VOR dem Aufaddieren ganzzahlig gemacht (je
 * echter Score-Unterschied mindestens 1), die untere Grenze genau einmal gerundet -- damit gilt
 * zusaetzlich `score[k] > score[k+1]  =>  wert[k] > wert[k+1]`, wie die Sieger-Garantie des
 * 2-Team-Duells. Fuer n = 2 ist das Ergebnis exakt `berechneErgebnisNormiert()`.
 *
 * ERWEITERUNG PR 4 (Opus-Plan 21.10., Mini-DM-6-Rollen-Umbau) -- ZWEI NEUE, OPTIONALE Felder je
 * Eintrag, BEIDE inert, wenn sie fehlen (Garantie: OHNE sie ist das Ergebnis byte-identisch zum
 * Stand aus PR #1297, s. `tests/mini-dm-pod-resolve.test.ts`, "byte-identisch ohne neue Parameter"):
 *
 * - `niveauScore` -- der Rohwert, den `interpoliereNiveau()` fuer DIESEN Eintrag bewertet, FALLS er
 *   sich vom primaeren Sortier-/Luecken-`score` unterscheidet (FFA-Pod: `score` ist der
 *   Anzeigewert `v_t` aus Rundenpunkten+Beitrag, das Niveau soll aber -- wie bei den
 *   Konstantsummen-Disziplinen -- vom PPS-Team-Score kommen, s. `berechneMiniDmFfaPodOverride()`
 *   unten). Fehlt es, bleibt `interpoliereNiveau(entry.score, ...)` wie bisher.
 * - `mindestLuecke` -- eine vom Aufrufer erzwungene MINDEST-Luecke zum NAECHSTEN Platz (Index i zu
 *   i+1), unabhaengig vom tatsaechlichen Score-Abstand. Grund: ein Mini-DM-FFA-Pod vergibt
 *   Liga-Punkte 2-1-0-0 strikt nach PLATZ (R, dann B, dann PPS-Score als Tiebreak) -- zwei Teams
 *   koennen dabei exakt dasselbe `v_t` (R/B) haben und trotzdem unterschiedliche Liga-Punkte
 *   bekommen (weil der PPS-Score sie auseinandergezogen hat). Ohne `mindestLuecke` waere die
 *   Luecke dort 0 (exakter Score-Gleichstand) -- die 0-10-Anzeige wuerde dann zwei Plaetze mit
 *   VERSCHIEDENEN Liga-Punkten auf denselben Wert legen. `mindestLuecke` hebt die Luecke
 *   bedingungslos auf mindestens diesen Wert an (per `Math.max`, NIE senkend) -- fehlt es oder ist
 *   es `<= 0`, aendert sich nichts.
 */
export function berechneErgebnisNormiertNTeam(input: {
  /** Bereits nach Platz sortiert, Platz 1 (bester) zuerst. Laenge >= 1. */
  sortiert: ReadonlyArray<{ teamId: string; score: number; niveauScore?: number; mindestLuecke?: number }>;
  m90: number | null;
  niveauReferenz: { p: readonly [number, number, number]; w: readonly [number, number, number] } | null;
}): number[] {
  const n = input.sortiert.length;
  if (n === 0) return [];
  if (n === 1) return [5]; // entartet (kommt in der Praxis nie vor -- ein Mini-DM-Pod hat immer vier Teams)

  // Luecken zwischen Platz k und Platz k+1, in 0..10-Einheiten (dieselbe Formel wie beim
  // 2-Team-Duell, `berechneVerhaeltnisBetrag`), 0 bei EXAKT gleichem Score -- ANGEHOBEN auf
  // `mindestLuecke`, falls der Aufrufer eine erzwingt (s. Funktionskommentar oben; `Math.max` mit
  // dem Default 0 ist ein No-Op, die alte Formel bleibt dadurch unveraendert).
  const luecken: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const differenz = input.sortiert[i]!.score - input.sortiert[i + 1]!.score;
    const rohLuecke = differenz <= 0 ? 0 : berechneVerhaeltnisBetrag({ outcome: "win", marge: differenz, m90: input.m90 });
    luecken.push(Math.max(rohLuecke, input.sortiert[i]!.mindestLuecke ?? 0));
  }

  const spanneRoh = luecken.reduce((summe, luecke) => summe + luecke, 0); // >= 0, Platz 1 zu Platz n

  // GEMEINSAME Skalierung: passt die GESAMTE Spanne (nicht jede Luecke einzeln) ins Intervall
  // [0,10] -- ein einziger, fuer alle Plaetze gleicher, POSITIVER Faktor (s. Ordnungsgarantie oben).
  //
  // OPUS-REVIEW PR #1297 (20.10.), SIEGER-GARANTIE WIE BEIM 2-TEAM-DUELL: vorher wurde die Leiter
  // erst NACH der Skalierung gerundet -- bei einer Spanne > 10 konnten zwei Plaetze mit
  // VERSCHIEDENEM Score (und verschiedenen Liga-Punkten, 2 vs 1 oder 1 vs 0) auf denselben
  // ganzzahligen Wert fallen (synthetisch ~2,5 % der Pods). Jetzt wird jede LUECKE ganzzahlig
  // skaliert, mit Mindestabstand 1 fuer jeden echten Score-Unterschied (dieselbe Regel wie
  // `berechneVerhaeltnisBetrag()`: ein Sieg ist nie D = 0). Uebersteigt die Summe danach 10,
  // wird die jeweils groesste Luecke (> 1) um 1 verkleinert -- terminiert immer, weil n - 1 <= 10
  // Mindestluecken hineinpassen (ein Mini-DM-Pod hat n = 4). Exakt gleiche Scores behalten
  // Luecke 0 (gleicher Wert, wie ein Remis beim 2-Team-Duell).
  const skalierungsfaktor = spanneRoh > 10 ? 10 / spanneRoh : 1;
  const ganzzahligeLuecken = luecken.map((luecke) =>
    luecke <= 0 ? 0 : Math.max(1, Math.round(luecke * skalierungsfaktor)),
  );
  let lueckenSumme = ganzzahligeLuecken.reduce((summe, luecke) => summe + luecke, 0);
  while (lueckenSumme > 10) {
    let groessterIndex = -1;
    for (let i = 0; i < ganzzahligeLuecken.length; i += 1) {
      if (ganzzahligeLuecken[i]! > 1 && (groessterIndex < 0 || ganzzahligeLuecken[i]! > ganzzahligeLuecken[groessterIndex]!)) {
        groessterIndex = i;
      }
    }
    if (groessterIndex < 0) break; // nur bei n - 1 > 10 Mindestluecken erreichbar (nie bei Mini-DM)
    ganzzahligeLuecken[groessterIndex] = ganzzahligeLuecken[groessterIndex]! - 1;
    lueckenSumme -= 1;
  }

  // Kumulative Leiter von UNTEN (letzter Platz = 0) nach OBEN -- nicht-steigend von Index 0
  // (Platz 1), ganzzahlig, streng fallend ueberall dort, wo der Score streng faellt.
  const leiterVonUnten = new Array<number>(n).fill(0);
  for (let i = n - 2; i >= 0; i -= 1) {
    leiterVonUnten[i] = leiterVonUnten[i + 1]! + ganzzahligeLuecken[i]!;
  }
  const skalierteSpanne = Math.min(10, leiterVonUnten[0]!); // ganzzahlig, 0..10

  // NIVEAU: Mittel der Niveau-CDF ueber ALLE Teams des Pods (verallgemeinert "mu = Mittel aus
  // Sieger- und Verlierer-Niveau" bei `berechneErgebnisNormiert()` auf n statt 2 Teams). Die
  // untere Grenze wird -- wie dort der Verlierer-Wert -- EINMAL gerundet, danach nur noch
  // ganzzahlig addiert: kein zweites Runden, das Abstaende einebnen koennte.
  const mu = input.sortiert.reduce((summe, team) => summe + interpoliereNiveau(team.niveauScore ?? team.score, input.niveauReferenz), 0) / n;
  const mitte = 10 * mu;
  const untereGrenze = Math.round(clamp(mitte - skalierteSpanne / 2, 0, 10 - skalierteSpanne));

  return leiterVonUnten.map((wert) => clamp(untereGrenze + wert, 0, 10));
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
 *
 * FFA-VORRANG (PR 4, Opus-Plan 21.10.): `ffaRohdatenByPodId`, optional -- liegt fuer einen Pod ein
 * Eintrag vor, versucht diese Funktion ZUERST `berechneMiniDmFfaPodOverride()`; liefert die `null`
 * (fehlende/unvollstaendige Rohdaten), faellt der Pod auf den bestehenden PPS-Pfad
 * (`berechneMiniDmPodOverride()`) zurueck -- GENAUSO wie ein Pod, fuer den gar keine FFA-Rohdaten
 * vorliegen. OHNE diesen Parameter (JEDER heutige Aufrufer, PR 4 hat keinen produktiven FFA-
 * Lieferanten -- das ist erst PR 5) ist das Verhalten dieser Funktion BYTE-IDENTISCH zum Stand vor
 * diesem PR: `ffaRohdatenByPodId?.get(pod.id)` ist dann immer `undefined`, der FFA-Zweig wird nie
 * betreten.
 */
export function berechneMiniDmPodOverrides(input: {
  pods: readonly MiniDmPod[];
  scoreByTeamId: ReadonlyMap<string, number>;
  disciplineId: string;
  playerCount: number | null | undefined;
  ffaRohdatenByPodId?: ReadonlyMap<string, MiniDmFfaPodRohdaten> | null;
}): Map<string, MiniDmPodOverride> {
  const overrides = new Map<string, MiniDmPodOverride>();
  for (const pod of input.pods) {
    const ffaRohdaten = input.ffaRohdatenByPodId?.get(pod.id) ?? null;
    const ffaOverrides = ffaRohdaten
      ? berechneMiniDmFfaPodOverride({
          pod,
          rohdaten: ffaRohdaten,
          ppsScoreByTeamId: input.scoreByTeamId,
          disciplineId: input.disciplineId,
          playerCount: input.playerCount,
        })
      : null;
    const podOverrides =
      ffaOverrides ??
      berechneMiniDmPodOverride({
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

// =====================================================================================
// FFA-BUCHUNG (PR 4 eines 6-PR-Opus-Plans, 21.10.) -- REINES TYPESCRIPT, OHNE PRODUKTIVEN
// AUFRUFER. Kein heutiger Code liefert `MiniDmFfaPodRohdaten` (das ist PR 5, "Vorlauf-
// Verdrahtung") -- diese Sektion ist bis dahin toter, aber vollstaendig getesteter Code, erreichbar
// nur ueber `berechneMiniDmPodOverrides({ ffaRohdatenByPodId })` oben.
//
// NOTATION (wie vom Plan vorgegeben): Pod mit Teams t1..t4 (`pod.teamIds`), k = `playerCount` des
// Spielplan-Slots (2..6 seit PR 1), Runde r = 1..k mit Rolle ROLLEN6[r-1]. Teilnahme a(t,r) = 1
// genau dann, wenn Team t fuer Runde r einen Aufstellungseintrag hat ("wer gesetzt ist, spielt" --
// KEIN Reihum-Fallback hier, anders als die Praesentationsschicht aus PR A/#1299, s.
// Funktionskommentar an `berechneMiniDmFfaPodOverride` unten).
// =====================================================================================

/**
 * ROLLEN6, Reihenfolge wie `slotIndex` 0..5 -- dieselbe Liste wie
 * `DISCIPLINE_ROLE_THEMES["mini-dm"]` (lib/lineups/matchday-slot-roles.ts), hier als eigene, lose
 * Kopie: diese Datei ist bewusst "rein" (kein Playwright-/`node:fs`-Import, s. Datei-Kopfkommentar
 * oben) und zieht deshalb nicht die viel groessere Importkette von matchday-slot-roles.ts
 * (offizielle Gewichtsmatrix, Overrides, Fatigue-Kalibrierung, ...) nach sich. Ein Test
 * (`tests/mini-dm-pod-resolve.test.ts`) haelt beide Listen deckungsgleich, damit ein kuenftiger
 * Rollen-Umbau hier nicht unbemerkt auseinanderlaeuft.
 */
export const MINI_DM_FFA_ROLLEN6 = Object.freeze([
  "frontliner",
  "finisher",
  "trickfighter",
  "ironguard",
  "chaosdriver",
  "lasthit",
] as const);

/**
 * RUNDENPUNKTE je Runde, UNVERAENDERT aus `battle-mode.engine.js`s `MINI_DM_FFA_RUNDENPUNKTE`
 * (public/mockups/battle-mode.engine.js) -- diese Datei darf jene Datei nicht importieren (sie ist
 * Browser-JS, kein Modul, und PR 2 des Opus-Plans aendert ausschliesslich sie), deshalb hier als
 * bewusst dokumentierte Konstanten-Kopie. Ein Spiegel-Test (`tests/mini-dm-pod-resolve.test.ts`)
 * haelt beide Werte identisch.
 */
export const MINI_DM_FFA_RUNDENPUNKTE: readonly [number, number, number, number] = [4, 3, 2, 1];

/**
 * TS-PORT von `verteilePlatzierungspunkte()` (battle-mode.engine.js) -- ABSICHTLICH dupliziert
 * statt importiert (s. Abschnitts-Kopfkommentar: jene Datei ist Browser-JS, kein ES-Modul, und
 * ausserhalb des Playwright-Pfads gar nicht ladbar). Identischer Algorithmus: Werte absteigend
 * sortiert, bei exaktem Gleichstand werden die Punkte der betroffenen Plaetze gleichmaessig
 * aufgeteilt ("gleichauf Erster" statt "gleichauf Zweiter" -- Platz ist der BESTE der geteilten
 * Plaetze). Punkte/Platz kommen in der Reihenfolge der UEBERGEBENEN Werte zurueck, nicht sortiert.
 * Ein Spiegel-Test haelt dieselben Faelle gegen die JS-Fassung.
 */
export function verteilePlatzierungspunkte(
  werte: readonly number[],
  punkteJePlatz: readonly number[],
): { punkte: number[]; platz: number[] } {
  const idxSortiert = werte.map((_wert, index) => index).sort((a, b) => werte[b]! - werte[a]!);
  const punkte = new Array<number>(werte.length).fill(0);
  const platz = new Array<number>(werte.length).fill(0);
  let i = 0;
  while (i < idxSortiert.length) {
    let j = i;
    while (j + 1 < idxSortiert.length && werte[idxSortiert[j + 1]!] === werte[idxSortiert[i]!]) {
      j += 1;
    }
    const geteilt = punkteJePlatz.slice(i, j + 1).reduce((summe, punktwert) => summe + punktwert, 0) / (j - i + 1);
    for (let k = i; k <= j; k += 1) {
      punkte[idxSortiert[k]!] = geteilt;
      platz[idxSortiert[k]!] = i + 1;
    }
    i = j + 1;
  }
  return { punkte, platz };
}

/** EIN Teams rohe Teilnahme/Leistung in EINER Runde -- a(t,r) und beta(t,r) aus der Notation. */
export type MiniDmFfaRundenTeamRohdaten = {
  teamId: string;
  /** a(t,r): `true`, wenn Team t fuer diese Runde/Rolle einen Aufstellungseintrag hat. */
  teilnahme: boolean;
  /** beta(t,r): roher Boxscore-Beitrag dieses Teams in dieser Runde -- nur sinnvoll bei `teilnahme`. */
  beitrag: number;
};

/** EINE Runde (eine Rolle) des Pods -- muss GENAU die vier `pod.teamIds` tragen, s. `pruefeMiniDmFfaRohdaten()`. */
export type MiniDmFfaRundeRohdaten = {
  /** r, 1-basiert, 1..k. */
  runde: number;
  /** ROLLEN6[r-1] -- rein informativ/zur Validierung, nicht Teil der Rechnung selbst. */
  rolle?: string;
  teams: readonly MiniDmFfaRundenTeamRohdaten[];
};

/** Die vollen FFA-Rohdaten EINES Pods -- k Runden, eine je Rolle 1..k. */
export type MiniDmFfaPodRohdaten = {
  podId: string;
  teamIds: readonly [string, string, string, string];
  /** k = `playerCount` des Spielplan-Slots, 2..6 seit PR 1. */
  playerCount: number;
  runden: readonly MiniDmFfaRundeRohdaten[];
};

/**
 * Strukturpruefung VOR jeder Rechnung -- defensiv wie der Rest dieser Datei ("additiv, faellt bei
 * fehlenden/kaputten Daten auf `null` zurueck, wirft nie"). Verlangt: `playerCount >= 1` und exakt
 * so viele Runden wie `playerCount`; jede Runde traegt GENAU die vier Pod-Team-IDs (als Menge,
 * Reihenfolge egal) mit endlichen `beitrag`-Werten.
 */
function pruefeMiniDmFfaRohdaten(pod: Pick<MiniDmPod, "teamIds">, rohdaten: MiniDmFfaPodRohdaten): boolean {
  if (!Number.isInteger(rohdaten.playerCount) || rohdaten.playerCount < 1) return false;
  if (rohdaten.runden.length !== rohdaten.playerCount) return false;
  const podTeamIds = new Set(pod.teamIds);
  if (podTeamIds.size !== 4) return false;
  return rohdaten.runden.every((runde) => {
    if (runde.teams.length !== 4) return false;
    const rundenTeamIds = new Set(runde.teams.map((team) => team.teamId));
    if (rundenTeamIds.size !== 4) return false;
    for (const teamId of rundenTeamIds) {
      if (!podTeamIds.has(teamId)) return false;
    }
    return runde.teams.every(
      (team) => typeof team.teilnahme === "boolean" && Number.isFinite(team.beitrag),
    );
  });
}

type MiniDmFfaTeamAkkumulator = {
  teamId: string;
  /** R_t. */
  rundenPunkteSumme: number;
  /** B_t. */
  beitragSumme: number;
  /** a(t,r) je Runde, in Rundenreihenfolge. */
  teilnahme: boolean[];
  /** `true`, sobald a(t,r) = 1 fuer IRGENDEIN r -- Grundlage fuer die "Team ohne Aufstellung"-Warnung. */
  irgendTeilnahme: boolean;
};

/**
 * R_t/B_t je Team ueber alle k Runden -- NUR die anwesenden Teams werden je Runde nach `beitrag`
 * gerankt und bekommen `MINI_DM_FFA_RUNDENPUNKTE` (gekuerzt auf die Anzahl Anwesender) nach Platz,
 * bei Gleichstand geteilt (`verteilePlatzierungspunkte`). Ein abwesendes Team bekommt in dieser
 * Runde pi = 0, beta = 0 -- "mehr Teilnahme hilft immer", NIE normiert auf Summe a(t,r) (s.
 * Funktionskommentar an `berechneMiniDmFfaPodOverride` unten, "Plan lehnt das ausdrueckleich ab").
 */
function berechneMiniDmFfaRundenAkkumulation(
  pod: Pick<MiniDmPod, "teamIds">,
  rohdaten: MiniDmFfaPodRohdaten,
): Map<string, MiniDmFfaTeamAkkumulator> {
  const akkumulatoren = new Map<string, MiniDmFfaTeamAkkumulator>(
    pod.teamIds.map((teamId) => [
      teamId,
      { teamId, rundenPunkteSumme: 0, beitragSumme: 0, teilnahme: [], irgendTeilnahme: false },
    ]),
  );
  for (const runde of rohdaten.runden) {
    const anwesend = runde.teams.filter((team) => team.teilnahme);
    const { punkte } =
      anwesend.length > 0
        ? verteilePlatzierungspunkte(
            anwesend.map((team) => team.beitrag),
            MINI_DM_FFA_RUNDENPUNKTE.slice(0, anwesend.length),
          )
        : { punkte: [] as number[] };
    const punkteByTeamId = new Map(anwesend.map((team, index) => [team.teamId, punkte[index] ?? 0] as const));
    for (const team of runde.teams) {
      const akkumulator = akkumulatoren.get(team.teamId);
      if (!akkumulator) continue; // durch `pruefeMiniDmFfaRohdaten()` oben ausgeschlossen
      akkumulator.teilnahme.push(team.teilnahme);
      if (team.teilnahme) {
        akkumulator.irgendTeilnahme = true;
        akkumulator.rundenPunkteSumme += punkteByTeamId.get(team.teamId) ?? 0;
        akkumulator.beitragSumme += team.beitrag;
      }
    }
  }
  return akkumulatoren;
}

/**
 * POD-PLATZIERUNG, lexikografisch (R absteigend, dann B absteigend, dann PPS-Teamscore absteigend,
 * dann teamId aufsteigend) -- aus den ROHEN Runden-Daten berechnet, NICHT aus den Motor-`ligaPunkte`
 * (die teilen bei Gleichstand, s. Plan). Ein Team mit R = 0 (das heisst: KEINE Teilnahme in IRGENDEINER
 * Runde, s. `berechneMiniDmFfaRundenAkkumulation()` -- jede tatsaechliche Teilnahme gibt mindestens
 * einen positiven Rundenpunkt) faellt durch diese Sortierung automatisch auf den letzten Platz,
 * KEIN separater Sonderfall noetig; die "Team ohne Aufstellung"-Warnung wird trotzdem explizit
 * gesetzt (s. `berechneMiniDmFfaPodOverride`).
 */
function sortierePodTeamsFfa(
  pod: Pick<MiniDmPod, "teamIds">,
  akkumulatoren: ReadonlyMap<string, MiniDmFfaTeamAkkumulator>,
  ppsScoreByTeamId: ReadonlyMap<string, number>,
): Array<{ teamId: string; r: number; b: number; ppsScore: number }> {
  return pod.teamIds
    .map((teamId) => {
      const akkumulator = akkumulatoren.get(teamId)!;
      return {
        teamId,
        r: akkumulator.rundenPunkteSumme,
        b: akkumulator.beitragSumme,
        ppsScore: ppsScoreByTeamId.get(teamId) ?? 0,
      };
    })
    .sort((a, b) => {
      if (b.r !== a.r) return b.r - a.r;
      if (b.b !== a.b) return b.b - a.b;
      if (b.ppsScore !== a.ppsScore) return b.ppsScore - a.ppsScore;
      return a.teamId.localeCompare(b.teamId);
    });
}

type MiniDmFfaReferenzFeldgroesse = { m90?: number; spieler?: { p50: number; p995: number } };
type MiniDmFfaReferenzJson = { feldgroessen?: Record<string, MiniDmFfaReferenzFeldgroesse> };
const MINI_DM_FFA_REFERENZ = miniDmFfaReferenzJson as unknown as MiniDmFfaReferenzJson;

function resolveNaechsteMiniDmFfaFeldgroesse(
  playerCount: number | null | undefined,
  gueltigFilter: (eintrag: MiniDmFfaReferenzFeldgroesse) => boolean,
): MiniDmFfaReferenzFeldgroesse | null {
  const feldgroessen = MINI_DM_FFA_REFERENZ.feldgroessen;
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

/**
 * M90 der v_t-Luecken je k, aus `data/generated/mini-dm-ffa-referenz.json` -- EIGENSTAENDIG von
 * `resolveMargeReferenz()` (battle-mode-pps-duell.ts), weil die zugrundeliegende Groesse eine
 * ANDERE ist (v_t = R_t/k + B_t/(k*1e6), nicht der PPS-Score). PR 4 (21.10.): die Datei ist noch ein
 * Platzhalter (`feldgroessen: {}`) -- PR 3 befuellt sie real. Bis dahin liefert dieser Resolver
 * IMMER `null`, nie einen Fehler -- `berechneErgebnisNormiertNTeam()` faellt dann auf den
 * bestehenden Rueckfall `VERHAELTNIS_RUECKFALL_D` zurueck (s. `berechneVerhaeltnisBetrag()`,
 * battle-mode-pps-duell.ts). In PR 4 ohnehin toter Code (kein Aufrufer liefert FFA-Rohdaten).
 */
export function resolveMiniDmFfaMargeReferenz(playerCount: number | null | undefined): { m90: number } | null {
  const eintrag = resolveNaechsteMiniDmFfaFeldgroesse(playerCount, (e) => Number.isFinite(e.m90) && (e.m90 as number) > 0);
  return eintrag ? { m90: eintrag.m90 as number } : null;
}

/**
 * PP-BUDGET-REFERENZ (p50/p99,5 des rohen `beitrag` je k) fuer die Spieler-PP-Formel unten --
 * dieselbe Platzhalter-Lage wie `resolveMiniDmFfaMargeReferenz()` oben: `null`, solange PR 3 die
 * Datei nicht real befuellt hat.
 */
export function resolveMiniDmFfaSpielerPpReferenz(playerCount: number | null | undefined): { p50: number; p995: number } | null {
  const eintrag = resolveNaechsteMiniDmFfaFeldgroesse(playerCount, (e) => Boolean(e.spieler) && e.spieler!.p995 > e.spieler!.p50);
  return eintrag?.spieler ?? null;
}

/**
 * SPIELER-PP (Plan Abschnitt 3): PP_i = Impact-Kurve(beta_i, p50_k, p99,5_k, MAX, ANTEIL_MITTE) --
 * REIN leistungsbasiert, unabhaengig vom Pod-Platz des eigenen Teams. Ruft dieselbe Kurve wie
 * `"pps_duell"`/Arena ueber `ppAusSpielerScore()` (battle-mode-pps-duell.ts) auf, NICHT neu gebaut
 * ("Transport ueber bestehende Wege", s. PR-Beschreibung) -- nur die Referenz (p50/p99,5) kommt aus
 * `resolveMiniDmFfaSpielerPpReferenz()` statt aus `resolveSpielerPpReferenz()`. `referenz: null`
 * (PR 4, Platzhalter-Datei) liefert 0, nie `NaN` -- in PR 4 ohnehin toter Code: ein kuenftiger
 * Aufrufer (PR 5) ruft diese Funktion je gesetztem Spieler auf und schreibt das Ergebnis in
 * `arenaIndividualBoxscorePpsByDisciplineId.set("mini-dm", ...)` -- das bestehende
 * `arenaPps ?? ppsDuellPps` in `legacy-matchday-resolve-engine.ts` greift dann ohne weiteren
 * Code. Wer NICHT aufgestellt ist, bekommt keine PP -- das regelt der (kuenftige) Aufrufer, der
 * diese Funktion nur fuer gesetzte Spieler aufruft, nicht diese Funktion selbst.
 */
export function ppAusMiniDmFfaBeitrag(
  beitrag: number | null | undefined,
  referenz: { p50: number; p995: number } | null,
): number {
  return ppAusSpielerScore(beitrag, referenz);
}

/**
 * EIN Pod -> die vier `MiniDmPodOverride`s aus ECHTEN FFA-Rohdaten (`quelle: "ffa"`). `null` bei
 * strukturell unvollstaendigen/kaputten Rohdaten (`pruefeMiniDmFfaRohdaten()`) ODER fehlendem
 * PPS-Score fuer eines der vier Teams (fuer den PPS-Tiebreak UND das Niveau gebraucht) -- der
 * Aufrufer (`berechneMiniDmPodOverrides()`) faellt dann auf den bestehenden PPS-Pod-Pfad zurueck,
 * GENAU wie bei fehlenden FFA-Rohdaten (nie ein geworfener Fehler, s. Datei-Philosophie).
 *
 * TEILBESETZUNG IST FAIR (Plan): abwesend zaehlt wie "unter dem Letzten" -- NICHT auf
 * Summe a(t,r) normiert (das wuerde beloh­nen, einen schwachen sechsten Spieler wegzulassen). Ein
 * Team OHNE jede Aufstellung (R_t = 0, s. `sortierePodTeamsFfa()`-Kommentar) faellt durch die
 * lexikografische Sortierung automatisch auf Platz 4 mit 0 Punkten -- bekommt hier zusaetzlich die
 * explizite Warnung `mini_dm_ffa_team_ohne_aufstellung`. Der Pod selbst bleibt VOLL aufgeloest (alle
 * vier Teams bekommen einen Override) -- fehlt NUR einem Team jede Aufstellung, faellt NICHT der
 * gesamte Pod auf den PPS-Rueckfall zurueck.
 */
export function berechneMiniDmFfaPodOverride(input: {
  pod: MiniDmPod;
  rohdaten: MiniDmFfaPodRohdaten;
  ppsScoreByTeamId: ReadonlyMap<string, number>;
  disciplineId: string;
  playerCount: number | null | undefined;
}): Map<string, MiniDmPodOverride> | null {
  if (!pruefeMiniDmFfaRohdaten(input.pod, input.rohdaten)) {
    return null;
  }
  if (input.pod.teamIds.some((teamId) => !input.ppsScoreByTeamId.has(teamId))) {
    return null;
  }

  const k = input.rohdaten.playerCount;
  const akkumulatoren = berechneMiniDmFfaRundenAkkumulation(input.pod, input.rohdaten);
  const sortiertRoh = sortierePodTeamsFfa(input.pod, akkumulatoren, input.ppsScoreByTeamId);

  const niveauReferenz = resolveNiveauReferenz("pps", input.disciplineId, input.playerCount);
  const margeReferenz = resolveMiniDmFfaMargeReferenz(k);
  const referenzFehlt = !margeReferenz;

  // ANZEIGESCORE v_t = R_t/k + B_t/(k*1e6) -- R dominiert (Schrittweite >= 0,5/k), B ist < 1e-3
  // (Ordnungsgarantie, s. Datei-/PR-Kommentar). `mindestLuecke` (PR 4, s. Kommentar an
  // `berechneErgebnisNormiertNTeam`): 1, sobald die Liga-Punkte zweier benachbarter Plaetze
  // verschieden sind -- erzwingt `wert(i) > wert(i+1)` auch bei exakt gleichem v_t.
  const sortiert = sortiertRoh.map((team, index) => {
    const naechsterPlatz = sortiertRoh[index + 1];
    const eigenePunkte = MINI_DM_POD_TEAM_PUNKTE[index] ?? 0;
    const naechstePunkte = naechsterPlatz ? MINI_DM_POD_TEAM_PUNKTE[index + 1] ?? 0 : eigenePunkte;
    return {
      teamId: team.teamId,
      score: team.r / k + team.b / (k * 1_000_000),
      // NIVEAU AUS PPS (Plan): "mu = Pod-Mittel von F_pps,k(PPS_t)" -- wie bei den
      // Konstantsummen-Disziplinen (KONSTANTSUMME_NIVEAU_DISCIPLINE_IDS) ist die FFA-Rundenpunkte-
      // Summe konstant (10 je volle Runde), das native v_t truege deshalb kein echtes Niveau.
      niveauScore: team.ppsScore,
      mindestLuecke: naechsterPlatz && eigenePunkte !== naechstePunkte ? 1 : 0,
    };
  });

  const werte = berechneErgebnisNormiertNTeam({ sortiert, m90: margeReferenz?.m90 ?? null, niveauReferenz });
  const mittelwert = werte.reduce((summe, wert) => summe + wert, 0) / werte.length;
  // ZERO-SUM-VERHAELTNIS, identischer Aufbau wie `berechneMiniDmPodOverride()` oben (nur die VIERTE
  // Abweichung wird aus den anderen drei abgeleitet, erzwingt Summe exakt 0 je Pod).
  const abweichungenGerundet = werte.slice(0, 3).map((wert) => Math.round(wert - mittelwert));
  const letzteAbweichung = -abweichungenGerundet.reduce((summe, wert) => summe + wert, 0);
  const verhaeltnisse = [...abweichungenGerundet, letzteAbweichung];

  const overrides = new Map<string, MiniDmPodOverride>();
  sortiertRoh.forEach((team, index) => {
    const akkumulator = akkumulatoren.get(team.teamId)!;
    const platz = (index + 1) as 1 | 2 | 3 | 4;
    const vorheriger = sortiertRoh[index - 1];
    const warnings: string[] = [];
    if (referenzFehlt) warnings.push(`mini_dm_ffa_referenz_fehlt:${k}`);
    if (!akkumulator.irgendTeilnahme) warnings.push("mini_dm_ffa_team_ohne_aufstellung");
    overrides.set(team.teamId, {
      teamId: team.teamId,
      platz,
      teamPoints: MINI_DM_POD_TEAM_PUNKTE[index] ?? 0,
      // Primaerer Vergleichswert dieses Pfads: R_t (Rundenpunkte-Summe), NICHT der PPS-Score (der
      // nur noch als Tiebreak/Niveau wirkt) -- s. `rundenPunkteSumme` unten fuer denselben Wert
      // unter seinem eigenen, FFA-spezifischen Namen.
      score: team.r,
      margeZumNaechstbesserenPlatz: vorheriger
        ? Math.round(Math.max(0, vorheriger.r - team.r + (vorheriger.b - team.b) / 1_000_000) * 1000) / 1000
        : 0,
      verhaeltnis: verhaeltnisse[index] ?? 0,
      wert: werte[index] ?? 0,
      podId: input.pod.id,
      teamIds: input.pod.teamIds,
      warnings,
      quelle: "ffa",
      rundenPunkteSumme: akkumulator.rundenPunkteSumme,
      teilnahme: akkumulator.teilnahme,
    });
  });
  return overrides;
}
