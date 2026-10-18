/**
 * PPS-DUELL-BRUECKE + PUNKTEVERHAELTNIS (docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md,
 * Konzept: docs/design/battle-mode-20-spieltage-liga-mechanik-16-10.md Abschnitte 3 und 5).
 *
 * WAS DIESE DATEI LOEST. In einem Battle-Mode-Save zahlten bis hierher nur die arena-aufgeloesten
 * Disziplinen Chris' 2/1/0 ("beides gibt normal 2 punkte fuer sieg 1 unentschieden 0 niederlage");
 * jede andere Disziplin — und jede arena-aufgeloeste, deren Arena-Lauf ausfiel — lief ueber die
 * Manager-Mode-Rangtabelle (`getRankToPointsValue()`, bis 19,9 Punkte fuer Rang 1). Zwei
 * Punkte-Oekonomien in derselben Tabelle.
 *
 * DIE REGEL, in einem Satz: das Fixture (Team A gegen Team B an Spieltag k, laut Spielplan) ist die
 * Einheit, auf der in einem Battle-Save JEDE Disziplin gewertet wird. Die Arena ist nur die bessere
 * Score-Quelle; ohne Arena-Ergebnis entscheidet der PPS-Score beider Seiten — derselbe Score, der
 * heute schon gerechnet wird — NUR darueber, wer gewinnt. Sieg 2, Unentschieden 1, Niederlage 0.
 *
 * DIE BRUECKE IST DER VERBINDLICHE RUECKFALL (Projektaufsicht 16.10.): fehlt fuer eine Disziplin ein
 * Arena-Ergebnis — weil sie nicht arena-aufgeloest ist, weil sie die Abnahme nicht besteht
 * (`ARENA_RESOLVED_DISCIPLINE_IDS`, s. data/generated/disziplin-abnahme.json) oder weil der
 * Arena-Lauf scheiterte —, greift dieser Pfad. Niemals mehr die Rangtabelle in einem Battle-Save.
 *
 * DAS PUNKTEVERHAELTNIS ist KEINE Zusatzpunktzahl, sondern der Tiebreaker der Tabelle (Konzept 3.1):
 *
 *   D = 0                                    bei Unentschieden
 *     = max(1, round(10 * min(1, m / M90)))   sonst
 *
 * `m` = roher Abstand beider Seiten im Duell (PPS-Score-Differenz bzw. Arena-Seitenstand-Differenz),
 * `M90` = 90. Perzentil von `m` in einer FESTEN, einmalig gezogenen Referenz je Quelle, Disziplin und
 * Feldgroesse (`data/generated/verhaeltnis-referenz.json`, gezogen von
 * `scripts/ziehe-verhaeltnis-referenz.ts`). Sieger +D, Verlierer −D. Persistiert werden `marge` (m)
 * UND das vorzeichenbehaftete D UND das verwendete M90 — eine spaetere Nachjustierung der Formel
 * braucht damit keine neue Simulation.
 *
 * Rein, synchron, keine Playwright-/`node:fs`-Importe — `legacy-matchday-resolve-engine.ts` darf
 * diese Datei importieren (anders als `battle-mode-arena-team-points.ts`).
 *
 * TEAM-RANG-ENTKOPPLUNG DER INDIVIDUELLEN PPS (Opus-Befund 18.10., hoechste Prioritaet, docs/design/
 * pps-duell-bruecke-individuelle-pps-18-10.md): bis hierher buchte die Bruecke nur den TEAM-Wert neu
 * (2/1/0) — die INDIVIDUELLEN Spieler-PPs liefen unveraendert weiter ueber
 * `distributeRankPointsToPlayers()` (`rank-to-points.ts`) MIT `rank: rankedTeam.rank`, dem
 * TEAM-RANG innerhalb der Liga (`rankWithinLeagueScope()`, legacy-matchday-resolve-engine.ts) — exakt
 * so im urspruenglichen Konzept dokumentiert (Abschnitt 1 dort: "Individuelle Spieler-PPs bleiben...
 * beim bisherigen PPS-Anteil"), eine zum damaligen Zeitpunkt bewusste Vereinfachung, die Opus jetzt
 * als Bug einstuft: ein Star-Spieler in einem schwachen Team bekam dadurch WENIGER PP als ein
 * mittelmaessiger Spieler in einem starken Team — nicht weil er schlechter spielte, sondern weil
 * sein Team insgesamt schlechter abschnitt. Fuer die Arena-Disziplinen ist genau dieses Problem
 * schon geloest (`ppsAusArenaImpact()`, battle-mode-arena-team-points.ts: individueller Impact-Wert
 * gegen eine FESTE, ligaweit gezogene Referenzkurve, kein Team-Bezug). `ppsAusDuellWert()` unten ist
 * das BRUECKEN-ANALOGON derselben Kurve — bewusst eine EIGENSTAENDIGE, duenne Kopie der Formel statt
 * eines Imports aus `battle-mode-arena-team-points.ts`: jene Datei zieht ueber
 * `arena-headless-runner.ts` Playwright/`node:fs` mit (s. Dateikopf-Kommentar dort), die diese Datei
 * laut ihrem eigenen Kopfkommentar NICHT mitziehen darf. Die Referenz (`iMittel`/`iKrass` je
 * Disziplin UND Feldgroesse, UEBER BEIDE LIGEN GEMEINSAM — Chris' Entscheidung 31.08.,
 * docs/design/battle-mode-pps-modell-plan.md Abschnitt 7 Punkt 2) kommt aus
 * `data/generated/pps-duell-bruecke-individuell-referenz.json`, gezogen von
 * `scripts/ziehe-pps-duell-individuell-referenz.ts` (reiner Node-Code, kein Browser — der PPS-Pfad
 * braucht keinen) gegen den echten Live-Save-Kader, NUR fuer Feldgroesse 5/6 (die CLAUDE.md-
 * Abnahmegroessen; Feldgroesse 2..4 ist Task #175, separat offen, s. dortiger Kommentar).
 *
 * FEHLT DIE REFERENZ FUER EINE DISZIPLIN (noch nicht gezogen): `resolveDuellIndividualPpsReferenz()`
 * liefert `null` statt zu werfen — die Bruecke ist der Battle-Mode-Standardpfad fuer praktisch jede
 * Disziplin, solange PR3 (Arena-Vorlauf-Anbindung) nicht gelandet ist; ein Fail-Fast hier wuerde
 * JEDEN Battle-Spieltag fuer eine nicht gezogene Disziplin crashen lassen. `legacy-matchday-
 * resolve-engine.ts` faellt fuer GENAU diese Disziplin/Feldgroesse auf das bisherige (team-rang-
 * gebundene) Verhalten zurueck, mit einer sichtbaren Warnung statt still falsch — "laut statt still
 * falsch", derselbe Grundsatz wie bei `verhaeltnis_referenz_fehlt` oben.
 */
import type { Fixture, GameState } from "@/lib/data/olyDataTypes";
import verhaeltnisReferenzJson from "@/data/generated/verhaeltnis-referenz.json";
import duellIndividuellReferenzJson from "@/data/generated/pps-duell-bruecke-individuell-referenz.json";

/** Dieselben Werte wie `ARENA_TEAM_POINTS` (battle-mode-arena-team-points.ts) — ein Test haelt beide gleich. */
export const DUELL_TEAM_PUNKTE = { win: 2, draw: 1, loss: 0 } as const;

export type DuellOutcome = "win" | "draw" | "loss";
export type VerhaeltnisQuelle = "pps" | "arena";

/** Rueckfall, wenn fuer Quelle/Disziplin keine gezogene Referenz existiert (Konzept 3.4). */
export const VERHAELTNIS_RUECKFALL_D = 5;
export const VERHAELTNIS_MAX = 10;

type ReferenzFeldgroesse = { n: number; m90: number };
type ReferenzJson = {
  quellen?: Partial<Record<VerhaeltnisQuelle, Record<string, { feldgroessen?: Record<string, ReferenzFeldgroesse> }>>>;
};

const REFERENZ = verhaeltnisReferenzJson as unknown as ReferenzJson;

export type DuellVerhaeltnis = {
  /** Roher, nicht-negativer Abstand beider Seiten (`|eigen − gegner|`). */
  marge: number;
  /** ±D aus Sicht DIESES Teams (Sieger positiv, Unentschieden 0). */
  verhaeltnis: number;
  /** Die verwendete Bezugsgroesse, `null` beim Rueckfall auf `VERHAELTNIS_RUECKFALL_D`. */
  margeM90: number | null;
  warnings: string[];
};

export type PpsDuellOverride = {
  teamPoints: number;
  opponentTeamId: string;
  /** Rohwerte [dieses Team, Gegner] — hier die PPS-Scores. */
  seiten: [number, number];
  outcome: DuellOutcome;
} & DuellVerhaeltnis;

/**
 * Die Fixtures eines Spieltags aus dem bereits gebauten Spielplan (`seasonState.schedule`), ueber
 * BEIDE Ligen. Anders als `findLeagueFixturesForMatchday()` (Arena) wird `leagueTier` nicht
 * verlangt: auch ein Battle-Save ohne Liga-Split hat Zwei-Team-Fixtures, und die Bruecke soll dort
 * ebenso greifen statt still auf die Rangtabelle zu fallen.
 */
export function findeSpieltagsFixtures(
  gameState: Pick<GameState, "seasonState"> | null | undefined,
  matchdayId: string,
): Fixture[] {
  return (gameState?.seasonState?.schedule ?? []).filter(
    (fixture) => fixture.matchdayId === matchdayId && fixture.homeTeamId && fixture.awayTeamId && fixture.homeTeamId !== fixture.awayTeamId,
  );
}

/** teamId -> sein Fixture an diesem Spieltag. Ein Team in zwei Fixtures (kaputter Spielplan) behaelt das erste. */
export function baueFixtureIndex(fixtures: readonly Fixture[]): Map<string, Fixture> {
  const index = new Map<string, Fixture>();
  for (const fixture of fixtures) {
    if (!index.has(fixture.homeTeamId)) index.set(fixture.homeTeamId, fixture);
    if (!index.has(fixture.awayTeamId)) index.set(fixture.awayTeamId, fixture);
  }
  return index;
}

/**
 * M90 fuer (Quelle, Disziplin, Feldgroesse). Exakte Feldgroesse, sonst die naechstgelegene gezogene
 * (dieselbe Rueckfall-Logik wie `resolveArenaPpsReferenz()`), sonst `null` (-> Rueckfall-D).
 */
export function resolveMargeReferenz(
  quelle: VerhaeltnisQuelle,
  disciplineId: string,
  playerCount: number | null | undefined,
): { m90: number; feldgroesseGenutzt: number } | null {
  const feldgroessen = REFERENZ.quellen?.[quelle]?.[disciplineId]?.feldgroessen;
  if (!feldgroessen) return null;
  const gueltig = Object.entries(feldgroessen)
    .map(([n, eintrag]) => [Number(n), eintrag] as const)
    .filter(([n, eintrag]) => Number.isFinite(n) && Number.isFinite(eintrag?.m90) && eintrag.m90 > 0)
    .sort((a, b) => a[0] - b[0]);
  if (gueltig.length === 0) return null;
  const ziel = typeof playerCount === "number" && Number.isFinite(playerCount) ? Math.round(playerCount) : gueltig[0]![0];
  let bester = gueltig[0]!;
  for (const kandidat of gueltig) {
    if (Math.abs(kandidat[0] - ziel) < Math.abs(bester[0] - ziel)) bester = kandidat;
  }
  return { m90: bester[1].m90, feldgroesseGenutzt: bester[0] };
}

/** Unvorzeichenbehaftetes D (0..10) nach Konzept 3.3. */
export function berechneVerhaeltnisBetrag(input: { outcome: DuellOutcome; marge: number; m90: number | null }): number {
  if (input.outcome === "draw") return 0;
  if (input.m90 == null || !(input.m90 > 0)) return VERHAELTNIS_RUECKFALL_D;
  const anteil = Math.min(1, Math.max(0, input.marge) / input.m90);
  return Math.max(1, Math.round(VERHAELTNIS_MAX * anteil));
}

/**
 * ±D eines Teams aus seinem Seitenstand. `outcome` kommt vom Aufrufer (nicht aus `seiten`), damit
 * ein Tiebreak-Sieg bei gleichem Seitenstand (Gewichtheben, kg-Summe) als knappster Sieg (D = 1)
 * zaehlt statt als Remis (Konzept 3.3, Gewichtheben-Sonderfall).
 */
export function berechneDuellVerhaeltnis(input: {
  quelle: VerhaeltnisQuelle;
  disciplineId: string;
  playerCount: number | null | undefined;
  seiten: readonly [number, number];
  outcome: DuellOutcome;
}): DuellVerhaeltnis {
  const warnings: string[] = [];
  const marge = Math.round(Math.abs((input.seiten[0] ?? 0) - (input.seiten[1] ?? 0)) * 1000) / 1000;
  const referenz = resolveMargeReferenz(input.quelle, input.disciplineId, input.playerCount);
  if (!referenz && input.outcome !== "draw") {
    warnings.push(`verhaeltnis_referenz_fehlt:${input.quelle}:${input.disciplineId}`);
  }
  const betrag = berechneVerhaeltnisBetrag({ outcome: input.outcome, marge, m90: referenz?.m90 ?? null });
  const vorzeichen = input.outcome === "win" ? 1 : input.outcome === "loss" ? -1 : 0;
  return { marge, verhaeltnis: vorzeichen * betrag, margeM90: referenz?.m90 ?? null, warnings };
}

export function outcomeAusPunkten(eigen: number, gegner: number): DuellOutcome {
  return eigen === gegner ? "draw" : eigen > gegner ? "win" : "loss";
}

/**
 * DIE BRUECKE: aus den PPS-Scores beider Seiten jedes Fixtures die Duell-Overrides beider Teams.
 * Nur Fixtures, bei denen BEIDE Teams einen Score haben und KEINES in `ausgeschlosseneTeamIds`
 * steht (dort liegt bereits ein Arena-Ergebnis vor). Ein Team ohne Fixture bekommt keinen Eintrag.
 *
 * Remis nur bei exakt gleichem Score (der PPS-Score ist eine auf 0,1 gerundete Fliesskommazahl aus
 * Eignung, Form, Mutator und Slot — ein Remis ist selten, bleibt aber defensiv ein Remis).
 */
export function berechnePpsDuellOverrides(input: {
  fixtures: readonly Fixture[];
  scoreByTeamId: ReadonlyMap<string, number>;
  disciplineId: string;
  playerCount: number | null | undefined;
  ausgeschlosseneTeamIds?: ReadonlySet<string>;
}): Map<string, PpsDuellOverride> {
  const overrides = new Map<string, PpsDuellOverride>();
  for (const fixture of input.fixtures) {
    const { homeTeamId, awayTeamId } = fixture;
    if (input.ausgeschlosseneTeamIds?.has(homeTeamId) || input.ausgeschlosseneTeamIds?.has(awayTeamId)) continue;
    if (overrides.has(homeTeamId) || overrides.has(awayTeamId)) continue;
    const heim = input.scoreByTeamId.get(homeTeamId);
    const gast = input.scoreByTeamId.get(awayTeamId);
    if (heim == null || gast == null || !Number.isFinite(heim) || !Number.isFinite(gast)) continue;
    const heimOutcome = outcomeAusPunkten(heim, gast);
    const gastOutcome: DuellOutcome = heimOutcome === "draw" ? "draw" : heimOutcome === "win" ? "loss" : "win";
    const punkte = (outcome: DuellOutcome) => DUELL_TEAM_PUNKTE[outcome];
    overrides.set(homeTeamId, {
      teamPoints: punkte(heimOutcome),
      opponentTeamId: awayTeamId,
      seiten: [heim, gast],
      outcome: heimOutcome,
      ...berechneDuellVerhaeltnis({
        quelle: "pps",
        disciplineId: input.disciplineId,
        playerCount: input.playerCount,
        seiten: [heim, gast],
        outcome: heimOutcome,
      }),
    });
    overrides.set(awayTeamId, {
      teamPoints: punkte(gastOutcome),
      opponentTeamId: homeTeamId,
      seiten: [gast, heim],
      outcome: gastOutcome,
      ...berechneDuellVerhaeltnis({
        quelle: "pps",
        disciplineId: input.disciplineId,
        playerCount: input.playerCount,
        seiten: [gast, heim],
        outcome: gastOutcome,
      }),
    });
  }
  return overrides;
}

/**
 * Herkunft der Team-Punkte einer Disziplin-Zeile, die Tabelle/Ledger als feste Duell-Punktzahl
 * buchen (statt die Rangtabelle nachzuschlagen). EINE Stelle fuer standings-preview-engine.ts und
 * season-points-ledger.ts.
 */
export function istDuellWertung(row: { resolutionSource?: string | null; teamPoints?: number | null }): boolean {
  return (row.resolutionSource === "arena" || row.resolutionSource === "pps_duell") && row.teamPoints != null;
}

// =====================================================================================
// INDIVIDUELLE PPS DER BRUECKE — Team-Rang-Entkopplung (Opus-Befund 18.10.), s. Dateikopf-Kommentar.
// =====================================================================================

/**
 * DIESELBEN BEIDEN REGLER WIE DIE ARENA-IMPACT-KURVE (`BASKETBALL_INDIVIDUAL_PPS_MAX`/
 * `BASKETBALL_PPS_ANTEIL_MITTE`, battle-mode-arena-team-points.ts): Chris' Rahmen "max 5-6" und die
 * an 352 echten Duellen entschiedene Kurvenform (04.09., docs/design/pps-skalierung-umsetzung.md
 * Abschnitt 9) sind Aussagen ueber die KURVE selbst, disziplinuebergreifend — nicht ueber
 * Basketball-spezifische Zahlen. Was disziplin-/kanal-spezifisch ist, steckt vollstaendig in der
 * gezogenen Referenz (`iMittel`/`iKrass`), nicht in diesen beiden Werten. EIGENE Konstanten statt
 * eines Imports aus `battle-mode-arena-team-points.ts` (s. Dateikopf-Kommentar, Playwright-Grenze).
 */
export const PPS_DUELL_INDIVIDUAL_PPS_MAX = 5.5;
export const PPS_DUELL_PPS_ANTEIL_MITTE = 0.25;

type DuellIndividualReferenzFeldgroesse = { iMittel: number; iKrass: number };
type DuellIndividuellReferenzJson = {
  feldgroessen?: number[];
  saatStroeme?: number[];
  disziplinen?: Record<
    string,
    { feldgroessen?: Record<string, { stroeme?: Record<string, { iMittel?: number; iKrass?: number }> }> }
  >;
};

const DUELL_INDIVIDUELL_REFERENZ = duellIndividuellReferenzJson as unknown as DuellIndividuellReferenzJson;

/**
 * Baut JE DISZIPLIN UND FELDGROESSE EINEN Referenzwert aus den (mindestens einem, i.d.R. zwei)
 * gezogenen Saatstroemen — das arithmetische Mittel von `iMittel` bzw. `iKrass` ueber alle Stroeme.
 * Die zwei Stroeme in der JSON-Datei sind eine MESSWIEDERHOLUNG zur Absicherung der Ziehung
 * (Provenienz-Pflicht der Projektaufsicht), keine zwei zur Laufzeit gleichzeitig gueltigen Werte.
 * Gecached, weil die JSON-Datei pro Prozesslauf unveraendert bleibt.
 */
const duellReferenzCache = new Map<string, ReadonlyMap<number, DuellIndividualReferenzFeldgroesse>>();

function ladeDuellReferenzFeldgroessen(disciplineId: string): ReadonlyMap<number, DuellIndividualReferenzFeldgroesse> {
  const cached = duellReferenzCache.get(disciplineId);
  if (cached) return cached;
  const feldgroessen = DUELL_INDIVIDUELL_REFERENZ.disziplinen?.[disciplineId]?.feldgroessen ?? {};
  const result = new Map<number, DuellIndividualReferenzFeldgroesse>();
  for (const [nRaw, eintrag] of Object.entries(feldgroessen)) {
    const n = Number(nRaw);
    const stroeme = Object.values(eintrag?.stroeme ?? {}).filter(
      (s): s is { iMittel: number; iKrass: number } =>
        typeof s?.iMittel === "number" && Number.isFinite(s.iMittel) && typeof s?.iKrass === "number" && Number.isFinite(s.iKrass),
    );
    if (!Number.isFinite(n) || stroeme.length === 0) continue;
    const iMittel = stroeme.reduce((sum, s) => sum + s.iMittel, 0) / stroeme.length;
    const iKrass = stroeme.reduce((sum, s) => sum + s.iKrass, 0) / stroeme.length;
    if (iMittel > 0 && iKrass > iMittel) result.set(n, { iMittel, iKrass });
  }
  duellReferenzCache.set(disciplineId, result);
  return result;
}

/**
 * Loest die Referenz EINER Disziplin fuer EXAKT die angefragte Feldgroesse auf — ANDERS als
 * `resolveArenaPpsReferenz()` BEWUSST OHNE Rueckfall auf die naechstgelegene gezogene Feldgroesse.
 * Grund: die Arena-Referenz deckt ALLE fuenf Feldgroessen (2..6) ab, ein Nearest-Match extrapoliert
 * dort also nur innerhalb bereits gemessener Nachbarn. Die Bruecken-Referenz deckt ABSICHTLICH NUR
 * {5,6} ab (die CLAUDE.md-Abnahmegroessen) — Feldgroesse 2..4 ist Task #175, ein separat offener
 * Punkt, den dieser Fix NICHT verschlimmern darf. Ein Nearest-Match wuerde z.B. Feldgroesse 2 auf
 * die n=5-Referenz zerren, eine UNGEMESSENE Extrapolation genau in dem Bereich, den der Auftrag
 * ausdruecklich nicht anfassen soll. Liefert deshalb `null` fuer jede Feldgroesse ausser 5/6 (und
 * fuer jede Disziplin ohne gezogene Referenz ueberhaupt) — der Aufrufer faellt dann unveraendert
 * auf das bisherige, team-rang-gebundene Verhalten zurueck, mit Warnung.
 */
export function resolveDuellIndividualPpsReferenz(
  disciplineId: string,
  playerCount: number | null | undefined,
): { referenz: DuellIndividualReferenzFeldgroesse; feldgroesseGenutzt: number } | null {
  if (typeof playerCount !== "number" || !Number.isFinite(playerCount)) return null;
  const n = Math.round(playerCount);
  const feldgroessen = ladeDuellReferenzFeldgroessen(disciplineId);
  const referenz = feldgroessen.get(n);
  if (!referenz) return null;
  return { referenz, feldgroesseGenutzt: n };
}

/**
 * DIE IMPACT-KURVE DER BRUECKE — bewusst dieselbe Formel wie `ppsAusArenaImpact()`
 * (battle-mode-arena-team-points.ts Abschnitt "DIE IMPACT-KURVE"), nur eigenstaendig kopiert (s.
 * Dateikopf-Kommentar fuer die Playwright-Importgrenze, die den Grund dafuer nennt):
 * `PPs = MAX * min(1, (max(0,I)/I_krass)^gamma)`, `gamma = ln(a_mitte) / ln(I_mittel/I_krass)`. Der
 * Rohwert `I` ist hier `PlayerPerformancePreview.finalPlayerScore` (bzw. der bereits team-power-
 * skalierte Wert, den der Aufrufer uebergibt) statt eines Arena-Boxscore-Werts — derselbe Kanal,
 * den `distributeRankPointsToPlayers()` bisher team-rang-gebunden verteilt hat.
 */
export function ppsAusDuellWert(
  wert: number,
  referenz: DuellIndividualReferenzFeldgroesse,
  max: number = PPS_DUELL_INDIVIDUAL_PPS_MAX,
  anteilMitte: number = PPS_DUELL_PPS_ANTEIL_MITTE,
): number {
  const { iMittel, iKrass } = referenz;
  if (!(iKrass > 0) || !(iMittel > 0) || iMittel >= iKrass) return 0;
  const gamma = Math.log(anteilMitte) / Math.log(iMittel / iKrass);
  const basis = Math.max(0, wert) / iKrass;
  const anteil = basis <= 0 ? 0 : Math.min(1, Math.pow(basis, gamma));
  return Math.round(max * anteil * 100) / 100;
}

/**
 * Baut die individuellen PPs ALLER Spieler EINER Team-Seite, die ueber die Bruecke gewertet wird —
 * EINE Stelle fuer `legacy-matchday-resolve-engine.ts`, statt die Kurve dort pro Spieler inline
 * aufzurufen. Liefert `null` (statt einer leeren Map), wenn fuer diese Disziplin/Feldgroesse KEINE
 * Referenz vorliegt — der Aufrufer unterscheidet "kein Duell" (leere Map waere dasselbe wie "alle 0")
 * nicht von "keine Referenz, alter Pfad greift weiter".
 */
export function berechneDuellIndividualPpsFuerSeite(input: {
  disciplineId: string;
  playerCount: number | null | undefined;
  entries: ReadonlyArray<{ playerId: string; wert: number | null | undefined }>;
}): { ppsByPlayerId: Map<string, number>; feldgroesseGenutzt: number } | null {
  const referenz = resolveDuellIndividualPpsReferenz(input.disciplineId, input.playerCount);
  if (!referenz) return null;
  const ppsByPlayerId = new Map<string, number>();
  for (const entry of input.entries) {
    if (entry.wert == null || !Number.isFinite(entry.wert)) continue;
    ppsByPlayerId.set(entry.playerId, ppsAusDuellWert(entry.wert, referenz.referenz));
  }
  return { ppsByPlayerId, feldgroesseGenutzt: referenz.feldgroesseGenutzt };
}
