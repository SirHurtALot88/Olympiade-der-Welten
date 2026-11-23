"use client";

/**
 * DRAFT, ANSICHT LIVE (18.11.). Vorlage: public/mockups/draft-modern-18-11.html (`#s-live`).
 * Teile: Kopfleiste (Runde, Kette, Sitze, Tempo), Am Zug, Danach am Zug, Draft-Brett, Mein Draft, Live-Ticker.
 * Gezeigt = gebucht: Picks, Top 3, Preise und Grenzen kommen aus `/api/draft`; das Brett aus dem Markt-Feed mit
 * Scouting-Nebel (`baueSpielerSicht`). Sortiert und gefiltert wird nur über die Sicht.
 */
import KlassenFarbTag from "../KlassenFarbTag";
import { useMemo, useState } from "react";

import type { LigaDraftPickGrund } from "@/lib/draft/liga-draft-ki";
import type { LigaDraftSpielerKarte, LigaDraftZugAnsicht } from "@/lib/draft/liga-draft-ansicht";
import { ACHSEN_FARBE_HEX, ACHSEN_REIHENFOLGE, DISZIPLIN_NACH_ACHSE, DISZIPLINEN_GEORDNET } from "@/lib/market/disziplin-reihenfolge";
import { erfuelltFilter, LEERE_FILTER, mindestAchsenZahlLabel, naechsteMindestNote, zaehleAktiveFilter, type WeitereFilter } from "@/lib/market/transfermarkt-weitere-filter";
import WeitereFilterPanel from "@/app/foundation/transfermarkt-modern/WeitereFilterPanel";
import { useTabellenSortierung } from "@/lib/ui/tabellen-sortierung";
import { erfuelltAchsenMinimum, tierBereichSortWert, MARKT_ACHSEN, sortiereNachSicht, type MarktAchse } from "@/lib/market/transfermarkt-sicht";
import { officialDisciplineWeightLabels } from "@/lib/player-generator/official-discipline-weights";
import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";
import { DISZIPLIN_KURZ } from "@/app/foundation/transfermarkt-modern/tm-format";
import type { DraftTempo, DraftZeig } from "./draft-daten";
import type { DraftKontext, DraftZeile } from "./draft-kontext";
import { filterSchluessel, useGemerkterFilter } from "@/app/foundation/shared/filter-gedaechtnis";
import { erfuelltFitSchwelle, FIT_AUS, fitSortWert, istFitSichtbar, naechsteFitSchwelle, zaehleFitAusgeblendet } from "@/lib/market/transfermarkt-fit";
import { FitZelle } from "@/app/foundation/shared/FitMarke";
import { useListenTasten } from "@/app/foundation/shared/klickregel";
import { usePortraetVorschau, type VorschauDaten } from "@/app/foundation/shared/PortraetVorschau";
import SpaltenGriff from "@/app/foundation/shared/SpaltenGriff";
import { useSpaltenLayout, type SpaltenDef } from "@/app/foundation/shared/spalten-layout";
import { KasseBlock, MeinKaderListe, WirkungAufKader } from "@/app/foundation/shared/MeinKaderPanel";
import { baueKasseDraft, kandidatSpanne, type EigenerSpieler, type KandidatEintrag } from "@/app/foundation/shared/mein-kader-daten";
import { wirkungMitKandidat, type RangWirkung } from "@/lib/market/transfermarkt-kaderstaerke";
import { auslassenSperrGrund, betragC, de, fertigGrundText, fertigSperrGrund, GRUND_TAG, GRUND_TEXT, pickHerkunft, sitzBuchstabe, sitzKlasse, sitzName } from "./draft-format";

const ACHSEN_LABEL: Record<MarktAchse, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };
const DISZIPLINEN = DISZIPLINEN_GEORDNET;
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
 * „Nicht picken?“ (UX 19.11., Mockup `ux-draft-markt-19-11.html`): drei beschriftete Wege unter dem Pick-Knopf, jeder mit einer
 * Zeile Folge. Gesperrt wird STRIKT nach `darfAuslassen`/`darfFertig`/`darfUeberspringen` der Sicht (die Route rechnet; die Seite
 * rechnet nichts nach); der Sperrgrund steht sichtbar unter dem Knopf, nicht nur im Tooltip. Auslassen und Fertig öffnen eine
 * Rückfrage (Dialoge in `DraftAnsichten`), Überspringen den vorhandenen Dialog.
 */
export function NichtPicken({
  mein,
  minKader,
  onAuslassen,
  onFertig,
  onSkip,
}: {
  mein: NonNullable<DraftKontext["ansicht"]["mein"]>;
  minKader: number;
  onAuslassen: () => void;
  onFertig: () => void;
  onSkip: () => void;
}) {
  if (mein.art !== "mensch" || mein.status === "fertig") return null;
  const auslassenGrund = auslassenSperrGrund(mein);
  const fertigGrund = fertigSperrGrund(mein, minKader);
  const fehlend = Math.max(0, minKader - mein.kader);
  return (
    <>
      <h4 data-testid="draft-nicht-picken-kopf">Nicht picken? <span>drei Wege</span></h4>
      <div className="np" data-testid="draft-nicht-picken">
        <button type="button" className={mein.darfAuslassen ? "" : "zu"} disabled={!mein.darfAuslassen} title={auslassenGrund ?? "Dieser Pick entfällt, in der nächsten Runde bist du wieder dran."} onClick={onAuslassen} data-testid="draft-auslassen">
          <b>Pick auslassen</b>
          <small>{mein.darfAuslassen ? "nur diese Runde · nächste Runde wieder dran" : auslassenGrund}</small>
        </button>
        <button type="button" className={mein.darfFertig ? "" : "zu"} disabled={!mein.darfFertig} title={fertigGrund ?? "Nimmt dich aus der Reihenfolge — du pickst nicht mehr."} onClick={onFertig} data-testid="draft-fertig">
          <b>Ich bin fertig</b>
          <small>{mein.darfFertig ? `Draft für mich beenden · Kader ${mein.kader}` : fehlend > 0 ? `ab ${minKader} Spielern · noch ${fehlend} Pflichtplätze` : fertigGrund}</small>
        </button>
        <button type="button" className={mein.darfUeberspringen ? "" : "zu"} disabled={!mein.darfUeberspringen} title="KI fertig picken lassen oder Auto-Draft" onClick={onSkip} data-testid="draft-ueberspringen-block">
          <b>Überspringen …</b>
          <small>{mein.darfUeberspringen ? "KI picken lassen oder Auto-Draft" : "gerade nicht möglich"}</small>
        </button>
      </div>
    </>
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
              <button type="button" className="knopf" onClick={onSkip} title="Den ganzen Draft überspringen: KI fertig picken lassen oder Auto-Draft" data-testid="draft-ueberspringen">Draft überspringen …</button>
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
      title={aktiv ? "Ausgewählt · nochmal klicken öffnet das Profil" : "Klick wählt aus"}
      aria-pressed={aktiv ? true : undefined}
      data-testid="draft-top3-karte"
      data-player-id={playerId}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {bild ? <img className="bg" src={bild} alt="" /> : null}
      <span className="rk t">{rang}.</span>
      {aktiv && zustand !== "pick" ? <span className="tag go fk-schild">ausgewählt</span> : null}
      {zustand === "pick" ? null : <span className="hv">{aktiv ? "nochmal klicken · Profil" : "Klick wählt aus"}</span>}
      {grund && !(aktiv && zustand !== "pick") ? (
        <span className={`tag gd ${GRUND_TAG[grund.art] ?? ""}`}>
          {grund.art === "bedarf" ? `Bedarf ${DISZIPLIN_KURZ[grund.disziplinId] ?? ""}`.trim() : GRUND_TEXT[grund.art]}
        </span>
      ) : null}
      <span className="un">
        <b className="drf-pl" role="link" title="Name: wählt aus und öffnet das Profil" onClick={(e) => { e.stopPropagation(); k.nameKlick(playerId); }} data-testid="draft-profil-link">{z?.item.name ?? info?.name ?? "—"}</b>
        <small><KlassenFarbTag className={z?.item.className ?? info?.className} mitAchse={false} /> · {z?.item.race ?? info?.race ?? ""}</small>
        <span className="zw">
          <span>{DISZIPLIN_KURZ[k.disziplin] ?? ""} <b className={`t${z && z.sicht.stufe < 5 ? " nb" : ""}`}>{eignungText(z, k.disziplin)}</b></span>
          <strong className="t">{de(info?.marktwert ?? z?.item.marketValue ?? 0)} C</strong>
        </span>
      </span>
    </button>
  );
}

export function AmZug({ k, zeig }: { k: DraftKontext; zeig: DraftZeig | null }) {
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
        <small>{gewaehlt ? "" : "1. Klick wählt aus · 2. Klick Profil"}</small>
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
              aktiv={k.wahl === id}
              onClick={() => (gewaehlt === id ? k.profil(id) : k.klick(id))}
            />
          ))}
        </div>
      ) : (
        <div className="wart"><p>Dieses Team pickt nicht mehr.</p></div>
      )}
      <div className="zfuss">
        {meinZug
          ? "Dieselbe Regel gilt, wenn die KI am Zug ist: ihre Top 3 lassen sich auswählen (vormerken) und beim zweiten Klick öffnen."
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
      <div className="pk"><h2>Danach am Zug</h2><span className="sp" /><span className="gk">Portrait anklicken wählt aus</span></div>
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
                  <small>{ich ? (vorgemerkt ? <>ausgewählt: <u>{vorgemerkt}</u></> : "noch nichts ausgewählt") : "pickt selbst · der Draft wartet"}</small>
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
                  const gewaehlt = k.wahl === id;
                  // eslint-disable-next-line @next/next/no-img-element
                  return bild ? <img key={id} className={`${k.wunsch.has(id) || gewaehlt ? "k" : ""}${gewaehlt ? " an" : ""}`} src={bild} title={`${spielerName(k, id)} · ${gewaehlt ? "ausgewählt, nochmal klicken öffnet das Profil" : "Klick wählt aus"}`} alt="" data-testid="draft-danach-portrait" data-player-id={id} onClick={(e) => { e.stopPropagation(); k.klick(id); }} /> : null;
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
            <b className="drf-pl" role="link" title="Vergeben · Klick öffnet das Profil" onClick={() => { if (e.playerId) k.profil(e.playerId); }}>{e.playerId ? spielerName(k, e.playerId) : "—"}</b>
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

/** Sortierbarer Spaltenkopf der Pick-Liste: Klick sortiert, nochmal klicken dreht die Richtung. */
function PickKopf({ k, re, children }: { k: { aktiv: boolean; pfeil: string; ariaSort: "ascending" | "descending" | "none"; onKlick: () => void }; re?: boolean; children: string }) {
  return (
    <span
      className={`${re ? "re " : ""}${k.aktiv ? "so" : ""}`.trim() || undefined}
      style={{ cursor: "pointer" }}
      role="button"
      tabIndex={0}
      aria-sort={k.ariaSort}
      title="Klick sortiert · nochmal klicken dreht die Richtung"
      onClick={k.onKlick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          k.onKlick();
        }
      }}
    >
      {children}
      {k.pfeil}
    </span>
  );
}

type SortKey = "eignung" | "abloese" | "guenstig" | "gefragt" | "fit" | "name" | "gehalt" | "marketability" | MarktAchse;

/** Spalten des Draft-Bretts (Breiten in u); per Ziehen anpassbar und je Benutzer gespeichert, getrennt vom Transfermarkt. */
export const DRAFT_SPALTEN: SpaltenDef[] = [
  { id: "stern", standard: 1.3, min: 1.3, max: 1.3, fest: true },
  { id: "por", standard: 2.3, min: 1.6, max: 9 },
  { id: "nm", standard: 7, min: 5, max: 24, flex: true },
  { id: "eg", standard: 8.6, min: 5, max: 14 },
  { id: "ax", standard: 9, min: 7, max: 18 },
  { id: "fit", standard: 3.6, min: 3, max: 8 },
  { id: "mk", standard: 3.8, min: 3, max: 8 },
  { id: "abl", standard: 4.4, min: 3, max: 9 },
  { id: "geh", standard: 3.5, min: 3, max: 9 },
  { id: "gef", standard: 3.3, min: 2.6, max: 8 },
  { id: "ak", standard: 9.5, min: 6, max: 16 },
];
const DRAFT_DEF = Object.fromEntries(DRAFT_SPALTEN.map((d) => [d.id, d]));

function vorschauDaten(it: DraftZeile["item"], sicht: DraftZeile["sicht"], bild: string | null): VorschauDaten {
  return {
    bild,
    name: it.name,
    klasse: it.className,
    rasse: it.race,
    achsen: MARKT_ACHSEN.map((x) => {
      const s = sicht.achsen[x];
      return { label: ACHSEN_LABEL[x], anzeige: s.anzeige, exakt: s.exakt, stufe: s.exakt ? (s.sortWert != null && s.sortWert >= 4.5 ? "h" : s.sortWert != null && s.sortWert >= 3.5 ? "m" : "") : "" };
    }),
  };
}

export function DraftBrett({ k, aktionen, tastenAktiv = true }: { k: DraftKontext; aktionen: DraftAktionen; tastenAktiv?: boolean }) {
  const a = k.ansicht;
  const mein = a.mein;
  const [tab, setTab] = useState<"frei" | "picks">("frei");
  // Filter bleiben beim Reiterwechsel (Live / Pick-Tafel / Liga & Ränge) stehen (Chris 21.11.): `filter-gedaechtnis.ts`.
  const fk = (feld: string) => filterSchluessel("draft-brett", k.saveId, feld);
  const [suche, setSuche] = useGemerkterFilter(fk("suche"), "");
  const [sort, setSort] = useGemerkterFilter<SortKey>(fk("sort"), "eignung");
  // Name und Gehalt: zweiter Klick dreht die Richtung (Name zuerst A–Z, Gehalt zuerst teuer, dann günstig = besser).
  const [sortUm, setSortUm] = useState(false);
  const klickSort2 = (key: "name" | "gehalt") => {
    if (sort === key) setSortUm((u) => !u);
    else {
      setSort(key);
      setSortUm(false);
    }
    setBlatt(0);
  };
  const [nurLeistbar, setNurLeistbar] = useGemerkterFilter(fk("leistbar"), false);
  const [nurWunsch, setNurWunsch] = useGemerkterFilter(fk("wunsch"), false);
  const [nurScouting, setNurScouting] = useGemerkterFilter(fk("scouting"), false);
  // Team-Fit: dieselbe Marktregel wie im Transfermarkt (`istFitSichtbar`): negativer Fit ausgeblendet, Mercenaries bleiben.
  const [fitNegativ, setFitNegativ] = useGemerkterFilter(fk("fitNegativ"), false);
  // Fit-Schwelle „Fit > X“ (Chris 21.11.): kombinierbar mit dem Schalter; `FIT_AUS` (-1) = aus.
  const [fitMin, setFitMin] = useGemerkterFilter<number>(fk("fitMin"), FIT_AUS);
  const [achsenMin, setAchsenMin] = useGemerkterFilter<Partial<Record<MarktAchse, number>>>(fk("achsenMin"), {});
  // „Weitere Filter“ (Kartenfarbe, Marktwert, Gehalt/Saison, Value, Mindestnote je Attribut): dieselbe Komponente und Logik wie im
  // Transfermarkt (#1647, `transfermarkt-weitere-filter.ts`), hier nicht nachgebaut.
  const [weitere, setWeitere] = useGemerkterFilter<WeitereFilter>(fk("weitere"), LEERE_FILTER);
  const [weitereOffen, setWeitereOffen] = useState(false);
  const aktiveWeitere = zaehleAktiveFilter(weitere);
  const fitAusgeblendet = useMemo(() => zaehleFitAusgeblendet(k.zeilen.map((z) => z.item)), [k.zeilen]);
  const [blatt, setBlatt] = useState(0);
  const spalten = useSpaltenLayout("draft-brett", DRAFT_SPALTEN);
  const vorschau = usePortraetVorschau();
  const griff = (id: string) => <SpaltenGriff layout={spalten} def={DRAFT_DEF[id]} />;
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
      if (!istFitSichtbar(z.item, fitNegativ)) return false;
      if (!erfuelltFitSchwelle(z.item, fitMin)) return false;
      for (const [x, min] of Object.entries(achsenMin) as [MarktAchse, number][]) {
        if (!erfuelltAchsenMinimum(z.sicht, x, min)) return false;
      }
      if (aktiveWeitere > 0 && !erfuelltFilter(z.item, z.sicht, weitere)) return false;
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
        case "fit":
          return fitSortWert(z.item);
        case "name":
          return 0; // alphabetisch, siehe unten
        case "gehalt":
          return z.item.salary ?? 0;
        case "marketability":
          return z.item.marketability?.schluessel ?? null;
        case "pow":
        case "spe":
        case "men":
        case "soc":
          return z.sicht.achsen[sort].summe ?? z.sicht.achsen[sort].sortWert;
      }
    };
    if (sort === "name") {
      const alpha = [...liste].sort((x, y) => x.item.name.localeCompare(y.item.name, "de"));
      return sortUm ? alpha.reverse() : alpha;
    }
    if (sort === "gehalt") return sortiereNachSicht(liste, schluessel, sortUm ? 1 : -1);
    return sortiereNachSicht(liste, schluessel, sort === "guenstig" ? 1 : -1);
  }, [sortUm, k.zeilen, k.wunsch, k.disziplin, suche, nurLeistbar, nurWunsch, nurScouting, fitNegativ, fitMin, achsenMin, weitere, aktiveWeitere, sort, mein, maxAbloese, a.gefragt]);

  const seiten = Math.max(1, Math.ceil(gefiltert.length / ZEILEN_JE_BLATT));
  const seite = Math.min(blatt, seiten - 1);
  const sichtbar = gefiltert.slice(seite * ZEILEN_JE_BLATT, seite * ZEILEN_JE_BLATT + ZEILEN_JE_BLATT);
  // Tastatur (UX 19.11.): ↑/↓ bewegt die Auswahl in der Liste, Enter öffnet das Profil. Gepickt wird nie per Taste.
  const sichtbareIds = useMemo(() => (tab === "frei" ? sichtbar.map((z) => z.item.playerId) : []), [tab, sichtbar]);
  useListenTasten({ ids: sichtbareIds, gewaehlt: k.wahl, waehle: k.setWahl, profil: k.profil, aktiv: tastenAktiv && tab === "frei" });

  const picksRoh = useMemo(() => a.verlauf.filter((e) => e.art === "pick").slice().reverse(), [a.verlauf]);
  // „Alle Picks“ ist sortierbar (Designregel 21.11.): Standard neueste zuerst, Köpfe sortieren, zweiter Klick dreht.
  const gehaltVon = (e: (typeof picksRoh)[number]) => {
    if (!e.playerId) return null;
    return k.zeilenById.get(e.playerId)?.item.salary ?? kartenInfo(k, e.playerId)?.gehalt ?? null;
  };
  const { sortiert: picks, kopf: pickKopf } = useTabellenSortierung(
    picksRoh,
    {
      pick: { wert: (e) => e.pickNr, standard: "auf" },
      runde: { wert: (e) => (e.quelle === "nachzug" ? 99 : e.runde), standard: "auf" },
      team: { wert: (e) => k.teamName(e.teamId), standard: "auf" },
      spieler: { wert: (e) => (e.playerId ? spielerName(k, e.playerId) : null), standard: "auf" },
      abloese: { wert: (e) => e.abloese ?? null },
      gehalt: { wert: (e) => gehaltVon(e) },
    },
    { key: "pick", richtung: "ab" },
  );
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
          <div className="mz pz kopf"><PickKopf k={pickKopf("pick")}>Pick</PickKopf><PickKopf k={pickKopf("runde")}>Runde</PickKopf><span /><PickKopf k={pickKopf("team")}>Team</PickKopf><span /><PickKopf k={pickKopf("spieler")}>Spieler</PickKopf><span style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", textAlign: "center" }}>{MARKT_ACHSEN.map((x) => <i key={x} style={{ fontStyle: "normal" }}>{ACHSEN_LABEL[x]}</i>)}</span><PickKopf k={pickKopf("abloese")} re>Ablöse</PickKopf><PickKopf k={pickKopf("gehalt")} re>Gehalt</PickKopf></div>
          {zeilen.map((e) => {
            const info = e.playerId ? kartenInfo(k, e.playerId) : null;
            const z = e.playerId ? k.zeilenById.get(e.playerId) : undefined;
            const bild = e.playerId ? (k.portrait(e.playerId) ?? info?.portraitUrl ?? null) : null;
            const gehalt = z?.item.salary ?? info?.gehalt ?? 0;
            return (
              <div key={e.nr} className={`mz pz${e.teamId === mein?.teamId ? " an" : ""}`} onClick={() => { if (e.playerId) k.profil(e.playerId); }} title="Vergeben · Klick öffnet das Profil" data-testid="draft-pick-zeile">
                <b className="t" style={{ color: "var(--stumm)" }}>#{e.pickNr}</b>
                <span className="t">{e.quelle === "nachzug" ? "N" : e.runde}</span>
                <span className="lg"><Wappen url={k.wappen(e.teamId)} kuerzel={k.teamKuerzel(e.teamId)} /></span>
                <span className="nm"><b>{k.teamName(e.teamId)}</b><small>{pickHerkunft(e)}</small></span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {bild ? <img className="por" src={bild} alt="" loading="lazy" /> : <span className="por" />}
                <span className="nm"><b>{e.playerId ? spielerName(k, e.playerId) : "—"}</b><small>{e.playerId ? <><KlassenFarbTag className={z?.item.className ?? info?.className} /> · {z?.item.race ?? info?.race ?? ""}</> : ""}</small></span>
                <span className="ax t">
                  {MARKT_ACHSEN.map((x) => {
                    const sicht = z?.sicht.achsen[x];
                    if (sicht) return <i key={x} className={sicht.exakt ? (sicht.sortWert != null && sicht.sortWert >= 4.5 ? "h" : sicht.sortWert != null && sicht.sortWert >= 3.5 ? "m" : "") : "nb"}>{sicht.anzeige ?? "?"}</i>;
                    const gruppe = info?.achsenGruppen?.[x] ?? null;
                    const wert = gruppe ? tierBereichSortWert(gruppe) : null;
                    return <i key={x} className={wert != null && wert >= 4.5 ? "nb h" : "nb"} title="Zweier-Gruppe (Nebel)">{gruppe ?? "?"}</i>;
                  })}
                </span>
                <span className="re"><b className="t">{de(e.abloese ?? 0)}</b></span>
                <span className="re"><b className="t">{de(gehalt)}</b><small style={{ display: "block", color: "var(--stumm)" }}>je Saison</small></span>
              </div>
            );
          })}
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
        <button type="button" className={`fc${fitNegativ ? " an" : ""}`} onClick={() => { setFitNegativ((v) => !v); setBlatt(0); }} aria-pressed={fitNegativ} title="Standard: nur Spieler mit passendem Team-Fit (0 oder besser) und Mercenaries. Der Schalter blendet auch die mit negativem Fit ein." data-testid="draft-fit-negativ">
          Negativer Fit {fitNegativ ? "eingeblendet" : "ausgeblendet"}{!fitNegativ && fitAusgeblendet > 0 ? ` · ${fitAusgeblendet}` : ""}
        </button>
        <button type="button" className={`fc${fitMin >= 0 ? " an" : ""}`} onClick={() => { setFitMin((v) => naechsteFitSchwelle(v)); setBlatt(0); }} title="Klick: Fit größer als 0, 5, 10, 15, 20, dann aus. Mercenaries bleiben als Ausnahme sichtbar." data-testid="draft-fit-min">
          Fit{fitMin >= 0 ? ` > ${fitMin}` : " > X"}
        </button>
        <span className="gk">Achse mind.</span>
        {MARKT_ACHSEN.map((x) => {
          const min = achsenMin[x];
          return (
            <button
              type="button"
              key={x}
              className={`fc${min != null ? " an" : ""}`}
              title="Klick: mindestens 58, 64, 70, 76, 82 Punkte, dann aus."
              data-testid={`draft-achse-${x}`}
              onClick={() => {
                setAchsenMin((alt) => {
                  const neu = { ...alt };
                  const next = naechsteMindestNote(neu[x]);
                  if (next == null) delete neu[x];
                  else neu[x] = next;
                  return neu;
                });
                setBlatt(0);
              }}
            >
              {ACHSEN_LABEL[x]}{min != null ? ` ≥ ${mindestAchsenZahlLabel(min)}` : ""}
            </button>
          );
        })}
        <button type="button" className={`fc${weitereOffen || aktiveWeitere > 0 ? " an" : ""}`} onClick={() => setWeitereOffen((v) => !v)} aria-expanded={weitereOffen} data-testid="draft-weitere-filter">
          Weitere Filter{aktiveWeitere > 0 ? ` · ${aktiveWeitere}` : ""} {weitereOffen ? "▾" : "▸"}
        </button>
      </div>
      {weitereOffen ? <WeitereFilterPanel filter={weitere} onChange={(f) => { setWeitere(f); setBlatt(0); }} /> : null}
      <div className="fl">
        <span className="gk" style={{ marginLeft: 0 }}>Eignung in</span>
        <span className="dk20">
          {ACHSEN_REIHENFOLGE.map((achse) => (
            <span key={achse} className="dg" data-achse={achse} style={{ display: "inline-flex", gap: "calc(.16 * var(--u))", marginRight: "calc(.55 * var(--u))", paddingLeft: "calc(.3 * var(--u))", borderLeft: `2px solid ${ACHSEN_FARBE_HEX[achse]}` }}>
              {DISZIPLIN_NACH_ACHSE[achse].map((d) => (
                <button type="button" key={d} className={k.disziplin === d ? "an" : ""} style={k.disziplin === d ? undefined : { borderColor: ACHSEN_FARBE_HEX[achse] }} title={`${officialDisciplineWeightLabels[d]} · ${ACHSEN_LABEL[achse]}`} onClick={() => { k.setDisziplin(d); setBlatt(0); }}>
                  {DISZIPLIN_KURZ[d] ?? d.slice(0, 3).toUpperCase()}
                </button>
              ))}
            </span>
          ))}
        </span>
        <span className="sp" />
        <button type="button" className={`fc${spalten.angepasst ? " an" : ""}`} onClick={spalten.zuruecksetzen} title="Spaltenbreiten und Porträtgröße auf Standard" data-testid="draft-spalten-zuruecksetzen">Spalten ↺</button>
        <button type="button" className="fc" onClick={() => { setSuche(""); setNurLeistbar(false); setNurWunsch(false); setNurScouting(false); setFitNegativ(false); setFitMin(FIT_AUS); setAchsenMin({}); setWeitere(LEERE_FILTER); setBlatt(0); }} data-testid="draft-filter-zuruecksetzen"title="Alle Filter zurücksetzen">Filter ↺</button>
      </div>
      <div className={`mt sl${spalten.zeilenMin > 0 ? " pg" : ""}`} style={{ ["--zeilen" as string]: ZEILEN_JE_BLATT, ["--spalten" as string]: spalten.vorlage, ["--minbreite" as string]: `calc(${spalten.minBreite} * var(--u))`, ["--zmin" as string]: spalten.zeilenMin > 0 ? `calc(${spalten.zeilenMin} * var(--u))` : "0px", ["--pw" as string]: spalten.breiten.por }} data-testid="draft-tabelle">
        <div className="mz kopf">
          <span />
          <span>{griff("por")}</span>
          <span><button type="button" className={sort === "name" ? "so" : ""} onClick={() => klickSort2("name")} title="Klick sortiert · nochmal klicken dreht die Richtung" data-testid="draft-kopf-name">Spieler{sort === "name" ? (sortUm ? " ▴" : " ▾") : ""}</button>{griff("nm")}</span>
          <span>{sk("eignung", `Eignung ${DISZIPLIN_KURZ[k.disziplin] ?? ""}`)}{griff("eg")}</span>
          <span style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", textAlign: "center" }}>{MARKT_ACHSEN.map((x) => <i key={x} role="button" title="Achsen-Summe · Klick sortiert" className={sort === x ? "so" : ""} style={{ fontStyle: "normal", cursor: "pointer" }} onClick={() => { setSort(x); setBlatt(0); }} data-testid={`draft-kopf-${x}`}>{ACHSEN_LABEL[x]}{sort === x ? " ▾" : ""}</i>)}{griff("ax")}</span>
          <span>{sk("fit", "Fit")}{griff("fit")}</span>
          <span title="Marketability für DEIN Team (Fanprofil) · Stufe nach Scouting: 10er ungescoutet, 5er beobachtet, exakt gescoutet · dieselbe Rechnung wie im Transfermarkt">{sk("marketability", "Mkt")}{griff("mk")}</span>
          <span className="re">{sk(sort === "abloese" ? "guenstig" : "abloese", "Ablöse", "re")}{griff("abl")}</span>
          <span className="re" title="Jahresgehalt (je Saison) · Klick sortiert, nochmal klicken dreht die Richtung"><button type="button" className={`re${sort === "gehalt" ? " so" : ""}`} onClick={() => klickSort2("gehalt")} data-testid="draft-kopf-gehalt">Gehalt/Sais.{sort === "gehalt" ? (sortUm ? " ▴" : " ▾") : ""}</button>{griff("geh")}</span>
          <span>{sk("gefragt", "gefragt")}{griff("gef")}</span>
          <span>{griff("ak")}</span>
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
          const gewaehlt = k.wahl === it.playerId;
          return (
            <div key={it.playerId} className={`mz${gewaehlt ? " an" : ""}`} onClick={() => k.klick(it.playerId)} title={gewaehlt ? "Ausgewählt · nochmal klicken oder Enter öffnet das Profil" : "Klick wählt aus"} aria-selected={gewaehlt} data-testid="draft-zeile" data-player-id={it.playerId}>
              <button type="button" className={`st${wunsch ? " an" : ""}`} title="Wunschliste" aria-pressed={wunsch} onClick={(e) => { e.stopPropagation(); k.toggleWunsch(it); }}>{wunsch ? "★" : "☆"}</button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {bild ? <img className="por" src={bild} alt="" loading="lazy" data-testid="draft-portrait" onMouseEnter={(e) => vorschau.zeige(e.currentTarget, vorschauDaten(it, z.sicht, bild))} onMouseLeave={vorschau.verstecke} /> : <span className="por" />}
              <span className="nm">
                <b className="drf-pl" role="link" title="Name: wählt aus und öffnet das Profil" onClick={(e) => { e.stopPropagation(); k.nameKlick(it.playerId); }} data-testid="draft-profil-link">{it.name}</b>
                <small><span className={`scp ${scouteKlasse(z)}`}><i /><i /></span><KlassenFarbTag className={it.className} mitAchse={false} /> · {it.race}</small>
              </span>
              <span className="eg" title={wert ? (wert.exakt ? "Eignung (gescoutet)" : `Eignung als Stufe ${wert.text}`) : "unbekannt"}>
                <b className={`t${wert && !wert.exakt ? " nb" : ""}`}>{wert ? wert.text : "?"}</b>
                <span className="bal">{wert && wert.von != null && wert.bis != null && !wert.exakt ? <u style={{ left: `${wert.von}%`, width: `${wert.bis - wert.von + 1}%` }} /> : <i style={{ width: `${wert?.schaetzung ?? 0}%` }} />}</span>
              </span>
              <span className="ax t">
                {MARKT_ACHSEN.map((x) => {
                  const s = z.sicht.achsen[x];
                  return <i key={x} className={s.exakt ? (s.sortWert != null && s.sortWert >= 4.5 ? "h" : s.sortWert != null && s.sortWert >= 3.5 ? "m" : "") : "nb"} title={`${ACHSEN_LABEL[x]}-Summe`}>{s.anzeige ?? "?"}</i>;
                })}
              </span>
              <FitZelle item={it} />
              <span className="re" title={it.marketability ? (it.marketability.exakt ? "Marketability für dein Team (gescoutet)" : `Marketability für dein Team als Stufe ${it.marketability.text}; Scouten schärft das Bild`) : "Marketing gilt in dieser Saison noch nicht"} data-testid="draft-marketability"><b className="t">{it.marketability ? it.marketability.text : "—"}</b></span>
              <span className={`re${teuer ? " zt" : ""}`}><b className="t">{de(it.marketValue ?? 0)}</b></span>
              <span className="re"><b className="t">{de(it.salary ?? 0)}</b></span>
              <span><span className={`gef g${Math.min(3, g)} t`}>{g ? `${g}×` : "–"}</span></span>
              <span className="ak">
                {gewaehlt ? (
                  <>
                    <button type="button" className="knopf klein" onClick={(e) => { e.stopPropagation(); k.profil(it.playerId); }} title="Profil öffnen (Enter oder nochmal klicken)" data-testid="draft-zeile-profil">Profil ›</button>
                    {teuer ? (
                      <span className="tag w" title="sprengt die Kasse samt Reserve für die Pflichtplätze">zu teuer</span>
                    ) : dran ? (
                      <button type="button" className="knopf klein haupt" data-testid="draft-picken" onClick={(e) => { e.stopPropagation(); void aktionen.pick(it.playerId, it.name); }} title="Draft-Vertrag: 1 Saison, Gehalt wie angezeigt, Ablöse = Marktwert">Picken</button>
                    ) : null}
                  </>
                ) : (
                  <>
                    {teuer ? <span className="tag w" title="sprengt die Kasse samt Reserve für die Pflichtplätze">zu teuer</span> : null}
                    <span className="hw">Klick wählt aus</span>
                  </>
                )}
              </span>
            </div>
          );
        })}
        {!k.feedBusy && !k.feedFehler && sichtbar.length === 0 ? <div className="drf-leerzeile">Keine Spieler für diese Filter.</div> : null}
      </div>
      {vorschau.karte}
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

export function MeinDraft({ k, aktionen, onAuslassen, onFertig, onSkip }: { k: DraftKontext; aktionen: DraftAktionen; onAuslassen: () => void; onFertig: () => void; onSkip: () => void }) {
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
  // Konkurrenz: KI-Teams vor mir, die ihn gerade in den Top 3 haben.
  const bis = mein.picksBisZug ?? 0;
  const konkurrenz =
    z && !mein.amZug
      ? a.naechste.slice(0, bis).filter((t) => t.art === "ki" && t.top3?.includes(z.item.playerId)).map((t) => ({ t, rang: (t.top3 ?? []).indexOf(z.item.playerId) + 1 }))
      : [];
  const disziplinNamen = officialDisciplineWeightLabels as Record<string, string>;
  // Mein Kader in der gewählten Disziplin: eigene Spieler exakt, der Ausgewählte (fremd) nach seiner Sicht (Nebel).
  const eigene: EigenerSpieler[] = k.meinKader.map((s) => ({ playerId: s.playerId, name: s.name, className: s.className, portraitUrl: k.portrait(s.playerId), wert: s.ratings?.[k.disziplin] ?? null }));
  const kandidatWert = z?.sicht.disziplinen[k.disziplin];
  const kandidat: KandidatEintrag | null =
    z && kandidatWert && kandidatWert.schaetzung != null
      ? { playerId: z.item.playerId, name: z.item.name, className: z.item.className, portraitUrl: bild, wert: kandidatWert.schaetzung, text: kandidatWert.text }
      : null;
  const wirkungen: RangWirkung[] = z && k.vorbereitung ? DISZIPLINEN.map((d) => wirkungMitKandidat(k.vorbereitung!, d, kandidatSpanne(z.sicht, d))) : [];
  const kasse = baueKasseDraft({ kasse: mein.kasse, ausgegeben: gepickt, reserve: mein.pflichtReserve, preis: z ? preis : null, maxAbloese: mein.maxAbloese });
  return (
    <section className="pan" id="l-ich" data-testid="draft-mein">
      {z ? (
        <div className="buehne-f klickbar" style={kulisse ? { backgroundImage: `url(${kulisse})` } : undefined} onClick={() => k.profil(z.item.playerId)} title="Profil öffnen" data-testid="draft-buehne">
          <span className="tag pf">Profil ›</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {figur ? <img className="fig" src={figur} alt="" /> : bild ? <img className="por" src={bild} alt="" /> : null}
          <div className="txt"><em>Ausgewählt · <KlassenFarbTag className={z.item.className} /> · {z.item.race}</em><h3>{z.item.name}</h3></div>
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
              {z.item.marketability ? (
                <div title="Marketability für dein Team (Fanprofil), Stufe nach Scouting; dieselbe Rechnung wie im Transfermarkt und auf der Seite Marketing" data-testid="draft-mein-marketability"><small>Marketability</small><strong className={`t${z.item.marketability.exakt ? "" : " nb"}`}>{z.item.marketability.text}</strong><em>{z.item.marketability.exakt ? "gescoutet" : "Stufe"}</em></div>
              ) : null}
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
                title="Draft-Vertrag: 1 Saison, Gehalt wie angezeigt, Ablöse = Marktwert"
                data-testid="draft-mein-picken"
              >
                {teuer
                  ? "Sprengt die Kasse samt Reserve"
                  : mein.darfPicken
                    ? `${z.item.name} picken · ${betragC(preis)}`
                    : `Ausgewählt · ${mein.picksBisZug != null && mein.picksBisZug > 0 ? `du bist in ${mein.picksBisZug} Picks dran` : "du bist nicht dran"}`}
              </button>
              <button type="button" className="knopf" title="Wunschliste" onClick={() => k.toggleWunsch(z.item)}>{k.wunsch.has(z.item.playerId) ? "★" : "☆"}</button>
            </div>
            <NichtPicken mein={mein} minKader={a.regeln.minKader} onAuslassen={onAuslassen} onFertig={onFertig} onSkip={onSkip} />
            {konkurrenz.length ? (
              <div className="hin a" data-testid="draft-konkurrenz"><b>Achtung:</b> {konkurrenz.map((x) => `${k.teamName(x.t.teamId)} (${x.rang}.)`).join(", ")} {konkurrenz.length > 1 ? "haben" : "hat"} ihn in den Top 3 und {konkurrenz.length > 1 ? "picken" : "pickt"} vor dir.</div>
            ) : null}
          </>
        ) : (
          <>
            <div className="hin">Ein Klick auf einen Spieler im Brett oder bei den Vorschlägen wählt ihn aus. Hier steht dann sein Preis und der Pick.</div>
            <NichtPicken mein={mein} minKader={a.regeln.minKader} onAuslassen={onAuslassen} onFertig={onFertig} onSkip={onSkip} />
          </>
        )}
        {z ? <WirkungAufKader wirkungen={wirkungen} namen={disziplinNamen} /> : null}
        <MeinKaderListe
          disziplinName={disziplinNamen[k.disziplin] ?? k.disziplin}
          eigene={eigene}
          kandidat={kandidat}
          kader={mein.kader}
          pflicht={a.regeln.minKader}
          wunsch={mein.kaderOpt ?? null}
          max={a.regeln.maxPicksJeTeam}
          onProfil={k.profil}
        />
        <KasseBlock kasse={kasse} hinweis="Reserve für Pflichtplätze eingerechnet" nachLabel="Pick" titelHinweis="Gehaltsbudget: in Saison 1 ohne Vorstandsdeckel (Finanzseite · Budgets). Der Draft prüft Kasse und Pflichtplätze; der Vorstandsrahmen gilt ab Saison 2." />
        <div className="autopick-zeile">
          <span title="An: bist du dran, pickt dein GM für dich.">Auto-Pick</span>
          <button type="button" className={`schalter${mein.autoPick ? " an" : ""}`} onClick={() => void aktionen.autoPick(!mein.autoPick)} title="An: bist du dran, pickt dein GM für dich." data-testid="draft-autopick">
            <i />
          </button>
        </div>
      </div>
    </section>
  );
}

