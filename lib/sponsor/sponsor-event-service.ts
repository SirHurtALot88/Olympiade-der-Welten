import { randomUUID } from "@/lib/utils/random-id";

import type { GameState, SponsorEventRecord } from "@/lib/data/olyDataTypes";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function roundCash(value: number) {
  return Number(value.toFixed(1));
}

export function maybeGenerateSponsorEvents(gameState: GameState, saveId: string): GameState {
  const seasonId = gameState.season.id;
  const matchday = gameState.season.currentMatchday;
  const existing = gameState.seasonState.sponsorEvents ?? [];
  const existingKeys = new Set(existing.map((entry) => `${entry.teamId}:${entry.eventType}:${entry.matchday}`));
  const nextEvents: SponsorEventRecord[] = [...existing];

  for (const team of gameState.teams) {
    const contract = getTeamSponsorContract(gameState, team.teamId);
    if (!contract) {
      continue;
    }

    const rollSeed = `${saveId}:${seasonId}:${team.teamId}:${matchday}:sponsor-event`;
    const roll = getStableUnitHash(rollSeed);
    if (roll > 0.12) {
      continue;
    }

    const eventType =
      roll < 0.04 ? "activation_bonus" : roll < 0.08 ? "clause_trigger" : ("partner_conflict" as const);
    const key = `${team.teamId}:${eventType}:${matchday}`;
    if (existingKeys.has(key)) {
      continue;
    }

    const cashDelta =
      eventType === "activation_bonus"
        ? roundCash(2 + (contract.starTier ?? 2))
        : eventType === "clause_trigger"
          ? roundCash(-1 - (contract.starTier ?? 2) / 2)
          : roundCash(-2);

    nextEvents.push({
      eventId: `sponsor-event:${seasonId}:${team.teamId}:${matchday}:${randomUUID()}`,
      saveId,
      seasonId,
      teamId: team.teamId,
      matchday,
      eventType,
      sponsorName: contract.name,
      cashDelta,
      status: "open",
      createdAt: new Date().toISOString(),
      message:
        eventType === "activation_bonus"
          ? `${contract.name} startet eine Medien-Aktion — Bonus-Cash verfügbar.`
          : eventType === "clause_trigger"
            ? `${contract.name} verschärft kurzfristig eine Vertragsklausel.`
            : `${contract.name} meldet Partner-Reibung — Malus droht.`,
    });
    existingKeys.add(key);
  }

  if (nextEvents.length === existing.length) {
    return gameState;
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorEvents: nextEvents,
    },
  };
}

export function resolveSponsorEvent(gameState: GameState, eventId: string, action: "accept" | "dismiss"): GameState {
  const events = gameState.seasonState.sponsorEvents ?? [];
  const event = events.find((entry) => entry.eventId === eventId);
  if (!event || event.status !== "open") {
    return gameState;
  }

  let nextGameState = gameState;
  if (action === "accept" && event.cashDelta !== 0) {
    nextGameState = {
      ...nextGameState,
      teams: nextGameState.teams.map((team) =>
        team.teamId === event.teamId ? { ...team, cash: roundCash(team.cash + event.cashDelta) } : team,
      ),
    };
  }

  return {
    ...nextGameState,
    seasonState: {
      ...nextGameState.seasonState,
      sponsorEvents: events.map((entry) =>
        entry.eventId === eventId ? { ...entry, status: action === "accept" ? "resolved" : "dismissed" } : entry,
      ),
    },
  };
}

export function listOpenSponsorEvents(gameState: GameState, teamId?: string) {
  return (gameState.seasonState.sponsorEvents ?? []).filter(
    (entry) => entry.status === "open" && (!teamId || entry.teamId === teamId),
  );
}
