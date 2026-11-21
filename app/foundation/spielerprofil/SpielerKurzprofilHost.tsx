"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { useFoundationStateOptional } from "@/lib/foundation/foundation-state-context";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import type { PlayerProfileTabId } from "@/lib/foundation/player-profile-service";
import type { TransfermarktSellPreviewSubject } from "@/lib/foundation/tabs/use-market-sell-derivations";
import { schliesseSpielerKurzprofil, useSpielerKurzprofilAnfrage } from "@/lib/foundation/spieler-kurzprofil-store";
import { baueVertragsAktionen } from "./vertrags-aktionen";

const SpielerKurzprofil = dynamic(() => import("./SpielerKurzprofil"), { ssr: false, loading: () => null });

export type SpielerKurzprofilHostProps = {
  manageableTeamIds: readonly string[];
  ownerId?: string | null;
  saveId?: string | null;
  openPlayerProfileById: (
    playerId: string,
    activePlayerId?: string | null,
    optionen?: { tab?: PlayerProfileTabId; push?: boolean },
  ) => void | Promise<void>;
  openContractRenewalNegotiation?: (angaben: { teamId: string; playerId: string; playerName: string; contractLength?: number | null }) => void | Promise<void>;
  openMarketSellPeek?: (subject: TransfermarktSellPreviewSubject, teamId?: string) => void | Promise<void>;
  /** Wird beim Wechsel der Disziplin im vollen Profil vorgewählt. */
  onStartDisziplin?: (disziplinId: string | null) => void;
};

/**
 * Zeichnet das Kurzprofil, wenn eine Liste `openPlayerDrawerById` gerufen hat. Holt die Spielerdaten wie die Seite
 * (`buildHydratedPlayerDrawerData`), damit Drawer und Seite dieselben Zahlen zeigen.
 */
export default function SpielerKurzprofilHost({
  manageableTeamIds,
  ownerId,
  saveId,
  openPlayerProfileById,
  openContractRenewalNegotiation,
  openMarketSellPeek,
  onStartDisziplin,
}: SpielerKurzprofilHostProps) {
  const anfrage = useSpielerKurzprofilAnfrage();
  const kontext = useFoundationStateOptional();
  const [geladen, setGeladen] = useState<{ schluessel: string; data: PlayerDetailDrawerData } | null>(null);
  const gameState = kontext?.gameState ?? null;
  const quelle = kontext?.readMeta.source ?? "sqlite";
  const nurLesen = kontext?.readMeta.readOnly ?? true;
  const schluessel = anfrage ? `${anfrage.playerId}::${anfrage.activePlayerId ?? ""}` : null;

  useEffect(() => {
    if (!anfrage || !schluessel || !gameState) return undefined;
    let abgebrochen = false;
    void (async () => {
      try {
        const { buildHydratedPlayerDrawerData } = await import("@/lib/foundation/build-hydrated-player-drawer-data");
        const data = await buildHydratedPlayerDrawerData({
          gameState,
          playerId: anfrage.playerId,
          activePlayerId: anfrage.activePlayerId,
          source: quelle,
          manageableTeamIds: [...manageableTeamIds],
          saveId: saveId ?? null,
        });
        if (!abgebrochen && data) setGeladen({ schluessel, data });
      } catch (fehler) {
        console.warn("Kurzprofil konnte nicht geladen werden.", fehler);
      }
    })();
    return () => {
      abgebrochen = true;
    };
    // gameState bewusst nicht in den Abhängigkeiten: das Kurzprofil lädt beim Öffnen, nicht bei jedem Tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);

  const data = geladen && geladen.schluessel === schluessel ? geladen.data : null;
  const aktionen = useMemo(
    () =>
      data
        ? baueVertragsAktionen({
            data,
            gameState,
            readOnly: nurLesen,
            manageableTeamIds,
            openRenewal: openContractRenewalNegotiation,
            openSell: openMarketSellPeek,
            nachAktion: schliesseSpielerKurzprofil,
          })
        : null,
    [data, gameState, nurLesen, manageableTeamIds, openContractRenewalNegotiation, openMarketSellPeek],
  );

  if (!anfrage || !data || !aktionen) return null;
  return (
    <SpielerKurzprofil
      data={data}
      ownerId={ownerId}
      manageableTeamIds={manageableTeamIds}
      aktionen={aktionen}
      onClose={schliesseSpielerKurzprofil}
      onOpenFull={(tab, disziplinId) => {
        schliesseSpielerKurzprofil();
        onStartDisziplin?.(disziplinId ?? null);
        void openPlayerProfileById(data.playerId, data.activePlayerId, { tab: tab ?? "overview", push: true });
      }}
    />
  );
}
