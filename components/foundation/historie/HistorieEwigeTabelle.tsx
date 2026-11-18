"use client";

import { useMemo, useState } from "react";

import type { AllTimeTableModel, AllTimeTableRow } from "@/lib/foundation/all-time-table";
import { baueTeamVerlauf, rekordmeister, type HistorieSaison } from "@/lib/foundation/historie-modern";
import { getLeagueLevel, toLeagueSpanningPosition } from "@/lib/season/league-history";

import HistorieBlatt from "./HistorieBlatt";
import HistorieLinien from "./HistorieLinien";
import { useHistorieDaten, type HistorieHostBasis } from "./HistorieArchiv";
import { HistorieBandKpis, Seg, ThZeile, Wappen, fmtC, fmtVz, fmtZahl, positionText } from "./historie-bits";

export type HistorieEwigProps = HistorieHostBasis & { model: AllTimeTableModel | null };

type Fokus = "punkte" | "medaillen" | "marktwert" | "kasse";
type LigaFilter = "alle" | "1" | "2";
type Metrik = "platz" | "pkt" | "mw" | "kasse" | "tw";

/** Die abgeleiteten Zahlen einer Zeile; Plaetze ueber beide Ligen (Liga 2 ab 17). */
export type EwigZeile = {
  row: AllTimeTableRow;
  nr: number;
  saisons: number;
  liga: number | null;
  pkt: number;
  dpkt: number | null;
  drang: number | null;
  best: number | null;
  gold: number;
  silber: number;
  bronze: number;
  top5: number;
  top10: number;
  auf: number;
  abs: number;
  mwj: number | null;
  mwp: number | null;
  mww: number | null;
  mwz: number | null;
  kj: number | null;
  kp: number | null;
  tw: number | null;
};

export function baueEwigZeilen(model: AllTimeTableModel): EwigZeile[] {
  return model.rows.map((row) => {
    const positionen = row.seasons
      .map((season) => toLeagueSpanningPosition(season.rank, season.leagueTier ?? null))
      .filter((wert): wert is number => wert != null);
    const letzte = row.seasons[row.seasons.length - 1] ?? null;
    return {
      row,
      nr: row.allTimeRank,
      saisons: row.seasons.length,
      liga: letzte ? getLeagueLevel(letzte.leagueTier) : null,
      pkt: row.cumulativePoints,
      dpkt: row.seasons.length > 0 ? row.cumulativePoints / row.seasons.length : null,
      drang: row.avgRank,
      best: row.bestRank,
      gold: positionen.filter((wert) => wert === 1).length,
      silber: positionen.filter((wert) => wert === 2).length,
      bronze: positionen.filter((wert) => wert === 3).length,
      top5: positionen.filter((wert) => wert <= 5).length,
      top10: positionen.filter((wert) => wert <= 10).length,
      auf: row.promotions,
      abs: row.relegations,
      mwj: row.mwNow,
      mwp: row.mwPeak,
      mww: row.mwGrowthAbs,
      mwz: row.mwGrowthPct,
      kj: row.cashNow,
      kp: row.cashPeak,
      tw: row.mwNow != null && row.cashNow != null ? row.mwNow + row.cashNow : null,
    };
  });
}

type SpaltenKey = keyof Omit<EwigZeile, "row" | "nr" | "saisons" | "liga">;
const FOKUS: Record<Fokus, ReadonlyArray<[SpaltenKey, string, string]>> = {
  punkte: [
    ["pkt", "Punkte", "4.8rem"],
    ["dpkt", "Ø Punkte", "4.8rem"],
    ["drang", "Ø Platz", "4.4rem"],
    ["best", "Bester Platz", "6.4rem"],
  ],
  medaillen: [
    ["gold", "Meister", "4.4rem"],
    ["silber", "Zweiter", "4.4rem"],
    ["bronze", "Dritter", "4.4rem"],
    ["top5", "Top 5", "3.8rem"],
    ["top10", "Top 10", "3.8rem"],
    ["auf", "Aufstiege", "5rem"],
    ["abs", "Abstiege", "5rem"],
  ],
  marktwert: [
    ["mwj", "MW jetzt", "5.4rem"],
    ["mwp", "MW Höchst", "5.6rem"],
    ["mww", "MW +/−", "5.4rem"],
    ["mwz", "MW %", "4.6rem"],
  ],
  kasse: [
    ["kj", "Kasse jetzt", "5.6rem"],
    ["kp", "Kasse Höchst", "6rem"],
    ["tw", "Teamwert", "5.6rem"],
  ],
};
const AUFSTEIGEND: ReadonlySet<SpaltenKey> = new Set<SpaltenKey>(["drang", "best"]);
const FARBEN = ["#f0c35a", "#45B0C9", "#c9a7ff", "#62d394", "#ff8f6b", "#9aa7ba"];

function zelle(o: EwigZeile, key: SpaltenKey) {
  const wert = o[key];
  if (wert == null) return <span className="null">—</span>;
  switch (key) {
    case "pkt":
      return <b className="gr">{fmtZahl(wert)}</b>;
    case "dpkt":
    case "drang":
      return fmtZahl(wert);
    case "best":
      return positionText(wert);
    case "mww":
      return <span className={wert >= 0 ? "plus" : "minus"}>{fmtVz(wert)}</span>;
    case "mwz":
      return <span className={wert >= 0 ? "plus" : "minus"}>{fmtVz(wert)} %</span>;
    case "mwj":
    case "mwp":
    case "kj":
    case "kp":
    case "tw":
      return fmtC(wert);
    case "gold":
      return wert > 0 ? <b className="gr" style={{ color: "var(--gold)" }}>{wert}</b> : <span className="null">–</span>;
    case "auf":
      return wert > 0 ? <span className="plus">▲ {wert}</span> : <span className="null">–</span>;
    case "abs":
      return wert > 0 ? <span className="minus">▼ {wert}</span> : <span className="null">–</span>;
    default:
      return wert > 0 ? wert : <span className="null">–</span>;
  }
}

function Kacheln({ zeile, saisons }: { zeile: EwigZeile; saisons: readonly HistorieSaison[] }) {
  return (
    <span className="vk">
      {zeile.row.seasons.map((season) => {
        const liga = getLeagueLevel(season.leagueTier);
        const hist = saisons.find((eintrag) => eintrag.seasonId === season.seasonId);
        const team = hist?.ligen.flatMap((l) => l.zeilen).find((z) => z.teamId === zeile.row.teamId) ?? null;
        const klasse = [
          liga === 2 ? "b" : "",
          season.isLive ? "lf" : team?.meister ? "t" : "",
          team?.aufstieg ? "auf" : team?.abstieg ? "abs" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <i key={season.seasonId} className={klasse} title={`${season.seasonLabel}${liga ? ` · Liga ${liga}` : ""} · Platz ${season.rank ?? "—"}`}>
            {season.rank ?? "–"}
          </i>
        );
      })}
    </span>
  );
}

function metrikWerte(zeile: EwigZeile, metrik: Metrik): Array<number | null> {
  return zeile.row.seasons.map((season) => {
    switch (metrik) {
      case "platz":
        return toLeagueSpanningPosition(season.rank, season.leagueTier ?? null);
      case "pkt":
        return season.points;
      case "mw":
        return season.marketValue;
      case "kasse":
        return season.cash;
      default:
        return season.marketValue != null && season.cash != null ? season.marketValue + season.cash : null;
    }
  });
}

export default function HistorieEwigeTabelle({ gameState, ownTeamId, model, onOpenTeam, onWechsel }: HistorieEwigProps) {
  const { saisons } = useHistorieDaten(gameState);
  const [fokus, setFokus] = useState<Fokus>("punkte");
  const [ligaFilter, setLigaFilter] = useState<LigaFilter>("alle");
  const [sortKey, setSortKey] = useState<SpaltenKey>("pkt");
  const [metrik, setMetrik] = useState<Metrik>("platz");
  const [blattTeam, setBlattTeam] = useState<string | null>(null);

  const zeilen = useMemo(() => (model ? baueEwigZeilen(model) : []), [model]);
  const spalten = FOKUS[fokus];
  const aktiveSpalte = spalten.some(([key]) => key === sortKey) ? sortKey : spalten[0]![0];
  const sortiert = useMemo(() => {
    const aufsteigend = AUFSTEIGEND.has(aktiveSpalte);
    return zeilen
      .filter((zeile) => ligaFilter === "alle" || zeile.liga === Number(ligaFilter))
      .sort((a, b) => {
        const x = a[aktiveSpalte] as number | null;
        const y = b[aktiveSpalte] as number | null;
        if (x == null) return 1;
        if (y == null) return -1;
        return aufsteigend ? x - y : y - x;
      });
  }, [zeilen, ligaFilter, aktiveSpalte]);

  const verlauf = useMemo(() => (blattTeam ? baueTeamVerlauf(saisons, blattTeam) : null), [saisons, blattTeam]);
  const rekord = useMemo(() => rekordmeister(saisons), [saisons]);
  const eigene = zeilen.find((zeile) => zeile.row.teamId === ownTeamId) ?? null;
  const meisteTitel = [...zeilen].sort((a, b) => b.gold - a.gold)[0] ?? null;
  const groesstesMw = [...zeilen].sort((a, b) => (b.mww ?? -Infinity) - (a.mww ?? -Infinity))[0] ?? null;
  const kassePeak = [...zeilen].sort((a, b) => (b.kp ?? -Infinity) - (a.kp ?? -Infinity))[0] ?? null;

  const bandKpis = (
    <HistorieBandKpis
      items={[
        { label: "Ewiger Leader", wert: zeilen[0]?.row.teamCode ?? "—", klein: zeilen[0] ? `${fmtZahl(zeilen[0].pkt)} P` : undefined },
        { label: "Meiste Titel", wert: meisteTitel && meisteTitel.gold > 0 ? meisteTitel.row.teamCode : "—", klein: meisteTitel && meisteTitel.gold > 0 ? `${meisteTitel.gold}×` : undefined },
        { label: "Größtes MW-Wachstum", wert: groesstesMw?.mww != null ? groesstesMw.row.teamCode : "—", klein: groesstesMw?.mww != null ? `${fmtVz(groesstesMw.mww)} C` : undefined },
        { label: "Kasse-Rekord", wert: kassePeak?.kp != null ? kassePeak.row.teamCode : "—", klein: kassePeak?.kp != null ? `${fmtC(kassePeak.kp)} C` : undefined },
      ]}
    />
  );

  if (!model || !model.hasArchive) {
    return (
      <div className="hist h-ewig" data-testid="historie-ewig">
        <section className="pan">
          <div className="pk"><h2>Ewige Tabelle</h2></div>
          <div className="pb"><div className="leer"><b>Archiv wird geladen …</b>Die Ewige Tabelle liest alle abgeschlossenen Saisons.</div></div>
        </section>
      </div>
    );
  }
  if (!model.hasHistory) {
    return (
      <div className="hist h-ewig" data-testid="historie-ewig">
        {bandKpis}
        <section className="pan">
          <div className="pk"><h2>Ewige Tabelle</h2></div>
          <div className="pb">
            <div className="leer">
              <b>Noch keine abgeschlossene Saison archiviert</b>
              Die Ewige Tabelle zählt ab dem Ende von Saison 1. Bis dahin steht alles im Saisonstand.
            </div>
          </div>
        </section>
      </div>
    );
  }

  const cols = `2.4rem minmax(0,1fr) 3.6rem ${spalten.map(([, , breite]) => breite).join(" ")} 9.6rem`;
  const kopf = [...zeilen.slice(0, 4).map((zeile) => zeile.row.teamId)];
  if (ownTeamId) {
    const idx = kopf.indexOf(ownTeamId);
    if (idx >= 0) kopf.splice(idx, 1);
    if (zeilen.some((zeile) => zeile.row.teamId === ownTeamId)) kopf.unshift(ownTeamId);
  }
  const serien = kopf
    .map((teamId, index) => {
      const zeile = zeilen.find((eintrag) => eintrag.row.teamId === teamId);
      return zeile ? { id: teamId, farbe: FARBEN[index % FARBEN.length]!, dick: index === 0, werte: metrikWerte(zeile, metrik), name: zeile.row.teamName } : null;
    })
    .filter((serie): serie is NonNullable<typeof serie> => serie != null);
  const labels = (zeilen[0]?.row.seasons ?? []).map((season) => `S${season.seasonId.replace(/\D+/g, "") || "?"}`);
  const wechsel = saisons.slice(0, -1).length > 0 ? saisons : saisons;

  return (
    <div className="hist h-ewig" data-testid="historie-ewig">
      {bandKpis}
      <section className="pan">
        <div className="pk">
          <h2>Ewige Tabelle</h2>
          <small>
            {model.archivedSeasonCount} {model.archivedSeasonCount === 1 ? "Saison" : "Saisons"} abgeschlossen
          </small>
          <span className="sp" />
          <Seg
            ariaLabel="Liga"
            wert={ligaFilter}
            onWahl={setLigaFilter}
            optionen={[
              { id: "alle", label: `Alle ${zeilen.length}` },
              { id: "1", label: "Liga 1" },
              { id: "2", label: "Liga 2" },
            ]}
          />
        </div>
        <div className="tb2">
          <Seg
            ariaLabel="Sicht"
            wert={fokus}
            onWahl={(wert) => {
              setFokus(wert);
              setSortKey(FOKUS[wert][0]![0]);
            }}
            optionen={[
              { id: "punkte", label: "Punkte & Ränge" },
              { id: "medaillen", label: "Titel & Auf-/Abstieg" },
              { id: "marktwert", label: "Marktwert" },
              { id: "kasse", label: "Kasse & Teamwert" },
            ]}
          />
          <span className="sp" />
          <span className="gk">Klick auf ein Team öffnet den Verlauf</span>
        </div>
        <div className="tl sc">
          <ThZeile
            raster={cols}
            spalten={[
              { text: "#" },
              { text: "Team", links: true },
              { text: "Saisons" },
              ...spalten.map(([key, text]) => ({ text, onKlick: () => setSortKey(key), aktiv: aktiveSpalte === key })),
              { text: `S1 – S${model.archivedSeasonCount}` },
            ]}
          />
          {sortiert.map((zeile) => (
            <div
              key={zeile.row.teamId}
              className={`tz${zeile.row.teamId === ownTeamId ? " ich" : ""}${zeile.nr === 1 ? " zm" : ""}`}
              style={{ gridTemplateColumns: cols }}
              onClick={() => setBlattTeam(zeile.row.teamId)}
              role="row"
              data-testid={`historie-ewig-zeile-${zeile.row.teamId}`}
            >
              <span className="rg">{zeile.nr}</span>
              <span className="nm">
                <Wappen teamId={zeile.row.teamId} name={zeile.row.teamName} />
                <span>{zeile.row.teamName}</span>
                {zeile.liga != null ? <span className={`tg ${zeile.liga === 1 ? "l1" : "l2"}`}>Liga {zeile.liga}</span> : null}
              </span>
              <span className="lz">{zeile.saisons}</span>
              {spalten.map(([key]) => (
                <span key={key}>{zelle(zeile, key)}</span>
              ))}
              <Kacheln zeile={zeile} saisons={saisons} />
            </div>
          ))}
        </div>
        <div className="fuss">
          <span className="vk"><i>4</i></span>
          <span>Liga 1</span>
          <span className="vk"><i className="b">4</i></span>
          <span>Liga 2</span>
          <span className="vk"><i className="t">1</i></span>
          <span>Meister</span>
          <span className="sp" />
          <span>Ø Platz und Bester Platz über beide Ligen: Liga 2 zählt ab Platz 17</span>
        </div>
      </section>
      <div className="spalte">
        <section className="pan">
          <div className="pk">
            <h2>Entwicklung</h2>
            <small>{eigene ? "dein Team gegen die ewige Spitze" : "die ewige Spitze"}</small>
          </div>
          <div className="tb2">
            <Seg
              ariaLabel="Kennzahl"
              wert={metrik}
              onWahl={setMetrik}
              optionen={[
                { id: "platz", label: "Platz" },
                { id: "pkt", label: "Punkte" },
                { id: "mw", label: "Marktwert" },
                { id: "kasse", label: "Kasse" },
                { id: "tw", label: "Teamwert" },
              ]}
            />
          </div>
          <div className="pb">
            <div className="graf">
              <HistorieLinien serien={serien} platz={metrik === "platz"} saisonLabels={labels} />
            </div>
            <div className="leg">
              {serien.map((serie) => (
                <span key={serie.id} onClick={() => setBlattTeam(serie.id)}>
                  <i style={{ background: serie.farbe }} />
                  {serie.name}
                </span>
              ))}
            </div>
          </div>
        </section>
        <section className="pan fix">
          <div className="pk">
            <h2>Auf und ab</h2>
            <small>wer die Liga gewechselt hat</small>
          </div>
          <div className="pb" style={{ paddingTop: ".2rem", paddingBottom: ".2rem" }}>
            {wechsel.map((saison, index) => (
              <div key={saison.seasonId} className="gz">
                <b>
                  S{saison.nummer} → S{(saison.nummer ?? index + 1) + 1}
                </b>
                <div className="plus">
                  ▲
                  {saison.aufsteiger.map((z) => (
                    <button key={z.teamId} type="button" onClick={() => setBlattTeam(z.teamId)} title={z.teamName}>
                      <Wappen teamId={z.teamId} name={z.teamName} />
                    </button>
                  ))}
                </div>
                <div className="minus">
                  ▼
                  {saison.absteiger.map((z) => (
                    <button key={z.teamId} type="button" onClick={() => setBlattTeam(z.teamId)} title={z.teamName}>
                      <Wappen teamId={z.teamId} name={z.teamName} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <HistorieBlatt
        verlauf={verlauf}
        ewigRang={zeilen.find((zeile) => zeile.row.teamId === blattTeam)?.nr ?? null}
        onSchliessen={() => setBlattTeam(null)}
        onTeamprofil={onOpenTeam}
        onAlleTransfers={() => onWechsel("transfers")}
      />
      {rekord ? null : null}
    </div>
  );
}
