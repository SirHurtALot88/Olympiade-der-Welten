"use client";

/** Das große Spielerprofil über dem Draft: dünne Hülle um das gemeinsame `GrossesProfil` (siehe dort). */
import type { FoundationMarketV2ShellHostProps } from "@/app/foundation/transfermarkt-v2/FoundationMarketV2ShellHost";
import { GrossesProfil } from "@/app/foundation/shared/GrossesProfil";

export function DraftProfil({
  hostProps,
  ...rest
}: {
  hostProps: FoundationMarketV2ShellHostProps;
  playerId: string;
  darfPicken: boolean;
  onPicken: (playerId: string, name: string) => void;
  onWechsel: (playerId: string) => void;
  onZu: () => void;
}) {
  return <GrossesProfil hostProps={hostProps} {...rest} />;
}
