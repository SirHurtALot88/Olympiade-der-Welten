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
 */
import type { Fixture, GameState } from "@/lib/data/olyDataTypes";
import verhaeltnisReferenzJson from "@/data/generated/verhaeltnis-referenz.json";

/** Dieselben Werte wie `ARENA_TEAM_POINTS` (battle-mode-arena-team-points.ts) — ein Test haelt beide gleich. */
export const DUELL_TEAM_PUNKTE = { win: 2, draw: 1, loss: 0 } as const;

export type DuellOutcome = "win" | "draw" | "loss";
export type VerhaeltnisQuelle = "pps" | "arena";

/** Rueckfall, wenn fuer Quelle/Disziplin keine gezogene Referenz existiert (Konzept 3.4). */
export const VERHAELTNIS_RUECKFALL_D = 5;
export const VERHAELTNIS_MAX = 10;

type ReferenzFeldgroesse = {
  n: number;
  m90: number;
  /** PP-BUDGET (s. `ppAusSpielerScore()` unten): p50/p99,5 des Spieler-Endscores dieser Zelle. */
  spieler?: { p50: number; p995: number };
  /** NIVEAU (s. `interpoliereNiveau()`/`berechneErgebnisNormiert()` unten): p5/p50/p95 des Team-Scores. */
  niveau?: { p: readonly [number, number, number]; w: readonly [number, number, number] };
};
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
 * Die naechstgelegene gezogene Feldgroesse fuer (Quelle, Disziplin) -- dieselbe Rueckfall-Logik wie
 * `resolveArenaPpsReferenz()`: exakte Feldgroesse, sonst die naechstgelegene, sonst `null`. EINE
 * Stelle fuer `resolveMargeReferenz()`, `resolveSpielerPpReferenz()` und `resolveNiveauReferenz()` --
 * alle drei lesen dieselbe `feldgroessen`-Tabelle, nur ein anderes Feld daraus.
 */
function resolveNaechsteFeldgroesse(
  quelle: VerhaeltnisQuelle,
  disciplineId: string,
  playerCount: number | null | undefined,
  gueltigFilter: (eintrag: ReferenzFeldgroesse) => boolean,
): ReferenzFeldgroesse | null {
  const feldgroessen = REFERENZ.quellen?.[quelle]?.[disciplineId]?.feldgroessen;
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
 * M90 fuer (Quelle, Disziplin, Feldgroesse). Exakte Feldgroesse, sonst die naechstgelegene gezogene
 * (dieselbe Rueckfall-Logik wie `resolveArenaPpsReferenz()`), sonst `null` (-> Rueckfall-D).
 */
export function resolveMargeReferenz(
  quelle: VerhaeltnisQuelle,
  disciplineId: string,
  playerCount: number | null | undefined,
): { m90: number; feldgroesseGenutzt: number } | null {
  const eintrag = resolveNaechsteFeldgroesse(quelle, disciplineId, playerCount, (e) => Number.isFinite(e.m90) && e.m90 > 0);
  return eintrag ? { m90: eintrag.m90, feldgroesseGenutzt: eintrag.n } : null;
}

/**
 * PP-BUDGET-REFERENZ (Chris 19.10., "bei PP waere ich bei Fable, die PPs haengen vom Impact Rating
 * der Spieler ab"): p50/p99,5 des Spieler-Endscores (`finalPlayerScore`) fuer (Disziplin,
 * Feldgroesse), IMMER aus der Quelle "pps" (der PPS-Score ist derselbe, ob die Zeile am Ende als
 * `"pps_duell"` oder `"arena"` gebucht wird -- nur die Arena-Zeilen haben zusaetzlich einen eigenen,
 * schon durch `ppsAusArenaImpact()` individualisierten Boxscore-Wert, s. Kommentar an
 * `ppAusSpielerScore()`). Gezogen von `scripts/ziehe-verhaeltnis-referenz.ts`.
 */
export function resolveSpielerPpReferenz(
  disciplineId: string,
  playerCount: number | null | undefined,
): { p50: number; p995: number } | null {
  const eintrag = resolveNaechsteFeldgroesse("pps", disciplineId, playerCount, (e) => Boolean(e.spieler) && e.spieler!.p995 > e.spieler!.p50);
  return eintrag?.spieler ? { p50: eintrag.spieler.p50, p995: eintrag.spieler.p995 } : null;
}

/**
 * NIVEAU-REFERENZ (Teil B, "Niveau + Marge"): die grob gerasterte CDF (p5/p50/p95) des rohen
 * Team-Scores fuer (Quelle, Disziplin, Feldgroesse). `null` ohne gezogene Referenz --
 * `interpoliereNiveau()` faellt dann auf ein neutrales Niveau (0,5) zurueck, was die
 * Sieger-Ordnungs-Garantie (`W - V = D`) NIE verletzt, s. Kommentar an `berechneErgebnisNormiert()`.
 */
export function resolveNiveauReferenz(
  quelle: VerhaeltnisQuelle,
  disciplineId: string,
  playerCount: number | null | undefined,
): { p: readonly [number, number, number]; w: readonly [number, number, number] } | null {
  const eintrag = resolveNaechsteFeldgroesse(quelle, disciplineId, playerCount, (e) => Boolean(e.niveau) && e.niveau!.w[2] > e.niveau!.w[0]);
  return eintrag?.niveau ?? null;
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

// ===================================================================================
// TEIL A — PP-BUDGET, REIN LEISTUNGSBASIERT (Chris 19.10., Opus/Fable-Konzepte, unabhaengig
// identisch empfohlen).
//
// BEFUND: `distributeRankPointsToPlayers({ teamPointsOverride: teamResult.teamPoints })` (s.
// legacy-matchday-resolve-engine.ts, season-points-ledger.ts) verteilt bei einer Duell-Zeile IMMER
// nur das gebuchte Team-Budget (2/1/0) unter den Spielern -- der beste Spieler eines 0:2-Verlierers
// bekommt strukturell 0, egal wie gut sein eigener Score war. Gemessen an einem echten 20-Spieltage-
// Battle-Save: Top-Spieler landen am Saisonende bei nur 7-8,6 PP kumuliert (Median 3,5) -- zu wenig,
// und falsch begruendet (Team-Ausgang statt eigene Leistung).
//
// CHRIS' ENTSCHEIDUNG (19.10., woertlich): "bei PP waere ich bei Fable, die PPs haengen von dem
// Impact Rating der Spieler ab! Ein guter Spieler im schlechten Verlierer-Team kann also trotzdem
// viele Punkte sammeln!" -- KEIN Team-Sieg/Niederlage-Bonus auf die PP-MENGE, nur die individuelle
// Leistung zaehlt. Das ist exakt dieselbe Philosophie wie die bestehende Arena-Impact-Kurve
// (`ppsAusArenaImpact()`, battle-mode-arena-team-points.ts), jetzt auf `pps_duell` erweitert.
//
// DIE FORMEL ist bewusst NICHT neu erfunden, sondern dieselbe Kurve, nur mit anderer Referenz:
//
//   PP_i = MAX * min(1, (max(0, s_i) / S_krass)^gamma),  gamma = ln(a) / ln(S_mittel / S_krass)
//
// `s_i` = `finalPlayerScore` (die bereits fertige Groesse -- Form, Fatigue, Verletzung, Slot-Rolle,
// Kapitaen, Mutator-Score, Team-Power-Debuff sind schon drin, hier wird nichts davon neu gerechnet).
// `S_mittel`/`S_krass` = p50/p99,5 des Spieler-Scores je (Disziplin, Feldgroesse), gezogen von
// `scripts/ziehe-verhaeltnis-referenz.ts` (dieselbe KI-Aufstellungs-Pipeline wie die M90-Referenz).
// `MAX`/`a` = 5,5/0,25 -- exakt dieselben Regler wie `BASKETBALL_INDIVIDUAL_PPS_MAX`/
// `BASKETBALL_PPS_ANTEIL_MITTE` (04.09. kalibriert), bewusst kein zweiter Reglersatz.
//
// Die Kurve selbst ist aus genau demselben Grund dupliziert statt aus
// `battle-mode-arena-team-points.ts` importiert, aus dem diese Datei ueberhaupt existiert (s.
// Datei-Kommentar oben): jene Datei importiert `node:os` (`freemem()`) fuer die Arena-Headless-Seite
// und darf von `legacy-matchday-resolve-engine.ts`/`season-points-ledger.ts` nicht gezogen werden.
// ===================================================================================

/** Dieselben Regler wie `BASKETBALL_INDIVIDUAL_PPS_MAX`/`BASKETBALL_PPS_ANTEIL_MITTE` (04.09.). */
export const PPS_DUELL_SPIELER_PP_MAX = 5.5;
export const PPS_DUELL_SPIELER_PP_ANTEIL_MITTE = 0.25;

/**
 * DIE IMPACT-KURVE, identisch zu `ppsAusArenaImpact()` (battle-mode-arena-team-points.ts) -- s.
 * Datei-Kommentar oben, warum sie hier dupliziert statt importiert ist. Eine entartete Referenz
 * (`p995 <= p50`) liefert 0 statt NaN/Infinity, ein negativer Score ebenso (`max(0, s_i)`).
 */
function ppAusImpactKurve(wert: number, p50: number, p995: number, max: number, anteilMitte: number): number {
  if (!(p995 > 0) || !(p50 > 0) || p50 >= p995) return 0;
  const gamma = Math.log(anteilMitte) / Math.log(p50 / p995);
  const basis = Math.max(0, wert) / p995;
  const anteil = basis <= 0 ? 0 : Math.min(1, Math.pow(basis, gamma));
  return Math.round(max * anteil * 100) / 100;
}

/**
 * PP-BUDGET aus dem eigenen Spieler-Score, KOMPLETT team-unabhaengig: haengt nur von `finalPlayerScore`
 * und der gezogenen Referenz ab -- keine Kopplung an `teamPoints`, Sieg/Remis/Niederlage, oder die
 * Gegnerseite. `referenz: null` (keine gezogene Zelle fuer diese Disziplin/Feldgroesse) liefert 0,
 * nie NaN -- defensiv, sollte an einer echten gezogenen Referenz nie greifen.
 */
export function ppAusSpielerScore(
  finalPlayerScore: number | null | undefined,
  referenz: { p50: number; p995: number } | null,
  max: number = PPS_DUELL_SPIELER_PP_MAX,
  anteilMitte: number = PPS_DUELL_SPIELER_PP_ANTEIL_MITTE,
): number {
  if (!referenz || typeof finalPlayerScore !== "number" || !Number.isFinite(finalPlayerScore)) return 0;
  return ppAusImpactKurve(finalPlayerScore, referenz.p50, referenz.p995, max, anteilMitte);
}

// ===================================================================================
// TEIL B — 0-10-NORMIERUNG MIT GARANTIERTER SIEGER-ORDNUNG ("Niveau + Marge", von Opus UND Fable
// unabhaengig identisch vorgeschlagen, am echten Save mit 0 Ordnungsfehlern verifiziert).
//
// Bestehend und UNVERAENDERT: D = `berechneVerhaeltnisBetrag()` oben (max(1, round(10*min(1,
// m/M90))), Vorzeichen aus dem gebuchten Ausgang, kg-Tiebreak bei Gewichtheben als D=1) -- das ist
// bereits die korrekte Marge. NEU ist nur, wie W (Sieger) und V (Verlierer) aus D UND einem
// zusaetzlichen "Niveau" des Duells (0..1, aus einer gelernten, monotonen Verteilungsfunktion F des
// rohen Seiten-Scores) entstehen:
//
//   mu = (F(roh_Sieger) + F(roh_Verlierer)) / 2        Niveau des Duells, 0..1
//   c  = 10 * mu
//   V  = round(clamp(c - D/2, 0, 10 - D))              Verlierer (GANZZAHLIG, EINE Rundung)
//   W  = V + D                                          Sieger
//   Remis (D=0): W = V = round(c)
//
// GARANTIE (by construction, unabhaengig von F): `W - V = D` exakt, W >= V immer, beide in [0,10].
// Die Rundung passiert NUR auf V, NICHT unabhaengig auf beiden Seiten -- zwei unabhaengige
// Rundungen koennten beide Seiten auf dieselbe gerundete Zahl bringen (~6 % der Faelle laut
// Opus-/Fable-Messung), obwohl der Ausgang bereits entschieden war. Die Reihenfolge kommt deshalb
// NIE aus F (F ist rein kosmetisch -- "wie stark war dieses Duell"), sondern einzig aus D.
// ===================================================================================

/**
 * KONSTANTSUMMEN-DISZIPLINEN (Chris/Opus/Fable 19.10., woertlich uebernommen): bei diesen sieben
 * ist der native Seitenwert strukturell (nahezu) komplementaer/konstant -- Niveau mu waere darueber
 * IMMER ~0,5, unabhaengig davon, wie stark das Duell tatsaechlich war. Bewusst als FESTE Liste statt
 * einer Laufzeit-Heuristik ("erkenne robust"), damit kein Agent spaeter raten muss, welche Disziplin
 * gerade betroffen ist.
 */
export const KONSTANTSUMME_NIVEAU_DISCIPLINE_IDS: ReadonlySet<string> = new Set([
  "tennis",
  "speed-schach",
  "gewichtheben",
  "spurt",
  "climbing",
  "staffel",
  "time-trial",
  // OPUS-REVIEW PR #1296, gegen die Chassis-Logik nachgeprueft (public/mockups/battle-mode.engine.js,
  // `spieleBuehneGauntlet()`): Breakings Seitenstand ist die Ueberlebenden-Zaehlung `[alive(0),
  // alive(1)]`, und der Gauntlet laeuft immer, bis EIN Team aufgebraucht ist -- der Verlierer steht
  // also strukturell IMMER auf 0, der Sieger auf genau seiner Marge. Der native Seitenwert traegt
  // damit dasselbe Nicht-Niveau wie eine Konstantsumme (er ist reine Marge), gehoert also nach
  // demselben Kriterium hierher. Die uebrigen arena-aufgeloesten Disziplinen bleiben draussen:
  // Showcase/Eiskunstlauf/Wettessen (Auftritts-Summe), Fechten (Treffer-Summe) und Takeshi's Castle
  // (Burgpunkte) haben eine echt variable Seitensumme.
  "breaking",
]);

/**
 * F: die grob gerasterte, monotone CDF aus `resolveNiveauReferenz()` (drei Anker aus der Referenz,
 * `p: [0.05, 0.5, 0.95]` an `w: [p5, p50, p95]` -- also p5 -> 0,05, p50 -> 0,5, p95 -> 0,95,
 * dazwischen linear, ausserhalb auf 0,05/0,95 geklemmt; mu liegt damit in [0,05; 0,95]). `referenz: null` liefert ein
 * neutrales 0,5 -- die Sieger-Ordnungs-Garantie haengt NIE von F ab (s. Datei-Kommentar oben), ein
 * fehlendes/duennes Niveau-Raster macht die Anzeige also bestenfalls weniger aussagekraeftig, nie
 * falsch geordnet.
 */
export function interpoliereNiveau(
  wert: number,
  referenz: { p: readonly [number, number, number]; w: readonly [number, number, number] } | null,
): number {
  if (!referenz) return 0.5;
  const { p, w } = referenz;
  if (!(w[2] > w[0])) return 0.5;
  if (wert <= w[0]) return p[0];
  if (wert >= w[2]) return p[2];
  if (wert <= w[1]) {
    const spanne = w[1] - w[0];
    const t = spanne > 0 ? (wert - w[0]) / spanne : 0;
    return p[0] + t * (p[1] - p[0]);
  }
  const spanne = w[2] - w[1];
  const t = spanne > 0 ? (wert - w[1]) / spanne : 0;
  return p[1] + t * (p[2] - p[1]);
}

function clamp(wert: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, wert));
}

/**
 * W (eigenes Ergebnis) und V (gegnerisches Ergebnis) aus Sicht EINES Teams -- aufgerufen einmal je
 * Team/Zeile (symmetrisch zu `berechneDuellVerhaeltnis()`). `betrag` ist das UNVORZEICHENBEHAFTETE D
 * (0..10, aus `berechneVerhaeltnisBetrag()`), `niveauEigen`/`niveauGegner` die Rohwerte, die F
 * bewertet (fuer Konstantsummen-Disziplinen der PPS-Team-Score statt des nativen Seitenwerts -- s.
 * `KONSTANTSUMME_NIVEAU_DISCIPLINE_IDS`, vom Aufrufer schon aufgeloest).
 */
export function berechneErgebnisNormiert(input: {
  outcome: DuellOutcome;
  betrag: number;
  niveauEigen: number;
  niveauGegner: number;
  referenz: { p: readonly [number, number, number]; w: readonly [number, number, number] } | null;
}): [number, number] {
  const mu = (interpoliereNiveau(input.niveauEigen, input.referenz) + interpoliereNiveau(input.niveauGegner, input.referenz)) / 2;
  const c = 10 * mu;
  if (input.outcome === "draw") {
    const gleich = Math.round(clamp(c, 0, 10));
    return [gleich, gleich];
  }
  const d = clamp(Math.round(input.betrag), 0, 10);
  const verlierer = Math.round(clamp(c - d / 2, 0, 10 - d));
  const sieger = verlierer + d;
  return input.outcome === "win" ? [sieger, verlierer] : [verlierer, sieger];
}
