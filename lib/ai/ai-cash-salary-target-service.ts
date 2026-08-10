import type { GameState } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { parseSeasonNumber } from "@/lib/season/transfer-standings-balance";
import { resolveSeasonApronLines, type ApronLines } from "@/lib/season/apron-service";
import { getTeamApronSalaryBase } from "@/lib/ai/ai-apron-cost-service";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getTeamSalarySum(gameState: GameState, teamId: string) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return round(
    gameState.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => {
        const player = playerById.get(entry.playerId);
        if (!player) return sum + (entry.salary ?? 0);
        const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        return sum + (economy.salary ?? entry.salary ?? 0);
      }, 0),
  );
}

export function getTeamCashSalaryRatio(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const cash = team?.cash ?? 0;
  const salary = getTeamSalarySum(gameState, teamId);
  if (salary <= 0) return 0;
  return round(cash / salary, 3);
}

function getSeasonHardCapBuffer(seasonId: string) {
  const seasonNumber = parseSeasonNumber(seasonId);
  if (seasonNumber <= 3) return 0;
  if (seasonNumber === 4) return 0.05;
  return 0.1;
}

/** S2–S3: hoard/deploy threshold uses soft target; hard cap still 1.0× salary. */
function usesPlannerSalaryBufferCap(seasonId: string) {
  const seasonNumber = parseSeasonNumber(seasonId);
  return seasonNumber >= 2 && seasonNumber <= 3;
}

/** Ziel-Cash/Gehalt nach Finance: 0.25 (sparsam) bis 0.75 (finance-stark). */
export function getTeamCashSalarySoftTarget(gameState: GameState, teamId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const finances = identity?.finances ?? 5;
  return round(clamp(0.25 + (finances / 10) * 0.5, 0.25, 0.75), 3);
}

/** Hartes Cap: S2–S3 max 1.0× salary; sonst 0.75 (Finance-Ausreißer ≥8 max 1.0 + Season-Puffer ab S4). */
export function getTeamCashSalaryHardCap(gameState: GameState, teamId: string, seasonId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const finances = identity?.finances ?? 5;
  if (usesPlannerSalaryBufferCap(seasonId)) {
    return 1.0;
  }
  const base = finances >= 8 ? 1.0 : 0.75;
  return round(base + getSeasonHardCapBuffer(seasonId), 3);
}

export function isTeamOverCashSalarySoftTarget(gameState: GameState, teamId: string, seasonId: string) {
  const ratio = getTeamCashSalaryRatio(gameState, teamId);
  if (ratio <= 0) return false;
  return ratio > getTeamCashSalarySoftTarget(gameState, teamId) + 0.01;
}

export function isTeamOverCashSalaryHardCap(gameState: GameState, teamId: string, seasonId: string) {
  const ratio = getTeamCashSalaryRatio(gameState, teamId);
  if (ratio <= 0) return false;
  return ratio > getTeamCashSalaryHardCap(gameState, teamId, seasonId) + 0.01;
}

/** Median-Hard-Cap für Audit-Labels (deprecated global cap). */
export function getSeasonHoardCashSalaryCapLabel(seasonId: string) {
  const seasonNumber = parseSeasonNumber(seasonId);
  if (seasonNumber <= 3) return 0.75;
  if (seasonNumber === 4) return 0.8;
  return 0.85;
}

export function resolveHoardTighteningMultiplier(
  gameState: GameState,
  teamId: string,
  seasonId: string,
  cashSalaryRatio: number,
) {
  const softTarget = getTeamCashSalarySoftTarget(gameState, teamId);
  const hardCap = getTeamCashSalaryHardCap(gameState, teamId, seasonId);
  if (cashSalaryRatio > hardCap) return 0.5;
  if (cashSalaryRatio > softTarget + 0.15) return 0.7;
  if (cashSalaryRatio > softTarget) return 0.85;
  return 1;
}

// ── APRON ──────────────────────────────────────────────────────────────────────────────────────
//
// Ohne diese Anbindung ist der Apron kaputt, und zwar in beide Richtungen: entweder laeuft die KI
// blind ueber die Linien (Apron wird zur Steuer, die 31 KI-Teams zahlen, das eine menschliche Team
// kassiert), oder sie kommt nie in ihre Naehe (der Topf bleibt leer, weil niemand je ueber Linie 1
// geht). Beides macht das Gummiband bedeutungslos.

/**
 * KI-AMBITION FUER DEN APRON — dieselbe Quelle, die die Sponsor-Kurvenform-Wahl schon nutzt
 * (`profile.bias.starPriority`, sonst `identity.ambition`, Default 5 — siehe sponsor-offer-service.ts
 * `resolveAiSponsorArchetypePreference`). EIN Titelanwaerter, der Abgabe zahlt, um den Kader zu
 * halten, entscheidet richtig — die Bereitschaft, die Apron-Linien zu ueberschreiten, haengt deshalb
 * an derselben Ambition wie die Sponsorwahl, nicht an einer eigenen neuen Zahl.
 */
export function resolveTeamApronAmbition(gameState: GameState, teamId: string): number {
  const profile = getTeamStrategyProfile(gameState, teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  return profile?.bias.starPriority ?? identity?.ambition ?? 5;
}

/**
 * Effektive Gehalts-Obergrenze, bis zu der die KI (ambitionsabhaengig) bereit ist, die Apron-Linien
 * zu reissen — ZUSAETZLICH zum Soft-Target/Hard-Cap oben, die die Cash-Reserve steuern, waehrend
 * diese Grenze die GEHALTSSUMME selbst betrifft:
 *   - Ambition >= 8 (Titelanwaerter): bis zur 2. Linie — die hoehere Abgabe ist eingepreist.
 *   - Ambition >= 6 (solide): 40 % in die Zone zwischen 1. und 2. Linie hinein.
 *   - sonst (vorsichtig): an der 1. Linie — meidet die Abgabe komplett.
 * Nutzt die EINGEFRORENEN Linien der laufenden Saison, falls vorhanden; sonst eine frische
 * Berechnung (haelt die Funktion auch isoliert testbar, ohne den Einfrier-Schritt zu durchlaufen).
 */
export function resolveTeamApronSalaryCeiling(gameState: GameState, teamId: string): number {
  // Dieselbe eine Quelle wie Anzeige und Abrechnung (`resolveSeasonApronLines`): während des
  // Kaderbaus die mitwandernde Linie, ab dem ersten abgerechneten Spieltag die eingefrorene.
  // Wichtig gerade hier — die KI kauft in genau dieser Aufbauphase, und vorher rechnete sie gegen
  // eine Grenze, die ihre eigenen Käufe längst überholt hatten.
  const lines: ApronLines = resolveSeasonApronLines(gameState);
  const ambition = resolveTeamApronAmbition(gameState, teamId);
  if (ambition >= 8) return lines.line2;
  if (ambition >= 6) return lines.line1 + (lines.line2 - lines.line1) * 0.4;
  return lines.line1;
}

/**
 * Gemessen wird auf der GEGLÄTTETEN Summe (`getTeamApronSalaryBase`), nicht auf `getTeamSalarySum`.
 *
 * DAS WAR EIN FEHLER, und zwar ein leiser: `getTeamSalarySum` liefert die ECHTE, front-/back-loadete
 * Vertragssumme — die Zahl, die am Saisonende vom Konto geht. Der Apron bemisst aber die geglättete
 * (siehe Kopfkommentar `apron-service.ts`). Die KI prüfte ihre Zurückhaltung also gegen eine andere
 * Zahl, als die Abrechnung besteuert. Auf Chris' Spielstand (Saison 2, Spieltag 4) liefen die beiden
 * Zahlen bei 4 von 32 Teams auseinander, im Extremfall um 18,0:
 *   - Cold Steel: echt 63,6 (weit unter der Decke 81,0) → die KI sah freie Bahn, während die
 *     geglättete Summe mit 81,6 über der 1. Linie stand und real 0,7 Abgabe kostete.
 *   - Silver Soldiers und Last Ride ebenso; Project Suicide andersherum (echt 86,1 über der Decke,
 *     geglättet 79,7 darunter) — die KI bremste dort ohne Grund.
 * Die Cash-Ziele oben behalten `getTeamSalarySum` bewusst: sie planen den Cashflow, und abgebucht
 * wird die echte Summe. Nur die APRON-Fragen wechseln die Grundlage.
 */
export function isTeamOverApronSalaryCeiling(gameState: GameState, teamId: string): boolean {
  return getTeamApronSalaryBase(gameState, teamId) > resolveTeamApronSalaryCeiling(gameState, teamId);
}

/**
 * Bremst zusaetzliche Kaufbereitschaft, sobald ein Team seine (ambitionsabhaengige) Apron-Decke
 * ueberschreitet — NIE auf 0: ein Team darf die Linie reissen, wenn der Kader es zwingend braucht
 * (Verletzungsersatz etc., siehe planner-cash-buffer-policy.ts). Je weiter drueber, desto
 * zurueckhaltender, mit einem Boden bei 0,5 (dieselbe Untergrenze wie `resolveHoardTighteningMultiplier`
 * beim harten Cash-Cap).
 */
export function resolveApronTighteningMultiplier(gameState: GameState, teamId: string): number {
  const ceiling = resolveTeamApronSalaryCeiling(gameState, teamId);
  if (ceiling <= 0) return 1;
  // Dieselbe Grundlage wie `isTeamOverApronSalaryCeiling` — siehe die Begründung dort.
  const salary = getTeamApronSalaryBase(gameState, teamId);
  if (salary <= ceiling) return 1;
  const overshoot = (salary - ceiling) / ceiling;
  return clamp(1 - overshoot, 0.5, 1);
}
