import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { GameState, Player } from "@/lib/data/olyDataTypes";

// One aufgestellter Spieler in einem Slot einer Disziplin, mit echter
// Netto-Leistung aus dem Save (Disziplin-Wert + echtem Fatigue/Form).
export type DisciplineStageSlot = {
  slotIndex: number;
  playerId: string;
  playerName: string;
  base: number; // player.disciplineRatings[disciplineId]
  fatiguePenalty: number; // aus player.fatigue
  formSwing: number; // aus player.form + kleiner Tagesform-Swing
  net: number; // max(0, base - fatiguePenalty + formSwing)
  portraitUrl: string | null;
  traits: string[]; // player.traitsPositive + traitsNegative (für Trait-Mutatoren)
};

export type DisciplineStageTeam = {
  teamId: string;
  shortCode: string;
  name: string;
  isOwn: boolean;
  logoUrl: string | null;
  slots: DisciplineStageSlot[];
  total: number;
};

export type DisciplineStageModel = {
  disciplineId: string;
  disciplineName: string;
  slotCount: number;
  teams: DisciplineStageTeam[]; // absteigend nach total sortiert = Rang
};

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

// Deterministischer „Tagesform"-Swing in [-4, 4], fest pro Spieler+Disziplin
// (reiner Hash aus player.id|disciplineId — für dieselbe Paarung immer gleich).
// Gibt der Form einen kleinen individuellen Beiwert oben auf player.form.
function seededJitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const norm = ((h >>> 0) % 1000) / 1000; // 0..1
  return Math.round((norm * 2 - 1) * 4);
}

function computeSlot(player: Player, disciplineId: string, slotIndex: number): DisciplineStageSlot {
  // Grundwert kann im Save bis zu 2 Nachkommastellen haben — zuerst auf 1
  // Dezimale runden und ALLES daraus ableiten, damit die Anzeige-Identität
  // „Grundwert − Fatigue + Form = Netto" exakt stimmt (keine 0,1-Abweichung).
  const base = Number((player.disciplineRatings?.[disciplineId] ?? 0).toFixed(1));
  const fatigue = clamp(player.fatigue ?? 0, 0, 100);
  const form = clamp(player.form ?? 50, 0, 100);
  // Fatigue bremst nach vorne: bis zu 25 % des Werts bei voller Erschöpfung.
  const fatiguePenalty = Math.round(((base * fatigue) / 100) * 0.25);
  // Form über/unter 50 gibt bis zu ±12 %, plus kleiner Tagesform-Swing.
  const formBase = Math.round(((form - 50) / 50) * base * 0.12);
  const formSwing = formBase + seededJitter(`${player.id}|${disciplineId}`);
  const net = Number(Math.max(0, base - fatiguePenalty + formSwing).toFixed(1));
  const portraitUrl = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, player.portraitPath ?? null);
  const traits = [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])].map((t) => String(t).trim()).filter(Boolean);
  return {
    slotIndex,
    playerId: player.id,
    playerName: player.name,
    base,
    fatiguePenalty,
    formSwing,
    net,
    portraitUrl,
    traits,
  };
}

export function buildDisciplineStageModel(
  gameState: GameState,
  disciplineId: string,
  ownTeamId: string | null,
): DisciplineStageModel {
  // Defensiv gegen Bootstrap-/Teil-States: im Ladefenster können diese Arrays
  // (noch) fehlen. Dann bauen wir ein leeres Modell statt zu crashen.
  const discipline = (gameState.disciplines ?? []).find((d) => d.id === disciplineId);
  const slotCount = discipline?.playerCount ?? 5;

  const playersById = new Map<string, Player>();
  for (const player of gameState.players ?? []) {
    playersById.set(player.id, player);
  }

  const rosterByTeam = new Map<string, Player[]>();
  for (const entry of gameState.rosters ?? []) {
    const player = playersById.get(entry.playerId);
    if (!player) {
      continue;
    }
    const arr = rosterByTeam.get(entry.teamId) ?? [];
    arr.push(player);
    rosterByTeam.set(entry.teamId, arr);
  }

  const teams: DisciplineStageTeam[] = (gameState.teams ?? []).map((team) => {
    const roster = rosterByTeam.get(team.teamId) ?? [];
    const sorted = [...roster].sort(
      (a, b) => (b.disciplineRatings?.[disciplineId] ?? 0) - (a.disciplineRatings?.[disciplineId] ?? 0),
    );
    const chosen = sorted.slice(0, slotCount);
    const slots = chosen.map((player, idx) => computeSlot(player, disciplineId, idx));
    const total = slots.reduce((sum, slot) => sum + slot.net, 0);
    return {
      teamId: team.teamId,
      shortCode: team.shortCode,
      name: team.name,
      isOwn: ownTeamId != null && team.teamId === ownTeamId,
      logoUrl: getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null),
      slots,
      total,
    };
  });

  teams.sort((a, b) => b.total - a.total || a.shortCode.localeCompare(b.shortCode));

  return { disciplineId, disciplineName: discipline?.name ?? disciplineId, slotCount, teams };
}
