// Aufbereitung der Aufstellung für die Team-Karte der Disziplin-Bühne.
//
// WARUM ES DIESE DATEI GIBT: Ein Aufstellungs-Eintrag trägt ZWEI Ids, und sie
// bezeichnen verschiedene Dinge.
//
//   entry.playerId        → die Id des Spielers im Katalog (`gameState.players[].id`)
//   entry.activePlayerId  → die Id des KADER-EINTRAGS (`gameState.rosters[].id`),
//                           also des laufenden Vertrags, unter dem er antritt
//
// Die Team-Karte suchte ihre Spieler mit `activePlayerId ?? playerId` in
// `gameState.players` — dort steht aber nie eine Kader-Eintrags-Id. Ergebnis auf
// jedem echten Spielstand: die Sektion „In dieser Disziplin" blieb leer, obwohl die
// Aufstellung vollständig eingereicht war, und dieselbe Verwechslung schob die
// Aufgestellten zusätzlich auf die Ersatzbank (dort fällt sie nur weniger auf, weil
// der Arena-Payload sie als zweite Quelle wieder einfängt).
//
// Deshalb wird hier EINMAL aufgelöst — Kader-Eintrag → Spieler — und zwar für alle
// drei Sektionen aus derselben Quelle, damit ein Spieler nicht gleichzeitig oben in
// der Disziplin und unten auf der Ersatzbank stehen kann.

export type TeamLineupEntry = {
  disciplineSide: "d1" | "d2";
  slotIndex: number;
  playerId: string;
  activePlayerId?: string | null;
};

export type TeamLineupRosterEntry = {
  /** Id des Kader-Eintrags — das Ziel von `activePlayerId`. */
  id?: string | null;
  teamId: string;
  /** Id des Spielers im Katalog. */
  playerId: string;
};

/** Ein aufgestellter Slot, aufgelöst auf die Katalog-Spieler-Id. */
export type TeamLineupSlot = {
  disciplineSide: "d1" | "d2";
  slotIndex: number;
  playerId: string;
};

export type TeamLineupSections = {
  /** Aufstellung der gezeigten Disziplin — nach Slot sortiert. */
  currentSide: TeamLineupSlot[];
  /** Aufstellung der anderen Disziplin des Spieltags — nach Slot sortiert. */
  otherSide: TeamLineupSlot[];
  /** Alle heute eingesetzten Spieler (Aufstellung ∪ Arena-Payload). */
  deployedPlayerIds: string[];
  /** Kader ohne die Eingesetzten. */
  benchPlayerIds: string[];
};

/** Kader-Eintrags-Id → Katalog-Spieler-Id. */
export function buildRosterEntryPlayerIndex(rosters: readonly TeamLineupRosterEntry[] | null | undefined): Map<string, string> {
  const index = new Map<string, string>();
  for (const entry of rosters ?? []) {
    if (entry?.id && entry.playerId) {
      index.set(entry.id, entry.playerId);
    }
  }
  return index;
}

/**
 * Die Katalog-Spieler-Id eines Aufstellungs-Eintrags.
 *
 * Reihenfolge mit Absicht: erst der Kader-Eintrag (er sagt, unter welchem Vertrag
 * heute wirklich angetreten wird), dann das denormalisierte `playerId` des Eintrags.
 * Ist `activePlayerId` ausnahmsweise schon eine Spieler-Id (alte Stände), wird sie
 * als solche akzeptiert — aber NUR, wenn sie kein Kader-Eintrag ist.
 */
export function resolveLineupEntryPlayerId(
  entry: TeamLineupEntry,
  rosterEntryPlayerIndex: Map<string, string>,
): string | null {
  const active = entry.activePlayerId ?? null;
  if (active) {
    const fromRoster = rosterEntryPlayerIndex.get(active);
    if (fromRoster) return fromRoster;
  }
  if (entry.playerId) return entry.playerId;
  return active;
}

/**
 * Die drei Sektionen der Team-Karte aus Aufstellung + Arena-Payload.
 *
 * `fieldedPlayerIds` (aus dem Arena-Payload) sind bereits Katalog-Spieler-Ids und
 * bleiben die zweite Quelle: sie tragen die Besetzung, wenn gar kein Draft vorliegt
 * (Test-/Vorschau-Modus) oder er beim Anwenden des Ergebnisses verbraucht wurde.
 */
export function buildTeamLineupSections(input: {
  entries: readonly TeamLineupEntry[] | null | undefined;
  rosters: readonly TeamLineupRosterEntry[] | null | undefined;
  teamId: string;
  currentSide: "d1" | "d2";
  fieldedPlayerIds?: readonly string[] | null;
}): TeamLineupSections {
  const rosterEntryPlayerIndex = buildRosterEntryPlayerIndex(input.rosters);
  const teamRosterPlayerIds = (input.rosters ?? []).filter((r) => r.teamId === input.teamId).map((r) => r.playerId);
  const otherSide: "d1" | "d2" = input.currentSide === "d1" ? "d2" : "d1";

  const slots: TeamLineupSlot[] = [];
  for (const entry of input.entries ?? []) {
    const playerId = resolveLineupEntryPlayerId(entry, rosterEntryPlayerIndex);
    if (!playerId) continue;
    slots.push({ disciplineSide: entry.disciplineSide, slotIndex: entry.slotIndex, playerId });
  }
  const bySide = (side: "d1" | "d2") =>
    slots.filter((s) => s.disciplineSide === side).sort((a, b) => a.slotIndex - b.slotIndex);

  const fielded = (input.fieldedPlayerIds ?? []).filter(Boolean);
  const deployed = new Set<string>([...slots.map((s) => s.playerId), ...fielded]);

  return {
    currentSide: bySide(input.currentSide),
    otherSide: bySide(otherSide),
    deployedPlayerIds: [...deployed],
    benchPlayerIds: teamRosterPlayerIds.filter((id) => !deployed.has(id)),
  };
}
