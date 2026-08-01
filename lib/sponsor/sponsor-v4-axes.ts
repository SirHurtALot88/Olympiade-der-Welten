/**
 * SPONSOR-ACHSEN (V4) — WOFUER EIN SPONSOR BEZAHLT, AUSSER FUER DEN TABELLENPLATZ.
 *
 * Warum es sie gibt: bis V3 unterschieden sich die fuenf Karten eines Slates ausschliesslich im
 * RISIKOPROFIL um dieselbe Rangleiter. Alle hatten denselben Erwartungswert, und der Ausschlag lag
 * bei +-1 bis 3 C gegen eine Faktorschwankung von +-30 C. Damit war die Wahl praktisch belanglos:
 * es gab keine falsche Entscheidung, also auch keine Entscheidung.
 *
 * Eine Achse ist ein zweiter Kanal, ueber den ein Sponsor zahlt — Kaderwert, Ausbau, Finanzen,
 * Talententwicklung, Frische. Die Wahl ist damit keine Wette mehr, sondern eine PASSUNGSFRAGE: das
 * Team weiss, worin es diese Saison gut sein will, das Spiel weiss es nicht.
 *
 * ZWEI EIGENSCHAFTEN TRAGEN DIE BALANCE:
 *
 * 1. Gemessen wird gegen die EIGENE, bei Angebotserzeugung eingefrorene Ausgangslage — nie gegen die
 *    Liga. Deshalb ist eine Achse fuer den Tabellenletzten genauso ausreizbar wie fuer den Meister,
 *    und der Betrag ist derselbe. Das ist der Mechanismus, der jedem Team Chancen gibt; ein
 *    rangbezogenes Ziel waere nur eine zweite Preisgeldtabelle.
 * 2. Bepreist wird fix mit `p = 0,5` statt mit einer geschaetzten Erfolgswahrscheinlichkeit. Das war
 *    in V3 der groesste ungemessene Parameter (36 Schaetzwerte in GOAL_PROBABILITY): dort war der
 *    Schaetzwert DER PREIS, ein Fehler also eine dauerhafte Etatverzerrung. Hier ist der Preis fest
 *    und die Schaetzung steckt nur noch in der Skala — ein Skalenfehler verschiebt, wie leicht die
 *    Achse faellt, nicht wie viel sie im Erwartungswert wert ist.
 *
 * Diese Datei ist reine Messung: sie liest Zustand und liefert Zahlen. Bepreisung und Auszahlung
 * bleiben im V3-Modell (`sponsorV3Settle`), damit es weiterhin genau EINE Rechenstelle gibt.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import {
  SPONSOR_V4_AXIS_KEYS, type SponsorV4AxisKey, type SponsorV4AxisTerms,
} from "@/lib/sponsor/sponsor-v3-model";

export { SPONSOR_V4_AXIS_KEYS };
export type { SponsorV4AxisKey, SponsorV4AxisTerms };

/** Der `specialKey`, unter dem eine Achse als Komponente im Vertrag steht. */
export const sponsorV4AxisSpecialKey = (key: SponsorV4AxisKey): string => `axis_v4_${key}`;

/** Liest die Achse aus einem specialKey zurueck — null, wenn es keine Achsen-Komponente ist. */
export function sponsorV4AxisKeyFromSpecialKey(specialKey: string | null | undefined): SponsorV4AxisKey | null {
  const match = /^axis_v4_(.+)$/.exec(specialKey ?? "");
  const key = match?.[1];
  return key && (SPONSOR_V4_AXIS_KEYS as readonly string[]).includes(key) ? (key as SponsorV4AxisKey) : null;
}

type SponsorV4AxisDefinition = {
  key: SponsorV4AxisKey;
  label: string;
  /** Einheit der Messgroesse — fuer Karten- und Settlement-Text. */
  unit: string;
  scale: number;
  offset: number;
  /** Ausgangswert bei Angebotserzeugung. 0, wenn die Achse ohnehin nur Saisonzuwachs zaehlt. */
  baseline: (gameState: GameState, teamId: string) => number;
  /** Rohe Messgroesse am Messzeitpunkt, gegen die eingefrorene Ausgangslage gerechnet. */
  metric: (gameState: GameState, teamId: string, baseline: number) => number;
  /**
   * Wird die Achse diesem Team ueberhaupt angeboten? GEFILTERT STATT GEKLAMMERT — eine Achse, die
   * ein Team gar nicht bewegen kann, darf nicht als wertlose Karte im Slate liegen.
   */
  offerable: (gameState: GameState, teamId: string) => boolean;
};

function teamMarketValue(gameState: GameState, teamId: string): number {
  const row = buildTeamSeasonOverviewRows({ gameState }).find((entry) => entry.teamId === teamId);
  return row?.marketValueTotal ?? 0;
}

/** Summe aller Gebaeudestufen eines Teams — ueber den ganzen Katalog, nicht nur die Einkommensbauten. */
function facilityLevelSum(gameState: GameState, teamId: string): number {
  const facilities = getTeamFacilityState(gameState, teamId);
  return FACILITY_CATALOG.reduce((sum, entry) => sum + getFacilityLevel(facilities, entry.facilityId), 0);
}

function facilityLevelHeadroom(gameState: GameState, teamId: string): number {
  const facilities = getTeamFacilityState(gameState, teamId);
  return FACILITY_CATALOG.reduce(
    (sum, entry) => sum + Math.max(0, entry.maxLevel - getFacilityLevel(facilities, entry.facilityId)),
    0,
  );
}

/**
 * Nettofinanzposition: Kasse minus alles, was noch zurueckzuzahlen ist.
 *
 * DER SPONSOR-VORSCHUSS GEHOERT ZWINGEND DAZU. Er erhoeht bei Unterschrift die Kasse, wird aber am
 * Saisonende samt Gebuehr wieder verrechnet — er ist eine Verbindlichkeit wie ein Kredit. Zaehlte
 * man ihn nicht mit, waere die Kombination "Solidität + Vorschuss" ein Selbstlaeufer: das blosse
 * Unterschreiben haette die Nettoposition gegen die vorher eingefrorene Ausgangslage gehoben und die
 * Achse zu einem guten Teil ohne jede Leistung bezahlt. Gemessen waren das 5,2 C fuer 0,7 C Gebuehr.
 */
function netFinancialPosition(gameState: GameState, teamId: string): number {
  const cash = gameState.teams.find((team) => team.teamId === teamId)?.cash ?? 0;
  const debt = (gameState.seasonState.loans ?? [])
    .filter((loan) => loan.borrowerTeamId === teamId && loan.status === "active")
    .reduce((sum, loan) => sum + (loan.principalOutstanding ?? 0), 0);
  const advance = gameState.seasonState.sponsorContractsByTeamId?.[teamId]?.sponsorV3?.advance ?? null;
  const advanceDebt = advance ? advance.amount + advance.fee : 0;
  return cash - debt - advanceDebt;
}

/** Marktwert-Sprung, ab dem ein Spieler als entwickelt zaehlt — dieselbe Schwelle wie golden_talent_forge. */
const AXIS_TALENT_JUMP_MV = 6;
/** Match-Fatigue, bis zu der ein Spieler als frisch zaehlt — dieselbe Grenze wie fatigue_management. */
const AXIS_FRESH_FATIGUE_CAP = 45;

function talentJumpCount(gameState: GameState, teamId: string): number {
  const rosterIds = new Set(
    gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId),
  );
  const jumped = new Set<string>();
  for (const event of gameState.playerProgressionEvents ?? []) {
    if (event.seasonId !== gameState.season.id) continue;
    if (event.teamId !== teamId && !rosterIds.has(event.playerId)) continue;
    const before = event.progressionSnapshotBefore;
    const after = event.progressionSnapshotAfter;
    const mvBefore = typeof before?.marketValue === "number" ? before.marketValue : null;
    const mvAfter =
      typeof after?.marketValuePreview === "number"
        ? after.marketValuePreview
        : typeof after?.marketValue === "number"
          ? after.marketValue
          : null;
    if (mvBefore != null && mvAfter != null && mvAfter - mvBefore >= AXIS_TALENT_JUMP_MV) {
      jumped.add(event.playerId);
    }
  }
  return jumped.size;
}

function freshSharePct(gameState: GameState, teamId: string): number {
  const rosterIds = new Set(
    gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId),
  );
  if (rosterIds.size === 0) return 0;
  // Dieselbe Fatigue-Quelle, gegen die auch die Mechanik rechnet: die reine Match-Fatigue aus
  // playerAvailabilityState. `player.fatigue` traegt zusaetzlich die Trainingsschicht und wuerde
  // eine andere Groesse messen als die, die das Team tatsaechlich steuert.
  const availabilityFatigueByPlayerId = new Map<string, number>();
  for (const entry of gameState.seasonState.playerAvailabilityState ?? []) {
    if (entry.teamId === teamId) availabilityFatigueByPlayerId.set(entry.playerId, entry.fatigue);
  }
  const fresh = gameState.players.filter((player) => {
    if (!rosterIds.has(player.id)) return false;
    const availabilityFatigue = availabilityFatigueByPlayerId.get(player.id);
    const matchFatigue =
      typeof availabilityFatigue === "number"
        ? availabilityFatigue
        : typeof player.fatigue === "number"
          ? player.fatigue
          : 0;
    return matchFatigue <= AXIS_FRESH_FATIGUE_CAP;
  }).length;
  return (100 * fresh) / rosterIds.size;
}

/**
 * DIE FUENF ACHSEN.
 *
 * Die Skalen sind DESIGNWERTE: sie sind so gesetzt, dass ein normal gespieltes Team etwa in der
 * Mitte landet, aber die echten Liga-Verteilungen sind noch nicht gemessen. Ein Skalenfehler
 * verschiebt nur, wie leicht eine Achse faellt — der Erwartungswert haengt an `p = 0,5` und bleibt
 * davon unberuehrt. Nachziehen ueber `scripts/sponsor-v4-achsen-kalibrierung.ts`, Zielkorridor:
 * Median-Erfuellung 0,45 bis 0,55.
 */
const SPONSOR_V4_AXIS_DEFINITIONS: Readonly<Record<SponsorV4AxisKey, SponsorV4AxisDefinition>> = {
  wachstum: {
    key: "wachstum",
    label: "Kaderwert",
    unit: "%",
    // 12 Prozent Kaderwert-Zuwachs. Prozentual gemessen, damit ein kleiner Kader dieselbe Chance hat
    // wie ein grosser — absolut waere die Achse ein verkappter Reichtums-Bonus.
    scale: 12,
    offset: 0,
    baseline: (gameState, teamId) => teamMarketValue(gameState, teamId),
    metric: (gameState, teamId, baseline) =>
      baseline > 0 ? (100 * (teamMarketValue(gameState, teamId) - baseline)) / baseline : 0,
    offerable: (gameState, teamId) => teamMarketValue(gameState, teamId) > 0,
  },
  ausbau: {
    key: "ausbau",
    label: "Ausbau",
    unit: "Stufen",
    scale: 2,
    offset: 0,
    baseline: (gameState, teamId) => facilityLevelSum(gameState, teamId),
    metric: (gameState, teamId, baseline) => facilityLevelSum(gameState, teamId) - baseline,
    // Ohne Ausbauspielraum waere die Achse unerfuellbar — dann wird sie gar nicht erst angeboten.
    offerable: (gameState, teamId) => facilityLevelHeadroom(gameState, teamId) >= 2,
  },
  soliditaet: {
    key: "soliditaet",
    label: "Solidität",
    unit: "C",
    // Nullpunkt bei -10: ein Team darf ein moderates Minus fahren und liegt trotzdem nicht bei 0.
    scale: 40,
    offset: 10,
    baseline: (gameState, teamId) => netFinancialPosition(gameState, teamId),
    metric: (gameState, teamId, baseline) => netFinancialPosition(gameState, teamId) - baseline,
    offerable: () => true,
  },
  entwicklung: {
    key: "entwicklung",
    label: "Entwicklung",
    unit: "Sprünge",
    scale: 3,
    offset: 0,
    // Zaehlt nur den Saisonzuwachs — es gibt keinen Ausgangsbestand, gegen den zu messen waere.
    baseline: () => 0,
    metric: (gameState, teamId) => talentJumpCount(gameState, teamId),
    offerable: () => true,
  },
  kaderpflege: {
    key: "kaderpflege",
    label: "Frische",
    unit: "%",
    // 40 % frischer Kader ist der Nullpunkt, 90 % die volle Erfuellung.
    scale: 50,
    offset: -40,
    baseline: () => 0,
    metric: (gameState, teamId) => freshSharePct(gameState, teamId),
    offerable: (gameState, teamId) => gameState.rosters.some((entry) => entry.teamId === teamId),
  },
};

export function sponsorV4AxisDefinition(key: SponsorV4AxisKey): SponsorV4AxisDefinition {
  return SPONSOR_V4_AXIS_DEFINITIONS[key];
}

export function sponsorV4AxisLabel(key: SponsorV4AxisKey): string {
  return SPONSOR_V4_AXIS_DEFINITIONS[key].label;
}

/** Achsen, die diesem Team ueberhaupt angeboten werden duerfen. */
export function sponsorV4OfferableAxes(gameState: GameState, teamId: string): SponsorV4AxisKey[] {
  return SPONSOR_V4_AXIS_KEYS.filter((key) => SPONSOR_V4_AXIS_DEFINITIONS[key].offerable(gameState, teamId));
}

/** Die bei Angebotserzeugung einzufrierenden Konditionen einer Achse. */
export function buildSponsorV4AxisTerms(
  gameState: GameState, teamId: string, key: SponsorV4AxisKey,
): SponsorV4AxisTerms {
  const definition = SPONSOR_V4_AXIS_DEFINITIONS[key];
  return {
    key,
    baseline: Math.round(definition.baseline(gameState, teamId) * 100) / 100,
    scale: definition.scale,
    offset: definition.offset,
  };
}

export type SponsorV4AxisProgress = {
  key: SponsorV4AxisKey;
  label: string;
  /** Erfuellungsgrad 0..1 — genau der Wert, mit dem das Settlement rechnet. */
  fraction: number;
  /** Rohe Messgroesse, fuer die Anzeige. */
  metric: number;
  /** Messgroesse, die volle Erfuellung bedeutet. */
  target: number;
  unit: string;
};

/**
 * DER ERFUELLUNGSGRAD EINER ACHSE. Die eine Stelle, an der aus Spielzustand eine Zahl 0..1 wird —
 * Karte, Anzeige und Settlement lesen alle hier, damit sie nicht auseinanderlaufen koennen.
 */
export function evaluateSponsorV4Axis(
  gameState: GameState, teamId: string, terms: SponsorV4AxisTerms,
): SponsorV4AxisProgress {
  const definition = SPONSOR_V4_AXIS_DEFINITIONS[terms.key];
  const scale = Number.isFinite(terms.scale) && terms.scale > 0 ? terms.scale : definition.scale;
  const offset = Number.isFinite(terms.offset) ? terms.offset : definition.offset;
  const metric = definition.metric(gameState, teamId, terms.baseline);
  const raw = (metric + offset) / scale;
  return {
    key: terms.key,
    label: definition.label,
    fraction: Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0)),
    metric: Math.round(metric * 100) / 100,
    target: Math.round((scale - offset) * 100) / 100,
    unit: definition.unit,
  };
}
