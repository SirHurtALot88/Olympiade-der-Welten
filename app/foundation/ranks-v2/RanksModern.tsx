"use client";

/**
 * RANKS im Broadcast-Stil (22.11.). Vorlage: public/mockups/ranks-modern-22-11.html, Konzept docs/design/ranks-modern-22-11.md.
 * Neu gebaut, nicht in die alte Seite eingehängt (Chris, 18.11.): Rang-Matrix Team x (Gesamt, vier Bereiche, zwanzig
 * Disziplinen) in zwei Lesarten (Stärke = Papierform, Punkte = Ertrag) und eine Spieler-Sicht je Disziplin.
 * Gerechnet wird in `lib/foundation/ranks-modern.ts` (Stärke aus der kanonischen Rangfunktion, Punkte aus den Duellen,
 * Nebel über die sichtbare Stufe); diese Datei liest nur `sichtWert`, `baueSpielerListe`, `baueSpielerProfil`,
 * nie ein verdecktes Rohfeld. Reine Leseseite, kein Schreibweg.
 */
import { useMemo, useState, type ReactNode } from "react";

import { getClassIconSrc } from "@/app/foundation/classVisuals";
import { getDisciplineIconSrc } from "@/app/foundation/DisciplineIcon";
import { getRaceIconSrc } from "@/app/foundation/RaceIcon";
import { BcHero, BcIcon, BcReiter } from "@/components/foundation/broadcast";
import type { GameState } from "@/lib/data/olyDataTypes";
import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";
import {
  baueRanksModell,
  baueSpielerListe,
  baueSpielerProfil,
  ligaFilter,
  ranksSpalten,
  RANKS_ACHSEN,
  RANKS_ACHSEN_LABEL,
  RANKS_SPIELER_LIMIT,
  stufenText,
  teamRangTabelle,
  teamWert,
  teamWertText,
  vergibRaenge,
  type RanksAchse,
  type RanksLiga,
  type RanksMass,
  type RanksModell,
  type RanksTeam,
  type SpielerSortSchluessel,
} from "@/lib/foundation/ranks-modern";
import { duellPunkteJeDisziplin } from "@/lib/season/saisonstand-modern-logik";

import "./ranks-modern.css";

export type RanksSpieltage = {
  verfuegbar: boolean;
  matchdayOptions: ReadonlyArray<{ id: string; gespielt: boolean }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getUebersicht: (matchdayId: string) => any;
};

export type RanksModernProps = {
  gameState: GameState;
  /** Aktives Manager-Team (`activeManagerTeamId`), nie ein festes Team. */
  ownTeamId: string | null;
  spieltage: RanksSpieltage | null;
  onOpenTeam?: (teamId: string) => void;
  onOpenPlayer?: (playerId: string) => void;
};

const ACHSE_FARBE: Record<RanksAchse, string> = { pow: "var(--rk-pow)", spe: "var(--rk-spe)", men: "var(--rk-men)", soc: "var(--rk-soc)" };
const ACHSE_NAME: Record<RanksAchse, string> = { pow: "Power", spe: "Speed", men: "Mental", soc: "Social" };
/** Bereichsklasse (setzt `--ac`): Farbe der Spalte, Tönung und Trenner hängen daran. "ges" = Gold. */
const bk = (a: RanksAchse | "ges") => `a-${a}`;

function z1(wert: number) {
  return (Math.round(wert * 10) / 10).toFixed(1).replace(".", ",");
}

function zelleKlasse(rang: number | null, n: number): string {
  if (rang == null) return "leer";
  if (rang === 1) return "r1";
  const q = n > 1 ? (rang - 1) / (n - 1) : 0;
  return q <= 0.25 ? "o" : q >= 0.75 ? "u" : "";
}

function chipStil(rang: number | null, n: number) {
  if (rang == null) return undefined;
  if (rang === 1) return { background: "var(--bc-gold)", color: "#17120a" };
  const q = n > 1 ? (rang - 1) / (n - 1) : 0;
  if (q <= 0.25) return { background: "rgba(98,211,148,.26)", color: "#b9f2d2" };
  if (q >= 0.75) return { background: "rgba(255,96,88,.2)", color: "#ffb1ac" };
  return undefined;
}

function RangChip({ rang, n }: { rang: number | null; n: number }) {
  if (rang == null) return <span className="rk-rgc null">–</span>;
  return (
    <span className="rk-rgc t" style={chipStil(rang, n)}>
      {rang}
    </span>
  );
}

function Diff({ s, p }: { s: number | null; p: number | null }) {
  if (s == null || p == null) return <span className="rk-diff null">–</span>;
  const d = s - p;
  return <span className={`rk-diff t ${d > 0 ? "plus" : d < 0 ? "minus" : "null"}`}>{d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "±0"}</span>;
}

function DiszIcon({ id, name }: { id: string; name: string }) {
  const src = getDisciplineIconSrc(id, name);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="rk-dzi" src={src} alt="" /> : <span className="rk-dzi" />;
}

function TeamZelle({ team, kurz }: { team: RanksTeam | undefined; kurz?: boolean }) {
  if (!team) return <span className="rk-team">–</span>;
  return (
    <span className="rk-team">
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

function Klasse({ klasse, achse }: { klasse: string; achse: RanksAchse | null }) {
  const src = getClassIconSrc(klasse);
  return (
    <span className="rk-kl" style={achse ? ({ "--kf": ACHSE_FARBE[achse] } as React.CSSProperties) : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" /> : null}
      <span>{klasse}</span>
    </span>
  );
}

type KopfProps = { k: string; so: { k: string; d: 1 | -1 }; onSo: (k: string) => void; className?: string; tip?: string; kc?: string; children: ReactNode };
function Kopf({ k, so, onSo, className, tip, kc, children }: KopfProps) {
  const an = so.k === k;
  return (
    <button type="button" className={`${className ?? ""}${an ? " so" : ""}`} style={kc ? ({ "--kc": kc } as React.CSSProperties) : undefined} data-tip={tip} onClick={() => onSo(k)}>
      {children}
      <span className="pf">{an && so.d < 0 ? "▲" : "▼"}</span>
    </button>
  );
}

/** Reihenfolge der Sortierung: Sortierrichtung 1 = beste zuerst (Rang aufsteigend). */
function sortiere<T>(liste: readonly T[], wert: (t: T) => string | number | null, richtung: 1 | -1, zweit: (t: T) => string): T[] {
  return [...liste].sort((a, b) => {
    const wa = wert(a);
    const wb = wert(b);
    if (wa == null && wb == null) return zweit(a).localeCompare(zweit(b), "de");
    if (wa == null) return 1;
    if (wb == null) return -1;
    const c = typeof wa === "string" && typeof wb === "string" ? wa.localeCompare(wb, "de") : (wa as number) - (wb as number);
    return c !== 0 ? c * richtung : zweit(a).localeCompare(zweit(b), "de");
  });
}

export default function RanksModern({ gameState, ownTeamId: ownTeamIdProp, spieltage, onOpenTeam, onOpenPlayer }: RanksModernProps) {
  const ownTeamId = useMemo(() => ownTeamIdProp ?? gameState.teams.find((t) => t.humanControlled)?.teamId ?? null, [ownTeamIdProp, gameState.teams]);

  const duell = useMemo(() => {
    if (!spieltage?.verfuegbar) return null;
    const gespielte = spieltage.matchdayOptions.filter((o) => o.gespielt);
    return duellPunkteJeDisziplin(gespielte.map((o) => spieltage.getUebersicht(o.id)));
  }, [spieltage]);
  const gebucht = useMemo(() => (spieltage?.verfuegbar ? spieltage.matchdayOptions.filter((o) => o.gespielt).length : 0), [spieltage]);

  const modell: RanksModell = useMemo(
    () => baueRanksModell({ gameState, ownTeamId, duell, gebuchteSpieltage: gebucht }),
    [gameState, ownTeamId, duell, gebucht],
  );

  const eigenesTeam = modell.teams.find((t) => t.teamId === ownTeamId) ?? null;
  const eigeneLiga = eigenesTeam?.liga ?? null;

  const [sicht, setSicht] = useState<"teams" | "spieler">("teams");
  const [mass, setMass] = useState<RanksMass>("staerke");
  const [zeige, setZeige] = useState<"rang" | "wert">("rang");
  const [liga, setLiga] = useState<RanksLiga>(eigeneLiga ? "eigene" : "alle");
  const [dId, setDId] = useState<string | null>(null);
  const [selTeam, setSelTeam] = useState<string | null>(null);
  const [selSpieler, setSelSpieler] = useState<string | null>(null);
  const [nurKader, setNurKader] = useState(false);
  const [kf, setKf] = useState<RanksAchse | null>(null);
  const [soT, setSoT] = useState<{ k: string; d: 1 | -1 }>({ k: "ges", d: 1 });
  const [soS, setSoS] = useState<{ k: SpielerSortSchluessel; d: 1 | -1 }>({ k: "eig", d: -1 });

  const ligaName = liga === "alle" || eigeneLiga == null ? "alle 32" : `Liga ${liga === "eigene" ? eigeneLiga : 3 - eigeneLiga}`;
  const inLiga = useMemo(() => ligaFilter(liga, eigenesTeam?.liga ?? null), [liga, eigenesTeam]);
  const spalten = useMemo(() => ranksSpalten(modell), [modell]);
  const discById = useMemo(() => new Map(modell.disziplinen.map((d) => [d.id, d] as const)), [modell.disziplinen]);

  /* Ränge unter allen 32 und in der gewählten Liga, je Lesart */
  const raengeAlle = useMemo(() => ({ staerke: teamRangTabelle(modell, modell.teams, "staerke"), punkte: teamRangTabelle(modell, modell.teams, "punkte") }), [modell]);
  const teamsInLiga = useMemo(() => modell.teams.filter(inLiga), [modell.teams, inLiga]);
  const raengeLiga = useMemo(() => teamRangTabelle(modell, teamsInLiga, mass), [modell, teamsInLiga, mass]);

  const selTeamId = selTeam && modell.teams.some((t) => t.teamId === selTeam) ? selTeam : (eigenesTeam && inLiga(eigenesTeam) ? eigenesTeam.teamId : (teamsInLiga[0]?.teamId ?? modell.teams[0]?.teamId ?? null));

  const titelVon = (k: string) => (k === "ges" ? "Gesamt" : (RANKS_ACHSEN as readonly string[]).includes(k) ? RANKS_ACHSEN_LABEL[k as RanksAchse] : (discById.get(k)?.name ?? k));
  const kopfFarbe = (k: string) => (k === "ges" ? "var(--bc-gold)" : (RANKS_ACHSEN as readonly string[]).includes(k) ? ACHSE_FARBE[k as RanksAchse] : ACHSE_FARBE[discById.get(k)?.achse ?? "soc"]);

  /* Bereich je Matrix-Spalte, Gruppen für den Gruppenkopf und Trenner zwischen den Bereichen */
  const spaltenBereich = (k: string): RanksAchse | "ges" => (k === "ges" ? "ges" : (RANKS_ACHSEN as readonly string[]).includes(k) ? (k as RanksAchse) : (discById.get(k)?.achse ?? "soc"));
  const grenze = (j: number) => j === 0 || j === 5 || (j > 5 && spaltenBereich(spalten[j]) !== spaltenBereich(spalten[j - 1]));
  const gruppen = useMemo(() => {
    const aus: Array<{ schluessel: string; achse: RanksAchse | null; n: number }> = [{ schluessel: "agg", achse: null, n: Math.min(5, spalten.length) }];
    for (const k of spalten.slice(5)) {
      const a = (discById.get(k)?.achse ?? "soc") as RanksAchse;
      const letzte = aus[aus.length - 1];
      if (letzte.achse === a) letzte.n += 1;
      else aus.push({ schluessel: `${a}-${aus.length}`, achse: a, n: 1 });
    }
    return aus;
  }, [spalten, discById]);

  /* ---------------- Kopf ---------------- */
  const eigeneLigaTeams = modell.teams.filter((t) => t.liga === eigeneLiga);
  const eigRangLiga = eigenesTeam ? vergibRaenge(eigeneLigaTeams.map((t) => ({ id: t.teamId, wert: teamWert(t, "ges", "staerke") }))).get(eigenesTeam.teamId) ?? null : null;
  const eigRangAlle = eigenesTeam ? (raengeAlle.staerke.ges.get(eigenesTeam.teamId) ?? null) : null;
  const eigPunkteLiga = eigenesTeam ? vergibRaenge(eigeneLigaTeams.map((t) => ({ id: t.teamId, wert: teamWert(t, "ges", "punkte") }))).get(eigenesTeam.teamId) ?? null : null;
  const eigPunkteAlle = eigenesTeam ? (raengeAlle.punkte.ges.get(eigenesTeam.teamId) ?? null) : null;
  const logoEigen = eigenesTeam?.logoSrc ?? null;
  const kulisse = einsatzlisteKulisseBild(sicht === "spieler" && dId ? dId : "i-spy");

  const hero = (
    <BcHero
      className="rk-hero"
      wappen={logoEigen}
      wappenAlt={eigenesTeam?.name ?? ""}
      dachzeile={
        <>
          Ranks · {gameState.season.id.replace("season-", "Saison ")} · {gebucht > 0 ? `nach Spieltag ${gebucht}` : "vor Spieltag 1"}
        </>
      }
      titel={eigenesTeam?.name ?? "Ranks"}
      kulisseUrl={kulisse}
      untertitel={
        <>
          {eigeneLiga ? <b>Liga {eigeneLiga}</b> : null}
          {eigeneLiga ? " · " : ""}Stärke, Ertrag und Spieler im Vergleich
        </>
      }
      mitte={
        <>
          <BcReiter aktiv={sicht === "teams"} onClick={() => setSicht("teams")} eyebrow="Stärke und Ertrag" titel="Teams" symbol={<BcIcon name="team" />} wert={modell.teams.length} wertNote="Teams" />
          <BcReiter aktiv={sicht === "spieler"} onClick={() => setSicht("spieler")} eyebrow="Eignung je Disziplin" titel="Spieler" symbol={<BcIcon name="team" />} wert={modell.spieler.length} wertNote="im Kader" />
        </>
      }
      rechts={
        eigenesTeam ? (
          <div className="rk-frist" data-testid="ranks-kaderstaerke">
            <em>Kaderstärke · beste 6</em>
            <strong className="t">
              Rang {eigRangLiga ?? "–"}{" "}
              <small>
                von {eigeneLigaTeams.length} · {eigRangAlle ?? "–"}/{modell.teams.length}
              </small>
            </strong>
            <small>
              {eigPunkteLiga != null ? `Tabelle: Platz ${eigPunkteLiga} · ${eigPunkteAlle}/${modell.teams.length} nach Punkten` : "Tabelle: noch keine Wertung"}
            </small>
          </div>
        ) : null
      }
    />
  );

  /* ---------------- Teams ---------------- */
  function sortTeamsKlick(k: string) {
    setSoT((alt) => (alt.k === k ? { k, d: (-alt.d as 1 | -1) } : { k, d: 1 }));
  }
  const teamsPanel = () => {
    const R = raengeLiga;
    const n = teamsInLiga.length;
    const liste =
      soT.k === "team"
        ? sortiere(teamsInLiga, (t) => t.name, soT.d, (t) => t.name)
        : sortiere(teamsInLiga, (t) => R[soT.k]?.get(t.teamId) ?? null, soT.d, (t) => t.name);
    const sortSchluessel = soT.k === "team" ? "ges" : soT.k;
    return (
      <section className="rk-pan" aria-label="Rangliste der Teams" data-testid="ranks-teams">
        <div className="rk-pk">
          <h2>Team-Ränge</h2>
          <div className="rk-seg" role="group" aria-label="Lesart">
            <button type="button" aria-pressed={mass === "staerke"} data-tip="Papierform: Mittel der besten sechs Spieler des Kaders, je Disziplin deren Eignung" onClick={() => setMass("staerke")}>
              Stärke
            </button>
            <button type="button" aria-pressed={mass === "punkte"} data-tip="Ertrag: Duellpunkte gesamt und je Bereich, je Disziplin die Ergebnispunkte (0 bis 10 je Begegnung)" onClick={() => setMass("punkte")}>
              Punkte
            </button>
          </div>
          <div className="rk-seg" role="group" aria-label="Anzeige">
            <button type="button" aria-pressed={zeige === "rang"} onClick={() => setZeige("rang")}>
              Rang
            </button>
            <button type="button" aria-pressed={zeige === "wert"} onClick={() => setZeige("wert")}>
              Wert
            </button>
          </div>
          <span className="rk-sp" />
          <LigaSeg liga={liga} setLiga={setLiga} eigeneLiga={eigeneLiga} onWechsel={() => setSelTeam(null)} />
        </div>
        <div className="rk-tl rk-mx">
          <div className="rk-thw">
            <div className="rk-gk" aria-hidden="true">
              <span className="leer2" />
              {gruppen.map((g) => (
                <span key={g.schluessel} className={`rk-gl ${bk(g.achse ?? "ges")}`} style={{ gridColumn: `span ${g.n}` }}>
                  {g.achse ? (
                    <>
                      <b>{RANKS_ACHSEN_LABEL[g.achse]}</b> {ACHSE_NAME[g.achse]}
                    </>
                  ) : (
                    <>Gesamt und Bereiche</>
                  )}
                </span>
              ))}
            </div>
            <div className="rk-th">
              <span className="m">#</span>
              <Kopf k="team" so={soT} onSo={sortTeamsKlick} className="tm">
                Team
              </Kopf>
              {spalten.map((k, j) => (
                <Kopf
                  key={k}
                  k={k}
                  so={soT}
                  onSo={sortTeamsKlick}
                  className={`m rk-hc ${bk(spaltenBereich(k))}${grenze(j) ? (j === 5 ? " gs gr" : " gs") : ""}${k === "ges" || (RANKS_ACHSEN as readonly string[]).includes(k) ? " ach" : ""}${j > 17 ? " tipl" : j < 3 ? " tipll" : ""}`}
                  kc={kopfFarbe(k)}
                  tip={`${titelVon(k)}${k !== "ges" && !(RANKS_ACHSEN as readonly string[]).includes(k) && mass === "punkte" ? ` · ${modell.gespielt[k] ?? 0} von 2 gespielt` : ""}`}
                >
                  {k === "ges" ? "Ges." : (RANKS_ACHSEN as readonly string[]).includes(k) ? RANKS_ACHSEN_LABEL[k as RanksAchse] : <DiszIcon id={k} name={titelVon(k)} />}
                </Kopf>
              ))}
            </div>
          </div>
          {liste.map((t) => {
            const fremd = t.teamId !== ownTeamId && modell.nebel && mass === "staerke";
            const rSort = R[sortSchluessel]?.get(t.teamId) ?? null;
            const rAlle = raengeAlle[mass][sortSchluessel]?.get(t.teamId) ?? null;
            return (
              <div
                key={t.teamId}
                className={`rk-tz${t.teamId === ownTeamId ? " wir" : ""}${t.teamId === selTeamId ? " sel" : ""}`}
                tabIndex={0}
                data-testid="ranks-team-zeile"
                onClick={() => setSelTeam(t.teamId)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelTeam(t.teamId))}
              >
                <span className="rg m t">
                  {rSort ?? "–"}
                  {liga !== "alle" && rAlle != null ? <small>{rAlle}/{modell.teams.length}</small> : null}
                </span>
                <TeamZelle team={t} />
                {spalten.map((k, j) => {
                  const r = R[k]?.get(t.teamId) ?? null;
                  const v = teamWert(t, k, mass);
                  const sp = sortSchluessel === k ? " spalt" : "";
                  const tipp = `${titelVon(k)}: ${v == null ? "noch nicht gespielt" : fremd ? `Stufe ${stufenText(v, 5)}` : mass === "staerke" ? z1(v) : `${v} ${k === "ges" || (RANKS_ACHSEN as readonly string[]).includes(k) ? "Punkte" : "Ergebnispunkte"}`}${raengeAlle[mass][k]?.get(t.teamId) != null ? ` · ${raengeAlle[mass][k].get(t.teamId)}/${modell.teams.length}` : ""}`;
                  const zc = `rk-zc ${bk(spaltenBereich(k))}${grenze(j) ? (j === 5 ? " gs gr" : " gs") : ""}`;
                  if (zeige === "rang") {
                    return (
                      <span key={k} className={zc}>
                        <span data-tip={tipp} className={`rk-zelle t ${zelleKlasse(r, n)}${sp}`}>
                          {r == null ? "–" : r}
                        </span>
                      </span>
                    );
                  }
                  return (
                    <span key={k} className={zc}>
                      {v == null ? (
                        <span className="rk-zelle leer">–</span>
                      ) : (
                        <span data-tip={tipp} className={`rk-zelle w t ${fremd ? "neb" : zelleKlasse(r, n)}${sp}`}>
                          {teamWertText(modell, t, k, mass)}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="rk-kf">
          <span>
            <b>{mass === "staerke" ? "Stärke" : "Punkte"}</b> · Rang in {ligaName}, klein unter allen {modell.teams.length}
          </span>
          <span>Gold = Rang 1 · grün = bestes Viertel · rot = letztes Viertel</span>
          <span className="rk-sp" />
          <span>
            {mass === "staerke"
              ? modell.nebel
                ? "Fremde Werte nur als 5er-Stufe, der Rang ist öffentlich"
                : "Nebel aus: alle Werte exakt"
              : modell.hatDuell
                ? "Spalte je Disziplin = Ergebnispunkte (Medaillenwertung)"
                : "Keine Duell-Wertung im Spielstand"}
          </span>
        </div>
      </section>
    );
  };

  const teamProfil = () => {
    const t = modell.teams.find((x) => x.teamId === selTeamId);
    if (!t) return <aside className="rk-pan" aria-label="Profil" />;
    const fremd = t.teamId !== ownTeamId && modell.nebel;
    const ligaTeams = modell.teams.filter((x) => x.liga === t.liga);
    const nL = ligaTeams.length || 1;
    const RS = teamRangTabelle(modell, ligaTeams, "staerke");
    const RP = teamRangTabelle(modell, ligaTeams, "punkte");
    const platz = RP.ges?.get(t.teamId) ?? null;
    const dl = modell.disziplinen
      .map((d) => ({ d, s: RS[d.id]?.get(t.teamId) ?? null, p: RP[d.id]?.get(t.teamId) ?? null }))
      .sort((a, b) => (a.s ?? 99) - (b.s ?? 99) || modell.disziplinen.indexOf(a.d) - modell.disziplinen.indexOf(b.d));
    const bereiche: Array<[string, string, string]> = [["ges", "Ges.", "var(--bc-gold)"], ...RANKS_ACHSEN.map((a): [string, string, string] => [a, RANKS_ACHSEN_LABEL[a], ACHSE_FARBE[a]])];
    return (
      <aside className="rk-pan" aria-label="Profil" data-testid="ranks-team-profil">
        <div className="rk-pk">
          <h2>Profil</h2>
          <span className="rk-sp" />
          {onOpenTeam ? (
            <button type="button" className="rk-btn" onClick={() => onOpenTeam(t.teamId)}>
              Teamprofil
            </button>
          ) : (
            <span className="rk-hin">Zeile anklicken</span>
          )}
        </div>
        <div className="rk-kx">
          <div className="kopf">
            {t.logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="gr" src={t.logoSrc} alt="" />
            ) : (
              <span className="gr" />
            )}
            <div>
              <h3>{t.name}</h3>
              <p>
                {t.liga ? `Liga ${t.liga} · ` : ""}
                {platz != null ? `Platz ${platz} · ${t.punkte.ges} Punkte · ` : ""}Kader {t.kaderGroesse}
                {t.mensch ? <> · <b className="gold">Mensch</b></> : null}
              </p>
            </div>
          </div>
          <h4>
            Papierform gegen Ertrag<span />
          </h4>
          <div className="rk-pap">
            <div className="pz kp">
              <span />
              <span>Stärke beste 6</span>
              <span className="m">Stärke</span>
              <span />
              <span className="m">Punkte</span>
              <span className="r">Ertrag</span>
            </div>
            {bereiche.map(([k, label, farbe]) => (
              <div className={`pz bz ${bk(k as RanksAchse | "ges")}`} key={k}>
                <span className="ax" style={{ color: farbe }}>
                  {label}
                </span>
                <span className="wert">
                  <span className="rk-bk">
                    <i style={{ width: `${Math.min(100, ((t.staerke[k] ?? 0) / 70) * 100)}%`, ["--bf" as string]: farbe }} />
                  </span>
                  <span className="t r leise" style={{ fontSize: ".9em" }}>
                    {fremd ? stufenText(t.staerke[k] ?? 0, 5) : z1(t.staerke[k] ?? 0)}
                  </span>
                </span>
                <RangChip rang={RS[k]?.get(t.teamId) ?? null} n={nL} />
                <span className="m stumm">→</span>
                <RangChip rang={RP[k]?.get(t.teamId) ?? null} n={nL} />
                <Diff s={RS[k]?.get(t.teamId) ?? null} p={RP[k]?.get(t.teamId) ?? null} />
              </div>
            ))}
          </div>
          <h4>
            Alle {modell.disziplinen.length} Disziplinen · Rang in {t.liga ? `Liga ${t.liga}` : "der Liga"}
            <span />
          </h4>
          <div className="rk-dli">
            <div className="dz kp">
              <span />
              <span>Disziplin</span>
              <span className="m">Stärke</span>
              <span className="m">Punkte</span>
              <span className="r">Ertrag</span>
            </div>
            {RANKS_ACHSEN.map((a) => {
              const teil = dl.filter((x) => x.d.achse === a);
              if (teil.length === 0) return null;
              return (
                <div className={`rk-dgr ${bk(a)}`} key={a}>
                  <div className="dgk" title={ACHSE_NAME[a]}>
                    <b>{RANKS_ACHSEN_LABEL[a]}</b>
                  </div>
                  <div className="dgb">
                  {teil.map(({ d, s, p }) => (
                    <div className="dz" key={d.id}>
                      <span>
                        <DiszIcon id={d.id} name={d.name} />
                      </span>
                      <b style={{ color: ACHSE_FARBE[d.achse] }}>{d.name}</b>
                      <RangChip rang={s} n={nL} />
                      <RangChip rang={p} n={nL} />
                      <Diff s={s} p={p} />
                    </div>
                  ))}
                  </div>
                </div>
              );
            })}
          </div>
          {fremd ? (
            <div className="rk-nebel">
              <BcIcon name="info" />
              <span>
                <b>Fremdes Team:</b> Ränge sind öffentlich, Werte nur als 5er-Stufe. Exakt erst bei vollem Scouting.
              </span>
            </div>
          ) : (
            <div className="rk-nebel fest">
              <BcIcon name="info" />
              <span>
                <b>Ertrag</b> = Stärke-Rang minus Punkte-Rang. Grün: das Team holt mehr, als die Papierform verspricht.
              </span>
            </div>
          )}
        </div>
      </aside>
    );
  };

  /* ---------------- Spieler ---------------- */
  function sortSpielerKlick(k: SpielerSortSchluessel) {
    setSoS((alt) => (alt.k === k ? { k, d: (-alt.d as 1 | -1) } : { k, d: k === "name" || k === "kl" || k === "ra" || k === "team" ? 1 : -1 }));
  }
  const spielerListe = useMemo(
    () => (sicht === "spieler" ? baueSpielerListe(modell, { disziplin: dId, liga, nurKader, klasseAchse: kf, sort: soS }) : { zeilen: [], anzahl: 0 }),
    [sicht, modell, dId, liga, nurKader, kf, soS],
  );
  const teamVon = useMemo(() => new Map(modell.teams.map((t) => [t.teamId, t] as const)), [modell.teams]);
  const selSpielerId = useMemo(() => {
    const zeilen = spielerListe.zeilen;
    if (selSpieler && zeilen.some((z) => z.id === selSpieler)) return selSpieler;
    return zeilen[0]?.id ?? null;
  }, [selSpieler, spielerListe.zeilen]);

  const spielerPanel = () => {
    const dn = dId ? (discById.get(dId)?.name ?? dId) : "Gesamt";
    const gezeigt = spielerListe.zeilen.slice(0, RANKS_SPIELER_LIMIT);
    const so = soS;
    const H = (s: SpielerSortSchluessel, label: ReactNode, cls = "", tip?: string) => (
      <Kopf k={s} so={so} onSo={(x) => sortSpielerKlick(x as SpielerSortSchluessel)} className={cls} tip={tip}>
        {label}
      </Kopf>
    );
    return (
      <section className="rk-pan" aria-label="Rangliste der Spieler" data-testid="ranks-spieler">
        <div className="rk-pk">
          <h2>Spieler-Ränge</h2>
          <span className="rk-bereich">{dn}</span>
          <span className="rk-sp" />
          <span className="rk-fchip" role="group" aria-label="Klassenfarbe">
            {RANKS_ACHSEN.map((a) => (
              <button key={a} type="button" style={{ "--kf": ACHSE_FARBE[a] } as React.CSSProperties} aria-pressed={kf === a} data-tip={`Nur Klassen der Farbe ${RANKS_ACHSEN_LABEL[a]}`} onClick={() => setKf(kf === a ? null : a)}>
                {RANKS_ACHSEN_LABEL[a]}
              </button>
            ))}
          </span>
          <div className="rk-seg">
            <button type="button" aria-pressed={!nurKader} onClick={() => setNurKader(false)}>
              Alle
            </button>
            <button type="button" aria-pressed={nurKader} onClick={() => setNurKader(true)}>
              Mein Kader
            </button>
          </div>
          <LigaSeg liga={liga} setLiga={setLiga} eigeneLiga={eigeneLiga} />
        </div>
        <div className="rk-dzw" role="group" aria-label="Disziplin">
          <button type="button" className="ges" aria-pressed={dId == null} style={{ "--kc": "var(--bc-gold)" } as React.CSSProperties} onClick={() => { setDId(null); setSoS({ k: "eig", d: -1 }); }}>
            Gesamt
          </button>
          {RANKS_ACHSEN.map((a) => (
            <div className={`rk-dzg ${bk(a)}`} key={a} role="group" aria-label={`${RANKS_ACHSEN_LABEL[a]} ${ACHSE_NAME[a]}`}>
              <span className="gl">
                <b>{RANKS_ACHSEN_LABEL[a]}</b> {ACHSE_NAME[a]}
              </span>
              <span className="gb">
                {modell.disziplinen
                  .map((d, j) => ({ d, j }))
                  .filter(({ d }) => d.achse === a)
                  .map(({ d, j }) => (
                    <button
                      key={d.id}
                      type="button"
                      className={j > 15 ? "tipl" : j < 3 ? "tipll" : ""}
                      aria-pressed={dId === d.id}
                      style={{ "--kc": ACHSE_FARBE[d.achse] } as React.CSSProperties}
                      data-tip={`${d.name}${d.spielerJeTeam ? ` · ${d.spielerJeTeam} Spieler je Team` : ""}`}
                      onClick={() => { setDId(d.id); setSoS({ k: "eig", d: -1 }); }}
                    >
                      <DiszIcon id={d.id} name={d.name} />
                    </button>
                  ))}
              </span>
            </div>
          ))}
        </div>
        <div className="rk-tl rk-sl">
          <div className="rk-th">
            {H("eig", <>#</>, "m tipll", `Rang nach Eignung ${dn} in ${ligaName}, klein unter allen ${modell.spieler.length}`)}
            {H("name", "Spieler")}
            {H("kl", "Klasse")}
            {H("ra", "Rasse")}
            {H("team", "Team")}
            {H("ges", "Ges.", "r")}
            {RANKS_ACHSEN.map((a) => (
              <Kopf key={a} k={a} so={so} onSo={(x) => sortSpielerKlick(x as SpielerSortSchluessel)} className={`r rk-ah ${bk(a)}`}>
                <span style={{ color: ACHSE_FARBE[a] }}>{RANKS_ACHSEN_LABEL[a]}</span>
              </Kopf>
            ))}
            {H("eig", <>Eignung {dn}</>)}
            {H("pp", "PP", "r tipl", "Player Points der Saison (öffentlich)")}
          </div>
          {gezeigt.map((z) => {
            const team = teamVon.get(z.teamId);
            const fog = !z.eig.exakt;
            return (
              <div
                key={z.id}
                className={`rk-tz${z.teamId === ownTeamId ? " wir" : ""}${z.id === selSpielerId ? " sel" : ""}`}
                tabIndex={0}
                data-testid="ranks-spieler-zeile"
                onClick={() => setSelSpieler(z.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelSpieler(z.id))}
              >
                <span className="rg m t">
                  {z.rang ?? "–"}
                  {liga !== "alle" && z.rangAlle != null ? <small>{z.rangAlle}/{modell.spieler.length}</small> : null}
                </span>
                <span className="rk-sz">
                  {z.portraitSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="po" src={z.portraitSrc} alt="" loading="lazy" />
                  ) : (
                    <span className="po">{z.initials}</span>
                  )}
                  <b>{z.name}</b>
                  {z.verletzt ? <span className="rk-marke" data-tip="Verletzt: nicht einsetzbar">verl.</span> : null}
                </span>
                <Klasse klasse={z.klasse} achse={z.klasseAchse} />
                <span className="leise" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {z.rasse}
                </span>
                <TeamZelle team={team} kurz />
                <span className="r z t">{z.ges.text}</span>
                {RANKS_ACHSEN.map((a) => (
                  <span key={a} className={`r t rk-aw ${bk(a)}${z.achsen[a].exakt ? "" : " stumm"}`} style={z.achsen[a].exakt ? undefined : { fontSize: ".86em" }}>
                    {z.achsen[a].text}
                  </span>
                ))}
                <span className="rk-eig">
                  <b className={`t${fog ? " leise" : ""}`} style={fog ? { fontSize: ".92em" } : undefined}>
                    {z.eig.text}
                  </b>
                  <span className="rk-bk" style={{ height: ".6em" }}>
                    {fog ? (
                      <i style={{ left: `${z.eig.von}%`, width: `${z.eig.bis - z.eig.von}%`, ["--bf" as string]: "repeating-linear-gradient(135deg,#9aa7ba 0 3px,#66738a 3px 6px)" }} />
                    ) : (
                      <i style={{ width: `${z.eig.von}%`, ["--bf" as string]: dId ? ACHSE_FARBE[discById.get(dId)?.achse ?? "soc"] : "var(--bc-gold)" }} />
                    )}
                  </span>
                </span>
                <span className="r t leise">{z.pp != null ? z1(z.pp) : "–"}</span>
              </div>
            );
          })}
        </div>
        <div className="rk-kf">
          <span>
            <b>{spielerListe.anzahl} Spieler</b> · {ligaName}
            {spielerListe.anzahl > RANKS_SPIELER_LIMIT ? ` · die ersten ${RANKS_SPIELER_LIMIT}` : ""}
          </span>
          <span className="rk-sp" />
          <span>{modell.nebel ? "Nebel: fremde Werte in festen Stufen, Sortierung nach Stufe, dann Name. Eigene exakt." : "Nebel aus (Einstellung): alle Werte exakt"}</span>
        </div>
      </section>
    );
  };

  const spielerProfil = () => {
    const p = selSpielerId ? baueSpielerProfil(modell, selSpielerId) : null;
    if (!p) return <aside className="rk-pan" aria-label="Profil" />;
    const raceSrc = getRaceIconSrc(p.rasse);
    const farbe = p.klasseAchse ? ACHSE_FARBE[p.klasseAchse] : "var(--bc-linie-2)";
    return (
      <aside className="rk-pan" aria-label="Profil" data-testid="ranks-spieler-profil">
        <div className="rk-pk">
          <h2>Profil</h2>
          <span className="rk-sp" />
          {onOpenPlayer ? (
            <button type="button" className="rk-btn" onClick={() => onOpenPlayer(p.id)}>
              Spielerprofil
            </button>
          ) : (
            <span className="rk-hin">Zeile anklicken</span>
          )}
        </div>
        <div className="rk-kx">
          <div className="kopf" style={{ "--kf": farbe } as React.CSSProperties}>
            {p.portraitSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="gr po-g" src={p.portraitSrc} alt="" />
            ) : (
              <span className="gr po-g">{p.initials}</span>
            )}
            <div>
              <h3>{p.name}</h3>
              <p style={{ display: "flex", gap: ".6em", alignItems: "center", flexWrap: "wrap" }}>
                <Klasse klasse={p.klasse} achse={p.klasseAchse} />
                <span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {raceSrc ? <img src={raceSrc} alt="" style={{ display: "inline-block", width: "1.2em", height: "1.2em", verticalAlign: "-.2em", objectFit: "contain" }} /> : null} {p.rasse}
                </span>
              </p>
              <p>
                <TeamZelle team={teamVon.get(p.teamId)} />
              </p>
            </div>
          </div>
          <h4>
            Bereiche · Rang in {p.liga ? `Liga ${p.liga}` : "der Liga"}
            <span />
          </h4>
          <div className="rk-pap">
            {p.bereiche.map((b) => {
              const farbeB = b.schluessel === "ges" ? "var(--bc-gold)" : ACHSE_FARBE[b.schluessel];
              return (
                <div className={`pz bz ${bk(b.schluessel as RanksAchse | "ges")}`} key={b.schluessel} style={{ gridTemplateColumns: "3.2em minmax(0,1fr) 4.2em 3.6em" }}>
                  <span className="ax" style={{ color: farbeB }}>{b.schluessel === "ges" ? "Ges." : RANKS_ACHSEN_LABEL[b.schluessel]}</span>
                  <span className="rk-bk">
                    {b.sicht.exakt ? <i style={{ width: `${b.sicht.von}%`, ["--bf" as string]: farbeB }} /> : <i style={{ left: `${b.sicht.von}%`, width: `${b.sicht.bis - b.sicht.von}%`, ["--bf" as string]: "#9aa7ba" }} />}
                  </span>
                  <span className="r t">
                    <b>{b.sicht.text}</b>
                  </span>
                  <span className="rk-rgc t">{b.rang ?? "–"}</span>
                </div>
              );
            })}
          </div>
          <h4>
            Disziplinen nach Eignung<span />
          </h4>
          <div className="rk-dli">
            <div className="dz kp" style={{ gridTemplateColumns: "1.6em minmax(0,1fr) 4.2em 3.4em 3em" }}>
              <span />
              <span>Disziplin</span>
              <span className="r">Eignung</span>
              <span className="m">Rang</span>
              <span className="r">PP</span>
            </div>
            {p.disziplinen.map((d) => (
              <div className={`dz mk ${bk(d.achse)}`} key={d.id} style={{ gridTemplateColumns: "1.6em minmax(0,1fr) 4.2em 3.4em 3em" }}>
                <span>
                  <DiszIcon id={d.id} name={d.name} />
                </span>
                <b style={{ color: ACHSE_FARBE[d.achse] }}>{d.name}</b>
                <span className="r t">{d.sicht.text}</span>
                <span className="rk-rgc t">{d.rang ?? "–"}</span>
                <span className="r t leise">{d.pp != null ? z1(d.pp) : "–"}</span>
              </div>
            ))}
          </div>
          {p.fremd ? (
            <div className="rk-nebel">
              <BcIcon name="info" />
              <span>
                <b>Nicht voll gescoutet:</b> feste Stufen. Sie verraten nicht, wo im Bereich der Wert liegt. Der Rang ist der Rang der Stufe. PP sind öffentlich.
              </span>
            </div>
          ) : (
            <div className="rk-nebel fest">
              <BcIcon name="info" />
              <span>
                <b>Bekannter Spieler:</b> alle Werte exakt. Rang gegen die Stufen der fremden Spieler.
              </span>
            </div>
          )}
        </div>
      </aside>
    );
  };

  if (modell.teams.length === 0) return <div className="bc rk" data-testid="ranks-modern">{hero}</div>;

  return (
    <div className="bc rk" data-testid="ranks-modern">
      {hero}
      <div className="rk-work">
        {sicht === "teams" ? teamsPanel() : spielerPanel()}
        {sicht === "teams" ? teamProfil() : spielerProfil()}
      </div>
    </div>
  );
}

function LigaSeg({ liga, setLiga, eigeneLiga, onWechsel }: { liga: RanksLiga; setLiga: (l: RanksLiga) => void; eigeneLiga: 1 | 2 | null; onWechsel?: () => void }) {
  if (eigeneLiga == null) return null;
  const wechsel = (l: RanksLiga) => {
    setLiga(l);
    onWechsel?.();
  };
  return (
    <div className="rk-seg" role="group" aria-label="Liga">
      <button type="button" aria-pressed={liga === "eigene"} onClick={() => wechsel("eigene")}>
        Liga {eigeneLiga}
      </button>
      <button type="button" aria-pressed={liga === "andere"} onClick={() => wechsel("andere")}>
        Liga {3 - eigeneLiga}
      </button>
      <button type="button" aria-pressed={liga === "alle"} onClick={() => wechsel("alle")}>
        Alle 32
      </button>
    </div>
  );
}
