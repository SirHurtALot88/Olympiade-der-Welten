"use client";

/**
 * AUSRUESTUNG im Broadcast-Stil (22.11., Phase 1a). Vorlage: public/mockups/zwischen-den-spieltagen-22-11.html
 * (?ansicht=ausruestung | familien | kiste) und public/mockups/kiste-demo-22-11.html. Neu gebaut, nicht in eine alte Seite
 * eingehaengt: eigener Kopf, Lager links, Kiste oder Familien in der Mitte, Truhen-Chancen und Verlauf rechts.
 *
 * Phase 1a zeigt BESITZ: Lager (16 Plaetze, Materialien als Stapel), Teile, Ruhm, drei Truhen mit Funden, Familien und Stufen.
 * Ausruesten am Spieler, Schmiede, Haendler und Wirkung auf die Eignung folgen mit ihren Phasen; die Seite verspricht davon nichts.
 *
 * Alles kommt aus `gameState.ausruestung` des AKTIVEN Teams (`activeManagerTeamId`), nie aus einem festen Team. Fremde Lager kennt
 * der Browser nicht (`lib/ausruestung/ausruestung-sicht.ts`). Geschrieben wird nur ueber `onAktion` (POST /api/ausruestung).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";

import { BcHero, BcIcon, BcReiter } from "@/components/foundation/broadcast";
import { getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { AusruestungAktion } from "@/lib/ausruestung/ausruestung-aktionen";
import { affixZeile, iconBildPfad, teilUnterzeile, teilKurzzeile } from "@/lib/ausruestung/ausruestung-anzeige";
import {
  ATTRIBUT_LABEL,
  FAMILIEN,
  GOLD_ABSTAND_SPIELTAGE,
  LAGER_PLAETZE,
  MATERIAL_LABEL,
  MATERIAL_STAPEL_MAX,
  RUHM_JE_PUNKT,
  SELTENHEITEN,
  SELTENHEIT_LABEL,
  STUFEN,
  TRUHEN,
  TRUHEN_ARTEN,
} from "@/lib/ausruestung/ausruestung-katalog";
import { leseTeam, freiePlaetze } from "@/lib/ausruestung/ausruestung-lager";
import { ausruestungRegelFuer } from "@/lib/ausruestung/ausruestung-regel";
import { truhenChancen, truhenStatus } from "@/lib/ausruestung/ausruestung-truhen";
import type { Affix, Fund, MaterialId, Seltenheit, Teil, TruhenArt } from "@/lib/ausruestung/ausruestung-typen";

import "./ausruestung-modern.css";

export type AusruestungAktionFn = (input: AusruestungAktion) => Promise<{ ok: boolean; reason: string | null; meldung: string }>;

export type AusruestungModernProps = {
  gameState: GameState;
  /** Aktives Team des Managers (`activeManagerTeamId`); nie ein fremdes. */
  teamId: string | null;
  onAktion?: AusruestungAktionFn;
  /** Darf der aktive Manager dieses Team verwalten? Sonst ist die Seite nur lesbar. */
  kannVerwalten?: boolean;
  /** Ansicht, mit der die Seite aufgeht (Tests und Sprunglinks). */
  startAnsicht?: "lager" | "familien";
};

const SELTENHEIT_FARBE: Record<Seltenheit, string> = {
  standard: "#9aa7ba",
  selten: "#5aa2f0",
  episch: "#ac8af2",
  legendaer: "#f0c35a",
};

const TRUHE_FARBE: Record<TruhenArt, string> = { holz: "#c98a4b", eisen: "#9fb0c8", gold: "#f0c35a" };
const TRUHE_DREH: Record<TruhenArt, string> = { holz: "-18deg", eisen: "0deg", gold: "38deg" };

const MATERIAL_KURZ: Record<MaterialId, string> = { seil: "Se", eisen: "Ei", feder: "Fe", linse: "Li", rauchkraut: "Ra", kristall: "Kr", banner: "Ba", leder: "Le" };

/** Linien-Glyphen je Familie (24er-Raster, wie die Icon-Skizzen des Mockups). */
const GLYPHE: Record<string, ReactElement> = {
  lederruestung: <path d="M8 4l-5 3 2 4 3-1v10h8V10l3 1 2-4-5-3c-1 2-2 3-4 3S9 6 8 4z" />,
  plattenpanzer: (
    <>
      <path d="M6 4h12l2 5-3 2v9H7v-9L4 9z" />
      <path d="M12 6v14M8 11h8" />
    </>
  ),
  robe: <path d="M9 3h6l2 6-1 12H8L7 9zM9 9h6" />,
  handschuhe: <path d="M8 21v-6L5 12V8l2 1V5l2 1V4l2 1V4l2 1v6l2-1v4l-3 5z" />,
  schuhe: <path d="M4 17c0-3 1-5 3-6l2-4h5l1 4c3 0 5 2 5 6v2H4z" />,
  helm: <path d="M4 15a8 8 0 0116 0v3H4zM4 15h16M12 7v5" />,
  umhang: <path d="M8 3h8l3 7-3 11-4-3-4 3-3-11z" />,
  amulett: (
    <>
      <path d="M6 3l6 8 6-8" />
      <circle cx="12" cy="16" r="4" />
    </>
  ),
};

function Icon({ familie, seltenheit, klein = false }: { familie: string; seltenheit: Seltenheit; klein?: boolean }) {
  const bild = iconBildPfad(familie, seltenheit);
  return (
    <span className={`aus-ic${klein ? " is-klein" : ""} is-${seltenheit}`} style={{ "--sf": SELTENHEIT_FARBE[seltenheit] } as CSSProperties}>
      {bild ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bild} alt="" />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {GLYPHE[familie]}
        </svg>
      )}
    </span>
  );
}

function MaterialIcon({ material }: { material: MaterialId }) {
  return <span className="aus-ic is-material">{MATERIAL_KURZ[material]}</span>;
}

function AffixListe({ affixe }: { affixe: readonly Affix[] }) {
  return (
    <div className="aus-affixe">
      {affixe.map((a, i) => {
        const z = affixZeile(a);
        return (
          <div key={i} className={`aus-affix is-${z.art}`}>
            <b className={z.art === "plus" ? "is-plus" : ""}>{z.text}</b>
            {z.malus ? <span className="is-minus"> {z.malus}</span> : null}
            {z.nur ? <small>{z.nur}</small> : null}
          </div>
        );
      })}
    </div>
  );
}

function fundName(f: Fund): string {
  return f.art === "teil" ? f.teil.name : `${f.anzahl}× ${MATERIAL_LABEL[f.material]}`;
}

function fundFarbe(f: Fund): string {
  return f.art === "teil" ? SELTENHEIT_FARBE[f.teil.seltenheit] : "#e8dcc0";
}

type Buehne = "ruhe" | "ruettel" | "spannung" | "offen";

export default function AusruestungModern({ gameState, teamId, onAktion, kannVerwalten = true, startAnsicht = "lager" }: AusruestungModernProps) {
  const [ansicht, setAnsicht] = useState<"lager" | "familien">(startAnsicht);
  const [filter, setFilter] = useState<"alle" | "teile" | "material">("alle");
  const [gewaehltId, setGewaehltId] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [buehne, setBuehne] = useState<Buehne>("ruhe");
  const [waehlenIndex, setWaehlenIndex] = useState<number | null>(null);
  const animierenKiste = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>[]>([]);

  const team = useMemo(() => (teamId ? leseTeam(gameState, teamId) : null), [gameState, teamId]);
  const teamEintrag = useMemo(() => gameState.teams.find((t) => t.teamId === teamId) ?? null, [gameState.teams, teamId]);
  const regel = useMemo(() => {
    const ids = gameState.season.matchdayIds ?? [];
    const gebucht = new Set((gameState.seasonState.matchdayResults ?? []).map((r) => r.matchdayId));
    return ausruestungRegelFuer(gameState, ids.find((id) => !gebucht.has(id)) ?? null);
  }, [gameState]);
  const kiste = team?.offeneKiste ?? null;

  const aufraeumen = useCallback(() => {
    timer.current.forEach(clearTimeout);
    timer.current = [];
  }, []);
  useEffect(() => aufraeumen, [aufraeumen]);

  // Eine Kiste, die schon offen liegt (Seite neu geladen), zeigt ihre Funde sofort; nur eine eben geoeffnete laeuft als Animation.
  useEffect(() => {
    if (!kiste) {
      setBuehne("ruhe");
      return;
    }
    if (animierenKiste.current === kiste.kisteNr) {
      animierenKiste.current = null;
      aufraeumen();
      setBuehne("ruettel");
      timer.current.push(setTimeout(() => setBuehne("spannung"), 1200), setTimeout(() => setBuehne("offen"), 2000));
    } else {
      setBuehne((b) => (b === "ruhe" ? "offen" : b));
    }
  }, [kiste, aufraeumen]);

  const gewaehlt = useMemo(() => {
    const teile = (team?.lager ?? []).flatMap((p) => (p.art === "teil" ? [p.teil] : []));
    return teile.find((t) => t.id === gewaehltId) ?? teile[0] ?? null;
  }, [team, gewaehltId]);

  const sende = useCallback(
    async (eingabe: AusruestungAktion, vorher?: () => void) => {
      if (!onAktion || busy) return;
      setBusy(true);
      vorher?.();
      try {
        const r = await onAktion(eingabe);
        setMeldung(r.meldung || null);
        if (!r.ok) animierenKiste.current = null;
      } finally {
        setBusy(false);
      }
    },
    [onAktion, busy],
  );

  if (!teamId || !team || !teamEintrag) {
    return (
      <div className="bc aus" data-testid="ausruestung-modern">
        <div className="aus-leer">Kein Team gewählt. Wähle zuerst ein eigenes Team.</div>
      </div>
    );
  }

  const spieltagGebucht = (gameState.seasonState.matchdayResults ?? []).filter((r) => r.seasonId === gameState.season.id).length;
  const spieltageGesamt = gameState.season.matchdayIds?.length ?? 0;
  const wappen = getStaticTeamLogoUrl(teamId) ?? teamEintrag.logoPath ?? null;
  const belegt = team.lager.length;
  const teile = team.lager.flatMap((p) => (p.art === "teil" ? [p.teil] : []));
  const materialien = team.lager.flatMap((p) => (p.art === "material" ? [p.stapel] : []));
  const gutscheinSumme = team.gutscheine.holz + team.gutscheine.eisen + team.gutscheine.gold;
  const darf = Boolean(onAktion && kannVerwalten && regel.besitz);
  const erlaubt = { episch: regel.schmiede >= 3, legendaer: regel.effekte !== "aus" };

  const oeffne = (art: TruhenArt) => {
    void sende({ aktion: "kiste_oeffnen", truhe: art }, () => {
      animierenKiste.current = team.kisten;
      setWaehlenIndex(null);
    });
  };
  const waehle = (index: number) => {
    setWaehlenIndex(index);
    void sende({ aktion: "fund_waehlen", index });
  };

  // Farbe des seltensten Fundes: das Licht im Spalt verraet die Stufe eine halbe Sekunde vor dem Fund (Konzept §11).
  const seltensterFund = kiste ? [...kiste.funde].sort((a, b) => stufe(b) - stufe(a))[0]! : null;
  const buehneStil = { "--kf": seltensterFund ? fundFarbe(seltensterFund) : "#3a4660" } as CSSProperties;

  return (
    <div className="bc aus" data-testid="ausruestung-modern">
      <BcHero
        wappen={wappen}
        wappenAlt={teamEintrag.name}
        dachzeile={
          <>
            Kader · Ausrüstung · Spieltag {Math.min(spieltagGebucht + 1, Math.max(1, spieltageGesamt))} von {spieltageGesamt}
          </>
        }
        titel="Ausrüstung"
        untertitel={
          <>
            {teamEintrag.name} · <b className="bc-t">Lager, Truhen und Ruhm.</b> Beute aus Punkten, Gegenstände mit gewürfelten Affixen.
          </>
        }
        mitte={
          <>
            <BcReiter
              aktiv={ansicht === "lager"}
              onClick={() => setAnsicht("lager")}
              eyebrow="Lager"
              titel="Lager und Truhen"
              symbol={<BcIcon name="karte" />}
              wert={`${belegt}`}
              wertNote={`von ${LAGER_PLAETZE}`}
            />
            <BcReiter
              aktiv={ansicht === "familien"}
              onClick={() => setAnsicht("familien")}
              eyebrow="Katalog"
              titel="Familien"
              symbol={<BcIcon name="liste" />}
              wert={`${FAMILIEN.length} × ${SELTENHEITEN.length}`}
              wertNote="Stufen"
            />
          </>
        }
        rechts={
          <div className="aus-hr">
            <div className="aus-kachel">
              <strong className="bc-t">{team.ruhm}</strong>
              <span>Ruhm</span>
            </div>
            <div className="aus-kachel">
              <strong className="bc-t">{team.teile}</strong>
              <span>Teile</span>
            </div>
            <div className="aus-kachel">
              <strong className="bc-t">{gutscheinSumme}</strong>
              <span>Gutscheine</span>
            </div>
          </div>
        }
      />

      {!regel.besitz ? (
        <div className="aus-work is-einspaltig">
          <section className="aus-pan">
            <div className="aus-leer">Die Ausrüstung ist in diesem Spielstand nicht aktiv.</div>
          </section>
        </div>
      ) : (
        <div className="aus-work">
          {/* ---------- Lager ---------- */}
          <section className="aus-pan" aria-label="Lager">
            <div className="aus-pk">
              <h2>
                Lager · {belegt} von {LAGER_PLAETZE}
              </h2>
              <span className="aus-sp" />
              <span className="aus-hin">{freiePlaetze(team)} frei</span>
            </div>
            <div className="aus-chips" role="tablist">
              {(
                [
                  ["alle", "Alle"],
                  ["teile", "Ausrüstung"],
                  ["material", "Material"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? "is-an" : ""} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="aus-kb">
              {belegt === 0 ? <div className="aus-leer is-klein">Das Lager ist leer. Truhen füllen es: Ruhm kommt aus Punkten.</div> : null}
              {filter !== "material"
                ? teile.map((t) => (
                    <div key={t.id} className={`aus-zeile is-${t.seltenheit}${gewaehlt?.id === t.id ? " is-gew" : ""}`} style={{ "--sf": SELTENHEIT_FARBE[t.seltenheit] } as CSSProperties}>
                      <button type="button" className="aus-zeile__haupt" onClick={() => setGewaehltId(t.id)} aria-pressed={gewaehlt?.id === t.id}>
                        <Icon familie={t.familie} seltenheit={t.seltenheit} />
                        <span className="aus-zeile__text">
                          <b className="aus-name">{t.name}</b>
                          <small>{teilKurzzeile(t)}</small>
                        </span>
                      </button>
                      <span className="aus-zeile__aktion">
                        <span className="aus-tag">{SELTENHEIT_LABEL[t.seltenheit]}</span>
                        {darf ? (
                          <button type="button" className="aus-btn is-klein" disabled={busy} onClick={() => void sende({ aktion: "zerlegen", teilId: t.id })} title={`Zerlegen: ${STUFEN[t.seltenheit].zerlegenTeile} Teile`}>
                            Zerlegen
                          </button>
                        ) : null}
                      </span>
                    </div>
                  ))
                : null}
              {filter !== "teile"
                ? materialien.map((m) => (
                    <div key={m.material} className="aus-zeile is-material">
                      <div className="aus-zeile__haupt is-still">
                        <MaterialIcon material={m.material} />
                        <span className="aus-zeile__text">
                          <b className="aus-name">{MATERIAL_LABEL[m.material]}</b>
                          <small>
                            Stapel {m.anzahl} von {MATERIAL_STAPEL_MAX} · ein Lagerplatz
                          </small>
                        </span>
                      </div>
                      <span className="aus-zeile__aktion">
                        <span className="aus-tag">×{m.anzahl}</span>
                      </span>
                    </div>
                  ))
                : null}
            </div>
            <div className="aus-kf">
              Ein Lager für alles: Materialien stapeln bis {MATERIAL_STAPEL_MAX}, der elfte Fund wird zu einem Teil. Teile zählen nicht als Platz.
            </div>
          </section>

          {/* ---------- Mitte ---------- */}
          {ansicht === "lager" ? (
            <section className="aus-pan" aria-label="Kiste">
              <div className="aus-pk">
                <h2>{kiste ? TRUHEN[kiste.truhe].name : "Truhe öffnen"}</h2>
                <span className="aus-hin">{kiste ? "Einen Fund wählen, die anderen zerfallen zu Teilen" : "Drei Funde, einer bleibt"}</span>
                <span className="aus-sp" />
                {kiste && buehne !== "offen" ? (
                  <button type="button" className="aus-btn is-klein" onClick={() => { aufraeumen(); setBuehne("offen"); }}>
                    Überspringen
                  </button>
                ) : null}
              </div>
              <div className={`aus-buehne is-${buehne}`} style={buehneStil} data-phase={buehne}>
                <div className="aus-strahl" aria-hidden="true" />
                <div className="aus-truhe" style={{ "--dreh": TRUHE_DREH[kiste?.truhe ?? "eisen"] } as CSSProperties}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="aus-truhe__kranz" src="/sprites/beute/lichtkranz.png" alt="" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="aus-truhe__zu" src="/sprites/beute/kiste-eisen-zu.png" alt="" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="aus-truhe__offen" src="/sprites/beute/kiste-eisen-offen.png" alt="" />
                </div>
                {kiste ? (
                  <div className="aus-funde" role="list" aria-label="Funde der Kiste">
                    {kiste.funde.map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        role="listitem"
                        className={`aus-fund${waehlenIndex === i ? " is-gew" : ""}`}
                        style={{ "--sf": fundFarbe(f) } as CSSProperties}
                        disabled={!darf || busy || buehne !== "offen"}
                        onClick={() => waehle(i)}
                        data-testid={`fund-${i}`}
                      >
                        {f.art === "teil" ? <Icon familie={f.teil.familie} seltenheit={f.teil.seltenheit} /> : <MaterialIcon material={f.material} />}
                        <em>{f.art === "teil" ? SELTENHEIT_LABEL[f.teil.seltenheit] : "Material"}</em>
                        <b>{fundName(f)}</b>
                        {f.art === "teil" ? <AffixListe affixe={f.teil.affixe} /> : <small>{MATERIAL_STAPEL_MAX} je Stapel</small>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="aus-hinw">Wähle unten eine Truhe</div>
                )}
              </div>
              <div className="aus-leiste">
                {TRUHEN_ARTEN.map((art) => {
                  const s = truhenStatus(gameState, teamId, art);
                  const gutschein = team.gutscheine[art];
                  return (
                    <button
                      key={art}
                      type="button"
                      className={`aus-truhenwahl${s.moeglich ? " is-frei" : ""}`}
                      style={{ "--tf": TRUHE_FARBE[art] } as CSSProperties}
                      disabled={!darf || busy || !s.moeglich}
                      onClick={() => oeffne(art)}
                      data-testid={`truhe-${art}`}
                      title={s.grund === "gold_abstand" ? `Noch ${s.nochSpieltage} Spieltage` : undefined}
                    >
                      <b>{TRUHEN[art].name}</b>
                      <span>
                        {gutschein > 0 ? `${gutschein} Gutschein${gutschein === 1 ? "" : "e"}` : `${TRUHEN[art].ruhm} Ruhm`}
                        {s.grund === "kein_ruhm" ? ` · ${s.ruhmFehlt} fehlen` : null}
                        {s.grund === "gold_abstand" ? ` · in ${s.nochSpieltage} Spieltagen` : null}
                        {s.grund === "kiste_offen" ? " · erst wählen" : null}
                      </span>
                    </button>
                  );
                })}
                {kiste && darf ? (
                  <button type="button" className="aus-btn" disabled={busy} onClick={() => void sende({ aktion: "kiste_verwerfen" })}>
                    Alle drei zu Teilen
                  </button>
                ) : null}
                <span className="aus-log" role="status" aria-live="polite">
                  {meldung ?? (kiste && freiePlaetze(team) === 0 ? "Das Lager ist voll: erst ein Teil zerlegen oder alle drei zu Teilen machen." : "")}
                </span>
              </div>
            </section>
          ) : (
            <section className="aus-pan" aria-label="Familien">
              <div className="aus-pk">
                <h2>Die Familien</h2>
                <span className="aus-hin">Stufe sichtbar an Farbe, Rand und Leuchten</span>
              </div>
              <div className="aus-kb">
                <div className="aus-fam is-kopf">
                  <span>Familie · bevorzugt</span>
                  {SELTENHEITEN.map((s) => (
                    <span key={s} style={{ color: SELTENHEIT_FARBE[s] }}>
                      {SELTENHEIT_LABEL[s]} · {STUFEN[s].affixe} Affix{STUFEN[s].affixe === 1 ? "" : "e"}
                    </span>
                  ))}
                </div>
                {FAMILIEN.map((f) => (
                  <div key={f.id} className="aus-fam" data-testid={`familie-${f.id}`}>
                    <span className="aus-fam__name">
                      <b>{f.name}</b>
                      <small>
                        {ATTRIBUT_LABEL[f.bevorzugt[0]]}, {ATTRIBUT_LABEL[f.bevorzugt[1]]} · Material {MATERIAL_LABEL[f.material]}
                      </small>
                    </span>
                    {SELTENHEITEN.map((s) => (
                      <span key={s} className={`aus-fam__stufe is-${s}`} style={{ "--sf": SELTENHEIT_FARBE[s] } as CSSProperties}>
                        <Icon familie={f.id} seltenheit={s} klein />
                        <span>
                          <b>{f.stufenwort[s]}</b>
                          <small>
                            {s === "legendaer" && !erlaubt.legendaer ? "noch nicht in Truhen" : s === "episch" && !erlaubt.episch ? "noch nicht in Truhen" : `+${STUFEN[s].wertMin} bis +${STUFEN[s].wertMax} je Affix`}
                          </small>
                        </span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <div className="aus-kf">Bevorzugt heißt: 60 % der Affixe fallen auf diese zwei Attribute, 40 % auf die übrigen zehn.</div>
            </section>
          )}

          {/* ---------- Rechts ---------- */}
          <aside className="aus-pan" aria-label="Kontext">
            {ansicht === "familien" || gewaehlt ? (
              <>
                <div className="aus-pk">
                  <h2>Der Gegenstand</h2>
                  <span className="aus-sp" />
                  <span className="aus-hin">gewürfelt aus der Saat des Spielstands</span>
                </div>
                <div className="aus-detail" data-testid="gegenstand">
                  {gewaehlt ? <Gegenstand teil={gewaehlt} /> : <div className="aus-leer is-klein">Noch kein Teil im Lager.</div>}
                </div>
              </>
            ) : null}
            <div className="aus-pk">
              <h2>Drei Truhen</h2>
              <span className="aus-sp" />
              <span className="aus-hin">Chancen je Fund in Prozent</span>
            </div>
            <div className="aus-tafel" data-testid="truhen-tafel">
              <div className="aus-tafel__zeile is-kopf">
                <span />
                {TRUHEN_ARTEN.map((a) => (
                  <b key={a} style={{ color: TRUHE_FARBE[a] }}>
                    {a === "holz" ? "Holz" : a === "eisen" ? "Eisen" : "Gold"}
                  </b>
                ))}
              </div>
              <div className="aus-tafel__zeile">
                <span>Ruhm</span>
                {TRUHEN_ARTEN.map((a) => (
                  <b key={a}>{TRUHEN[a].ruhm}</b>
                ))}
              </div>
              {(
                [
                  ["material", "Material"],
                  ["standard", "Standard"],
                  ["selten", "Selten"],
                  ["episch", "Episch"],
                  ["legendaer", "Legendär"],
                ] as const
              )
                .filter(([k]) => (k === "episch" ? erlaubt.episch : k === "legendaer" ? erlaubt.legendaer : true))
                .map(([k, label]) => (
                  <div key={k} className="aus-tafel__zeile">
                    <span>{label}</span>
                    {TRUHEN_ARTEN.map((a) => (
                      <b key={a}>{truhenChancen(a, regel)[k] || "–"}</b>
                    ))}
                  </div>
                ))}
            </div>
            <div className="aus-regeln">
              <b>So kommt Ruhm:</b> {RUHM_JE_PUNKT} Ruhm je Duellpunkt. <b>Holz:</b> der erste Disziplinsieg des Spieltags gibt eine Truhe. <b>Gold:</b> Platz 1 bis 3
              zur Halbzeit und am Saisonende; für Ruhm höchstens eine je {GOLD_ABSTAND_SPIELTAGE} Spieltage. Mindestens ein Fund jeder Kiste ist Ausrüstung.
            </div>
            <div className="aus-pk">
              <h2>Verlauf</h2>
            </div>
            <div className="aus-kb aus-verlauf">
              {team.verlauf.length === 0 ? <div className="aus-leer is-klein">Noch nichts geöffnet.</div> : null}
              {[...team.verlauf].reverse().map((v, i) => (
                <div key={i} className="aus-v">
                  <small>{v.spieltag > 0 ? `Spieltag ${v.spieltag}` : "Vor dem ersten Spieltag"}</small>
                  {v.text}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function stufe(f: Fund): number {
  return f.art === "teil" ? SELTENHEITEN.indexOf(f.teil.seltenheit) + 1 : 0;
}

function Gegenstand({ teil }: { teil: Teil }) {
  const farbe = SELTENHEIT_FARBE[teil.seltenheit];
  return (
    <div className={`aus-gegenstand is-${teil.seltenheit}`} style={{ "--sf": farbe } as CSSProperties}>
      <header>
        <Icon familie={teil.familie} seltenheit={teil.seltenheit} />
        <div>
          <h3>{teil.name}</h3>
          <small>{teilUnterzeile(teil)}</small>
        </div>
      </header>
      <AffixListe affixe={teil.affixe} />
      <div className="aus-gegenstand__fuss">
        Zerlegt: {STUFEN[teil.seltenheit].zerlegenTeile} Teil{STUFEN[teil.seltenheit].zerlegenTeile === 1 ? "" : "e"} · {teil.affixe.length} von {STUFEN[teil.seltenheit].affixe} Affixen
        {teil.affixe.length < STUFEN[teil.seltenheit].affixe ? " (ein Platz frei)" : ""}
      </div>
    </div>
  );
}
