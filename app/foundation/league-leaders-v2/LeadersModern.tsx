"use client";

/**
 * LEADERS im Broadcast-Stil (22.11.). Vorlage: public/mockups/leaders-modern-22-11.html, Konzept docs/design/leaders-modern-22-11.md.
 * Neu gebaut: drei Sichten (Spieler, Teams, Medaillen) mit Saison-/Spieltagsfilter und Liga-Schalter; links die sortierbare
 * Bestenliste, rechts zwanzig Disziplin-Karten (bzw. die zwei Disziplinen des Spieltags). Gerechnet wird in
 * `lib/foundation/leaders-modern.ts` aus Punkte-Ledger und Spieltags-Übersichten: gezeigt = gebucht, nichts neu skaliert.
 * Reine Leseseite. Die Mehrsaison-Inhalte (Rekorde, Legenden, All-Time, Erfolge) liegen unverändert in
 * `LeagueLeadersNewLook` und sind über „Rekorde & Legenden“ im Kopf erreichbar.
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import LeagueLeadersNewLook from "@/app/foundation/league-leaders-v2/LeagueLeadersNewLook";
import type { LeagueLeadersClientProps } from "@/app/foundation/league-leaders-v2/LeagueLeadersClient";
import { getClassIconSrc } from "@/app/foundation/classVisuals";
import { getDisciplineIconSrc } from "@/app/foundation/DisciplineIcon";
import { BcHero, BcIcon, BcReiter } from "@/components/foundation/broadcast";
import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";
import {
  baueLeadersModell,
  baueMedaillen,
  baueSpielerZeilen,
  baueTeamZeilen,
  LEADERS_ACHSEN,
  LEADERS_ACHSEN_LABEL,
  ligaFilter,
  vergibRaenge,
  wertungText,
  type LeadersAchse,
  type LeadersLiga,
  type LeadersModell,
  type LeadersSpieler,
  type LeadersTeam,
  type SpielerZeile,
  type TeamZeile,
} from "@/lib/foundation/leaders-modern";
import { ppTagesankerFuer } from "@/lib/resolve/pp-tagesanker";

import "./leaders-modern.css";

export type LeadersSpieltage = {
  verfuegbar: boolean;
  matchdayOptions: ReadonlyArray<{ id: string; index: number; gespielt: boolean }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getUebersicht: (matchdayId: string) => any;
};

export type LeadersModernProps = LeagueLeadersClientProps & {
  ownTeamId: string | null;
  spieltage: LeadersSpieltage | null;
};

const FARBE: Record<LeadersAchse, string> = { pow: "var(--ld-pow)", spe: "var(--ld-spe)", men: "var(--ld-men)", soc: "var(--ld-soc)" };
const z1 = (w: number) => (Math.round(w * 10) / 10).toFixed(1).replace(".", ",");

function Dz({ id, name }: { id: string; name: string }) {
  const src = getDisciplineIconSrc(id, name);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="ld-dzi" src={src} alt="" /> : <span className="ld-dzi" />;
}
function TeamZ({ team, kurz }: { team: LeadersTeam | undefined; kurz?: boolean }) {
  if (!team) return <span className="ld-team">–</span>;
  return (
    <span className="ld-team">
      {team.logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoSrc} alt="" loading="lazy" />
      ) : (
        <span className="ph">{team.initials}</span>
      )}
      <b>{kurz ? team.kuerzel : team.name}</b>
    </span>
  );
}
function Klasse({ klasse, achse }: { klasse: string; achse: LeadersAchse | null }) {
  const src = getClassIconSrc(klasse);
  return (
    <span className="ld-kl" style={achse ? ({ "--kf": FARBE[achse] } as CSSProperties) : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" /> : null}
      <span>{klasse}</span>
    </span>
  );
}
function Por({ s }: { s: LeadersSpieler }) {
  // eslint-disable-next-line @next/next/no-img-element
  return s.portraitSrc ? <img className="po" src={s.portraitSrc} alt="" loading="lazy" /> : <span className="po">{s.initials}</span>;
}
type Sort = { k: string; d: 1 | -1 };
function Kopf({ k, so, onSo, cls, tip, children }: { k: string; so: Sort; onSo: (k: string) => void; cls?: string; tip?: string; children: ReactNode }) {
  const an = so.k === k;
  return (
    <button type="button" className={`${cls ?? ""}${an ? " so" : ""}`} data-tip={tip} onClick={() => onSo(k)}>
      {children}
      <span className="pf">{an && so.d > 0 ? "▲" : "▼"}</span>
    </button>
  );
}
function sortiere<T>(liste: readonly T[], wert: (t: T) => string | number | null, d: 1 | -1, zweit: (t: T) => string): T[] {
  return [...liste].sort((a, b) => {
    const wa = wert(a);
    const wb = wert(b);
    if (wa == null && wb == null) return zweit(a).localeCompare(zweit(b), "de");
    if (wa == null) return 1;
    if (wb == null) return -1;
    const c = typeof wa === "string" && typeof wb === "string" ? wa.localeCompare(wb, "de") : (wa as number) - (wb as number);
    return c !== 0 ? c * d : zweit(a).localeCompare(zweit(b), "de");
  });
}
const naechster = (alt: Sort, k: string, textSpalte: boolean): Sort => (alt.k === k ? { k, d: (-alt.d as 1 | -1) } : { k, d: textSpalte ? 1 : -1 });
const MED = ["g", "s", "b"] as const;

export default function LeadersModern(props: LeadersModernProps) {
  const { gameState, ownTeamId: ownProp, spieltage, onOpenPlayer } = props;
  const [sicht, setSicht] = useState<"spieler" | "teams" | "medaillen">("spieler");
  const [zeit, setZeit] = useState(0);
  const [liga, setLiga] = useState<LeadersLiga | null>(null);
  const [ber, setBer] = useState<LeadersAchse | null>(null);
  const [soS, setSoS] = useState<Sort>({ k: "pp", d: -1 });
  const [soT, setSoT] = useState<Sort>({ k: "pkt", d: -1 });
  const [soM, setSoM] = useState<Sort>({ k: "med", d: -1 });
  const [historie, setHistorie] = useState(false);

  const ownTeamId = useMemo(() => ownProp ?? gameState?.teams.find((t) => t.humanControlled)?.teamId ?? null, [ownProp, gameState]);

  const uebersichten = useMemo(() => {
    if (!spieltage?.verfuegbar) return [];
    return spieltage.matchdayOptions.filter((o) => o.gespielt).map((o) => ({ spieltag: o.index + 1, matchdayId: o.id, uebersicht: spieltage.getUebersicht(o.id) }));
  }, [spieltage]);

  const m: LeadersModell | null = useMemo(
    () => (gameState ? baueLeadersModell({ gameState, ownTeamId, uebersichten, tagesankerFuer: (id) => ppTagesankerFuer(gameState, id) }) : null),
    [gameState, ownTeamId, uebersichten],
  );

  const eigenesTeam = m?.teams.find((t) => t.teamId === ownTeamId) ?? null;
  const eigeneLiga = eigenesTeam?.liga ?? null;
  const aktiveLiga: LeadersLiga = liga ?? (eigeneLiga ? "eigene" : "alle");
  const inLiga = useMemo(() => ligaFilter(aktiveLiga, eigeneLiga), [aktiveLiga, eigeneLiga]);
  const ligaName = aktiveLiga === "alle" || eigeneLiga == null ? "beide Ligen" : `Liga ${aktiveLiga === "eigene" ? eigeneLiga : 3 - eigeneLiga}`;

  const teamVon = useMemo(() => new Map((m?.teams ?? []).map((t) => [t.teamId, t] as const)), [m]);
  const zeitName = zeit ? `Spieltag ${zeit}` : (gameState?.season.id ?? "").replace("season-", "Saison ");

  const alleSpieler = useMemo(() => (m ? baueSpielerZeilen(m, zeit) : []), [m, zeit]);
  const alleTeams = useMemo(() => (m ? baueTeamZeilen(m, zeit, alleSpieler) : []), [m, zeit, alleSpieler]);
  const medaillen = useMemo(() => (m ? baueMedaillen(m) : null), [m]);

  if (historie && gameState) {
    return (
      <div data-testid="leaders-historie">
        <button type="button" className="ld-btn" style={{ margin: "0 0 8px" }} onClick={() => setHistorie(false)}>
          ← Zurück zu Leaders
        </button>
        <LeagueLeadersNewLook {...props} nurMehrsaison />
      </div>
    );
  }
  if (!m || !medaillen) return <div className="bc ld" data-testid="leaders-modern" />;

  const gespielt = medaillen.gespielt;
  const ligaT = alleTeams.filter((z) => z.team.liga === eigeneLiga);
  const fuehrer = [...ligaT].sort((a, b) => b.punkte - a.punkte)[0] ?? null;
  const topSp = [...alleSpieler].sort((a, b) => b.pp - a.pp)[0] ?? null;
  const eigMed = ownTeamId ? medaillen.jeTeam.get(ownTeamId) : null;
  const kulisse = einsatzlisteKulisseBild("basketball");
  const hatDaten = m.gespielteSpieltage.length > 0;
  const medaillenAn = sicht === "medaillen";

  const ppWert = (z: SpielerZeile) => (ber ? z.pa[LEADERS_ACHSEN.indexOf(ber)]! : z.pp);

  /* ---------------- Kopf ---------------- */
  const hero = (
    <BcHero
      className="ld-hero"
      wappen={eigenesTeam?.logoSrc ?? null}
      wappenAlt={eigenesTeam?.name ?? ""}
      titel="Leaders"
      kulisseUrl={kulisse}
      untertitel={
        <>
          <b>{zeitName}</b> · {ligaName} · nach Spieltag {m.gebuchteSpieltage} von {m.spieltageGesamt}
        </>
      }
      mitte={
        <>
          <BcReiter aktiv={sicht === "spieler"} onClick={() => setSicht("spieler")} eyebrow="PP-Bestenliste" titel="Spieler" symbol={<BcIcon name="team" />} wert={topSp ? z1(topSp.pp) : "–"} wertNote={topSp?.spieler.name ?? ""} />
          <BcReiter aktiv={sicht === "teams"} onClick={() => setSicht("teams")} eyebrow="Punkte und Team-PP" titel="Teams" symbol={<BcIcon name="team" />} wert={fuehrer ? fuehrer.punkte : "–"} wertNote={fuehrer ? `${fuehrer.team.kuerzel} führt${eigeneLiga ? ` Liga ${eigeneLiga}` : ""}` : ""} />
          <BcReiter aktiv={sicht === "medaillen"} onClick={() => { setSicht("medaillen"); setZeit(0); }} eyebrow="Gold · Silber · Bronze" titel="Medaillen" symbol={<BcIcon name="krone" />} wert={eigMed ? eigMed.gold + eigMed.silber + eigMed.bronze : "–"} wertNote={eigMed && eigenesTeam ? `${eigMed.gold} Gold für ${eigenesTeam.kuerzel}` : ""} />
        </>
      }
      rechts={
        <div className="ld-zeit">
          <div className="ld-seg">
            <button type="button" aria-pressed={zeit === 0} onClick={() => setZeit(0)}>
              Saison
            </button>
          </div>
          <div className={`ld-st${zeit ? " an" : ""}`} style={medaillenAn ? { opacity: 0.35 } : undefined} data-tip={medaillenAn ? "Medaillen gibt es nur für die ganze Saison" : undefined}>
            <button type="button" disabled={medaillenAn || (zeit || m.gebuchteSpieltage + 1) <= 1} aria-label="Spieltag zurück" onClick={() => setZeit(Math.max(1, (zeit || m.gebuchteSpieltage + 1) - 1))}>
              <BcIcon name="links" />
            </button>
            <span className="t" data-testid="leaders-zeit-spieltag" onClick={() => !medaillenAn && !zeit && m.gebuchteSpieltage > 0 && setZeit(m.gebuchteSpieltage)}>
              {zeit ? `Spieltag ${zeit}` : "Spieltag"}
            </span>
            <button type="button" disabled={medaillenAn || !zeit || zeit >= m.gebuchteSpieltage} aria-label="Spieltag vor" onClick={() => setZeit(Math.min(m.gebuchteSpieltage, zeit + 1))}>
              <BcIcon name="rechts" />
            </button>
          </div>
          {eigeneLiga ? (
            <div className="ld-seg" role="group" aria-label="Liga">
              <button type="button" aria-pressed={aktiveLiga === "eigene"} onClick={() => setLiga("eigene")}>Liga {eigeneLiga}</button>
              <button type="button" aria-pressed={aktiveLiga === "andere"} onClick={() => setLiga("andere")}>Liga {3 - eigeneLiga}</button>
              <button type="button" aria-pressed={aktiveLiga === "alle"} onClick={() => setLiga("alle")}>Beide</button>
            </div>
          ) : null}
          <button type="button" className="ld-btn" data-testid="leaders-zu-historie" data-tip="Rekorde, Legenden, All-Time und Erfolge über mehrere Saisons" onClick={() => setHistorie(true)}>
            Rekorde &amp; Legenden <BcIcon name="rechts" />
          </button>
        </div>
      }
    />
  );

  const kartenKopf = (id: string, rechts: ReactNode) => {
    const d = m.disziplinen.find((x) => x.id === id);
    return (
      <div className="kk">
        <Dz id={id} name={d?.name ?? id} />
        <b>{d?.name ?? id}</b>
        <small>{rechts}</small>
      </div>
    );
  };
  const kartenStil = (achse: LeadersAchse) => ({ "--kc": FARBE[achse] }) as CSSProperties;

  /* ---------------- Spieler ---------------- */
  const spielerLinks = () => {
    const pool = alleSpieler.filter((z) => inLiga(teamVon.get(z.spieler.teamId)?.liga ?? null));
    const rg = vergibRaenge(pool.map((z) => ({ id: z.spieler.id, wert: ppWert(z) })));
    const rgA = vergibRaenge(alleSpieler.map((z) => ({ id: z.spieler.id, wert: ppWert(z) })));
    const W: Record<string, (z: SpielerZeile) => string | number | null> = {
      name: (z) => z.spieler.name, kl: (z) => z.spieler.klasse, team: (z) => teamVon.get(z.spieler.teamId)?.kuerzel ?? "",
      pp: ppWert, e: (z) => z.einsaetze, ppe: (z) => (z.einsaetze ? z.pp / z.einsaetze : 0),
      a0: (z) => z.pa[0], a1: (z) => z.pa[1], a2: (z) => z.pa[2], a3: (z) => z.pa[3], mvp: (z) => z.mvp, t10: (z) => z.top10, best: (z) => z.best?.pp ?? 0,
    };
    const liste = sortiere(pool, W[soS.k] ?? ppWert, soS.d, (z) => z.spieler.name);
    const top = sortiere(pool, ppWert, -1, (z) => z.spieler.name);
    const max = top.length ? ppWert(top[0]!) : 1;
    const onSo = (k: string) => setSoS((a) => naechster(a, k, k === "name" || k === "kl" || k === "team"));
    return (
      <section className="ld-pan" aria-label="Bestenliste" data-testid="leaders-spieler">
        <div className="ld-pk">
          <h2>PP-Bestenliste</h2>
          <span className="ld-hin">{zeitName} · {ligaName}</span>
          <span className="ld-sp" />
          <div className="ld-seg" role="group" aria-label="Bereich">
            <button type="button" aria-pressed={!ber} onClick={() => { setBer(null); setSoS({ k: "pp", d: -1 }); }}>Alle PP</button>
            {LEADERS_ACHSEN.map((a) => (
              <button key={a} type="button" aria-pressed={ber === a} style={ber === a ? { background: FARBE[a], color: "#0b0d12" } : { color: FARBE[a] }} onClick={() => { setBer(a); setSoS({ k: "pp", d: -1 }); }}>{LEADERS_ACHSEN_LABEL[a]}</button>
            ))}
          </div>
        </div>
        <div className="ld-pod">
          {top.slice(0, 3).map((z, k) => (
            <div key={z.spieler.id} className={`ld-pd1${k === 0 ? " g" : ""}`} style={z.spieler.klasseAchse ? ({ "--kf": FARBE[z.spieler.klasseAchse] } as CSSProperties) : undefined}>
              <span className="bild">
                {z.spieler.portraitSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="gr" src={z.spieler.portraitSrc} alt="" />
                ) : (
                  <span className="gr">{z.spieler.initials}</span>
                )}
                <span className={`ld-med ${MED[k]}`}>{k + 1}</span>
              </span>
              <span style={{ minWidth: 0 }}>
                <h3>{z.spieler.name}</h3>
                <span className="u"><Klasse klasse={z.spieler.klasse} achse={z.spieler.klasseAchse} /><TeamZ team={teamVon.get(z.spieler.teamId)} kurz /></span>
              </span>
              <span className="pp"><strong className="t">{z1(ppWert(z))}</strong><span>PP{ber ? ` ${LEADERS_ACHSEN_LABEL[ber]}` : ""} · {z.einsaetze} Eins.</span></span>
            </div>
          ))}
        </div>
        <div className="ld-tl ld-sl">
          <div className="ld-th">
            <Kopf k="pp" so={soS} onSo={onSo} cls="m tipll" tip={`Rang nach PP in ${ligaName}, klein unter allen Spielern`}>#</Kopf>
            <Kopf k="name" so={soS} onSo={onSo}>Spieler</Kopf>
            <Kopf k="kl" so={soS} onSo={onSo}>Klasse</Kopf>
            <Kopf k="team" so={soS} onSo={onSo}>Team</Kopf>
            <Kopf k="pp" so={soS} onSo={onSo}>PP{ber ? ` ${LEADERS_ACHSEN_LABEL[ber]}` : ""}</Kopf>
            <Kopf k="e" so={soS} onSo={onSo} cls="r" tip="Einsätze">Eins.</Kopf>
            <Kopf k="ppe" so={soS} onSo={onSo} cls="r" tip="PP je Einsatz. Skala: der Tagesbeste einer Disziplin liegt um 5.">Ø</Kopf>
            {LEADERS_ACHSEN.map((a, i) => (
              <Kopf key={a} k={`a${i}`} so={soS} onSo={onSo} cls="r"><span style={{ color: FARBE[a] }}>{LEADERS_ACHSEN_LABEL[a]}</span></Kopf>
            ))}
            <Kopf k="mvp" so={soS} onSo={onSo} cls="r" tip="Spieler des Spieltags (MVP-Kandidat der Wertung)">MVP</Kopf>
            <Kopf k="t10" so={soS} onSo={onSo} cls="r tipl" tip="So oft unter den zehn Besten einer Disziplin">Top 10</Kopf>
            <Kopf k="best" so={soS} onSo={onSo} cls="r tipl" tip="Höchste Einzelwertung und ihre Disziplin">Bestwert</Kopf>
          </div>
          {liste.slice(0, 100).map((z) => {
            const v = ppWert(z);
            const s = z.spieler;
            return (
              <div key={s.id} className={`ld-tz${s.teamId === ownTeamId ? " wir" : ""}`} data-testid="leaders-spieler-zeile" onClick={() => onOpenPlayer?.(s.id)}>
                <span className="rg m t">{rg.get(s.id) ?? "–"}{aktiveLiga !== "alle" && rgA.get(s.id) != null ? <small>{rgA.get(s.id)}/{alleSpieler.length}</small> : null}</span>
                <span className="ld-sz"><Por s={s} /><b>{s.name}</b>{s.verletzt ? <span className="ld-marke" data-tip="Verletzt: nicht einsetzbar">verl.</span> : null}</span>
                <Klasse klasse={s.klasse} achse={s.klasseAchse} />
                <TeamZ team={teamVon.get(s.teamId)} kurz />
                <span className="ld-ppz"><b className="t">{z1(v)}</b><span className="ld-bk" style={{ height: ".55em" }}><i style={{ width: `${max ? (v / max) * 100 : 0}%`, ["--bf" as string]: ber ? FARBE[ber] : "var(--bc-gold)" }} /></span></span>
                <span className="r t leise">{z.einsaetze}</span>
                <span className="r t">{z.einsaetze ? z1(z.pp / z.einsaetze) : "–"}</span>
                {z.pa.map((p, i) => (
                  <span key={i} className={`r t${p ? "" : " null"}`} style={ber === LEADERS_ACHSEN[i] ? { fontWeight: 700, color: FARBE[ber] } : undefined}>{p ? z1(p) : "–"}</span>
                ))}
                <span className={`r t${z.mvp ? " gold" : " null"}`}><b>{z.mvp || "–"}</b></span>
                <span className={`r t${z.top10 ? "" : " null"}`}>{z.top10 || "–"}</span>
                <span className="ld-best t">{z.best ? <><b>{z1(z.best.pp)}</b><Dz id={z.best.disziplinId} name={m.disziplinen.find((d) => d.id === z.best!.disziplinId)?.name ?? ""} /></> : "–"}</span>
              </div>
            );
          })}
          {liste.length === 0 ? <div className="ld-leer">Noch keine gewerteten Einsätze{zeit ? " an diesem Spieltag" : ""}.</div> : null}
        </div>
        <div className="ld-kf"><span><b>{pool.length} Spieler</b> mit Einsatz{liste.length > 100 ? " · die ersten 100" : ""}</span><span className="ld-sp" /><span>PP-Skala C2: der Tagesbeste einer Disziplin liegt um 5 PP. PP sind öffentlich, kein Nebel.</span></div>
      </section>
    );
  };

  const spielerRechts = () => {
    const pool = alleSpieler.filter((z) => inLiga(teamVon.get(z.spieler.teamId)?.liga ?? null));
    if (zeit) {
      const ds = m.disziplinenJeSpieltag[zeit] ?? [];
      const klumpen: number[] = [];
      const karten = ds.map((id) => {
        const l = pool.filter((z) => (z.pd[id] ?? 0) > 0).sort((a, b) => (b.pd[id] ?? 0) - (a.pd[id] ?? 0) || a.spieler.name.localeCompare(b.spieler.name, "de"));
        klumpen.push(l.filter((z) => (z.pd[id] ?? 0) >= 4.99).length);
        const rg = vergibRaenge(l.map((z) => ({ id: z.spieler.id, wert: z.pd[id] ?? 0 })));
        const d = m.disziplinen.find((x) => x.id === id)!;
        return (
          <div key={id} className="ld-karte" style={kartenStil(d.achse)}>
            {kartenKopf(id, `${d.spielerJeTeam ?? "?"} je Team · ${l.length} gewertet`)}
            <div className="lz">
              {l.slice(0, 16).map((z) => (
                <div key={z.spieler.id} className={`z5${z.spieler.teamId === ownTeamId ? " wir" : ""}`}>
                  <span className="rg t">{rg.get(z.spieler.id)}</span>
                  <span className="ld-sz"><Por s={z.spieler} /><b>{z.spieler.name}</b></span>
                  <span className="ld-team">{teamVon.get(z.spieler.teamId)?.logoSrc ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={teamVon.get(z.spieler.teamId)!.logoSrc!} alt="" data-tip={teamVon.get(z.spieler.teamId)!.name} /> : null}</span>
                  <span className="ld-sk5"><i style={{ width: `${Math.min(100, ((z.pd[id] ?? 0) / 5) * 100)}%` }} /><u /></span>
                  <span className="r t"><b>{z1(z.pd[id] ?? 0)}</b></span>
                </div>
              ))}
            </div>
          </div>
        );
      });
      return (
        <section className="ld-pan" aria-label="Disziplinen">
          <div className="ld-pk"><h2>Tagesbeste</h2><span className="ld-hin">Spieltag {zeit} · {ligaName}</span><span className="ld-sp" /><span className="ld-hin">Skala 0 bis 5 PP</span></div>
          <div className="ld-tg">{karten}</div>
          <div className="ld-hinw">
            {m.tagesanker[zeit] ? (
              <><b>Tagesanker:</b> an diesem Spieltag gebucht. Mittel der besten drei = 5,5, weiche Kappe ab 4: der Tagesbeste liegt bei 4,8 bis 5,0.</>
            ) : (
              <><b>Skala C2:</b> der Strich rechts ist die 5.{klumpen.length ? ` Hier stehen ${klumpen.join(" und ")} Spieler genau auf 5,0.` : ""} <b>Ab der nächsten Saison</b> verteilt der Tagesanker neu (Mittel der besten drei = 5,5, weiche Kappe ab 4): der Tagesbeste liegt dann bei 4,8 bis 5,0 und steht allein vorn.</>
            )}
          </div>
        </section>
      );
    }
    return (
      <section className="ld-pan" aria-label="Disziplinen" data-testid="leaders-disziplin-beste">
        <div className="ld-pk"><h2>Disziplin-Beste</h2><span className="ld-hin">Saison · PP je Disziplin · {ligaName}</span><span className="ld-sp" /><span className="ld-hin">gespielt von 2</span></div>
        <div className="ld-dg">
          {m.disziplinen.map((d) => {
            const l = pool.filter((z) => (z.pd[d.id] ?? 0) > 0).sort((a, b) => (b.pd[d.id] ?? 0) - (a.pd[d.id] ?? 0) || a.spieler.name.localeCompare(b.spieler.name, "de")).slice(0, 3);
            return (
              <div key={d.id} className={`ld-karte${l.some((z) => z.spieler.teamId === ownTeamId) ? " mein" : ""}`} style={kartenStil(d.achse)}>
                {kartenKopf(d.id, `${gespielt[d.id] ?? 0}/2`)}
                {l.length ? (
                  <div className="kl3">
                    {l.map((z, k) => (
                      <div key={z.spieler.id} className="ld-kz3">
                        <span className={`ld-med ${MED[k]}`}>{k + 1}</span>
                        <span className={`nm${z.spieler.teamId === ownTeamId ? " wir" : ""}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {teamVon.get(z.spieler.teamId)?.logoSrc ? <img src={teamVon.get(z.spieler.teamId)!.logoSrc!} alt="" data-tip={teamVon.get(z.spieler.teamId)!.name} /> : null}
                          <b>{z.spieler.name}</b>
                        </span>
                        <span className="w t">{z1(z.pd[d.id] ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="off">noch nicht gespielt</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  /* ---------------- Teams ---------------- */
  const medZ = (id: string) => {
    const z = medaillen.jeTeam.get(id);
    return (
      <span className="ld-meds t">
        <span><span className="ld-med g" />{z?.gold ?? 0}</span>
        <span><span className="ld-med s" />{z?.silber ?? 0}</span>
        <span><span className="ld-med b" />{z?.bronze ?? 0}</span>
      </span>
    );
  };
  const teamsLinks = () => {
    const pool = alleTeams.filter((z) => inLiga(z.team.liga));
    const medW = (z: TeamZeile) => { const x = medaillen.jeTeam.get(z.team.teamId); return (x?.gold ?? 0) * 10000 + (x?.silber ?? 0) * 100 + (x?.bronze ?? 0); };
    const W: Record<string, (z: TeamZeile) => string | number | null> = {
      team: (z) => z.team.name, pkt: (z) => z.punkte, sun: (z) => z.s * 100 + z.u, erg: (z) => z.verhaeltnis, pp: (z) => z.pp, ppe: (z) => z.ppJeEinsatz,
      best: (z) => z.best?.pp ?? 0, med: medW, a0: (z) => z.pa[0], a1: (z) => z.pa[1], a2: (z) => z.pa[2], a3: (z) => z.pa[3],
    };
    const rk = soT.k === "team" ? "pkt" : soT.k;
    const rg = vergibRaenge(pool.map((z) => ({ id: z.team.teamId, wert: Number(W[rk]!(z)) })));
    const rgA = vergibRaenge(alleTeams.map((z) => ({ id: z.team.teamId, wert: Number(W[rk]!(z)) })));
    const liste = sortiere(pool, W[soT.k] ?? W.pkt!, soT.d, (z) => z.team.name);
    const maxPP = Math.max(1, ...pool.map((z) => z.pp));
    const onSo = (k: string) => setSoT((a) => naechster(a, k, k === "team"));
    return (
      <section className="ld-pan" aria-label="Bestenliste" data-testid="leaders-teams">
        <div className="ld-pk"><h2>Team-Bestenliste</h2><span className="ld-hin">{zeitName} · {ligaName}</span><span className="ld-sp" /><span className="ld-hin">Rang gilt für die sortierte Spalte</span></div>
        <div className="ld-tl ld-tt">
          <div className="ld-th">
            <span className="m">#</span>
            <Kopf k="team" so={soT} onSo={onSo}>Team</Kopf>
            <Kopf k="pkt" so={soT} onSo={onSo} cls="r" tip="Tabellenpunkte: Sieg 2, Remis 1 je Disziplin">Punkte</Kopf>
            <Kopf k="sun" so={soT} onSo={onSo} cls="m">S-U-N</Kopf>
            <Kopf k="erg" so={soT} onSo={onSo} cls="r" tip="Verhältnis: Summe der Ergebnis-Abstände aller Begegnungen (Skala E1)">Verh.</Kopf>
            <Kopf k="pp" so={soT} onSo={onSo} tip="Summe der Player Points aller eingesetzten Spieler">Team-PP</Kopf>
            <Kopf k="ppe" so={soT} onSo={onSo} cls="r" tip="PP je Einsatz">Ø</Kopf>
            <Kopf k="best" so={soT} onSo={onSo}>Bester Spieler</Kopf>
            <Kopf k="med" so={soT} onSo={onSo} cls="r" tip="Stand heute, vergeben am Saisonende">Medaillen</Kopf>
            {LEADERS_ACHSEN.map((a, i) => (
              <Kopf key={a} k={`a${i}`} so={soT} onSo={onSo} cls={`r${i > 1 ? " tipl" : ""}`} tip={`Tabellenpunkte in ${LEADERS_ACHSEN_LABEL[a]}`}><span style={{ color: FARBE[a] }}>{LEADERS_ACHSEN_LABEL[a]}</span></Kopf>
            ))}
          </div>
          {liste.map((z) => (
            <div key={z.team.teamId} className={`ld-tz${z.team.teamId === ownTeamId ? " wir" : ""}`} data-testid="leaders-team-zeile">
              <span className="rg m t">{rg.get(z.team.teamId) ?? "–"}{aktiveLiga !== "alle" && rgA.get(z.team.teamId) != null ? <small>{rgA.get(z.team.teamId)}/{alleTeams.length}</small> : null}</span>
              <TeamZ team={z.team} />
              <span className="r z t"><b>{z.punkte}</b></span>
              <span className="m t ld-sun"><i className="plus">{z.s}</i>-<i className="leise">{z.u}</i>-<i className="minus">{z.n}</i></span>
              <span className={`r t ${z.verhaeltnis > 0 ? "plus" : z.verhaeltnis < 0 ? "minus" : "null"}`}>{z.verhaeltnis > 0 ? "+" : z.verhaeltnis < 0 ? "−" : ""}{Math.abs(z.verhaeltnis).toString().replace(".", ",")}</span>
              <span className="ld-ppz"><b className="t">{z1(z.pp)}</b><span className="ld-bk" style={{ height: ".55em" }}><i style={{ width: `${(z.pp / maxPP) * 100}%` }} /></span></span>
              <span className="r t">{z1(z.ppJeEinsatz)}</span>
              <span className="ld-sz">{z.best ? <><Por s={z.best.spieler} /><b>{z.best.spieler.name}</b><span className="t leise" style={{ marginLeft: "auto" }}>{z1(z.best.pp)}</span></> : "–"}</span>
              {medZ(z.team.teamId)}
              {z.pa.map((p, i) => <span key={i} className={`r t${p ? "" : " null"}`}>{p}</span>)}
            </div>
          ))}
        </div>
        <div className="ld-kf"><span><b>Punkte</b> zählen für die Tabelle, <b>Team-PP</b> zeigen die Leistung der Spieler</span><span className="ld-sp" /><span>Medaillen: Stand heute{zeit ? " (ganze Saison)" : ""}</span></div>
      </section>
    );
  };
  const teamsRechts = () => {
    const pool = alleTeams.filter((z) => inLiga(z.team.liga));
    if (zeit) {
      const ds = m.disziplinenJeSpieltag[zeit] ?? [];
      return (
        <section className="ld-pan" aria-label="Disziplinen">
          <div className="ld-pk"><h2>Ergebnisse des Spieltags</h2><span className="ld-hin">Spieltag {zeit} · {ligaName}</span><span className="ld-sp" /><span className="ld-hin">Duell: 0 bis 10 je Seite · Pod: Abstand zum Mittel der Gegner</span></div>
          <div className="ld-tg">
            {ds.map((id) => {
              const d = m.disziplinen.find((x) => x.id === id)!;
              const l = m.einsaetze
                .filter((x) => x.spieltag === zeit && x.disziplinId === id && pool.some((p) => p.team.teamId === x.teamId))
                .sort((a, b) => b.wertung - a.wertung || b.punkte - a.punkte || (teamVon.get(a.teamId)?.name ?? "").localeCompare(teamVon.get(b.teamId)?.name ?? "", "de"));
              return (
                <div key={id} className="ld-karte" style={kartenStil(d.achse)}>
                  {kartenKopf(id, `${l.length} Teams`)}
                  <div className="lz">
                    {l.slice(0, 16).map((e, k) => (
                      <div key={e.teamId} className={`z5${e.teamId === ownTeamId ? " wir" : ""}`} style={{ gridTemplateColumns: "1.6em minmax(0,1fr) 3.6em minmax(0,.8fr) 2em" }}>
                        <span className="rg t">{k + 1}</span>
                        <TeamZ team={teamVon.get(e.teamId)} />
                        <span className="m t"><b className={e.punkte === 2 ? "plus" : e.punkte === 0 ? "minus" : ""}>{e.eigene != null && e.gegnerZahl != null ? `${e.eigene} : ${e.gegnerZahl}` : wertungText(m, id, e.verhaeltnis)}</b></span>
                        <span className="leise" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: ".9em" }}>{e.gegner.length === 1 ? `gegen ${teamVon.get(e.gegner[0]!)?.kuerzel ?? ""}` : "Vierer-Pod"}</span>
                        <span className="r t"><b>{e.punkte}</b></span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    }
    return (
      <section className="ld-pan" aria-label="Disziplinen" data-testid="leaders-disziplin-beste-teams">
        <div className="ld-pk"><h2>Disziplin-Beste Teams</h2><span className="ld-hin">Saison · Ergebnispunkte · {aktiveLiga === "alle" ? "je Liga getrennt gewertet, hier beide" : ligaName}</span><span className="ld-sp" /><span className="ld-hin">= Medaillenstand · Pods mit Vorzeichen</span></div>
        <div className="ld-dg">
          {m.disziplinen.map((d) => {
            const gesamt = new Map<string, number>();
            const vh = new Map<string, number>();
            for (const x of m.einsaetze) if (x.disziplinId === d.id) { gesamt.set(x.teamId, (gesamt.get(x.teamId) ?? 0) + x.wertung); vh.set(x.teamId, (vh.get(x.teamId) ?? 0) + x.verhaeltnis); }
            const l = pool.filter((z) => gesamt.has(z.team.teamId)).sort((a, b) => gesamt.get(b.team.teamId)! - gesamt.get(a.team.teamId)! || vh.get(b.team.teamId)! - vh.get(a.team.teamId)! || a.team.name.localeCompare(b.team.name, "de")).slice(0, 3);
            return (
              <div key={d.id} className={`ld-karte${l.some((z) => z.team.teamId === ownTeamId) ? " mein" : ""}`} style={kartenStil(d.achse)}>
                {kartenKopf(d.id, `${gespielt[d.id] ?? 0}/2`)}
                {l.length ? (
                  <div className="kl3">
                    {l.map((z, k) => (
                      <div key={z.team.teamId} className="ld-kz3">
                        <span className={`ld-med ${MED[k]}`}>{k + 1}</span>
                        <span className={`nm${z.team.teamId === ownTeamId ? " wir" : ""}`}>{/* eslint-disable-next-line @next/next/no-img-element */}{z.team.logoSrc ? <img src={z.team.logoSrc} alt="" /> : null}<b>{z.team.name}</b></span>
                        <span className="w t">{wertungText(m, d.id, gesamt.get(z.team.teamId)!)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="off">noch nicht gespielt</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  /* ---------------- Medaillen ---------------- */
  const medaillenLinks = () => {
    const pool = m.teams.filter((t) => inLiga(t.liga)).map((t) => ({ t, z: medaillen.jeTeam.get(t.teamId)! }));
    const sum = (z: (typeof pool)[number]) => z.z.gold + z.z.silber + z.z.bronze;
    const W: Record<string, (z: (typeof pool)[number]) => string | number> = {
      team: (z) => z.t.name, med: (z) => z.z.gold * 10000 + z.z.silber * 100 + z.z.bronze, g: (z) => z.z.gold, s: (z) => z.z.silber, b: (z) => z.z.bronze, sum, c: (z) => z.z.praemie,
    };
    const rk = soM.k === "team" ? "med" : soM.k;
    const rg = vergibRaenge(pool.map((z) => ({ id: z.t.teamId, wert: Number(W[rk]!(z)) })));
    const rgA = vergibRaenge(m.teams.map((t) => { const z = { t, z: medaillen.jeTeam.get(t.teamId)! }; return { id: t.teamId, wert: Number(W[rk]!(z)) }; }));
    const liste = sortiere(pool, W[soM.k] ?? W.med!, soM.d, (z) => z.t.name);
    const offen = m.disziplinen.filter((d) => (gespielt[d.id] ?? 0) < 2).length;
    const onSo = (k: string) => setSoM((a) => naechster(a, k, k === "team"));
    return (
      <section className="ld-pan" aria-label="Medaillenspiegel" data-testid="leaders-medaillen">
        <div className="ld-pk"><h2>Medaillenspiegel</h2><span className="ld-bsp" data-tip="Vergeben wird am Saisonende. Bis dahin zeigt die Seite den Stand, als wäre heute Schluss.">Stand heute</span><span className="ld-hin">{ligaName} · nach Spieltag {m.gebuchteSpieltage}</span><span className="ld-sp" /><span className="ld-hin">{offen} von {m.disziplinen.length} Disziplinen noch offen</span></div>
        <div className="ld-tl ld-mt">
          <div className="ld-th">
            <Kopf k="med" so={soM} onSo={onSo} cls="m tipll" tip="Rang im Medaillenspiegel: erst Gold, dann Silber, dann Bronze">#</Kopf>
            <Kopf k="team" so={soM} onSo={onSo}>Team</Kopf>
            <Kopf k="g" so={soM} onSo={onSo} cls="m" tip="Gold"><span className="ld-med g" /></Kopf>
            <Kopf k="s" so={soM} onSo={onSo} cls="m" tip="Silber"><span className="ld-med s" /></Kopf>
            <Kopf k="b" so={soM} onSo={onSo} cls="m" tip="Bronze"><span className="ld-med b" /></Kopf>
            <Kopf k="sum" so={soM} onSo={onSo} cls="r">Summe</Kopf>
            <Kopf k="c" so={soM} onSo={onSo} cls="r" tip="Liga 1: 0,5 / 0,3 / 0,2 C. Liga 2: 0,3 / 0,2 / 0,1 C je Medaille.">Prämie</Kopf>
            <span>Disziplinen</span>
          </div>
          {liste.map((z) => (
            <div key={z.t.teamId} className={`ld-tz${z.t.teamId === ownTeamId ? " wir" : ""}`} data-testid="leaders-medaillen-zeile">
              <span className="rg m t">{rg.get(z.t.teamId) ?? "–"}{aktiveLiga !== "alle" && rgA.get(z.t.teamId) != null ? <small>{rgA.get(z.t.teamId)}/{m.teams.length}</small> : null}</span>
              <TeamZ team={z.t} />
              <span className={`m mz t${z.z.gold ? " gold" : " null"}`}>{z.z.gold}</span>
              <span className={`m mz t${z.z.silber ? "" : " null"}`} style={z.z.silber ? { color: "var(--ld-silber)" } : undefined}>{z.z.silber}</span>
              <span className={`m mz t${z.z.bronze ? "" : " null"}`} style={z.z.bronze ? { color: "#cf8a55" } : undefined}>{z.z.bronze}</span>
              <span className="r z t">{sum(z)}</span>
              <span className={`r t${z.z.praemie ? " plus" : " null"}`}>{z.z.praemie ? `+${z1(z.z.praemie)} C` : "–"}</span>
              <span className="ld-dzl">
                {[...z.z.disziplinen].sort((a, b) => a.platz - b.platz).map((d) => (
                  <span key={d.disziplinId} data-tip={`${m.disziplinen.find((x) => x.id === d.disziplinId)?.name}: ${["Gold", "Silber", "Bronze"][d.platz]}`}>
                    <Dz id={d.disziplinId} name={m.disziplinen.find((x) => x.id === d.disziplinId)?.name ?? ""} />
                    <i style={{ background: ["var(--bc-gold)", "var(--ld-silber)", "#cf8a55"][d.platz] }} />
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="ld-kf"><span>Wertung: Summe der <b>Ergebnispunkte</b> je Disziplin, jede Disziplin kommt zweimal dran</span><span className="ld-sp" /><span>Geld ist klein mit Absicht · Moral +6 / +4 / +2 für Ehrgeiz-Traits</span></div>
      </section>
    );
  };
  const medaillenRechts = () => {
    const l: 1 | 2 = aktiveLiga === "alle" || eigeneLiga == null ? (eigeneLiga ?? 1) : ((aktiveLiga === "eigene" ? eigeneLiga : 3 - eigeneLiga) as 1 | 2);
    return (
      <section className="ld-pan" aria-label="Podium je Disziplin" data-testid="leaders-podien">
        <div className="ld-pk"><h2>Podium je Disziplin</h2><span className="ld-hin">Liga {l}{aktiveLiga === "alle" ? " (Liga 2 über den Liga-Schalter)" : ""} · Ergebnispunkte</span><span className="ld-sp" /><span className="ld-hin">gespielt von 2</span></div>
        <div className="ld-dg">
          {m.disziplinen.map((d) => {
            const s = medaillen.podien.get(`${l}:${d.id}`) ?? [];
            return (
              <div key={d.id} className={`ld-karte${s.some((e) => e.teamId === ownTeamId) ? " mein" : ""}`} style={kartenStil(d.achse)}>
                {kartenKopf(d.id, (gespielt[d.id] ?? 0) >= 2 ? <span className="plus">fertig</span> : `${gespielt[d.id] ?? 0}/2`)}
                {s.length ? (
                  <div className="kl3">
                    {s.map((e, k) => {
                      const t = teamVon.get(e.teamId);
                      return (
                        <div key={e.teamId} className="ld-kz3">
                          <span className={`ld-med ${MED[k]}`}>{k + 1}</span>
                          <span className={`nm${e.teamId === ownTeamId ? " wir" : ""}`}>{/* eslint-disable-next-line @next/next/no-img-element */}{t?.logoSrc ? <img src={t.logoSrc} alt="" /> : null}<b>{t?.name}</b></span>
                          <span className="w t">{wertungText(m, d.id, e.wert)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="off">noch nicht gespielt</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="bc ld" data-testid="leaders-modern">
      {hero}
      {hatDaten ? (
        <div className="ld-work">
          {sicht === "spieler" ? spielerLinks() : sicht === "teams" ? teamsLinks() : medaillenLinks()}
          {sicht === "spieler" ? spielerRechts() : sicht === "teams" ? teamsRechts() : medaillenRechts()}
        </div>
      ) : (
        <div className="ld-leer" data-testid="leaders-leer">Noch kein gewerteter Spieltag in dieser Saison. Die Bestenlisten füllen sich nach dem ersten Spieltag.</div>
      )}
    </div>
  );
}
