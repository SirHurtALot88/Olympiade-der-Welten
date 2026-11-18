"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ContractShape, GameState } from "@/lib/data/olyDataTypes";
import { formatNegotiationSignalLabel } from "@/lib/foundation/tabs/foundation-format-render-helpers";
import { CONTRACT_SHAPE_LABELS } from "@/lib/foundation/contract-shape-label";
import type { ContractNegotiationPreview } from "@/lib/market/contract-negotiation-preview";
import type { TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";
import type { RangWirkung } from "@/lib/market/transfermarkt-kaderstaerke";
import { formatMarketPreviewError } from "@/lib/room/parse-room-write-context";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";

import { betragC, begrenze, de, jeSpieltag, rangText } from "./tm-format";
import { freigabeKosten, freigabeSperreFuerBetrag } from "@/lib/market/transfermarkt-freigabe";
import { postJson, schreibKontext } from "./tm-daten";

/**
 * VERHANDLUNGSTISCH (Mockup 18.11.): EIN Dialog für Kauf und Verlängerung. Drei Spalten — der Spieler und warum er so
 * reagiert, mein Angebot, was der Deal mit meinem Geld macht. Zwei Schritte wie bisher: verhandeln, dann abschließen.
 *
 * Die Verhandlung selbst ist NICHT neu: Vorschau und Abschluss laufen über `/api/transfermarkt/buy` (Kauf) bzw.
 * `/api/contracts/renewal` (Verlängerung), das Verdikt (Zusage / Gegenangebot / Absage) kommt serverseitig aus
 * `buildContractNegotiationPreview`; der Dialog liest es nur und schreibt das Verhandlungsgedächtnis wie die alte Seite.
 */

export type TischModus = "kauf" | "verl";

export type TischProps = {
  modus: TischModus;
  saveId: string;
  seasonId: string;
  teamId: string;
  teamKuerzel: string;
  source: "sqlite" | "prisma";
  controlMode: string | null;
  roomContext: FoundationRoomContext | null | undefined;
  playerId: string;
  name: string;
  klasse: string;
  rasse: string;
  bildUrl: string | null;
  figurUrl: string | null;
  kulisseUrl: string | null;
  disziplinName: string;
  /** Zeile unter dem Namen, z. B. „Eignung ~72 in Hockey · ≈ 3,1 PP". */
  eignungText: string | null;
  wirkungen: RangWirkung[];
  disziplinNamen: Record<string, string>;
  cash: number | null;
  teamGehalt: number | null;
  kader: number | null;
  kaderMin: number | null;
  /** Aktuelles Gehalt (nur Verlängerung). */
  aktuellesGehalt?: number | null;
  /** Freigabe-Text, solange die Vorstand-Freigabe nicht gebaut ist. */
  gesperrtGrund: string | null;
  /** Freier Betrag laut Vorstand-Freigabe (`null` = keine Daten, keine Sperre). Gilt für Ablöse UND Gehalt. */
  freigabeFrei?: number | null;
  onErstVerkaufen?: () => void;
  onSchliessen: () => void;
  onAbgeschlossen: (nachher: { gameStateAfter: GameState | null }) => Promise<void> | void;
};

type Verdikt = "accept" | "counter_money" | "counter_conditions" | "reject_lowball" | "reject_not_about_money" | "reject_affront";

type Stand = {
  neg: Partial<ContractNegotiationPreview> & Partial<TransfermarktBuyPreview>;
  canDo: boolean;
  blocking: string[];
  warnings: string[];
  purchasePrice: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  rosterBefore: number | null;
  rosterAfter: number | null;
  confirmToken: string | null;
};

type Antwort = {
  art: "ja" | "gegen" | "nein";
  titel: string;
  text: string;
  gegenGehalt?: number | null;
  gegenBedingungen?: { contractLength: number; contractShape: ContractShape } | null;
};

/** Hinweise über den Stand unserer eigenen Rechnung — kein Deal-Risiko, also nie im Verhandlungsfenster. */
const SUPPRESSED_NEGOTIATION_WARNING_CODES = new Set([
  "market_bracket_factor_preview_pending",
  "preview_only_contract_negotiation",
  "trait_salary_factor_source_missing",
]);

function sichtbareHinweise(codes: readonly string[] | null | undefined, max: number): string[] {
  return (codes ?? [])
    .filter((code) => !SUPPRESSED_NEGOTIATION_WARNING_CODES.has(code))
    .map((code) => formatNegotiationSignalLabel(code))
    .slice(0, max);
}

const BLOCK_TEXT: Record<string, string> = {
  insufficient_cash: "Die Kasse reicht nicht für diese Ablöse.",
  roster_full: "Der Kader ist voll.",
};

const FORMEN: ContractShape[] = ["balanced", "front_loaded", "back_loaded"];

function normalisiere(modus: TischModus, antwort: any): Stand | null {
  const summary = antwort?.summary;
  if (!summary) return null;
  if (modus === "kauf") {
    const s = summary as TransfermarktBuyPreview;
    return {
      neg: s,
      canDo: Boolean(s.canBuy),
      blocking: s.blockingReasons ?? [],
      warnings: s.warnings ?? [],
      purchasePrice: s.purchasePrice ?? null,
      cashAfter: s.cashAfter ?? null,
      salaryBefore: s.salaryBefore ?? null,
      salaryAfter: s.salaryAfter ?? null,
      rosterBefore: s.rosterBefore ?? null,
      rosterAfter: s.rosterAfter ?? null,
      confirmToken: null,
    };
  }
  const neg = summary.negotiationPreview ?? null;
  if (!neg) return null;
  return {
    neg,
    canDo: Boolean(summary.ok) && (summary.blockingReasons ?? []).length === 0,
    blocking: summary.blockingReasons ?? [],
    warnings: summary.warnings ?? [],
    purchasePrice: null,
    cashAfter: null,
    salaryBefore: null,
    salaryAfter: null,
    rosterBefore: null,
    rosterAfter: null,
    confirmToken: summary.confirmToken ?? null,
  };
}

export default function VerhandlungsTisch(props: TischProps) {
  const { modus, saveId, seasonId, teamId, source, controlMode, roomContext, playerId, name } = props;
  const [laenge, setLaenge] = useState<number | null>(null);
  const [form, setForm] = useState<ContractShape | null>(null);
  const [gehalt, setGehalt] = useState<number | null>(null);
  const [manuell, setManuell] = useState(false);
  const [stand, setStand] = useState<Stand | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [nachlauf, setNachlauf] = useState(0);
  const schreibRef = useRef<Promise<unknown> | null>(null);
  const versionRef = useRef(0);

  const kontext = useMemo(() => ({ teamId, controlMode, roomContext }), [teamId, controlMode, roomContext]);

  // Vorschau (entprellt). Erst ein laufendes Verhandlungs-Schreiben abwarten, sonst fehlt der Vorschau das Gedächtnis.
  useEffect(() => {
    const version = ++versionRef.current;
    const abbruch = new AbortController();
    setLaedt(true);
    const timer = window.setTimeout(async () => {
      try {
        if (schreibRef.current) await schreibRef.current.catch(() => {});
        if (version !== versionRef.current) return;
        const koerper =
          modus === "kauf"
            ? schreibKontext(
                {
                  saveId,
                  seasonId,
                  teamId,
                  playerId,
                  ...(laenge != null ? { contractLength: laenge } : {}),
                  ...(form != null ? { contractShape: form } : {}),
                  ...(gehalt != null ? { offeredSalary: gehalt } : {}),
                  dryRun: true,
                  source,
                },
                kontext,
              )
            : schreibKontext(
                {
                  saveId,
                  teamId,
                  playerId,
                  action: "renew",
                  contractLength: laenge ?? 2,
                  contractShape: form ?? "balanced",
                  ...(gehalt != null ? { offeredSalary: gehalt } : {}),
                  dryRun: true,
                  source,
                },
                kontext,
              );
        const { ok, daten } = await postJson<any>(modus === "kauf" ? "/api/transfermarkt/buy" : "/api/contracts/renewal", koerper, abbruch.signal);
        if (version !== versionRef.current) return;
        const neu = normalisiere(modus, daten);
        setStand(neu);
        if (neu?.neg.offeredSalary != null && !manuell) setGehalt(neu.neg.offeredSalary);
        if (neu?.neg.contractPreference) {
          const wunsch = neu.neg.contractPreference;
          if (laenge == null && typeof wunsch.idealLength === "number") setLaenge(wunsch.idealLength);
          if (form == null && wunsch.shapePreference) setForm(wunsch.shapePreference);
        }
        setFehler(!neu && (!ok || daten?.error) ? formatMarketPreviewError(daten?.error) ?? "Vorschau konnte nicht geladen werden." : null);
      } catch (e) {
        if (abbruch.signal.aborted) return;
        setFehler("Vorschau konnte nicht geladen werden.");
      } finally {
        if (version === versionRef.current) setLaedt(false);
      }
    }, manuell ? 90 : 40);
    return () => {
      window.clearTimeout(timer);
      abbruch.abort();
    };
    // gehalt bewusst nur nach manuellem Eingriff als Auslöser
  }, [modus, saveId, seasonId, teamId, playerId, laenge, form, manuell ? gehalt : null, nachlauf, source, kontext]); // eslint-disable-line react-hooks/exhaustive-deps

  const neg = stand?.neg ?? {};
  const forderung = neg.expectedSalary ?? null;
  const angebot = gehalt ?? neg.offeredSalary ?? forderung;
  const wunschLaenge = neg.contractPreference?.idealLength ?? null;
  const wunschForm = neg.contractPreference?.shapePreference ?? null;

  const schreibeErgebnis = useCallback(
    (status: "countered" | "accepted_pending_confirm" | "rejected_bad_experience", extra: string[] = []) => {
      if (modus !== "kauf" || source !== "sqlite" || !stand) return Promise.resolve();
      const schreibt = postJson(
        `/api/singleplayer-state?${new URLSearchParams({ source }).toString()}`,
        schreibKontext(
          { action: "contract-negotiation-outcome", saveId, teamId, summary: stand.neg, status, extraWarnings: extra },
          kontext,
        ),
      ).catch(() => {});
      schreibRef.current = schreibt;
      void schreibt.finally(() => {
        if (schreibRef.current === schreibt) schreibRef.current = null;
      });
      return schreibt;
    },
    [kontext, modus, saveId, source, stand, teamId],
  );

  function verhandeln() {
    if (!stand || beschaeftigt) return;
    const verdikt = (neg.verdict ?? "accept") as Verdikt;
    if (verdikt === "reject_lowball" || verdikt === "reject_not_about_money" || verdikt === "reject_affront") {
      void schreibeErgebnis("rejected_bad_experience", [
        verdikt === "reject_affront" ? "negotiation_rejected_affront" : verdikt === "reject_not_about_money" ? "negotiation_rejected_not_about_money" : "negotiation_rejected_bad_experience",
      ]);
      setAntwort({
        art: "nein",
        titel: verdikt === "reject_not_about_money" ? "Absage: am Geld liegt es nicht" : verdikt === "reject_affront" ? "Absage: Rückzieher" : "Angebot abgelehnt",
        text:
          verdikt === "reject_not_about_money"
            ? `${name} will einfach nicht zu ${props.teamKuerzel}. Mehr Geld ändert daran nichts.`
            : verdikt === "reject_affront"
              ? `${name} zieht sich zurück: Dein Angebot lag niedriger als zuletzt. Das zählt als Vertrauensbruch.`
              : `${name} lehnt ab. Hebe das Gehalt an oder passe den Vertrag an, dann verhandelt er neu.`,
      });
      return;
    }
    if (verdikt === "counter_money") {
      void schreibeErgebnis("countered").then(() => setNachlauf((n) => n + 1));
      setAntwort({
        art: "gegen",
        titel: neg.concededFromLastCounter ? "Er kommt dir entgegen" : "Gegenangebot",
        text: `${name} will eher ${betragC(jeSpieltag(neg.counterSalary ?? null), 2)} je Spieltag (${betragC(neg.counterSalary ?? null)} je Saison).`,
        gegenGehalt: neg.counterSalary ?? null,
      });
      return;
    }
    if (verdikt === "counter_conditions") {
      void schreibeErgebnis("countered").then(() => setNachlauf((n) => n + 1));
      const b = neg.counterConditions ?? null;
      setAntwort({
        art: "gegen",
        titel: "Beim Gehalt einig, Vertrag noch nicht",
        text: b
          ? `${name} will ${b.contractLength} Saison${b.contractLength === 1 ? "" : "s"} und die Form „${CONTRACT_SHAPE_LABELS[b.contractShape]}“.`
          : `${name} will eine andere Laufzeit oder Form.`,
        gegenBedingungen: b,
      });
      return;
    }
    void schreibeErgebnis("accepted_pending_confirm");
    setAntwort({ art: "ja", titel: "Zusage", text: `${name} akzeptiert den Rahmen. Du kannst jetzt abschließen.` });
  }

  function gegenangebotAnnehmen() {
    if (!antwort || antwort.art !== "gegen") return;
    if (antwort.gegenGehalt != null) {
      setGehalt(antwort.gegenGehalt);
      setManuell(true);
    }
    if (antwort.gegenBedingungen) {
      setLaenge(antwort.gegenBedingungen.contractLength);
      setForm(antwort.gegenBedingungen.contractShape);
    }
    void schreibeErgebnis("accepted_pending_confirm");
    setAntwort({ art: "ja", titel: "Gegenangebot eingeschlagen", text: `${name} ist einverstanden. Du kannst jetzt abschließen.` });
  }

  async function abschliessen() {
    if (!stand || beschaeftigt || antwort?.art !== "ja") return;
    setBeschaeftigt(true);
    setFehler(null);
    try {
      const koerper =
        modus === "kauf"
          ? schreibKontext(
              {
                saveId,
                seasonId,
                teamId,
                playerId,
                ...(laenge != null ? { contractLength: laenge } : {}),
                ...(form != null ? { contractShape: form } : {}),
                ...(angebot != null ? { offeredSalary: angebot } : {}),
                dryRun: false,
                source,
              },
              kontext,
            )
          : schreibKontext(
              {
                saveId,
                teamId,
                playerId,
                action: "renew",
                contractLength: laenge ?? 2,
                contractShape: form ?? "balanced",
                offeredSalary: angebot,
                confirmToken: stand.confirmToken,
                dryRun: false,
                source,
              },
              kontext,
            );
      const { ok, daten } = await postJson<any>(modus === "kauf" ? "/api/transfermarkt/buy" : "/api/contracts/renewal", koerper);
      const ergebnis = normalisiere(modus, daten);
      const gelungen = modus === "kauf" ? Boolean(ergebnis?.canDo) : Boolean(daten?.success);
      if (!ok || daten?.error || !gelungen) {
        setFehler(
          formatMarketPreviewError(daten?.error) ??
            ergebnis?.blocking?.[0] ??
            (modus === "kauf" ? "Kauf konnte nicht bestätigt werden." : "Verlängerung konnte nicht bestätigt werden."),
        );
        return;
      }
      await props.onAbgeschlossen({ gameStateAfter: (daten?.gameStateAfter as GameState | undefined) ?? null });
    } catch {
      setFehler("Abschluss fehlgeschlagen.");
    } finally {
      setBeschaeftigt(false);
    }
  }

  const maxLaenge = 4;
  const chancen = [neg.acceptChance ?? 0, neg.counterChance ?? 0, neg.rejectChance ?? 0];
  const summe = Math.max(1, chancen[0] + chancen[1] + chancen[2]);
  const plan = neg.yearlySalarySchedule ?? [];
  const planMax = Math.max(1, ...plan.map((j) => j.salary ?? 0));
  const freigabeKostenBetrag =
    modus === "kauf"
      ? freigabeKosten(stand?.purchasePrice, angebot)
      : Math.max(0, (angebot ?? 0) - (props.aktuellesGehalt ?? 0));
  const freigabeGrund = freigabeSperreFuerBetrag(props.freigabeFrei ?? null, freigabeKostenBetrag);
  const sperrGrund = (modus === "kauf" ? props.gesperrtGrund : null) ?? freigabeGrund;
  const gesperrt = sperrGrund != null;
  // Verhandeln bleibt möglich; GESPERRT ist nur der Abschluss (Chris, 18.11.).
  const kannVerhandeln = Boolean(stand) && !laedt && !beschaeftigt;
  const kannAbschliessen = antwort?.art === "ja" && stand?.canDo === true && !gesperrt && !beschaeftigt;
  const sliderMin = forderung != null ? forderung * 0.7 : 0;
  const sliderMax = forderung != null ? forderung * 1.25 : 1;

  return (
    <div className="schleier" role="dialog" aria-modal="true" aria-label={modus === "kauf" ? "Verhandlungstisch Kauf" : "Verhandlungstisch Verlängerung"} data-testid="tm-tisch">
      <div className="dlg">
        <div className="dk">
          <em>{modus === "kauf" ? "Kauf" : "Verlängerung"}</em>
          <h2>{name}</h2>
          <span className="sp" />
          <div className="schritte">
            <span className={antwort?.art === "ja" ? "ok" : "an"}>1 Verhandeln</span>
            <span className={antwort?.art === "ja" ? "an" : ""}>2 Abschließen</span>
          </div>
          <button type="button" className="zu" onClick={props.onSchliessen} aria-label="Schließen" disabled={beschaeftigt}>×</button>
        </div>
        <div className="dg">
          {/* Spieler */}
          <div>
            <div className="buehne-f" style={props.kulisseUrl ? { backgroundImage: `url(${props.kulisseUrl})` } : undefined}>
              {props.figurUrl ? <img className="fig" src={props.figurUrl} alt="" /> : props.bildUrl ? <img className="por" src={props.bildUrl} alt="" /> : null}
              <div className="txt">
                <em>{props.klasse} · {props.rasse}</em>
                <h3>{name}</h3>
                <small>{props.eignungText ?? ""}</small>
              </div>
            </div>
            <div className="dsp">
              <h4>Forderung</h4>
              <div className="regler">
                <div className="o">
                  <strong className="t">{betragC(jeSpieltag(forderung), 2).replace(" C", "")}</strong>
                  <small>C je Spieltag<br />{betragC(forderung)} je Saison</small>
                </div>
              </div>
              {modus === "kauf" ? (
                <div className="gz"><span>Ablöse = Marktwert</span><b className="t">{betragC(stand?.purchasePrice ?? null)}</b></div>
              ) : (
                <div className="gz"><span>Heutiges Gehalt</span><b className="t">{betragC(jeSpieltag(props.aktuellesGehalt ?? null), 2)}<small>{betragC(props.aktuellesGehalt ?? null)} je Saison</small></b></div>
              )}
              <h4>Warum er so reagiert</h4>
              <div className="mag">
                {(neg.negotiationScoreBreakdown ?? [])
                  .filter((e) => e.tone !== "neutral")
                  .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
                  .slice(0, 5)
                  .map((e) => (<div key={e.key} className={e.tone === "positive" ? "p" : "m"} title={e.reason}><i>{e.tone === "positive" ? "+" : "−"}</i><span>{e.label}</span></div>))}
                {sichtbareHinweise(neg.negotiationWarnings ?? stand?.warnings, 3).map((w) => (<div key={w} className="m"><i>−</i><span>{w}</span></div>))}
                {!stand && <div className="n"><i>·</i><span>Vorschau lädt …</span></div>}
              </div>
            </div>
          </div>
          {/* Angebot */}
          <div>
            <div className="dsp">
              <h4>Mein Angebot</h4>
              <div className="regler">
                <div className="o">
                  <strong className="t">{angebot != null ? de((angebot ?? 0) / 20, 2) : "—"}</strong>
                  <small>C je Spieltag<br />{betragC(angebot)} je Saison</small>
                  <span className="sp" />
                  <span className="ford">Zusage ab<b className="t">{betragC(jeSpieltag(neg.acceptThresholdSalary ?? null), 2)}</b></span>
                </div>
                <input
                  type="range"
                  aria-label="Gehalt je Saison"
                  min={sliderMin}
                  max={sliderMax}
                  step={0.05}
                  value={angebot != null ? begrenze(angebot, sliderMin, sliderMax) : sliderMin}
                  disabled={!forderung || beschaeftigt}
                  onChange={(e) => {
                    setManuell(true);
                    setAntwort((a) => (a?.art === "nein" ? null : a?.art === "ja" ? null : a));
                    setGehalt(Number(Number(e.target.value).toFixed(2)));
                  }}
                />
              </div>
              <div className="zwei">
                <div>
                  <h4>Laufzeit</h4>
                  <div className="seg">
                    {Array.from({ length: maxLaenge }, (_, i) => i + 1).map((n) => (
                      <button key={n} type="button" className={`${(laenge ?? wunschLaenge) === n ? "an" : ""} ${wunschLaenge === n ? "wunsch" : ""}`} onClick={() => { setLaenge(n); setAntwort(null); }} disabled={beschaeftigt}>
                        {n}<small>{n === 1 ? "Saison" : "Saisons"}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4>Vertragsform</h4>
                  <div className="seg">
                    {FORMEN.map((f) => (
                      <button key={f} type="button" className={`${(form ?? wunschForm) === f ? "an" : ""} ${wunschForm === f ? "wunsch" : ""}`} onClick={() => { setForm(f); setAntwort(null); }} disabled={beschaeftigt}>
                        {CONTRACT_SHAPE_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {plan.length > 0 && (
                <>
                  <h4>Gehalt je Saison der Laufzeit</h4>
                  <div className="treppe">
                    {plan.map((j, i) => (
                      <div key={i}>
                        <b className="t">{de(j.salary ?? 0, 1)}</b>
                        <i style={{ height: `${((j.salary ?? 0) / planMax) * 100}%` }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="chance" aria-label="Chancen">
                <i className="ja" style={{ flexBasis: `${(chancen[0] / summe) * 100}%` }}><span>{Math.round(chancen[0])} %</span></i>
                <i className="nf" style={{ flexBasis: `${(chancen[1] / summe) * 100}%` }}><span>{Math.round(chancen[1])} %</span></i>
                <i className="no" style={{ flexBasis: `${(chancen[2] / summe) * 100}%` }}><span>{Math.round(chancen[2])} %</span></i>
              </div>
              {antwort && (
                <div className={`antw ${antwort.art === "ja" ? "g" : antwort.art === "nein" ? "w" : "a"}`} data-testid="tm-antwort">
                  {props.bildUrl ? <img className="por" src={props.bildUrl} alt="" /> : <span />}
                  <span><b>{antwort.titel}</b><small>{antwort.text}</small></span>
                  {antwort.art === "gegen" && <button type="button" className="knopf klein" onClick={gegenangebotAnnehmen}>Einschlagen</button>}
                </div>
              )}
              {fehler && <div className="hin w">{fehler}</div>}
              <div className="dfuss">
                <button type="button" className="knopf" onClick={props.onSchliessen} disabled={beschaeftigt}>Abbrechen</button>
                <span className="sp" />
                <button type="button" className={`knopf ${antwort?.art === "ja" ? "" : "haupt"} ${kannVerhandeln ? "" : "zu"}`} disabled={!kannVerhandeln} onClick={verhandeln} data-testid="tm-verhandeln">Verhandeln</button>
                <button type="button" className={`knopf ${kannAbschliessen ? "haupt" : "zu"}`} disabled={!kannAbschliessen} onClick={() => void abschliessen()} data-testid="tm-abschliessen">
                  {modus === "kauf" ? "Kauf abschließen" : "Verlängerung abschließen"}
                </button>
              </div>
            </div>
          </div>
          {/* Geld */}
          <div>
            <div className="dsp">
              <h4>{modus === "kauf" ? "Was der Deal mit meinem Geld macht" : "Was die Verlängerung bedeutet"}</h4>
              {modus === "kauf" ? (
                <div className="fw">
                  <div className="z"><span>Kasse heute</span><b className="t">{betragC(props.cash)}</b></div>
                  <div className="z"><span>Ablöse</span><b className="t minus">−{betragC(stand?.purchasePrice ?? null).replace("−", "")}</b></div>
                  <div className={`z sum ${(stand?.cashAfter ?? 0) < 0 ? "neg" : ""}`}><span>Kasse danach</span><b className="t">{betragC(stand?.cashAfter ?? null)}</b></div>
                </div>
              ) : (
                <div className="hin">Ohne Verlängerung läuft der Vertrag nach dieser Saison aus; {name} verlässt dann den Kader. Niedrige Moral begrenzt die Laufzeit und hebt die Forderung.</div>
              )}
              {gesperrt && (
                <div className="vorst rot">
                  <b>Abschluss gesperrt.</b>
                  <small>{sperrGrund}</small>
                  {props.onErstVerkaufen && <button type="button" className="knopf klein" onClick={props.onErstVerkaufen}>Erst verkaufen</button>}
                </div>
              )}
              <div className="fw">
                <div className="z"><span>Gehalt des Teams je Spieltag</span>
                  <b className="t">
                    {betragC(jeSpieltag(stand?.salaryBefore ?? props.teamGehalt), 2)}
                    {stand?.salaryAfter != null && <> → {betragC(jeSpieltag(stand.salaryAfter), 2)}</>}
                  </b>
                </div>
                <div className="z"><span>je Saison</span>
                  <b className="t">
                    {betragC(stand?.salaryBefore ?? props.teamGehalt)}
                    {stand?.salaryAfter != null && <> → {betragC(stand.salaryAfter)}</>}
                  </b>
                </div>
                {modus === "kauf" && (
                  <div className="z"><span>Kader</span><b className="t">{stand?.rosterBefore ?? props.kader ?? "—"}{stand?.rosterAfter != null && <> → {stand.rosterAfter}</>}<small>Minimum {props.kaderMin ?? 8}</small></b></div>
                )}
              </div>
              <h4>Kaderränge, wenn er {modus === "kauf" ? "kommt" : "bleibt"}</h4>
              <div className="rw">
                {props.wirkungen
                  .filter((w) => w.nachherBest !== w.vorher || w.nachherSchlecht !== w.vorher)
                  .slice(0, 8)
                  .map((w) => (
                    <div key={w.disziplinId}>
                      <span>{props.disziplinNamen[w.disziplinId] ?? w.disziplinId}</span>
                      <b className="t">{w.vorher}. → {rangText(w.nachherBest, w.nachherSchlecht)}</b>
                    </div>
                  ))}
                {props.wirkungen.every((w) => w.nachherBest === w.vorher && w.nachherSchlecht === w.vorher) && (
                  <div style={{ gridColumn: "1 / -1" }}><span>Kein Rang ändert sich.</span></div>
                )}
              </div>
              {stand && stand.blocking.length > 0 && (
                <div className="hin w">{stand.blocking.map((b) => formatMarketPreviewError(b) ?? BLOCK_TEXT[b] ?? "Nicht möglich.").join(" · ")}</div>
              )}
              <div className="hin">Bis zur Zusage (und innerhalb der Freigabe) bleibt „Abschließen“ gesperrt. Die Vorschau rechnet bei jeder Änderung neu.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
