import type {
  GameState,
  Player,
  PlayerGeneratorAttributes,
  PlayerGeneratorAttributeName,
} from "@/lib/data/olyDataTypes";
import { buildLeagueDisciplineRatingsWithAttributeOverrides } from "@/lib/player-formulas/discipline-rating-engine";
import type { PlayerSeasonTrainingForecast } from "@/lib/foundation/player-matchday-training-history";

/**
 * Was das Saison-Training in den DISZIPLINEN bewirkt.
 *
 * Der Saison-Forecast der Trainingshistorie steht in Attributen (STR +1,7, DET +2,2 …). Was ein
 * Manager davon wissen will, steht aber eine Ebene weiter: in welchen Disziplinen wird der Spieler
 * dadurch besser? Die Übersetzung ist nicht offensichtlich — ein Diszi-Wert ist KEIN gewichteter
 * Attributschnitt, sondern der ligaweite RANG des gewichteten Attributsummen, durch die
 * Rang→Stat-Tabelle geschickt (`buildLeagueDisciplineRatingsWithAttributeOverrides`). +2 auf ein
 * Attribut kann daher je nach Dichte des Felds 0 oder 3 Punkte Diszi-Wert bedeuten.
 *
 * Deshalb wird hier nicht geschätzt, sondern zweimal dieselbe Engine gefahren: einmal mit den
 * heutigen Attributen, einmal mit den projizierten — und die Differenz ist die Auswirkung.
 *
 * Ausdrücklich unter der Annahme „wenn sich sonst nichts ändert": die anderen Spieler trainieren
 * ebenfalls, ihre Attribute bleiben hier aber stehen. Ein Rang verschiebt sich nun einmal nur
 * relativ. Die Anzeige muss das benennen, sonst liest sich eine Projektion wie eine Zusage.
 */

export type PlayerDisciplineTrainingForecastRow = {
  disciplineId: string;
  /** Diszi-Wert aus den heutigen Attributen — Bezugspunkt der Differenz, nicht der Anzeigewert. */
  baseline: number;
  /** Diszi-Wert aus den projizierten Attributen. */
  projected: number;
  /** `projected - baseline`, auf ganze Punkte gerundet (die Diszi-Werte werden ganzzahlig gezeigt). */
  delta: number;
};

export type PlayerDisciplineTrainingForecast = {
  seasonId: string;
  rowsByDisciplineId: Record<string, PlayerDisciplineTrainingForecastRow>;
};

function buildProjectedAttributes(
  player: Player,
  forecast: PlayerSeasonTrainingForecast,
): PlayerGeneratorAttributes | null {
  const stats = player.attributeSheetStats;
  if (!stats) {
    return null;
  }

  // Ein einzelnes fehlendes Attribut kippt die ganze Projektion: die Engine wuerde den Spieler
  // dann aus der Rangliste werfen und die Differenz waere frei erfunden. Lieber gar nichts zeigen.
  const raw = {
    power: stats.power,
    health: stats.health,
    stamina: stats.stamina,
    intelligence: stats.intelligence,
    awareness: stats.awareness,
    determination: stats.determination,
    speed: stats.speed,
    dexterity: stats.dexterity,
    charisma: stats.charisma,
    will: stats.will,
    spirit: stats.spirit,
    torment: stats.torment,
  };
  if (!Object.values(raw).every((value) => typeof value === "number" && Number.isFinite(value))) {
    return null;
  }
  const projected = { ...raw } as PlayerGeneratorAttributes;

  let touched = false;
  for (const cell of forecast.attributes) {
    const key = cell.attribute as PlayerGeneratorAttributeName;
    if (!(key in projected)) {
      continue;
    }
    if (!Number.isFinite(cell.projectedValue)) {
      continue;
    }
    projected[key] = cell.projectedValue;
    touched = true;
  }

  return touched ? projected : null;
}

export function buildPlayerDisciplineTrainingForecast(input: {
  gameState: GameState;
  player: Player;
  forecast: PlayerSeasonTrainingForecast | null | undefined;
}): PlayerDisciplineTrainingForecast | null {
  const { gameState, player, forecast } = input;
  if (!forecast || forecast.attributes.length === 0) {
    return null;
  }

  const projectedAttributes = buildProjectedAttributes(player, forecast);
  if (!projectedAttributes) {
    return null;
  }

  const players = gameState.players ?? [];
  if (players.length === 0) {
    return null;
  }

  // Zwei Läufe über DIESELBE Engine. Der Bezugspunkt kommt bewusst nicht aus
  // `player.disciplineRatings`: der gespeicherte Wert kann aus einem anderen Ligastand stammen,
  // und eine Differenz aus zwei verschiedenen Quellen wäre keine.
  const baselineRatings = buildLeagueDisciplineRatingsWithAttributeOverrides(players);
  const projectedRatings = buildLeagueDisciplineRatingsWithAttributeOverrides(players, {
    [player.id]: projectedAttributes,
  });

  const baseline = baselineRatings.get(player.id);
  const projected = projectedRatings.get(player.id);
  if (!baseline || !projected) {
    return null;
  }

  const rowsByDisciplineId: Record<string, PlayerDisciplineTrainingForecastRow> = {};
  for (const [disciplineId, baselineValue] of Object.entries(baseline)) {
    const projectedValue = projected[disciplineId];
    if (projectedValue == null || !Number.isFinite(projectedValue)) {
      continue;
    }
    const delta = Math.round(projectedValue - baselineValue);
    rowsByDisciplineId[disciplineId] = {
      disciplineId,
      baseline: baselineValue,
      projected: projectedValue,
      delta,
    };
  }

  return { seasonId: forecast.seasonId, rowsByDisciplineId };
}

/** Disziplinen mit spürbarer Auswirkung, stärkste zuerst — für die Zusammenfassung. */
export function selectMovedDisciplines(
  forecast: PlayerDisciplineTrainingForecast | null | undefined,
  limit = 6,
): PlayerDisciplineTrainingForecastRow[] {
  if (!forecast) {
    return [];
  }
  return Object.values(forecast.rowsByDisciplineId)
    .filter((row) => row.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.disciplineId.localeCompare(right.disciplineId))
    .slice(0, limit);
}
