import type { GameState } from "@/lib/data/olyDataTypes";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import type { TransfermarktSellPreviewSubject } from "@/lib/foundation/tabs/use-market-sell-derivations";
import type { VertragsAktionen } from "./TabVertrag";

/**
 * Verlängern und Verkaufen aus dem Profil: dieselben Wege wie in der Teamansicht (Verhandlungsfenster, Verkaufs-Einschätzung),
 * nur hier aufgerufen. Handeln darf, wer das Team steuert und nicht im Lesemodus ist (wie `canManageTeamId` der Shell).
 */
export function baueVertragsAktionen(eingabe: {
  data: PlayerDetailDrawerData;
  gameState: GameState | null;
  readOnly: boolean;
  manageableTeamIds: readonly string[];
  openRenewal?: (angaben: { teamId: string; playerId: string; playerName: string; contractLength?: number | null }) => void | Promise<void>;
  openSell?: (subject: TransfermarktSellPreviewSubject, teamId?: string) => void | Promise<void>;
  nachAktion?: () => void;
}): VertragsAktionen {
  const { data, gameState, readOnly, manageableTeamIds } = eingabe;
  const teamId = data.teamId;
  const steuerbar = Boolean(teamId && manageableTeamIds.includes(teamId));
  const darfHandeln = steuerbar && !readOnly && eingabe.openRenewal != null;
  const grund = !teamId
    ? "Vertragslos: es gibt keinen Vertrag zu verhandeln."
    : readOnly
      ? "Schreibgeschützt: Vertragsaktionen sind gesperrt."
      : !steuerbar
        ? `${data.teamName ?? "Dieses Team"} gehört nicht zu deinen steuerbaren Teams.`
        : null;
  return {
    darfHandeln,
    grundGesperrt: grund,
    onVerlaengern: darfHandeln
      ? () => {
          eingabe.nachAktion?.();
          void eingabe.openRenewal?.({
            teamId: teamId as string,
            playerId: data.playerId,
            playerName: data.name,
            contractLength: data.contractLength,
          });
        }
      : undefined,
    onVerkaufen:
      darfHandeln && eingabe.openSell
        ? () => {
            const rosterId =
              data.activePlayerId ??
              gameState?.rosters.find((eintrag) => eintrag.playerId === data.playerId && eintrag.teamId === teamId)?.id ??
              data.playerId;
            eingabe.nachAktion?.();
            void eingabe.openSell?.(
              {
                activePlayerId: rosterId,
                playerId: data.playerId,
                playerName: data.name,
                className: data.className ?? "—",
                race: data.race ?? "—",
                portraitUrl: data.portraitUrl,
              },
              teamId as string,
            );
          }
        : undefined,
  };
}
