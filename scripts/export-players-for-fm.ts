/**
 * Exportiert alle Spieler eines Saves als CSV fuer den FM-Bulk-Import (z.B. via "FM26 Generator").
 * Uebersetzt die 12 Oly-Attribute (1-99) auf die FM-Skala (1-20) und weist jedem Spieler
 * eine Feldposition zu (Heuristik aus coreStats + attributeSheetStats, da es in Oly keine
 * echten Positionen gibt).
 *
 * CA/PA (1-200, FM-Skala) kommen aus Olys eigenem Rating bzw. dem echten Potenzial-Modell
 * (resolvePlayerPotentialScoreFromGameState -> gameState.playerPotential[].hiddenPotentialScore,
 * NICHT das veraltete player.potential-Feld, siehe Kommentar an olyDataTypes.ts:1079). PA wird auf
 * mindestens CA geklemmt (FM erlaubt CA nie > PA). Alter ist synthetisch (Oly kennt kein
 * Geburtsdatum), aber an die CA/PA-Luecke gekoppelt: viel Potenzial-Puffer -> jung, kaum Puffer
 * -> nah an 30. Deckel bei 30, damit niemand nach der ersten Saison in Rente geht. Nationalitaet
 * ist ein reiner Platzhalter (Oly kennt keine Nation).
 *
 * Usage: OLY_APP_SQLITE_PATH=<db> npx tsx scripts/export-players-for-fm.ts --save-id <id> --out <pfad.csv>
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerPotentialScoreFromGameState } from "@/lib/scouting/player-attribute-ceiling-service";
import { writeFileSync } from "fs";

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function scale20(v: number | null | undefined): number {
  const x = typeof v === "number" && Number.isFinite(v) ? v : 50;
  return Math.min(20, Math.max(1, Math.round((x / 99) * 19) + 1));
}
function avg(...vals: Array<number | null | undefined>): number {
  const nums = vals.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 50;
}

// Oly-Skala (0-99, teils leicht drueber) -> FM CA/PA-Skala (1-200)
function scale200(v: number | null | undefined): number {
  const x = typeof v === "number" && Number.isFinite(v) ? v : 50;
  return Math.min(195, Math.max(5, Math.round((x / 99) * 190) + 5));
}

// einfacher deterministischer Zufall pro Spieler-ID, damit Alter/Nation bei erneutem Lauf stabil bleiben
function seededFraction(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

const NATION_POOL = ["SWE", "NOR", "DEN", "FIN", "ENG", "GER", "NED", "ESP"]; // Platzhalter, da Oly keine Nation kennt

function assignPosition(attr: {
  power: number; health: number; stamina: number; intelligence: number; awareness: number;
  determination: number; speed: number; dexterity: number; charisma: number; will: number;
  spirit: number; torment: number;
}, rating: number, rank: number, teamSize: number, hasRoster: boolean, gkFraction: number): string {
  const isGoalkeeper = hasRoster
    // gerostertes Team: unterstes Rating-Achtel des Kaders als Torwart markieren (mind. 1)
    ? rank >= teamSize - Math.max(1, Math.round(teamSize * 0.12))
    // Free Agent ohne Team: keine Kader-Position zum Vergleichen -> feste 10%-Quote per Zufall
    : gkFraction < 0.10;
  if (isGoalkeeper) return "GK";

  const axes = {
    def: avg(attr.power, attr.determination),
    mid: avg(attr.intelligence, attr.awareness, attr.will),
    att: avg(attr.speed, attr.dexterity),
    creative: avg(attr.charisma, attr.intelligence),
  };
  const best = Object.entries(axes).sort((a, b) => b[1] - a[1])[0][0];
  switch (best) {
    case "def": return attr.speed > 60 ? "DL/DR/DC" : "DC";
    case "mid": return attr.determination > attr.charisma ? "DM/MC" : "MC";
    case "creative": return "AMC/AML/AMR";
    default: return attr.power > 55 ? "ST" : "AML/AMR/ST";
  }
}

function main() {
  const saveId = arg("--save-id");
  const out = arg("--out") ?? "players-for-fm.csv";
  if (!saveId) throw new Error("--save-id required");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const gs = save.gameState;

  const rosterByPlayerId = new Map(gs.rosters.map((r) => [r.playerId, r] as const));
  const teamById = new Map(gs.teams.map((t) => [t.teamId, t] as const));
  const rosterCountByTeam = new Map<string, number>();
  for (const r of gs.rosters) rosterCountByTeam.set(r.teamId, (rosterCountByTeam.get(r.teamId) ?? 0) + 1);

  // Spieler pro Team nach Rating sortiert, um Torwart-Rang (niedrigstes Rating zuerst) zu bestimmen
  const playersByTeam = new Map<string, typeof gs.players>();
  for (const p of gs.players) {
    const roster = rosterByPlayerId.get(p.id);
    if (!roster) continue;
    const list = playersByTeam.get(roster.teamId) ?? [];
    list.push(p);
    playersByTeam.set(roster.teamId, list);
  }
  for (const list of playersByTeam.values()) list.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));

  const rankIndex = new Map<string, number>();
  for (const [teamId, list] of playersByTeam.entries()) {
    list.forEach((p, i) => rankIndex.set(p.id, i));
  }

  const header = [
    "player_id", "name", "oly_team_code", "oly_team_name",
    "race", "class_name", "gender", "assigned_position",
    "synthetic_age", "synthetic_nationality",
    "oly_rating", "oly_potential", "oly_market_value",
    "fm_CA", "fm_PA",
    "raw_power", "raw_health", "raw_stamina", "raw_intelligence", "raw_awareness",
    "raw_determination", "raw_speed", "raw_dexterity", "raw_charisma", "raw_will",
    "raw_spirit", "raw_torment",
    "fm_Pace", "fm_Acceleration", "fm_Stamina", "fm_NaturalFitness", "fm_Strength",
    "fm_JumpingReach", "fm_Balance", "fm_Agility",
    "fm_Technique", "fm_FirstTouch", "fm_Dribbling", "fm_Passing", "fm_Crossing",
    "fm_Finishing", "fm_LongShots", "fm_Heading", "fm_Tackling",
    "fm_Vision", "fm_Decisions", "fm_Anticipation", "fm_Concentration",
    "fm_Determination", "fm_WorkRate", "fm_Teamwork", "fm_Leadership",
    "fm_Bravery", "fm_Aggression", "fm_Composure",
  ];

  const lines = [header.join(";")];

  for (const p of gs.players) {
    const roster = rosterByPlayerId.get(p.id) ?? null;
    const team = roster ? teamById.get(roster.teamId) : null;
    const a = p.attributeSheetStats ?? {};
    const raw = {
      power: a.power ?? 50, health: a.health ?? 50, stamina: a.stamina ?? 50,
      intelligence: a.intelligence ?? 50, awareness: a.awareness ?? 50,
      determination: a.determination ?? 50, speed: a.speed ?? 50, dexterity: a.dexterity ?? 50,
      charisma: a.charisma ?? 50, will: a.will ?? 50, spirit: a.spirit ?? 50, torment: a.torment ?? 50,
    };

    const frac = seededFraction(p.id);
    const nation = NATION_POOL[Math.floor(frac * NATION_POOL.length)];

    const ratingScore = p.rating ?? 50;
    const potentialScore = resolvePlayerPotentialScoreFromGameState({ gameState: gs, playerId: p.id }) ?? ratingScore;
    const ca = scale200(ratingScore);
    const pa = Math.max(ca, scale200(potentialScore));

    // Luecke zwischen Potenzial und aktuellem Rating (0-99er Skala) -> Alter: viel Luft nach oben (junger
    // Spieler), kaum Luft (schon nah am eigenen Limit, aelter). Deckel 30, damit niemand nach einer Saison
    // in Rente geht (Chris' Vorgabe).
    const gap = Math.max(0, Math.min(30, potentialScore - ratingScore));
    const baseAge = 30 - (gap / 30) * 13; // gap=0 -> 30, gap>=30 -> 17
    const jitter = (frac - 0.5) * 4; // +/-2 Jahre
    const age = Math.min(30, Math.max(17, Math.round(baseAge + jitter)));

    const teamSize = roster ? rosterCountByTeam.get(roster.teamId) ?? 1 : 1;
    const rank = roster ? rankIndex.get(p.id) ?? 0 : 0;
    const position = assignPosition(raw, p.rating ?? 50, rank, teamSize, roster != null, frac);

    const row = [
      p.id, p.name, team?.shortCode ?? "", team?.name ?? "",
      p.race, p.className, p.gender, position,
      age, nation,
      Math.round(ratingScore * 10) / 10, Math.round(potentialScore * 10) / 10, Math.round((p.marketValue ?? 0) * 10) / 10,
      ca, pa,
      raw.power, raw.health, raw.stamina, raw.intelligence, raw.awareness,
      raw.determination, raw.speed, raw.dexterity, raw.charisma, raw.will,
      raw.spirit, raw.torment,
      scale20(raw.speed), scale20(avg(raw.speed, raw.dexterity)), scale20(raw.stamina),
      scale20(avg(raw.stamina, raw.health)), scale20(raw.power),
      scale20(avg(raw.power, raw.speed)), scale20(avg(raw.dexterity, raw.power)), scale20(avg(raw.dexterity, raw.speed)),
      scale20(raw.dexterity), scale20(avg(raw.dexterity, raw.intelligence)), scale20(avg(raw.dexterity * 0.7 + raw.speed * 0.3)),
      scale20(avg(raw.dexterity, raw.intelligence)), scale20(avg(raw.dexterity, raw.awareness)),
      scale20(avg(raw.dexterity, raw.power)), scale20(avg(raw.dexterity, raw.power)), scale20(avg(raw.power, raw.awareness)),
      scale20(avg(raw.power, raw.determination)),
      scale20(avg(raw.intelligence, raw.awareness)), scale20(avg(raw.intelligence, raw.awareness)),
      scale20(avg(raw.awareness, raw.intelligence)), scale20(avg(raw.awareness, raw.will)),
      scale20(raw.determination), scale20(avg(raw.determination, raw.will)), scale20(avg(raw.charisma, raw.will)),
      scale20(raw.charisma),
      scale20(avg(raw.will, raw.spirit)), scale20(avg(raw.spirit, raw.torment)), scale20(avg(raw.will, 99 - raw.torment)),
    ];
    lines.push(row.join(";"));
  }

  writeFileSync(out, lines.join("\n"), "utf-8");
  console.log(`Geschrieben: ${out} (${gs.players.length} Spieler)`);
}

main();
