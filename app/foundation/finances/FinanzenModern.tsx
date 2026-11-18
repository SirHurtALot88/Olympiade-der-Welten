"use client";

/**
 * FINANZEN im Broadcast-Stil (18.11., Finanzkonzept V2). Vorlage: public/mockups/finanzen-modern-18-11.html.
 * Neu gebaut, nicht in die alte Seite eingehaengt (Chris: „genau so einbauen, nicht integrieren“): eigener Kopf mit
 * Kennzahl-Reitern, Hauptpanel mit fuenf Reitern (Uebersicht, Kontoauszug, Budgets, Sponsor, GuV) und Kontext-Panel
 * (Lage, Quelle, Liga). Alle Zahlen kommen aus `buildFinanzSeiteModell` (Kontoauszug, Vorstand-Freigabe, GuV-Posten) —
 * die Seite rechnet nichts ein zweites Mal. Einheit C; Gehaelter gross je Saison, klein je Spieltag.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { BcHero, BcReiter, BcIcon } from "@/components/foundation/broadcast";
import { apronKonjunkturKurzhinweis } from "@/lib/finance/apron-konjunktur-hinweis";
import { buildOperatingGuvHoverText } from "@/lib/finance/guv-breakdown";
import { buildFinanzSeiteModell, type FinanzSeiteModell, type VerlaufPunkt } from "@/lib/finance/finanzseite-modell";
import { ALLES_PUFFER_ANTEIL, type VorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import { vorstandFordertAlleAufEineKarte } from "@/lib/finance/vorstand-budget-aktionen";
import { getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import type { GameState } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import type { FinanceLeagueTableRow, FinancesViewModel } from "@/lib/foundation/finances/finances-types";
import type { SalaryFactorOutlook } from "@/lib/foundation/finances/salary-factor-outlook";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";

import "./finanzen-modern.css";

export type VorstandAktionFn = (input: {
  aktion: "umschichten" | "ruecklage_anzapfen" | "alles_auf_eine_karte" | "vorstand_fordert_annehmen";
  betrag?: number;
}) => Promise<{ ok: boolean; reason: string | null; meldung: string }>;

export type FinanzenModernProps = {
  gameState: GameState;
  teamId: string | null;
  finanzen: FinancesViewModel;
  leagueTable: FinanceLeagueTableRow[];
  salaryFactorOutlook: SalaryFactorOutlook;
  onOpenTeam?: (teamId: string) => void;
  /** Schreibweg (laeuft serverseitig durch den Raum-Schreibschutz). Fehlt er oder darf der Manager nicht, ist die Seite nur lesbar. */
  onVorstandAktion?: VorstandAktionFn;
  kannVerwalten?: boolean;
  /** Reiter, mit dem die Seite aufgeht (Tests und Sprunglinks); sonst die Übersicht. */
  startAnsicht?: FinanzenAnsicht;
  startKontext?: FinanzenKontextReiter;
};

export type FinanzenAnsicht = "uebersicht" | "kontoauszug" | "budgets" | "sponsor" | "guv" | "apron";
type Ansicht = FinanzenAnsicht;
export type FinanzenKontextReiter = "lage" | "quelle" | "liga";
type KontextReiter = FinanzenKontextReiter;

const MINUS = "−";

function zahl(v: number, stellen = 2): string {
  const n = Number.isFinite(v) ? v : 0;
  const t = Math.abs(n).toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
  return n < 0 && Number(t.replace(",", ".").replace(/[^\d.]/g, "")) !== 0 ? `${MINUS}${t}` : t;
}
const C = (v: number, stellen = 2) => `${zahl(v, stellen)} C`;
function Cv(v: number, stellen = 2): string {
  const t = zahl(Math.abs(v), stellen);
  if (Math.abs(v) < 0.005) return `±0 C`;
  return `${v > 0 ? "+" : MINUS}${t} C`;
}
const vz = (v: number) => (v > 0.004 ? "bc-plus" : v < -0.004 ? "bc-minus" : "bc-null");
const klemme = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const PHASEN_TEXT: Record<string, string> = {
  hoch: "hoch",
  standard: "Standard",
  niedrig: "niedrig",
  knapp: "knapp",
  sparauflage: "Sparauflage",
};

function Zeile({ l, w, ton, sum }: { l: ReactNode; w: ReactNode; ton?: string; sum?: boolean }) {
  return (
    <div className={`fin-zl${sum ? " is-sum" : ""}`}>
      <span>{l}</span>
      <strong className={`bc-t ${ton ?? ""}`}>{w}</strong>
    </div>
  );
}

function Topf({ teile, gesamt, marke }: { teile: Array<[number, string]>; gesamt: number; marke?: number | null }) {
  const g = Math.max(gesamt, 0.01);
  return (
    <div className="fin-topf" role="img" aria-label="Aufteilung des Topfes">
      {teile.map(([w, k], i) =>
        w > 0.004 ? <i key={i} className={k} style={{ width: `${klemme((w / g) * 100, 0, 100)}%` }} /> : null,
      )}
      {marke != null ? <u style={{ left: `${klemme((marke / g) * 100, 0, 100)}%` }} /> : null}
    </div>
  );
}

/* ================================================================ Kassenverlauf (Uebersicht) */

function Kassenverlauf({
  verlauf,
  gew,
  onWahl,
  jetzt,
}: {
  verlauf: VerlaufPunkt[];
  gew: number;
  onWahl: (i: number) => void;
  jetzt: number;
}) {
  const n = verlauf.length;
  const werte = verlauf.map((p) => p.kasse);
  const hi = Math.max(...werte, 1);
  const lo = Math.min(...werte, 0);
  const spanne = Math.max(hi - lo, 1);
  const obenRand = hi + spanne * 0.12;
  const untenRand = lo - spanne * 0.06;
  const y = (v: number) => ((obenRand - v) / (obenRand - untenRand)) * 100;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const gebucht = verlauf.map((p, i) => ({ p, i })).filter(({ p }) => p.gebucht || p.art === "start");
  const prog = verlauf.map((p, i) => ({ p, i })).filter(({ p }) => !p.gebucht && p.art !== "start");
  const linie = (liste: Array<{ p: VerlaufPunkt; i: number }>) => liste.map(({ p, i }) => `${x(i)},${y(p.kasse)}`).join(" ");
  const letzteGebucht = gebucht[gebucht.length - 1];
  const progLinie = letzteGebucht ? [letzteGebucht, ...prog] : prog;
  const nullY = y(0);
  const achse = [hi, (hi + lo) / 2, lo].map((v) => Math.round(v * 10) / 10);
  return (
    <>
      <div className="fin-ch" data-testid="fin-kassenverlauf">
        {achse.map((v, i) => (
          <span key={i} className="fin-ax bc-t" style={{ top: `${y(v)}%` }}>
            {zahl(v, 0)}
          </span>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {lo < 0 ? <rect x="0" y={nullY} width="100" height={100 - nullY} fill="rgba(255,96,88,.10)" /> : null}
          <line x1="0" x2="100" y1={nullY} y2={nullY} stroke="rgba(244,230,196,.3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {gebucht.length > 1 ? (
            <>
              <polygon points={`${x(gebucht[0]!.i)},100 ${linie(gebucht)} ${x(letzteGebucht!.i)},100`} fill="rgba(242,160,61,.12)" />
              <polyline points={linie(gebucht)} fill="none" stroke="#F2A03D" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </>
          ) : null}
          {progLinie.length > 1 ? (
            <polyline points={linie(progLinie)} fill="none" stroke="#f4e6c4" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>
        {verlauf.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={`fin-spalte${i === jetzt ? " is-jetzt" : ""}${gew === i ? " is-gew" : ""}`}
            style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
            aria-label={`${p.art === "ende" ? "Saisonende" : p.art === "start" ? "Start" : `Spieltag ${p.label}`}: Kasse ${C(p.kasse)}`}
            title={`${p.art === "ende" ? "Saisonende" : p.art === "start" ? "Start" : `Spieltag ${p.label}`} · ${C(p.kasse)}${p.gebucht ? "" : " (Prognose)"}`}
            onClick={() => onWahl(i)}
          />
        ))}
        {verlauf.map((p, i) => {
          const zeige = p.art !== "spieltag" || i === jetzt || (p.bewegung !== 0 && p.gebucht);
          return (
            <span key={`pt-${p.id}`}>
              <span className={`fin-pt${p.gebucht || p.art === "start" ? "" : " is-prog"}`} style={{ left: `${x(i)}%`, top: `${y(p.kasse)}%` }} />
              {zeige ? (
                <span
                  className={`fin-wt bc-t${p.gebucht || p.art === "start" ? "" : " is-prog"}${p.kasse < 0 ? " is-rot" : ""}`}
                  style={{ left: `${x(i)}%`, top: `${y(p.kasse)}%` }}
                >
                  {zahl(p.kasse, 1)}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      <div className="fin-xl bc-t" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {verlauf.map((p, i) => (
          <span key={p.id} className={i === jetzt ? "is-jetzt" : undefined}>
            {p.art === "start" ? "Start" : p.art === "ende" ? "Ende" : p.label}
          </span>
        ))}
      </div>
    </>
  );
}

function BewegungsBalken({ verlauf, gew, onWahl }: { verlauf: VerlaufPunkt[]; gew: number; onWahl: (i: number) => void }) {
  const n = verlauf.length;
  const maxBetrag = Math.max(1, ...verlauf.map((p) => Math.abs(p.bewegung)));
  return (
    <>
      <div className="fin-bal" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} data-testid="fin-bewegung">
        {verlauf.map((p, i) => {
          const h = (Math.abs(p.bewegung) / maxBetrag) * 100;
          return (
            <button
              key={p.id}
              type="button"
              className={`${p.gebucht ? "" : "is-prog "}${gew === i ? "is-gew" : ""}`}
              onClick={() => onWahl(i)}
              title={`${p.art === "ende" ? "Saisonende" : p.art === "start" ? "Start" : `Spieltag ${p.label}`}: ${Cv(p.bewegung)}${p.gebucht ? "" : " (Prognose)"}`}
              aria-label={`${p.label}: ${Cv(p.bewegung)}`}
            >
              {Math.abs(p.bewegung) > 0.004 ? <i className={p.bewegung < 0 ? "is-minus" : ""} style={{ height: `${Math.max(4, h)}%` }} /> : null}
            </button>
          );
        })}
      </div>
      <div className="fin-bn bc-t" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {verlauf.map((p) => (
          <span key={p.id} className={Math.abs(p.bewegung) < 0.005 ? "bc-null" : vz(p.bewegung)}>
            {Math.abs(p.bewegung) < 0.005 ? "" : zahl(p.bewegung, 1)}
          </span>
        ))}
      </div>
    </>
  );
}

function Uebersicht({ m, gew, setGew }: { m: FinanzSeiteModell; gew: number; setGew: (i: number) => void }) {
  const jetzt = Math.min(m.verlauf.length - 2, Math.max(0, m.spieltag));
  return (
    <>
      <div className="fin-rech is-gross" style={{ "--n": 5 } as CSSProperties}>
        <div className="is-su">
          <small>Kasse jetzt</small>
          <strong className={`bc-t ${m.kasse < 0 ? "bc-minus" : ""}`}>{C(m.kasse)}</strong>
        </div>
        <div>
          <small>Einnahmen bisher</small>
          <strong className="bc-t bc-plus">{Cv(m.einnahmenBisher)}</strong>
        </div>
        <div>
          <small>Ausgaben bisher</small>
          <strong className="bc-t bc-minus">{Cv(m.ausgabenBisher)}</strong>
        </div>
        <div>
          <small>GuV Saison (Prognose)</small>
          <strong className={`bc-t ${vz(m.guvPrognose ?? 0)}`}>{m.guvPrognose == null ? "–" : Cv(m.guvPrognose)}</strong>
        </div>
        <div>
          <small>Prognose Saisonende</small>
          <strong className="bc-t">{C(m.prognoseEnde)}</strong>
        </div>
      </div>
      <Kassenverlauf verlauf={m.verlauf} gew={gew} onWahl={setGew} jetzt={jetzt} />
      <div className="fin-leg" style={{ paddingTop: 0 }}>
        <span>
          <i style={{ "--pc": "#F2A03D" } as CSSProperties} />
          Kasse gebucht
        </span>
        <span>
          <i style={{ "--pc": "#f4e6c4" } as CSSProperties} />
          Prognose
        </span>
        <span>Ein- und Ausgaben je Station: Gold = Zufluss, Rot = Abfluss</span>
      </div>
      <BewegungsBalken verlauf={m.verlauf} gew={gew} onWahl={setGew} />
      <div className="fin-leg" style={{ paddingTop: 6 }}>
        <span>
          Heute bucht das Spiel Sponsor, Gehalt, Gebäude und Kredit am Saisonende; Spieltags-Buchungen gibt es bisher nur für Transfers.
        </span>
      </div>
    </>
  );
}

/* ================================================================ Kontoauszug */

const ART_TEXT: Record<string, string> = {
  transfer_kauf: "Kauf",
  transfer_verkauf: "Verkauf",
  vertragsende_abloese: "Vertragsende",
  sponsor: "Sponsor",
  gehalt_und_sponsor_saisonende: "Saisonabrechnung",
  apron: "Apron",
  vorstandsziele: "Vorstandsziele",
  notfall_kasse: "Notfall-Kasse",
};

function Kontoauszug({ m, gew, onZeile }: { m: FinanzSeiteModell; gew: string | null; onZeile: (id: string) => void }) {
  const zeilen = m.kontoauszug.zeilen;
  const prog = m.verlauf[m.verlauf.length - 1]!;
  const cols = "minmax(86px,0.7fr) minmax(110px,0.9fr) minmax(0,2.2fr) minmax(90px,0.7fr)";
  return (
    <div className="fin-tl" data-testid="fin-kontoauszug">
      {!m.saisonendeGebucht && prog.prognosePosten && prog.prognosePosten.length > 0 ? (
        <div className="fin-hinweis">
          <b>Saisonende erwartet {Cv(prog.bewegung)}</b>
          <span>
            {prog.prognosePosten.map((p) => `${p.label} ${Cv(p.betrag, 1)}`).join(" · ")}
          </span>
        </div>
      ) : null}
      <div className="fin-th" style={{ "--cols": cols } as CSSProperties}>
        <span>Wann</span>
        <span>Art</span>
        <span>Posten</span>
        <span className="fin-re">Betrag</span>
      </div>
      {zeilen.length === 0 ? (
        <div className="fin-leer">
          <b>Noch keine Buchung in dieser Saison.</b> Der Kontoauszug zeigt jede Zeile aus den vorhandenen Ledgern: Transfers, Sponsor,
          Apron und Vorstandsziele. Die Kasse ändert sich erst mit der ersten Buchung.
        </div>
      ) : (
        zeilen.map((z, i) => {
          const id = `${z.zeit ?? "x"}-${i}`;
          return (
            <button
              key={id}
              type="button"
              className={`fin-tz${gew === id ? " is-gew" : ""}`}
              style={{ "--cols": cols } as CSSProperties}
              onClick={() => onZeile(id)}
            >
              <span className="fin-qu">
                {z.phase === "kaufphase" ? "Kaufphase" : z.phase === "saisonende" ? "Saisonende" : z.matchdayId ? `Spieltag ${z.matchdayId.replace(/\D+/g, "") || ""}` : "Saison"}
              </span>
              <span className="fin-qu">{ART_TEXT[z.art] ?? z.art}</span>
              <span className="fin-nm">{z.text}</span>
              <span className={`fin-bt bc-t ${vz(z.betrag)}`}>{Cv(z.betrag)}</span>
            </button>
          );
        })
      )}
    </div>
  );
}

/* ================================================================ Budgets */

function BudgetsAnsicht({
  m,
  gameState,
  onAktion,
  kannSchreiben,
}: {
  m: FinanzSeiteModell;
  gameState: GameState;
  onAktion?: VorstandAktionFn;
  kannSchreiben: boolean;
}) {
  const s = m.stand;
  const fenster = evaluateGamePhaseAction(gameState, "credit_borrow").allowed;
  const nGes = m.spieltageGesamt;
  const [draft, setDraft] = useState<number | null>(null);
  const [anzapf, setAnzapf] = useState<number | null>(null);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "acht"; text: string } | null>(null);
  const [bitte, setBitte] = useState(false);
  const fordert = vorstandFordertAlleAufEineKarte(gameState, m.teamId);
  const alle = s.alleAufEineKarte.aktiv;
  const pzt = Math.round(s.wirksamerAnteil * 100);
  const q0 = Math.round(s.anteil * 100);
  const h = s.herleitung;
  const tUeber = s.investition.frei < 0.005 && s.investition.ausgegeben > s.investition.gesamt + 0.005;
  const gUeber = s.gehalt.ausgegeben > s.gehalt.gesamt + 0.005;
  const umWert = draft ?? s.umschichten.aktuell;
  const rmax = Math.max(0.5, Math.floor(s.umschichten.moeglichBis * 2) / 2);
  const rmin = Math.min(-0.5, Math.ceil(s.umschichten.moeglichVon * 2) / 2);
  const kannUm = s.gedeckelt && kannSchreiben && Boolean(onAktion) && s.umschichten.moeglichBis - s.umschichten.moeglichVon > 0.01;
  const schreib = async (input: Parameters<VorstandAktionFn>[0]) => {
    if (!onAktion) return;
    setBitte(true);
    try {
      const r = await onAktion(input);
      setMeldung({ ton: r.ok ? "gut" : "acht", text: r.meldung });
    } finally {
      setBitte(false);
      setDraft(null);
      setAnzapf(null);
    }
  };
  const stufenText: Array<[number, string]> = [
    [1, "ab 7,5"],
    [0.9, "5 bis 7,5"],
    [0.8, "3 bis 5"],
    [0.7, "1,5 bis 3"],
    [0.5, "unter 1,5"],
  ];
  const tGes = Math.max(s.investition.gesamt, s.investition.ausgegeben, 0.01);
  const gGes = Math.max(h.tragbaresGehalt, s.gehalt.ausgegeben, s.gehalt.gesamt, 0.01);
  const lo = s.lockerung;
  const anzapfWert = anzapf ?? s.ruecklageAnzapfen.bereitsAngezapft;
  const anzapfMax = s.ruecklageAnzapfen.bereitsAngezapft + s.ruecklageAnzapfen.moeglich;
  return (
    <div className="fin-gr" style={{ gridTemplateRows: "auto auto minmax(0, 1fr) auto" }} data-testid="fin-budgets">
      <div className="fin-rech is-gross is-voll" style={{ "--n": 4, margin: 0 } as CSSProperties}>
        <div>
          <small>Freigabe des Vorstands</small>
          <strong className={`bc-t ${s.wirksamerAnteil < 0.6 ? "bc-minus" : ""}`}>
            {s.gedeckelt ? `${pzt} %` : "100 %"}
            {lo.aktiv ? <span style={{ fontSize: 15, color: "var(--bc-gut)" }}> gelockert</span> : null}
          </strong>
        </div>
        <div className="is-su">
          <small>Frei für Ablösen und Gebäude</small>
          <strong className={`bc-t ${tUeber ? "bc-minus" : ""}`}>{C(s.investition.frei)}</strong>
        </div>
        <div className="is-su">
          <small>Frei für Gehalt · je Saison</small>
          <strong className={`bc-t ${gUeber ? "bc-minus" : ""}`}>{C(s.gehalt.frei)}</strong>
        </div>
        <div>
          <small>Kasse jetzt</small>
          <strong className="bc-t">{C(m.kasse)}</strong>
        </div>
      </div>

      <div className="fin-sd is-farbe" style={{ "--pc": "var(--bc-gut)" } as CSSProperties}>
        <div className="fin-kopf">
          Transfer- und Investitionsbudget<small>Ablösen · Gebäude</small>
        </div>
        <div className="fin-in">
          <div className="fin-zl">
            <span className="fin-riesig bc-t">
              {zahl(s.investition.frei)}
              <small>C frei von {zahl(s.investition.gesamt)}</small>
            </span>
          </div>
          <Topf teile={[[s.investition.ausgegeben, "aus"], [s.investition.frei, "frei"], [s.investition.gesperrt, "gesp"]]} gesamt={tGes} />
          <div className="fin-legz">
            <span>
              <i className="aus" />
              ausgegeben {zahl(s.investition.ausgegeben)}
              {s.gebaeudeAusgegeben > 0.004 ? ` (Gebäude ${zahl(s.gebaeudeAusgegeben)})` : ""}
            </span>
            <span>
              <i className="frei" />
              frei
            </span>
            <span>
              <i className="gesp" />
              gesperrt {zahl(s.investition.gesperrt)}
            </span>
          </div>
          <div className="fin-herl">
            <Zeile l="Kasse zu Fensterbeginn" w={C(h.anfangskasse)} />
            {s.gedeckelt && !alle ? (
              <>
                <Zeile
                  l={
                    <>
                      − Rücklage-Ziel
                      <small>
                        Finanzwert {zahl(h.finanzwert, 1)} → {zahl(h.ruecklageQuote * 100, 1)} % vom Budget
                      </small>
                    </>
                  }
                  w={`${MINUS}${zahl(h.ruecklageZiel)} C`}
                />
                <Zeile
                  l={
                    <>
                      − Gehaltspuffer<small>7 Spieltage Gehalt, soweit die Rücklage sie nicht deckt</small>
                    </>
                  }
                  w={`${h.gehaltspuffer > 0.004 ? MINUS : ""}${zahl(h.gehaltspuffer)} C`}
                />
                <Zeile l="= verfügbar" w={C(h.verfuegbar)} sum />
                <Zeile l={`× Freigabe ${q0} %`} w={C(s.anteil * (h.verfuegbar + h.angezapft))} />
                {h.angezapft > 0.004 ? <Zeile l="+ Rücklage angezapft" w={`+${zahl(s.anteil * h.angezapft)} C`} ton="bc-plus" /> : null}
                <Zeile l={`+ Verkaufserlöse ${zahl(h.verkaufserloese)} C × ${q0} %`} w={`+${zahl(s.anteil * h.verkaufserloese)} C`} ton="bc-plus" />
                {lo.aktiv ? <Zeile l={`+ Lockerung auf ${pzt} %`} w={`+${zahl(lo.mehrFrei)} C`} ton="bc-plus" /> : null}
              </>
            ) : alle ? (
              <>
                <Zeile l={`+ Verkaufserlöse ${zahl(h.verkaufserloese)} C`} w={`+${zahl(h.verkaufserloese)} C`} ton="bc-plus" />
                <Zeile l={`− Puffer ${Math.round(ALLES_PUFFER_ANTEIL * 100)} %`} w={`${MINUS}${zahl(ALLES_PUFFER_ANTEIL * (Math.max(0, h.anfangskasse) + h.verkaufserloese))} C`} />
              </>
            ) : (
              <Zeile l="Saison 1: alles freigegeben" w={C(s.investition.gesamt)} />
            )}
            {Math.abs(s.umschichten.aktuell) > 0.004 ? (
              <Zeile
                l={s.umschichten.aktuell > 0 ? "− ins Gehalt umgeschichtet" : "+ aus dem Gehalt umgeschichtet"}
                w={Cv(-s.umschichten.aktuell)}
                ton={vz(-s.umschichten.aktuell)}
              />
            ) : null}
            <Zeile l="= Transferbudget" w={C(s.investition.gesamt)} sum />
          </div>
        </div>
      </div>

      <div className={`fin-sd is-farbe${gUeber ? " is-wir" : ""}`} style={{ "--pc": "var(--bc-p1)" } as CSSProperties}>
        <div className="fin-kopf">
          Gehaltsbudget<small>alle laufenden Verträge</small>
        </div>
        <div className="fin-in">
          <div className="fin-zl">
            <span className={`fin-riesig bc-t ${gUeber ? "bc-minus" : ""}`}>
              {gUeber ? MINUS : ""}
              {zahl(Math.abs(s.gehalt.gesamt - s.gehalt.ausgegeben))}
              <small>
                C je Saison {gUeber ? "über dem Budget" : "frei"} · Budget {zahl(s.gehalt.gesamt)} · {zahl(s.gehalt.gesamt / nGes)} je Spieltag
              </small>
            </span>
          </div>
          <Topf
            teile={[
              [Math.min(s.gehalt.ausgegeben, s.gehalt.gesamt), "geh"],
              [Math.max(0, s.gehalt.gesamt - s.gehalt.ausgegeben), "frei"],
              [Math.max(0, s.gehalt.ausgegeben - s.gehalt.gesamt), "rot"],
              [Math.max(0, h.tragbaresGehalt - Math.max(s.gehalt.gesamt, s.gehalt.ausgegeben)), "gesp"],
            ]}
            gesamt={gGes}
            marke={gUeber ? s.gehalt.gesamt : null}
          />
          <div className="fin-legz">
            <span>
              <i className="geh" />
              laufend {zahl(s.gehalt.ausgegeben)} je Saison
            </span>
            <span>
              <i className="frei" />
              frei
            </span>
            <span>
              <i className="gesp" />
              nicht freigegeben
            </span>
          </div>
          <div className="fin-herl">
            <Zeile l={<>Erwarteter Sponsor<small>0,92 × Anker des Vertrags</small></>} w={C(h.sponsorErwartung)} />
            <Zeile l={<>Gehalt bei Soll-Kader<small>Zielgehalt des Teams</small></>} w={C(h.zielgehalt)} />
            <Zeile l="= tragbares Gehalt" w={C(h.tragbaresGehalt)} sum />
            <Zeile l={`× Freigabe ${Math.round(s.gehalt.quote * 100)} %`} w={C(h.gehaltsbudgetVorUmschichten)} />
            {Math.abs(s.umschichten.aktuell) > 0.004 ? (
              <Zeile
                l={s.umschichten.aktuell > 0 ? "+ aus dem Transfer umgeschichtet" : "− in den Transfer umgeschichtet"}
                w={Cv(s.umschichten.aktuell)}
                ton={vz(s.umschichten.aktuell)}
              />
            ) : null}
            <Zeile l={<>= Gehaltsbudget<small>{zahl(s.gehalt.gesamt / nGes)} C je Spieltag</small></>} w={C(s.gehalt.gesamt)} sum />
          </div>
          {gUeber ? (
            <div className="fin-txt is-acht">Über dem Budget: keine neuen Verträge, keine Erhöhung. Kein Zwangsverkauf.</div>
          ) : null}
        </div>
      </div>

      <div className={`fin-sd${s.anteil < 0.6 ? " is-wir" : ""}`}>
        <div className="fin-kopf">
          Vorstand<small>festgelegt zu Beginn des Transferfensters</small>
        </div>
        <div className="fin-in">
          <div className="fin-zl">
            <span className="fin-riesig bc-t">
              {s.vertrauen == null ? "–" : zahl(s.vertrauen, 1)}
              <small>von 10 Vertrauen</small>
            </span>
            <span style={{ textAlign: "right" }}>Stufe {PHASEN_TEXT[s.stufe]}</span>
          </div>
          <div className="fin-leiter">
            {stufenText.map(([q, t]) => (
              <div key={q} className={`${s.anteil === q ? "is-du" : ""}${lo.aktiv && lo.nachAnteil === q ? " is-ziel" : ""}`}>
                <span>{t}</span>
                <b style={{ width: `${q * 100}%` }} />
                <strong className="bc-t">{Math.round(q * 100)} %</strong>
              </div>
            ))}
          </div>
          <div className="fin-txt">
            {!s.gedeckelt ? (
              <>Saison 1: der Vorstand gibt beide Budgets voll frei. Sein Urteil kommt nach der ersten Saison.</>
            ) : s.anteil >= 1 && !alle ? (
              <>Der Vorstand gibt beide Budgets voll frei. </>
            ) : (
              <>
                Der Vorstand nimmt nichts weg: <b>{C(s.investition.gesperrt)}</b> bleiben auf dem Konto, sind aber nicht ausgebbar.
                {s.stufe === "sparauflage" && !alle ? " Sparauflage: keine Gebäude, kein freiwilliger Kredit." : ""}{" "}
              </>
            )}
            Die Sperre ist hart und gilt für jeden Kauf, jeden Vertrag und jedes Gebäude.
          </div>
        </div>
        <div className="fin-fuss">Nächste Festlegung: Transferfenster Saison {m.saisonNummer + 1}</div>
      </div>

      <div className={`fin-sd${s.gedeckelt ? "" : " is-aus"}`}>
        <div className="fin-kopf">
          Umschichten<small>10 C Transfer ↔ 10 C Jahresgehalt</small>
        </div>
        <div className="fin-in">
          <div className="fin-zl">
            <span>
              <b>
                {Math.abs(umWert) < 0.005
                  ? "Nichts umgeschichtet"
                  : umWert > 0
                    ? `${zahl(umWert)} C Transfer → ${zahl(umWert / nGes)} C Gehalt je Spieltag`
                    : `${zahl(-umWert / nGes)} C Gehalt je Spieltag → ${zahl(-umWert)} C Transfer`}
              </b>
            </span>
            {Math.abs(s.umschichten.aktuell) > 0.004 ? (
              <button type="button" className="fin-btn is-klein" disabled={bitte || !kannUm} onClick={() => schreib({ aktion: "umschichten", betrag: 0 })}>
                Zurücknehmen
              </button>
            ) : null}
          </div>
          <div>
            <input
              type="range"
              className="fin-regler"
              min={rmin}
              max={rmax}
              step={0.5}
              value={umWert}
              disabled={!kannUm || bitte}
              aria-label="Umschichten zwischen Transfer- und Gehaltsbudget"
              onChange={(e) => setDraft(Number(e.target.value))}
              onPointerUp={() => draft != null && schreib({ aktion: "umschichten", betrag: klemme(draft, s.umschichten.moeglichVon, s.umschichten.moeglichBis) })}
              onKeyUp={() => draft != null && schreib({ aktion: "umschichten", betrag: klemme(draft, s.umschichten.moeglichVon, s.umschichten.moeglichBis) })}
            />
            <div className="fin-skl">
              <span>← mehr Transfer</span>
              <span>0</span>
              <span>mehr Gehalt →</span>
            </div>
          </div>
          <Zeile
            l={<>Grenze des Vorstands<small>Gehaltsbudget ± {Math.round(s.umschichten.grenzeAnteil * 100)} %</small></>}
            w={`± ${zahl(s.umschichten.grenze)} C`}
          />
          <Zeile
            l="Jetzt möglich"
            w={`${s.umschichten.moeglichVon < -0.004 && fenster ? `${MINUS}${zahl(-s.umschichten.moeglichVon)}` : "0"} bis +${zahl(s.umschichten.moeglichBis)} C`}
          />
          <div className="fin-txt">
            {!s.gedeckelt
              ? "Umschichten gibt es ab Saison 2. "
              : !fenster
                ? "In der Saison geht nur Transfer → Gehalt (für Verlängerungen). "
                : ""}
            Gilt für diese Saison; im nächsten Fenster rechnet der Vorstand neu.
          </div>
        </div>
      </div>

      {s.anteil >= 1 || alle || !s.gedeckelt ? (
        <div className="fin-sd is-aus">
          <div className="fin-kopf">
            Lockerung nach Verkäufen<small>nur unter 100 %</small>
          </div>
          <div className="fin-in">
            <div className="fin-txt">{lo.gesperrtGrund ?? "Verkaufserlöse sind zu 100 % ausgebbar."}</div>
          </div>
        </div>
      ) : (
        <div className={`fin-sd${lo.aktiv ? " is-farbe" : ""}`} style={{ "--pc": "var(--bc-gut)" } as CSSProperties}>
          <div className="fin-kopf">
            Lockerung nach Verkäufen<small>eine Stufe je Fenster · nur Transfer</small>
          </div>
          <div className="fin-in">
            <div className="fin-zl">
              <span>
                <b>
                  {lo.aktiv
                    ? `Der Vorstand lockert auf ${Math.round(lo.nachAnteil * 100)} %.`
                    : lo.gesperrtGrund ?? `Verkaufe noch ${C(lo.fehlt)}, dann gibt der Vorstand ${Math.round(lo.nachAnteil * 100)} % frei.`}
                </b>
              </span>
            </div>
            <div className="fin-wb" style={{ "--pc": lo.aktiv ? "var(--bc-gut)" : "var(--bc-acht)" } as CSSProperties}>
              <i style={{ width: `${klemme(lo.schwelle > 0 ? (lo.verkaufserloese / lo.schwelle) * 100 : 0, 0, 100)}%` }} />
            </div>
            <Zeile
              l={<>Verkaufserlöse in diesem Fenster<small>{100 - q0} % davon bleiben als Puffer liegen</small></>}
              w={`${C(lo.verkaufserloese)} von ${zahl(lo.schwelle)}`}
            />
            <Zeile l={<>Puffer, den der Vorstand sehen will<small>{Math.round((lo.puffer / Math.max(0.01, h.tragbaresGehalt)) * 100)} % des tragbaren Gehalts</small></>} w={C(lo.puffer)} />
            <Zeile
              l={<>{lo.aktiv ? "Mehr frei durch die Lockerung" : "Mehr frei, sobald die Schwelle erreicht ist"}<small>nie mehr als verkauft</small></>}
              w={`+${zahl(lo.mehrFrei)} C`}
              ton="bc-plus"
            />
            <Zeile l="Boden: die Kasse bleibt über" w={C(lo.boden)} />
          </div>
        </div>
      )}

      <div className="fin-sd is-farbe" style={{ "--pc": "var(--bc-gold)" } as CSSProperties}>
        <div className="fin-kopf">
          Sonderwege<small>kosten Vertrauen · nur im Fenster</small>
        </div>
        <div className="fin-in">
          <div className="fin-rek">
            <span>
              <b>Rücklage anzapfen</b>
              <small>
                bis {zahl(anzapfMax)} C (50 % des Ziels) zusätzlich in den Transfertopf · Vertrauen −{zahl(s.ruecklageAnzapfen.vertrauenskosten)} bisher
              </small>
            </span>
          </div>
          <input
            type="range"
            className="fin-regler"
            min={0}
            max={Math.max(0.5, anzapfMax)}
            step={0.5}
            value={Math.min(anzapfWert, Math.max(0.5, anzapfMax))}
            disabled={!s.gedeckelt || alle || !fenster || !kannSchreiben || bitte || anzapfMax < 0.5}
            aria-label="Rücklage anzapfen"
            onChange={(e) => setAnzapf(Number(e.target.value))}
            onPointerUp={() => anzapf != null && schreib({ aktion: "ruecklage_anzapfen", betrag: anzapf })}
            onKeyUp={() => anzapf != null && schreib({ aktion: "ruecklage_anzapfen", betrag: anzapf })}
          />
          <div className="fin-zl">
            <span>Angezapft</span>
            <strong className="bc-t">{C(anzapfWert)}</strong>
          </div>
          <div className="fin-rek">
            <span>
              <b>Alles auf eine Karte</b>
              <small>
                {alle
                  ? `Aktiv (${s.alleAufEineKarte.zustand?.quelle === "ki" ? "KI" : s.alleAufEineKarte.zustand?.quelle === "vorstand" ? "Vorstand" : "Antrag"}): Ziel Platz ${s.alleAufEineKarte.zustand?.zielRang} oder besser.`
                  : fordert
                    ? "Der Vorstand fordert die Wette von deinem Team: Ziel Top-Platz."
                    : `Alles bis auf ${Math.round(ALLES_PUFFER_ANTEIL * 100)} % Puffer ausgeben. Verfehlt das Team das Ziel, sinkt das Vertrauen.`}
              </small>
            </span>
            {alle ? (
              <span className="fin-marke is-gold">AKTIV</span>
            ) : (
              <button
                type="button"
                className={`fin-btn is-klein ${fordert ? "is-ja" : "is-warn"}`}
                disabled={!s.gedeckelt || !fenster || !kannSchreiben || bitte}
                onClick={() => schreib({ aktion: fordert ? "vorstand_fordert_annehmen" : "alles_auf_eine_karte" })}
              >
                {fordert ? "Annehmen" : "Beantragen"}
              </button>
            )}
          </div>
          {s.zustand.letzterAntragAbgelehnt && !alle ? <div className="fin-meldung">{s.zustand.letzterAntragAbgelehnt.grund}</div> : null}
          {meldung ? <div className={`fin-meldung${meldung.ton === "gut" ? " is-gut" : ""}`}>{meldung.text}</div> : null}
        </div>
      </div>

      <div className="fin-strip">
        <div>
          <span>
            <b>Spieler kaufen</b>
            <small>Ablöse aus dem Transferbudget, Gehalt aus dem Gehaltsbudget</small>
          </span>
          <span className="fin-marke is-gut">BEIDE</span>
        </div>
        <div>
          <span>
            <b>Vertrag verlängern</b>
            <small>Gehaltserhöhung nur aus dem Gehaltsbudget</small>
          </span>
          <span className="fin-marke" style={{ "--pc": "var(--bc-p1)" } as CSSProperties}>
            GEHALT
          </span>
        </div>
        <div>
          <span>
            <b>Gebäude bauen</b>
            <small>nur Transferbudget</small>
          </span>
          <span className="fin-marke is-gut">TRANSFER</span>
        </div>
        <div>
          <span>
            <b>Spieler verkaufen</b>
            <small>Erlös × {q0} % ins Transferbudget, Gehalt voll zurück</small>
          </span>
          <span className="fin-marke is-gold">ZURÜCK</span>
        </div>
        <div>
          <span>
            <b>Pflichtkader (8 Spieler)</b>
            <small>bleibt immer auffüllbar</small>
          </span>
          <span className="fin-marke is-leer">AUSNAHME</span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ Sponsor, GuV */

function SponsorAnsicht({ m, gameState }: { m: FinanzSeiteModell; gameState: GameState }) {
  const vertrag = getTeamSponsorContract(gameState, m.teamId);
  const terms = getSponsorV3Terms(vertrag);
  const sponsor = m.finanzen?.income.sponsor ?? null;
  if (!vertrag) {
    return (
      <div className="fin-leer">
        <b>Kein Sponsor-Vertrag.</b> Ohne Vertrag fließt keine Sponsor-Einnahme. Den Vertrag wählst du in der Ansicht „Sponsoren“.
      </div>
    );
  }
  const erwartet = m.stand.herleitung.sponsorErwartung;
  return (
    <div className="fin-gr" style={{ gridTemplateRows: "auto minmax(0,1fr)" }} data-testid="fin-sponsor">
      <div className="fin-rech is-gross is-voll" style={{ "--n": 4, margin: 0 } as CSSProperties}>
        <div>
          <small>Hauptsponsor</small>
          <strong className="bc-t" style={{ fontSize: "clamp(18px,1.2vw,30px)" }}>{vertrag.name}</strong>
        </div>
        <div className="is-su">
          <small>Erwartete Einnahme</small>
          <strong className="bc-t">{C(erwartet)}</strong>
        </div>
        <div>
          <small>Vertrag</small>
          <strong className="bc-t">{vertrag.seasonsRemaining ?? 1} Saison{(vertrag.seasonsRemaining ?? 1) === 1 ? "" : "en"}</strong>
        </div>
        <div>
          <small>Anker (Erwartungswert)</small>
          <strong className="bc-t">{terms ? C(terms.anchor) : "–"}</strong>
        </div>
      </div>
      <div className="fin-sd is-voll">
        <div className="fin-kopf">
          Was der Vertrag zahlt<small>Zählt als Sponsor-Einnahme der GuV</small>
        </div>
        <div className="fin-in">
          {(sponsor?.components ?? []).length === 0 ? (
            <div className="fin-txt">Der Vertrag hat keine auszahlbaren Komponenten. Die Einnahme ist geschätzt aus der letzten Auszahlung.</div>
          ) : (
            (sponsor?.components ?? []).map((c) => (
              <div className="fin-rek" key={c.kind + c.label}>
                <span>
                  <b>{c.label}</b>
                  <small>{c.kind}</small>
                </span>
                <strong className="bc-t bc-plus">{Cv(c.rewardCash)}</strong>
              </div>
            ))
          )}
          <div className="fin-txt">
            Der Sponsor ist die Hauptquelle des Gehaltsbudgets: erwartet werden <b>{C(erwartet)}</b> (0,92 × Anker). Je besser der Endrang, desto
            mehr Rangbonus kommt am Saisonende.
          </div>
        </div>
      </div>
    </div>
  );
}

function GuvAnsicht({ m, salaryFactorOutlook }: { m: FinanzSeiteModell; salaryFactorOutlook: SalaryFactorOutlook }) {
  const f = m.finanzen;
  if (!f) return <div className="fin-leer"><b>Finanzen werden geladen.</b></div>;
  const posten = f.guvPosten ?? [];
  const cols = "minmax(0,2fr) minmax(0,3fr) minmax(90px,0.8fr)";
  const apron = f.apron;
  return (
    <div className="fin-tl" data-testid="fin-guv">
      <div className="fin-th" style={{ "--cols": cols } as CSSProperties}>
        <span>Posten</span>
        <span>Zusatz</span>
        <span className="fin-re">Betrag</span>
      </div>
      {posten.map((p) => (
        <div
          key={p.key}
          className="fin-tz"
          style={{ "--cols": cols } as CSSProperties}
        >
          <span className="fin-nm">
            {p.label}
            {p.counted ? "" : " (nicht in der GuV)"}
          </span>
          <span className="fin-qu">{p.note ?? ""}</span>
          <span className={`fin-bt bc-t ${vz(p.amount)}`}>{Cv(p.amount)}</span>
        </div>
      ))}
      <div
        className="fin-tz is-su"
        style={{ "--cols": cols } as CSSProperties}
        title={buildOperatingGuvHoverText({ totalIncome: f.totalIncome, totalExpenses: f.totalExpenses, transferNet: f.transfer?.net ?? null })}
      >
        <span className="fin-nm">GuV der Saison</span>
        <span className="fin-qu">Einnahmen {C(f.totalIncome)} − Ausgaben {C(f.totalExpenses)}</span>
        <span className={`fin-bt bc-t ${vz(f.guv)}`}>{Cv(f.guv)}</span>
      </div>
      {apron ? (
        <div className="fin-hinweis" style={{ marginTop: 8 }}>
          <b>Apron</b>
          <span>
            Gehaltsbasis {C(apron.salaryBasis)} · Linie 1 {C(apron.line1)} · Linie 2 {C(apron.line2)} ·{" "}
            {apron.nettoDelta === 0 ? "keine Abgabe" : `${Cv(apron.nettoDelta)} erwartet`}.{" "}
            {apronKonjunkturKurzhinweis({ konjunkturhebel: apron.konjunkturhebel, salaryFactor: apron.salaryFactor })}
          </span>
        </div>
      ) : null}
      {f.loanCommitments.rows.length > 0 ? (
        <div className="fin-hinweis" aria-label="Kredit-Verpflichtungen">
          <b>Kredite</b>
          <span>
            Rate {C(f.loanCommitments.installmentTotal)} (davon Zins {C(f.loanCommitments.interestTotal)}, Tilgung {C(f.loanCommitments.principalTotal)}) · offen{" "}
            {C(f.loanCommitments.outstandingTotal)}
          </span>
        </div>
      ) : null}
      <div className="fin-hinweis">
        <b>Gehaltsfaktor</b>
        <span>
          Saison {salaryFactorOutlook.currentFactor == null ? "–" : zahl(salaryFactorOutlook.currentFactor)}×
          {salaryFactorOutlook.nextFactor != null ? ` · nächste Saison ${zahl(salaryFactorOutlook.nextFactor)}×` : ""}
        </span>
      </div>
    </div>
  );
}

function ApronAnsicht({ m, eigene, onOpenTeam }: { m: FinanzSeiteModell; eigene: string; onOpenTeam?: (id: string) => void }) {
  const a = m.finanzen?.apron ?? null;
  if (!a) {
    return (
      <div className="fin-leer">
        <b>Der Apron ist für dieses Team nicht berechenbar.</b> Es fehlt ein Kader oder die Liga-Gehälter.
      </div>
    );
  }
  const zoneText = a.zone === "unter_linie_1" ? "unter beiden Linien" : a.zone === "zwischen_den_linien" ? "zwischen den Linien" : "über Linie 2";
  const cols = "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)";
  return (
    <div className="fin-tl" data-testid="fin-apron">
      <div className="fin-rech is-gross" style={{ "--n": 5 } as CSSProperties}>
        <div>
          <small>Median-Gehalt der Liga</small>
          <strong className="bc-t">{C(a.medianSalary)}</strong>
        </div>
        <div>
          <small>Linie 1 (Median × 1,1)</small>
          <strong className="bc-t">{C(a.line1)}</strong>
        </div>
        <div>
          <small>Linie 2 (Median × 1,25)</small>
          <strong className="bc-t">{C(a.line2)}</strong>
        </div>
        <div className="is-su">
          <small>Deine Gehaltsbasis</small>
          <strong className="bc-t">{C(a.salaryBasis)}</strong>
        </div>
        <div>
          <small>{a.gebucht ? "Apron gebucht" : "Apron erwartet"}</small>
          <strong className={`bc-t ${vz(a.nettoDelta)}`}>{Cv(a.nettoDelta)}</strong>
        </div>
      </div>
      <div className="fin-hinweis" style={{ marginTop: 10 }}>
        <b>Du liegst {zoneText}.</b>
        <span>
          {apronKonjunkturKurzhinweis({ konjunkturhebel: a.konjunkturhebel, salaryFactor: a.salaryFactor })}
          {a.frozenLines ? "" : " Die Linien sind noch nicht eingefroren: sie wandern, solange das Kauffenster offen ist."}
        </span>
      </div>
      <div className="fin-th" style={{ "--cols": cols } as CSSProperties}>
        <span>Team</span>
        <span className="fin-re">Gehaltsbasis</span>
        <span className="fin-re">Abstand Linie 1</span>
        <span className="fin-re">Netto</span>
      </div>
      {a.league.map((r) => {
        const inhalt = (
          <>
            <span className="fin-nm">
              {r.teamName}
              {r.teamId === eigene ? " · Dein Team" : ""}
              {r.rolle === "zahler" ? <span className="fin-marke is-warn" style={{ marginLeft: 8 }}>ZAHLT</span> : null}
              {r.rolle === "empfaenger" ? <span className="fin-marke is-gut" style={{ marginLeft: 8 }}>ERHÄLT</span> : null}
            </span>
            <span className="fin-bt bc-t">{zahl(r.salaryBasis, 1)}</span>
            <span className={`fin-bt bc-t ${r.distanceLine1 > 0 ? "bc-minus" : "bc-plus"}`}>{zahl(r.distanceLine1, 1)}</span>
            <span className={`fin-bt bc-t ${vz(r.nettoDelta)}`}>{Cv(r.nettoDelta, 1)}</span>
          </>
        );
        const klasse = `fin-tz${r.teamId === eigene ? " is-gew" : ""}`;
        const style = { "--cols": cols } as CSSProperties;
        return onOpenTeam ? (
          <button key={r.teamId} type="button" className={klasse} style={style} onClick={() => onOpenTeam(r.teamId)}>
            {inhalt}
          </button>
        ) : (
          <div key={r.teamId} className={klasse} style={style}>
            {inhalt}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================ Kontext */

function KontextLage({ m, onAnsicht }: { m: FinanzSeiteModell; onAnsicht: (a: Ansicht) => void }) {
  const ende = m.verlauf[m.verlauf.length - 1]!;
  const farbe = m.lage.ton === "gut" ? "var(--bc-gut)" : m.lage.ton === "acht" ? "var(--bc-acht)" : "var(--bc-warn)";
  const posten = ende.prognosePosten ?? [];
  return (
    <div className="fin-kontext-kb" data-testid="fin-lage">
      <div className="fin-geg" style={{ "--pc": farbe } as CSSProperties}>
        <span className="fin-gic">
          <BcIcon name={m.lage.ton === "gut" ? "check" : "info"} />
        </span>
        <div>
          <b>{m.lage.titel}</b>
          <span>{m.lage.text}</span>
        </div>
      </div>
      <div className="fin-rech" style={{ "--n": 3 } as CSSProperties}>
        <div>
          <small>Kasse</small>
          <strong className={`bc-t ${m.kasse < 0 ? "bc-minus" : ""}`}>{zahl(m.kasse)}</strong>
        </div>
        <div>
          <small>Gehaltsraten</small>
          <strong className="bc-t">{zahl(m.gehaltsraten)}</strong>
        </div>
        <div className="is-su">
          <small>Saisonende</small>
          <strong className="bc-t">{zahl(m.prognoseEnde)}</strong>
        </div>
      </div>
      <div className="fin-ab2">
        <div className="fin-gk">
          <span>Gehälter</span>
          <em>je Saison, klein je Spieltag</em>
        </div>
        <div className="fin-rek">
          <span>
            <b>{C(m.gehaltSaison)} je Saison</b>
            <small>
              {C(m.gehaltJeSpieltag)} je Spieltag · {m.spieltageGesamt} Spieltage
            </small>
          </span>
        </div>
      </div>
      <div className="fin-ab2">
        <div className="fin-gk">
          <span>{m.saisonendeGebucht ? "Saisonende gebucht" : "Saisonende"}</span>
          <em>{m.saisonendeGebucht ? "gebucht" : "Erwartung"}</em>
        </div>
        {posten.length === 0 ? (
          <div className="fin-txt">{m.saisonendeGebucht ? "Die Saisonabrechnung ist im Kontoauszug." : "Noch keine erwarteten Posten."}</div>
        ) : (
          posten.map((p) => (
            <div className="fin-rek" key={p.key}>
              <span>
                <b>{p.label}</b>
              </span>
              <strong className={`bc-t ${vz(p.betrag)}`}>{Cv(p.betrag)}</strong>
            </div>
          ))
        )}
        <div className="fin-rek">
          <span>
            <b>Saldo</b>
            <small>Kasse danach {C(ende.kasse)}</small>
          </span>
          <strong className={`bc-t ${vz(ende.bewegung)}`}>{Cv(ende.bewegung)}</strong>
        </div>
      </div>
      <div className="fin-ab2">
        <div className="fin-gk">
          <span>Prognose Saisonende</span>
          <em>± {zahl(m.prognoseSpanne, 1)} C je offenem Spieltag</em>
        </div>
        <div className="fin-rek">
          <span>
            <b>
              {C(m.prognoseEnde - m.prognoseSpanne)} bis {C(m.prognoseEnde + m.prognoseSpanne)}
            </b>
            <small>Tiefster Stand {C(m.tiefsterStand)}</small>
          </span>
          <strong className="bc-t">{C(m.prognoseEnde)}</strong>
        </div>
      </div>
      <div className="fin-akt">
        <button type="button" className="fin-btn is-klein" onClick={() => onAnsicht("budgets")}>
          <BcIcon name="blitz" />
          Budgets
        </button>
        <button type="button" className="fin-btn is-klein" onClick={() => onAnsicht("kontoauszug")}>
          Kontoauszug
        </button>
        <button type="button" className="fin-btn is-klein" onClick={() => onAnsicht("guv")}>
          GuV
        </button>
      </div>
    </div>
  );
}

function KontextQuelle({ m, gew }: { m: FinanzSeiteModell; gew: number }) {
  const p = m.verlauf[gew] ?? m.verlauf[0]!;
  const titel = p.art === "start" ? "Start der Saison" : p.art === "ende" ? "Saisonende" : `Spieltag ${p.label}`;
  return (
    <div className="fin-kontext-kb" data-testid="fin-quelle">
      <div className="fin-geg" style={{ "--pc": "var(--bc-heim)" } as CSSProperties}>
        <span className="fin-gic">
          <BcIcon name="liste" />
        </span>
        <div>
          <b>{titel}</b>
          <span>
            {p.gebucht ? "gebucht" : "Prognose"} · Kasse danach {C(p.kasse)}
          </span>
        </div>
      </div>
      <div className="fin-rech" style={{ "--n": 3 } as CSSProperties}>
        <div className="is-su">
          <small>Bewegung</small>
          <strong className={`bc-t ${vz(p.bewegung)}`}>{Cv(p.bewegung, 1)}</strong>
        </div>
        <div>
          <small>Zeilen</small>
          <strong className="bc-t">{p.zeilen.length || (p.prognosePosten?.length ?? 0)}</strong>
        </div>
        <div>
          <small>Status</small>
          <strong>{p.gebucht ? "Gebucht" : "Erwartet"}</strong>
        </div>
      </div>
      <div className="fin-ab2">
        <div className="fin-gk">
          <span>Zeilen dieser Station</span>
        </div>
        {p.zeilen.length === 0 && !(p.prognosePosten?.length ?? 0) ? (
          <div className="fin-txt">Keine Buchung. Die Kasse bleibt, wie sie ist.</div>
        ) : null}
        {p.zeilen.map((z, i) => (
          <div className="fin-rek" key={i}>
            <span>
              <b>{z.text}</b>
              <small>{ART_TEXT[z.art] ?? z.art} · aus {z.quelle}</small>
            </span>
            <strong className={`bc-t ${vz(z.betrag)}`}>{Cv(z.betrag)}</strong>
          </div>
        ))}
        {(p.prognosePosten ?? []).map((z) => (
          <div className="fin-rek" key={z.key}>
            <span>
              <b>{z.label}</b>
              <small>Erwartung aus der GuV</small>
            </span>
            <strong className={`bc-t ${vz(z.betrag)}`}>{Cv(z.betrag)}</strong>
          </div>
        ))}
      </div>
      <div className="fin-ab2">
        <div className="fin-gk">
          <span>Gezeigt = gebucht</span>
        </div>
        <div className="fin-txt">
          Diese Zahlen stehen genau so im Kontoauszug und in der GuV. Es gibt keine zweite Rechnung.
        </div>
      </div>
    </div>
  );
}

function KontextLiga({ rows, eigene, onOpenTeam }: { rows: FinanceLeagueTableRow[]; eigene: string; onOpenTeam?: (id: string) => void }) {
  const sortiert = useMemo(() => [...rows].sort((a, b) => b.cash - a.cash), [rows]);
  const cols = "minmax(0,1.6fr) minmax(54px,0.7fr) minmax(54px,0.7fr)";
  return (
    <div className="fin-tl" data-testid="fin-liga">
      <div className="fin-th" style={{ "--cols": cols, padding: "0 10px" } as CSSProperties}>
        <span>Team</span>
        <span className="fin-re">Kasse</span>
        <span className="fin-re">GuV p.a.</span>
      </div>
      {sortiert.map((r) => {
        const inhalt = (
          <>
            <span className="fin-nm">
              {r.teamName}
              {r.teamId === eigene ? " · Dein Team" : ""}
            </span>
            <span className={`fin-bt bc-t ${r.cash < 0 ? "bc-minus" : ""}`}>{zahl(r.cash, 1)}</span>
            <span className={`fin-bt bc-t ${vz(r.guv)}`}>{zahl(r.guv, 1)}</span>
          </>
        );
        const style = { "--cols": cols, padding: "0 10px" } as CSSProperties;
        const klasse = `fin-tz${r.teamId === eigene ? " is-gew" : ""}`;
        return onOpenTeam ? (
          <button key={r.teamId} type="button" className={klasse} style={style} onClick={() => onOpenTeam(r.teamId)}>
            {inhalt}
          </button>
        ) : (
          <div key={r.teamId} className={klasse} style={style}>
            {inhalt}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================ Seite */

export default function FinanzenModern({
  gameState,
  teamId,
  finanzen,
  leagueTable,
  salaryFactorOutlook,
  onOpenTeam,
  onVorstandAktion,
  kannVerwalten = false,
  startAnsicht = "uebersicht",
  startKontext = "lage",
}: FinanzenModernProps) {
  const [ansicht, setAnsicht] = useState<Ansicht>(startAnsicht);
  const [kontext, setKontext] = useState<KontextReiter>(startKontext);
  const [gewStation, setGewStation] = useState<number | null>(null);
  const [gewZeile, setGewZeile] = useState<string | null>(null);

  const m = useMemo(() => (teamId ? buildFinanzSeiteModell(gameState, teamId, finanzen) : null), [gameState, teamId, finanzen]);

  if (!teamId || !m) {
    return (
      <div className="bc fin" data-testid="finanzen-modern">
        <div className="fin-leer">
          <b>Kein Team gewählt.</b> Die Finanzen zeigen immer das eigene Team.
        </div>
      </div>
    );
  }

  const stationJetzt = Math.min(m.verlauf.length - 2, Math.max(0, m.spieltag));
  const gew = gewStation != null && gewStation < m.verlauf.length ? gewStation : stationJetzt;
  const wahlStation = (i: number) => {
    setGewStation(i);
    setKontext("quelle");
  };
  const s: VorstandBudgetStand = m.stand;
  const wappen = getStaticTeamLogoUrl(teamId) ?? gameState.teams.find((t) => t.teamId === teamId)?.logoPath ?? null;
  const ende = m.verlauf[m.verlauf.length - 1]!;
  const tabs: Array<[Ansicht, string]> = [
    ["uebersicht", "Übersicht"],
    ["kontoauszug", "Kontoauszug"],
    ["budgets", "Budgets"],
    ["sponsor", "Sponsor"],
    ["guv", "GuV"],
    ["apron", "Apron"],
  ];
  const titel: Record<Ansicht, [string, string]> = {
    uebersicht: ["Kassenverlauf", "Klick auf eine Station öffnet ihre Buchungen"],
    kontoauszug: ["Kontoauszug", "Jede Zeile aus den vorhandenen Ledgern, nichts doppelt gerechnet"],
    budgets: ["Zwei Budgets des Vorstands", "Das Geld bleibt auf dem Konto. Begrenzt ist, was du ausgeben darfst."],
    sponsor: ["Sponsor", "Der Vertrag trägt das Gehaltsbudget"],
    guv: ["Gewinn und Verlust", "Alle Posten der Saison, gezeigt = gebucht"],
    apron: ["Apron", "Wer wegen hoher Gehälter zahlt und wer ausgeschüttet bekommt"],
  };
  const spieltagText = m.spieltag <= 0 ? "VOR SPIELTAG 1" : `NACH SPIELTAG ${m.spieltag} VON ${m.spieltageGesamt}`;

  return (
    <div className="bc fin" data-testid="finanzen-modern">
      <BcHero
        wappen={wappen}
        wappenAlt={m.teamName}
        dachzeile={
          <>
            Saison {m.saisonNummer} · {spieltagText}
          </>
        }
        titel="Finanzen"
        untertitel={
          <>
            {m.teamName} · Kasse <b className="bc-t">{C(m.kasse)}</b> · <span style={{ color: m.lage.ton === "gut" ? "var(--bc-gut)" : m.lage.ton === "acht" ? "var(--bc-acht)" : "var(--bc-warn)" }}>{m.lage.titel}</span>
          </>
        }
        mitte={
          <>
            <BcReiter
              aktiv={ansicht === "uebersicht" || ansicht === "kontoauszug" || ansicht === "guv"}
              onClick={() => setAnsicht("uebersicht")}
              eyebrow={m.spieltag <= 0 ? "Vor Spieltag 1" : `Nach Spieltag ${m.spieltag}`}
              titel="Kasse"
              symbol={<BcIcon name="karte" />}
              wert={zahl(m.kasse)}
              wertNote="C"
            />
            <BcReiter
              aktiv={ansicht === "budgets"}
              onClick={() => setAnsicht("budgets")}
              eyebrow={`Freigabe ${s.gedeckelt ? Math.round(s.wirksamerAnteil * 100) : 100} %`}
              titel="Budgets"
              symbol={<BcIcon name="krone" />}
              wert={zahl(s.investition.frei, 1)}
              wertNote="C frei"
            />
            <BcReiter
              aktiv={ansicht === "sponsor"}
              onClick={() => setAnsicht("sponsor")}
              eyebrow="Erwartung"
              titel="Sponsor"
              symbol={<BcIcon name="team" />}
              wert={zahl(s.herleitung.sponsorErwartung, 1)}
              wertNote="C je Saison"
            />
          </>
        }
        rechts={
          <div className="fin-hr">
            <div className="fin-frist">
              <em>{m.saisonendeGebucht ? "Saisonabrechnung gebucht" : "Saisonende · erwartet"}</em>
              <strong className={`bc-t ${vz(ende.bewegung)}`}>{Cv(ende.bewegung)}</strong>
            </div>
            <button type="button" className="fin-btn" onClick={() => setAnsicht("kontoauszug")}>
              Kontoauszug <BcIcon name="rechts" />
            </button>
          </div>
        }
      />
      <div className="fin-work">
        <section className="fin-pan" aria-label="Finanzen">
          <div className="fin-ktabs" role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={ansicht === id} className={ansicht === id ? "is-an" : ""} onClick={() => setAnsicht(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="fin-pk">
            <h2>{titel[ansicht][0]}</h2>
            <span className="fin-hin">{titel[ansicht][1]}</span>
            <span className="fin-sp" />
            {ansicht === "budgets" ? (
              <span className="fin-seg" aria-label="Phase">
                <button type="button" aria-pressed={evaluateGamePhaseAction(gameState, "credit_borrow").allowed} disabled>
                  Fenster
                </button>
                <button type="button" aria-pressed={!evaluateGamePhaseAction(gameState, "credit_borrow").allowed} disabled>
                  Saison
                </button>
              </span>
            ) : null}
          </div>
          <div className="fin-kb">
            {ansicht === "uebersicht" ? <Uebersicht m={m} gew={gew} setGew={wahlStation} /> : null}
            {ansicht === "kontoauszug" ? <Kontoauszug m={m} gew={gewZeile} onZeile={setGewZeile} /> : null}
            {ansicht === "budgets" ? (
              <BudgetsAnsicht m={m} gameState={gameState} onAktion={onVorstandAktion} kannSchreiben={kannVerwalten} />
            ) : null}
            {ansicht === "sponsor" ? <SponsorAnsicht m={m} gameState={gameState} /> : null}
            {ansicht === "guv" ? <GuvAnsicht m={m} salaryFactorOutlook={salaryFactorOutlook} /> : null}
            {ansicht === "apron" ? <ApronAnsicht m={m} eigene={teamId} onOpenTeam={onOpenTeam} /> : null}
          </div>
          <div className="fin-kf">
            <span>
              <i style={{ background: "var(--bc-heim)" }} />
              Kasse gebucht
            </span>
            <span>
              <i style={{ background: "var(--bc-creme)" }} />
              Prognose
            </span>
            <span className="fin-sp" />
            <span>Einheit C · Gehälter je Saison, klein je Spieltag</span>
          </div>
        </section>
        <aside className="fin-pan" aria-label="Kontext">
          <div className="fin-ktabs" role="tablist">
            {(
              [
                ["lage", "Lage"],
                ["quelle", "Quelle"],
                ["liga", "Liga"],
              ] as Array<[KontextReiter, string]>
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={kontext === id} className={kontext === id ? "is-an" : ""} onClick={() => setKontext(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="fin-kb">
            {kontext === "lage" ? <KontextLage m={m} onAnsicht={setAnsicht} /> : null}
            {kontext === "quelle" ? <KontextQuelle m={m} gew={gew} /> : null}
            {kontext === "liga" ? <KontextLiga rows={leagueTable} eigene={teamId} onOpenTeam={onOpenTeam} /> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

