import type { GameState, Player, TeamCaptainRecord } from "@/lib/data/olyDataTypes";
import { BOARD_V2_CAPTAIN } from "@/lib/board/board-objectives-config";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import {
  CAPTAIN_TEAM_POWER_EFFECT_FACTOR,
  CAPTAIN_TEAM_POWER_MAX_PCT,
  areTeamPowersEnabled,
} from "@/lib/lineups/team-powers";
import { buildTeamPlayerDemandMap } from "@/lib/morale/player-demands-service";

const CAPTAIN_POSITIVE_TRAITS = new Set(["eloquent", "motivated", "ambitious", "disciplined", "resourceful", "loyal"]);

function normalizeTrait(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getTraits(player: Pick<Player, "traitsPositive" | "traitsNegative">) {
  return [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])].map(normalizeTrait).filter(Boolean);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

export function getTeamCaptainEffectsTooltip() {
  return "Der Saison-Kapitän puffert Moral, dämpft Rivalitäts-Druck im Spieltag, nimmt Druck vom Vorstand und verstärkt eine gespielte Team-Power leicht.";
}

/**
 * Ein Kapitäns-Effekt mit vollstaendiger Herleitung fuer die UI.
 *
 * Hintergrund: die Chips zeigten nur Rohwerte ("Power +8%"), was zwei Dinge
 * verschwieg — der Team-Power-Wert wird real geviertelt und wirkt nur mit einer
 * gespielten Team-Power, und die Vorstands-Daempfung tauchte gar nicht auf,
 * obwohl sie der wohl wichtigste Effekt ist. `formula` macht jeden Wert aus dem
 * Fuehrungswert nachrechenbar, `caveat` nennt die Bedingung.
 */
export type CaptainEffectExplanation = {
  key: "morale" | "rivalry" | "boardPressure" | "teamPower";
  label: string;
  /** Bereits formatierter Anzeigewert inkl. Vorzeichen/Einheit. */
  displayValue: string;
  /** Herleitung aus dem Führungswert, z. B. "Führung 75,6 ÷ 18 · max 6". */
  formula: string;
  /** Worauf der Effekt konkret wirkt. */
  appliesTo: string;
  /** Einschraenkung, ohne die der Wert irrefuehrend waere. */
  caveat: string | null;
  /** Fertige Zeile fuer ein `title`-Attribut. */
  tooltip: string;
};

function formatDe(value: number, digits = 1) {
  return value.toFixed(digits).replace(".", ",");
}

/**
 * Zerlegt die Kapitäns-Effekte in nachvollziehbare Einzelposten.
 *
 * Bewusst NICHT enthalten ist `conflictSoftenChancePct`: das Feld wird zwar
 * berechnet und gespeichert, aber von keiner Spiellogik gelesen (nur Typen,
 * Test-Fixtures und ein Audit-Skript referenzieren es). Es als Effekt
 * anzuzeigen wuerde eine Wirkung versprechen, die es nicht gibt.
 */
export function buildCaptainEffectExplanations(record: {
  leadershipScore: number;
  effects: Pick<
    TeamCaptainRecord["effects"],
    "moraleBuffer" | "rivalryPressureReductionPct" | "teamPowerModifierPct"
  >;
}): CaptainEffectExplanation[] {
  const score = record.leadershipScore;
  const effects = record.effects;
  // Wirksamer Team-Power-Aufschlag — dieselbe Konstante wie in der Auflösung.
  const effectiveTeamPowerPct =
    Math.max(0, Math.min(CAPTAIN_TEAM_POWER_MAX_PCT, effects.teamPowerModifierPct)) * CAPTAIN_TEAM_POWER_EFFECT_FACTOR;
  // Vorstands-Daempfung: nicht Teil von `effects`, sondern direkt aus dem
  // Fuehrungswert (team-season-objectives-service, Board-V2).
  const boardDamp = Math.max(0, Math.min(BOARD_V2_CAPTAIN.maxDamp, score / BOARD_V2_CAPTAIN.leadershipDivisor));

  const rows: CaptainEffectExplanation[] = [
    {
      key: "morale",
      label: "Moral-Puffer",
      displayValue: `+${formatDe(effects.moraleBuffer)}`,
      formula: `Führung ${formatDe(score)} ÷ 18 · zwischen 1 und 6`,
      appliesTo: "Deckelt, wie viel Moral ein Spieler pro Ereignis verlieren kann.",
      caveat: null,
      tooltip: "",
    },
    {
      key: "rivalry",
      label: "Rivalitäts-Druck",
      displayValue: `−${formatDe(effects.rivalryPressureReductionPct)} %`,
      formula: `Führung ${formatDe(score)} ÷ 3,5 · zwischen 4 und 24`,
      appliesTo: "Dämpft den Druck durch Top-Rivalen in der Disziplin beim Spieltag.",
      caveat: "Das ist der Duell-Druck in der Arena — nicht der Vorstands-Druck.",
      tooltip: "",
    },
    {
      key: "boardPressure",
      label: "Vorstands-Druck",
      displayValue: `−${formatDe(boardDamp)}`,
      formula: `Führung ${formatDe(score)} ÷ ${BOARD_V2_CAPTAIN.leadershipDivisor} · max ${formatDe(BOARD_V2_CAPTAIN.maxDamp)}`,
      appliesTo: "Senkt den wahrgenommenen Druck des Vorstands und damit dein Rauswurf-Risiko.",
      caveat: null,
      tooltip: "",
    },
    {
      key: "teamPower",
      label: "Team-Power",
      // Anzeige = WIRKSAMER Wert. Der Rohwert steht in der Formel, damit die
      // Viertelung sichtbar ist statt zu verschwinden.
      displayValue: `+${formatDe(effectiveTeamPowerPct)} %`,
      formula: `Führung ${formatDe(score)} ÷ 9 = ${formatDe(effects.teamPowerModifierPct)} (max ${CAPTAIN_TEAM_POWER_MAX_PCT}), davon ×${String(CAPTAIN_TEAM_POWER_EFFECT_FACTOR).replace(".", ",")}`,
      appliesTo: "Schlägt auf die Wirkung einer gespielten Team-Power auf.",
      caveat: "Wirkt nur, wenn in der Disziplin eine aktive Team-Power gespielt wird — und nicht bei Debuff-Powers.",
      tooltip: "",
    },
  ];

  // Der Kapitaen verstaerkt eine gespielte Team-Power. Ist die Mechanik abgeschaltet, ist der
  // Aufschlag garantiert wirkungslos — dann darf er auch nicht als Effekt ausgewiesen werden,
  // sonst verspricht der Chip einen Nutzen, den es nicht gibt. Die uebrigen drei Effekte
  // (Moral, Rivalitaet, Vorstand) sind davon unberuehrt.
  const visibleRows = areTeamPowersEnabled() ? rows : rows.filter((row) => row.key !== "teamPower");

  return visibleRows.map((row) => ({
    ...row,
    tooltip: [`${row.label} ${row.displayValue}`, row.appliesTo, `Herleitung: ${row.formula}`, row.caveat]
      .filter(Boolean)
      .join(" · "),
  }));
}

/**
 * Ein einzelner Beitrag zur Führungswertung — macht transparent, WARUM ein
 * Spieler wie gut als Kapitän ist (welcher Attributwert mit welchem Gewicht
 * wie viele Punkte beisteuert).
 */
export type CaptainLeadershipFactor = {
  key: "charisma" | "will" | "determination" | "awareness" | "rating" | "traits";
  label: string;
  /** Rohwert des Attributs (bzw. Trait-Bonus-Rohsumme) vor Gewichtung. */
  rawValue: number;
  /** Gewicht in der Formel (Trait-Bonus fließt 1:1 ein → weight 1). */
  weight: number;
  /** Beigetragene Führungspunkte (rawValue × weight, gerundet). */
  points: number;
};

/**
 * Zerlegt die Führungswertung eines Spielers in ihre Einzelbeiträge. Nutzt
 * dieselben Attribut-Fallbacks wie {@link buildCaptainRecordForPlayer}, damit
 * die Summe der `points` (bis auf Rundung) dem `leadershipScore` entspricht.
 */
export function buildCaptainLeadershipBreakdown(
  gameState: GameState,
  player: Player,
  ratings = buildPlayerRatingContractMap(gameState),
): CaptainLeadershipFactor[] {
  const stats = player.attributeSheetStats;
  const traits = getTraits(player);
  const traitBonus = traits.reduce(
    (sum, trait) => sum + (CAPTAIN_POSITIVE_TRAITS.has(trait) ? 4 : trait === "renegade" || trait === "scandalous" ? 1.5 : 0),
    0,
  );
  const charisma = stats?.charisma ?? player.coreStats.soc ?? 0;
  const will = stats?.will ?? player.coreStats.men ?? 0;
  const determination = stats?.determination ?? player.coreStats.pow ?? 0;
  const awareness = stats?.awareness ?? player.coreStats.men ?? 0;
  const rating = ratings.get(player.id)?.mvs ?? player.ovr ?? 0;

  return [
    { key: "charisma", label: "Charisma", rawValue: round(charisma, 0), weight: 0.32, points: round(charisma * 0.32, 1) },
    { key: "will", label: "Wille", rawValue: round(will, 0), weight: 0.2, points: round(will * 0.2, 1) },
    { key: "determination", label: "Entschlossenheit", rawValue: round(determination, 0), weight: 0.18, points: round(determination * 0.18, 1) },
    { key: "awareness", label: "Spielübersicht", rawValue: round(awareness, 0), weight: 0.16, points: round(awareness * 0.16, 1) },
    { key: "rating", label: "Klasse (MVS)", rawValue: round(rating, 0), weight: 0.08, points: round(rating * 0.08, 1) },
    { key: "traits", label: "Charakter-Boni", rawValue: round(traitBonus, 1), weight: 1, points: round(traitBonus, 1) },
  ];
}

export function buildCaptainRecordForPlayer(gameState: GameState, teamId: string, player: Player): TeamCaptainRecord {
  const ratings = buildPlayerRatingContractMap(gameState);
  const traits = getTraits(player);
  const stats = player.attributeSheetStats;
  const traitBonus = traits.reduce(
    (sum, trait) => sum + (CAPTAIN_POSITIVE_TRAITS.has(trait) ? 4 : trait === "renegade" || trait === "scandalous" ? 1.5 : 0),
    0,
  );
  const leadershipScore = round(
    (stats?.charisma ?? player.coreStats.soc ?? 0) * 0.32 +
      (stats?.will ?? player.coreStats.men ?? 0) * 0.2 +
      (stats?.determination ?? player.coreStats.pow ?? 0) * 0.18 +
      (stats?.awareness ?? player.coreStats.men ?? 0) * 0.16 +
      (ratings.get(player.id)?.mvs ?? player.ovr ?? 0) * 0.08 +
      traitBonus,
    1,
  );
  const style =
    traits.includes("eloquent") || (stats?.charisma ?? 0) >= 70
      ? "inspirer"
      : traits.includes("renegade") || traits.includes("scandalous") || (stats?.torment ?? 0) >= 65
        ? "enforcer"
        : (stats?.awareness ?? 0) >= 70 || (stats?.intelligence ?? 0) >= 70
          ? "operator"
          : traits.includes("gambler")
            ? "wildcard"
            : "leader";

  return {
    seasonId: gameState.season.id,
    teamId,
    playerId: player.id,
    playerName: player.name,
    leadershipScore,
    style,
    effects: {
      moraleBuffer: round(clamp(leadershipScore / 18, 1, 6), 1),
      rivalryPressureReductionPct: round(clamp(leadershipScore / 3.5, 4, 24), 1),
      teamPowerModifierPct: round(clamp(leadershipScore / 9, 1, 8), 1),
      conflictSoftenChancePct: round(clamp(leadershipScore / 2.5, 6, 32), 1),
    },
    traitSignals: traits
      .filter((trait) => CAPTAIN_POSITIVE_TRAITS.has(trait) || ["renegade", "scandalous", "gambler"].includes(trait))
      .slice(0, 4),
    source: "manual_assignment",
  };
}

export type TeamCaptainCandidateProfile = TeamCaptainRecord & {
  hasCaptaincyDemand: boolean;
  demandLabel: string | null;
  /** Transparente Zerlegung der Führungswertung — „warum" dieser Spieler wie gut ist. */
  leadershipBreakdown: CaptainLeadershipFactor[];
};

export function buildCaptainCandidateProfiles(gameState: GameState, teamId: string): TeamCaptainCandidateProfile[] {
  const rosterIds = new Set(gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId));
  const players = gameState.players.filter((player) => rosterIds.has(player.id));
  const demandMap = buildTeamPlayerDemandMap(gameState, teamId);
  const ratings = buildPlayerRatingContractMap(gameState);

  return players
    .map((player) => {
      const record = buildCaptainRecordForPlayer(gameState, teamId, player);
      const captaincyDemand = (demandMap.get(player.id) ?? []).find((demand) => demand.type === "captaincy") ?? null;
      return {
        ...record,
        hasCaptaincyDemand: Boolean(captaincyDemand),
        demandLabel: captaincyDemand?.label ?? null,
        leadershipBreakdown: buildCaptainLeadershipBreakdown(gameState, player, ratings),
      };
    })
    .sort(
      (left, right) =>
        right.leadershipScore - left.leadershipScore ||
        Number(right.hasCaptaincyDemand) - Number(left.hasCaptaincyDemand) ||
        left.playerName.localeCompare(right.playerName, "de"),
    );
}

export function hasPersistedTeamCaptain(gameState: GameState, teamId: string) {
  return (gameState.teamCaptains ?? []).some(
    (entry) => entry.seasonId === gameState.season.id && entry.teamId === teamId,
  );
}

export function setTeamCaptain(gameState: GameState, teamId: string, playerId: string): GameState {
  const player = gameState.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error("Spieler für Kapitänswahl nicht gefunden.");
  }
  const onRoster = gameState.rosters.some((entry) => entry.teamId === teamId && entry.playerId === playerId);
  if (!onRoster) {
    throw new Error("Nur Kader-Spieler können Kapitän werden.");
  }

  const captain = buildCaptainRecordForPlayer(gameState, teamId, player);
  const existing = (gameState.teamCaptains ?? []).filter(
    (entry) => !(entry.seasonId === gameState.season.id && entry.teamId === teamId),
  );
  return {
    ...gameState,
    teamCaptains: [...existing, captain],
  };
}
