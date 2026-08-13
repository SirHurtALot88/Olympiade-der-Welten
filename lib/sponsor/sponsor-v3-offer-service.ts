/**
 * SPONSORSYSTEM V3 — Angebotserzeugung, eingefrorene Konditionen und Abrechnung.
 *
 * Jedes Angebot bekommt einen `sponsorV3`-Block: die vollstaendigen, bei Unterschrift eingefrorenen
 * Konditionen aus `lib/sponsor/sponsor-v3-model.ts`. Ab da rechnen Anzeige, Finanzprognose,
 * KI-Bewertung und Settlement ausschliesslich aus diesem Block — eine Rechenstelle, deshalb kann die
 * harte Projekt-Invariante "Anzeige == Settlement" nicht durch eine zweite Variante brechen.
 *
 * DER TRAEGER IST DIESELBE 32er-LEITER WIE IN V2, nur anders befuellt: seit dem Sponsor-Ligaleiter-
 * Umbau steht darin die geshapete LIGALEITER (Sockel nach Startrang + Wertungstopf nach Endrang,
 * `sponsorKurvenLeiter` in sponsor-liga-leiter.ts), einmal um den teameigenen Erwartungsanker
 * getiltet. Die Kurvenform ist damit wieder ein Erzeugungs-Feld — nicht mehr nur Anzeige-Etikett. Was
 * ersatzlos entfallen ist, steht im Kopfkommentar von sponsor-v3-model.ts.
 *
 * WAS BEWUSST WIEDERVERWENDET WIRD statt neu gebaut: Marke, Name, Flavour, Rarity-Wurf, die
 * Sonderziel-Engine (`evaluateSpecialComponentStage`, 22+ fertige Ziele), der Settlement-Pfad und die
 * `lockedRankPayoutLadder`-Infrastruktur.
 */
import type {
  GameState, SponsorCurveShape, SponsorOffer, SponsorRarity, SponsorTermSeasons, TeamSponsorContract,
} from "@/lib/data/olyDataTypes";

import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildPrizeMoneyTable } from "@/lib/season/prize-money";
import { buildSponsorV4AxisTerms } from "@/lib/sponsor/sponsor-v4-axes";
import { buildSponsorOfferModuleIds } from "@/lib/sponsor/sponsor-modules";
import { SPONSOR_LEIH_BONUS } from "@/lib/sponsor/sponsor-leih-ziele";
import { SPONSOR_BODEN, sponsorKurvenLeiter, sponsorSockelFuerStartrang } from "@/lib/sponsor/sponsor-liga-leiter";
import { SPONSOR_CURVE_SHAPE_KEYS } from "@/lib/sponsor/sponsor-curve-shapes";
import { getSponsorTermMultiplier } from "@/lib/sponsor/sponsor-negotiation";
import {
  buildSponsorV3TermsCore,
  sponsorV3Anchor,
  sponsorV3AnchorWeights,
  sponsorV3CardByKey,
  sponsorV3GuaranteedLadder,
  sponsorV3LadderValue,
  sponsorV3Settle,
  sponsorV3TiltedLadder,
  sponsorV3WertFaktorFor,
  SPONSOR_V3_WERT_BY_RARITY,
  sponsorV4AxisSizeFor,
  SPONSOR_V3_CARDS,
  type SponsorV3CardKey,
  type SponsorV3ContractTerms,
  type SponsorV4AxisKey,
} from "@/lib/sponsor/sponsor-v3-model";

export type { SponsorV3ContractTerms } from "@/lib/sponsor/sponsor-v3-model";
export {
  sponsorV3ExpectedPayout,
  sponsorV3GoalSizeFor,
  sponsorV3GuaranteedLadder,
  sponsorV3IsMonotone,
  sponsorV3LadderValue,
  sponsorV3Settle,
  sponsorV3StandardDeviation,
} from "@/lib/sponsor/sponsor-v3-model";

// ── Welches Sponsorsystem gilt? ────────────────────────────────────────────────────────────────
export type SponsorSystemVersion = 1 | 2 | 3;

/**
 * DIE VERSION, DIE JEDES NEU ANGELEGTE SPIEL BEKOMMT. Der Wert wird beim Anlegen EINMAL in den
 * Spielstand geschrieben (`seasonState.sponsorSystemVersion`) und ab da nur noch von dort gelesen.
 */
export const SPONSOR_SYSTEM_VERSION_FOR_NEW_GAMES: SponsorSystemVersion = 3;

/**
 * Welches Sponsorsystem hat DIESEN Spielstand angelegt? Reine HERKUNFTS-Angabe fuer Diagnose und
 * Anzeige: seit der V3-Migration (`sponsor-v3-migration.ts`) rechnen ALLE noch nicht abgerechneten
 * Vertraege nach V3, unabhaengig davon, unter welcher Version sie einmal entstanden sind.
 */
export function resolveSponsorSystemVersion(gameState: GameState): SponsorSystemVersion {
  const stamped = gameState.seasonState?.sponsorSystemVersion;
  return stamped === 1 || stamped === 2 || stamped === 3 ? stamped : 1;
}

/** Setzt den Versionsvermerk beim ANLEGEN eines Spielstands. Idempotent und nicht ueberschreibend. */
export function stampSponsorSystemVersion(
  gameState: GameState,
  version: SponsorSystemVersion = SPONSOR_SYSTEM_VERSION_FOR_NEW_GAMES,
): GameState {
  const stamped = gameState.seasonState?.sponsorSystemVersion;
  if (stamped === 1 || stamped === 2 || stamped === 3) {
    return gameState;
  }
  return { ...gameState, seasonState: { ...gameState.seasonState, sponsorSystemVersion: version } };
}

// ── Die Liga-Groessen, gegen die eingefroren wird ──────────────────────────────────────────────

/**
 * ABSOLUTE UNTERGRENZE — Sicherheitsnetz, kein Balancing-Hebel (Guardrail aus Abschnitt 4 des
 * Entwurfs). Sie bindet praktisch nie: typische Kartenboeden liegen bei 41-57 C. Nur die
 * schlechteste Konstellation des Live-Saves (Meister mit Ambition-Karte stuerzt auf Rang 32) landet
 * knapp darauf.
 *
 * @deprecated fuer NEUE Angebote seit dem Sponsor-Ligaleiter-Umbau: der Live-Pfad
 * (`buildSponsorV3Terms`) nutzt `SPONSOR_BODEN` (sponsor-liga-leiter.ts). Diese Konstante bleibt fuer
 * die Migration und die Vergleichsskripte stehen, die weiterhin auf der alten Preisgeld-Benchmark
 * rechnen — deren typische Kartenboeden liegen weiterhin im hier beschriebenen Bereich, waehrend die
 * neue Ligaleiter mit ihrem viel niedrigeren Sockel (18 statt ~41-57) ein hoeheres Netz braucht.
 */
export const SPONSOR_V3_FLOOR_C = 32;

/**
 * REFERENZ-GEHALT JE TEAM, wenn die Liga noch keine echten Gehaelter fuehrt.
 *
 * GEMESSENER BEFUND (uebernommen aus V2, und dort ein echter Fehler gewesen): in einem FRISCH
 * erzeugten Spiel ist die Gehaltssumme der Liga 0 — die Sponsorangebote entstehen beim Anlegen des
 * Spiels, die Spielervertraege bekommen ihre Gehaelter erst im Draft danach. Ohne diese Schranke
 * waere die Preisgeldkurve gegen eine Gehaltssumme von 0 gebaut und jede Karte wirtschaftlich tot.
 * 64,9 C je Team ist der gemessene S1-Schnitt aus einem echten Save.
 */
export const SPONSOR_V3_REFERENCE_SALARY_PER_TEAM = 64.9;

/**
 * ECHTE Gehaltssumme eines Teams (`resolvePlayerEconomyContract().salary`, front-/back-loaded
 * beruecksichtigt) — NICHT der geglaettete `expectedSalary`.
 *
 * Abschnitt 6 des Entwurfs, gemessen: Z-H 97,7 echt gegen 83,3 geglaettet (−15 %), Liga-Summe
 * 2 056,6 gegen 2 017,4. Beim Ligajahr-Faktor 1,15 waere der Pool des geglaetteten Ankers ~45 C zu
 * klein. Der Preisgeld-Benchmark rechnet mit der echten Summe; wenn der Sponsor-Anker daneben am
 * geglaetteten Wert haengt, kann die Sponsorleiter den Benchmark gar nicht treffen.
 * `expectedSalary` bleibt reine Anzeige-Glaettung und fasst kein Geld mehr an.
 */
export function getTeamRealSalaryTotal(gameState: GameState, teamId: string): number {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const total = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => {
      const player = playerById.get(entry.playerId) ?? null;
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0);
    }, 0);
  return Math.round(total * 10) / 10;
}

/** Ligajahr-Faktor der laufenden Saison. */
export function getSponsorV3SalaryFactor(gameState: GameState): number {
  const factor = gameState.seasonState.seasonEconomyFactors?.[0]?.factor;
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : 1;
}

/** Die echten Gehaelter der Liga, mit Plausibilitaetsschranke gegen den Frisch-Save-Kollaps. */
export function getSponsorV3LeagueSalaries(gameState: GameState): { salaries: number[]; usedReference: boolean } {
  const measured = gameState.teams.map((team) => getTeamRealSalaryTotal(gameState, team.teamId));
  const teamCount = Math.max(1, measured.length);
  const measuredSum = measured.reduce((sum, value) => sum + value, 0);
  if (measuredSum >= teamCount * SPONSOR_V3_REFERENCE_SALARY_PER_TEAM * 0.25) {
    return { salaries: measured, usedReference: false };
  }
  return { salaries: measured.map(() => SPONSOR_V3_REFERENCE_SALARY_PER_TEAM), usedReference: true };
}

const prizeCurveCache = new Map<string, number[]>();

/**
 * DIE PREISGELDKURVE DER SAISON (Rang 1..32) — exakt `buildPrizeMoneyTable` aus den ECHTEN
 * Liga-Gehaeltern mal Ligajahr-Faktor, also dieselbe Funktion, aus der die Benchmark-Preview ihre
 * Zahlen zieht. Eine Kurve, eine Wahrheit: die Admin-Balancing-Konfiguration der Preisgeldkurve
 * wirkt damit direkt auf die Sponsoren (gewollter, im Entwurf ausgewiesener Nebeneffekt).
 *
 * Gecacht je (Saison, Faktor, gerundete Gehaltssumme) — sonst laeuft die Tabelle bei jedem der
 * 160 erzeugten Angebote neu.
 */
export function getSponsorV3PrizeCurve(gameState: GameState): number[] {
  const salaryFactor = getSponsorV3SalaryFactor(gameState);
  const { salaries } = getSponsorV3LeagueSalaries(gameState);
  const salarySum = salaries.reduce((sum, value) => sum + value, 0);
  const adminConfig = gameState.seasonState.adminBalancingConfig;
  const key = `${gameState.season.id}:${salaryFactor.toFixed(3)}:${salarySum.toFixed(1)}:${salaries.length}:${adminConfig ? JSON.stringify(adminConfig) : "-"}`;
  const hit = prizeCurveCache.get(key);
  if (hit) return hit;
  const rows = buildPrizeMoneyTable(salaries, salaryFactor, adminConfig);
  const byRank = new Map(rows.map((row) => [row.rank, row.totalPrizeMoney] as const));
  const curve = Array.from({ length: 32 }, (_, index) => byRank.get(index + 1) ?? 0);
  prizeCurveCache.set(key, curve);
  return curve;
}

/** Nur fuer Tests: der Cache haelt die Kurve je Saison fest und wuerde sonst ueber Testfaelle lecken. */
export function resetSponsorV3PrizeCurveCache(): void {
  prizeCurveCache.clear();
}

// ── Konditionen bauen ──────────────────────────────────────────────────────────────────────────

const RARITY_FALLBACK: SponsorRarity = "magisch";

/**
 * DER RARITÄTS-WERTFAKTOR EINER KARTE — die eine Stelle, die "Rarität wirkt genau einmal" ausdrueckt.
 *
 * Eine Gebaeude-Karte traegt ihre Rarität im KURS (`Verzicht = Leihwert / Kurs`) und startet deshalb
 * auf dem untersten Faktor; eine reine Cash-Karte traegt sie in der HOEHE der Leiter. Die Regel stand
 * bis hierher an zwei Stellen woertlich gleich (Unterschrift und Saisonwechsel) — genau die Bauart
 * "zwei Rechenstellen fuer dieselbe Zahl". Sie steht jetzt einmal.
 */
export function sponsorV3WertFaktorFuerKarte(input: { rarity: string; leihVerzicht?: number | null }): number {
  return (input.leihVerzicht ?? 0) > 0
    ? SPONSOR_V3_WERT_BY_RARITY["gewöhnlich"]
    : sponsorV3WertFaktorFor(input.rarity);
}

/**
 * DER SOCKEL, DEN DIESE KARTE WIRKLICH HAT.
 *
 * `sponsorSockelFuerStartrang` liefert den NACKTEN Liga-Sockel des Startrangs. Die eingefrorene
 * Leiter eines Vertrags steht aber nie darauf: sie ist mit dem Raritaets-Wertfaktor skaliert und um
 * den Gebaeude-Verzicht abgesenkt (siehe `buildSponsorV3Terms` und `rerollSponsorV3TermsForNewSeason`
 * — beide bauen Leiter UND Netz `floor` nach genau dieser Formel).
 *
 * Wer den nackten Sockel gegen `terms.anchor` haelt, vergleicht zwei verschiedene Waehrungen. GEMESSEN
 * ueber die 160 Angebote des Live-Abbilds vom 11.08.2026: Ø 9,76 C Abweichung, groesste 30,2 C
 * (gewoehnliche Gebaeude-Karte, Verzicht 25,4, Startrang 23 — nackter Sockel 43,2, echter 13,1).
 *
 * `anchor − sockel` ist damit EXAKT der Wertungsanteil, den `getSponsorTermMultiplier` in den
 * Folgesaisons zusammenschrumpfen laesst — nachgemessen ueber alle 160 Angebote eines frischen
 * Spielstands gegen `rerollSponsorV3TermsForNewSeason` selbst: Abweichung 0 (siehe
 * tests/sponsor-ki-laufzeit-sockel.test.ts).
 *
 * BEWUSST NICHT AUF 0 GEKLAMMERT. Bei einer grossen Leihe auf einem vorderen Startrang kann der
 * Verzicht den skalierten Sockel uebersteigen (gemessen: 5 von 160 Angeboten, tiefster Wert −3,5 C).
 * Genau dort greift dann `terms.floor` und haelt die Leiter unten — aber der Drehpunkt der EROSION
 * bleibt der ungeklammerte Wert; ein Clamp hier machte den Wertungsanteil zu klein und damit den
 * gerechneten Erosionsverlust zu gering (gemessen: bis 0,21 C daneben). Wer den Sockel als GELD
 * lesen will (Versicherungswert), klammert an seiner eigenen Stelle.
 */
export function sponsorV3EingefrorenerSockel(
  terms: Pick<SponsorV3ContractTerms, "startRank" | "rarity" | "leihVerzicht">,
): number {
  const wertFaktor = sponsorV3WertFaktorFuerKarte(terms);
  const verzicht = Math.max(0, terms.leihVerzicht ?? 0);
  return sponsorSockelFuerStartrang(terms.startRank) * wertFaktor - verzicht;
}

export function buildSponsorV3Terms(input: {
  gameState: GameState;
  offer: SponsorOffer;
  /** Startrang der Saison — Sockel + Erwartungsanker der Ligaleiter haengen an ihm. */
  startRank: number;
  cardKey: SponsorV3CardKey;
  /** Achse dieser Karte (V4). Gesetzt = fix mit p = 0,5 bepreist statt ueber eine Schaetztabelle. */
  axisKey?: SponsorV4AxisKey | null;
  /** Kurvenform dieses Angebots (sponsor-tier-pool.ts) — bestimmt, WO auf der Ligaleiter das Geld liegt. */
  curveShape: SponsorCurveShape;
  teamId?: string;
  golden?: boolean;
  /** Cash-Verzicht der Gebaeude-Karte (E1) — senkt die Leiter, statt eine Abzugszeile zu buchen. */
  leihVerzicht?: number;
  /** Traegt diese Karte eines der zwei Leih-Ziele? Dann fest bepreist und OHNE Sockelabzug. */
  leihZielKey?: string | null;
}): SponsorV3ContractTerms {
  const card = sponsorV3CardByKey(input.cardKey);
  const goalKey = card.goal
    ? input.offer.components.find((component) => component.kind === "special")?.specialKey ?? null
    : null;
  const rarity = input.offer.rarity ?? RARITY_FALLBACK;
  // Bei gesetztem Leih-Ziel wird die Achse gar nicht erst gebaut. Vorher lief
  // `buildSponsorV4AxisTerms` (und damit `buildTeamSeasonOverviewRows` samt Rang-Rechnung) bei JEDER
  // Gebaeude-Karte durch, nur damit `buildSponsorV3TermsCore` das Ergebnis anschliessend verwirft —
  // funktional harmlos, aber vier verworfene Ligarechnungen je Team und Saison.
  const axis =
    input.axisKey && input.teamId && !input.leihZielKey
      ? buildSponsorV4AxisTerms(input.gameState, input.teamId, input.axisKey)
      : null;
  const salaryFactor = getSponsorV3SalaryFactor(input.gameState);
  // DIE SPONSOR-LIGALEITER statt der Preisgeldkurve (Umbau): Sockel nach Startrang + Wertungstopf
  // nach Endrang, die Kurvenform entscheidet nur noch, WO auf dieser Leiter das Geld liegt. Die
  // Preisgeldkurve selbst (`getSponsorV3PrizeCurve`) wird im Live-Pfad nicht mehr gebraucht.
  // DER RARITÄTS-WERTFAKTOR sitzt hier und NICHT in `buildSponsorV3TermsCore`, weil er eine
  // Entscheidung ueber neu erzeugte Angebote ist. Der Kern wird auch von der Migration und von den
  // Vergleichsskripten gerufen, die eine gegebene Leiter unveraendert bewerten sollen — ein Faktor
  // dort verschoebe rueckwirkend die Zahlen von Altvertraegen.
  //
  // DIE RARITÄT WIRKT AUF JEDER KARTE GENAU EINMAL — auf der Cash-Karte als Hoehe, auf der
  // Gebaeude-Karte als Kurs. Sonst greift sie doppelt zu, und das war messbar: bei praktisch
  // GLEICHEM Gebaeudewert (Ø 12,4 gegen 12,8) trug die legendaere Gebaeude-Karte 69,3 C
  // Erwartungswert, die gewoehnliche 48,9 — 20 C mehr Cash fuer dasselbe Gebaeude. Chris: „achte
  // darauf dass bei gebäude deals dann nicht MEHR cash UND dicke gebäude angebote rein kommen."
  //
  // Der Verzicht steckt bereits die Rarität: `Verzicht = Leihwert / Kurs`, und der Kurs IST die
  // Rarität (1,4 .. 3,0). Eine legendaere Gebaeude-Karte bekommt ihr Gebaeude also fuer ein Drittel
  // des Cash-Verzichts einer gewoehnlichen — das ist ihr Vorteil, und er reicht. Die Leiter bleibt
  // dafuer auf der magischen Mitte, egal wie selten die Karte ist.
  //
  // WARUM DIE GEBÄUDE-KARTE AUF DEN UNTERSTEN FAKTOR GESETZT WIRD und nicht auf 1,0: der erste
  // Entwurf nahm die magische Mitte, und damit war eine GEWOEHNLICHE Gebäude-Karte (Faktor 1,0)
  // ladderseitig BESSER als eine gewoehnliche Cash-Karte (Faktor 0,89). Bei einer kleinen Leihe mit
  // rund 1 C Verzicht bekam man also mehr Cash UND ein Gebäude — derselbe doppelte Zugriff, nur in
  // die andere Richtung. Gemessen schlug das voll durch: die reine Cash-Karte wurde von 0 bis 1 von
  // 32 Teams gewaehlt.
  //
  // Die Regel, die beides zugleich haelt: die Rarität ADDIERT immer, nie ersetzt sie. Die
  // Gebäude-Karte startet auf dem untersten Faktor, ihre Rarität schlaegt sich vollstaendig im Kurs
  // nieder; eine Cash-Karte startet dort ebenfalls und ihre Rarität hebt die Leiter. Damit ist eine
  // Cash-Karte derselben Rarität nie schlechter als eine Gebäude-Karte, und der Unterschied zwischen
  // ihnen ist genau das, was man dafuer bekommt.
  const wertFaktor = sponsorV3WertFaktorFuerKarte({ rarity, leihVerzicht: input.leihVerzicht });
  const baseLadder = sponsorKurvenLeiter({
    shape: input.curveShape,
    startRank: input.startRank,
    salaryFactor,
  }).map((wert) => wert * wertFaktor);
  return buildSponsorV3TermsCore({
    baseLadder,
    startRank: input.startRank,
    rarity,
    card,
    goalKey,
    curveShape: input.curveShape,
    axis,
    axisSize: axis ? sponsorV4AxisSizeFor(rarity, input.golden === true) : undefined,
    festesZiel: input.leihZielKey ? { key: input.leihZielKey, size: SPONSOR_LEIH_BONUS } : null,
    salaryFactor,
    // SPONSOR_BODEN statt SPONSOR_V3_FLOOR_C: der neue Sockel reicht bei Startrang 1 bis 18 hinunter,
    // das alte Netz (32) saesse fuer diese Leiter zu tief.
    //
    // DAS NETZ SINKT MIT DER KARTE, und das ist keine Feinheit, sondern die Bedingung dafuer, dass
    // grosse Gebaeude-Karten ueberhaupt existieren koennen. Gemessen: die niedrigste Sprosse ueber
    // alle Kurvenformen und Startraenge liegt bei 52,1 C, das feste Netz bei 43 — es blieben nur
    // 9,1 C Luft. Ein Verzicht von 15 oder 25 C (Gebaeude auf Stufe 4/5, siehe
    // `STARTSTUFE_JE_GROESSE`) waere am unteren Ende der Tabelle vollstaendig vom Netz aufgefangen
    // worden: das Team haette das Gebaeude bekommen, aber nichts dafuer bezahlt. Ein absolutes Netz
    // passt zu einer Karte, die alle gleich viel zahlt; sobald eine Karte bewusst weniger zahlt,
    // muss ihr Netz mitsinken, sonst hebelt es genau die Entscheidung aus, um die es geht.
    // Das Netz traegt denselben Wertfaktor wie die Leiter — sonst waere es fuer eine gewoehnliche
    // Karte relativ hoeher als fuer eine legendaere und wuerde ihr den Wertunterschied unten wieder
    // zurueckgeben.
    floor: Math.max(0, SPONSOR_BODEN * wertFaktor - Math.max(0, input.leihVerzicht ?? 0)),
    leihVerzicht: input.leihVerzicht,
  });
}

/**
 * MEHRJAHRESVERTRAG ROLLT IN DIE FOLGESAISON (Umsetzungsplan D) — `advanceSponsorContractsForNewSeason`
 * (sponsor-contract-lifecycle.ts) ruft das fuer jeden Vertrag mit `seasonsRemaining > 1` auf.
 *
 * ZWEI DINGE PASSIEREN, TECHNISCH IN EINEM SCHRITT: die Kopplung an den Salary Factor UND die
 * Rendite-Erosion.
 *
 * KOPPLUNG (ausdrueckliche Nutzervorgabe): der eingefrorene `startRank` UND die eingefrorene
 * `curveShape` bleiben stehen — nur der Salary Factor wird durch den DER NEUEN SAISON ersetzt.
 * `sponsorKurvenLeiter` leitet den Sockel ausschliesslich aus `startRank` ab (er bleibt damit exakt
 * gleich) und skaliert NUR den Wertungsanteil mit dem Faktor — das ist die ganze Kopplung, siehe
 * `sponsor-liga-leiter.ts`. Ohne diesen Neubau wuerde ein in einem starken Jahr (f = 1,24)
 * unterschriebener Vertrag drei Saisons lang auf 1,24-Niveau weiterzahlen, unabhaengig davon, ob die
 * Liga danach in eine Flaute faellt (f = 0,82) — das genau das Schlupfloch, das die Erosion allein
 * nicht schliessen koennte (siehe TERM_MULTIPLIERS-Kommentar in sponsor-negotiation.ts).
 *
 * EROSION: `contractYear` (1 = Unterschriftssaison, 2/3 = gerollte Folgesaisons) waehlt den
 * Multiplikator aus `getSponsorTermMultiplier`. Er wirkt NUR auf den WERTUNGSANTEIL — die Differenz
 * zwischen der neu gebauten Leiter und dem (unveraenderten) Sockel — nicht auf den Sockel selbst,
 * sonst schrumpfte genau die Absicherung, die der Sockel sein soll.
 *
 * ALTVERTRAEGE: fehlt `curveShape` (Vertraege aus Spielstaenden von vor dem Ligaleiter-Umbau, die
 * ohne Neuerzeugung weitergerollt wurden), kann keine neue Leiter gebaut werden — die Funktion wirft
 * NICHT, sondern gibt die eingefrorene Leiter unveraendert zurueck (heutiges Verhalten vor diesem
 * Patch bleibt fuer sie bestehen).
 */
export function rerollSponsorV3TermsForNewSeason(
  terms: SponsorV3ContractTerms,
  input: { newSalaryFactor: number; contractYear: SponsorTermSeasons },
): SponsorV3ContractTerms {
  if (!terms.curveShape) {
    /**
     * ALTVERTRAEGE OHNE KURVENFORM — hier lief ein Leck, kein Sonderfall.
     *
     * Frueher gab dieser Zweig die eingefrorene Leiter unveraendert zurueck: die Kurve laesst
     * sich ohne `curveShape` nicht neu bauen, also blieb alles stehen. Nur blieb damit auch der
     * GEHALTSFAKTOR stehen — und der ist der Konjunkturmassstab der Saison, nicht eine
     * Eigenschaft des Vertrags. Ein Mehrjahresvertrag zahlte deshalb Saison fuer Saison auf dem
     * Niveau seines Unterschriftsjahres weiter.
     *
     * Gemessen am Live-Spielstand (Saison 2, echter Faktor 1,19): 10 von 32 Vertraegen steckten
     * noch auf 1,0 fest, zusammen 129,6 C zu wenig — Z-H allein 17,4. Die Einmalreparatur
     * (`scripts/repariere-sponsor-gehaltsfaktor.ts`) hatte das fuer Saison 1 nachgebucht; hier
     * lief es unbemerkt weiter, weil ein Altvertrag den Fehler bei JEDEM Saisonwechsel neu
     * erzeugt.
     *
     * Die Leiter wird deshalb umgerechnet statt neu gebaut, mit derselben Rechnung wie das
     * Reparaturskript: nur der Wertungsanteil OBERHALB des Sockels haengt am Gehaltsfaktor, der
     * Sockel selbst ist nach Startrang eingefroren und bleibt unberuehrt.
     *
     * BEWUSST OHNE Erosion: dieser Zweig hat noch nie erodiert, und zwei Aenderungen auf einmal
     * waeren an einem laufenden Spielstand nicht mehr auseinanderzuhalten. Hier wird der eine
     * belegte Fehler behoben, sonst nichts.
     */
    const alterFaktor = terms.salaryFactor;
    if (
      !Number.isFinite(alterFaktor) ||
      alterFaktor <= 0 ||
      alterFaktor === input.newSalaryFactor ||
      !Number.isFinite(input.newSalaryFactor) ||
      input.newSalaryFactor <= 0
    ) {
      return terms;
    }
    // `terms.baseLadder ?? []` WAR HIER EINE WACHE, DIE NICHT WACHT: eine leere Liste ist nicht
    // nullish, und selbst wenn sie es waere, machte `?? []` aus einer fehlenden Leiter eine leere.
    // Skaliert man die, kommt `[]` heraus, `sponsorV3Anchor([], …)` liefert 0 — und der Vertrag
    // traegt danach eine Leiter ohne Sprossen und einen Anker von 0. `getSponsorV3Terms` erkennt so
    // ein Objekt spaeter nicht mehr als V3-Konditionen an; der Vertrag faellt beim Abrechnen still
    // auf die nachgebaute Benchmark zurueck, und das Team bekommt eine ganz andere Zahl als auf
    // seiner Karte steht. Dieser Zweig laeuft NUR beim Saisonwechsel und NUR fuer Altvertraege — er
    // wird also von keinem gewoehnlichen Spieldurchlauf beruehrt. Passiert etwas hier, bleibt die
    // eingefrorene Leiter stehen, statt sie durch eine leere zu ersetzen.
    if (terms.baseLadder?.length !== 32 || terms.rankLadder?.length !== 32) {
      return terms;
    }
    const altSockel = sponsorSockelFuerStartrang(terms.startRank);
    const skala = input.newSalaryFactor / alterFaktor;
    const skaliere = (leiter: number[]) => leiter.map((wert) => altSockel + (wert - altSockel) * skala);
    const skalierteBasis = skaliere(terms.baseLadder);
    return {
      ...terms,
      baseLadder: skalierteBasis,
      rankLadder: skaliere(terms.rankLadder),
      anchor: sponsorV3Anchor(skalierteBasis, sponsorV3AnchorWeights(terms.startRank)),
      salaryFactor: input.newSalaryFactor,
    };
  }
  // Wertfaktor und Sockel muessen beim Neubau DIESELBEN sein wie bei der Unterschrift, sonst
  // veraendert der Saisonwechsel den Vertrag inhaltlich. Der Sockel skaliert deshalb mit — und die
  // Einmal-Regel (Rarität wirkt als Hoehe ODER als Kurs, nie beides) gilt hier genauso.
  const wertFaktor = sponsorV3WertFaktorFuerKarte(terms);
  const sockel = sponsorSockelFuerStartrang(terms.startRank) * wertFaktor;
  const newBaseLadderRaw = sponsorKurvenLeiter({
    shape: terms.curveShape,
    startRank: terms.startRank,
    salaryFactor: input.newSalaryFactor,
  }).map((wert) => wert * wertFaktor);
  const multiplier = getSponsorTermMultiplier(input.contractYear);
  // Erosion NUR auf den Wertungsanteil (Wert oberhalb des Sockels) — der Sockel selbst bleibt exakt
  // der nach Startrang eingefrorene Wert, unveraendert durch Erosion oder Salary-Factor-Wechsel.
  //
  // UND DER LEIH-VERZICHT MUSS WIEDER AB: die Leiter wird hier NEU gebaut, der in der alten Leiter
  // steckende Verzicht (E1) waere sonst ab Vertragsjahr 2 verschwunden — die Gebaeude-Karte zahlte
  // dann wie eine reine Cash-Karte und behielte das Gebaeude gratis. Abgezogen wird der EINGEFRORENE
  // Betrag; dass er mit der Leihstufe steigt, traegt Schritt 7 der Bauvorlage nach.
  const verzicht = Math.max(0, terms.leihVerzicht ?? 0);
  const baseLadder = newBaseLadderRaw.map((value) =>
    Math.max(0, sockel + multiplier * (value - sockel) - verzicht),
  );
  const weights = sponsorV3AnchorWeights(terms.startRank);
  const anchor = sponsorV3Anchor(baseLadder, weights);
  const rankLadder = sponsorV3TiltedLadder(baseLadder, anchor, terms.tilt);
  return {
    ...terms,
    baseLadder,
    rankLadder,
    anchor,
    salaryFactor: input.newSalaryFactor,
  };
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Haengt jedem Angebot der Liste seine V3-Konditionen an und zieht die Cash-Komponenten nach, damit
 * die Karte und die Finanzprognose dieselben Zahlen sehen wie das Settlement.
 *
 * Die Komponentenliste bleibt in der bestehenden Form (base / rank / special), damit Anzeige,
 * Finanz-Sichten und die Modul-Ableitung unveraendert weiterlaufen. Karten OHNE Sonderziel verlieren
 * ihre Sonderziel-Komponente ganz: eine Zeile "Sonderziel 0,0 C" waere ein totes Modul und genau die
 * Anzeige, die das Settlement nie einloest.
 */
export function applySponsorV3ToOffers(input: {
  gameState: GameState;
  offers: SponsorOffer[];
  /** Karte je Angebot, in derselben Reihenfolge. Kommt aus dem Slate-Wurf der Erzeugung. */
  cardKeys: SponsorV3CardKey[];
  /** Achse je Angebot, in derselben Reihenfolge. null bei der Basis-Karte. */
  axisKeys?: (SponsorV4AxisKey | null)[];
  /** Kurvenform je Angebot, in derselben Reihenfolge. Kommt aus dem Slate-Wurf der Erzeugung. */
  curveShapes: SponsorCurveShape[];
  /** Slots, die das Golden-Los gezogen haben — dort ist der Achsenhebel groesser. */
  goldenSlots?: number[];
  /** Cash-Verzicht je Angebot (E1) — 0/null bei den reinen Cash-Karten. */
  leihVerzichte?: (number | null)[];
  /** Leih-Ziel je Angebot — null bei Karten ohne Gebaeude. */
  leihZielKeys?: (string | null)[];
  teamId?: string;
  startRank: number;
}): SponsorOffer[] {
  if (input.offers.length === 0) return input.offers;
  return input.offers.map((offer, index) => {
    const cardKey = input.cardKeys[index] ?? SPONSOR_V3_CARDS[index % SPONSOR_V3_CARDS.length]!.key;
    // Fallback nur fuer den theoretischen Fall eines Aufrufers, der weniger Formen als Angebote
    // liefert (heute genau einer, `buildSponsorOffersForTeam`, liefert immer gleich viele) — lieber
    // eine deterministisch rotierende Form als ein Absturz.
    const curveShape = input.curveShapes[index] ?? SPONSOR_CURVE_SHAPE_KEYS[index % SPONSOR_CURVE_SHAPE_KEYS.length]!;
    const terms = buildSponsorV3Terms({
      gameState: input.gameState,
      offer,
      startRank: input.startRank,
      cardKey,
      axisKey: input.axisKeys?.[index] ?? null,
      curveShape,
      teamId: input.teamId,
      golden: input.goldenSlots?.includes(index) === true,
      leihVerzicht: input.leihVerzichte?.[index] ?? 0,
      leihZielKey: input.leihZielKeys?.[index] ?? null,
    });
    const ladder = sponsorV3GuaranteedLadder(terms);
    const floor = ladder[31]!;
    const topRank = ladder[0]!;
    const carriesGoal = terms.goalSize > 0 && terms.goalKey != null;
    const components = offer.components
      // Karten ohne Sonderziel tragen die Komponente gar nicht erst.
      .filter((component) => component.kind !== "special" || carriesGoal)
      .map((component) => {
        // `rewardCash` der Basis BEWUSST UNGERUNDET: die Gewinnstufen-Leiter der Karte rechnet
        // `baseCash + (Leiterwert − Leiterboden)`. Waere `baseCash` gerundet, der Leiterboden aber
        // nicht, wiche die angezeigte Sprosse um bis zu 0,1 C von dem ab, was das Settlement zahlt.
        if (component.kind === "base") {
          return { ...component, targetValue: round1(floor), rewardCash: floor, penaltyCash: undefined };
        }
        if (component.kind === "rank") {
          return {
            ...component,
            label: `Gewinnstufen nach Endrang · ${terms.cardName}`,
            rewardCash: round1(Math.max(0, topRank - floor)),
            targetValue: 1,
            penaltyCash: undefined,
          };
        }
        return { ...component, rewardCash: round1(terms.goalSize), penaltyCash: undefined };
      });
    const next: SponsorOffer = {
      ...offer,
      components,
      sponsorV3: terms,
      // Bestwert der Karte: Titel plus voll erreichtes Sonderziel (der Sockelabzug −p·G steckt darin).
      totalUpsideEstimate: round1(topRank + (carriesGoal ? (1 - terms.goalP) * terms.goalSize : 0)),
    };
    return { ...next, moduleIds: buildSponsorOfferModuleIds(next) };
  });
}

// ── Settlement-Zerlegung ───────────────────────────────────────────────────────────────────────
export type SponsorV3SettlementPart = {
  key: "base" | "rank" | "special";
  label: string;
  cashDelta: number;
  reason: string;
  met: boolean;
};

/**
 * Zerlegt die V3-Auszahlung in drei Zeilen, die sich per TELESKOPSUMME exakt auf
 * `sponsorV3Settle(...)` addieren. Jede Zeile ist eine Differenz echter Modellwerte — deshalb koennen
 * Rundung und Untergrenze die Summe nicht verfaelschen, egal an welcher Stelle sie greifen. Die
 * bestehende Zerlegungs-Idee aus V2 bleibt unveraendert; nur die Klausel-Zeile faellt weg, weil ihre
 * Risikofunktion jetzt der Tilt uebernimmt.
 */
export function sponsorV3SettlementParts(input: {
  terms: SponsorV3ContractTerms;
  finalRank: number | null;
  goalFraction: number;
}): SponsorV3SettlementPart[] {
  const { terms, finalRank, goalFraction } = input;
  // Saisonbasis und Tabellenplatz kommen aus dem REINEN Kurventeil; der Sockelabzug −p·G steht
  // vollstaendig in der Sonderziel-Zeile. Sonst versteckte sich der Abzug in der Basiszeile und die
  // Sonderziel-Zeile behauptete einen Gewinn, den es so nicht gibt.
  const atFloor = sponsorV3LadderValue(terms, 32);
  const atRank = sponsorV3LadderValue(terms, finalRank);
  const withGoal = sponsorV3Settle(terms, finalRank, goalFraction);
  const tiltLabel = terms.tilt > 0 ? "Ambition" : terms.tilt < 0 ? "Sicherheit" : "Basis";
  const parts: SponsorV3SettlementPart[] = [
    {
      key: "base",
      label: "Saisonbasis (garantiert)",
      cashDelta: round1(atFloor),
      met: true,
      reason: `Sockel der Karte ${terms.cardName} — zahlt auf jedem Endrang`,
    },
    {
      key: "rank",
      label: "Tabellenplatz",
      cashDelta: round1(atRank - atFloor),
      met: atRank > atFloor,
      reason:
        `Endrang ${finalRank ?? "—"} gegen Startrang ${terms.startRank} · Liga-Benchmark ` +
        `${round1(terms.baseLadder[Math.max(0, Math.min(31, (finalRank ?? 32) - 1))] ?? 0)} C` +
        (terms.tilt === 0 ? "" : ` · ${tiltLabel} ${terms.tilt > 0 ? "+" : ""}${Math.round(terms.tilt * 100)} %`),
    },
  ];
  // KEINE VORSCHUSS-VERRECHNUNG MEHR. Hier stand eine zweite `base`-Zeile, die den bei Unterschrift
  // ausgezahlten Vorschuss samt Gebuehr wieder abzog. Sie faellt mit dem Vorschuss selbst weg: die
  // Auszahlung besteht jetzt vollstaendig aus Saisonbasis + Tabellenplatz (+ Sonderziel).
  //
  // ALTVERTRAEGE, die das `advance`-Feld noch tragen, werden hier BEWUSST NICHT MEHR belastet —
  // die Entscheidung und ihre gemessenen Kosten stehen bei `getSponsorV3Terms` weiter unten.
  if (terms.goalSize > 0) {
    parts.push({
      key: "special",
      label: "Sonderziel",
      cashDelta: round1(withGoal - atRank),
      met: goalFraction > 0,
      reason:
        goalFraction >= 1
          ? `erreicht — ${round1(terms.goalSize)} C abzueglich Sockelabzug ${round1(terms.goalP * terms.goalSize)} C ` +
            `(Erfolgswahrscheinlichkeit ${Math.round(terms.goalP * 100)} %)`
          : goalFraction > 0
            ? `teilweise erreicht (${Math.round(goalFraction * 100)} %)`
            : `verfehlt — Sockelabzug ${round1(terms.goalP * terms.goalSize)} C bleibt stehen`,
    });
  }
  return parts;
}

/**
 * Traegt ein Angebot/Vertrag V3-Konditionen?
 *
 * BESTANDSVERTRAEGE MIT `advance` — DIE ENTSCHEIDUNG UND WARUM SIE SO FAELLT.
 *
 * In laufenden Spielen liegen unterschriebene Vertraege, die noch ein `advance`-Feld tragen
 * (gemessen: Save `s2` 9 von 32, Save `repro` 10 von 31, Chris' `1hf25q` 10 von 32). Das Feld wird
 * hier BEWUSST NICHT entfernt und NICHT mehr gelesen — es ist ab jetzt totes Beiwerk im Spielstand.
 * Daraus folgen drei Dinge, alle beabsichtigt:
 *
 *  1. KEIN NACHTRAEGLICHER ABZUG. Der Vorschuss wurde bei Unterschrift ausgezahlt und ist als
 *     `v4_advance`-Log gebucht; das Geld liegt real in der Kasse. Die Verrechnungszeile am
 *     Saisonende ist weg, also wird er nicht mehr eingezogen. Die betroffenen Teams behalten ihn.
 *     Kosten, gemessen ueber die noch nicht abgerechneten Saisons: `s2` 105,9 C (7 Teams, die in
 *     Saison 2 unterschrieben haben) + 5,3 C entfallende Gebuehren, `repro` 159,3 C + 8,0 C.
 *     Das ist der Preis dafuer, dass NICHTS umgebucht werden muss.
 *  2. KEINE RUECKBUCHUNG. Die Alternative waere, Kasse und Log rueckwirkend zu korrigieren. Das
 *     haette laufende Spielstaende angefasst, um Geld einzuziehen, das der Spieler laengst
 *     ausgegeben hat (Transferfenster) — genau der Eingriff, der einen Spielstand kaputt macht.
 *  3. DER GEFAEHRLICHE FEHLER WAERE DER UMGEKEHRTE, und er war real: `rerollSponsorV3TermsForNewSeason`
 *     spreadet die Konditionen und nahm `advance` in die Folgesaison mit, ohne dass dort je ein
 *     Vorschuss ausgezahlt wurde. Ein Mehrjahresvertrag verlor damit ab Jahr 2 jede Saison erneut
 *     Betrag + Gebuehr (im Save `s2` betraf das H-R und N-W, zusammen 37,5 C + 1,9 C). Weil das
 *     Feld jetzt nirgends mehr gelesen wird, ist dieser Doppelabzug mit derselben Aenderung
 *     erledigt — er kann auch fuer die schon gerollten Vertraege nicht mehr auftreten.
 *
 * Bereits ABGERECHNETE Saisons bleiben unberuehrt: deren Auszahlung steht als Log fest und wird
 * nicht neu gerechnet.
 */
export function getSponsorV3Terms(
  entry: SponsorOffer | TeamSponsorContract | null | undefined,
): SponsorV3ContractTerms | null {
  const terms = (entry as { sponsorV3?: SponsorV3ContractTerms } | null | undefined)?.sponsorV3;
  if (!terms || terms.version !== 3) return null;
  if (!Array.isArray(terms.rankLadder) || terms.rankLadder.length !== 32) return null;
  if (!Array.isArray(terms.baseLadder) || terms.baseLadder.length !== 32) return null;
  return terms;
}
