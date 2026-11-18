"use client";

import { Fragment, useMemo, useState } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  baueHistorieSaisons,
  baueTeamVerlauf,
  rekordmeister,
  type HistorieLiga,
  type HistorieSaison,
  type HistorieTeamSaison,
} from "@/lib/foundation/historie-modern";
import { leseSaisonHistorie } from "@/lib/persistence/foundation-season-history-projection";
import { saisonNummer } from "@/lib/foundation/transfer-window-zuordnung";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

import HistorieBlatt from "./HistorieBlatt";
import HistorieZeitleiste, { baueZeitleistenGlieder, type HistorieLiveSaison } from "./HistorieZeitleiste";
import { Cv, HistorieBandKpis, HistorieSeite, Seg, ThZeile, Wappen, ZeilenMarke, fmtC, fmtVz, fmtZahl, positionText } from "./historie-bits";

export type HistorieHostBasis = {
  gameState: GameState;
  ownTeamId: string | null;
  onOpenTeam: (teamId: string) => void;
  /** Wechselt den Reiter der Historie (und waehlt optional eine Saison/ein Fenster). */
  onWechsel: (reiter: "archiv" | "transfers" | "ewig", seasonId?: string, teamId?: string) => void;
  onOpenSaisonstand: () => void;
};

export function useHistorieDaten(gameState: GameState) {
  const historie = useMemo(() => leseSaisonHistorie(gameState), [gameState]);
  const saisons = useMemo(() => baueHistorieSaisons(historie), [historie]);
  const live: HistorieLiveSaison = useMemo(
    () => ({
      seasonId: gameState.season.id,
      nummer: saisonNummer(gameState.season.id) ?? saisons.length + 1,
      label: getCanonicalSeasonLabel({ seasonId: gameState.season.id, seasonName: gameState.season.name }),
      spieltag: gameState.season.currentMatchday ?? null,
      spieltage: gameState.season.matchdayIds?.length ?? gameState.season.totalMatchdays ?? null,
    }),
    [gameState.season, saisons.length],
  );
  return { saisons, live };
}

type Sicht = "sport" | "geld";

function ligaKarte({
  saison,
  liga,
  sicht,
  onSicht,
  ownTeamId,
  onTeam,
}: {
  saison: HistorieSaison;
  liga: HistorieLiga;
  sicht: Sicht;
  onSicht: (sicht: Sicht) => void;
  ownTeamId: string | null;
  onTeam: (teamId: string) => void;
}) {
  const geld = sicht === "geld";
  const cols = geld
    ? "2rem minmax(0,1fr) 4.7rem 4.7rem 5.1rem 4.7rem 5.4rem"
    : "2rem minmax(0,1fr) 4.2rem 2.8rem 2.8rem 2.8rem 2.8rem 3.1rem 3rem";
  const ligaNr = liga.liga;
  const kopf = geld
    ? [
        { text: "#" },
        { text: "Team", links: true },
        { text: "Kasse" },
        { text: "Gehalt" },
        { text: "Marktwert" },
        { text: "GuV" },
        { text: "Transfers" },
      ]
    : [
        { text: "#" },
        { text: "Team", links: true },
        { text: "Punkte" },
        { text: <span className="ap">POW</span> },
        { text: <span className="as">SPE</span> },
        { text: <span className="am">MEN</span> },
        { text: <span className="ao">SOC</span> },
        { text: "Start" },
        { text: "±" },
      ];
  return (
    <section className="pan" key={`liga-${ligaNr}`} data-testid={`historie-liga-${ligaNr ?? 0}`}>
      <div className="pk">
        <h2>{ligaNr != null ? `Liga ${ligaNr}` : "Tabelle"}</h2>
        <small>Endtabelle {saison.label}</small>
        <span className="sp" />
        <Seg
          ariaLabel="Sport oder Geld"
          wert={sicht}
          onWahl={onSicht}
          optionen={[
            { id: "sport", label: "Sport" },
            { id: "geld", label: "Geld" },
          ]}
        />
      </div>
      <div className="tl">
        <ThZeile raster={cols} spalten={kopf} />
        {liga.zeilen.map((zeile) => {
          const zone = zeile.meister ? " zm" : zeile.abstieg ? " zd" : zeile.aufstieg ? " zu" : "";
          return (
            <div
              key={zeile.teamId}
              className={`tz${zone}${zeile.teamId === ownTeamId ? " ich" : ""}`}
              style={{ gridTemplateColumns: cols }}
              onClick={() => onTeam(zeile.teamId)}
              role="row"
              data-testid={`historie-zeile-${zeile.teamId}`}
            >
              <span className="rg">{zeile.rank ?? "—"}</span>
              <span className="nm">
                <Wappen teamId={zeile.teamId} name={zeile.teamName} />
                <span>{zeile.teamName}</span>
                <ZeilenMarke zeile={zeile} />
              </span>
              {geld ? (
                <>
                  <span>{fmtC(zeile.cash)}</span>
                  <span className="lz">{fmtC(zeile.salary)}</span>
                  <span>{fmtC(zeile.marketValue)}</span>
                  <span>
                    <Cv wert={zeile.guv} einheit={false} />
                  </span>
                  <span>
                    {zeile.seasonNummer === 1 ? (
                      <span className="null" title="Kaderaufbau aus dem Startbudget, kein Transfer">
                        —
                      </span>
                    ) : (
                      <Cv wert={zeile.transferNet} einheit={false} />
                    )}
                  </span>
                </>
              ) : (
                <>
                  <b className="gr">{fmtZahl(zeile.points)}</b>
                  <span className="aw">{fmtZahl(zeile.pow, 0)}</span>
                  <span className="aw">{fmtZahl(zeile.spe, 0)}</span>
                  <span className="aw">{fmtZahl(zeile.men, 0)}</span>
                  <span className="aw">{fmtZahl(zeile.soc, 0)}</span>
                  <span className="lz">{zeile.startplatz != null ? `${zeile.startplatz}.` : "—"}</span>
                  <span className={zeile.rankDiff == null || zeile.rankDiff === 0 ? "null" : zeile.rankDiff > 0 ? "plus" : "minus"}>
                    {zeile.rankDiff == null || zeile.rankDiff === 0 ? "–" : zeile.rankDiff > 0 ? `▲${zeile.rankDiff}` : `▼${-zeile.rankDiff}`}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="fuss">
        {ligaNr === 1 ? (
          <>
            <span>
              <i className="z" style={{ background: "var(--gold)" }} />
              Meister
            </span>
            <span>
              <i className="z" style={{ background: "var(--warn)" }} />
              Platz 14 bis 16 steigen ab
            </span>
          </>
        ) : ligaNr === 2 ? (
          <span>
            <i className="z" style={{ background: "var(--gut)" }} />
            Platz 1 bis 3 steigen auf
          </span>
        ) : null}
        <span className="sp" />
        <span>
          {geld
            ? saison.nummer === 1
              ? "Saison 1: Kaderaufbau aus dem Startbudget, Transferbilanz bleibt —"
              : "Stand zum Saisonende · Transfers = Fenster vor der Saison"
            : "Start = Platz nach Kaderstärke vor Spieltag 1"}
        </span>
      </div>
    </section>
  );
}

function Meisterkarte({ zeile, titel, gold, onTeam }: { zeile: HistorieTeamSaison | null; titel: string; gold?: boolean; onTeam: (id: string) => void }) {
  if (!zeile) return <div className="mei" style={{ opacity: 0.5 }}><span><small>{titel}</small><b>—</b></span></div>;
  return (
    <button type="button" className={`mei${gold ? " go" : ""}`} onClick={() => onTeam(zeile.teamId)}>
      <Wappen teamId={zeile.teamId} name={zeile.teamName} klein={false} />
      <span>
        <small>{titel}</small>
        <b>{zeile.teamName}</b>
        <em>{fmtZahl(zeile.points)} Punkte</em>
      </span>
    </button>
  );
}

export default function HistorieArchiv({ gameState, ownTeamId, onOpenTeam, onWechsel, onOpenSaisonstand }: HistorieHostBasis) {
  const { saisons, live } = useHistorieDaten(gameState);
  const glieder = useMemo(() => baueZeitleistenGlieder(saisons, live), [saisons, live]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [sicht, setSicht] = useState<Sicht>("sport");
  const [blattTeam, setBlattTeam] = useState<string | null>(null);

  const saison = saisons.find((eintrag) => eintrag.seasonId === gewaehlt) ?? saisons[saisons.length - 1] ?? null;
  const verlauf = useMemo(() => (blattTeam ? baueTeamVerlauf(saisons, blattTeam) : null), [saisons, blattTeam]);

  const rekord = useMemo(() => rekordmeister(saisons), [saisons]);
  const eigenerVerlauf = useMemo(() => (ownTeamId ? baueTeamVerlauf(saisons, ownTeamId) : null), [saisons, ownTeamId]);
  const bandKpis = (
    <HistorieBandKpis
      items={[
        { label: "Abgeschlossen", wert: saisons.length, klein: saisons.length === 1 ? "Saison" : "Saisons" },
        { label: "Rekordmeister", wert: rekord ? rekord.teamCode : "—", klein: rekord && rekord.titel > 1 ? `${rekord.titel}×` : undefined },
        { label: "Dein bester Platz", wert: eigenerVerlauf ? positionText(eigenerVerlauf.besterPosition) : "—" },
        { label: "Gewählt", wert: saison ? saison.label : "—" },
      ]}
    />
  );

  if (!saison) {
    return (
      <HistorieSeite className="h-archiv" testId="historie-archiv">
        {bandKpis}
        <HistorieZeitleiste
          modus="archiv"
          glieder={glieder}
          eigenesTeamId={ownTeamId}
          auswahl=""
          onWahl={() => {}}
          onWechsel={(reiter, seasonId) => onWechsel(reiter, seasonId)}
          onOpenSaisonstand={onOpenSaisonstand}
        />
        <section className="pan voll">
          <div className="pb">
            <div className="leer">
              <b>Noch keine abgeschlossene Saison</b>
              Das Archiv füllt sich mit dem Ende von Saison 1: Endtabellen beider Ligen, Meister, Auf- und Absteiger. Bis dahin
              steht der Zwischenstand im Saisonstand.
              <br />
              <br />
              <button type="button" className="kn" onClick={onOpenSaisonstand}>
                Zum Saisonstand ›
              </button>
            </div>
          </div>
        </section>
      </HistorieSeite>
    );
  }

  const eigen = saison.ligen.flatMap((liga) => liga.zeilen).find((zeile) => zeile.teamId === ownTeamId) ?? null;
  const diff = eigen?.rankDiff ?? null;
  const klettererListe = [...saison.kletterer, ...saison.absturz];

  return (
    <HistorieSeite className="h-archiv" testId="historie-archiv">
      {bandKpis}
      <HistorieZeitleiste
        modus="archiv"
        glieder={glieder}
        eigenesTeamId={ownTeamId}
        auswahl={saison.seasonId}
        onWahl={setGewaehlt}
        onWechsel={(reiter, seasonId) => onWechsel(reiter, seasonId)}
        onOpenSaisonstand={onOpenSaisonstand}
      />
      {saison.ligen.map((liga) => (
        <Fragment key={liga.liga ?? 0}>
          {ligaKarte({ saison, liga, sicht, onSicht: setSicht, ownTeamId, onTeam: setBlattTeam })}
        </Fragment>
      ))}
      <div className="spalte">
        <section className="pan fix">
          <div className="pk">
            <h2>{saison.label} in Kürze</h2>
          </div>
          <div className="pb">
            <div className="kopfpaar">
              <Meisterkarte zeile={saison.meister} titel="Meister" gold onTeam={setBlattTeam} />
              <Meisterkarte zeile={saison.meisterLiga2} titel="Meister Liga 2" onTeam={setBlattTeam} />
            </div>
            <div className="wechsel">
              <div>
                <small className="plus">▲ Aufsteiger</small>
                <div className="wr">
                  {saison.aufsteiger.map((zeile) => (
                    <button key={zeile.teamId} type="button" onClick={() => setBlattTeam(zeile.teamId)} title={zeile.teamName}>
                      <Wappen teamId={zeile.teamId} name={zeile.teamName} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <small className="minus">▼ Absteiger</small>
                <div className="wr">
                  {saison.absteiger.map((zeile) => (
                    <button key={zeile.teamId} type="button" onClick={() => setBlattTeam(zeile.teamId)} title={zeile.teamName}>
                      <Wappen teamId={zeile.teamId} name={zeile.teamName} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="pan">
          <div className="pk">
            <h2>Kletterer &amp; Absturz</h2>
            <small>Startplatz gegen Endplatz</small>
          </div>
          <div className="pb sc" style={{ paddingTop: ".2rem", paddingBottom: ".2rem" }}>
            {klettererListe.length === 0 ? <p className="txt">Keine Platzverschiebungen in dieser Saison.</p> : null}
            {klettererListe.map((zeile, index) => (
              <button
                key={zeile.teamId}
                type="button"
                className="kz"
                style={index === saison.kletterer.length && index > 0 ? { borderTop: "1px solid var(--linie-2)" } : undefined}
                onClick={() => setBlattTeam(zeile.teamId)}
              >
                <Wappen teamId={zeile.teamId} name={zeile.teamName} />
                <span className="n">{zeile.teamName}</span>
                <small>
                  {zeile.liga != null ? `L${zeile.liga} · ` : ""}
                  {zeile.startplatz ?? "—"}. → {zeile.rank ?? "—"}.
                </small>
                <b className={(zeile.rankDiff ?? 0) > 0 ? "plus" : "minus"}>{fmtVz(zeile.rankDiff, 0)}</b>
              </button>
            ))}
          </div>
        </section>
        {eigen ? (
          <section className="pan fix">
            <div className="pk">
              <h2>Dein Saison-Zeugnis</h2>
              <span className="sp" />
              <button type="button" className="link" onClick={() => setBlattTeam(eigen.teamId)}>
                Verlauf öffnen ›
              </button>
            </div>
            <div className="pb">
              <div className="zeug">
                <Wappen teamId={eigen.teamId} name={eigen.teamName} klein={false} />
                <div>
                  <h3>
                    Platz {eigen.rank ?? "—"}
                    {eigen.liga != null ? ` in Liga ${eigen.liga}` : ""}
                  </h3>
                  <p className="txt" style={{ margin: 0 }}>
                    {eigen.startplatz != null ? (
                      <>
                        Start als Nummer <b>{eigen.startplatz}</b>, Ende auf Platz <b>{eigen.rank ?? "—"}</b>
                        {diff ? ` — ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "Platz" : "Plätze"} ${diff > 0 ? "gutgemacht" : "verloren"}` : " — Platz gehalten"}.{" "}
                      </>
                    ) : (
                      <>
                        Ende auf Platz <b>{eigen.rank ?? "—"}</b>.{" "}
                      </>
                    )}
                    Kasse <b>{fmtC(eigen.cash)} C</b> · Transferbilanz{" "}
                    <b>{eigen.seasonNummer === 1 || eigen.transferNet == null ? "—" : `${fmtVz(eigen.transferNet)} C`}</b>.
                    {eigen.aufstieg ? <b className="plus"> Aufstieg in Liga 1.</b> : null}
                    {eigen.abstieg ? <b className="minus"> Abstieg in Liga 2.</b> : null}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
      <HistorieBlatt
        verlauf={verlauf}
        ewigRang={null}
        onSchliessen={() => setBlattTeam(null)}
        onTeamprofil={onOpenTeam}
        onAlleTransfers={(teamId) => onWechsel("transfers", undefined, teamId)}
      />
    </HistorieSeite>
  );
}

