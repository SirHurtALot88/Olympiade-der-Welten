"use client";

/**
 * KREDITE als Reiter der Finanzseite (22.11.). Vorlage: public/mockups/kredite-modern-22-11.html, Konzept docs/design/kredite-modern-22-11.md.
 * Neu gebaut, nicht in die alte Seite eingehaengt: drei Tafeln auf einem Bildschirm -- was schulde ich (laufende Kredite, Tilgungsplan),
 * was kostet ein neuer Kredit wirklich (Rechner mit Wirkung), wie stehe ich in der Liga da (Vergleich, Register).
 *
 * Die Seite rechnet nichts selbst: `baueKreditSeitenModell` und `baueKreditVorschau` (lib/finance/kredite-seite-modell.ts) lesen Rahmen,
 * Konditionen, Plan und Sperren aus dem Kern; die Vorschau simuliert die echte Aufnahme. Geschrieben wird nur ueber den Server
 * (`POST /api/finance/loan/originate` und `/early-payoff`, beide hinter `authorizeServerRoomWrite`); die Seite ruft nur die Callbacks der Shell.
 * Rang 1 = geringste Schulden (Rangregel 21.11.). Alle Tabellen sortierbar. Einheit C; Rate gross je Saison, klein je Spieltag.
 */

import { useDeferredValue, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { BcIcon } from "@/components/foundation/broadcast";
import { getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { FinanzSeiteModell } from "@/lib/finance/finanzseite-modell";
import {
  baueKreditPlan,
  baueKreditSeitenModell,
  baueKreditVorschau,
  KREDIT_LAUFZEITEN,
  SCHULDENDIENST_KI_GRENZE,
  SCHULDENDIENST_OBERGRENZE,
  type KreditPlanModell,
  type KreditZeile,
  type LigaZeile,
  type RegisterZeile,
  type WirkungsZeile,
} from "@/lib/finance/kredite-seite-modell";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { useTabellenSortierung } from "@/lib/ui/tabellen-sortierung";

import "./kredite-modern.css";

export type KreditAufnahmeFn = (principal: number, termSeasons: number, lenderTeamId: string | null) => Promise<{ ok: boolean; reason: string | null }>;
export type KreditAbloeseFn = (loanId: string) => Promise<{ ok: boolean; reason: string | null; payoff: number | null }>;

/* ---------------------------------------------------------------- Format */

const MINUS = "−";
function zahlDe(v: number, st = 1): string {
  const betrag = Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: st, maximumFractionDigits: st });
  return (v < 0 && Math.round(Math.abs(v) * 10 ** st) > 0 ? MINUS : "") + betrag;
}
const z1 = (v: number) => zahlDe(v, 1);
const z2 = (v: number) => zahlDe(v, 2);
const pz = (v: number, st = 1) => `${zahlDe(v * 100, st)} %`;
const geld = (v: number, st = 1) => `${zahlDe(v, st)} C`;
const mitVz = (v: number, st = 1) => (v > 0.0001 ? "+" : "") + zahlDe(v, st);

const FEHLER_TEXT: Record<string, string> = {
  over_capacity: "Über dem Kreditrahmen.",
  not_preseason: "Kredite gibt es nur in der Vorsaison und vor dem ersten Spieltag.",
  schuldendienst_obergrenze: "Über 20 % der Planeinnahmen: der Vorstand verlangt erst Verkäufe.",
  vorstand_sparauflage: "Sparauflage des Vorstands: kein freiwilliger Kredit.",
  lender_insufficient_cash: "Der Geber leiht diesen Betrag nicht mehr.",
  lender_hostile_relationship: "Dieser Geber leiht dir nichts.",
  distress_defaulted_debt: "Ein geplatzter Kredit sperrt neue Kredite.",
  not_available: "Nicht möglich: Seite nur lesbar oder nicht dein Team.",
  network_error: "Keine Verbindung zum Server.",
  stale_season: "Die Saison hat gewechselt. Seite neu laden.",
};

function Warnzeichen() {
  return (
    <svg viewBox="0 0 24 24" className="bc-icon" aria-hidden="true" focusable="false">
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.5" />
    </svg>
  );
}

/** Rang 1 = geringster Wert (Rangregel: bei Schulden, Raten und Zins ist wenig besser). Gleichstand teilt den Rang. */
function rangeNiedrigBesser<T>(liste: readonly T[], wert: (x: T) => number): Map<T, number> {
  const aus = new Map<T, number>();
  for (const x of liste) aus.set(x, 1 + liste.filter((y) => wert(y) < wert(x) - 1e-9).length);
  return aus;
}

type Kopf = { aktiv: boolean; pfeil: string; ariaSort: "ascending" | "descending" | "none"; onKlick: () => void };
function KKopf({ text, kopf, re, titel }: { text: string; kopf: Kopf; re?: boolean; titel?: string }) {
  return (
    <button type="button" className={`kre-sk${kopf.aktiv ? " is-an" : ""}${re ? " is-re" : ""}`} onClick={kopf.onKlick} aria-sort={kopf.ariaSort} title={titel}>
      {text}
      <span className="kre-pf">{kopf.pfeil || " ▴"}</span>
    </button>
  );
}

/* ---------------------------------------------------------------- Tafel 1 */

function Kennzahlen({ k }: { k: NonNullable<ReturnType<typeof baueKreditSeitenModell>> }) {
  const bankQuote = k.schuldendienst;
  const quoteFarbe = bankQuote > SCHULDENDIENST_OBERGRENZE ? "var(--bc-warn)" : bankQuote > SCHULDENDIENST_KI_GRENZE ? "var(--bc-acht)" : "var(--bc-gut)";
  return (
    <div className="kre-kz" data-testid="kre-kennzahlen">
      <div>
        <span className="bc-gk">Schulden</span>
        <strong className="bc-t">{geld(k.schulden)}</strong>
        <small>{k.kredite.filter((x) => x.status === "active").length} laufend</small>
      </div>
      <div>
        <span className="bc-gk">Rate je Saison</span>
        <strong className="bc-t">{geld(k.rateJeSaison)}</strong>
        <small className="bc-t">{z2(k.rateJeSpieltag)} C je Spieltag</small>
      </div>
      <div>
        <span className="bc-gk">Ø Zins</span>
        <strong className="bc-t">{k.schulden > 0 ? pz(k.zinsSchnitt) : "–"}</strong>
        <small>je Saison</small>
      </div>
      <div>
        <span className="bc-gk">Rahmen frei</span>
        <strong className="bc-t">{geld(k.rahmenFrei)}</strong>
        <div className="kre-bk">
          <i style={{ width: `${Math.min(100, k.auslastung * 100)}%`, background: "var(--bc-acht)" }} />
        </div>
        <small className="bc-t">
          {pz(k.auslastung, 0)} von {z1(k.rahmenGesamt)} C genutzt
        </small>
      </div>
      <div>
        <span className="bc-gk">Schuldendienst</span>
        <strong className={`bc-t${bankQuote > SCHULDENDIENST_OBERGRENZE ? " bc-minus" : ""}`}>{k.planEinnahmen > 0 ? pz(bankQuote) : "–"}</strong>
        <div className="kre-bk">
          <i style={{ width: `${Math.min(100, (bankQuote / SCHULDENDIENST_OBERGRENZE) * 100)}%`, background: quoteFarbe }} />
        </div>
        <small>Grenze 20 % der Planeinnahmen</small>
      </div>
    </div>
  );
}

function PlanDiagramm({ k, kredit, pm }: { k: NonNullable<ReturnType<typeof baueKreditSeitenModell>>; kredit: KreditZeile; pm: KreditPlanModell }) {
  const voll = pm.gesamt ?? pm.plan;
  const heute = pm.gesamt ? pm.gezahlt : 0;
  const breite = 600;
  const hoehe = 210;
  const bw = breite / Math.max(1, voll.jeRate.length);
  const maxA = Math.max(0.0001, pm.rate);
  const balken: ReactNode[] = [];
  let linie = `M0,${(hoehe - hoehe * 0.98).toFixed(1)}`;
  voll.jeRate.forEach((r, i) => {
    const x = i * bw;
    const hz = (r.zins / maxA) * hoehe * 0.5;
    const ht = (r.tilgung / maxA) * hoehe * 0.5;
    const bez = i < heute;
    balken.push(
      <rect key={`z${i}`} x={(x + bw * 0.14).toFixed(1)} y={(hoehe - hz).toFixed(1)} width={(bw * 0.72).toFixed(1)} height={hz.toFixed(1)} fill="#ff6058" opacity={bez ? 0.35 : 0.95} />,
      <rect key={`t${i}`} x={(x + bw * 0.14).toFixed(1)} y={(hoehe - hz - ht).toFixed(1)} width={(bw * 0.72).toFixed(1)} height={ht.toFixed(1)} fill="#f0c35a" opacity={bez ? 0.35 : 0.95} />,
    );
    linie += ` L${((i + 1) * bw).toFixed(1)},${(hoehe - (r.rest / Math.max(0.0001, pm.gesamt ? kredit.aufgenommen : kredit.restschuld)) * hoehe * 0.98).toFixed(1)}`;
  });
  const marken: ReactNode[] = [];
  const labels: ReactNode[] = [];
  let xs = 0;
  voll.saisons.forEach((s, j) => {
    if (j > 0) marken.push(<line key={`m${j}`} x1={xs * bw} x2={xs * bw} y1={0} y2={hoehe} stroke="rgba(244,230,196,.25)" strokeDasharray="3 4" />);
    if (s.raten >= 8) {
      labels.push(
        <span key={`l${j}`} style={{ left: `${(xs / Math.max(1, voll.jeRate.length)) * 100}%` }}>
          Saison {s.saison}
        </span>,
      );
    }
    xs += s.raten;
  });
  const hx = heute * bw;
  return (
    <div className="kre-chart" data-testid="kre-diagramm">
      <div className="kre-cl bc-gk">{labels}</div>
      <svg viewBox={`0 0 ${breite} ${hoehe}`} preserveAspectRatio="none" role="img" aria-label="Zins, Tilgung und Restschuld je Rate">
        {marken}
        {balken}
        <path d={linie} fill="none" stroke="#f4e6c4" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        {pm.gesamt ? <line x1={hx} x2={hx} y1={0} y2={hoehe} stroke="#62d394" strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      <div className="kre-ct">
        <span>{pm.gesamt ? "Rate 1" : "nächste Rate"}</span>
        <span className="bc-plus">{pm.gesamt ? `grün: heute, ${pm.gezahlt} Raten bezahlt` : `${pm.gezahlt} Raten bezahlt`}</span>
        <span>Rate {voll.raten}</span>
      </div>
      <span className="bc-sr">Saison {k.saisonNummer}</span>
    </div>
  );
}

function Tilgungsplan({ k, kredit, pm }: { k: NonNullable<ReturnType<typeof baueKreditSeitenModell>>; kredit: KreditZeile; pm: KreditPlanModell }) {
  const voll = pm.gesamt ?? pm.plan;
  const summe = voll.saisons.reduce((s, x) => ({ n: s.n + x.raten, zins: s.zins + x.zins, tilg: s.tilg + x.tilgung }), { n: 0, zins: 0, tilg: 0 });
  return (
    <div className="kre-tp" data-testid="kre-tilgungsplan">
      <div className="kre-tpk">
        <h3>Tilgungsplan · {kredit.geberName}</h3>
        <span className="bc-t kre-leise">
          {z1(pm.gesamt ? kredit.aufgenommen : kredit.restschuld)} C · {pz(kredit.zins)} · {voll.raten} Raten
        </span>
        <span className="kre-sp" />
        <span className="kre-leg">
          <span>
            <i style={{ background: "var(--bc-warn)" }} />
            Zins
          </span>
          <span>
            <i style={{ background: "var(--bc-gold)" }} />
            Tilgung
          </span>
          <span>
            <i style={{ background: "var(--bc-creme)" }} />
            Restschuld
          </span>
        </span>
      </div>
      <div className="kre-tpb">
        <PlanDiagramm k={k} kredit={kredit} pm={pm} />
        <div className="kre-plan">
          <div className="kre-pzh">
            <span>Saison</span>
            <span className="is-re">Raten</span>
            <span className="is-re">Zins</span>
            <span className="is-re">Tilgung</span>
            <span className="is-re">Summe</span>
            <span className="is-re">Rest</span>
          </div>
          <div className="kre-pzk">
            {voll.saisons.map((s) => (
              <div key={s.saison} className={`kre-pz${s.saison === pm.saisonJetzt ? " is-jetzt" : ""}`}>
                <span>
                  Saison {s.saison} <small>ST {s.von}–{s.bis}</small>
                </span>
                <span className="is-re bc-t">{s.raten}</span>
                <span className="is-re bc-t bc-minus">{z1(s.zins)}</span>
                <span className="is-re bc-t">{z1(s.tilgung)}</span>
                <span className="is-re bc-t">
                  <b>{z1(s.zins + s.tilgung)}</b>
                </span>
                <span className="is-re bc-t">{z1(s.rest)}</span>
              </div>
            ))}
            <div className="kre-pz is-sum">
              <span>Gesamt</span>
              <span className="is-re bc-t">{summe.n}</span>
              <span className="is-re bc-t bc-minus">{z1(summe.zins)}</span>
              <span className="is-re bc-t">{z1(summe.tilg)}</span>
              <span className="is-re bc-t">{z1(summe.zins + summe.tilg)}</span>
              <span className="is-re bc-t">0,0</span>
            </div>
          </div>
          <div className="kre-sts">
            <span className="bc-gk">
              Saison {k.saisonNummer} je Spieltag · Rate {z2(pm.rate)} C
            </span>
            <div className="kre-rw" style={{ "--n": pm.spieltage.length } as CSSProperties}>
              {pm.spieltage.map((s) => (
                <i
                  key={s.spieltag}
                  className={s.zustand === "bezahlt" ? "bez" : s.zustand === "naechste" ? "heu" : s.zustand === "offen" ? "off" : ""}
                  title={`Spieltag ${s.spieltag}: ${s.zustand === "bezahlt" ? "Rate bezahlt" : s.zustand === "naechste" ? `nächste Rate ${z2(pm.rate)} C` : s.zustand === "offen" ? "offen" : "noch kein Kredit"}`}
                >
                  {s.spieltag}
                </i>
              ))}
            </div>
            <p>
              {k.jeSpieltag
                ? "Grün bezahlt, Gold offen, kräftig Gold die nächste Rate. Zins zählt in der GuV, Tilgung nur in der Kasse."
                : "Bis zum nächsten Saisonwechsel zahlt dieser Kredit noch die Jahresrate am Saisonende; danach je Spieltag wie hier gezeigt."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LaufendeKredite({
  k,
  gameState,
  kannVerwalten,
  onAbloesen,
}: {
  k: NonNullable<ReturnType<typeof baueKreditSeitenModell>>;
  gameState: GameState;
  kannVerwalten: boolean;
  onAbloesen?: KreditAbloeseFn;
}) {
  const [gewId, setGewId] = useState<string | null>(null);
  const [bestaetige, setBestaetige] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { sortiert: liste, kopf } = useTabellenSortierung(
    k.kredite,
    {
      geber: { wert: (x) => x.geberName, standard: "auf" },
      aufgenommen: { wert: (x) => x.aufgenommen },
      rest: { wert: (x) => x.restschuld },
      zins: { wert: (x) => x.zins, standard: "auf" },
      raten: { wert: (x) => x.ratenOffen, standard: "auf" },
      rate: { wert: (x) => x.rateJeSaison, standard: "auf" },
    },
    { key: "rest", richtung: "ab" },
  );
  const gew = k.kredite.find((x) => x.loanId === gewId) ?? k.kredite.find((x) => x.status === "active") ?? k.kredite[0] ?? null;
  const loan = gew ? (gameState.seasonState.loans ?? []).find((l) => l.loanId === gew.loanId) ?? null : null;
  const pm = useMemo(() => (loan ? baueKreditPlan(gameState, loan, k.teamId) : null), [gameState, loan, k.teamId]);
  const abloeseErlaubt = kannVerwalten && !!onAbloesen && evaluateGamePhaseAction(gameState, "credit_early_payoff").allowed;
  const cols = "minmax(8em,1.5fr) 4.2em 5em 3.8em 6.2em 6em 5em";

  const abloesen = async (id: string) => {
    if (!onAbloesen || busy) return;
    setBusy(true);
    const r = await onAbloesen(id);
    setBusy(false);
    setBestaetige(null);
    setMeldung(r.ok ? { ok: true, text: `Abgelöst${r.payoff != null ? ` für ${geld(r.payoff)}` : ""}.` } : { ok: false, text: FEHLER_TEXT[r.reason ?? ""] ?? "Ablösen nicht möglich." });
  };

  return (
    <section className="fin-pan kre-lk" id="kre-p1" aria-label="Laufende Kredite">
      <div className="fin-pk">
        <h2>Laufende Kredite</h2>
        <span className="fin-sp" />
        <span className="fin-hin">Rate groß je Saison, klein je Spieltag</span>
      </div>
      <Kennzahlen k={k} />
      {k.kredite.length === 0 ? (
        <>
          <div className="kre-leer">
            <strong>Kein Kredit läuft</strong>
            Das Team ist schuldenfrei. Der Rahmen von <b className="bc-t">{geld(k.rahmenFrei)}</b> steht offen (15 % der Kasse + 30 % des Kaderwerts von {z1(k.kaderwert)} C).
          </div>
          <div className="kre-tp kre-so">
            <div className="kre-tpk">
              <h3>So wird ein Kredit getilgt</h3>
            </div>
            <div className="kre-erkl">
              <p>
                Jeder Kredit läuft in <b>{k.n} Raten je Saison</b>, eine je Spieltag. Die Rate ist über die Laufzeit gleich; am Anfang steckt mehr Zins darin, am Ende mehr Tilgung.
              </p>
              <p>
                In der GuV zählt nur der <b>Zins</b>. Die Tilgung senkt die Kasse, ist aber kein Verlust.
              </p>
              <p>Vorzeitig ablösen kostet die Restschuld plus 20 % der Zinsen, die dem Geber entgehen.</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="kre-tbl" role="table" aria-label="Laufende Kredite" data-testid="kre-kredite">
            <div className="kre-th" style={{ "--cols": cols } as CSSProperties} role="row">
              <KKopf text="Geber" kopf={kopf("geber")} />
              <KKopf text="Aufgen." kopf={kopf("aufgenommen")} re />
              <KKopf text="Restschuld" kopf={kopf("rest")} re />
              <KKopf text="Zins" kopf={kopf("zins")} re />
              <KKopf text="Restlaufzeit" kopf={kopf("raten")} re />
              <KKopf text="Rate" kopf={kopf("rate")} re />
              <span className="is-re">Aktion</span>
            </div>
            {liste.map((x) => {
              const logo = x.geberId ? getStaticTeamLogoUrl(x.geberId) : null;
              return (
                <div
                  key={x.loanId}
                  role="row"
                  tabIndex={0}
                  className={`kre-tz${gew?.loanId === x.loanId ? " is-gew" : ""}${x.status !== "active" ? " is-aus" : ""}`}
                  style={{ "--cols": cols } as CSSProperties}
                  onClick={() => setGewId(x.loanId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setGewId(x.loanId);
                  }}
                >
                  <span className="kre-geber">
                    <span className="kre-gi">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" />
                      ) : (
                        <BcIcon name="bank" />
                      )}
                    </span>
                    <span>
                      <b>{x.geberName}</b>
                      <small>
                        Saison {x.aufgenommenSaison} · {x.laufzeitSaisons} {x.laufzeitSaisons === 1 ? "Saison" : "Saisons"}
                        {x.status === "defaulted" ? " · geplatzt" : ""}
                      </small>
                    </span>
                  </span>
                  <span className="is-re kre-z bc-t">{z1(x.aufgenommen)}</span>
                  <span className="is-re kre-gz bc-t">
                    <b>{z1(x.restschuld)} C</b>
                    <small>{pz(x.getilgtAnteil, 0)} getilgt</small>
                  </span>
                  <span className="is-re kre-z bc-t">{pz(x.zins)}</span>
                  <span className="is-re kre-gz bc-t">
                    <b>{x.ratenOffen} Raten</b>
                    <small>
                      {x.ratenGezahlt} von {x.ratenGesamt} bezahlt
                    </small>
                  </span>
                  <span className="is-re kre-gz bc-t">
                    <b>{z1(x.rateJeSaison)} C</b>
                    <small>{z2(x.rateJeSpieltag)} C je Spieltag</small>
                  </span>
                  <span className="is-re">
                    <button
                      type="button"
                      className="kre-btn kre-klein"
                      disabled={x.status !== "active" || !abloeseErlaubt}
                      title={!abloeseErlaubt ? "Ablösen geht nur in der Vorsaison und vor dem ersten Spieltag." : "Plan und Ablösesumme zeigen"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setGewId(x.loanId);
                        setBestaetige(x.loanId);
                        setMeldung(null);
                      }}
                    >
                      Ablösen
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          {gew && pm && gew.status === "active" ? <Tilgungsplan k={k} kredit={gew} pm={pm} /> : <div className="kre-tp" />}
          {gew && gew.status === "active" ? (
            <div className="kre-abl" data-testid="kre-abloese">
              <BcIcon name="info" />
              <span>
                Heute ablösen: <b className="bc-t">{geld(gew.abloese)}</b> = Restschuld {z1(gew.restschuld)} + Gebühr {z1(gew.abloeseGebuehr)} (20 % der entgangenen Zinsen)
              </span>
              <span className="kre-sp" />
              {meldung ? <span className={meldung.ok ? "bc-plus" : "bc-minus"}>{meldung.text}</span> : null}
              {bestaetige === gew.loanId ? (
                <>
                  <button type="button" className="kre-btn kre-klein kre-ja" disabled={busy || !abloeseErlaubt} onClick={() => abloesen(gew.loanId)}>
                    Jetzt für {z1(gew.abloese)} C ablösen
                  </button>
                  <button type="button" className="kre-btn kre-klein" onClick={() => setBestaetige(null)}>
                    Abbrechen
                  </button>
                </>
              ) : (
                <span>
                  spart <b className="bc-t bc-plus">{geld(gew.abloeseSpart)}</b> Zins
                </span>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- Tafel 2 */

function WirkungText(z: WirkungsZeile, offen: number): { l: string; k: string } {
  switch (z.schluessel) {
    case "kasse":
      return { l: "Kasse", k: "sofort" };
    case "transfertopf":
      return { l: "Transfertopf", k: "freier Betrag" };
    case "rate":
      return { l: "Raten je Saison", k: "Fixkosten" };
    case "guv":
      return { l: "GuV dieser Saison", k: "nur der Zins zählt" };
    case "bisSaisonende":
      return { l: "Raten bis Saisonende", k: `${offen} Spieltage` };
    default:
      return { l: "Gesamtkosten", k: "Zinsen über die Laufzeit" };
  }
}

function NeuerKredit({
  k,
  gameState,
  m,
  kannVerwalten,
  onAufnehmen,
}: {
  k: NonNullable<ReturnType<typeof baueKreditSeitenModell>>;
  gameState: GameState;
  m: FinanzSeiteModell;
  kannVerwalten: boolean;
  onAufnehmen?: KreditAufnahmeFn;
}) {
  const max = Math.max(1, Math.floor(k.rahmenFrei));
  const [betragRoh, setBetrag] = useState(8);
  const [laufzeit, setLaufzeit] = useState(2);
  const [geberWahl, setGeberWahl] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const betrag = Math.max(1, Math.min(max, betragRoh));
  const betragSpaet = useDeferredValue(betrag);
  const kein = k.rahmenFrei < 1;
  const v = useMemo(
    () => (kein ? null : baueKreditVorschau(gameState, k.teamId, { betrag: betragSpaet, laufzeit, geberId: geberWahl, guvAktuell: m.guvPrognose })),
    [gameState, k.teamId, betragSpaet, laufzeit, geberWahl, m.guvPrognose, kein],
  );
  const sperre = !kannVerwalten ? "Nur lesbar: dieses Team gehört dir nicht oder die Seite ist gesperrt." : !onAufnehmen ? "Aufnahme nicht verfügbar." : (v?.sperre ?? k.phaseSperre);
  const gesperrt = kein || !v?.gewaehlt || !!sperre || busy;
  const qNeu = v?.quoteNeu ?? 0;
  const qAlt = v?.quoteAlt ?? k.schuldendienst;

  const aufnehmen = async () => {
    if (!onAufnehmen || !v?.gewaehlt || gesperrt) return;
    setBusy(true);
    const r = await onAufnehmen(betragSpaet, laufzeit, v.gewaehlt.geberId);
    setBusy(false);
    setMeldung(r.ok ? { ok: true, text: `${z1(betragSpaet)} C aufgenommen.` } : { ok: false, text: FEHLER_TEXT[r.reason ?? ""] ?? "Aufnahme nicht möglich." });
  };

  return (
    <section className="fin-pan" id="kre-p2" aria-label="Neuer Kredit">
      <div className="fin-pk">
        <h2>Neuer Kredit</h2>
        <span className="fin-sp" />
        <span className="fin-hin">Rechner · nichts ist gebucht</span>
      </div>
      <div className="kre-re">
        {k.notkredit ? (
          <div className="kre-hinw" data-testid="kre-notkredit">
            <Warnzeichen />
            <span>
              <b>Kasse im Minus ({geld(-k.notkredit.fehlbetrag)}).</b> Steht sie am Ende des Kauffensters noch im Minus, legt die Bank einen Notkredit auf: Fehlbetrag{" "}
              <b className="bc-t">{geld(k.notkredit.fehlbetrag)}</b>, {k.notkredit.saisons} Saisons, {pz(k.notkredit.zins)}, Rate {z2(k.notkredit.rateJeSpieltag)} C je Spieltag. Ein eigener Kredit vorher kommt dem zuvor.
            </span>
          </div>
        ) : null}
        <div className="kre-feld">
          <div className="kre-zl">
            <span className="bc-gk">Betrag</span>
            <span className="kre-sp" />
            <strong className="bc-t" id="kre-bz">{z1(betrag)} C</strong>
            <span className="bc-t">von {z1(k.rahmenFrei)} C Rahmen</span>
          </div>
          <input
            type="range"
            min={1}
            max={max}
            step={1}
            value={betrag}
            disabled={kein}
            style={{ "--f": `${max > 1 ? ((betrag - 1) / (max - 1)) * 100 : 100}%` } as CSSProperties}
            onChange={(e) => {
              setBetrag(Number(e.target.value));
              setMeldung(null);
            }}
            aria-label="Kreditbetrag"
          />
          <div className="kre-skala bc-t">
            <span>1</span>
            <span>{Math.round(max / 2)}</span>
            <span>{max} C</span>
          </div>
        </div>
        <div className="kre-feld kre-lz">
          <span className="bc-gk">Laufzeit</span>
          <div className="kre-seg" role="group" aria-label="Laufzeit in Saisons">
            {KREDIT_LAUFZEITEN.map((nn) => (
              <button key={nn} type="button" aria-pressed={nn === laufzeit} onClick={() => setLaufzeit(nn)}>
                {nn}
              </button>
            ))}
          </div>
          <span className="kre-leise bc-t kre-nowrap">
            {laufzeit === 1 ? "Saison" : "Saisons"} · {laufzeit * k.n} Raten
          </span>
        </div>
        <div className="kre-ang" data-testid="kre-angebote">
          <div className="kre-anh">
            <span style={{ width: "1.9em" }} />
            <span>Geber</span>
            <span className="is-re">Zins</span>
            <span className="is-re">Rate</span>
            <span className="is-re">Zinsen</span>
          </div>
          {(v?.angebote ?? []).map((a) => {
            const logo = a.geberId ? getStaticTeamLogoUrl(a.geberId) : null;
            const gew = v?.gewaehlt && v.gewaehlt.geberId === a.geberId;
            return (
              <button
                key={a.geberId ?? "bank"}
                type="button"
                className="kre-an"
                aria-pressed={!!gew}
                disabled={!a.ok}
                onClick={() => {
                  setGeberWahl(a.geberId);
                  setMeldung(null);
                }}
              >
                <span className="kre-geber">
                  <span className="kre-gi">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="" />
                    ) : (
                      <BcIcon name="bank" />
                    )}
                  </span>
                </span>
                <span className="kre-geber">
                  <span>
                    <b>{a.geberName}</b>
                    <small>
                      {a.guenstigstes ? <span className="kre-marke">günstigstes</span> : null}
                      {a.geberId ? `leiht bis ${z1(a.maxBetrag)} C` : `Finanzwert ${z1(k.finanzwert)} von 10`}
                    </small>
                  </span>
                </span>
                <span className={`is-re kre-z bc-t${a.guenstigstes ? " kre-best" : ""}`}>{pz(a.zins)}</span>
                <span className="is-re kre-gz bc-t">
                  <b>{z1(a.rateJeSaison)} C</b>
                  <small>{z2(a.rateJeSpieltag)} je Spieltag</small>
                </span>
                <span className="is-re kre-z bc-t bc-minus">{z1(a.gesamtZinsen)} C</span>
              </button>
            );
          })}
          {kein ? <div className="kre-leer kre-leer-klein">Kein Rahmen frei: Kasse und Kaderwert tragen keinen weiteren Kredit.</div> : null}
        </div>
        <div className="kre-wk" data-testid="kre-wirkung">
          <div className="kre-wz kre-wzk">
            <span>Wirkung</span>
            <span className="is-re">heute</span>
            <span />
            <span className="is-re">mit Kredit</span>
            <span className="is-re">Änderung</span>
          </div>
          {(v?.wirkung ?? []).map((z) => {
            const t = WirkungText(z, v?.offeneSpieltage ?? 0);
            return (
              <div key={z.schluessel} className="kre-wz">
                <span className="kre-l">
                  {t.l}
                  <small>{t.k}</small>
                </span>
                <span className="is-re bc-t kre-leise">{z.alt == null ? "–" : geld(z.alt)}</span>
                <span className="kre-pfeil">→</span>
                <span className="is-re bc-t">
                  <b>{z.neu == null ? "–" : geld(z.neu)}</b>
                </span>
                <span className={`is-re bc-t ${z.gut == null ? "bc-null" : z.gut ? "bc-plus" : "bc-minus"}`}>{z.aenderung == null ? "–" : `${mitVz(z.aenderung)} C`}</span>
              </div>
            );
          })}
        </div>
        <div className="kre-quote" data-testid="kre-quote">
          <div className="kre-qz">
            <span className="bc-gk">Schuldendienst an den Planeinnahmen ({z1(k.planEinnahmen)} C)</span>
            <b className={`bc-t${qNeu > SCHULDENDIENST_OBERGRENZE ? " bc-minus" : ""}`}>
              {pz(qAlt)} → {pz(qNeu)}
            </b>
          </div>
          <div className="kre-qb">
            <i className={qNeu > SCHULDENDIENST_OBERGRENZE ? "rot" : "neu"} style={{ width: `${Math.min(100, (qNeu / 0.3) * 100)}%` }} />
            <i className="alt" style={{ width: `${Math.min(100, (qAlt / 0.3) * 100)}%` }} />
            <u style={{ left: "33.33%" }} data-t="10 % KI-Grenze" />
            <u style={{ left: "66.67%" }} data-t="20 % Obergrenze" />
          </div>
        </div>
        <div className="kre-fuss">
          <span className="kre-txt">
            {meldung ? (
              <b className={meldung.ok ? "bc-plus" : "bc-minus"}>{meldung.text}</b>
            ) : sperre ? (
              <b className="bc-minus">{sperre}</b>
            ) : (
              `Der Betrag landet im Transfertopf und unterliegt der Freigabe (${pz(k.vorstand.anteil, 0)}). Erste Rate am Spieltag ${v?.ersteRateSpieltag ?? 1}.`
            )}
          </span>
          <button type="button" className="kre-btn kre-ja" disabled={gesperrt} onClick={aufnehmen} data-testid="kre-aufnehmen">
            <BcIcon name="check" />
            {z1(betrag)} C aufnehmen
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Tafel 3 */

function LigaVergleich({ k }: { k: NonNullable<ReturnType<typeof baueKreditSeitenModell>> }) {
  const [ansicht, setAnsicht] = useState<"liga" | "alle" | "register">("liga");
  const meineLiga = k.liga.find((x) => x.teamId === k.teamId)?.liga ?? null;
  const ligaLabel = meineLiga === "liga1" ? "Liga 1" : meineLiga === "liga2" ? "Liga 2" : "Liga";
  const zeilen = useMemo(() => (ansicht === "alle" || !meineLiga ? k.liga : k.liga.filter((x) => x.liga === meineLiga)), [k.liga, ansicht, meineLiga]);
  const { sortiert, zustand, kopf } = useTabellenSortierung<LigaZeile, "team" | "schuld" | "rate" | "quote" | "zins">(
    zeilen,
    {
      team: { wert: (x) => x.name, standard: "auf" },
      schuld: { wert: (x) => x.schulden, standard: "auf" },
      rate: { wert: (x) => x.rateJeSaison, standard: "auf" },
      quote: { wert: (x) => x.quote, standard: "auf" },
      zins: { wert: (x) => x.bankZins, standard: "auf" },
    },
    { key: "schuld", richtung: "auf" },
  );
  const rk = zustand?.key && zustand.key !== "team" ? zustand.key : "schuld";
  const wertVon = (x: LigaZeile) => (rk === "schuld" ? x.schulden : rk === "rate" ? x.rateJeSaison : rk === "quote" ? x.quote : x.bankZins);
  const rang = useMemo(() => rangeNiedrigBesser(zeilen, wertVon), [zeilen, rk]); // eslint-disable-line react-hooks/exhaustive-deps
  const rangAlle = useMemo(() => rangeNiedrigBesser(k.liga, (x) => x.schulden), [k.liga]);
  const cols = "2.2em minmax(0,1fr) 3.5em 2.9em 3.6em 3.5em";

  return (
    <section className="fin-pan kre-lg" id="kre-p3" aria-label="Liga-Vergleich">
      <div className="fin-pk">
        <h2>Liga-Vergleich</h2>
        <span className="fin-sp" />
        <div className="kre-seg" role="group" aria-label="Ansicht">
          {meineLiga ? (
            <button type="button" aria-pressed={ansicht === "liga"} onClick={() => setAnsicht("liga")}>
              {ligaLabel}
            </button>
          ) : null}
          <button type="button" aria-pressed={ansicht === "alle" || (!meineLiga && ansicht === "liga")} onClick={() => setAnsicht("alle")}>
            Alle {k.liga.length}
          </button>
          <button type="button" aria-pressed={ansicht === "register"} onClick={() => setAnsicht("register")}>
            Register
          </button>
        </div>
      </div>
      {ansicht === "register" ? (
        <Register k={k} />
      ) : (
        <>
          <div className="kre-tbl" role="table" aria-label="Liga-Vergleich" data-testid="kre-liga">
            <div className="kre-th" style={{ "--cols": cols } as CSSProperties} role="row">
              <span className="kre-m" title="Rang in der sortierten Spalte. Rang 1 ist der beste: geringste Schulden, kleinste Rate, niedrigster Zins.">
                #
              </span>
              <KKopf text="Team" kopf={kopf("team")} />
              <KKopf text="Schulden" kopf={kopf("schuld")} re />
              <KKopf text="Rate" kopf={kopf("rate")} re />
              <KKopf text="Dienst" kopf={kopf("quote")} re titel="Schuldendienst: Rate je Saison geteilt durch die Planeinnahmen" />
              <KKopf text="Zins" kopf={kopf("zins")} re titel="Bankzins für 1 Saison, aus dem Finanzwert des Teams" />
            </div>
            {sortiert.map((x) => {
              const logo = getStaticTeamLogoUrl(x.teamId);
              return (
                <div key={x.teamId} role="row" className={`kre-tz kre-ltz${x.teamId === k.teamId ? " is-wir" : ""}`} style={{ "--cols": cols } as CSSProperties}>
                  <span className="kre-rg bc-t">
                    {rang.get(x)}
                    {ansicht !== "alle" && meineLiga && rk === "schuld" ? <small>{rangAlle.get(k.liga.find((y) => y.teamId === x.teamId)!)}/{k.liga.length}</small> : null}
                  </span>
                  <span className="kre-geber">
                    <span className="kre-gi">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" />
                      ) : null}
                    </span>
                    <span>
                      <b>{x.name}</b>
                    </span>
                  </span>
                  <span className={`is-re kre-z bc-t${x.schulden ? "" : " bc-null"}`}>{x.schulden ? z1(x.schulden) : "0"}</span>
                  <span className={`is-re bc-t${x.rateJeSaison ? "" : " bc-null"}`}>{x.rateJeSaison ? z1(x.rateJeSaison) : "–"}</span>
                  <span className="is-re">
                    <span className="kre-qz2">
                      <span className={`bc-t${x.quote > SCHULDENDIENST_OBERGRENZE ? " bc-minus" : ""}`}>{x.rateJeSaison ? pz(x.quote, 0) : "–"}</span>
                      <span className="kre-bk">
                        <i
                          style={{
                            width: `${Math.min(100, (x.quote / SCHULDENDIENST_OBERGRENZE) * 100)}%`,
                            background: x.quote > SCHULDENDIENST_OBERGRENZE ? "var(--bc-warn)" : x.quote > SCHULDENDIENST_KI_GRENZE ? "var(--bc-acht)" : "var(--bc-gut)",
                          }}
                        />
                      </span>
                    </span>
                  </span>
                  <span className="is-re bc-t kre-leise">{pz(x.bankZins)}</span>
                </div>
              );
            })}
          </div>
          <div className="fin-kf">
            <span>Rang 1 = geringste Schulden</span>
            <span className="fin-sp" />
            <span>{ansicht === "liga" && meineLiga ? "klein: Rang unter allen 32" : `alle ${k.liga.length} Teams`}</span>
          </div>
        </>
      )}
    </section>
  );
}

function Register({ k }: { k: NonNullable<ReturnType<typeof baueKreditSeitenModell>> }) {
  const { sortiert, kopf } = useTabellenSortierung<RegisterZeile, "nehmer" | "geber" | "saison" | "aufgenommen" | "rest" | "zins" | "raten">(
    k.register,
    {
      nehmer: { wert: (x) => x.nehmerName, standard: "auf" },
      geber: { wert: (x) => x.geberName, standard: "auf" },
      saison: { wert: (x) => x.saison },
      aufgenommen: { wert: (x) => x.aufgenommen },
      rest: { wert: (x) => x.restschuld },
      zins: { wert: (x) => x.zins, standard: "auf" },
      raten: { wert: (x) => x.ratenOffen, standard: "auf" },
    },
    { key: "rest", richtung: "ab" },
  );
  const cols = "minmax(7em,1.4fr) minmax(4.5em,1fr) 2.6em 3.4em 3.2em 3.4em 3em";
  return (
    <>
      <div className="kre-tbl" role="table" aria-label="Kreditregister der Liga" data-testid="kre-register">
        <div className="kre-th" style={{ "--cols": cols } as CSSProperties} role="row">
          <KKopf text="Nehmer" kopf={kopf("nehmer")} />
          <KKopf text="Geber" kopf={kopf("geber")} />
          <KKopf text="Saison" kopf={kopf("saison")} re />
          <KKopf text="Aufgen." kopf={kopf("aufgenommen")} re />
          <KKopf text="Rest" kopf={kopf("rest")} re />
          <KKopf text="Zins" kopf={kopf("zins")} re />
          <KKopf text="Raten" kopf={kopf("raten")} re />
        </div>
        {sortiert.length === 0 ? (
          <div className="kre-leer kre-leer-klein">
            <strong>Kein Kredit in der Liga</strong>Das Register zeigt jeden Kredit der Liga, auch getilgte, mit Nehmer und Geber.
          </div>
        ) : null}
        {sortiert.map((x) => (
          <div key={x.loanId} role="row" className={`kre-tz kre-ltz${x.eigene ? " is-wir" : ""}${x.status === "active" ? "" : " is-aus"}`} style={{ "--cols": cols } as CSSProperties}>
            <span className="kre-geber">
              <span>
                <b>{x.nehmerName}</b>
                <small>{x.status === "active" ? "läuft" : x.status === "paid" ? "getilgt" : "geplatzt"}</small>
              </span>
            </span>
            <span className="kre-geber">
              <span>
                <b>{x.geberName}</b>
              </span>
            </span>
            <span className="is-re bc-t">{x.saison}</span>
            <span className="is-re bc-t">{z1(x.aufgenommen)}</span>
            <span className="is-re bc-t">{x.restschuld ? z1(x.restschuld) : "0"}</span>
            <span className="is-re bc-t kre-leise">{pz(x.zins)}</span>
            <span className="is-re bc-t">{x.ratenOffen || "–"}</span>
          </div>
        ))}
      </div>
      <div className="fin-kf">
        <span>Kreditregister der Liga: öffentlich und exakt, die Kasse fremder Teams bleibt verborgen</span>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Seite */

export function FinanzenKreditKopfRechts({ gameState, teamId }: { gameState: GameState; teamId: string }) {
  const k = useMemo(() => baueKreditSeitenModell(gameState, teamId), [gameState, teamId]);
  if (!k) return null;
  const sparauflage = k.vorstand.stufe === "sparauflage";
  return (
    <div className="kre-vorstand" data-testid="kre-vorstand">
      <span className="bc-gk">Vorstand</span>
      <strong className="bc-t">{k.vorstand.vertrauen != null ? `Vertrauen ${z1(k.vorstand.vertrauen)}` : "Vertrauen offen"}</strong>
      <small>
        Freigabe {pz(k.vorstand.anteil, 0)} · {sparauflage ? "kein freiwilliger Kredit" : k.phaseSperre ? "Kredit nur in der Vorsaison" : "Kredit erlaubt"}
      </small>
    </div>
  );
}

export default function FinanzenKredite({
  gameState,
  teamId,
  m,
  kannVerwalten = false,
  onAufnehmen,
  onAbloesen,
}: {
  gameState: GameState;
  teamId: string;
  m: FinanzSeiteModell;
  kannVerwalten?: boolean;
  onAufnehmen?: KreditAufnahmeFn;
  onAbloesen?: KreditAbloeseFn;
}) {
  const k = useMemo(() => baueKreditSeitenModell(gameState, teamId), [gameState, teamId]);
  if (!k) return <div className="fin-leer">Kein Team gewählt.</div>;
  return (
    <div className="kre-work" data-testid="finanzen-kredite">
      <LaufendeKredite k={k} gameState={gameState} kannVerwalten={kannVerwalten} onAbloesen={onAbloesen} />
      <NeuerKredit k={k} gameState={gameState} m={m} kannVerwalten={kannVerwalten} onAufnehmen={onAufnehmen} />
      <LigaVergleich k={k} />
    </div>
  );
}
