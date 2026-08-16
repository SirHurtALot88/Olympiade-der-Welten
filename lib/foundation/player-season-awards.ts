import type { GameState, SeasonSnapshotAwardRecord } from "@/lib/data/olyDataTypes";

/**
 * DIE AUSZEICHNUNGEN EINES SPIELERS ÜBER ALLE SAISONS — eine Rechenstelle.
 *
 * CHRIS (Ticket #41): „Dafür hätte ich gerne im Spielerprofil die Icons dass man auch später
 * direkt sieht ah der spieler gehört [dazu]".
 *
 * Gelesen wird ausschliesslich aus den SAISON-SCHNAPPSCHUESSEN. Die laufende Saison hat noch
 * keine Auszeichnungen — die fallen beim Saisonabschluss (`buildSeasonReview`, Schritt
 * `season_rewards`). Eine „vorlaeufige" Auszeichnung waere schlimmer als keine: sie stuende im
 * Profil, koennte sich bis zum Saisonende noch aendern, und niemand koennte der Anzeige ansehen,
 * dass sie nur ein Zwischenstand ist.
 *
 * Bestandsspielstaende tragen `seasonAwards` nicht. Dann kommt eine leere Liste zurueck und das
 * Profil zeigt keinen Abschnitt — nicht einen leeren. „Dieser Spieler hat nichts gewonnen" und
 * „diese Spielstaende haben das Feld noch nicht" sind zwei verschiedene Aussagen.
 */

export type PlayerSeasonAward = {
  seasonId: string;
  seasonName: string;
  awardId: string;
  label: string;
  /** Kurzzeichen fuers Profil — mehr als ein Zeichen waere in einer Zeile mit mehreren Titeln zu viel. */
  icon: string;
  value: number | string | null;
  reason: string;
};

/**
 * Zeichen je Auszeichnung. Bewusst hier und nicht in der Anzeige: sonst waehlt jede Ansicht ihr
 * eigenes Symbol, und derselbe Titel saehe an zwei Stellen verschieden aus.
 *
 * Unbekannte Kennungen bekommen einen Pokal statt gar nichts — eine Auszeichnung ohne Zeichen
 * verschwaende die Zeile, und neue Titel sollen nicht erst hier eingetragen werden muessen,
 * bevor sie sichtbar werden.
 */
const AWARD_ICONS: Record<string, string> = {
  mvp: "👑",
  player_of_the_season: "🏅",
  mvs_king: "💎",
  pps_king: "🎯",
  all_star_pow: "💪",
  all_star_spe: "⚡",
  all_star_men: "🧠",
  all_star_soc: "🎭",
  training_award: "📈",
  most_improved_player: "🚀",
  best_transfer: "💰",
  discipline_monster: "🔥",
};

export const AWARD_FALLBACK_ICON = "🏆";

export function getAwardIcon(awardId: string): string {
  return AWARD_ICONS[awardId] ?? AWARD_FALLBACK_ICON;
}

export function buildPlayerSeasonAwards(gameState: GameState, playerId: string): PlayerSeasonAward[] {
  if (!playerId) {
    return [];
  }
  const treffer: PlayerSeasonAward[] = [];
  for (const schnappschuss of gameState.seasonState?.seasonSnapshots ?? []) {
    const awards: SeasonSnapshotAwardRecord[] = schnappschuss.seasonAwards ?? [];
    for (const award of awards) {
      if (award.winnerType !== "player" || award.winnerId !== playerId) {
        continue;
      }
      treffer.push({
        seasonId: schnappschuss.seasonId,
        seasonName: schnappschuss.seasonName,
        awardId: award.awardId,
        label: award.label,
        icon: getAwardIcon(award.awardId),
        value: award.value,
        reason: award.reason,
      });
    }
  }
  // Neueste Saison zuerst — im Profil interessiert „was ist er JETZT" vor „was war er mal".
  return treffer.sort((links, rechts) => rechts.seasonId.localeCompare(links.seasonId, "de", { numeric: true }));
}
