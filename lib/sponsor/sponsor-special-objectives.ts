import type { GameState, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";

/**
 * ERZEUGUNGSSEITE DER 27 BONUS- UND 6 GOLDEN-ZIELE — ENTFERNT (2026-08).
 *
 * Diese Datei fuehrte bis hierher den vollen Katalog: Staerke-Gates, Stufenleitern, Picker und Bauer
 * fuer 27 Bonus- plus 6 Golden-Sonderziele. Das Audit-Skript `scripts/sponsor-ziele-audit.ts` hat
 * gegen einen echten, gespielten Spielstand (8 Saison-Seeds x 32 Teams = 1024 erzeugte Sonderziel-
 * Komponenten) gemessen: ALLE 1024 waren eine der fuenf V4-Achsen, KEINE einzige eines der 27+6
 * Bonus-/Golden-Ziele. Ursache: `SPONSOR_V3_CARDS` fuehrt seit dem V4-Umbau nur noch `basis` (ohne
 * Ziel) und `achse` (Ziel = die Achse selbst) — in `sponsor-offer-service.ts` setzt sich fuer jede
 * Achsenkarte der `if (input.axisKey)`-Zweig immer VOR den Bonus-/Golden-Zweig, weil jede Achsenkarte
 * ihr `axisKey` traegt. Der Bonus-/Golden-Katalog wurde also bei jeder der 160 Angebotserzeugungen
 * pro Saison vollstaendig gebaut und sofort wieder verworfen — toter Katalog, aber keine tote
 * Rechenzeit.
 *
 * WAS BLEIBT UND WARUM: die AUSWERTUNG der Alt-Ziele bleibt vollstaendig erhalten
 * (`sponsor-objective-evaluator.ts`) — 32 in echten Spielstaenden bereits UNTERSCHRIEBENE Vertraege
 * tragen genau diese Alt-Ziel-Schluessel (u. a. `form_color_cover`, `axis_rank_top`,
 * `salary_pressure_max`, `axis_ascension`, `momentum_series`, `rival_humiliation`,
 * `beliebtheit_climb`, …). Wuerde man ihre Auswertung mitloeschen, fiele jeder dieser Vertraege auf
 * `fraction = 0` und zoege dauerhaft seinen eingepreisten Abschlag ab, ohne je auszuzahlen — eine
 * stille Verschlechterung in jedem bestehenden Spielstand. Die Achsen-Bausteine unten
 * (`SponsorAxisKey`, `getTeamAxisRank`, `parseAxisTargetValue`, …) werden sowohl vom Evaluator als
 * auch weiterhin von der Achsenkarten-Erzeugung gebraucht und bleiben deshalb hier stehen.
 *
 * Ob und welche Bonus-/Golden-Ziele zurueckkommen, entscheidet der Nutzer separat — sie sind nicht
 * durch etwas Neues ersetzt, nur entfernt.
 */

export type SponsorAxisKey = "pow" | "spe" | "men" | "soc";

/** Nur noch die fuer den Liga-Rang gebrauchte Spalte je Achse (Label/Bias-Felder fielen mit `pickPrimaryAxisForTeam` weg). */
const AXIS_META: Record<
  SponsorAxisKey,
  { rowKey: keyof Pick<TeamManagementSnapshotRow, "ppsPow" | "ppsSpe" | "ppsMen" | "ppsSoc"> }
> = {
  pow: { rowKey: "ppsPow" },
  spe: { rowKey: "ppsSpe" },
  men: { rowKey: "ppsMen" },
  soc: { rowKey: "ppsSoc" },
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/**
 * WELCHER SLOT TRAEGT DEN CHALLENGE-SPONSOR — bleibt, obwohl der Challenge-Slot seit dem V4-Umbau
 * IMMER eine Achsenkarte ist und ihre einstige Sonderziel-Komponente (axis_rank_top / salary /
 * transfer) deshalb sofort durch die Achse ueberschrieben wird (siehe Datei-Kommentar oben). Der Slot
 * selbst bleibt aber sichtbar: `sponsor-brand-catalog.ts` haengt bei `specialMode: "challenge"` den
 * Praefix "Challenge-Sponsor · " vor den Marken-Flavourtext, und `offer.isChallengeOffer` haengt
 * direkt an diesem Index. Beides sind Textfelder auf dem generierten Angebot — faellt der Index weg,
 * aendert sich die Angebots-AUSGABE, und genau das soll dieser Patch nicht.
 */
export function resolveChallengeSlotIndex(seasonId: string, teamId: string, slotCount = 5) {
  return Math.floor(getStableUnitHash(`${seasonId}:${teamId}:sponsor-challenge-slot`) * slotCount);
}

const HISTORICAL_AXIS_ROW_KEY: Record<
  SponsorAxisKey,
  keyof Pick<TeamManagementSnapshotRow, "historicalPow" | "historicalSpe" | "historicalMen" | "historicalSoc">
> = {
  pow: "historicalPow",
  spe: "historicalSpe",
  men: "historicalMen",
  soc: "historicalSoc",
};

function getAxisValueForRank(row: TeamManagementSnapshotRow, axis: SponsorAxisKey, gameState?: GameState) {
  const live = Number(row[AXIS_META[axis].rowKey] ?? 0);
  if (live > 0) {
    return live;
  }
  const historical = Number(row[HISTORICAL_AXIS_ROW_KEY[axis]] ?? 0);
  if (historical > 0) {
    return historical;
  }
  if (row.rosterPlayers.length > 0) {
    const sum = row.rosterPlayers.reduce(
      (total, item) => total + Number(item.player.coreStats?.[axis] ?? 0),
      0,
    );
    if (sum > 0) {
      return round1(sum);
    }
  }
  if (gameState) {
    const disciplineTotals = row.disciplineValues ?? {};
    const categoryTotals = { pow: 0, spe: 0, men: 0, soc: 0 };
    for (const discipline of gameState.disciplines) {
      const value = disciplineTotals[normalizeDisciplineKey(discipline.id)];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        continue;
      }
      if (discipline.category === "power") categoryTotals.pow += value;
      if (discipline.category === "speed") categoryTotals.spe += value;
      if (discipline.category === "mental") categoryTotals.men += value;
      if (discipline.category === "social") categoryTotals.soc += value;
    }
    if (categoryTotals[axis] > 0) {
      return round1(categoryTotals[axis]);
    }
  }
  return 0;
}

function normalizeDisciplineKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

export function getTeamAxisRank(
  rows: TeamManagementSnapshotRow[],
  teamId: string,
  axis: SponsorAxisKey,
  gameState?: GameState,
) {
  const ordered = [...rows]
    .map((row) => ({ teamId: row.teamId, value: getAxisValueForRank(row, axis, gameState) }))
    .sort((left, right) => right.value - left.value);
  if (!ordered.some((entry) => entry.value > 0)) {
    return { rank: null as number | null, teamCount: ordered.length, value: null as number | null };
  }
  const index = ordered.findIndex((entry) => entry.teamId === teamId);
  if (index < 0) {
    return { rank: null as number | null, teamCount: ordered.length, value: null as number | null };
  }
  return { rank: index + 1, teamCount: ordered.length, value: ordered[index]?.value ?? null };
}

export function parseAxisTargetValue(targetValue: SponsorOfferComponent["targetValue"]): {
  axis: SponsorAxisKey;
  topRank: number;
} | null {
  const raw = typeof targetValue === "string" ? targetValue : String(targetValue ?? "");
  const match = /^(pow|spe|men|soc):(\d+)$/.exec(raw);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return {
    axis: match[1] as SponsorAxisKey,
    topRank: Number.parseInt(match[2], 10),
  };
}

/**
 * Fan-Infrastruktur-Klausel (Sponsor-Enhancement 2). War Teil des Bonusziel-Katalogs
 * (`fan_infrastructure`), wird seit dem V4-Umbau nicht mehr angeboten — bleibt hier aber stehen: der
 * Save traegt unterschriebene `fan_infrastructure`-Vertraege, und deren Auszahlung skaliert im
 * Evaluator (`sponsor-objective-evaluator.ts`) weiterhin stufenlos mit der tatsaechlichen
 * Gesamtstufe der beiden Income-Gebaeude (fan_shop-Level + arena_upgrade-Level, gedeckelt).
 */
export const FAN_INFRASTRUCTURE_LEVEL_CAP = 6;

/** Gesamtstufe der beiden Einkommens-Gebaeude eines Teams (fan_shop-Level + arena_upgrade-Level). */
export function fanInfrastructureLevelSum(gameState: GameState, teamId: string): number {
  const facilities = getTeamFacilityState(gameState, teamId);
  return getFacilityLevel(facilities, "fan_shop") + getFacilityLevel(facilities, "arena_upgrade");
}

function objEnvNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Die folgenden ENV-Konstanten gehoerten zum entfernten Bonus-/Golden-Katalog, bleiben aber stehen:
 * `sponsor-objective-evaluator.ts` liest sie weiterhin beim Auswerten bereits unterschriebener
 * Alt-Vertraege (u. a. Golden-Ziele, die als Vertrag existieren koennen, auch wenn seit dem V4-Umbau
 * keiner mehr neu gezogen wird).
 */
export const SPONSOR_OBJ_DISCIPLINE_GOOD_RANK = objEnvNumber("OLY_SPONSOR_OBJ_DISCIPLINE_GOOD_RANK", 5);
/** Golden Disziplin-Monopol (G4): Top-K der Disziplin (K = 5, NICHT 3). */
export const SPONSOR_OBJ_GOLDEN_DISCIPLINE_RANK = objEnvNumber("OLY_SPONSOR_OBJ_GOLDEN_DISCIPLINE_RANK", 5);
/** Bracket-Held-Schwelle (bracketScore, 0..1) fuer Fan-Kult / Publikumsliebling. */
export const SPONSOR_OBJ_BRACKET_HERO = objEnvNumber("OLY_SPONSOR_OBJ_BRACKET_HERO", 0.85);
/** Talentschmiede (G3): Marktwert-Zuwachs eines Spielers in EINER Saison, ab dem ein "großer Sprung" zählt. */
/**
 * Attribut-Punkte, ab denen ein Spieler fuer `golden_talent_forge` als entwickelt zaehlt.
 *
 * Hiess bis zum 19.08.2026 `SPONSOR_OBJ_TALENT_JUMP_MV` und meinte Marktwert — die Rechnung dahinter
 * mass jedoch den absoluten Marktwert, nicht den Zuwachs (Meldung `u3wlh4`, Befund im Kopf von
 * `lib/progression/spieler-entwicklung-zaehler.ts`). Umbenannt statt nur umgewidmet, damit kein
 * Aufrufer die alte Bedeutung weiterschleppt.
 *
 * 3 statt der 2 der Achse: dieses Sonderziel ist als „hart" ausgewiesen. Gemessen (1017 Spieler)
 * trifft 3 im Median 2 Spieler je Team, Maximum 9 — deutlich selektiver als die Achse.
 */
export const SPONSOR_OBJ_TALENT_JUMP_ATTRIBUTE_POINTS = objEnvNumber("OLY_SPONSOR_OBJ_TALENT_JUMP_ATTRIBUTE_POINTS", 3);
/** Titel-Schock (G5): teamQualityRankAtSign ≥ dieser Wert = "schwaches" Team (Eignung). */
export const SPONSOR_OBJ_TITLE_SHOCK_WEAK_RANK = objEnvNumber("OLY_SPONSOR_OBJ_TITLE_SHOCK_WEAK_RANK", 18);
/** Fatigue-Management (#14): Kader-Fatigue ≤ diese Schwelle zählt als "frisch". */
export const SPONSOR_OBJ_FATIGUE_CAP = objEnvNumber("OLY_SPONSOR_OBJ_FATIGUE_CAP", 45);

/**
 * Transfer-Händler (#12) — Fenster-Query. TAG-ZUORDNUNG (im Code verifiziert): jede transferHistory-Zeile
 * trägt `seasonId = gameState.season.id` zum Ausführungszeitpunkt und `phase = "manual_transfer_window"`
 * (LOCAL_TRANSFER_WINDOW_PHASE) — die SESSION-Phase "season_end"/"preseason" wird NICHT auf die Zeile
 * geschrieben. Im kanonischen Ablauf (season-simulation-runner PHASES) laufen innerhalb EINER Saison-
 * Iteration von S zuerst `sell_contract_exits` (Verkäufe) und `buy_draft` (Käufe) — beide VOR jedem
 * Matchday, beide getaggt mit `seasonId = S`. Die Übergangs-Wechselperiode in Saison S ist damit vollständig
 * über `seasonId === S` erfasst und zum Abrechnungszeitpunkt (Saison-Ende, nach allen Matchdays) fertig
 * gebucht. Netto = Σ Verkaufserlöse − Σ Kaufkosten (jeweils netCashImpact ?? fee) für diese Saison.
 *
 * Bleibt fuer den Evaluator stehen (transfer_trader-Alt-Vertraege), obwohl der Katalog, der dieses Ziel
 * einst anbot, entfernt ist.
 */
export function computeTransferWindowNet(gameState: GameState, teamId: string, seasonId: string): number {
  let sells = 0;
  let buys = 0;
  for (const entry of gameState.transferHistory ?? []) {
    if (entry.seasonId !== seasonId) continue;
    const value = typeof entry.netCashImpact === "number" && Number.isFinite(entry.netCashImpact)
      ? entry.netCashImpact
      : typeof entry.fee === "number" && Number.isFinite(entry.fee)
        ? entry.fee
        : 0;
    if (entry.transferType === "sell" && entry.fromTeamId === teamId) {
      sells += value;
    } else if (entry.transferType === "buy" && entry.toTeamId === teamId) {
      buys += value;
    }
  }
  return round1(sells - buys);
}
