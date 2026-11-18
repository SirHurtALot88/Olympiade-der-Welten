"use client";

import { useEffect } from "react";

import type { HistorieTeamVerlauf } from "@/lib/foundation/historie-modern";

import HistorieLinien from "./HistorieLinien";
import { Cv, LigaMarke, Wappen, ZeilenMarke, fmtC, fmtZahl, positionText } from "./historie-bits";

export type HistorieBlattDeal = {
  id: string;
  spieler: string;
  portraitUrl: string | null;
  text: string;
  betrag: number;
};

type Props = {
  verlauf: HistorieTeamVerlauf | null;
  /** Platz in der Ewigen Tabelle, falls bekannt. */
  ewigRang: number | null;
  menschLabel?: string | null;
  deals?: readonly HistorieBlattDeal[];
  onSchliessen: () => void;
  onTeamprofil: (teamId: string) => void;
  onAlleTransfers?: (teamId: string) => void;
};

/**
 * Blatt rechts (Mockup 18.11.): der Verlauf eines Teams ueber beide Ligen — Titel, Aufstiege, Abstiege, bester Platz,
 * Kurve, Saison fuer Saison. Esc und Klick auf den Schleier schliessen.
 */
export default function HistorieBlatt({
  verlauf,
  ewigRang,
  menschLabel,
  deals,
  onSchliessen,
  onTeamprofil,
  onAlleTransfers,
}: Props) {
  useEffect(() => {
    if (!verlauf) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSchliessen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [verlauf, onSchliessen]);

  if (!verlauf) return null;
  const letzte = verlauf.saisons[verlauf.saisons.length - 1]!;
  const cols = "3rem minmax(0,1fr) 3.2rem 4.4rem 4.8rem 5.2rem 5.6rem";
  const labels = verlauf.saisons.map((zeile) => `S${zeile.seasonNummer ?? "?"}`);
  return (
    <>
      <div className="schl auf" onClick={onSchliessen} aria-hidden="true" />
      <section className="pan blatt auf" role="dialog" aria-label={`Team-Verlauf ${verlauf.teamName}`} data-testid="historie-blatt">
        <div className="pk">
          <Wappen teamId={verlauf.teamId} name={verlauf.teamName} klein={false} />
          <div>
            <h2>{verlauf.teamName}</h2>
            <small>
              {letzte.liga != null ? `aktuell Liga ${letzte.liga} · ` : ""}Platz {letzte.rank ?? "—"}
              {ewigRang != null ? ` · ewige Tabelle #${ewigRang}` : ""}
              {menschLabel ? ` · ${menschLabel}` : ""}
            </small>
          </div>
          <button type="button" className="x" onClick={onSchliessen} title="Schließen (Esc)" aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="pb sc">
          <div className="kas4">
            <div className="ka">
              <small>Meistertitel</small>
              <strong>{verlauf.titel}</strong>
            </div>
            <div className="ka">
              <small>Aufstiege</small>
              <strong style={{ color: "var(--gut)" }}>{verlauf.aufstiege}</strong>
            </div>
            <div className="ka">
              <small>Abstiege</small>
              <strong style={{ color: "var(--warn)" }}>{verlauf.abstiege}</strong>
            </div>
            <div className="ka">
              <small>Bester Platz</small>
              <strong>{verlauf.besterPosition != null ? positionText(verlauf.besterPosition) : "—"}</strong>
            </div>
          </div>
          <div className="ab">
            <b>Platz über beide Ligen</b>
            <span>Zahl am Punkt = Platz in der Liga</span>
          </div>
          <div className="graf" style={{ flex: "none", height: "13rem" }}>
            <HistorieLinien
              serien={[{ id: verlauf.teamId, farbe: "#f0c35a", dick: true, werte: verlauf.saisons.map((zeile) => zeile.position) }]}
              platz
              breite={580}
              hoehe={210}
              saisonLabels={labels}
            />
          </div>
          <div className="ab">
            <b>Saison für Saison</b>
          </div>
          <div className="th" style={{ gridTemplateColumns: cols }}>
            <span className="li">Saison</span>
            <span className="li">Liga</span>
            <span>Platz</span>
            <span>Punkte</span>
            <span>Kasse</span>
            <span>Marktwert</span>
            <span>Transfers</span>
          </div>
          {verlauf.saisons.map((zeile) => (
            <div key={zeile.seasonId} className="tz" style={{ gridTemplateColumns: cols }}>
              <span className="li">
                <b style={{ font: "400 1.05rem var(--haus)", color: "var(--creme)" }}>S{zeile.seasonNummer}</b>
              </span>
              <span className="li" style={{ display: "flex", gap: ".3rem" }}>
                <LigaMarke liga={zeile.liga} />
                <ZeilenMarke zeile={zeile} mitText={false} />
              </span>
              <span className="rg">{zeile.rank != null ? `${zeile.rank}.` : "—"}</span>
              <b className="gr">{fmtZahl(zeile.points)}</b>
              <span>{fmtC(zeile.cash)}</span>
              <span>{fmtC(zeile.marketValue)}</span>
              <span>
                {zeile.seasonNummer === 1 ? (
                  <span style={{ color: "var(--stumm)" }} title="Kaderaufbau aus dem Startbudget, kein Transfer">
                    —
                  </span>
                ) : (
                  <Cv wert={zeile.transferNet} einheit={false} />
                )}
              </span>
            </div>
          ))}
          <p className="hinw" style={{ margin: ".4rem 0 0", fontSize: ".82rem", color: "var(--stumm)" }}>
            Saison 1: Kaderaufbau aus dem Startbudget, deshalb keine Transferbilanz. Das Fenster vor Saison N zählt zu Saison N.
          </p>
          {deals && deals.length > 0 ? (
            <>
              <div className="ab">
                <b>Größte Deals</b>
              </div>
              {deals.map((deal, index) => (
                <div key={deal.id} className="top" style={{ cursor: "default" }}>
                  <i>{index + 1}</i>
                  {deal.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="ptr k" src={deal.portraitUrl} alt="" />
                  ) : (
                    <span className="ptr k" />
                  )}
                  <span className="n">
                    <b>{deal.spieler}</b>
                    <small>{deal.text}</small>
                  </span>
                  <strong>{fmtC(deal.betrag)} C</strong>
                </div>
              ))}
            </>
          ) : null}
          <div style={{ display: "flex", gap: ".5rem", marginTop: ".9rem", flex: "none" }}>
            <button type="button" className="kn" onClick={() => onTeamprofil(verlauf.teamId)}>
              Teamprofil ›
            </button>
            {onAlleTransfers ? (
              <button type="button" className="kn" onClick={() => onAlleTransfers(verlauf.teamId)}>
                Alle Transfers ›
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
