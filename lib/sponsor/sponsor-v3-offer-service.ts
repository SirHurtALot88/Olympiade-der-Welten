/**
 * SPONSORSYSTEM V3 — Angebotserzeugung, eingefrorene Konditionen und Abrechnung.
 *
 * Jedes Angebot bekommt einen `sponsorV3`-Block: die vollstaendigen, bei Unterschrift eingefrorenen
 * Konditionen aus `lib/sponsor/sponsor-v3-model.ts`. Ab da rechnen Anzeige, Finanzprognose,
 * KI-Bewertung und Settlement ausschliesslich aus diesem Block — eine Rechenstelle, deshalb kann die
 * harte Projekt-Invariante "Anzeige == Settlement" nicht durch eine zweite Variante brechen.
 *
 * DER TRAEGER IST DIESELBE 32er-LEITER WIE IN V2, nur anders befuellt: statt Liga-Stufen, Kurvenform,
 * Profil, Klausel, Kalibrieroffset und Liga-K steht jetzt die PREISGELD-BENCHMARK-LEITER darin,
 * einmal um den teameigenen Erwartungsanker getiltet. Was ersatzlos entfallen ist, steht im
 * Kopfkommentar von sponsor-v3-model.ts.
 *
 * WAS BEWUSST WIEDERVERWENDET WIRD statt neu gebaut: Marke, Name, Flavour, Rarity-Wurf, die
 * Sonderziel-Engine (`evaluateSpecialComponentStage`, 22+ fertige Ziele), der Settlement-Pfad und die
 * `lockedRankPayoutLadder`-Infrastruktur.
 */
import type { GameState, SponsorOffer, SponsorRarity, TeamSponsorContract } from "@/lib/data/olyDataTypes";

import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildPrizeMoneyTable } from "@/lib/season/prize-money";
import { getPrizePlacementBonus } from "@/lib/season/prize-placement-table";
import { buildSponsorOfferModuleIds } from "@/lib/sponsor/sponsor-modules";
import {
  buildSponsorV3TermsCore,
  sponsorV3CardByKey,
  sponsorV3GuaranteedLadder,
  sponsorV3LadderValue,
  sponsorV3Settle,
  SPONSOR_V3_CARDS,
  type SponsorV3CardKey,
  type SponsorV3ContractTerms,
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

export function buildSponsorV3Terms(input: {
  gameState: GameState;
  offer: SponsorOffer;
  /** Startrang der Saison — Basis des Platzierungsbonus in der Leiter. */
  startRank: number;
  cardKey: SponsorV3CardKey;
}): SponsorV3ContractTerms {
  const card = sponsorV3CardByKey(input.cardKey);
  const goalKey = card.goal
    ? input.offer.components.find((component) => component.kind === "special")?.specialKey ?? null
    : null;
  return buildSponsorV3TermsCore({
    prizeCurve: getSponsorV3PrizeCurve(input.gameState),
    placementBonus: getPrizePlacementBonus,
    startRank: input.startRank,
    rarity: input.offer.rarity ?? RARITY_FALLBACK,
    card,
    goalKey,
    salaryFactor: getSponsorV3SalaryFactor(input.gameState),
    floor: SPONSOR_V3_FLOOR_C,
  });
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
  startRank: number;
}): SponsorOffer[] {
  if (input.offers.length === 0) return input.offers;
  return input.offers.map((offer, index) => {
    const cardKey = input.cardKeys[index] ?? SPONSOR_V3_CARDS[index % SPONSOR_V3_CARDS.length]!.key;
    const terms = buildSponsorV3Terms({
      gameState: input.gameState,
      offer,
      startRank: input.startRank,
      cardKey,
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

/** Traegt ein Angebot/Vertrag V3-Konditionen? */
export function getSponsorV3Terms(
  entry: SponsorOffer | TeamSponsorContract | null | undefined,
): SponsorV3ContractTerms | null {
  const terms = (entry as { sponsorV3?: SponsorV3ContractTerms } | null | undefined)?.sponsorV3;
  if (!terms || terms.version !== 3) return null;
  if (!Array.isArray(terms.rankLadder) || terms.rankLadder.length !== 32) return null;
  if (!Array.isArray(terms.baseLadder) || terms.baseLadder.length !== 32) return null;
  return terms;
}
