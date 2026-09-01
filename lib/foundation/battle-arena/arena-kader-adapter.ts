import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { getPlayerGroesse } from "@/lib/data/playerSizeData";

/**
 * Bruecke zwischen dem echten Datenmodell und dem Motor in public/mockups/battle-mode.html.
 *
 * Der Motor erwartet Spielerobjekte in EINEM festen, kleinen Format (siehe dort die SQUAD/OPP-
 * Arrays): {n,c,r,sub,tp,tn,d,a}. Das ist bewusst der Vertrag, den dieser Adapter erfuellt, statt
 * den Motor an das App-Datenmodell anzupassen — der Motor bleibt unangetastet, portabel und bleibt
 * die Quelle, aus der auch das Claude-Artefakt gebaut wird.
 *
 * Attribute UND Disziplin-IDs sind bewusst ein direktes Passthrough: `PlayerAttributeSheetStats`
 * fuehrt exakt dieselben zwoelf Schluessel wie das Rezeptsystem im Motor, und
 * `disciplineRatings` nutzt exakt dieselben (bindestrich-)IDs wie
 * `lib/player-generator/official-discipline-weights.ts` — derselbe Katalog, den
 * `scripts/generiere-arena-daten.ts` schon fuer die Motor-Matrizen liest. Keine zweite
 * Uebersetzungstabelle noetig, und keine, die auseinanderlaufen koennte.
 */

export type ArenaSpieler = {
  n: string;
  c: string;
  r: string;
  sub: string[];
  tp: string[];
  tn: string[];
  d: Record<string, number>;
  /**
   * Sprite-Groesse (Skala 1-10, s. lib/data/playerSizeData.ts), rein fuer die ZEICHNUNG
   * im Motor (dort groesseFaktor auf u.groesse) — beeinflusst keine Attribute/Formel oben.
   * null, wenn Chris' Sheet fuer diesen Namen keinen Wert traegt; der Motor faellt dann auf
   * den Default-Faktor 1.0 zurueck.
   */
  groesse: number | null;
  a: {
    power: number;
    health: number;
    stamina: number;
    intelligence: number;
    awareness: number;
    determination: number;
    speed: number;
    dexterity: number;
    charisma: number;
    will: number;
    spirit: number;
    torment: number;
  };
};

export type ArenaAuswaehlbaresTeam = {
  teamId: string;
  name: string;
};

/**
 * Alle Teams, aus denen der Team-Picker waehlen kann — sortiert nach Name, damit die Liste im
 * Dropdown nicht nach interner Erzeugungsreihenfolge springt.
 */
export function listeArenaTeams(gameState: GameState): ArenaAuswaehlbaresTeam[] {
  return [...gameState.teams]
    .map((team) => ({ teamId: team.teamId, name: team.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/**
 * Ein Spieler ohne Attribut-Bogen (`attributeSheetStats` ist im Datenmodell optional — siehe
 * lib/data/olyDataTypes.ts) hat fuer den Motor nichts, woraus er rechnen koennte. Er wird
 * uebersprungen statt mit erfundenen Nullen ins Feld zu gehen; das waere eine zweite, stille
 * Zahl, die niemand gesetzt hat.
 */
function hatVollstaendigeAttribute(player: Player): player is Player & { attributeSheetStats: NonNullable<Player["attributeSheetStats"]> } {
  const sheet = player.attributeSheetStats;
  if (!sheet) return false;
  const werte = [
    sheet.power,
    sheet.health,
    sheet.stamina,
    sheet.intelligence,
    sheet.awareness,
    sheet.determination,
    sheet.speed,
    sheet.dexterity,
    sheet.charisma,
    sheet.will,
    sheet.spirit,
    sheet.torment,
  ];
  return werte.every((wert) => typeof wert === "number" && Number.isFinite(wert));
}

function zuArenaSpieler(player: Player & { attributeSheetStats: NonNullable<Player["attributeSheetStats"]> }): ArenaSpieler {
  const sheet = player.attributeSheetStats;
  return {
    n: player.name,
    c: player.className,
    r: player.race,
    sub: [...player.subclasses],
    tp: [...player.traitsPositive],
    tn: [...player.traitsNegative],
    d: { ...player.disciplineRatings },
    groesse: getPlayerGroesse(player.name),
    a: {
      power: sheet.power ?? 0,
      health: sheet.health ?? 0,
      stamina: sheet.stamina ?? 0,
      intelligence: sheet.intelligence ?? 0,
      awareness: sheet.awareness ?? 0,
      determination: sheet.determination ?? 0,
      speed: sheet.speed ?? 0,
      dexterity: sheet.dexterity ?? 0,
      charisma: sheet.charisma ?? 0,
      will: sheet.will ?? 0,
      spirit: sheet.spirit ?? 0,
      torment: sheet.torment ?? 0,
    },
  };
}

/**
 * Der komplette Kader eines Teams im Motor-Format, absteigend nach TDM-Eignung sortiert (der
 * Motor waehlt daraus je Disziplin selbst die richtige Untermenge — siehe dessen eigene
 * "Ersatzaufstellung"-Logik — eine Sortierung hier ist nur eine sinnvolle Ausgangsordnung,
 * keine Vorauswahl).
 *
 * gameState.rosters verknuepft playerId<->teamId (Spieler kennen ihr Team nicht selbst, siehe
 * RosterEntry in lib/data/olyDataTypes.ts) — derselbe Zugriffsweg wie in den bestehenden
 * getTeamRosterPlayers()-Stellen unter lib/ai/.
 *
 * `attributeSheetOverrides` ist optional: die kompakte Initial-Payload streift
 * `attributeSheetStats` bei jedem Spieler außer dem eigenen Team (siehe
 * lib/persistence/foundation-initial-compact-state.ts) — ohne nachgeladene Bögen faellt hier bei
 * fremden Teams fast der ganze Kader raus. Der Host laedt sie ueber
 * /api/singleplayer-state/team-roster-sheets nach und reicht sie hier durch, statt dass dieser
 * Adapter selbst etwas ueber Fetch/API weiss.
 */
export function buildArenaTeam(
  gameState: GameState,
  teamId: string,
  attributeSheetOverrides?: ReadonlyMap<string, Player["attributeSheetStats"]>,
): ArenaSpieler[] {
  const spielerIds = new Set(
    gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId),
  );
  if (spielerIds.size === 0) return [];
  const spielerById = new Map(gameState.players.map((player) => [player.id, player]));
  const kader: ArenaSpieler[] = [];
  for (const playerId of spielerIds) {
    const basisSpieler = spielerById.get(playerId);
    if (!basisSpieler) continue;
    const override = attributeSheetOverrides?.get(playerId);
    const player = override ? { ...basisSpieler, attributeSheetStats: override } : basisSpieler;
    if (!hatVollstaendigeAttribute(player)) continue;
    kader.push(zuArenaSpieler(player));
  }
  kader.sort((a, b) => (b.d.tdm ?? 0) - (a.d.tdm ?? 0));
  return kader;
}

/** Bequemer Default fuer den Team-Picker: das Team des aktiven Managers, falls es eines gibt. */
export function findeStandardHeimTeam(gameState: GameState, activeManagerTeamId: string | null | undefined): Team | null {
  if (!activeManagerTeamId) return null;
  return gameState.teams.find((team) => team.teamId === activeManagerTeamId) ?? null;
}
