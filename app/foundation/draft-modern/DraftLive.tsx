"use client";

/**
 * DRAFT, ANSICHT LIVE (18.11.). Vorlage: public/mockups/draft-modern-18-11.html (`#s-live`).
 * Teile: Kopfleiste (Runde, Kette, Sitze, Tempo), Am Zug, Danach am Zug, Draft-Brett, Mein Draft, Live-Ticker.
 * Gezeigt = gebucht: Picks, Top 3, Preise und Grenzen kommen aus `/api/draft`; das Brett aus dem Markt-Feed mit
 * Scouting-Nebel (`baueSpielerSicht`). Sortiert und gefiltert wird nur über die Sicht.
 */
import { useMemo, useState } from "react";

import type { LigaDraftPickGrund } from "@/lib/draft/liga-draft-ki";
import type { LigaDraftSpielerKarte, LigaDraftZugAnsicht } from "@/lib/draft/liga-draft-ansicht";
import { MARKT_ACHSEN, sortiereNachSicht, type MarktAchse } from "@/lib/market/transfermarkt-sicht";
import { officialDisciplineWeightLabels, officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";
import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";
import { DISZIPLIN_KURZ } from "@/app/foundation/transfermarkt-modern/tm-format";
import type { DraftTempo, DraftZeig } from "./draft-daten";
import type { DraftKontext, DraftZeile } from "./draft-kontext";
import { auslassenSperrGrund, betragC, de, fertigGrundText, fertigSperrGrund, GRUND_TAG, GRUND_TEXT, pickHerkunft, sitzBuchstabe, sitzKlasse, sitzName } from "./draft-format";

const ACHSEN_LABEL: Record<MarktAchse, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };
const DISZIPLINEN = [...officialDisciplineWeightOrder];
const ZEILEN_JE_BLATT = 13;

export type DraftAktionen = {
  pick: (playerId: string, name: string) => Promise<boolean>;
  startWahl: (wahl: "spielen" | "selbst") => Promise<boolean>;
  kiHintergrund: (leise?: boolean) => Promise<boolean>;
  wunsch: (playerId: string, an: boolean, eintrag: Record<string, unknown>) => Promise<boolean>;
  auslassen: () => Promise<void>;
  fertig: () => Promise<boolean>;
  autoPick: (an: boolean, zielTeamId?: string) => Promise<void>;
};

/**
 * „Pick auslassen“ und „Ich bin fertig“: gesperrt wird STRIKT nach `darfAuslassen`/`darfFertig` der Sicht (die Route
 * rechnet beides; die Seite rechnet nichts nach). Der Tooltip sagt, warum ein Knopf gesperrt ist.
 */
export function AuslassenFertig({
  mein,
  minKader,
  aktionen,
}: {
  mein: NonNullable<DraftKontext["ansicht"]["mein"]>;
  minKader: number;
  aktionen: Pick<DraftAktionen, "auslassen" | "fertig">;
}) {
  if (mein.art !== "mensch" || mein.status === "fertig") return null;
  const auslassenGrund = auslassenSperrGrund(mein);
  const fertigGrund = fertigSperrGrund(mein, minKader);
  const stil = (an: boolean) => ({ color: an ? "var(--gold)" : "var(--stumm)", fontWeight: 600, opacity: an ? 1 : 0.55, cursor: an ? "pointer" : "not-allowed" });
  return (
    <div className="hin" data-testid="draft-auslassen-fertig">
      <button type="button" disabled={!mein.darfFertig} title={fertigGrund ?? "Nimmt dich aus der Reihenfolge — du pickst nicht mehr."} onClick={() => void aktionen.fertig()} style={stil(mein.darfFertig)} data-testid="draft-fertig">Ich bin fertig</button>
      {" · "}
      <button type="button" disabled={!mein.darfAuslassen} title={auslassenGrund ?? "Dieser Pick entfällt, in der nächsten Runde bist du wieder dran."} onClick={() => void aktionen.auslassen()} style={stil(mein.darfAuslassen)} data-testid="draft-auslassen">Pick auslassen</button>
    </div>
  );
}

function Wappen({ url, kuerzel }: { url: string | null; kuerzel: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={kuerzel} /> : <span className="drf-leer">{kuerzel}</span>;
}

function kartenInfo(k: DraftKontext, playerId: string): LigaDraftSpielerKarte | null {
  return k.ansicht.spieler[playerId] ?? null;
}

function spielerName(k: DraftKontext, playerId: string): string {
  return k.zeilenById.get(playerId)?.item.name ?? kartenInfo(k, playerId)?.name ?? "—";
}

function eignungText(z: DraftZeile | undefined, disziplin: string): string {
  const wert = z?.sicht.disziplinen[disziplin];
  return wert ? wert.text : "?";
}

function scouteKlasse(z: DraftZeile): string {
  return z.sicht.stufe >= 5 ? "s2" : z.sicht.stufe >= 1 ? "s1" : "s0";
}

// ---------------------------------------------------------------------------------------------------------------------
// Kopfleiste
// ---------------------------------------------------------------------------------------------------------------------

export function Kopfleiste({
  k,
  tempo,
  setTempo,
  setVor,
  onSkip,
  onVor,
  zeig,
}: {
  k: DraftKontext;
  tempo: DraftTempo;
  setTempo: (t: DraftTempo) => void;
  setVor: (v: boolean) => void;
  onSkip: () => void;
  /** KI-Picks bis zum nächsten menschlichen Zug in einem Rutsch fahren (19.11.). */
  onVor: () => void;
  zeig: DraftZeig | null;
}) {
  const a = k.ansicht;
  const teamZeile = new Map(a.teams.map((t) => [t.teamId, t]));
  const vorbei = a.status === "fertig";
  const dran = zeig ? zeig.zug.teamId : a.amZug?.teamId ?? null;
  const n = a.mein?.picksBisZug ?? null;
  const rest = a.status === "nachzug" || (a.mein?.status === "nachzug");
  const wann = vorbei ? "Fertig" : rest ? "Du pickst" : a.mein?.amZug ? "Du bist dran" : n != null && n > 0 ? `in ${n} Picks` : a.mein ? "nicht in der Reihenfolge" : "";
  const sitze = a.teams.filter((t) => t.art === "mensch");
  const zustand = (t: (typeof sitze)[number]) =>
    t.teamId === a.mein?.teamId ? "du" : t.status === "nachzug" ? "pickt später" : t.autoPick ? "Auto-Draft" : t.status === "fertig" ? (t.fertigGrund === "abgebrochen" ? "abgebrochen" : "fertig") : "online";
  return (
    <>
      <div className="rd">
        <b>{vorbei ? "Draft beendet" : rest ? "KI-Draft läuft aus" : `Runde ${a.runde} von ${a.regeln.maxRunden}`}</b>
        <small>{vorbei ? `${a.picks} Picks` : `Pick ${a.picks + 1} · schwächstes Team zuerst`}</small>
      </div>
      <div className="kette" data-testid="draft-kette">
        {a.kette.map((c) => {
          const t = teamZeile.get(c.teamId);
          const mensch = t?.art === "mensch";
          const sk = mensch ? sitzKlasse(t?.ownerId) : "";
          const ich = c.teamId === a.mein?.teamId;
          const klasse = [
            mensch ? sk : "",
            ich ? "ich" : "",
            t?.status === "fertig" ? "fertig" : c.erledigt && c.teamId !== dran ? "durch" : "",
            c.teamId === dran && !vorbei ? "dran" : "",
            k.schau === c.teamId ? "schau" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div className="kg" key={c.teamId}>
              {mensch ? <em className={`sitz ${sk}`}>{ich ? "Du" : sitzName(t?.ownerId)}</em> : null}
              <button
                type="button"
                className={klasse}
                title={`${c.platz}. ${k.teamName(c.teamId)} · Kader ${t?.kader ?? 0}${t?.status === "fertig" ? ` · ${fertigGrundText(t.fertigGrund) ?? "fertig"}` : ""}`}
                onClick={() => k.setSchau(k.schau === c.teamId || mensch ? null : c.teamId)}
              >
                <Wappen url={k.wappen(c.teamId)} kuerzel={k.teamKuerzel(c.teamId)} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="dst">
        <div className="sitze">
          {sitze.map((t) => (
            <span key={t.teamId} className={`${sitzKlasse(t.ownerId)}${t.teamId === dran && !t.autoPick ? " dran" : ""}`}>
              <i />
              <b>{t.teamId === a.mein?.teamId ? "Du" : sitzName(t.ownerId)}</b> {zustand(t)}
            </span>
          ))}
        </div>
        {!vorbei && a.mein?.art === "mensch" ? (
          <>
            <div className="seg" title="Tempo der KI-Picks. Für deinen Pick gibt es kein Zeitlimit.">
              <button type="button" className={tempo === 0 ? "an" : ""} onClick={() => { setVor(false); setTempo(0); }} title="Pause" aria-label="Pause">❚❚</button>
              <button type="button" className={tempo === 1 ? "an" : ""} onClick={() => setTempo(1)} data-testid="draft-tempo-1">1×</button>
              <button type="button" className={tempo === 3 ? "an" : ""} onClick={() => setTempo(3)} data-testid="draft-tempo-3">3×</button>
            </div>
            {a.status === "laeuft" && !a.wartetAufStart && !a.mein.amZug && a.amZug?.automatisch ? (
              <button type="button" className="knopf haupt" onClick={onVor} disabled={k.hintergrund} title="Die KI-Picks laufen in einem Rutsch bis zum nächsten menschlichen Zug. Sie bleiben im Ticker und unter „Alle Picks“ sichtbar." data-testid="draft-vor-zu-meinem-pick">
                {k.hintergrund ? "KI pickt …" : "Vor zu meinem Pick"}
              </button>
            ) : null}
            {a.mein.darfUeberspringen ? (
              <button type="button" className="knopf" onClick={onSkip} data-testid="draft-ueberspringen">Überspringen</button>
            ) : null}
          </>
        ) : null}
        <div className={`wann${a.mein?.amZug || rest ? " jetzt" : ""}`}>
          <b className="t">{wann}</b>
          <small>{vorbei ? "ohne Reihenfolge" : dran ? `am Zug: ${k.teamKuerzel(dran)}` : ""}</small>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Am Zug
// ---------------------------------------------------------------------------------------------------------------------

function TeamKopf({ k, teamId, extra }: { k: DraftKontext; teamId: string; extra?: React.ReactNode }) {
  const t = k.ansicht.teams.find((x) => x.teamId === teamId);
  const sk = t?.art === "mensch" ? sitzKlasse(t.ownerId) : "";
  return (
    <div className={`zt ${sk}${teamId === k.ansicht.mein?.teamId ? " ich" : ""}`}>
      <span className="lg"><Wappen url={k.wappen(teamId)} kuerzel={k.teamKuerzel(teamId)} /></span>
      <div className="mi">
        <h3>{k.teamName(teamId)}</h3>
        <small>{t?.art === "mensch" ? `${sitzName(t.ownerId)} · pickt selbst` : "KI-Team"} · Kader {t?.kader ?? 0} · {t?.picks ?? 0} Picks</small>
      </div>
      <div className="tp">Kasse<br /><b className="t">{betragC(t?.kasse ?? 0)}</b>{extra}</div>
    </div>
  );
}

function FavKarte({
  k,
  playerId,
  rang,
  grund,
  zustand,
  pickNr,
  konflikt,
  aktiv,
  onClick,
}: {
  k: DraftKontext;
  playerId: string;
  rang: number;
  grund?: LigaDraftPickGrund;
  zustand?: "pick" | "raus";
  pickNr?: number | null;
  konflikt?: boolean;
  aktiv?: boolean;
  onClick?: () => void;
}) {
  const z = k.zeilenById.get(playerId);
  const info = kartenInfo(k, playerId);
  const bild = k.portrait(playerId);
  return (
    <button
      type="button"
      className={`fk e${rang}${zustand ? ` ${zustand}` : ""}${konflikt ? " konf" : ""}${aktiv ? " an" : ""}`}
      data-st={zustand === "pick" && pickNr ? `PICK ${pickNr}` : undefined}
      onClick={onClick}
      data-testid="draft-top3-karte"
      data-player-id={playerId}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {bild ? <img className="bg" src={bild} alt="" /> : null}
      <span className="rk t">{rang}.</span>
      {grund ? (
        <span className={`tag gd ${GRUND_TAG[grund.art] ?? ""}`}>
          {grund.art === "bedarf" ? `Bedarf ${DISZIPLIN_KURZ[grund.disziplinId] ?? ""}`.trim() : GRUND_TEXT[grund.art]}
        </span>
      ) : null}
      <span className="un">
        <b className="drf-pl" role="link" title="Spielerprofil öffnen" onClick={(e) => { e.stopPropagation(); k.profil(playerId); }} data-testid="draft-profil-link">{z?.item.name ?? info?.name ?? "—"}</b>
        <small>{z?.item.className ?? info?.className ?? ""} · {z?.item.race ?? info?.race ?? ""}</small>
        <span className="zw">
          <span>{DISZIPLIN_KURZ[k.disziplin] ?? ""} <b className={`t${z && z.sicht.stufe < 5 ? " nb" : ""}`}>{eignungText(z, k.disziplin)}</b></span>
          <strong className="t">{de(info?.marktwert ?? z?.item.marketValue ?? 0)} C</strong>
        </span>
      </span>
    </button>
  );
}

export function AmZug({ k, zeig, onVormerken }: { k: DraftKontext; zeig: DraftZeig | null; onVormerken: (id: string) => void }) {
  const a = k.ansicht;
  const mein = a.mein;
  // Vorschau eines anderen Teams aus „Danach am Zug“.
  const vorschau = k.schau ? a.naechste.find((z) => z.teamId === k.schau) ?? null : null;
  const zug: LigaDraftZugAnsicht | null = zeig && !vorschau ? zeig.zug : vorschau ?? a.amZug;

  if (a.status === "fertig") {
    return (
      <section className="pan" id="l-zug">
        <div className="pk"><h2>Draft beendet</h2></div>
      </section>
    );
  }
  if (!zug) {
    return (
      <section className="pan" id="l-zug">
        <div className="pk"><h2>Am Zug</h2></div>
        <div className="wart"><p>Gerade ist kein Team am Zug.</p></div>
      </section>
    );
  }
  const teamArt = a.teams.find((t) => t.teamId === zug.teamId);
  const meinZug = mein?.teamId === zug.teamId;

  // Mensch am Zug (nicht ich): der Draft wartet, keine Uhr.
  if (zug.art === "mensch" && !zug.automatisch && !meinZug && !zeig) {
    const sk = sitzKlasse(zug.ownerId);
    return (
      <section className="pan" id="l-zug" data-testid="draft-wartet">
        <div className="pk">
          <h2>{vorschau ? "Vorschau" : "Am Zug"}</h2>
          <span className="sp" />
          <span className="tag go">Draft wartet</span>
        </div>
        <TeamKopf k={k} teamId={zug.teamId} />
        <div className={`wart ${sk}`}>
          <span className="rund">{sitzBuchstabe(zug.ownerId)}</span>
          <h3>{sitzName(zug.ownerId)} wählt</h3>
          <p>
            Der Draft <b>wartet</b>, bis {sitzName(zug.ownerId)} gepickt hat. Es gibt <b>keine Uhr</b>. Du kannst solange vormerken, filtern und
            beobachten.
          </p>
        </div>
      </section>
    );
  }

  // Eigener Zug: der Vorschlag des eigenen GM.
  let top: string[] = zug.top3 ?? [];
  let gruende = zug.top3Gruende ?? [];
  if (meinZug && !zeig) {
    top = mein?.vorschlag ?? [];
    gruende = [];
  }
  const gewaehlt = zeig && !vorschau ? zeig.eintrag.playerId : null;
  const konflikte = new Set<string>();
  if (mein && !meinZug) {
    for (const id of mein.vorschlag.slice(0, 1)) if (top.includes(id)) konflikte.add(id);
  }
  return (
    <section className="pan" id="l-zug" data-testid="draft-am-zug">
      <div className="pk">
        <h2>{vorschau ? "Vorschau" : "Am Zug"}</h2>
        <span className="sp" />
        {vorschau ? (
          <button type="button" onClick={() => k.setSchau(null)}>zurück zu „Am Zug“</button>
        ) : meinZug ? (
          <span className="tag go">Du bist dran · kein Zeitlimit</span>
        ) : zeig ? (
          <span className="tag g">Pick {zeig.eintrag.pickNr ?? ""}</span>
        ) : teamArt?.autoPick ? (
          <span className="tag go">Auto-Draft</span>
        ) : (
          <span className="tag go">KI überlegt</span>
        )}
      </div>
      <TeamKopf k={k} teamId={zug.teamId} />
      <div className="f3k">
        <span className="gk">{meinZug ? "Vorschlag deines GM" : `Top 3 für ${vorschau ? "den nächsten" : "diesen"} Pick`}</span>
        <small>{meinZug ? "Klick merkt vor" : "Stand jetzt · ändert sich mit jedem Pick"}</small>
      </div>
      {top.length ? (
        <div className="fav3">
          {top.slice(0, 3).map((id, i) => (
            <FavKarte
              key={id}
              k={k}
              playerId={id}
              rang={i + 1}
              grund={gruende[i]}
              zustand={gewaehlt ? (gewaehlt === id ? "pick" : "raus") : undefined}
              pickNr={zeig?.eintrag.pickNr}
              konflikt={konflikte.has(id)}
              aktiv={meinZug && k.wahl === id}
              onClick={meinZug ? () => onVormerken(id) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="wart"><p>Dieses Team pickt nicht mehr.</p></div>
      )}
      <div className="zfuss">
        {meinZug
          ? "Dein GM schlägt vor, was er nehmen würde."
          : zug.absicht === "aufhoeren"
            ? "Dieses Team würde jetzt aufhören — sein Kader steht."
            : "Die KI nimmt Rang 1."}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Danach am Zug
// ---------------------------------------------------------------------------------------------------------------------

export function DanachAmZug({ k }: { k: DraftKontext }) {
  const a = k.ansicht;
  const folge = a.naechste.slice(1, 7);
  return (
    <section className="pan" id="l-next" data-testid="draft-danach">
      <div className="pk"><h2>Danach am Zug</h2><span className="sp" /><span className="gk">ihre Top 3 · Stand jetzt</span></div>
      <div className="nxl">
        {folge.length === 0 ? <div className="wart"><p>Keine weiteren Züge in Sicht.</p></div> : null}
        {folge.map((z, i) => {
          const sk = z.art === "mensch" ? sitzKlasse(z.ownerId) : "";
          const ich = z.teamId === a.mein?.teamId;
          const nr = a.picks + 2 + i;
          if (z.art === "mensch" && !z.automatisch) {
            const vorgemerkt = ich && k.wahl ? spielerName(k, k.wahl) : null;
            return (
              <div key={`${z.teamId}-${i}`} className={`nx ${ich ? "ich" : sk}`}>
                <span className="nr t">#{nr}</span>
                <span className="lg"><Wappen url={k.wappen(z.teamId)} kuerzel={k.teamKuerzel(z.teamId)} /></span>
                <span className="tx">
                  <b>{ich ? `Du · ${k.teamName(z.teamId)}` : `${sitzName(z.ownerId)} · ${k.teamName(z.teamId)}`}</b>
                  <small>{ich ? (vorgemerkt ? <>vorgemerkt: <u>{vorgemerkt}</u></> : "noch nichts vorgemerkt") : "pickt selbst · der Draft wartet"}</small>
                </span>
                <span className="tag">Mensch</span>
              </div>
            );
          }
          const top = z.top3 ?? [];
          return (
            <button type="button" key={`${z.teamId}-${i}`} className={`nx${k.schau === z.teamId ? " an" : ""}`} onClick={() => k.setSchau(k.schau === z.teamId ? null : z.teamId)}>
              <span className="nr t">#{nr}</span>
              <span className="lg"><Wappen url={k.wappen(z.teamId)} kuerzel={k.teamKuerzel(z.teamId)} /></span>
              <span className="tx">
                <b>{k.teamName(z.teamId)}</b>
                <small>
                  {z.absicht === "aufhoeren"
                    ? "hört auf"
                    : top.map((id, j) => {
                        const wunsch = k.wunsch.has(id) || k.wahl === id;
                        return (
                          <span key={id}>
                            {j ? " · " : ""}
                            {j + 1}. {wunsch ? <u>★ {spielerName(k, id)}</u> : spielerName(k, id)}
                          </span>
                        );
                      })}
                </small>
              </span>
              <span className="pp">
                {top.map((id) => {
                  const bild = k.portrait(id);
                  // eslint-disable-next-line @next/next/no-img-element
                  return bild ? <img key={id} className={k.wunsch.has(id) || k.wahl === id ? "k" : ""} src={bild} title={spielerName(k, id)} alt="" /> : null;
                })}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Live-Ticker
// ---------------------------------------------------------------------------------------------------------------------

export function LiveTicker({ k, zeig }: { k: DraftKontext; zeig: DraftZeig | null }) {
  const picks = k.ansicht.verlauf.filter((e) => e.art === "pick").slice(-7).reverse();
  return (
    <div className="ltick" id="l-tick" data-testid="draft-ticker">
      <span className="lab">Live-Ticker</span>
      {picks.map((e, i) => {
        const t = k.ansicht.teams.find((x) => x.teamId === e.teamId);
        const sk = t?.art === "mensch" ? sitzKlasse(t.ownerId) : "";
        return (
          <span key={e.nr} className={`tc ${sk}${i === 0 && zeig ? " neu" : ""}`}>
            <span className="nr t">#{e.pickNr}</span>
            <Wappen url={k.wappen(e.teamId)} kuerzel={k.teamKuerzel(e.teamId)} />
            <b className="drf-pl" role="link" title="Spielerprofil öffnen" onClick={() => { if (e.playerId) k.profil(e.playerId); }}>{e.playerId ? spielerName(k, e.playerId) : "—"}</b>
            <small>{k.teamKuerzel(e.teamId)}</small>
            {e.top3 && e.playerId && e.top3.indexOf(e.playerId) > 0 ? <small title="Die KI wählt unter ihren Top 3 (gewichtet nach Bewertungsabstand)">nahm Platz {e.top3.indexOf(e.playerId) + 1}</small> : null}
            <em className="t">{de(e.abloese ?? 0)}</em>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Draft-Brett
// ---------------------------------------------------------------------------------------------------------------------

type SortKey = "eignung" | "abloese" | "guenstig" | "gefragt";

export function DraftBrett({ k, aktionen }: { k: DraftKontext; aktionen: DraftAktionen }) {
  const a = k.ansicht;
  const mein = a.mein;
  const [tab, setTab] = useState<"frei" | "picks">("frei");
  const [suche, setSuche] = useState("");
  const [sort, setSort] = useState<SortKey>("eignung");
  const [nurLeistbar, setNurLeistbar] = useState(false);
  const [nurWunsch, setNurWunsch] = useState(false);
  const [nurScouting, setNurScouting] = useState(false);
  const [achse, setAchse] = useState<MarktAchse | null>(null);
  const [blatt, setBlatt] = useState(0);
  const dran = Boolean(mein?.darfPicken);
  const maxAbloese = mein?.maxAbloese ?? Number.POSITIVE_INFINITY;
  const zuTeuer = (z: DraftZeile) => (z.item.marketValue ?? 0) > maxAbloese + 1e-9;

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase();
    const liste = k.zeilen.filter((z) => {
      if (s && !z.item.name.toLowerCase().includes(s) && !z.item.className.toLowerCase().includes(s)) return false;
      if (nurLeistbar && mein && (z.item.marketValue ?? 0) > maxAbloese + 1e-9) return false;
      if (nurWunsch && !k.wunsch.has(z.item.playerId)) return false;
      if (nurScouting && z.sicht.stufe < 1) return false;
      if (achse) {
        // Nur sichtbare, beobachtete/gescoutete Noten zählen; Verdecktes bleibt draußen.
        if (!z.sicht.achsen[achse] || z.sicht.achsen[achse].sortWert == null || !z.sicht.achsen[achse].exakt) return false;
        const werte = MARKT_ACHSEN.map((x) => z.sicht.achsen[x].sortWert);
        if (werte.some((w) => w == null)) return false;
        if ((werte as number[]).indexOf(Math.max(...(werte as number[]))) !== MARKT_ACHSEN.indexOf(achse)) return false;
      }
      return true;
    });
    const schluessel = (z: DraftZeile): number | null => {
      switch (sort) {
        case "eignung":
          return z.sicht.disziplinen[k.disziplin]?.schaetzung ?? null;
        case "abloese":
          return z.item.marketValue ?? 0;
        case "guenstig":
          return z.item.marketValue ?? 0;
        case "gefragt":
          return (a.gefragt[z.item.playerId] ?? 0) * 1000 + (z.item.marketValue ?? 0);
      }
    };
    return sortiereNachSicht(liste, schluessel, sort === "guenstig" ? 1 : -1);
  }, [k.zeilen, k.wunsch, k.disziplin, suche, nurLeistbar, nurWunsch, nurScouting, achse, sort, mein, maxAbloese, a.gefragt]);

  const seiten = Math.max(1, Math.ceil(gefiltert.length / ZEILEN_JE_BLATT));
  const seite = Math.min(blatt, seiten - 1);
  const sichtbar = gefiltert.slice(seite * ZEILEN_JE_BLATT, seite * ZEILEN_JE_BLATT + ZEILEN_JE_BLATT);

  const picks = useMemo(() => a.verlauf.filter((e) => e.art === "pick").slice().reverse(), [a.verlauf]);
  const seitenPicks = Math.max(1, Math.ceil(picks.length / 14));
  const seiteP = Math.min(blatt, seitenPicks - 1);

  const kopf = (
    <div className="pk">
      <h2>Draft-Brett</h2>
      <div className="tabs">
        <button type="button" className={tab === "frei" ? "an" : ""} onClick={() => { setTab("frei"); setBlatt(0); }}>Freie Spieler · {k.zeilen.length}</button>
        <button type="button" className={tab === "picks" ? "an" : ""} onClick={() => { setTab("picks"); setBlatt(0); }}>Alle Picks · {a.picks}</button>
      </div>
      <span className="sp" />
      <span className={`schalter${k.nebelAus ? "" : " an"}`} title="Scouting-Nebel: unbekannt 10er-Stufe, beobachtet 5er-Stufe, gescoutet exakt. Die Ablöse ist immer exakt. Eine Einstellung des Spielstands.">
        Scouting-Nebel<i />{k.nebelAus ? "aus" : "an"}
      </span>
    </div>
  );

  if (tab === "picks") {
    const zeilen = picks.slice(seiteP * 14, seiteP * 14 + 14);
    return (
      <section className="pan db" id="l-brett" data-testid="draft-brett">
        {kopf}
        <div className="mt" style={{ ["--zeilen" as string]: 14 }}>
          <div className="mz pz kopf"><span>Pick</span><span>Runde</span><span /><span>Team</span><span /><span>Spieler</span><span /><span className="re">Ablöse</span><span /></div>
          {zeilen.map((e) => (
            <div key={e.nr} className={`mz pz${e.teamId === mein?.teamId ? " an" : ""}`}>
              <b className="t" style={{ color: "var(--stumm)" }}>#{e.pickNr}</b>
              <span className="t">{e.quelle === "nachzug" ? "N" : e.runde}</span>
              <span className="lg"><Wappen url={k.wappen(e.teamId)} kuerzel={k.teamKuerzel(e.teamId)} /></span>
              <span className="nm"><b>{k.teamName(e.teamId)}</b><small>{pickHerkunft(e)}</small></span>
              <span />
              <span className="nm"><b>{e.playerId ? spielerName(k, e.playerId) : "—"}</b><small>{e.playerId ? `${kartenInfo(k, e.playerId)?.className ?? ""} · ${kartenInfo(k, e.playerId)?.race ?? ""}` : ""}</small></span>
              <span />
              <span className="re"><b className="t">{de(e.abloese ?? 0)}</b></span>
              <span />
            </div>
          ))}
        </div>
        <div className="mfuss">
          <span>Runde „N“ = Nachzug nach dem Überspringen.</span>
          <span className="sp" />
          <span className="blat"><button type="button" onClick={() => setBlatt(Math.max(0, seiteP - 1))}>‹</button> Blatt {seiteP + 1} / {seitenPicks} <button type="button" onClick={() => setBlatt(Math.min(seitenPicks - 1, seiteP + 1))}>›</button></span>
        </div>
      </section>
    );
  }

  const sk = (key: SortKey, text: string, cls = "") => (
    <button type="button" className={`${cls}${sort === key ? " so" : ""}`} onClick={() => { setSort(key); setBlatt(0); }}>
      {text}{sort === key ? (key === "guenstig" ? " ▴" : " ▾") : ""}
    </button>
  );
  return (
    <section className="pan db" id="l-brett" data-testid="draft-brett">
      {kopf}
      <div className="fl">
        <input value={suche} placeholder="Name oder Klasse" style={{ width: "calc(10 * var(--u))" }} onChange={(e) => { setSuche(e.target.value); setBlatt(0); }} data-testid="draft-suche" />
        <button type="button" className={`fc${nurLeistbar ? " an" : ""}`} onClick={() => { setNurLeistbar(!nurLeistbar); setBlatt(0); }}>leistbar</button>
        <button type="button" className={`fc${nurWunsch ? " an" : ""}`} onClick={() => { setNurWunsch(!nurWunsch); setBlatt(0); }}>★ Wunschliste</button>
        <button type="button" className={`fc${nurScouting ? " an" : ""}`} onClick={() => { setNurScouting(!nurScouting); setBlatt(0); }}>mit Scouting</button>
        <span className="gk">Achse</span>
        {MARKT_ACHSEN.map((x) => (
          <button type="button" key={x} className={`fc${achse === x ? " an" : ""}`} onClick={() => { setAchse(achse === x ? null : x); setBlatt(0); }}>{ACHSEN_LABEL[x]}</button>
        ))}
      </div>
      <div className="fl">
        <span className="gk" style={{ marginLeft: 0 }}>Eignung in</span>
        <span className="dk20">
          {DISZIPLINEN.map((d) => (
            <button type="button" key={d} className={k.disziplin === d ? "an" : ""} title={officialDisciplineWeightLabels[d]} onClick={() => { k.setDisziplin(d); setBlatt(0); }}>
              {DISZIPLIN_KURZ[d] ?? d.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </span>
      </div>
      <div className="mt" style={{ ["--zeilen" as string]: ZEILEN_JE_BLATT }} data-testid="draft-tabelle">
        <div className="mz kopf">
          <span /><span />
          <span>Spieler</span>
          {sk("eignung", `Eignung ${DISZIPLIN_KURZ[k.disziplin] ?? ""}`)}
          <span style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", textAlign: "center" }}>{MARKT_ACHSEN.map((x) => <i key={x} style={{ fontStyle: "normal" }}>{ACHSEN_LABEL[x]}</i>)}</span>
          {sk(sort === "abloese" ? "guenstig" : "abloese", "Ablöse", "re")}
          <span className="re" title="Jahresgehalt (je Saison)">Gehalt/Sais.</span>
          {sk("gefragt", "gefragt")}
          <span />
        </div>
        {k.feedBusy && sichtbar.length === 0 ? <div className="drf-leerzeile">Draft-Brett wird geladen …</div> : null}
        {k.feedFehler ? <div className="drf-leerzeile w">{k.feedFehler}</div> : null}
        {sichtbar.map((z) => {
          const it = z.item;
          const wert = z.sicht.disziplinen[k.disziplin];
          const teuer = mein ? zuTeuer(z) : false;
          const g = a.gefragt[it.playerId] ?? 0;
          const bild = k.portrait(it.playerId);
          const wunsch = k.wunsch.has(it.playerId);
          return (
            <div key={it.playerId} className={`mz${k.wahl === it.playerId ? " an" : ""}`} onClick={() => k.setWahl(it.playerId)} data-testid="draft-zeile" data-player-id={it.playerId}>
              <button type="button" className={`st${wunsch ? " an" : ""}`} title="Wunschliste" aria-pressed={wunsch} onClick={(e) => { e.stopPropagation(); k.toggleWunsch(it); }}>{wunsch ? "★" : "☆"}</button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {bild ? <img className="por" src={bild} alt="" loading="lazy" /> : <span className="por" />}
              <span className="nm">
                <b className="drf-pl" role="link" title="Spielerprofil öffnen" onClick={(e) => { e.stopPropagation(); k.profil(it.playerId); }} data-testid="draft-profil-link">{it.name}</b>
                <small><span className={`scp ${scouteKlasse(z)}`}><i /><i /></span>{it.className} · {it.race}</small>
              </span>
              <span className="eg" title={wert ? (wert.exakt ? "Eignung (gescoutet)" : `Eignung als Stufe ${wert.text}`) : "unbekannt"}>
                <b className={`t${wert && !wert.exakt ? " nb" : ""}`}>{wert ? wert.text : "?"}</b>
                <span className="bal">{wert && wert.von != null && wert.bis != null && !wert.exakt ? <u style={{ left: `${wert.von}%`, width: `${wert.bis - wert.von + 1}%` }} /> : <i style={{ width: `${wert?.schaetzung ?? 0}%` }} />}</span>
              </span>
              <span className="ax t">
                {MARKT_ACHSEN.map((x) => {
                  const s = z.sicht.achsen[x];
                  return <i key={x} className={s.exakt ? (s.sortWert != null && s.sortWert >= 4.5 ? "h" : s.sortWert != null && s.sortWert >= 3.5 ? "m" : "") : "nb"}>{s.anzeige ?? "?"}</i>;
                })}
              </span>
              <span className={`re${teuer ? " zt" : ""}`}><b className="t">{de(it.marketValue ?? 0)}</b></span>
              <span className="re"><b className="t">{de(it.salary ?? 0)}</b></span>
              <span><span className={`gef g${Math.min(3, g)} t`}>{g ? `${g}×` : "–"}</span></span>
              <span style={{ justifySelf: "end" }}>
                {teuer ? (
                  <span className="tag w" title="sprengt die Kasse samt Reserve für die Pflichtplätze">zu teuer</span>
                ) : dran ? (
                  <button type="button" className="knopf klein haupt" data-testid="draft-picken" onClick={(e) => { e.stopPropagation(); void aktionen.pick(it.playerId, it.name); }} title="Draft-Vertrag: 1 Saison, Gehalt wie angezeigt, Ablöse = Marktwert">Picken</button>
                ) : k.wahl === it.playerId ? (
                  <span className="tag go">vorgemerkt</span>
                ) : (
                  <span className="tag">vormerken</span>
                )}
              </span>
            </div>
          );
        })}
        {!k.feedBusy && !k.feedFehler && sichtbar.length === 0 ? <div className="drf-leerzeile">Keine Spieler für diese Filter.</div> : null}
      </div>
      <div className="mfuss">
        <span>
          {k.nebelAus ? (
            "Scouting-Nebel aus: alle Werte exakt"
          ) : (
            <>
              <span className="scp s0"><i /><i /></span> unbekannt 10er-Stufe · <span className="scp s1"><i /><i /></span> beobachtet 5er-Stufe · <span className="scp s2"><i /><i /></span> gescoutet exakt · Ablöse immer exakt ·{" "}
              <b style={{ color: "var(--nebel)" }}>im Nebel nach Stufe sortiert</b>
            </>
          )}
        </span>
        <span className="sp" />
        <span className="blat"><button type="button" onClick={() => setBlatt(Math.max(0, seite - 1))} aria-label="Vorheriges Blatt">‹</button> Blatt {seite + 1} / {seiten} <button type="button" onClick={() => setBlatt(Math.min(seiten - 1, seite + 1))} aria-label="Nächstes Blatt">›</button></span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Mein Draft
// ---------------------------------------------------------------------------------------------------------------------

export function MeinDraft({ k, aktionen }: { k: DraftKontext; aktionen: DraftAktionen }) {
  const a = k.ansicht;
  const mein = a.mein;
  if (!mein) {
    return (
      <section className="pan" id="l-ich">
        <div className="pk"><h2>Mein Draft</h2></div>
        <div className="fb"><div className="hin">Dieses Team ist nicht im Draft. Du schaust zu.</div></div>
      </section>
    );
  }
  const z = k.wahl ? k.zeilenById.get(k.wahl) : undefined;
  const bild = z ? k.portrait(z.item.playerId) : null;
  const figur = z ? k.figur(z.item.playerId) : null;
  const preis = z?.item.marketValue ?? 0;
  const teuer = z ? preis > mein.maxAbloese + 1e-9 : false;
  const kulisse = einsatzlisteKulisseBild(k.disziplin);
  const meineEintraege = a.verlauf.filter((e) => e.art === "pick" && e.teamId === mein.teamId && e.playerId);
  const gepickt = meineEintraege.reduce((s, e) => s + (e.abloese ?? 0), 0);
  const gesamt = Math.max(0.01, mein.kasse + gepickt);
  const breite = (x: number) => `${Math.max(0, Math.min(100, (x / gesamt) * 100))}%`;
  const frei = Math.max(0, mein.kasse - mein.pflichtReserve - (z && !teuer ? preis : 0));
  // Konkurrenz: KI-Teams vor mir, die ihn gerade in den Top 3 haben.
  const bis = mein.picksBisZug ?? 0;
  const konkurrenz =
    z && !mein.amZug
      ? a.naechste.slice(0, bis).filter((t) => t.art === "ki" && t.top3?.includes(z.item.playerId)).map((t) => ({ t, rang: (t.top3 ?? []).indexOf(z.item.playerId) + 1 }))
      : [];
  const plaetze = Array.from({ length: 14 }, (_, i) => meineEintraege[i]?.playerId ?? (i < mein.kader ? "?" : null));
  const wunsch = [...k.wunsch].slice(0, 4);
  const wegPicker = (id: string) => a.verlauf.find((e) => e.art === "pick" && e.playerId === id)?.teamId ?? null;

  return (
    <section className="pan" id="l-ich" data-testid="draft-mein">
      {z ? (
        <div className="buehne-f" style={kulisse ? { backgroundImage: `url(${kulisse})` } : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {figur ? <img className="fig" src={figur} alt="" /> : bild ? <img className="por" src={bild} alt="" /> : null}
          <div className="txt"><em>{z.item.className} · {z.item.race}</em><h3 className="drf-pl" role="link" title="Spielerprofil öffnen" onClick={() => k.profil(z.item.playerId)}>{z.item.name}</h3></div>
        </div>
      ) : (
        <div className="pk"><h2>Mein Draft</h2></div>
      )}
      <div className="fb">
        {z ? (
          <>
            <div className="kost">
              <div><small>Ablöse</small><strong className={`t${teuer ? " minus" : ""}`}>{de(preis)}</strong><em>C · exakt</em></div>
              <div><small>Gehalt / Saison</small><strong className="t">{de(z.item.salary ?? 0)}</strong><em>C · {de((z.item.salary ?? 0) / 20, 2)} je Spieltag</em></div>
              <div><small>{DISZIPLIN_KURZ[k.disziplin] ?? ""}</small><strong className="t">{eignungText(z, k.disziplin)}</strong><em>Eignung</em></div>
            </div>
            <div className="trl">
              {z.item.traitsPositive.map((x) => <span key={x} className="tag g">{x}</span>)}
              {z.item.traitsNegative.map((x) => <span key={x} className="tag w">{x}</span>)}
              {z.item.hiddenPositiveTraitCount + z.item.hiddenNegativeTraitCount > 0 ? (
                <span className="tag" style={{ color: "var(--nebel)", borderColor: "rgba(143,180,217,.5)" }}>Traits verdeckt</span>
              ) : null}
            </div>
            <div className="akt">
              <button
                type="button"
                className={`knopf ${mein.darfPicken && !teuer ? "haupt" : "zu"}`}
                style={{ flex: 1 }}
                disabled={!(mein.darfPicken && !teuer)}
                onClick={() => void aktionen.pick(z.item.playerId, z.item.name)}
                data-testid="draft-mein-picken"
              >
                {teuer
                  ? "Sprengt die Kasse samt Reserve"
                  : mein.darfPicken
                    ? `${z.item.name} picken · ${betragC(preis)}`
                    : `Vorgemerkt · ${mein.picksBisZug != null && mein.picksBisZug > 0 ? `du bist in ${mein.picksBisZug} Picks dran` : "du bist nicht dran"}`}
              </button>
              <button type="button" className="knopf" title="Wunschliste" onClick={() => k.toggleWunsch(z.item)}>{k.wunsch.has(z.item.playerId) ? "★" : "☆"}</button>
            </div>
            {konkurrenz.length ? (
              <div className="hin a"><b>Achtung:</b> {konkurrenz.map((x) => `${k.teamName(x.t.teamId)} (${x.rang}.)`).join(", ")} {konkurrenz.length > 1 ? "haben" : "hat"} ihn in den Top 3 und {konkurrenz.length > 1 ? "picken" : "pickt"} vor dir.</div>
            ) : (
              <div className="hin">Kein KI-Team vor dir hat ihn gerade in den Top 3.</div>
            )}
            <div className="hin" data-testid="draft-vertrag-hinweis">Draft-Vertrag: 1 Saison · Gehalt wie angezeigt</div>
            <AuslassenFertig mein={mein} minKader={a.regeln.minKader} aktionen={aktionen} />
          </>
        ) : (
          <>
            <div className="hin">Klick auf einen Spieler im Brett merkt ihn für deinen Pick vor.</div>
            <AuslassenFertig mein={mein} minKader={a.regeln.minKader} aktionen={aktionen} />
          </>
        )}
        <h4 title={mein.kaderOpt != null ? `Pflicht (rot): der Mindestkader. Opt (grün): die Kadergröße, die dein GM anstrebt (Optimum der GM-Identität, dieselbe Zahl wie in der KI-Kaderplanung). Ein Vorstandsziel zur Kadergröße gibt es nicht mehr.` : "Pflicht (rot): der Mindestkader."}>Mein Kader <span style={{ marginLeft: "auto", color: "var(--stumm)" }}>{Math.min(mein.kader, a.regeln.minKader)} von {a.regeln.minKader} Pflicht{mein.kaderOpt != null ? ` · Opt ${mein.kaderOpt}` : ""} · höchstens {a.regeln.maxPicksJeTeam}</span></h4>
        <div className="plaetze">
          {plaetze.map((id, i) => {
            const b = id && id !== "?" ? k.portrait(id) : null;
            return (
              <div key={i} onClick={id && id !== "?" ? () => k.profil(id) : undefined} style={id && id !== "?" ? { cursor: "pointer" } : undefined} data-testid={id && id !== "?" ? "draft-kader-spieler" : undefined} className={id ? "voll" : i < a.regeln.minKader ? "pfl" : mein.kaderOpt != null && i < mein.kaderOpt ? "opt" : ""} title={id && id !== "?" ? spielerName(k, id) : mein.kaderOpt != null && i >= a.regeln.minKader && i < mein.kaderOpt ? "Opt: so groß will dein GM den Kader (GM-Identität)" : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {b ? <img src={b} alt="" /> : id ? null : i < a.regeln.minKader ? "Pflicht" : mein.kaderOpt != null && i < mein.kaderOpt ? "Opt" : "frei"}
              </div>
            );
          })}
        </div>
        <h4>Kasse und Pflichtplätze</h4>
        <div className="gf" style={{ padding: 0 }}>
          <div className="zt2">
            <div className="tk2"><span className="gk">Kasse</span><small>frei <b className="t">{betragC(mein.kasse)}</b></small></div>
            <div className="stapel" data-testid="draft-kassenbalken">
              <i className="aus" style={{ width: breite(gepickt) }} />
              <i className="vor" style={{ width: breite(z && !teuer ? preis : 0) }} />
              <i className="frei" style={{ width: breite(frei) }} />
              <i className="res" style={{ width: breite(mein.pflichtReserve) }} />
            </div>
          </div>
          <div className="leg">
            <span><i style={{ background: "var(--stumm)" }} />gepickt</span>
            <span><i style={{ background: "var(--acht)" }} />dieser Pick</span>
            <span><i style={{ background: "var(--gut)" }} />frei</span>
            <span><i style={{ background: "var(--warn)" }} />Reserve für Pflichtplätze</span>
          </div>
          <div className="gz"><span>Für diesen Pick höchstens</span><b className="t">{betragC(Math.max(0, mein.maxAbloese))}</b></div>
          <div className="vorst"><b>Gehaltsbudget:</b> in Saison 1 ohne Vorstandsdeckel (Finanzseite · Budgets)<small>Der Draft prüft Kasse und Pflichtplätze; der Vorstandsrahmen gilt ab Saison 2.</small></div>
        </div>
        <h4>
          Wunschliste
          <button type="button" className={`schalter${mein.autoPick ? " an" : ""}`} style={{ marginLeft: "auto" }} onClick={() => void aktionen.autoPick(!mein.autoPick)} title="An: bist du dran, pickt dein GM für dich." data-testid="draft-autopick">
            Auto-Pick<i />
          </button>
        </h4>
        <div className="wl">
          {wunsch.length ? (
            wunsch.map((id, i) => {
              const info = kartenInfo(k, id);
              const zz = k.zeilenById.get(id);
              const weg = wegPicker(id);
              const mw = zz?.item.marketValue ?? info?.marktwert ?? 0;
              return (
                <div key={id} onClick={() => !weg && k.setWahl(id)}>
                  <span>{i + 1}. {zz?.item.name ?? info?.name ?? id} <small>· {betragC(mw)}</small></span>
                  {weg ? (weg === mein.teamId ? <span className="tag g">gepickt</span> : <span className="tag w">weg · {k.teamKuerzel(weg)}</span>) : mw > mein.maxAbloese ? <span className="tag a">zu teuer</span> : <span className="tag g">noch frei</span>}
                </div>
              );
            })
          ) : (
            <div><span style={{ color: "var(--leise)" }}>leer · ☆ im Brett setzt einen Wunsch</span></div>
          )}
        </div>
      </div>
    </section>
  );
}

