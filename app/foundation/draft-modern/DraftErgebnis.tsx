"use client";

/**
 * DRAFT BEENDET (21.11.): die Ergebnis-Ansicht nach dem Mockup `public/mockups/draft-ergebnis-modern-21-11.html`
 * (Erklärung und Entscheidung von Chris: docs/design/draft-ergebnis-modern-21-11.md). Nur Anzeige: alle Zahlen kommen aus
 * `baueDraftErgebnis` (draft-ergebnis.ts), das aus `/api/draft`, dem Spielstand und der Vorstandsrechnung liest.
 * Jede Tabelle ist sortierbar (Designsystem-Regel 21.11.): Klick auf den Kopf sortiert, ein zweiter dreht.
 */
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import ClassIcon from "@/app/foundation/ClassIcon";
import RaceIcon from "@/app/foundation/RaceIcon";
import { officialDisciplineWeightLabels, officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";
import type { DraftKontext } from "./draft-kontext";
import { besteSechs, DISZIPLIN_KURZ, type ErgebnisDaten, type ErgebnisSpieler, type ErgebnisTeam } from "./draft-ergebnis";
import { betragC, de } from "./draft-format";

const dName = (id: string) => (officialDisciplineWeightLabels as Record<string, string>)[id] ?? id;

// ---------------------------------------------------------------------------------------------------------------------
// Sortierbare Tabelle
// ---------------------------------------------------------------------------------------------------------------------

type Sort = { k: string; auf: boolean };

export type Spalte<T> = {
  k: string;
  titel: string;
  tt?: string;
  breite?: string;
  ausrichtung?: "re" | "mi";
  /** Erster Klick sortiert aufsteigend (Namen, Pick-Nummer), sonst absteigend (Zahlen). */
  erstAuf?: boolean;
  wert: (zeile: T) => number | string;
  zelle: (zeile: T, index: number) => ReactNode;
  fuss?: (zeilen: T[]) => ReactNode;
};

function sortiere<T>(zeilen: readonly T[], spalten: ReadonlyArray<Spalte<T>>, s: Sort): T[] {
  const sp = spalten.find((x) => x.k === s.k) ?? spalten[0]!;
  return [...zeilen].sort((a, b) => {
    const x = sp.wert(a);
    const y = sp.wert(b);
    const r = typeof x === "string" || typeof y === "string" ? String(x).localeCompare(String(y), "de") : (x as number) - (y as number);
    return s.auf ? r : -r;
  });
}

function SortTabelle<T>({
  klasse,
  spalten,
  zeilen,
  start,
  zeilenKlasse,
  zeilenKey,
  mitFuss,
  zeilenHoehe,
  testId,
}: {
  klasse: string;
  spalten: ReadonlyArray<Spalte<T>>;
  zeilen: readonly T[];
  start: Sort;
  zeilenKlasse?: (z: T) => string;
  zeilenKey: (z: T) => string;
  mitFuss?: boolean;
  zeilenHoehe?: string;
  testId?: string;
}) {
  const [s, setS] = useState<Sort>(start);
  const sortiert = useMemo(() => sortiere(zeilen, spalten, s), [zeilen, spalten, s]);
  const klick = (sp: Spalte<T>) => setS((alt) => (alt.k === sp.k ? { k: sp.k, auf: !alt.auf } : { k: sp.k, auf: Boolean(sp.erstAuf) }));
  const taste = (e: KeyboardEvent, sp: Spalte<T>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      klick(sp);
    }
  };
  return (
    <table className={`tb ${klasse}`} style={zeilenHoehe ? ({ ["--zh" as string]: zeilenHoehe } as React.CSSProperties) : undefined} data-testid={testId}>
      <colgroup>{spalten.map((sp) => <col key={sp.k} style={{ width: /^[\d.]+$/.test(sp.breite ?? "") ? `calc(${sp.breite} * var(--u))` : sp.breite ?? "auto" }} />)}</colgroup>
      <thead>
        <tr>
          {spalten.map((sp) => {
            const aktiv = sp.k === s.k;
            return (
              <th
                key={sp.k}
                tabIndex={0}
                className={`${sp.ausrichtung ?? ""}${aktiv ? ` so${s.auf ? " auf" : ""}` : ""}`}
                title={`${sp.tt ?? sp.titel} – sortieren`}
                aria-sort={aktiv ? (s.auf ? "ascending" : "descending") : "none"}
                onClick={() => klick(sp)}
                onKeyDown={(e) => taste(e, sp)}
              >
                {sp.titel}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortiert.map((z, i) => (
          <tr key={zeilenKey(z)} className={zeilenKlasse?.(z) ?? ""}>
            {spalten.map((sp) => <td key={sp.k} className={sp.ausrichtung ?? ""}>{sp.zelle(z, i)}</td>)}
          </tr>
        ))}
      </tbody>
      {mitFuss ? (
        <tfoot>
          <tr>{spalten.map((sp) => <td key={sp.k} className={sp.ausrichtung ?? ""}>{sp.fuss ? sp.fuss(sortiert) : null}</td>)}</tr>
        </tfoot>
      ) : null}
    </table>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Kleinteile
// ---------------------------------------------------------------------------------------------------------------------

/** Klasse in Klassenfarbe mit Klassen-Icon, Rasse als Icon mit Namen (Chris 21.11.: Klassen immer farbig hervorheben). */
function KlasseRasse({ klasse, rasse, nurKlasse }: { klasse: string; rasse?: string; nurKlasse?: boolean }) {
  return (
    <span className="klr">
      <ClassIcon classNameValue={klasse} className="kl" />
      {nurKlasse || !rasse ? null : <RaceIcon race={rasse} className="ra" />}
    </span>
  );
}

const mittel = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);

// ---------------------------------------------------------------------------------------------------------------------
// Mein Kader
// ---------------------------------------------------------------------------------------------------------------------

function MeinKader({ k, d }: { k: DraftKontext; d: ErgebnisDaten }) {
  const spalten: Array<Spalte<ErgebnisSpieler>> = useMemo(
    () => [
      { k: "nr", titel: "Pick", breite: "4.7", erstAuf: true, wert: (p) => p.pickNr ?? 9999, zelle: (p) => <span className="pick t"><b>{p.quelle === "nachzug" ? "N" : `R${p.runde}`}</b> · #{p.pickNr ?? "–"}</span>, fuss: (z) => `${z.length} Picks` },
      {
        k: "n",
        titel: "Spieler",
        erstAuf: true,
        wert: (p) => p.name,
        zelle: (p) => {
          const bild = k.portrait(p.playerId);
          return (
            <span className="nm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {bild ? <img className="por drf-pl" role="link" title="Spielerprofil öffnen" onClick={() => k.profil(p.playerId)} src={bild} alt="" /> : <span className="por" />}
              <div>
                <b className="drf-pl" role="link" title="Spielerprofil öffnen" onClick={() => k.profil(p.playerId)} data-testid="draft-profil-link">{p.name}</b>
                <KlasseRasse klasse={p.className} rasse={p.race} />
              </div>
            </span>
          );
        },
      },
      { k: "o", titel: "OVR", breite: "2.9", ausrichtung: "re", tt: "Gesamtwert", wert: (p) => p.ovr, zelle: (p) => <span className="ovr t">{Math.round(p.ovr)}</span>, fuss: (z) => `Ø ${Math.round(mittel(z.map((p) => p.ovr)))}` },
      ...(["pow", "spe", "men", "soc"] as const).map((a) => ({
        k: a,
        titel: a.toUpperCase(),
        breite: "3.0",
        ausrichtung: "mi" as const,
        tt: `${a.toUpperCase()} (Wert)`,
        wert: (p: ErgebnisSpieler) => p[a],
        zelle: (p: ErgebnisSpieler) => <b className="t">{Math.round(p[a])}</b>,
        fuss: (z: ErgebnisSpieler[]) => `Ø ${Math.round(mittel(z.map((p) => p[a])))}`,
      })),
      {
        k: "top",
        titel: "Top-Disziplinen · Eignung",
        breite: "14.5",
        tt: "Beste drei Disziplinen (sortiert nach der besten Eignung)",
        wert: (p) => p.top[0]?.wert ?? 0,
        zelle: (p) => p.top.map((x) => (
          <span key={x.disziplinId} className={`dz ${x.wert >= 65 ? "h" : x.wert >= 50 ? "m" : ""}`} title={dName(x.disziplinId)}>
            {DISZIPLIN_KURZ[x.disziplinId] ?? x.disziplinId} <b className="t">{Math.round(x.wert)}</b>
          </span>
        )),
      },
      {
        k: "lauf",
        titel: "Vertrag",
        breite: "4.3",
        wert: (p) => p.vertragLauf,
        zelle: (p) => <span className="vt"><b className="t">{p.vertragLauf} {p.vertragLauf > 1 ? "Saisons" : "Saison"}</b><small>bis Ende S{p.vertragEndeSaison}</small></span>,
      },
      { k: "g", titel: "Gehalt/S.", breite: "4.1", ausrichtung: "re", tt: "Gehalt je Saison in C", wert: (p) => p.gehalt, zelle: (p) => <b className="t">{de(p.gehalt)}</b>, fuss: (z) => de(z.reduce((s, p) => s + p.gehalt, 0)) },
      { k: "mv", titel: "Ablöse", breite: "3.7", ausrichtung: "re", tt: "Ablöse in C", wert: (p) => p.abloese, zelle: (p) => <b className="t">{de(p.abloese)}</b>, fuss: (z) => de(z.reduce((s, p) => s + p.abloese, 0)) },
    ],
    [k],
  );
  // Zeilenhöhe an die Kadergröße anpassen (8 bis 14 Spieler ohne Scrollen), wie im Mockup.
  const panelRef = useRef<HTMLElement | null>(null);
  const probe = useRef<HTMLSpanElement | null>(null);
  const [zh, setZh] = useState<string | undefined>(undefined);
  const n = d.spieler.length || 1;
  useLayoutEffect(() => {
    function messen() {
      const p = panelRef.current;
      const u = probe.current?.offsetWidth;
      if (!p || !u) return;
      const frei = p.clientHeight / u - 2.7 - 15.2 - 1.9 - 2.5;
      setZh(`calc(${Math.max(2.3, Math.min(3.3, frei / n)).toFixed(2)} * var(--u))`);
    }
    messen();
    window.addEventListener("resize", messen);
    const t = window.setTimeout(messen, 400);
    return () => {
      window.removeEventListener("resize", messen);
      window.clearTimeout(t);
    };
  }, [n]);
  const summeAbl = d.spieler.reduce((s, p) => s + p.abloese, 0);
  const summeGeh = d.spieler.reduce((s, p) => s + p.gehalt, 0);
  return (
    <section className="pan pkader" ref={panelRef} data-testid="draft-ergebnis-kader">
      <span ref={probe} style={{ position: "absolute", width: "var(--u)", height: 0, visibility: "hidden" }} />
      <div className="pk"><h2>Mein Kader nach dem Draft</h2><span className="sp" /><span className="gk">{d.spieler.length} Picks · Ablösen {betragC(summeAbl)} · Gehalt {betragC(summeGeh)} je Saison</span></div>
      <div className="tbw">
        <SortTabelle klasse="tkader" spalten={spalten} zeilen={d.spieler} start={{ k: "nr", auf: true }} zeilenKey={(p) => p.playerId} mitFuss zeilenHoehe={zh} />
      </div>
      <Profil d={d} />
    </section>
  );
}

function Profil({ d }: { d: ErgebnisDaten }) {
  return (
    <div className="prof" data-testid="draft-ergebnis-profil">
      <div>
        <h3>Kaderprofil · Ø der vier Achsen gegen {d.ligaName}</h3>
        <div>
          {d.achsen.map((a) => {
            const v = Math.round(a.wert);
            const diff = Math.round(a.wert - a.liga);
            return (
              <div className="axz" key={a.id}>
                <b>{a.label}</b>
                <i><b style={{ width: `${Math.min(100, a.wert)}%` }} /><u style={{ left: `${Math.min(100, a.liga)}%` }} title="Liga-Schnitt" /></i>
                <b className="t">{v}</b>
                <em className={`t ${diff >= 0 ? "plus" : "minus"}`}>{diff >= 0 ? "+" : "−"}{Math.abs(diff)} zur Liga</em>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <h3>Bedarf am Markt · schwächste Disziplinen</h3>
        <div className="bed">
          {d.bedarf.map((b) => (
            <div key={b.disziplinId}><span>{dName(b.disziplinId)}</span><em>{b.abdeckung} Spieler ab Eignung 45</em><b className="t">{b.rang}.</b></div>
          ))}
        </div>
      </div>
      <div>
        <h3>Verträge laufen aus</h3>
        <div>
          {d.vertraege.map((v) => (
            <div className="vtz" key={v.endeSaison}>
              <b>Ende S{v.endeSaison}</b>
              <i><b style={{ width: `${(v.spieler / Math.max(1, d.spieler.length)) * 100}%` }} /></i>
              <em className="t">{v.spieler} Spieler · {de(v.gehalt)} C Gehalt</em>
            </div>
          ))}
        </div>
      </div>
      <div className="abd">
        <h3>Abdeckung · Spieler mit Eignung ab 45 je Disziplin (ein Spieltag braucht bis zu 6)</h3>
        <div className="abz">
          {d.disziplinen.map((z) => (
            <div key={z.disziplinId} className={`n${z.abdeckung === 0 ? 0 : z.abdeckung <= 2 ? 1 : z.abdeckung <= 4 ? 2 : 3}`} title={`${dName(z.disziplinId)}: ${z.abdeckung} Spieler ab Eignung 45`}>
              <b className="t">{z.abdeckung}</b><small>{DISZIPLIN_KURZ[z.disziplinId] ?? z.disziplinId}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Liga-Übersicht
// ---------------------------------------------------------------------------------------------------------------------

function LigaUebersicht({ k, d }: { k: DraftKontext; d: ErgebnisDaten }) {
  const meine = d.teams.find((t) => t.ich)?.liga ?? null;
  const [wahl, setWahl] = useState<0 | 1 | 2>(meine ?? 0);
  const zeilen = useMemo(() => d.teams.filter((t) => wahl === 0 || t.liga === wahl), [d.teams, wahl]);
  const spalten: Array<Spalte<ErgebnisTeam>> = useMemo(
    () => [
      { k: "nr", titel: "#", breite: "calc(2.6 * var(--u))", ausrichtung: "re", wert: (t) => t.staerke, tt: "Platz in der aktuellen Sortierung", zelle: (_t, i) => <span className="pick t">{i + 1}.</span> },
      {
        k: "n",
        titel: "Team",
        erstAuf: true,
        wert: (t) => t.name,
        zelle: (t) => {
          const w = k.wappen(t.teamId);
          return (
            <span className="nm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {w ? <img className="wp" src={w} alt="" /> : <span className="wp" />}
              <b>{t.name}</b>
              {t.liga ? <span className={`lg${t.liga === 1 ? " e" : ""}`}>L{t.liga}</span> : null}
            </span>
          );
        },
      },
      { k: "p", titel: "Picks", breite: "calc(4.4 * var(--u))", ausrichtung: "re", wert: (t) => t.picks, zelle: (t) => <span className="t">{t.picks}</span> },
      { k: "s", titel: "Stärke", breite: "calc(4.6 * var(--u))", ausrichtung: "re", wert: (t) => t.staerke, tt: "Kaderstärke: Ø der besten 6 je Disziplin", zelle: (t) => <b className="t">{de(t.staerke)}</b> },
      { k: "o", titel: "Ø OVR", breite: "calc(4.4 * var(--u))", ausrichtung: "re", wert: (t) => t.ovr, zelle: (t) => <span className="t">{de(t.ovr)}</span> },
      {
        k: "te",
        titel: "Teuerster Pick",
        breite: "calc(12 * var(--u))",
        wert: (t) => t.teuersterPick?.abloese ?? 0,
        zelle: (t) => (t.teuersterPick ? <span>{t.teuersterPick.name} <b className="t" style={{ color: "var(--creme)" }}>{de(t.teuersterPick.abloese)}</b></span> : "—"),
      },
      { k: "a", titel: "Ablösen", breite: "calc(4.4 * var(--u))", ausrichtung: "re", wert: (t) => t.abloese, zelle: (t) => <span className="t">{de(t.abloese)}</span> },
      { k: "g", titel: "Gehalt/S.", breite: "calc(4.6 * var(--u))", ausrichtung: "re", wert: (t) => t.gehalt, zelle: (t) => <span className="t">{de(t.gehalt)}</span> },
      { k: "k", titel: "Kasse", breite: "calc(4 * var(--u))", ausrichtung: "re", wert: (t) => t.kasse, zelle: (t) => <b className="t">{de(t.kasse)}</b> },
    ],
    [k],
  );
  const hatLiga = d.teams.some((t) => t.liga != null);
  return (
    <section className="pan pliga" data-testid="draft-ergebnis-liga">
      <div className="pk">
        <h2>Liga-Übersicht aller Drafts</h2><span className="sp" />
        {hatLiga ? (
          <div className="seg">
            {([[2, "Liga 2"], [1, "Liga 1"], [0, `Alle ${d.teams.length}`]] as Array<[0 | 1 | 2, string]>).map(([w, l]) => (
              <button key={w} type="button" className={wahl === w ? "an" : ""} onClick={() => setWahl(w)}>{l}</button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="tbw">
        <SortTabelle klasse="tliga" spalten={spalten} zeilen={zeilen} start={{ k: "s", auf: false }} zeilenKey={(t) => t.teamId} zeilenKlasse={(t) => (t.ich ? "ich" : "")} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Kaderstärke (Mitte)
// ---------------------------------------------------------------------------------------------------------------------

function Kaderstaerke({ k, d }: { k: DraftKontext; d: ErgebnisDaten }) {
  const [wahl, setWahl] = useState<string>(() => {
    // Startet auf der Disziplin mit dem besten Rang (dort sieht man die Stärke des Kaders).
    const beste = [...d.disziplinen].sort((a, b) => a.rang - b.rang || b.staerke - a.staerke)[0];
    return beste?.disziplinId ?? officialDisciplineWeightOrder[0];
  });
  const sechs = besteSechs(d.eignungen, wahl);
  const byId = new Map(d.spieler.map((s) => [s.playerId, s]));
  const rl = d.staerke.rangleiste;
  const n = d.ligaGroesse;
  return (
    <section className="pan">
      <div className="pk"><h2>Kaderstärke</h2><span className="sp" /><span className="gk">Ø der besten 6 je Disziplin · Rang in {d.ligaName}</span></div>
      <div className="fb">
        <div className="lv3">
          <div><small>meine Stärke</small><strong className="t">{de(d.staerke.meine)}</strong><em>Ø über 20 Disziplinen</em></div>
          <div><small>Rang</small><strong className="t">{d.staerke.rang}.</strong><em>von {n} in {d.ligaName}</em></div>
          <div><small>Liga-Schnitt</small><strong className="t">{de(d.staerke.schnitt)}</strong><em>{d.ligaName}</em></div>
        </div>
        <div className="rl16 rl32" style={{ gridTemplateColumns: `repeat(${Math.max(1, rl.length)}, 1fr)` }}>
          {rl.map((t, i) => <i key={t.teamId} className={t.ich ? "an" : ""} title={`${i + 1}. ${t.name} · ${de(t.staerke)}`} />)}
        </div>
        <div className="drl-disz" data-testid="draft-ergebnis-raenge" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {d.disziplinen.map((z) => (
            <div
              key={z.disziplinId}
              role="button"
              tabIndex={0}
              className={`drl-dz${z.rang <= 5 ? " top" : z.rang > z.ligaGroesse * 0.66 ? " tief" : ""}${z.disziplinId === wahl ? " wahl" : ""}`}
              onClick={() => setWahl(z.disziplinId)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setWahl(z.disziplinId); } }}
              title={`${dName(z.disziplinId)}: meine besten 6 anzeigen`}
            >
              <span>{dName(z.disziplinId)}</span>
              <i><b style={{ width: `${Math.max(4, ((z.ligaGroesse - z.rang + 1) / z.ligaGroesse) * 100)}%` }} /></i>
              <em className="t">{de(z.staerke)}</em>
              <strong className="t">{z.rang}.</strong>
            </div>
          ))}
        </div>
        <div className="b6" data-testid="draft-ergebnis-beste6">
          <div className="gk"><span>Meine besten 6 in</span> <b>{dName(wahl)} · Stärke {de(sechs.staerke)}</b><span className="sp" /><span>Disziplin anklicken</span></div>
          <div className="b6l">
            {sechs.liste.map((x, i) => {
              const p = byId.get(x.playerId);
              const bild = k.portrait(x.playerId);
              return (
                <div key={x.playerId} className={`b6z ${x.wert >= 65 ? "h" : x.wert < 45 ? "n" : ""}`}>
                  <span className="t">{i + 1}.</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {bild ? <img className="por drf-pl" role="link" title="Spielerprofil öffnen" onClick={() => k.profil(x.playerId)} src={bild} alt="" /> : <span className="por" />}
                  <span className="nm"><div><b className="drf-pl" role="link" onClick={() => k.profil(x.playerId)}>{p?.name ?? "—"}</b><KlasseRasse klasse={p?.className ?? ""} nurKlasse /></div></span>
                  <i><b style={{ width: `${Math.min(100, x.wert)}%` }} /></i>
                  <strong className="t">{Math.round(x.wert)}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Kasse (rechts)
// ---------------------------------------------------------------------------------------------------------------------

function Kasse({ d, onWeiter, onZumMarkt }: { d: ErgebnisDaten; onWeiter: () => void; onZumMarkt: () => void }) {
  const q = d.kasse;
  const start = Math.max(0.0001, q.kasse + q.abloesen);
  const pAbl = Math.max(0, Math.min(100, (q.abloesen / start) * 100));
  const pRest = Math.max(0, Math.min(100 - pAbl, (Math.max(0, q.kasse) / start) * 100));
  const vgb = (v: (typeof d.vergleich)[number]) => (
    <div className="erv" key={v.id}>
      <span>{v.label}</span>
      <div className="vgb" style={{ gridTemplateColumns: `repeat(${Math.max(1, v.von)}, 1fr)` }}>
        {Array.from({ length: v.von }, (_, i) => <i key={i} className={i === v.rang - 1 ? "an" : ""} />)}
      </div>
      <strong className="t">{v.rang}.</strong>
      <em className="t">Ø {de(v.schnitt)}{v.id === "gehalt" || v.id === "abloese" || v.id === "kasse" ? " C" : ""}</em>
    </div>
  );
  return (
    <section className="pan" data-testid="draft-ergebnis-kasse">
      <div className="pk"><h2>Kasse nach dem Draft</h2></div>
      <div className="ks">
        <div className="blk">
          <div className="gk"><span>Kasse zum Saisonstart</span></div>
          <div className="gross"><strong className="t" style={q.kasse < 0 ? { color: "var(--warn)" } : undefined}>{betragC(q.kasse)}</strong><small>von {betragC(start, 1)} Startbudget</small></div>
          <div className="stp"><i className="a" style={{ width: `${pAbl}%` }} /><i className="k" style={{ width: `${pRest}%` }} /></div>
          <div className="erl"><span>Ablösen <b className="t">−{de(q.abloesen)} C</b> ({d.spieler.length} Spieler)</span><span>bleibt <b className="t">{betragC(q.kasse)}</b></span></div>
        </div>
        <div className="blk">
          <div className="gk"><span>Gehälter je Saison</span>{q.gehaltAnteil != null ? <b className="t">{Math.round(q.gehaltAnteil * 100)} % vom Gehaltstopf</b> : null}</div>
          <div className="gross"><strong className="t" style={{ fontSize: "calc(1.9 * var(--u))" }}>{betragC(q.gehaltSumme)}</strong><small>Summe der Gehälter dieses Kaders</small></div>
          {q.gehaltTopf != null ? (
            <>
              <div className="stp"><i className="g" style={{ width: `${Math.min(100, (q.gehaltSumme / q.gehaltTopf) * 100)}%` }} /></div>
              <div className="erl"><span>Gehaltstopf (tragbar) <b className="t">{betragC(q.gehaltTopf)}</b></span><span>Luft <b className={`t ${(q.gehaltFrei ?? 0) > 0 ? "plus" : "minus"}`}>{betragC(q.gehaltFrei ?? 0)}</b></span></div>
            </>
          ) : null}
        </div>
        <div className="blk">
          <div className="gk"><span>Budget &amp; Freigabe</span></div>
          <div className="erz"><span>Kasse</span><b className="t">{betragC(q.kasse)}</b></div>
          {q.ruecklage > 0 ? <div className="erz"><span>Rücklage-Ziel</span><b className="t">−{betragC(q.ruecklage)}</b></div> : null}
          {q.gehaltspuffer > 0 ? <div className="erz"><span>Gehaltspuffer<small>7 Spieltage Gehalt, soweit ungedeckt</small></span><b className="t">−{betragC(q.gehaltspuffer)}</b></div> : null}
          <div className="erz" title={q.freigabeGrund}><span>Freigabe des Vorstands<small>{q.gedeckelt ? "nach Vertrauen" : "Saison 1: alles frei"}</small></span><b className="t">× {Math.round(q.freigabeAnteil * 100)} %</b></div>
          <div className="frei"><span>Restbudget für den Markt<small>Transfertopf, sofort verfügbar</small></span><strong className="t">{betragC(q.restbudget)}</strong></div>
        </div>
        <div className="blk">
          <div className="gk"><span>Kaderplätze</span><b className="t">{q.kader} von {q.kaderMax}</b></div>
          <div className="pl" style={{ gridTemplateColumns: `repeat(${q.kaderMax}, 1fr)` }}>
            {Array.from({ length: q.kaderMax }, (_, i) => <i key={i} className={i < q.kader ? (i < q.pflichtMin ? "p" : "o") : ""} style={i === q.pflichtMin - 1 ? { marginRight: "calc(.3 * var(--u))" } : undefined} />)}
          </div>
          <div className="erl">
            <span>Pflicht <b className={`t ${q.kader >= q.pflichtMin ? "plus" : "minus"}`}>{Math.min(q.kader, q.pflichtMin)} / {q.pflichtMin} {q.kader >= q.pflichtMin ? "erfüllt" : ""}</b></span>
            <span>Optional <b className="t">{Math.max(0, q.kader - q.pflichtMin)} / {q.kaderMax - q.pflichtMin}</b> · {Math.max(0, q.kaderMax - q.kader)} frei</span>
          </div>
        </div>
        <div className="blk">
          <div className="gk"><span>Vergleich in {d.ligaName} · Rang von {d.ligaGroesse}</span><span>Liga-Ø</span></div>
          {d.vergleich.map(vgb)}
        </div>
        <div className="akt">
          <button type="button" className="knopf" onClick={onZumMarkt} data-testid="draft-zum-markt">Zum Transfermarkt · {betragC(q.restbudget)} frei</button>
          <button type="button" className="knopf haupt" onClick={onWeiter} data-testid="draft-weiter">Weiter</button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------------------------------------------------

export function ErgebnisSeite({
  k,
  daten,
  onWeiter,
  onZumMarkt,
}: {
  k: DraftKontext;
  daten: ErgebnisDaten | null;
  onWeiter: () => void;
  onZumMarkt: () => void;
}) {
  const a = k.ansicht;
  const [ansicht, setAnsicht] = useState<"team" | "liga">("team");
  const abgebrochen = a.teams.some((t) => t.fertigGrund === "abgebrochen");
  const picks = a.verlauf.filter((e) => e.art === "pick" && e.playerId);
  const teuer = picks.reduce<(typeof picks)[number] | null>((m, e) => (!m || (e.abloese ?? 0) > (m.abloese ?? 0) ? e : m), null);
  const schnitt = picks.length ? picks.reduce((s, e) => s + (e.abloese ?? 0), 0) / picks.length : 0;
  const maxRunde = picks.reduce((m, e) => Math.max(m, e.runde), 0);
  const kpi = (l: string, w: string, kl?: string) => (
    <div className="kpi k" key={l}><span className="gk">{l}</span><strong className="t">{w}{kl ? <> <small>{kl}</small></> : null}</strong></div>
  );
  return (
    <div className="en er" data-testid="draft-ergebnis">
      <div className="folge ef">
        <div className="rd"><b>{abgebrochen ? "Draft abgebrochen" : "Draft beendet"}</b><small>{abgebrochen ? "Der Gastgeber hat den Draft vorzeitig beendet" : `${a.teams.length} Teams haben ihren Kader`}</small></div>
        <div className="kz4">
          {kpi("Picks", String(picks.length), `in ${maxRunde} Runden`)}
          {kpi("Teuerster Pick", de(teuer?.abloese ?? 0), `C · ${teuer?.playerId ? a.spieler[teuer.playerId]?.name ?? "" : ""} → ${teuer ? k.teamKuerzel(teuer.teamId) : ""}`)}
          {kpi("Ø Ablöse", de(schnitt), "C")}
          {kpi("Noch frei", String(k.zeilen.length), "Spieler am Markt")}
        </div>
        <div className="dst">
          {daten ? (
            <div className="seg" data-testid="draft-ergebnis-umschalter">
              <button type="button" className={ansicht === "team" ? "an" : ""} onClick={() => setAnsicht("team")} data-testid="draft-ergebnis-team">Mein Team</button>
              <button type="button" className={ansicht === "liga" ? "an" : ""} onClick={() => setAnsicht("liga")} data-testid="draft-ergebnis-ligabtn">Liga-Übersicht</button>
            </div>
          ) : null}
        </div>
      </div>
      {daten ? (
        <>
          {ansicht === "team" ? <MeinKader k={k} d={daten} /> : <LigaUebersicht k={k} d={daten} />}
          <Kaderstaerke k={k} d={daten} />
          <Kasse d={daten} onWeiter={onWeiter} onZumMarkt={onZumMarkt} />
        </>
      ) : (
        <section className="pan" style={{ gridColumn: "1 / -1" }}>
          <div className="pk"><h2>Draft beendet</h2></div>
          <div className="fb"><div className="hin">Dieses Team ist nicht im Draft — keine eigene Kaderstärke.</div><div className="akt"><button type="button" className="knopf haupt" onClick={onWeiter} data-testid="draft-weiter">Weiter</button></div></div>
        </section>
      )}
    </div>
  );
}
