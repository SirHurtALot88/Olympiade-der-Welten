"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  stammInDisziplinen,
  wirkungOhneSpieler,
  type LigaStaerken,
  type StaerkeSpieler,
} from "@/lib/market/transfermarkt-kaderstaerke";
import type { TransfermarktSellPreview } from "@/lib/market/transfermarkt-sell-service";
import { formatMarketPreviewError } from "@/lib/room/parse-room-write-context";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";

import { erloesFreigabe } from "@/lib/market/transfermarkt-freigabe";
import { translateSellBlockingReason } from "@/app/foundation/transfermarkt-v2/transfer-sell-view-labels";
import { betragC, de, jeSpieltag, rangText } from "./tm-format";
import { postJson, schreibKontext } from "./tm-daten";
import type { TransfermarktV2RosterRow } from "./tm-typen";

/**
 * VERKAUF und VERTRÄGE im selben Fenster wie der Markt (Mockup 18.11.). Beide Ansichten zeigen die Saison-Leistung
 * je Spieler (PP mit Liga-Rang), damit man beurteilen kann, ob ein Verkauf bzw. eine Verlängerung sinnvoll ist
 * (Chris, 18.11.). Form und Moral folgen, sobald `claude/form-moral-bau-18-11` auf main ist (Spalte ist vorbereitet).
 */

type Props = {
  modus: "verkauf" | "vertrag";
  saveId: string;
  seasonId: string;
  teamId: string;
  teamKuerzel: string;
  source: "sqlite" | "prisma";
  controlMode: string | null;
  roomContext: FoundationRoomContext | null | undefined;
  rosterRows: TransfermarktV2RosterRow[];
  spieler: StaerkeSpieler[];
  staerken: LigaStaerken;
  verletzt: ReadonlySet<string>;
  disziplinNamen: Record<string, string>;
  disziplinIds: string[];
  playerRatingsById?: Map<string, { ovrRank?: number | null; ppsSeasonRank?: number | null; mvsRank?: number | null; ppsSeason?: number | null }>;
  cash: number | null;
  teamGehalt: number | null;
  kaderMin: number;
  /** Quote der Vorstand-Freigabe (0..1); `null` = keine Daten. */
  freigabeQuote?: number | null;
  darfVerwalten: boolean;
  kannVerkaufen: boolean;
  verkaufSperre: string | null;
  onVerlaengern: (playerId: string) => void;
  onFertig: (art: "verkauf" | "verlaengerung", text: string) => Promise<void> | void;
};

type SellAntwort = { success?: boolean; summary?: TransfermarktSellPreview | null; error?: string };

function Laufzeit({ n }: { n: number | null }) {
  const wert = n ?? 0;
  return (
    <span className={`lz${wert <= 1 ? " kurz" : ""}`} title={`${wert} Saison${wert === 1 ? "" : "s"} Restlaufzeit`}>
      {[1, 2, 3, 4].map((i) => <i key={i} className={i <= wert ? "" : "o"} />)}
    </span>
  );
}

export default function KaderAnsichten(props: Props) {
  const { modus, rosterRows, teamId } = props;
  const [wahl, setWahl] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<TransfermarktSellPreview | null>(null);
  const [vorschauFehler, setVorschauFehler] = useState<string | null>(null);
  const [vorschauLaedt, setVorschauLaedt] = useState(false);
  const [bestaetigen, setBestaetigen] = useState(false);
  const [busy, setBusy] = useState(false);
  const schluessel = useRef<string>("");

  const sortiert = useMemo(
    () => [...rosterRows].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)),
    [rosterRows],
  );
  const gewaehlt = sortiert.find((r) => r.playerId === wahl) ?? sortiert[0] ?? null;

  useEffect(() => {
    setBestaetigen(false);
  }, [gewaehlt?.playerId, modus]);

  // Verkaufs-Vorschau (Trockenlauf) für den gewählten Spieler.
  useEffect(() => {
    if (modus !== "verkauf" || !gewaehlt || props.source !== "sqlite") {
      setVorschau(null);
      return;
    }
    const abbruch = new AbortController();
    setVorschauLaedt(true);
    setVorschauFehler(null);
    void (async () => {
      try {
        const { daten } = await postJson<SellAntwort>(
          "/api/transfermarkt/sell",
          schreibKontext(
            { saveId: props.saveId, seasonId: props.seasonId, teamId, activePlayerId: gewaehlt.activePlayerId, dryRun: true, source: props.source },
            { teamId, controlMode: props.controlMode, roomContext: props.roomContext },
          ),
          abbruch.signal,
        );
        if (abbruch.signal.aborted) return;
        setVorschau(daten.summary ?? null);
        if (!daten.summary) setVorschauFehler(formatMarketPreviewError(daten.error) ?? "Vorschau konnte nicht geladen werden.");
      } catch {
        if (!abbruch.signal.aborted) setVorschauFehler("Vorschau konnte nicht geladen werden.");
      } finally {
        if (!abbruch.signal.aborted) setVorschauLaedt(false);
      }
    })();
    return () => abbruch.abort();
  }, [modus, gewaehlt?.activePlayerId, props.saveId, props.seasonId, props.source, teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const wirkungen = useMemo(() => {
    if (!gewaehlt) return [];
    return props.disziplinIds.map((d) =>
      wirkungOhneSpieler({ spieler: props.spieler, staerken: props.staerken, teamId, disziplinId: d, playerId: gewaehlt.playerId, ausgeschlossen: props.verletzt }),
    );
  }, [gewaehlt, props.disziplinIds, props.spieler, props.staerken, props.verletzt, teamId]);

  const stamm = useMemo(
    () => (gewaehlt ? stammInDisziplinen({ spieler: props.spieler, staerken: props.staerken, teamId, disziplinIds: props.disziplinIds, playerId: gewaehlt.playerId, ausgeschlossen: props.verletzt }) : 0),
    [gewaehlt, props.disziplinIds, props.spieler, props.staerken, props.verletzt, teamId],
  );

  async function verkaufen() {
    if (!gewaehlt || busy) return;
    setBusy(true);
    setVorschauFehler(null);
    try {
      const { ok, daten } = await postJson<SellAntwort>(
        "/api/transfermarkt/sell",
        schreibKontext(
          { saveId: props.saveId, seasonId: props.seasonId, teamId, activePlayerId: gewaehlt.activePlayerId, idempotencyKey: (schluessel.current ||= `verkauf-${gewaehlt.activePlayerId}-${Date.now().toString(36)}`), dryRun: false, source: props.source },
          { teamId, controlMode: props.controlMode, roomContext: props.roomContext },
        ),
      );
      if (!ok || daten.error || !daten.summary?.canSell) {
        setVorschauFehler(formatMarketPreviewError(daten.error) ?? daten.summary?.blockingReasons?.[0] ?? "Verkauf konnte nicht bestätigt werden.");
        setBestaetigen(false);
        return;
      }
      schluessel.current = "";
      setWahl(null);
      setBestaetigen(false);
      await props.onFertig("verkauf", `${gewaehlt.name} verkauft: Kasse ${betragC(daten.summary.cashBefore)} → ${betragC(daten.summary.cashAfter)}.`);
    } catch {
      setVorschauFehler("Verkauf konnte nicht bestätigt werden.");
    } finally {
      setBusy(false);
    }
  }

  function leistung(r: TransfermarktV2RosterRow) {
    const bewertung = props.playerRatingsById?.get(r.playerId);
    const pps = bewertung?.ppsSeason ?? r.pps;
    return { pps, rang: bewertung?.ppsSeasonRank ?? null };
  }

  // Gehaltslast je Saison: ein Vertrag mit Restlaufzeit n zählt in den nächsten n Saisons.
  const last = useMemo(() => {
    const jahre = [0, 1, 2, 3].map(() => 0);
    for (const r of rosterRows) {
      const n = Math.max(0, Math.min(4, r.contractLength ?? 0));
      for (let i = 0; i < n; i += 1) jahre[i] += r.salary ?? 0;
    }
    return jahre;
  }, [rosterRows]);
  const lastMax = Math.max(1, ...last);
  const auslaufend = sortiert.filter((r) => (r.contractLength ?? 0) <= 1);

  const kopfSpalten = modus === "verkauf";

  return (
    <div className="vk" data-testid={modus === "verkauf" ? "tm-verkauf" : "tm-vertrag"}>
      <section className="pan" aria-label={modus === "verkauf" ? "Mein Kader" : "Meine Verträge"}>
        <div className="pk">
          <h2>{modus === "verkauf" ? "Mein Kader" : "Verträge"}</h2>
          <span className="sp" />
          <span className="gk">{sortiert.length} Spieler · Gehalt {betragC(props.teamGehalt)} je Saison · {betragC(jeSpieltag(props.teamGehalt), 2)} je Spieltag</span>
        </div>
        <div className={`kt${kopfSpalten ? "" : " vt"}`} style={{ ["--zeilen" as string]: Math.max(10, Math.min(14, sortiert.length)) }}>
          <div className="mz kopf">
            {kopfSpalten ? (
              <>
                <span /><span>Spieler</span><span>Stamm in</span><span className="re">Marktwert</span><span className="re">je Saison</span><span className="re">je Spieltag</span><span>Saison-PP</span><span title="Form folgt mit Form/Moral">Form</span><span /><span>Restlaufzeit</span>
              </>
            ) : (
              <>
                <span /><span>Spieler</span><span>Saison-PP</span><span className="re">je Saison</span><span className="re">je Spieltag</span><span title="Form folgt mit Form/Moral">Form</span><span /><span>Laufzeit</span><span>Status</span><span />
              </>
            )}
          </div>
          {sortiert.map((r) => {
            const l = leistung(r);
            const stammR = stammInDisziplinen({ spieler: props.spieler, staerken: props.staerken, teamId, disziplinIds: props.disziplinIds, playerId: r.playerId, ausgeschlossen: props.verletzt });
            const aus = (r.contractLength ?? 0) <= 1;
            const verletzt = props.verletzt.has(r.playerId);
            const name = (
              <span className="nm">
                <b>{r.name}</b>
                <small>{r.className} · {r.race ?? ""}{verletzt && <span className="tag w">verletzt</span>}</small>
              </span>
            );
            const pp = (
              <span className="ppz t" title="Saison-PP des Spielers, in Klammern der Liga-Rang">
                {l.pps != null ? de(l.pps, 1) : "—"}{l.rang != null && <small style={{ color: "var(--stumm)", marginLeft: "calc(.3 * var(--u))" }}>#{l.rang}</small>}
              </span>
            );
            return (
              <div key={r.playerId} className={`mz${gewaehlt?.playerId === r.playerId ? " an" : ""}`} onClick={() => setWahl(r.playerId)} data-testid="tm-kaderzeile">
                {r.portraitUrl ? <img className="por" src={r.portraitUrl} alt="" loading="lazy" /> : <span className="por" />}
                {name}
                {kopfSpalten ? (
                  <>
                    <span className="t">{stammR} Disz.</span>
                    <span className="re"><b className="t">{de(r.marketValue ?? 0, 1)}</b></span>
                    <span className="re"><b className="t">{de(r.salary ?? 0, 1)}</b></span>
                    <span className="re klein">{de(jeSpieltag(r.salary) ?? 0, 2)}</span>
                    {pp}
                    <span className="null" title="Form folgt mit Form/Moral">–</span>
                    <span />
                    <Laufzeit n={r.contractLength} />
                  </>
                ) : (
                  <>
                    {pp}
                    <span className="re"><b className="t">{de(r.salary ?? 0, 1)}</b></span>
                    <span className="re klein">{de(jeSpieltag(r.salary) ?? 0, 2)}</span>
                    <span className="null" title="Form folgt mit Form/Moral">–</span>
                    <span />
                    <Laufzeit n={r.contractLength} />
                    <span><span className={`tag ${aus ? "a" : "g"}`}>{aus ? "läuft aus" : "läuft"}</span></span>
                    <button type="button" className="knopf klein" disabled={!props.darfVerwalten} onClick={(e) => { e.stopPropagation(); props.onVerlaengern(r.playerId); }} data-testid="tm-verlaengern">Verlängern</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="pan" aria-label="Wirkung">
        {gewaehlt ? (
          modus === "verkauf" ? (
            <>
              <div className="pk"><h2>{gewaehlt.name} verkaufen</h2><span className="sp" /><span className="gk">Stamm in {stamm} Disziplinen</span></div>
              <div className="fb" style={{ overflow: "auto" }}>
                <h4>Erlös</h4>
                {vorschauLaedt && !vorschau && <div className="hin">Vorschau lädt …</div>}
                {vorschau && !vorschau.canSell && (vorschau.blockingReasons ?? []).length > 0 && (
                  <div className="vorst rot" data-testid="tm-verkauf-fenster-zu">
                    <b>Verkaufsfenster zu.</b>
                    <small>{vorschau.blockingReasons.map((b) => translateSellBlockingReason(b)).join(" · ")} Preise und Erlös erscheinen, sobald das Fenster offen ist.</small>
                  </div>
                )}
                <div className="fw" data-testid="tm-verkauf-erloes">
                  <div className="z"><span>Marktwert</span><b className="t">{betragC(vorschau?.marketValueReference ?? gewaehlt.marketValue)}</b></div>
                  <div className="z"><span>Verkaufsfaktor</span><b className="t">{vorschau?.saleFactor != null ? de(vorschau.saleFactor, 2) : "—"}</b></div>
                  <div className="z"><span>Verkaufspreis</span><b className="t">{betragC(vorschau?.salePrice ?? null)}</b></div>
                  {vorschau?.buyoutCost != null && vorschau.buyoutCost > 0 && <div className="z"><span>Vertragsablöse</span><b className="t minus">−{betragC(vorschau.buyoutCost).replace("−", "")}</b></div>}
                  <div className="z sum"><span>Erlös</span><b className="t">{betragC(vorschau?.netProceeds ?? vorschau?.salePrice ?? null)}</b></div>
                  <div className="z"><span>gegen Kaufpreis</span><b className={`t ${(vorschau?.profit ?? 0) < 0 ? "minus" : "plus"}`}>{vorschau?.profit != null ? `${vorschau.profit >= 0 ? "+" : "−"}${de(Math.abs(vorschau.profit), 1)} C` : "—"}</b></div>
                </div>
                {props.freigabeQuote != null && (vorschau?.netProceeds ?? vorschau?.salePrice) != null && (() => {
                  const f = erloesFreigabe(vorschau?.netProceeds ?? vorschau?.salePrice ?? 0, props.freigabeQuote!);
                  return <div className="vorst" data-testid="tm-verkauf-freigabe"><b>Davon werden {betragC(f.frei)} frei.</b><small>{betragC(f.gesperrt)} bleiben gesperrt auf dem Konto (Freigabe {Math.round(props.freigabeQuote! * 100)} %).</small></div>;
                })()}
                <h4>Danach</h4>
                <div className="fw">
                  <div className="z"><span>Kasse</span><b className="t">{betragC(vorschau?.cashBefore ?? props.cash)} → {betragC(vorschau?.cashAfter ?? null)}</b></div>
                  <div className="z"><span>Gehalt je Saison</span><b className="t">{betragC(vorschau?.teamSalaryBefore ?? props.teamGehalt)} → {betragC(vorschau?.teamSalaryAfter ?? null)}</b></div>
                  <div className="z"><span>Gehalt je Spieltag</span><b className="t">{betragC(jeSpieltag(vorschau?.teamSalaryBefore ?? props.teamGehalt), 2)} → {betragC(jeSpieltag(vorschau?.teamSalaryAfter ?? null), 2)}</b></div>
                  <div className="z"><span>Kader (Minimum {props.kaderMin})</span><b className="t">{vorschau?.rosterBefore ?? "—"} → {vorschau?.rosterAfter ?? "—"}</b></div>
                </div>
                <h4>Kaderränge, wenn er geht</h4>
                <div className="rw">
                  {wirkungen.filter((w) => w.nachherBest !== w.vorher).slice(0, 8).map((w) => (
                    <div key={w.disziplinId}><span>{props.disziplinNamen[w.disziplinId]}</span><b className="t">{w.vorher}. → <span className="minus">{rangText(w.nachherBest, w.nachherSchlecht)}</span></b></div>
                  ))}
                  {wirkungen.every((w) => w.nachherBest === w.vorher) && <div style={{ gridColumn: "1 / -1" }}><span>Kein Rang ändert sich.</span></div>}
                </div>
                {vorschau?.coaching && "headline" in (vorschau.coaching as object) && (
                  <div className="hin">{String((vorschau.coaching as { headline?: string }).headline ?? "")}</div>
                )}
                                {props.verkaufSperre && <div className="hin w">{props.verkaufSperre}</div>}
                {vorschauFehler && <div className="hin w">{vorschauFehler}</div>}
                <div className="akt">
                  {!bestaetigen ? (
                    <button type="button" className={`knopf rot${props.kannVerkaufen && vorschau?.canSell ? "" : " zu"}`} disabled={!props.kannVerkaufen || !vorschau?.canSell} onClick={() => setBestaetigen(true)} data-testid="tm-verkaufen">Verkaufen</button>
                  ) : (
                    <>
                      <button type="button" className="knopf rot" disabled={busy} onClick={() => void verkaufen()} data-testid="tm-verkauf-bestaetigen">Ja, {gewaehlt.name} verkaufen</button>
                      <button type="button" className="knopf" onClick={() => setBestaetigen(false)}>Zurück</button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="pk"><h2>Gehaltslast je Saison</h2></div>
              <div className="fb">
                <div className="last">
                  {last.map((summe, i) => (
                    <div key={i}>
                      <b className="t">{de(summe, 1)}</b>
                      <i style={{ height: `${(summe / lastMax) * 100}%` }} />
                      <span>{i === 0 ? "diese" : `+${i}`}</span>
                    </div>
                  ))}
                </div>
                <div className="hin">Gebunden aus laufenden Verträgen, in C je Saison. Die Linien der Apron-Abgabe zeigt dieser Kasten mit Finanzen V2.</div>
                <h4>Läuft nach dieser Saison aus</h4>
                <div className="rw" style={{ gridTemplateColumns: "1fr" }}>
                  {auslaufend.length === 0 && <div><span>Kein Vertrag läuft aus.</span></div>}
                  {auslaufend.map((r) => (
                    <div key={r.playerId}>
                      <span>{r.name} <small style={{ color: "var(--leise)" }}>· Stamm in {stammInDisziplinen({ spieler: props.spieler, staerken: props.staerken, teamId, disziplinIds: props.disziplinIds, playerId: r.playerId, ausgeschlossen: props.verletzt })} Disziplinen</small></span>
                      <button type="button" className="knopf klein" disabled={!props.darfVerwalten} onClick={() => props.onVerlaengern(r.playerId)}>Verlängern</button>
                    </div>
                  ))}
                </div>
                <div className="hin">Die Verhandlung läuft am selben Tisch wie ein Kauf: Gehalt je Saison, Laufzeit, Vertragsform, Reaktion, dann Unterschrift.</div>
              </div>
            </>
          )
        ) : (
          <div className="tmk-leer">Kein Spieler im Kader.</div>
        )}
      </section>
    </div>
  );
}
