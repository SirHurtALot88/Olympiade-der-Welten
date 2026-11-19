"use client";

/**
 * GROSSES SPIELERPROFIL ÜBER DEM DRAFT (19.11., Chris: „ich meine das große spielerprofil wo man seine diszis sieht und wie
 * gut er ungefähr ist“). Es ist DIESELBE Komponente wie die Profilseite (`SpielerprofilSeite`, Neubau nach Mockup #1586) mit
 * denselben Daten (`buildHydratedPlayerDrawerData`, wie Kader und Transfermarkt sie holen) — nur als Overlay statt als
 * Ansichtswechsel: die Draft-Seite bleibt stehen, Schließen bringt exakt zurück, nichts wird abgebrochen. Der Scouting-Nebel
 * gilt im Profil selbst (unscharfe Spannen statt exakter Werte). Vertragsaktionen (Verlängern/Verkaufen) gibt es im Draft nicht;
 * stattdessen steht oben „Verhandeln“, wenn man am Zug ist.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { isScoutingNebelAus } from "@/lib/market/transfermarkt-nebel-einstellung";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { PLAYER_PROFILE_TABS, type PlayerProfileTabId } from "@/lib/foundation/player-profile-service";
import type { FoundationMarketV2ShellHostProps } from "@/app/foundation/transfermarkt-v2/FoundationMarketV2ShellHost";

const SpielerprofilSeite = dynamic(() => import("@/app/foundation/spielerprofil/SpielerprofilSeite"), { ssr: false, loading: () => null });

export function DraftProfil({
  hostProps,
  playerId,
  darfPicken,
  onPicken,
  onWechsel,
  onZu,
}: {
  hostProps: FoundationMarketV2ShellHostProps;
  playerId: string;
  darfPicken: boolean;
  onPicken: (playerId: string, name: string) => void;
  onWechsel: (playerId: string) => void;
  onZu: () => void;
}) {
  const { gameState, activeSaveId } = hostProps;
  const nebelAus = isScoutingNebelAus(gameState);
  const [geladen, setGeladen] = useState<{ id: string; data: PlayerDetailDrawerData } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [tab, setTab] = useState<PlayerProfileTabId>("overview");
  const [startDisziplin, setStartDisziplin] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      try {
        const { buildHydratedPlayerDrawerData } = await import("@/lib/foundation/build-hydrated-player-drawer-data");
        const data = await buildHydratedPlayerDrawerData({
          gameState,
          playerId,
          activePlayerId: null,
          source: hostProps.readMetaSource,
          manageableTeamIds: [...hostProps.foundationManageableTeamIds],
          saveId: activeSaveId,
          // Dieselbe Sichtstufe wie das Brett (19.11.): der globale Entwickler-Schalter zeigt sonst jeden Spieler exakt. Ein Spieler
          // des eigenen Teams bleibt exakt (die Sichtregel kennt ihn), ebenso bei ausgeschaltetem Nebel.
          fogErzwingen: !nebelAus,
        });
        if (abgebrochen) return;
        if (data) {
          setFehler(null);
          setGeladen({ id: playerId, data });
        } else setFehler("Der Spieler konnte nicht geladen werden.");
      } catch {
        if (!abgebrochen) setFehler("Der Spieler konnte nicht geladen werden.");
      }
    })();
    return () => {
      abgebrochen = true;
    };
    // Beim Öffnen laden, nicht bei jedem Draft-Tick (wie das Kurzprofil).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  useEffect(() => {
    function beiTaste(e: KeyboardEvent) {
      if (e.key === "Escape") onZu();
    }
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
  }, [onZu]);

  const data = geladen && geladen.id === playerId ? geladen.data : null;
  return (
    <div className="drf-profil" role="dialog" aria-modal="true" aria-label="Spielerprofil" data-testid="draft-profil">
      <div className="drf-profil-leiste">
        <button type="button" className="knopf" onClick={onZu} data-testid="draft-profil-zu">← Zurück zum Draft</button>
        {darfPicken ? (
          <button
            type="button"
            className="knopf haupt"
            onClick={() => {
              onZu();
              onPicken(playerId, data?.name ?? "Spieler");
            }}
            data-testid="draft-profil-picken"
          >
            Picken · Draft-Vertrag 1 Saison, Gehalt wie angezeigt
          </button>
        ) : (
          <small>Du bist gerade nicht am Zug.</small>
        )}
        {/* Reiter des Profils: im App-Profil stehen sie im Band der Shell, hier gehört das Band dem Draft — eigene kleine Leiste. */}
        <nav className="drf-profil-reiter" aria-label="Profil-Reiter" data-testid="draft-profil-reiter">
          {PLAYER_PROFILE_TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? "an" : ""} onClick={() => setTab(t.id)} data-testid={`draft-profil-reiter-${t.id}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="drf-profil-koerper">
        {data ? (
          <SpielerprofilSeite
            key={data.playerId}
            data={data}
            activeTab={tab}
            onTabChange={setTab}
            onNavigatePlayer={onWechsel}
            ownerId={hostProps.effectiveActiveOwnerId}
            startDisziplin={startDisziplin}
            onStartDisziplin={setStartDisziplin}
            training={{ row: null, modeOptions: [], classOptions: [], readOnly: true }}
            aktionen={{ darfHandeln: false, grundGesperrt: "Im Draft gibt es nur den Pick — Der Draft-Vertrag läuft 1 Saison, Gehalt wie angezeigt." }}
          />
        ) : (
          <div className="drf-leerzeile">{fehler ?? "Spielerprofil wird geladen …"}</div>
        )}
      </div>
    </div>
  );
}
