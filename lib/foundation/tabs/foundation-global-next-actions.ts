import type { Dispatch, SetStateAction } from "react";

import type { GameInboxItem, GameState } from "@/lib/data/olyDataTypes";
import type { GameFlowStepStatus } from "@/lib/foundation/game-flow-controller";
import { formatGameFlowBlockerList } from "@/lib/foundation/game-flow-blocker-labels";
import type { FoundationReadMeta } from "@/lib/foundation/tabs/foundation-page-types";
import { getGameFlowStatusClass } from "@/lib/foundation/tabs/cockpit-ui-helpers";

export type FoundationGlobalNextUiInput = {
  primaryInboxItem: GameInboxItem | null;
  gameFlowActionStep: {
    stepId?: string;
    label: string;
    status: GameFlowStepStatus;
    blockers: string[];
    optional?: boolean;
  };
  cockpitBusyKey: string | null;
  seasonTransitionBusy: boolean;
  matchdayArenaBlockerSummary: { reasons: string[] };
  transferWindowHint: { open: boolean; label: string };
};

export type FoundationGlobalNextUi = {
  globalNextDisabled: boolean;
  globalNextLabel: string;
  globalNextTitle: string;
  globalNextStatusClass: string;
};

export function deriveGlobalNextUi(input: FoundationGlobalNextUiInput): FoundationGlobalNextUi {
  const globalNextDisabled = input.primaryInboxItem
    ? false
    : input.gameFlowActionStep.status === "applying" ||
      input.cockpitBusyKey != null ||
      input.seasonTransitionBusy;
  const globalNextLabel = input.primaryInboxItem?.title ?? input.gameFlowActionStep.label;
  const globalNextTitle = input.primaryInboxItem
    ? `${input.primaryInboxItem.title}: ${input.primaryInboxItem.description}`
    : input.gameFlowActionStep.status === "blocked"
      ? formatGameFlowBlockerList(
          input.matchdayArenaBlockerSummary.reasons.length > 0
            ? input.matchdayArenaBlockerSummary.reasons
            : input.gameFlowActionStep.blockers,
        ) || "Leertaste: zum blockierten Schritt springen"
      : globalNextDisabled
        ? "Aktion läuft gerade."
        : input.gameFlowActionStep.status === "optional" &&
            (input.gameFlowActionStep.stepId === "matchday_facilities" || input.gameFlowActionStep.stepId === "facilities")
          ? "Leertaste: optional prüfen oder überspringen"
          : input.transferWindowHint.open
          ? `Leertaste: Weiter · ${input.transferWindowHint.label}`
          : "Leertaste: Weiter";
  const globalNextStatusClass = input.primaryInboxItem
    ? input.primaryInboxItem.severity === "critical"
      ? "is-blocked"
      : input.primaryInboxItem.severity === "warning"
        ? "is-warning"
        : "is-ready"
    : getGameFlowStatusClass(input.gameFlowActionStep.status);

  return {
    globalNextDisabled,
    globalNextLabel,
    globalNextTitle,
    globalNextStatusClass,
  };
}

export type UpdateInboxItemStatusDeps = {
  readMeta: FoundationReadMeta;
  showReadOnlyNotice: () => void;
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;
  activeSaveId: string;
  /**
   * Der Rueckgabewert wird bewusst NICHT festgelegt: die gelebte Fassung im Shell liefert den
   * gespeicherten `GameState` zurueck und nimmt ausserdem Optionen entgegen. Hier stand
   * `Promise<void>` — eine engere Zusage, als der Aufrufer einhaelt. Gebraucht wird nur, dass es
   * ein Promise ist, an das ein `catch` passt.
   */
  persistLocalGameStateImmediately: (nextGameState: GameState) => Promise<unknown>;
};

export function createUpdateInboxItemStatus(deps: UpdateInboxItemStatusDeps) {
  return (item: GameInboxItem, status: GameInboxItem["status"]) => {
    if (deps.readMeta.readOnly) {
      deps.showReadOnlyNotice();
      return;
    }

    const existingItems = deps.gameState.gameInboxItems ?? [];
    const hasStoredItem = existingItems.some((entry) => entry.itemId === item.itemId);
    const nextItems = hasStoredItem
      ? existingItems.map((entry) => (entry.itemId === item.itemId ? { ...entry, status } : entry))
      : [...existingItems, { ...item, status }];
    const nextGameState = {
      ...deps.gameState,
      gameInboxItems: nextItems,
    };

    deps.setGameState(nextGameState);
    if (deps.readMeta.source !== "prisma" && !deps.readMeta.readOnly && deps.activeSaveId !== "loading-save") {
      void deps.persistLocalGameStateImmediately(nextGameState).catch((error) => {
        console.error(error);
      });
    }
  };
}

/*
 * HIER STANDEN `TriggerGlobalNextDeps` UND `createTriggerGlobalNext` — ENTFERNT.
 *
 * Nicht weil sie doppelt waren, sondern weil sie VERALTET waren. Die gelebte Fassung in
 * `use-foundation-shell-router-body-scope.tsx` ist der hier geloeschten um drei Korrekturen
 * voraus, die dort ausfuehrlich begruendet stehen:
 *
 *   1. Sie fragte roh `status === "ready"` ab statt `canAdvanceMatchdayFromStep`. Ein Team mit
 *      gerissenen Board-Zielen (Status "warning") kam ueber diesen Weg nicht weiter.
 *   2. Sie rief `runCockpitMatchdayAdvance` direkt auf — ohne das Lebenszeichen beim Klick und
 *      ohne die Ablehnungsgruende, die `finishMatchdayAndAdvance` zusammentraegt.
 *   3. Sie wechselte danach nicht in den Saisonstand; der Arena-Knopf schon. Derselbe Abschluss
 *      liess einen also je nach angeklicktem Knopf woanders stehen.
 *
 * Dazu fehlten ihr `canJumpToArenaAfterLineupSave` (Online-Spiel: die Arena zeigt den Spieltag
 * ALLER Teams) und der Zweig fuer `finalize_transfers`.
 *
 * Sie zu verdrahten haette also nicht aufgeraeumt, sondern drei behobene Fehler wieder
 * eingeschleppt — und niemand haette es gemerkt, weil der Vertragstest die Datei nur als TEXT
 * liest. Genau das ist Befund A3 aus `docs/AUDIT-INGAME-2026-08-19.md`.
 *
 * Die beiden Funktionen oben sind dagegen wortgleich mit dem, was lief; sie sind jetzt
 * verdrahtet statt kopiert.
 */
