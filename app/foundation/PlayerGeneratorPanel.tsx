"use client";

import type {
  Discipline,
  Player,
  PlayerGeneratorDraft,
} from "@/lib/data/olyDataTypes";
import type {
  PlayerGeneratorCommitHandler,
  PlayerGeneratorTeamContext,
} from "@/lib/player-generator/player-generator-service";
import PlayerGeneratorPanelNewLook from "@/app/foundation/PlayerGeneratorPanelNewLook";

export default function PlayerGeneratorPanel({
  players,
  disciplines,
  drafts,
  teamContexts,
  activeTeamId,
  readOnly,
  readSourceLabel,
  onSaveDrafts,
  onCommitDraft,
}: {
  players: Player[];
  disciplines: Discipline[];
  drafts: PlayerGeneratorDraft[];
  teamContexts: PlayerGeneratorTeamContext[];
  activeTeamId: string | null;
  readOnly: boolean;
  readSourceLabel: string;
  onSaveDrafts: (nextDrafts: PlayerGeneratorDraft[]) => void;
  onCommitDraft?: PlayerGeneratorCommitHandler;
}) {
  return (
    <PlayerGeneratorPanelNewLook
      players={players}
      disciplines={disciplines}
      drafts={drafts}
      teamContexts={teamContexts}
      activeTeamId={activeTeamId}
      readOnly={readOnly}
      readSourceLabel={readSourceLabel}
      onSaveDrafts={onSaveDrafts}
      onCommitDraft={onCommitDraft}
    />
  );
}
