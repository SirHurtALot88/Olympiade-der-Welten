import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { GameInboxItem, GameState, Team } from "@/lib/data/olyDataTypes";
import { formatCockpitReason } from "@/lib/foundation/tabs/cockpit-ui-helpers";
import type { FoundationReadMeta, FoundationScreenPrimaryAction, FoundationView } from "@/lib/foundation/tabs/foundation-page-types";

type SeasonTransitionGateSnapshot = {
  canCompleteSeason: boolean;
};

export function useFoundationCrossTabScreenPrimaryAction(input: {
  activeView: FoundationView;
  activeManagerMatchdayReady: boolean;
  activeManagerArenaBlockerReason: string | null;
  gameState: GameState;
  readMeta: FoundationReadMeta;
  localSeasonTransitionGate: SeasonTransitionGateSnapshot;
  marketTeamId: string | null;
  marketBuyBusy: boolean;
  marketPreviewPlayer: { playerId: string; name: string } | null;
  marketSelectedTeam: Team | null;
  selectedTeam: Team | null;
  selectedTeamCanManage: boolean;
  selectedTeamHasUnsavedChanges: boolean;
  isSelectedTeamManagementLocked: boolean;
  inboxPrimaryTeamItem: GameInboxItem | null;
  canManageTeamId: (teamId: string | null | undefined) => boolean;
  setFoundationView: (view: FoundationView, setActiveView: Dispatch<SetStateAction<FoundationView>>) => void;
  setActiveView: Dispatch<SetStateAction<FoundationView>>;
  navigateHomeTab: (tab: "overview" | "office") => void;
  navigateToInboxItem: (item: GameInboxItem) => void;
  openMarketOfferPanel: (playerId: string) => void;
}) {
  const shouldShowArenaBackToLineup = !input.activeManagerMatchdayReady;

  const seasonEndRosterActionsActive = useMemo(() => {
    const phase = input.gameState.gamePhase ?? "season_active";
    const sellWindowPhases = new Set([
      "season_completed",
      "season_review",
      "season_rewards",
      "player_development",
      "preseason_management",
      "transfer_sell_phase",
    ]);
    return sellWindowPhases.has(phase) || (phase === "season_active" && input.localSeasonTransitionGate.canCompleteSeason);
  }, [input.gameState.gamePhase, input.localSeasonTransitionGate.canCompleteSeason]);

  const selectedTeamRosterActionsAvailable =
    seasonEndRosterActionsActive && input.selectedTeamCanManage && !input.readMeta.readOnly;

  const selectedTeamRosterActionHint = !input.selectedTeam
    ? null
    : input.readMeta.readOnly
      ? "Nur Ansicht: In diesem Modus kannst du Kader, Verträge und Verkaufspreise prüfen, aber nichts schreiben."
      : !input.selectedTeamCanManage
        ? `${input.selectedTeam.name} ist nicht dein steuerbares Team. Anschauen ja, Kaufen/Verkaufen/Verlängern nein.`
        : seasonEndRosterActionsActive
          ? "Season-End-Phase aktiv: Verkaufen ist freigegeben, auslaufende Verträge können verlängert werden."
          : "Verkaufen und Verlängern öffnen erst am Season-End. Während der laufenden Season bleibt der Kader gesperrt.";

  const screenPrimaryAction = useMemo<FoundationScreenPrimaryAction | null>(() => {
    if (input.activeView === "homeV2") {
      return null;
    }

    if (input.activeView === "lineup") {
      return null;
    }

    if (input.activeView === "matchdayArena") {
      if (shouldShowArenaBackToLineup) {
        return {
          kicker: "Hauptaktion",
          title:
            input.activeManagerArenaBlockerReason === "lineup_not_submitted"
              ? "Einsatzliste bestätigen"
              : "Erst Einsatzliste schließen",
          detail:
            input.activeManagerArenaBlockerReason != null
              ? formatCockpitReason(input.activeManagerArenaBlockerReason)
              : "Die Arena ist lesbar, aber der Spieltag ist noch nicht sauber vorbereitet.",
          status: "blockiert",
          buttonLabel:
            input.activeManagerArenaBlockerReason === "lineup_not_submitted" ? "Lineup bestätigen" : "Zur Einsatzliste",
          onClick: () => input.setFoundationView("lineup", input.setActiveView),
        };
      }
      return {
        kicker: "Hauptaktion",
        title: "Saisonstand lesen",
        detail: "Nach dem Reveal direkt sehen, wie sich Rang, Punkte und Druck verschoben haben.",
        status: "bereit",
        buttonLabel: "Saisonstand öffnen",
        onClick: () => input.setFoundationView("seasonV2", input.setActiveView),
      };
    }

    if (input.activeView === "marketV2") {
      const marketTeamLocked = input.marketSelectedTeam ? !input.canManageTeamId(input.marketSelectedTeam.teamId) : false;
      const selectedCandidate = input.marketPreviewPlayer;
      const disabledReason =
        !input.marketTeamId
          ? "Waehle erst ein Team, damit Budget, Kaderdruck und Verhandlung fuer dieses Team berechnet werden."
          : marketTeamLocked
            ? `${input.marketSelectedTeam?.name ?? "Dieses Team"} ist hier nur Ansicht. Deals gehen nur mit steuerbaren Teams.`
            : !selectedCandidate
              ? "Waehle links erst einen Kandidaten aus der Liste aus."
              : input.marketBuyBusy
                ? "Deal wird gerade vorbereitet."
                : null;
      return {
        kicker: "Hauptaktion",
        title: selectedCandidate ? `${selectedCandidate.name} prüfen` : "Deal vorbereiten",
        detail: selectedCandidate
          ? "Vertragsangebot mit Forderung, Vertrag und Teamwirkung öffnen."
          : "Links Kandidat wählen, dann Vertrag und Folgen sauber prüfen.",
        status: disabledReason ? "blockiert" : "bereit",
        buttonLabel: selectedCandidate ? "Vertragsangebot öffnen" : "Kandidat wählen",
        onClick: () => {
          if (selectedCandidate) {
            if (input.activeView !== "marketV2") {
              input.setFoundationView("marketV2", input.setActiveView);
            }
            input.openMarketOfferPanel(selectedCandidate.playerId);
          }
        },
        disabled: Boolean(disabledReason),
        disabledReason,
      };
    }

    if (input.activeView === "teams") {
      return {
        kicker: "Hauptaktion",
        title: "Kader aus Einsatzsicht prüfen",
        detail: "Von hier aus entweder den nächsten Engpass schließen oder direkt Training und Markt nachschärfen.",
        status: input.isSelectedTeamManagementLocked ? "optional" : "bereit",
        buttonLabel: input.isSelectedTeamManagementLocked ? "Nur ansehen" : "Einsatzliste öffnen",
        onClick: () => {
          if (!input.isSelectedTeamManagementLocked) {
            input.setFoundationView("lineup", input.setActiveView);
          }
        },
        disabled: input.isSelectedTeamManagementLocked,
        disabledReason: input.isSelectedTeamManagementLocked
          ? `${input.selectedTeam?.name ?? "Dieses Team"} ist hier nur Ansicht. Du kannst lesen, aber nicht steuern.`
          : null,
      };
    }

    if (input.activeView === "trainingV2" || input.activeView === "trainingCompact" || input.activeView === "training") {
      return {
        kicker: "Hauptaktion",
        title: "Entwicklung in Einsatz übersetzen",
        detail: "Training ist kein Selbstzweck. Danach sofort prüfen, ob Slots, Captain oder Markt jetzt besser aussehen.",
        status: input.selectedTeamCanManage ? "bereit" : "optional",
        buttonLabel: input.selectedTeamCanManage ? "Zur Einsatzliste" : "Nur ansehen",
        onClick: () => {
          if (input.selectedTeamCanManage) {
            input.setFoundationView("lineup", input.setActiveView);
          }
        },
        disabled: !input.selectedTeamCanManage,
        disabledReason: !input.selectedTeamCanManage
          ? `${input.selectedTeam?.name ?? "Dieses Team"} ist hier nur Ansicht. Training lässt sich nur bei steuerbaren Teams ändern.`
          : null,
      };
    }

    if (input.activeView === "season" || input.activeView === "seasonV2") {
      return {
        kicker: "Hauptaktion",
        title: "Nächste Ursache aufklären",
        detail: "Wenn ein Rang oder Faktor auffällt, geh von hier direkt in HQ oder Teamprofil und klär den Treiber.",
        status: "bereit",
        buttonLabel: "Office öffnen",
        onClick: () => input.navigateHomeTab("office"),
      };
    }

    if (input.activeView === "players") {
      return {
        kicker: "Hauptaktion",
        title: "Spieler konkret prüfen",
        detail: "Von hier aus erst Leistung lesen, dann Training oder Markt öffnen. Nicht jeder hohe OVR hilft dir sofort im Spieltag.",
        status: "bereit",
        buttonLabel: "Training öffnen",
        onClick: () => input.setFoundationView("trainingCompact", input.setActiveView),
      };
    }

    if (input.activeView === "inboxV2" || input.activeView === "inbox") {
      return {
        kicker: "Hauptaktion",
        title: input.inboxPrimaryTeamItem ? input.inboxPrimaryTeamItem.title : "Zur Manager-Zentrale",
        detail:
          input.inboxPrimaryTeamItem?.description ??
          "Wenn hier nichts Kritisches liegt, geht es zurück in HQ für Markt, Kaderdruck und die nächsten Saison-Schritte.",
        status: input.inboxPrimaryTeamItem ? "offen" : "optional",
        buttonLabel: input.inboxPrimaryTeamItem ? "Hinweis öffnen" : "Office öffnen",
        onClick: () => {
          if (input.inboxPrimaryTeamItem) {
            input.navigateToInboxItem(input.inboxPrimaryTeamItem);
            return;
          }
          input.navigateHomeTab("office");
        },
      };
    }

    if (input.activeView === "teamSettings") {
      return {
        kicker: "Hauptaktion",
        title: input.selectedTeamHasUnsavedChanges ? "Teamprofil sichern" : "Danach in die Einsatzliste",
        detail: input.selectedTeamHasUnsavedChanges
          ? "Kontrolle, Identität und Strategie erst speichern, damit Markt, HQ und Einsatzliste mit denselben Annahmen arbeiten."
          : "Wenn Team-DNA und Steuerung passen, wird sie erst im Matchday-Flow wirklich relevant.",
        status: input.selectedTeamHasUnsavedChanges ? "offen" : "bereit",
        buttonLabel: input.selectedTeamHasUnsavedChanges ? "Änderungen prüfen" : "Einsatzliste öffnen",
        onClick: () => {
          if (!input.selectedTeamHasUnsavedChanges) {
            input.setFoundationView("lineup", input.setActiveView);
          }
        },
        disabled: input.selectedTeamHasUnsavedChanges,
        disabledReason: input.selectedTeamHasUnsavedChanges
          ? "Es gibt noch ungespeicherte Team-Änderungen. Erst sichern oder bewusst verwerfen."
          : null,
      };
    }

    if (input.activeView === "prize") {
      return {
        kicker: "Hauptaktion",
        title: "Eigenes Team zuerst lesen",
        detail: "Von hier aus erst Forecast und Faktor deines Teams prüfen, dann auf Saisonstand oder HQ zurückspringen.",
        status: "bereit",
        buttonLabel: "Saisonstand öffnen",
        onClick: () => input.setFoundationView("seasonV2", input.setActiveView),
      };
    }

    return null;
  }, [
    input.activeManagerArenaBlockerReason,
    input.activeView,
    input.inboxPrimaryTeamItem,
    input.isSelectedTeamManagementLocked,
    input.marketBuyBusy,
    input.marketPreviewPlayer,
    input.marketSelectedTeam,
    input.marketTeamId,
    input.navigateHomeTab,
    input.navigateToInboxItem,
    input.openMarketOfferPanel,
    input.selectedTeam,
    input.selectedTeamCanManage,
    input.selectedTeamHasUnsavedChanges,
    input.setActiveView,
    input.setFoundationView,
    shouldShowArenaBackToLineup,
  ]);

  const readOnlyBannerMessage = useMemo(() => {
    if (input.readMeta.readOnly) {
      return "Nur Ansicht: Dieser Spielstand ist gerade nicht schreibbar. Anschauen ja, steuern nein.";
    }
    if (input.isSelectedTeamManagementLocked && input.selectedTeam) {
      return `Nur Ansicht: ${input.selectedTeam.name} gehoert nicht zu deinen steuerbaren Teams. Anschauen ja, steuern nein.`;
    }
    return null;
  }, [input.isSelectedTeamManagementLocked, input.readMeta.readOnly, input.selectedTeam]);

  return {
    shouldShowArenaBackToLineup,
    seasonEndRosterActionsActive,
    selectedTeamRosterActionsAvailable,
    selectedTeamRosterActionHint,
    screenPrimaryAction,
    readOnlyBannerMessage,
  };
}
