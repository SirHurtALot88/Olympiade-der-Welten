"use client";

import { Fragment, useMemo, useState } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import type { TransferHistoryV2ClientProps, TransferHistoryV2Row } from "@/app/foundation/transfer-history-v2/TransferHistoryV2Client";
import type { GameState } from "@/lib/data/olyDataTypes";
import { baueTeamVerlauf } from "@/lib/foundation/historie-modern";
import {
  bilanzJeTeam,
  dealArt,
  dealsAlsCsv,
  fensterNummer,
  trenneKaderaufbau,
  fensterKennzahlenAusHistorie,
  type FensterKennzahlen,
  zeitText,
  type DealArt,
} from "@/lib/foundation/historie-transfers";

import { useHistorieDaten, type HistorieHostBasis } from "./HistorieArchiv";
import HistorieBlatt, { type HistorieBlattDeal } from "./HistorieBlatt";
import HistorieZeitleiste, { ZEITLEISTE_ALLE, baueZeitleistenGlieder } from "./HistorieZeitleiste";
import { Cv, HistorieBandKpis, HistorieSeite, Seg, ThZeile, Wappen, fmtC, fmtVz } from "./historie-bits";

export type HistorieTransfersProps = TransferHistoryV2ClientProps & {
  gameState: GameState;
  onWechsel: HistorieHostBasis["onWechsel"];
  onOpenSaisonstand: () => void;
};

type Sortierung = "zeit" | "abl" | "geh" | "mw" | "guv";
type Hoehepunkte = "kauf" | "verkauf" | "guv";
type TeamSortierung = "vol" | "ein" | "net";

const ART_TEXT: Record<DealArt, [string, string]> = { kauf: ["Kauf", "g"], verkauf: ["Verkauf", "go"], abgang: ["Abgang", "w"] };
const DEAL_COLS = "4.5rem minmax(0,1fr) 5.2rem 10.6rem 4.7rem 4rem 4.4rem 4.9rem 7.4rem";
const KADER_COLS = "3.2rem minmax(0,1fr) 13rem 5rem 4.4rem 4.8rem 5.4rem";

function Portrait({ url, klein = true, name }: { url: string | null; klein?: boolean; name: string }) {
  return (
    <OptimizedMediaImage
      src={url}
      alt={name}
      className={klein ? "ptr k" : "ptr g"}
      loading="lazy"
      fallbackLabel={name.slice(0, 2).toUpperCase()}
    />
  );
}

export default function HistorieTransfers(props: HistorieTransfersProps) {
  const {
    gameState,
    ownTeamId,
    filteredRows,
    teamOptions,
    seasonFilter,
    allSeasonsValue,
    onSeasonFilterChange,
    teamFilter,
    onTeamFilterChange,
    typeFilter,
    onTypeFilterChange,
    classFilter,
    onClassFilterChange,
    classOptions,
    sourceFilter,
    onSourceFilterChange,
    sourceOptions,
    search,
    onSearchChange,
    seasonBreakdown,
    hasMore,
    loadingMore,
    onLoadMore,
    onOpenPlayer,
    onOpenTeam,
    onWechsel,
    onOpenSaisonstand,
    error,
    scopeWarning,
  } = props;
  const { saisons, live } = useHistorieDaten(gameState);
  const glieder = useMemo(() => baueZeitleistenGlieder(saisons, live), [saisons, live]);
  const [sortierung, setSortierung] = useState<Sortierung>("zeit");
  const [teamSort, setTeamSort] = useState<TeamSortierung>("vol");
  const [hoehe, setHoehe] = useState<Hoehepunkte>("kauf");
  const [gewaehlterDeal, setGewaehlterDeal] = useState<string | null>(null);
  const [blattTeam, setBlattTeam] = useState<string | null>(null);

  const eigenesTeam = ownTeamId ?? null;
  const alle = seasonFilter === allSeasonsValue;
  const auswahlId = alle ? ZEITLEISTE_ALLE : seasonFilter;
  const gewaehltesGlied = glieder.find((glied) => glied.seasonId === seasonFilter) ?? null;
  const kaderaufbauAnsicht = !alle && gewaehltesGlied?.nummer === 1;

  const namenNachId = useMemo(() => new Map(teamOptions.map((team) => [team.teamId, team.name] as const)), [teamOptions]);
  const codeNachId = useMemo(() => new Map(teamOptions.map((team) => [team.teamId, team.shortCode] as const)), [teamOptions]);

  // Alle Fenster zusammen zaehlen den Kaderaufbau NICHT (kein Transfer).
  const sichtZeilen = useMemo(() => {
    const { kaderaufbau, transfers, abgaenge } = trenneKaderaufbau(filteredRows);
    if (kaderaufbauAnsicht) return kaderaufbau;
    return alle ? [...transfers, ...abgaenge.filter((z) => z.buchungsArt !== "kaderaufbau")] : [...transfers, ...abgaenge];
  }, [filteredRows, kaderaufbauAnsicht, alle]);
  const kaderaufbauAlle = useMemo(() => trenneKaderaufbau(filteredRows).kaderaufbau, [filteredRows]);
  // F9 (Abnahme 19.11.): Kennzahlen aus der VOLLSTAENDIGEN Historie im Spielstand statt aus der geladenen Seite.
  const kennzahlen = useMemo(() => fensterKennzahlenAusHistorie(gameState), [gameState]);
  const ohneFilter = teamFilter === "ALL" && typeFilter === "ALL" && classFilter === "ALL" && sourceFilter === "ALL" && !search.trim();
  const kennzahlenSicht = useMemo(() => {
    if (kennzahlen.size === 0) return null;
    const fenster = alle ? [...kennzahlen.values()] : gewaehltesGlied ? [kennzahlen.get(gewaehltesGlied.nummer)].filter(Boolean) : [];
    const summe = (f: (k: FensterKennzahlen) => number) => fenster.reduce((x, k) => x + f(k!), 0);
    const eigen = (feld: "aus" | "ein") => summe((k) => (eigenesTeam ? k.jeTeam.get(eigenesTeam)?.[feld] ?? 0 : 0));
    return {
      deals: summe((k) => k.transferDeals),
      umsatz: summe((k) => k.umsatz),
      eigeneAus: eigen("aus"),
      eigeneEin: eigen("ein"),
      picks: kennzahlen.get(1)?.kaderaufbauPicks ?? 0,
      pickSumme: kennzahlen.get(1)?.kaderaufbauSumme ?? 0,
      // Dieselbe Trennung wie `sichtZeilen`: Kaderaufbau-Ansicht nur Kaderaufbau, sonst ohne Kaderaufbau.
      zeilen: fenster.flatMap((k) => k!.zeilen).filter((z) => (kaderaufbauAnsicht ? z.buchungsArt === "kaderaufbau" : z.buchungsArt !== "kaderaufbau")),
    };
  }, [kennzahlen, alle, gewaehltesGlied, eigenesTeam, kaderaufbauAnsicht]);

  const teamGefiltert = useMemo(
    () => (teamFilter === "ALL" ? sichtZeilen : sichtZeilen.filter((z) => z.fromTeamId === teamFilter || z.toTeamId === teamFilter)),
    [sichtZeilen, teamFilter],
  );

  const zeilen = useMemo(() => {
    const liste = [...teamGefiltert];
    if (sortierung === "zeit") {
      return liste.sort((a, b) => Date.parse(a.happenedAt) - Date.parse(b.happenedAt));
    }
    const schluessel = (z: TransferHistoryV2Row) =>
      sortierung === "abl" ? z.fee : sortierung === "geh" ? z.salary : sortierung === "mw" ? z.marketValue : (z.guv ?? Number.NEGATIVE_INFINITY);
    return liste.sort((a, b) => schluessel(b) - schluessel(a));
  }, [teamGefiltert, sortierung]);

  const bilanz = useMemo(() => {
    // F9: ohne Filter die Bilanz aus der vollstaendigen Historie, nicht aus der geladenen Seite.
    const quelle = ohneFilter && kennzahlenSicht ? kennzahlenSicht.zeilen : sichtZeilen;
    const liste = bilanzJeTeam(quelle, namenNachId).filter((b) => b.deals > 0 || b.teamId === eigenesTeam);
    return liste.sort((a, b) => {
      if (a.teamId === eigenesTeam) return -1;
      if (b.teamId === eigenesTeam) return 1;
      if (teamSort === "vol") return b.deals - a.deals || b.aus + b.ein - (a.aus + a.ein);
      if (teamSort === "ein") return b.ein - a.ein;
      return b.ein - b.aus - (a.ein - a.aus);
    });
  }, [sichtZeilen, namenNachId, eigenesTeam, teamSort, ohneFilter, kennzahlenSicht]);
  const bilanzMax = bilanz.reduce((max, b) => Math.max(max, b.aus, b.ein), 1);
  const bilanzNachTeam = useMemo(() => new Map(bilanz.map((b) => [b.teamId, b] as const)), [bilanz]);

  const dealsJeFenster = useMemo(() => {
    if (kennzahlen.size > 0) return new Map([...kennzahlen].map(([nr, k]) => [nr, k.deals] as const));
    const karte = new Map<number, number>();
    for (const [label, anzahl] of seasonBreakdown) {
      const nr = Number(/(\d+)/.exec(label)?.[1]);
      if (Number.isFinite(nr)) karte.set(nr, (karte.get(nr) ?? 0) + anzahl);
    }
    return karte;
  }, [seasonBreakdown, kennzahlen]);

  const hoehepunkte = useMemo(() => {
    const liste =
      hoehe === "kauf"
        ? zeilen.filter((z) => z.type === "buy").sort((a, b) => b.fee - a.fee)
        : hoehe === "verkauf"
          ? zeilen.filter((z) => z.type === "sell").sort((a, b) => b.fee - a.fee)
          : zeilen.filter((z) => z.type === "sell" && z.guv != null).sort((a, b) => (b.guv ?? 0) - (a.guv ?? 0));
    return liste.slice(0, 5);
  }, [zeilen, hoehe]);

  const auswahl = zeilen.find((z) => z.transferId === gewaehlterDeal) ?? zeilen[0] ?? null;

  const eigeneZeilen = sichtZeilen.filter((z) => z.fromTeamId === eigenesTeam || z.toTeamId === eigenesTeam);
  const eigeneAus = eigeneZeilen.filter((z) => z.type === "buy" && z.toTeamId === eigenesTeam).reduce((s, z) => s + z.fee, 0);
  const eigeneEin = eigeneZeilen.filter((z) => z.type === "sell" && z.fromTeamId === eigenesTeam).reduce((s, z) => s + z.fee, 0);
  const umsatz = sichtZeilen.filter((z) => z.type === "buy").reduce((s, z) => s + z.fee, 0);

  const verlauf = useMemo(() => (blattTeam ? baueTeamVerlauf(saisons, blattTeam) : null), [saisons, blattTeam]);
  const blattDeals: HistorieBlattDeal[] = useMemo(() => {
    if (!blattTeam) return [];
    return filteredRows
      .filter((z) => (z.fromTeamId === blattTeam || z.toTeamId === blattTeam) && z.type !== "contract_exit")
      .sort((a, b) => b.fee - a.fee)
      .slice(0, 3)
      .map((z) => ({
        id: z.transferId,
        spieler: z.playerName,
        portraitUrl: z.portraitUrl,
        text: `${z.toTeamId === blattTeam ? "geholt" : "abgegeben"} · ${z.seasonLabel}`,
        betrag: z.fee,
      }));
  }, [filteredRows, blattTeam]);

  const spaltenKopf = (text: string, key: Sortierung) => ({ text, onKlick: () => setSortierung(key), aktiv: sortierung === key });
  const exportieren = () => {
    const blob = new Blob(["﻿", dealsAlsCsv(zeilen)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kaderaufbauAnsicht ? "kaderaufbau.csv" : "transfers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const teamChip =
    teamFilter !== "ALL" ? (
      <button type="button" className="tg go" onClick={() => onTeamFilterChange("ALL")} title="Teamfilter entfernen">
        {namenNachId.get(teamFilter) ?? teamFilter} ✕
      </button>
    ) : null;

  // Ohne Filter gelten die Zahlen der vollstaendigen Historie; mit Filter die der Liste (sie IST dann die Auswahl).
  const voll = ohneFilter && kennzahlenSicht ? kennzahlenSicht : null;
  const kaderaufbauPicks = kennzahlenSicht ? kennzahlenSicht.picks : kaderaufbauAlle.filter((z) => z.type === "buy").length;
  const bandAus = voll ? voll.eigeneAus : eigeneAus;
  const bandEin = voll ? voll.eigeneEin : eigeneEin;
  const bandItems = kaderaufbauAnsicht
    ? [
        { label: "Picks", wert: kaderaufbauPicks },
        { label: "Summe", wert: fmtC(kennzahlenSicht ? kennzahlenSicht.pickSumme : kaderaufbauAlle.filter((z) => z.type === "buy").reduce((s, z) => s + z.fee, 0), 0), klein: "C" },
        { label: "Dein Team · Ausgaben", wert: fmtC(eigeneAus), klein: "C", ton: "minus" as const },
        { label: "Transferbilanz", wert: "—" },
      ]
    : [
        { label: "Deals", wert: voll ? voll.deals : sichtZeilen.length },
        { label: "Umsatz", wert: fmtC(voll ? voll.umsatz : umsatz, 0), klein: "C" },
        { label: "Dein Team · Ausgaben", wert: fmtC(bandAus), klein: "C", ton: "minus" as const },
        { label: "Dein Team · Einnahmen", wert: fmtC(bandEin), klein: "C", ton: "plus" as const },
        { label: "Netto", wert: fmtVz(bandEin - bandAus), klein: "C", ton: bandEin - bandAus < 0 ? ("minus" as const) : ("plus" as const) },
      ];

  const fuss = (
    <div className="fuss">
      <span>
        Zeigt <b>{zeilen.length}</b> {kaderaufbauAnsicht ? "Zeilen" : "Deals"}
      </span>
      <span>
        Ø Ablöse <b>{zeilen.filter((z) => z.type !== "contract_exit").length > 0 ? `${fmtC(zeilen.filter((z) => z.type !== "contract_exit").reduce((s, z) => s + z.fee, 0) / zeilen.filter((z) => z.type !== "contract_exit").length)} C` : "—"}</b>
      </span>
      {!kaderaufbauAnsicht ? (
        <span>
          Ø GuV bei Verkäufen{" "}
          <b>
            {zeilen.filter((z) => z.guv != null).length > 0
              ? `${fmtVz(zeilen.filter((z) => z.guv != null).reduce((s, z) => s + (z.guv ?? 0), 0) / zeilen.filter((z) => z.guv != null).length)} C`
              : "—"}
          </b>
        </span>
      ) : null}
      <span className="sp" />
      {hasMore ? (
        <button type="button" className="link" disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? "lädt …" : "Mehr laden"}
        </button>
      ) : null}
      <button type="button" className="link" onClick={exportieren}>
        CSV exportieren
      </button>
    </div>
  );

  const blick = auswahl;
  const blickArt = blick ? ART_TEXT[dealArt(blick)] : null;
  const wegText = (z: TransferHistoryV2Row) => (
    <span className="weg">
      {z.fromTeamId ? (
        <>
          <Wappen teamId={z.fromTeamId} name={z.fromTeamName ?? z.fromTeamId} />
          <span>{codeNachId.get(z.fromTeamId) ?? z.fromTeamId}</span>
        </>
      ) : (
        <span className="m">Markt</span>
      )}
      <span aria-hidden="true">›</span>
      {z.toTeamId ? (
        <>
          <Wappen teamId={z.toTeamId} name={z.toTeamName ?? z.toTeamId} />
          <span>{codeNachId.get(z.toTeamId) ?? z.toTeamId}</span>
        </>
      ) : (
        <span className="m">{z.type === "contract_exit" ? "vereinslos" : "Markt"}</span>
      )}
    </span>
  );

  return (
    <HistorieSeite className="h-transfers" testId="historie-transfers">
      <HistorieBandKpis items={bandItems} />
      <HistorieZeitleiste
        modus="transfers"
        glieder={glieder}
        eigenesTeamId={eigenesTeam}
        auswahl={auswahlId}
        onWahl={(id) => {
          onSeasonFilterChange(id === ZEITLEISTE_ALLE ? allSeasonsValue : id);
          setGewaehlterDeal(null);
        }}
        onWechsel={(reiter, seasonId) => onWechsel(reiter, seasonId)}
        dealsJeFenster={dealsJeFenster}
        kaderaufbauPicks={kaderaufbauPicks}
        onOpenSaisonstand={onOpenSaisonstand}
      />

      <section className="pan">
        <div className="pk">
          <h2>{kaderaufbauAnsicht ? "Kaderaufbau je Team" : "Bilanz je Team"}</h2>
          <small>{bilanz.length} Teams aktiv</small>
        </div>
        <div className="tb2">
          {kaderaufbauAnsicht ? (
            <span className="gk">Klick filtert</span>
          ) : (
            <>
              <Seg
                ariaLabel="Sortierung"
                wert={teamSort}
                onWahl={setTeamSort}
                optionen={[
                  { id: "vol", label: "Volumen" },
                  { id: "ein", label: "Erlös" },
                  { id: "net", label: "Netto" },
                ]}
              />
              <span className="sp" />
              <span className="gk">Klick filtert</span>
            </>
          )}
        </div>
        <div className="tl sc">
          {bilanz.map((b) => (
            <button
              key={b.teamId}
              type="button"
              className={`bz${b.teamId === eigenesTeam ? " ich" : ""}${teamFilter === b.teamId ? " an" : ""}`}
              onClick={() => onTeamFilterChange(teamFilter === b.teamId ? "ALL" : b.teamId)}
              title={`Ausgaben ${fmtC(b.aus)} C · Einnahmen ${fmtC(b.ein)} C`}
            >
              <Wappen teamId={b.teamId} name={b.teamName} />
              <span className="n">
                <span>{b.teamName}</span>
                <small>
                  {b.deals} {kaderaufbauAnsicht ? "Picks" : "Deals"}
                  {kaderaufbauAnsicht ? "" : ` · ${b.kaeufe} K / ${b.verkaeufe} V`}
                </small>
              </span>
              {kaderaufbauAnsicht ? (
                <span className="bud" title="Anteil an den höchsten Ausgaben">
                  <u style={{ width: `${(100 * b.aus) / bilanzMax}%` }} />
                </span>
              ) : (
                <span className="dv">
                  <i>
                    <u style={{ width: `${(100 * b.aus) / bilanzMax}%` }} />
                  </i>
                  <i>
                    <u style={{ width: `${(100 * b.ein) / bilanzMax}%` }} />
                  </i>
                </span>
              )}
              <b>{kaderaufbauAnsicht ? fmtC(b.aus) : <Cv wert={b.ein - b.aus} einheit={false} />}</b>
            </button>
          ))}
        </div>
        <div className="fuss">
          {kaderaufbauAnsicht ? (
            <>
              <span>
                <i className="z" style={{ background: "var(--gold)" }} />
                Ausgaben aus dem Startbudget
              </span>
              <span className="sp" />
              <span>Summe in C</span>
            </>
          ) : (
            <>
              <span>
                <i className="z" style={{ background: "var(--warn)" }} />
                Ausgaben
              </span>
              <span>
                <i className="z" style={{ background: "var(--gut)" }} />
                Einnahmen
              </span>
              <span className="sp" />
              <span>Netto in C</span>
            </>
          )}
        </div>
      </section>

      <section className="pan">
        <div className="pk">
          <h2>{kaderaufbauAnsicht ? "Kaderaufbau" : "Deals"}</h2>
          <small>
            {kaderaufbauAnsicht
              ? "vor Saison 1 · aus dem Startbudget"
              : alle
                ? "alle Transferfenster"
                : `Transferfenster vor Saison ${gewaehltesGlied?.nummer ?? ""} · zählt zu Saison ${gewaehltesGlied?.nummer ?? ""}`}
          </small>
          <span className="sp" />
          {teamChip}
          {kaderaufbauAnsicht ? <span className="tg">kein Transfer</span> : null}
        </div>
        <div className="tb2">
          <Seg
            ariaLabel="Art"
            wert={typeFilter}
            onWahl={onTypeFilterChange}
            optionen={[
              { id: "ALL", label: "Alle" },
              { id: "buy", label: "Käufe" },
              { id: "sell", label: "Verkäufe" },
              { id: "contract_exit", label: "Abgänge" },
            ]}
          />
          <select className="wahl" value={classFilter} onChange={(e) => onClassFilterChange(e.target.value)} aria-label="Klasse">
            <option value="ALL">Alle Klassen</option>
            {classOptions.map((klasse) => (
              <option key={klasse} value={klasse}>
                {klasse}
              </option>
            ))}
          </select>
          <select className="wahl" value={sourceFilter} onChange={(e) => onSourceFilterChange(e.target.value)} aria-label="Quelle">
            <option value="ALL">Alle Quellen</option>
            {sourceOptions.map((quelle) => (
              <option key={quelle.key} value={quelle.key}>
                {quelle.label}
              </option>
            ))}
          </select>
          <span className="sp" />
          <input
            className="wahl"
            placeholder="Spieler suchen"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Spieler suchen"
          />
        </div>
        {kaderaufbauAnsicht ? (
          <div className="hinweis">
            <span aria-hidden="true">⚖</span>
            <span>
              <b>Das ist kein Transfer.</b> Jedes Team baut vor Saison 1 seinen Kader aus dem Startbudget. Diese Käufe zählen in keine
              Transferbilanz; für Saison 1 steht dort überall „—“. Das erste Transferfenster ist das vor Saison 2. Pick-Nummer und Runde
              speichert der Draft nicht, deshalb steht die Liste nach Team gruppiert.
            </span>
          </div>
        ) : alle ? (
          <div className="hinweis">
            <span aria-hidden="true">⚖</span>
            <span>
              Der <b>Kaderaufbau vor Saison 1</b> ist kein Transfer und zählt hier nicht mit.{" "}
              <button type="button" style={{ color: "var(--gold)", fontWeight: 700 }} onClick={() => glieder[0] && onSeasonFilterChange(glieder[0].seasonId)}>
                Kaderaufbau ansehen ›
              </button>
            </span>
          </div>
        ) : null}
        {error ? <div className="hinweis">{error}</div> : null}
        {scopeWarning ? <div className="hinweis">{scopeWarning}</div> : null}
        <div className="tl sc" data-testid="historie-deals">
          {kaderaufbauAnsicht ? (
            <ThZeile
              raster={KADER_COLS}
              spalten={[
                { text: "Nr" },
                { text: "Spieler", links: true },
                { text: "Team", links: true },
                { text: "Preis" },
                { text: "Gehalt" },
                { text: "Marktwert" },
                { text: "Preis − MW" },
              ]}
            />
          ) : (
            <ThZeile
              raster={DEAL_COLS}
              spalten={[
                { ...spaltenKopf("Zeit", "zeit"), links: true },
                { text: "Spieler", links: true },
                { text: "Art", links: true },
                { text: "Von → An", links: true },
                spaltenKopf("Ablöse", "abl"),
                spaltenKopf("Gehalt", "geh"),
                spaltenKopf("MW", "mw"),
                spaltenKopf("GuV", "guv"),
                { text: "Quelle", links: true },
              ]}
            />
          )}
          {zeilen.length === 0 ? (
            <div className="leer" style={{ padding: "2rem 0" }}>
              <b>Kein Deal passt</b>Filter lockern oder ein anderes Fenster wählen.
            </div>
          ) : null}
          {kaderaufbauAnsicht
            ? (() => {
                let laufend = 0;
                let letztesTeam: string | null = null;
                return zeilen.map((z) => {
                  const teamId = z.toTeamId ?? z.fromTeamId ?? "";
                  const neu = teamId !== letztesTeam;
                  letztesTeam = teamId;
                  laufend += 1;
                  const b = bilanzNachTeam.get(teamId);
                  return (
                    <Fragment key={z.transferId}>
                      {neu && zeilen.some((x) => (x.toTeamId ?? x.fromTeamId) !== teamId) ? (
                        <div className="trenner">
                          {namenNachId.get(teamId) ?? z.toTeamName ?? z.fromTeamName ?? teamId}
                          <span>
                            {b?.kaeufe ?? 0} Picks · {fmtC(b?.aus ?? 0)} C
                          </span>
                        </div>
                      ) : null}
                      <div
                        className={`tz${teamId === eigenesTeam ? " ich" : ""}${auswahl?.transferId === z.transferId ? " gew" : ""}`}
                        style={{ gridTemplateColumns: KADER_COLS }}
                        onClick={() => setGewaehlterDeal(z.transferId)}
                        role="row"
                      >
                        <span className="rg">{laufend}</span>
                        <span className="nm">
                          <Portrait url={z.portraitUrl} name={z.playerName} />
                          <span>
                            {z.playerName}
                            <small>{z.className ?? "—"}</small>
                          </span>
                        </span>
                        <span className="nm">
                          <Wappen teamId={teamId} name={namenNachId.get(teamId) ?? teamId} />
                          <span>{namenNachId.get(teamId) ?? teamId}</span>
                        </span>
                        <b className="gr">{fmtC(z.fee)}</b>
                        <span className="lz">{fmtC(z.salary)}</span>
                        <span className="lz">{fmtC(z.marketValue)}</span>
                        <span>
                          <Cv wert={z.fee - z.marketValue} einheit={false} />
                        </span>
                      </div>
                    </Fragment>
                  );
                });
              })()
            : (() => {
                let letztesFenster: number | null = null;
                return zeilen.map((z) => {
                  const fenster = fensterNummer(z);
                  const trenner = alle && sortierung === "zeit" && fenster !== letztesFenster;
                  letztesFenster = fenster;
                  const [artText, artKlasse] = ART_TEXT[dealArt(z)];
                  const eigen = z.fromTeamId === eigenesTeam || z.toTeamId === eigenesTeam;
                  return (
                    <Fragment key={z.transferId}>
                      {trenner ? (
                        <div className="trenner">
                          Transferfenster vor Saison {fenster}
                          <span>zählt zu Saison {fenster}</span>
                        </div>
                      ) : null}
                      <div
                        className={`tz${auswahl?.transferId === z.transferId ? " gew" : ""}${eigen ? " ich" : ""}`}
                        style={{ gridTemplateColumns: DEAL_COLS }}
                        onClick={() => setGewaehlterDeal(z.transferId)}
                        role="row"
                        data-testid={`historie-deal-${z.transferId}`}
                      >
                        <span className="li lz">{zeitText(z)}</span>
                        <span className="nm">
                          <Portrait url={z.portraitUrl} name={z.playerName} />
                          <span>
                            {z.playerName}
                            <small>{z.className ?? "—"}</small>
                          </span>
                        </span>
                        <span className="art">
                          <span className={`tg ${artKlasse}`}>{artText}</span>
                        </span>
                        {wegText(z)}
                        <b className="gr">{z.type === "contract_exit" ? <span className="null">—</span> : fmtC(z.fee)}</b>
                        <span className="lz">{fmtC(z.salary)}</span>
                        <span className="lz">{fmtC(z.marketValue)}</span>
                        <span>
                          <Cv wert={z.guv} einheit={false} />
                        </span>
                        <span className="li lz" style={{ fontSize: ".9rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {z.sourceLabel}
                        </span>
                      </div>
                    </Fragment>
                  );
                });
              })()}
        </div>
        {fuss}
      </section>

      <div className="spalte">
        {kaderaufbauAnsicht ? (
          <section className="pan fix">
            <div className="pk">
              <h2>Teuerste Picks</h2>
            </div>
            <div className="pb" style={{ paddingTop: ".3rem", paddingBottom: ".3rem" }}>
              {[...zeilen]
                .filter((z) => z.type === "buy")
                .sort((a, b) => b.fee - a.fee)
                .slice(0, 5)
                .map((z, index) => (
                  <button key={z.transferId} type="button" className="top" onClick={() => setGewaehlterDeal(z.transferId)}>
                    <i>{index + 1}</i>
                    <Portrait url={z.portraitUrl} name={z.playerName} />
                    <span className="n">
                      <b>{z.playerName}</b>
                      <small>{namenNachId.get(z.toTeamId ?? "") ?? z.toTeamName}</small>
                    </span>
                    <strong>{fmtC(z.fee)} C</strong>
                  </button>
                ))}
            </div>
          </section>
        ) : (
          <section className="pan fix">
            <div className="pk">
              <h2>Höhepunkte</h2>
              <span className="sp" />
              <Seg
                ariaLabel="Höhepunkte"
                wert={hoehe}
                onWahl={setHoehe}
                optionen={[
                  { id: "kauf", label: "Käufe" },
                  { id: "verkauf", label: "Verkäufe" },
                  { id: "guv", label: "Gewinne" },
                ]}
              />
            </div>
            <div className="pb" style={{ paddingTop: ".3rem", paddingBottom: ".3rem" }}>
              {hoehepunkte.length === 0 ? <p className="txt" style={{ margin: ".6rem 0" }}>Kein Eintrag im Filter.</p> : null}
              {hoehepunkte.map((z, index) => {
                const teamId = hoehe === "kauf" ? z.toTeamId : z.fromTeamId;
                return (
                  <button key={z.transferId} type="button" className="top" onClick={() => setGewaehlterDeal(z.transferId)}>
                    <i>{index + 1}</i>
                    <Portrait url={z.portraitUrl} name={z.playerName} />
                    <span className="n">
                      <b>{z.playerName}</b>
                      <small>
                        {namenNachId.get(teamId ?? "") ?? "—"} · {z.seasonLabel}
                      </small>
                    </span>
                    <strong>{hoehe === "guv" ? <Cv wert={z.guv} /> : `${fmtC(z.fee)} C`}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <section className="pan">
          <div className="pk">
            <h2>{kaderaufbauAnsicht ? "Pick im Blick" : "Deal im Blick"}</h2>
            {blick ? <small>{zeitText(blick)} · {blick.seasonLabel}</small> : null}
            <span className="sp" />
            {blickArt && !kaderaufbauAnsicht ? <span className={`tg ${blickArt[1]}`}>{blickArt[0]}</span> : null}
          </div>
          {blick ? (
            <div className="pb sc">
              <div className="blick">
                <Portrait url={blick.portraitUrl} name={blick.playerName} klein={false} />
                <div>
                  <h3>{blick.playerName}</h3>
                  <small>
                    {blick.className ?? "—"}
                    {blick.remainingContractLength != null ? ` · Vertrag ${blick.remainingContractLength} ${blick.remainingContractLength === 1 ? "Saison" : "Saisons"}` : ""} · {blick.sourceLabel}
                  </small>
                </div>
              </div>
              <div className="wegg">{wegText(blick)}</div>
              <div className="kas2">
                <div className="ka">
                  <small>Ablöse</small>
                  <strong>{blick.type === "contract_exit" ? "—" : `${fmtC(blick.fee)} C`}</strong>
                  <small>{blick.type === "contract_exit" ? "Vertrag aufgelöst" : `Marktwert ${fmtC(blick.marketValue)} C`}</small>
                </div>
                <div className="ka">
                  <small>GuV</small>
                  <strong>
                    <Cv wert={blick.guv} />
                  </strong>
                  <small>{blick.guv == null ? "braucht Kauf und Verkauf" : "gegen den Kaufpreis"}</small>
                </div>
                <div className="ka">
                  <small>Gehalt</small>
                  <strong>{fmtC(blick.salary)} C</strong>
                  <small>je Saison</small>
                </div>
                <div className="ka">
                  <small>Aufpreis</small>
                  <strong>{blick.type === "contract_exit" ? "—" : <Cv wert={blick.fee - blick.marketValue} />}</strong>
                  <small>Ablöse minus Marktwert</small>
                </div>
              </div>
              <div style={{ display: "flex", gap: ".5rem", marginTop: ".7rem", flex: "none" }}>
                <button type="button" className="kn" onClick={() => onOpenPlayer(blick.playerId)}>
                  Spielerprofil ›
                </button>
                {blick.toTeamId || blick.fromTeamId ? (
                  <button type="button" className="kn" onClick={() => setBlattTeam((blick.toTeamId ?? blick.fromTeamId) as string)}>
                    Team-Verlauf ›
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="pb">
              <div className="leer">Kein Deal gewählt.</div>
            </div>
          )}
        </section>
      </div>
      <HistorieBlatt
        verlauf={verlauf}
        ewigRang={null}
        deals={blattDeals}
        onSchliessen={() => setBlattTeam(null)}
        onTeamprofil={onOpenTeam}
        onAlleTransfers={(teamId) => {
          onTeamFilterChange(teamId);
          onSeasonFilterChange(allSeasonsValue);
          setBlattTeam(null);
        }}
      />
    </HistorieSeite>
  );
}
