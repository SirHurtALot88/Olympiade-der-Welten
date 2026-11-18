"use client";

import { Fragment } from "react";

import type { HistorieSaison } from "@/lib/foundation/historie-modern";

import { Cv, Wappen, fmtZahl } from "./historie-bits";

export type HistorieLiveSaison = {
  seasonId: string;
  nummer: number;
  label: string;
  /** Aktueller Spieltag (1-basiert), `null` wenn unbekannt. */
  spieltag: number | null;
  spieltage: number | null;
};

export type HistorieZeitleisteGlied = {
  seasonId: string;
  nummer: number;
  /** Archivierte Saison oder `null` (laufende Saison). */
  saison: HistorieSaison | null;
  live: HistorieLiveSaison | null;
};

/** Archivierte Saisons plus laufende, aufsteigend; die laufende nur, wenn sie noch nicht archiviert ist. */
export function baueZeitleistenGlieder(
  saisons: readonly HistorieSaison[],
  live: HistorieLiveSaison | null,
): HistorieZeitleisteGlied[] {
  const glieder: HistorieZeitleisteGlied[] = saisons.map((saison) => ({
    seasonId: saison.seasonId,
    nummer: saison.nummer ?? 0,
    saison,
    live: null,
  }));
  if (live && !saisons.some((saison) => saison.seasonId === live.seasonId)) {
    glieder.push({ seasonId: live.seasonId, nummer: live.nummer, saison: null, live });
  }
  return glieder.sort((a, b) => a.nummer - b.nummer);
}

export const ZEITLEISTE_ALLE = "alle";

type Props = {
  modus: "archiv" | "transfers";
  glieder: readonly HistorieZeitleisteGlied[];
  eigenesTeamId: string | null;
  /** Gewählte Saison-ID oder `ZEITLEISTE_ALLE`. */
  auswahl: string;
  /** Wählt im eigenen Reiter (Archiv: Saison, Transfers: Fenster). */
  onWahl: (seasonId: string) => void;
  /** Klick auf das jeweils schmale Glied wechselt den Reiter. */
  onWechsel: (reiter: "archiv" | "transfers", seasonId: string) => void;
  /** Deals je Fenster (Schluessel = Saison-Nummer). */
  dealsJeFenster?: ReadonlyMap<number, number>;
  /** Anzahl Picks im Kaderaufbau (nur Transfers-Modus). */
  kaderaufbauPicks?: number;
  onOpenSaisonstand?: () => void;
};

export default function HistorieZeitleiste({
  modus,
  glieder,
  eigenesTeamId,
  auswahl,
  onWahl,
  onWechsel,
  dealsJeFenster,
  kaderaufbauPicks,
  onOpenSaisonstand,
}: Props) {
  const tr = modus === "transfers";
  return (
    <nav className={`zl voll ${tr ? "tr" : "ar"}`} aria-label="Saison-Zeitleiste" data-testid="historie-zeitleiste">
      {tr ? (
        <button
          type="button"
          className={`al${auswahl === ZEITLEISTE_ALLE ? " an" : ""}`}
          onClick={() => onWahl(ZEITLEISTE_ALLE)}
          title="Alle Transferfenster zusammen"
        >
          <span className="tx">
            <small>Alle</small>
            <b>Fenster</b>
          </span>
        </button>
      ) : null}
      {glieder.map((glied) => {
        const { saison, live, nummer, seasonId } = glied;
        const deals = dealsJeFenster?.get(nummer) ?? null;
        const eigen = saison?.ligen.flatMap((liga) => liga.zeilen).find((zeile) => zeile.teamId === eigenesTeamId) ?? null;
        const meister = saison?.meister ?? null;
        const feAn = tr && auswahl === seasonId;
        const saAn = !tr && auswahl === seasonId;
        return (
          <Fragment key={seasonId}>
            <button
              type="button"
              className={`fe${feAn ? " an" : tr ? "" : " neben"}`}
              onClick={() => (tr ? onWahl(seasonId) : onWechsel("transfers", seasonId))}
              title={nummer === 1 ? "Kaderaufbau aus dem Startbudget, kein Transfer" : `Transferfenster vor Saison ${nummer}, zählt zu Saison ${nummer}`}
              data-testid={`historie-fenster-${nummer}`}
            >
              {!tr ? (
                <span className="tx">
                  <small>{nummer === 1 ? "Start" : "Fenster"}</small>
                  <b>{nummer === 1 ? "Kaderaufbau" : deals != null ? `${deals} Deals` : "Transfers"}</b>
                </span>
              ) : nummer === 1 ? (
                <>
                  <span className="tx">
                    <small>Kein Transfer</small>
                    <b>Kaderaufbau</b>
                  </span>
                  <span className="eig">
                    <b>{kaderaufbauPicks ?? 0} Picks</b>
                    <span>aus dem Startbudget</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="tx">
                    <small>Zählt zu Saison {nummer}</small>
                    <b>Fenster vor Saison {nummer}</b>
                  </span>
                  <span className="eig">
                    <b>{deals ?? 0} Deals</b>
                    {eigen?.transferNet != null ? (
                      <span>
                        dein Netto <Cv wert={eigen.transferNet} />
                      </span>
                    ) : null}
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              className={`sa${saAn ? " an" : tr ? " neben" : ""}`}
              onClick={() => {
                if (!saison) {
                  onOpenSaisonstand?.();
                  return;
                }
                if (tr) onWechsel("archiv", seasonId);
                else onWahl(seasonId);
              }}
              title={`Saison ${nummer}${saison ? (meister ? ` · Meister ${meister.teamName}` : "") : " läuft"}`}
              data-testid={`historie-saison-${nummer}`}
            >
              <span className="nr">
                <small>Saison</small>
                {nummer}
              </span>
              {meister ? <Wappen teamId={meister.teamId} name={meister.teamName} klein={false} /> : null}
              {!tr ? (
                saison ? (
                  <>
                    <span className="tx">
                      <small>Meister</small>
                      <b>{meister?.teamName ?? "—"}</b>
                    </span>
                    {eigen ? (
                      <span className="eig">
                        <b>{eigen.rank != null ? `${eigen.rank}.` : "—"}</b>
                        <span>
                          {eigen.liga != null ? <span className={`tg ${eigen.liga === 1 ? "l1" : "l2"}`}>Liga {eigen.liga}</span> : null}
                          {eigen.aufstieg ? <span className="tg g">▲</span> : eigen.abstieg ? <span className="tg w">▼</span> : null}
                        </span>
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="tx">
                    <small>läuft</small>
                    <b>
                      {live?.spieltag != null ? `Spieltag ${live.spieltag}` : "Zwischenstand"}
                      {live?.spieltage != null ? ` / ${fmtZahl(live.spieltage, 0)}` : ""}
                    </b>
                  </span>
                )
              ) : null}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
