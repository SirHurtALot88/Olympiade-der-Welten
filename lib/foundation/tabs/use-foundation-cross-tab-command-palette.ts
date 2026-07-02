import { useMemo } from "react";

import { GAME_ENCYCLOPEDIA_ENTRIES } from "@/lib/ui/game-encyclopedia";
import type { GameInboxItem, GameState, Team } from "@/lib/data/olyDataTypes";
import {
  foundationAdminViews,
  foundationPrimaryViews,
  foundationSecondaryViews,
  resolveFoundationViewTarget,
  syncFoundationViewInUrl,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";
import { setFoundationView } from "@/lib/foundation/foundation-navigation";
import type { FoundationCommandItem, FoundationView } from "@/lib/foundation/tabs/foundation-page-types";

export function useFoundationCrossTabCommandPalette(input: {
  activeView: FoundationView;
  activeManagerTeamId: string;
  commandSearch: string;
  gameState: GameState;
  globalNextLabel: string;
  globalNextStatusClass: string;
  gameFlowActionStepCta: string;
  isTransferMarketViewActive: boolean;
  primaryInboxItem: GameInboxItem | null;
  selectedEncyclopediaEntryId: string;
  triggerGlobalNext: () => void | Promise<void>;
  openFoundationViewCommand: (view: FoundationView) => void;
  openTeamDrawerById: (teamId: string) => void;
  openPlayerDrawerById: (playerId: string, rosterId?: string | null) => void;
  openEncyclopediaEntry: (termOrId: string) => void;
  inboxCategoryFilter: string;
  setInboxCategoryFilter: (filter: string) => void;
  setActiveView: (view: FoundationView) => void;
}) {
  const foundationCommandItems = useMemo<FoundationCommandItem[]>(() => {
    const viewCommands: FoundationCommandItem[] = [
      ...foundationPrimaryViews,
      ...foundationAdminViews,
      ...foundationSecondaryViews,
    ].map((view) => ({
      id: `view-${view.id}`,
      label: view.label,
      detail: resolveFoundationViewTarget(view.id) === input.activeView ? "aktuelle Ansicht" : "Ansicht öffnen",
      section: "Ansicht" as const,
      keywords: `${view.id} ${view.label}`,
      tone: resolveFoundationViewTarget(view.id) === input.activeView ? "ready" : undefined,
      run: () => input.openFoundationViewCommand(view.id),
    }));

    const teamCommands: FoundationCommandItem[] = input.gameState.teams.map((team) => ({
      id: `team-${team.teamId}`,
      label: team.name,
      detail: `${team.shortCode} · Team öffnen`,
      section: "Team" as const,
      keywords: `${team.name} ${team.shortCode} ${team.teamId} team verein kader roster gm ally rival`,
      tone: team.teamId === input.activeManagerTeamId ? "ready" : undefined,
      run: () => {
        input.openTeamDrawerById(team.teamId);
      },
    }));
    const teamById = new Map(input.gameState.teams.map((team) => [team.teamId, team] as const));
    const rosterByPlayerId = new Map(input.gameState.rosters.map((entry) => [entry.playerId, entry] as const));
    const playerCommands: FoundationCommandItem[] = input.gameState.players.map((player) => {
      const roster = rosterByPlayerId.get(player.id) ?? null;
      const team = roster ? teamById.get(roster.teamId) ?? null : null;
      const teamLabel = team ? `${team.shortCode} · ${team.name}` : "Free Agent";
      const classLabel = [player.className, player.race].filter(Boolean).join(" · ");
      return {
        id: `player-${player.id}`,
        label: player.name,
        detail: `${teamLabel}${classLabel ? ` · ${classLabel}` : ""}`,
        section: "Spieler" as const,
        keywords: [
          player.name,
          player.id,
          player.className,
          player.race,
          player.alignment,
          player.gender,
          ...(player.subclasses ?? []),
          ...(player.traitsPositive ?? []),
          ...(player.traitsNegative ?? []),
          team?.name,
          team?.shortCode,
          roster?.teamId,
          "spieler player profil drawer",
        ].filter(Boolean).join(" "),
        run: () => {
          input.openPlayerDrawerById(player.id, roster?.id ?? null);
        },
      };
    });
    const encyclopediaCommands: FoundationCommandItem[] = GAME_ENCYCLOPEDIA_ENTRIES.map((entry) => ({
      id: `encyclopedia-${entry.id}`,
      label: entry.term,
      detail: `${entry.category} · ${entry.short}`,
      section: "Lexikon" as const,
      keywords: [entry.term, entry.category, entry.short, entry.meaning, entry.usage, ...entry.aliases, ...entry.factors].join(" "),
      tone: input.activeView === "encyclopedia" && input.selectedEncyclopediaEntryId === entry.id ? "ready" : undefined,
      run: () => input.openEncyclopediaEntry(entry.id),
    }));

    return [
      {
        id: "flow-next",
        label: input.globalNextLabel,
        detail: input.primaryInboxItem ? input.primaryInboxItem.description : input.gameFlowActionStepCta,
        section: "Flow",
        keywords: `weiter next flow leertaste ${input.globalNextLabel}`,
        tone:
          input.globalNextStatusClass === "is-blocked"
            ? "blocked"
            : input.globalNextStatusClass === "is-warning"
              ? "warning"
              : "ready",
        run: input.triggerGlobalNext,
      },
      {
        id: "lineup-open",
        label: "Einsatzliste öffnen",
        detail: "Slots, Captain und Team-Boosts",
        section: "Aktion",
        keywords: "lineup einsatzliste slots teamdeck spieler einsetzen",
        tone: input.activeView === "lineup" ? "ready" : undefined,
        run: () => input.openFoundationViewCommand("lineup"),
      },
      {
        id: "arena-open",
        label: "Arena öffnen",
        detail: "Matchday Reveal und Ergebnis",
        section: "Aktion",
        keywords: "arena matchday reveal ergebnis",
        tone: input.activeView === "matchdayArena" ? "ready" : undefined,
        run: () => input.openFoundationViewCommand("matchdayArena"),
      },
      {
        id: "market-open",
        label: "Transfermarkt öffnen",
        detail: "V2 · Kaufen, verkaufen, Wishlist",
        section: "Aktion",
        keywords: "transfermarkt markt kaufen verkaufen wishlist",
        tone: input.isTransferMarketViewActive ? "ready" : undefined,
        run: () => input.openFoundationViewCommand("market"),
      },
      {
        id: "home-open",
        label: "Home öffnen",
        detail: "Manager-Zentrale",
        section: "Aktion",
        keywords: "home dashboard manager zentrale",
        tone: input.activeView === "homeV2" ? "ready" : undefined,
        run: () => input.openFoundationViewCommand("home"),
      },
      {
        id: "inbox-decisions",
        label: "Entscheidungen",
        detail: "Inbox nach Entscheidungen filtern",
        section: "Aktion",
        keywords: "inbox entscheidungen warning task",
        tone: input.activeView === "inboxV2" && input.inboxCategoryFilter === "task" ? "ready" : undefined,
        run: () => {
          setFoundationView("inboxV2", input.setActiveView);
          input.setInboxCategoryFilter("task");
          syncFoundationViewInUrl("inboxV2", "task", null, { push: true });
        },
      },
      {
        id: "inbox-chronicle",
        label: "Chronik",
        detail: "Inbox als Chronik öffnen",
        section: "Aktion",
        keywords: "inbox chronik transfer finance training history",
        tone: input.activeView === "inboxV2" && input.inboxCategoryFilter === "ALL" ? "ready" : undefined,
        run: () => {
          setFoundationView("inboxV2", input.setActiveView);
          input.setInboxCategoryFilter("ALL");
          syncFoundationViewInUrl("inboxV2", null, null, { push: true });
        },
      },
      ...teamCommands,
      ...playerCommands,
      ...encyclopediaCommands,
      ...viewCommands,
    ];
  }, [
    input.activeManagerTeamId,
    input.activeView,
    input.gameFlowActionStepCta,
    input.gameState.players,
    input.gameState.rosters,
    input.gameState.teams,
    input.globalNextLabel,
    input.globalNextStatusClass,
    input.inboxCategoryFilter,
    input.isTransferMarketViewActive,
    input.openEncyclopediaEntry,
    input.openFoundationViewCommand,
    input.openPlayerDrawerById,
    input.openTeamDrawerById,
    input.primaryInboxItem,
    input.selectedEncyclopediaEntryId,
    input.setActiveView,
    input.setInboxCategoryFilter,
    input.triggerGlobalNext,
  ]);

  const visibleFoundationCommandItems = useMemo(() => {
    const query = input.commandSearch.trim().toLowerCase();
    if (!query) {
      return foundationCommandItems.slice(0, 14);
    }
    const tokens = query.split(/\s+/).filter(Boolean);
    return foundationCommandItems
      .map((command, index) => {
        const label = command.label.toLowerCase();
        const detail = command.detail.toLowerCase();
        const keywords = command.keywords.toLowerCase();
        const section = command.section.toLowerCase();
        const haystack = `${command.label} ${command.detail} ${command.section} ${command.keywords}`.toLowerCase();
        if (!tokens.every((token) => haystack.includes(token))) {
          return null;
        }

        const exactLabelMatch = tokens.some((token) => label === token);
        const labelStartsWith = tokens.some((token) => label.startsWith(token));
        const keywordStartsWith = tokens.some((token) =>
          keywords
            .split(/\s+/)
            .filter(Boolean)
            .some((keyword) => keyword.startsWith(token)),
        );
        const score =
          (command.section === "Lexikon" ? 1000 : 0) +
          (exactLabelMatch ? 500 : 0) +
          (labelStartsWith ? 180 : 0) +
          (keywordStartsWith ? 80 : 0) +
          (detail.includes("kennzahl") ? 20 : 0) +
          (section.includes("lexikon") ? 20 : 0) -
          index / 10000;

        return { command, score };
      })
      .filter((entry): entry is { command: FoundationCommandItem; score: number } => Boolean(entry))
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.command)
      .slice(0, 14);
  }, [foundationCommandItems, input.commandSearch]);

  return {
    foundationCommandItems,
    visibleFoundationCommandItems,
  };
}
