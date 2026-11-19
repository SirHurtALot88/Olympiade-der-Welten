import { createRoot } from "react-dom/client";
import { useMemo, useState } from "react";

import AllTimeTableClient from "@/app/foundation/all-time-table-v2/AllTimeTableClient";
import FoundationSeasonArchiveHost from "@/app/foundation/historie/FoundationSeasonArchiveHost";
import TransferHistoryV2Client from "@/app/foundation/transfer-history-v2/TransferHistoryV2Client";
import { FoundationBandSlotProvider, FoundationBandSlotTarget } from "@/app/foundation/shell/foundation-band-slot";
import { buildAllTimeTableModel } from "@/lib/foundation/all-time-table";
import { DEALS, EIGEN, GAME_STATE, QUELLEN, SPIELER, TEAMS } from "./daten";

function Pruefstand() {
  const seite = new URLSearchParams(location.search).get("seite") ?? "archiv";
  const [ansicht, setAnsicht] = useState(seite);
  const [saison, setSaison] = useState("season-4");
  const [team, setTeam] = useState("ALL");
  const [typ, setTyp] = useState("ALL");
  const [klasse, setKlasse] = useState("ALL");
  const [quelle, setQuelle] = useState("ALL");
  const [suche, setSuche] = useState("");
  const zeilen = useMemo(
    () =>
      DEALS.filter((deal) => {
        const fenster = deal.seasonLabel;
        const passtSaison = saison === "__ALL_SEASONS__" || fenster === `Season ${saison.replace("season-", "")}`;
        return passtSaison && (typ === "ALL" || deal.type === typ) && (klasse === "ALL" || deal.className === klasse) && (quelle === "ALL" || deal.sourceLabel === quelle) && (!suche || deal.playerName.toLowerCase().includes(suche.toLowerCase()));
      }),
    [saison, typ, klasse, quelle, suche],
  );
  const modell = useMemo(() => buildAllTimeTableModel({ gameState: GAME_STATE, selectedTeamId: EIGEN }), []);
  const wechsel = (reiter: "archiv" | "transfers" | "ewig", seasonId?: string) => {
    if (reiter === "transfers" && seasonId) setSaison(seasonId);
    setAnsicht(reiter);
  };
  const basis = { gameState: GAME_STATE, ownTeamId: EIGEN, onOpenTeam: () => {}, onWechsel: wechsel, onOpenSaisonstand: () => {} };
  const breakdown = new Map<string, number>();
  for (const deal of DEALS) breakdown.set(deal.seasonLabel, (breakdown.get(deal.seasonLabel) ?? 0) + 1);
  const teamOptions = TEAMS;
  return (
    <FoundationBandSlotProvider>
      <div className="pr-band">
        <div className="pr-ort">
          <small>WELT · GEDÄCHTNIS DER LIGA</small>
          <b>Historie</b>
        </div>
        <nav className="pr-reiter">
          {(["archiv", "transfers", "ewig"] as const).map((id) => (
            <button key={id} className={ansicht === id ? "an" : ""} onClick={() => setAnsicht(id)}>
              {id === "archiv" ? "SAISON-ARCHIV" : id === "transfers" ? "TRANSFERS" : "EWIGE TABELLE"}
            </button>
          ))}
        </nav>
        <FoundationBandSlotTarget />
        <div className="pr-hinweis">Prüfstand: Band nachgebaut, Seite echt</div>
      </div>
      <div className="pr-inhalt">
        {ansicht === "archiv" ? <FoundationSeasonArchiveHost {...basis} /> : null}
        {ansicht === "ewig" ? <AllTimeTableClient {...basis} model={modell} selectedTeamId={EIGEN} seasonLabel="Season 4" /> : null}
        {ansicht === "transfers" ? (
          <TransferHistoryV2Client
            {...basis}
            sourceBadgeLabel=""
            saveName="Prüfstand"
            requestedScopeLabel=""
            resolvedScopeLabel=""
            totalLoaded={DEALS.length}
            totalAvailable={DEALS.length}
            seasonBreakdown={[...breakdown.entries()]}
            summary={{ count: zeilen.length, buyFee: 0, sellFee: 0, averageFee: null, averageProfit: null, netTransferBalance: 0, kaderaufbauNet: null }}
            filteredRows={zeilen}
            visibleRows={zeilen}
            historyVisibleRangeLabel=""
            isAllSeasons={saison === "__ALL_SEASONS__"}
            historyPage={1}
            historyPageCount={1}
            onPrevPage={() => {}}
            onNextPage={() => {}}
            seasonFilter={saison}
            allSeasonsValue="__ALL_SEASONS__"
            seasonOptions={[]}
            teamFilter={team}
            teamOptions={teamOptions}
            typeFilter={typ}
            classFilter={klasse}
            sourceFilter={quelle}
            classOptions={[...new Set(SPIELER.map((s) => s.className))].sort().slice(0, 14)}
            sourceOptions={[...new Set(QUELLEN)].map((q) => ({ key: q, label: q }))}
            search={suche}
            onSeasonFilterChange={setSaison}
            onTeamFilterChange={setTeam}
            onTypeFilterChange={setTyp}
            onClassFilterChange={setKlasse}
            onSourceFilterChange={setQuelle}
            onSearchChange={setSuche}
            onResetFilters={() => {}}
            onOpenPlayer={() => {}}
          />
        ) : null}
      </div>
    </FoundationBandSlotProvider>
  );
}

createRoot(document.getElementById("wurzel")!).render(<Pruefstand />);
