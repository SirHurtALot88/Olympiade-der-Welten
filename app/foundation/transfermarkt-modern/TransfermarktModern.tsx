"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";
import { figurPoseUrl, getFigurSpriteForPlayer } from "@/lib/data/figurenSprites";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import {
  baueLigaStaerken,
  bereiteTeamVor,
  hebtInDisziplinen,
  rangGegenLiga,
  wirkungMitKandidat,
  type KandidatRange,
  type RangWirkung,
  type StaerkeSpieler,
} from "@/lib/market/transfermarkt-kaderstaerke";
import {
  baueSpielerSicht,
  bauWege,
  erwartetePp,
  erwartetePpSpanne,
  MARKT_ACHSEN,
  sortiereNachSicht,
  type MarktAchse,
  type SpielerSicht,
} from "@/lib/market/transfermarkt-sicht";
import { officialDisciplineWeightLabels, officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";
import { getTransfermarktPortraitModel } from "@/lib/market/transfermarkt-lab";

import { bedarfUrteil, schnittVorkommen } from "@/lib/market/transfermarkt-disziplin-bedarf";
import { berechneFreigabeAnzeige, freigabeKosten, freigabeSperre } from "@/lib/market/transfermarkt-freigabe";

import { FoundationBandSlot } from "@/app/foundation/shell/foundation-band-slot";
import KlassenFarbTag from "@/app/foundation/KlassenFarbTag";
import WeitereFilterPanel from "./WeitereFilterPanel";
import {
  erfuelltFilter,
  LEERE_FILTER,
  mindestNoteLabel,
  naechsteMindestNote,
  zaehleAktiveFilter,
  type WeitereFilter,
} from "@/lib/market/transfermarkt-weitere-filter";
import KaderAnsichten from "./KaderAnsichten";
import VergleichDialog from "./VergleichDialog";
import VerhandlungsTisch from "./VerhandlungsTisch";
import { useMarktFeed } from "./tm-daten";
import { ATTRIBUT_LABEL_DE, betragC, begrenze, de, jeSpieltag, rangText } from "./tm-format";
import type { TransfermarktModernProps } from "./tm-typen";
import "./transfermarkt-modern.css";

export type { TransfermarktModernProps } from "./tm-typen";

type Ansicht = "markt" | "verkauf" | "vertraege" | "draft";
type SortKey = "eignung" | "hebt" | "abloese" | "gehalt" | "potenzial" | "value";
type Zeile = { item: TransfermarktFreeAgentItem; sicht: SpielerSicht };

const SEITE = 15;
const SORT_LABEL: Record<SortKey, string> = {
  eignung: "Eignung",
  hebt: "Rang-Wirkung",
  abloese: "Ablöse",
  gehalt: "Gehalt",
  potenzial: "Potenzial",
  value: "Value",
};
const ACHSEN_LABEL: Record<MarktAchse, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };
const DISZIPLINEN = [...officialDisciplineWeightOrder];

function rangGegenLigaFuer(staerken: Record<string, Record<string, number>>, teamId: string, disziplinId: string): number {
  return rangGegenLiga(staerken, teamId, disziplinId, staerken[teamId]?.[disziplinId] ?? 20);
}

function bildUrlVon(item: TransfermarktFreeAgentItem): string | null {
  return getTransfermarktPortraitModel(item).src;
}

function kandidatSpanne(sicht: SpielerSicht, disziplinId: string): KandidatRange | null {
  const wert = sicht.disziplinen[disziplinId];
  if (!wert || wert.schaetzung == null || wert.von == null || wert.bis == null) return null;
  return { von: wert.von, mitte: wert.schaetzung, bis: wert.bis };
}

function eignungText(sicht: SpielerSicht, disziplinId: string): string {
  const wert = sicht.disziplinen[disziplinId];
  return wert ? wert.text : "—";
}

function Stern({ an, onClick, titel }: { an: boolean; onClick: () => void; titel: string }) {
  return (
    <button type="button" className={`st${an ? " an" : ""}`} title={titel} aria-label={titel} aria-pressed={an} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      ★
    </button>
  );
}

function RangAnzeige({ w }: { w: RangWirkung }) {
  const klasse = w.nachherBest < w.vorher ? "auf" : w.nachherSchlecht > w.vorher ? "ab" : "gl";
  return (
    <span className="rg t" title="Kaderrang in der Liga: heute → mit ihm">
      <s>{w.vorher}.</s>
      <u>→</u>
      <b className={klasse}>{rangText(w.nachherBest, w.nachherSchlecht)}</b>
    </span>
  );
}

export default function TransfermarktModern(props: TransfermarktModernProps) {
  const {
    defaultSaveId,
    defaultSeasonId,
    teams,
    rosterRows = [],
    manageableTeamIds = [],
    source = "sqlite",
    transferWindow,
  } = props;
  const teamId = props.defaultTeamId ?? manageableTeamIds[0] ?? teams[0]?.teamId ?? "";
  const team = teams.find((t) => t.teamId === teamId) ?? null;
  const darfVerwalten = Boolean(teamId && manageableTeamIds.includes(teamId));
  const controlMode = props.teamControlModesByTeamId?.[teamId] ?? null;

  const nebelAus = props.nebelAus === true;
  // Die Seite füllt den Rest des Fensters: Höhe = Fensterhöhe minus Abstand von oben minus Rand (der Rahmen kann
  // wachsen). Gemessen statt geraten, damit nichts scrollt (2560x1440, 1920x1080, 1710x1112).
  const wurzelRef = useRef<HTMLDivElement | null>(null);
  const [hoehe, setHoehe] = useState<number | null>(null);
  useLayoutEffect(() => {
    function messen() {
      const el = wurzelRef.current;
      if (!el) return;
      const oben = el.getBoundingClientRect().top + window.scrollY;
      setHoehe(Math.max(420, Math.floor(window.innerHeight - oben - 28)));
    }
    messen();
    window.addEventListener("resize", messen);
    const t = window.setTimeout(messen, 600);
    return () => {
      window.removeEventListener("resize", messen);
      window.clearTimeout(t);
    };
  }, []);
  const [ansicht, setAnsicht] = useState<Ansicht>("markt");
  const [disziplin, setDisziplin] = useState<string>("hockey");
  const [suche, setSuche] = useState("");
  const verzoegerteSuche = useDeferredValue(suche);
  const [nurBezahlbar, setNurBezahlbar] = useState(false);
  const [nurHebt, setNurHebt] = useState(false);
  const [nurMerkliste, setNurMerkliste] = useState(false);
  const [filter, setFilter] = useState<WeitereFilter>(LEERE_FILTER);
  const [weitereOffen, setWeitereOffen] = useState(false);
  const [sortierung, setSortierung] = useState<SortKey>("eignung");
  const [blatt, setBlatt] = useState(0);
  const [fokusId, setFokusId] = useState<string | null>(props.initialPlayerId ?? null);
  const [pins, setPins] = useState<string[]>([]);
  const [dialog, setDialog] = useState<null | { art: "kauf" | "vergleich" | "verl"; id?: string }>(null);
  const [neuLaden, setNeuLaden] = useState(0);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [staerkeSort, setStaerkeSort] = useState<"liste" | "wichtigkeit">("wichtigkeit");

  const feed = useMarktFeed({
    saveId: defaultSaveId,
    seasonId: defaultSeasonId,
    teamId,
    source,
    bereit: props.bootstrapReady !== false,
    suche: verzoegerteSuche,
    neuLaden,
    roomContext: props.roomContext,
  });

  // Von außen geöffnete Deals (Hauptaktion im Kopf, Spieler-Drawer, Scouting): Fokus-Spieler + Angebots-Panel.
  useEffect(() => {
    if (props.initialPlayerId) {
      setFokusId(props.initialPlayerId);
      if (props.offerPanelActive) setDialog({ art: "kauf", id: props.initialPlayerId });
      props.onInitialPlayerFocusConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialPlayerId]);
  useEffect(() => {
    if (props.offerPanelActive && fokusId) setDialog((alt) => alt ?? { art: "kauf", id: fokusId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.offerPanelActive]);

  // ---------------------------------------------------------------- Kaderstärke
  const ligaTeamIds = useMemo(() => {
    const ids = new Set(props.leagueTeamIds && props.leagueTeamIds.length > 0 ? props.leagueTeamIds : teams.map((t) => t.teamId));
    if (teamId) ids.add(teamId);
    return [...ids];
  }, [props.leagueTeamIds, teams, teamId]);
  const verletzt = useMemo(() => new Set(props.injuredPlayerIds ?? []), [props.injuredPlayerIds]);
  const staerkeSpieler = useMemo<StaerkeSpieler[]>(
    () => rosterRows.map((r) => ({ playerId: r.playerId, teamId: r.teamId, ratings: r.disciplineRatings })),
    [rosterRows],
  );
  const staerken = useMemo(
    () => baueLigaStaerken({ spieler: staerkeSpieler, teamIds: ligaTeamIds, disziplinIds: DISZIPLINEN, ausgeschlossen: verletzt }),
    [staerkeSpieler, ligaTeamIds, verletzt],
  );
  const vorbereitung = useMemo(
    () => bereiteTeamVor({ spieler: staerkeSpieler, staerken, teamId, disziplinIds: DISZIPLINEN, ausgeschlossen: verletzt }),
    [staerkeSpieler, staerken, teamId, verletzt],
  );

  // ---------------------------------------------------------------- Zeilen (alles aus der SICHT)
  const zeilen = useMemo<Zeile[]>(() => feed.items.map((item) => ({ item, sicht: baueSpielerSicht(item, { nebelAus }) })), [feed.items, nebelAus]);
  const merkliste = useMemo(() => new Set(props.wishlistPlayerIds ?? []), [props.wishlistPlayerIds]);
  const cash = feed.teamContext?.teamCash ?? team?.cash ?? null;

  const wirkungJeZeile = useMemo(() => {
    const karte = new Map<string, RangWirkung>();
    for (const z of zeilen) karte.set(z.item.playerId, wirkungMitKandidat(vorbereitung, disziplin, kandidatSpanne(z.sicht, disziplin)));
    return karte;
  }, [zeilen, vorbereitung, disziplin]);

  const gefiltert = useMemo(() => {
    let liste = zeilen;
    if (nurBezahlbar && cash != null) liste = liste.filter((z) => (z.item.marketValue ?? Infinity) <= cash);
    if (nurHebt) liste = liste.filter((z) => {
      const w = wirkungJeZeile.get(z.item.playerId);
      return w ? w.nachherBest < w.vorher : false;
    });
    if (nurMerkliste) liste = liste.filter((z) => merkliste.has(z.item.playerId));
    if (zaehleAktiveFilter(filter) > 0) liste = liste.filter((z) => erfuelltFilter(z.item, z.sicht, filter));
    const schluessel = (z: Zeile): number | null => {
      switch (sortierung) {
        case "eignung": return z.sicht.disziplinen[disziplin]?.schaetzung ?? null;
        case "hebt": {
          const w = wirkungJeZeile.get(z.item.playerId);
          return w ? w.staerkeNachherMitte - w.staerkeVorher : null;
        }
        case "abloese": return z.item.marketValue;
        case "gehalt": return z.item.salary;
        case "potenzial": return z.item.potentialRange ? (z.item.potentialRange.min + z.item.potentialRange.max) / 2 : null;
        case "value": return z.item.marketValueSalaryRatio;
      }
    };
    const aufsteigend = sortierung === "abloese" || sortierung === "gehalt";
    return sortiereNachSicht(liste, schluessel, aufsteigend ? 1 : -1);
  }, [zeilen, nurBezahlbar, nurHebt, nurMerkliste, filter, sortierung, disziplin, cash, wirkungJeZeile, merkliste]);

  const aktiveWeitere = zaehleAktiveFilter(filter);
  const seiten = Math.max(1, Math.ceil(gefiltert.length / SEITE));
  const seite = begrenze(blatt, 0, seiten - 1);
  const sichtbar = gefiltert.slice(seite * SEITE, seite * SEITE + SEITE);
  const fokus = zeilen.find((z) => z.item.playerId === fokusId) ?? gefiltert[0] ?? null;

  function waehle(id: string, name: string) {
    setFokusId(id);
    props.onSelectCandidate?.(id, name);
  }
  function pinne(id: string) {
    setPins((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : alt.length >= 3 ? [...alt.slice(1), id] : [...alt, id]));
  }

  // ---------------------------------------------------------------- Geld
  const teamGehalt = feed.teamContext?.teamSalary ?? null;
  const kader = feed.teamContext?.rosterCount ?? null;
  const kaderMin = feed.teamContext?.playerMin ?? team?.rosterMinTarget ?? 8;
  const kaderLimit = team?.rosterLimit ?? feed.teamContext?.playerOpt ?? null;
  const freiePlaetze = kaderLimit != null && kader != null ? Math.max(0, kaderLimit - kader) : null;
  const freigabeAnzeige = useMemo(() => berechneFreigabeAnzeige(cash, props.freigabe), [cash, props.freigabe]);
  const bedarf = props.disziplinBedarf ?? {};
  const bedarfSchnitt = schnittVorkommen(bedarf);
  const fokusAblöse = fokus?.item.marketValue ?? null;
  const kannKaufen = Boolean(darfVerwalten && (transferWindow?.canBuy ?? true) && source === "sqlite");
  const kaufSperre = !darfVerwalten
    ? "Dieses Team ist nur zum Ansehen freigegeben."
    : !(transferWindow?.canBuy ?? true)
      ? `Transferfenster: ${transferWindow?.phaseLabel ?? "geschlossen"}. Gekauft wird im Kauffenster.`
      : source !== "sqlite"
        ? "Referenzmodus: kein Kauf möglich."
        : null;
  const freigabeFrei = freigabeAnzeige ? freigabeAnzeige.frei : null;
  const fokusKosten = fokus ? freigabeKosten(fokus.item.marketValue, fokus.item.salary) : 0;
  const fokusSperre = freigabeSperre(freigabeAnzeige, fokusKosten);
  const ueberKasse = freigabeFrei != null ? fokusSperre != null : fokusAblöse != null && cash != null && fokusAblöse > cash;

  const fokusWirkungen = useMemo<RangWirkung[]>(() => {
    if (!fokus) return [];
    return DISZIPLINEN.map((d) => wirkungMitKandidat(vorbereitung, d, kandidatSpanne(fokus.sicht, d)));
  }, [fokus, vorbereitung]);

  const disziplinNamen = officialDisciplineWeightLabels as Record<string, string>;
  const disziplinReihenfolge = useMemo(() => {
    if (staerkeSort === "liste") return DISZIPLINEN;
    return [...DISZIPLINEN].sort(
      (a, b) => (bedarf[b]?.wichtigkeit ?? 0) - (bedarf[a]?.wichtigkeit ?? 0) || DISZIPLINEN.indexOf(a) - DISZIPLINEN.indexOf(b),
    );
  }, [staerkeSort, bedarf]);
  const fokusBedarf = bedarfUrteil({
    eintrag: bedarf[disziplin],
    schnittVorkommen: bedarfSchnitt,
    rang: vorbereitung.staerken[teamId] ? rangGegenLigaFuer(vorbereitung.staerken, teamId, disziplin) : 1,
    ligaGroesse: ligaTeamIds.length,
  });
  const eigeneKaderStaerken = staerken[teamId] ?? {};

  function dialogDatenFuerKauf(z: Zeile) {
    const wirk = DISZIPLINEN.map((d) => wirkungMitKandidat(vorbereitung, d, kandidatSpanne(z.sicht, d)));
    const sprite = getFigurSpriteForPlayer(z.item.playerId);
    const pp = erwartetePpSpanne(z.sicht.disziplinen[disziplin]);
    return {
      wirk,
      figurUrl: sprite ? figurPoseUrl(sprite, "south") : null,
      text: `Eignung ${eignungText(z.sicht, disziplin)} in ${disziplinNamen[disziplin]}${pp ? ` · ≈ ${de(pp.mitte)} PP` : ""}`,
    };
  }

  const kulisse = einsatzlisteKulisseBild(disziplin);
  const frei = cash ?? 0;
  const vorschauAnteil = cash && fokusAblöse ? begrenze((Math.min(fokusAblöse, cash) / Math.max(cash, 1)) * 100, 0, 100) : 0;

  return (
    <div className="tmk" data-testid="transfermarkt-modern" ref={wurzelRef} style={hoehe != null ? ({ ["--tmk-hoehe" as string]: `${hoehe}px` } as React.CSSProperties) : undefined}>
      {/* Reiter und Fenster-Status wohnen im Seiten-Slot des Regierbands (App-Rahmen); die Seite hat keine eigene Kopfzeile. */}
      <FoundationBandSlot>
        <div className="tmk-bs" data-testid="tm-bandslot">
          <nav className="tmk-bs-reiter" aria-label="Transfermarkt-Ansichten">
            {(
              [
                ["markt", "Markt"],
                ["verkauf", "Verkauf"],
                ["vertraege", "Verträge"],
              ] as Array<[Ansicht, string]>
            ).map(([id, label]) => (
              <button key={id} type="button" className={ansicht === id ? "an" : ""} onClick={() => setAnsicht(id)} data-testid={`tm-reiter-${id}`}>
                {label}
              </button>
            ))}
            <button type="button" onClick={() => props.onOpenHistory?.()} data-testid="tm-reiter-historie">Historie</button>
            <button type="button" className={ansicht === "draft" ? "an" : ""} onClick={() => setAnsicht("draft")} data-testid="tm-reiter-draft">
              Draft <small>bald</small>
            </button>
          </nav>
          <div className="tmk-bs-fenster" data-testid="tm-fenster" title="Kauf und Verkauf teilen sich ein Transferfenster">
            <b className={transferWindow?.open === false ? "zu" : "auf"}>{transferWindow ? transferWindow.phaseLabel : "Transferfenster"}</b>
            <small>{transferWindow ? `Kauf ${transferWindow.canBuy ? "offen" : "zu"} · Verkauf ${transferWindow.canSell ? "offen" : "zu"}` : ""}</small>
          </div>
        </div>
      </FoundationBandSlot>
      {hinweis && (
        <div className="tmk-meldung" role="status" onClick={() => setHinweis(null)}>{hinweis}</div>
      )}

      {ansicht === "markt" && (
        <div className="mk" data-testid="tm-markt">
          <div className="sp2">
            <section className="pan" id="g-geld" aria-label="Geld und Freigabe">
              <div className="pk"><h2>Geld &amp; Freigabe</h2></div>
              <div className="gf">
                <div className="gross">
                  <strong className={`t ${(cash ?? 0) <= 0 ? "minus" : ""}`} data-testid="tm-frei">{freigabeAnzeige ? de(freigabeAnzeige.frei, 1) : de(Math.max(0, cash ?? 0), 1)} C</strong>
                  <small>{freigabeAnzeige ? "noch frei" : "Kontostand"}<br />{freigabeAnzeige ? <>von <b className="t">{betragC(freigabeAnzeige.kontostand)}</b> Kontostand</> : "Vorstand-Freigabe folgt mit Finanzen V2"}</small>
                </div>
                {freigabeAnzeige && (
                  <>
                    <div className="stapel" style={{ marginTop: "calc(.9 * var(--u))" }} data-testid="tm-freigabe-balken">
                      <i className="aus" style={{ width: `${(freigabeAnzeige.ausgegeben / Math.max(freigabeAnzeige.kontostand, 1)) * 100}%` }} />
                      <i className="frei" style={{ width: `${(freigabeAnzeige.frei / Math.max(freigabeAnzeige.kontostand, 1)) * 100}%` }} />
                      <i className="vor" style={{ width: `${(freigabeAnzeige.gesperrt / Math.max(freigabeAnzeige.kontostand, 1)) * 100}%` }} />
                      {vorschauAnteil > 0 && <span className="vsh" style={{ left: `${(freigabeAnzeige.ausgegeben / Math.max(freigabeAnzeige.kontostand, 1)) * 100}%`, width: `${vorschauAnteil}%` }} />}
                    </div>
                    <div className="leg"><span><i style={{ background: "var(--stumm)" }} />ausgegeben {de(freigabeAnzeige.ausgegeben)}</span><span><i style={{ background: "var(--gut)" }} />frei</span><span><i style={{ background: "var(--acht)" }} />gesperrt {de(freigabeAnzeige.gesperrt)}</span></div>
                    <div className={`vorst${freigabeAnzeige.quote >= 1 ? " ok" : freigabeAnzeige.quote < 0.6 ? " rot" : ""}`} data-testid="tm-freigabe">
                      <b>Vorstand gibt {Math.round(freigabeAnzeige.quote * 100)} % frei.</b>
                      <small>{freigabeAnzeige.grund ?? ""} Das Geld bleibt auf dem Konto, freigegeben ist nur der Anteil zum Ausgeben, für Ablöse und Gehälter. Die Sperre ist hart; Verkaufserlöse werden nur zu {Math.round(freigabeAnzeige.quote * 100)} % frei.</small>
                    </div>
                    {freigabeAnzeige.kaderpflicht ? <div className="vorst ok" data-testid="tm-kaderpflicht"><b>{freigabeAnzeige.kaderpflicht}</b></div> : null}
                    <div>
                      <div className="gz"><span>Kontostand</span><b className="t">{betragC(freigabeAnzeige.kontostand)}</b></div>
                      <div className="gz"><span>davon freigegeben</span><b className="t">{betragC(freigabeAnzeige.freigegeben)}</b></div>
                      <div className="gz"><span>schon ausgegeben</span><b className="t">{betragC(freigabeAnzeige.ausgegeben)}</b></div>
                      <div className="gz"><span>noch frei</span><b className="t plus">{betragC(freigabeAnzeige.frei)}</b></div>
                      <div className="gz"><span>gesperrt</span><b className="t acht">{betragC(freigabeAnzeige.gesperrt)}</b></div>
                    </div>
                  </>
                )}
                <div>
                  <div className="gz"><span>Gehalt je Saison</span><b className="t">{betragC(teamGehalt)}<small>{betragC(jeSpieltag(teamGehalt), 2)} je Spieltag</small></b></div>
                  <div className="gz"><span>Kader</span><b className="t">{kader ?? "—"}<small>Minimum {kaderMin}{freiePlaetze != null ? ` · ${freiePlaetze} Plätze frei` : ""}</small></b></div>
                </div>
              </div>
            </section>
            <section className="pan voll" id="g-stark" aria-label="Kaderstärke je Disziplin">
              <div className="pk"><h2>Kaderstärke</h2><span className="sp" />
                <button type="button" onClick={() => setStaerkeSort((v) => (v === "wichtigkeit" ? "liste" : "wichtigkeit"))} title="Sortierung der Disziplinen" data-testid="tm-staerke-sort">{staerkeSort === "wichtigkeit" ? "nach Wichtigkeit" : "Reihenfolge Matrix"}</button>
              </div>
              <div className="ks">
                <div className="kz kopf"><span title="Stärke = Ø der besten 6">Disziplin</span><span title="Auftritte in dieser Saison">Saison</span><span title="Einsatz-Slots je Auftritt">Slots</span><span /><span>Rang</span><span>{fokus ? "mit ihm" : ""}</span></div>
                {disziplinReihenfolge.map((d) => {
                  const w = fokusWirkungen.find((x) => x.disziplinId === d);
                  const v = eigeneKaderStaerken[d] ?? 20;
                  const vn = w?.staerkeNachherMitte ?? v;
                  const r = w?.vorher ?? 0;
                  const b = bedarf[d];
                  const u = bedarfUrteil({ eintrag: b, schnittVorkommen: bedarfSchnitt, rang: r, ligaGroesse: ligaTeamIds.length });
                  return (
                    <button type="button" key={d} className={`kz${d === disziplin ? " an" : ""}`} onClick={() => { setDisziplin(d); setBlatt(0); }} title={`${disziplinNamen[d]}: ${u.text}. Markt nach ${disziplinNamen[d]} ausrichten`} data-testid={`tm-disziplin-${d}`}>
                      <span className="n"><i className={`bd ${u.art}`} />{disziplinNamen[d]}</span>
                      <span className="t sz">{b ? `${b.vorkommen}×` : "–"}</span>
                      <span className="t sz">{b?.slots ?? "–"}</span>
                      <span className="bal"><i className="z" style={{ width: `${begrenze(vn - 20, 0, 70) / 0.7}%` }} /><i style={{ width: `${begrenze(v - 20, 0, 70) / 0.7}%` }} /></span>
                      <span className={`r t ${r <= 4 ? "gutr" : r >= 12 ? "schl" : ""}`}>{r}.</span>
                      <span className={`w t ${w && w.nachherBest < w.vorher ? "auf" : w && w.nachherSchlecht > w.vorher ? "ab" : "gl"}`}>
                        {w && fokus ? (w.nachherBest < w.vorher ? `▲ ${rangText(w.nachherBest, w.nachherSchlecht)}` : w.nachherSchlecht > w.vorher ? `▼ ${rangText(w.nachherBest, w.nachherSchlecht)}` : "·") : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mfuss" data-testid="tm-bedarf-hinweis">
                <span><b>{disziplinNamen[disziplin]}</b>: {bedarf[disziplin] ? `${bedarf[disziplin].vorkommen}× in dieser Saison, ${bedarf[disziplin].slots ?? "?"} Slots` : "nicht im Spielplan"} · Rang {fokusWirkungen.find((x) => x.disziplinId === disziplin)?.vorher ?? "–"}. {fokusBedarf.text}</span>
              </div>
            </section>
          </div>

          <section className="pan" id="m-liste" aria-label="Markt">
            <div className="fl">
              <input placeholder="Name, Klasse, Rasse" value={suche} onChange={(e) => { setSuche(e.target.value); setBlatt(0); }} aria-label="Suche" data-testid="tm-suche" />
              <span className="diszi" title={fokusBedarf.text}><small>Disziplin</small>{disziplinNamen[disziplin]}<small style={{ color: "var(--leise)" }}>{bedarf[disziplin] ? `${bedarf[disziplin].vorkommen}× · ${bedarf[disziplin].slots ?? "?"} Slots` : ""}</small></span>
              <button type="button" className={`fc${nurBezahlbar ? " an" : ""}`} onClick={() => { setNurBezahlbar((v) => !v); setBlatt(0); }}>bezahlbar</button>
              <button type="button" className={`fc${nurHebt ? " an" : ""}`} onClick={() => { setNurHebt((v) => !v); setBlatt(0); }} title="Könnte den Kaderrang heben (obere Grenze der sichtbaren Spanne)">kann meinen Rang heben</button>
              <button type="button" className={`fc${nurMerkliste ? " an" : ""}`} onClick={() => { setNurMerkliste((v) => !v); setBlatt(0); }}>★ Merkliste</button>
              <span className="sp" />
              <button type="button" className="knopf klein" onClick={() => setDialog({ art: "vergleich" })} disabled={pins.length < 1} data-testid="tm-vergleich-oeffnen">Vergleich ({pins.length})</button>
            </div>
            <div className="fl">
              <span className="gk">Achse mind.</span>
              {MARKT_ACHSEN.map((a) => {
                const min = filter.achsenMin[a];
                return (
                  <button
                    type="button"
                    key={a}
                    className={`fc${min != null ? " an" : ""}`}
                    data-testid={`tm-achse-${a}`}
                    title="Klick: mindestens B, dann A, dann S, dann aus. Im Nebel zählt die obere Note der Gruppe."
                    onClick={() => {
                      setFilter((alt) => {
                        const achsenMin = { ...alt.achsenMin };
                        const next = naechsteMindestNote(achsenMin[a]);
                        if (next == null) delete achsenMin[a];
                        else achsenMin[a] = next;
                        return { ...alt, achsenMin };
                      });
                      setBlatt(0);
                    }}
                  >
                    {ACHSEN_LABEL[a]}{min != null ? ` ≥ ${mindestNoteLabel(min)}` : ""}
                  </button>
                );
              })}
              <button type="button" className={`fc${weitereOffen || aktiveWeitere > 0 ? " an" : ""}`} onClick={() => setWeitereOffen((v) => !v)} aria-expanded={weitereOffen} data-testid="tm-weitere-filter">
                Weitere Filter{aktiveWeitere > 0 ? ` · ${aktiveWeitere}` : ""} {weitereOffen ? "▾" : "▸"}
              </button>
              <span className="gk">Sortierung</span>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <button type="button" key={k} className={`fc${sortierung === k ? " an" : ""}`} onClick={() => { setSortierung(k); setBlatt(0); }} data-testid={`tm-sort-${k}`}>{SORT_LABEL[k]}</button>
              ))}
              <span className="sp" />
              <button type="button" className="fc" onClick={() => { setSuche(""); setNurBezahlbar(false); setNurHebt(false); setNurMerkliste(false); setFilter(LEERE_FILTER); setSortierung("eignung"); setBlatt(0); }}>Filter zurücksetzen</button>
            </div>
            {weitereOffen ? <WeitereFilterPanel filter={filter} onChange={(f) => { setFilter(f); setBlatt(0); }} /> : null}
            <div className="mt" style={{ ["--zeilen" as string]: SEITE }} data-testid="tm-tabelle">
              <div className="mz kopf">
                <span /><span />
                <span>Spieler · Weg in {disziplinNamen[disziplin]}</span>
                <span className={sortierung === "eignung" ? "so" : ""}>Eignung</span>
                <span style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", textAlign: "center" }}>{MARKT_ACHSEN.map((a) => <i key={a} style={{ fontStyle: "normal" }}>{ACHSEN_LABEL[a]}</i>)}</span>
                <span title="erwartete Player Points je Einsatz (Näherung aus der Eignung)">≈ PP</span>
                <span className={`re ${sortierung === "abloese" ? "so" : ""}`}>Ablöse</span>
                <span className={`re ${sortierung === "gehalt" ? "so" : ""}`}>Gehalt/Saison</span>
                <span className={sortierung === "hebt" ? "so" : ""}>Kaderrang</span>
                <span />
              </div>
              {feed.busy && sichtbar.length === 0 && <div className="tmk-leer">Transfermarkt wird geladen …</div>}
              {feed.fehler && <div className="tmk-leer w">{feed.fehler}</div>}
              {!feed.busy && !feed.fehler && sichtbar.length === 0 && <div className="tmk-leer">Keine Spieler für diese Filter.</div>}
              {sichtbar.map((z) => {
                const it = z.item;
                const wert = z.sicht.disziplinen[disziplin];
                const w = wirkungJeZeile.get(it.playerId)!;
                const wege = bauWege(z.sicht, disziplin);
                const pp = erwartetePpSpanne(wert);
                const teuer = cash != null && it.marketValue != null && it.marketValue > cash;
                const bild = bildUrlVon(it);
                return (
                  <div key={it.playerId} className={`mz${fokus?.item.playerId === it.playerId ? " an" : ""}`} onClick={() => waehle(it.playerId, it.name)} data-testid="tm-zeile" data-player-id={it.playerId}>
                    <Stern an={merkliste.has(it.playerId)} titel="Merkliste" onClick={() => props.onToggleWishlist?.(it)} />
                    {bild ? <img className="por" src={bild} alt="" loading="lazy" /> : <span className="por" />}
                    <span className="nm">
                      <b>{it.name}</b>
                      <small><KlassenFarbTag className={it.className} /> · {it.race} <span className={`tag ${wege.urteil.art === "primaer" ? "g" : wege.urteil.art === "neben" ? "go" : wege.urteil.art === "kein" ? "w" : ""}`} title={wege.urteil.text}>{wege.urteil.titel}</span></small>
                    </span>
                    <span className="eg" title={wert ? (wert.exakt ? "Eignung (gescoutet)" : `Eignung als Stufe ${wert.text} (Scouting-Stufe ${z.sicht.stufe}); Scouten schärft das Bild`) : "unbekannt"}>
                      <b className="t">{eignungText(z.sicht, disziplin)}</b>
                      <span className="bal">
                        {wert && wert.von != null && wert.bis != null && !wert.exakt ? <u style={{ left: `${wert.von}%`, width: `${wert.bis - wert.von + 1}%` }} /> : <i style={{ width: `${wert?.schaetzung ?? 0}%` }} />}
                      </span>
                    </span>
                    <span className="ax t">
                      {MARKT_ACHSEN.map((a) => {
                        const s = z.sicht.achsen[a];
                        return <i key={a} className={s.sortWert != null && s.sortWert >= 4.5 ? "h" : s.sortWert != null && s.sortWert >= 3.5 ? "m" : ""} title={s.exakt ? "Note (beobachtet/gescoutet)" : "Zweier-Gruppe (ungescoutet)"}>{s.anzeige ?? "?"}</i>;
                      })}
                    </span>
                    <span className="ppz t" title="erwartete Player Points je Einsatz, grobe Näherung aus der Eignungs-Stufe">{pp ? pp.text : "—"}</span>
                    <span className={`re ${teuer ? "zt" : ""}`} title={teuer ? "über deiner Kasse" : ""}><b className="t">{de(it.marketValue ?? 0, 1)}</b></span>
                    <span className="re"><b className="t">{de(it.salary ?? 0, 1)}</b><small style={{ display: "block", color: "var(--stumm)", fontSize: "calc(.7 * var(--u))" }}>{de(jeSpieltag(it.salary) ?? 0, 2)}/Spieltag</small></span>
                    <RangAnzeige w={w} />
                    <button type="button" className={`pinb pin${pins.includes(it.playerId) ? " an" : ""}`} onClick={(e) => { e.stopPropagation(); pinne(it.playerId); }} title="Zum Vergleich anheften">{pins.includes(it.playerId) ? "drin" : "Vgl."}</button>
                  </div>
                );
              })}
            </div>
            <div className="mfuss">
              <span><b className="t" style={{ color: "var(--tinte)" }}>{gefiltert.length}</b> von {feed.total} Spielern{feed.nachladen ? " · lädt weiter …" : ""}</span>
              <span>Fremde Werte stehen als Stufen: 10er ungescoutet, 5er beobachtet, exakt erst gescoutet</span>
              <span className="sp" />
              {seiten > 1 && (
                <>
                  <button type="button" onClick={() => setBlatt(seite - 1)} disabled={seite === 0} aria-label="Vorheriges Blatt">‹</button>
                  <span className="t">Blatt {seite + 1} / {seiten}</span>
                  <button type="button" onClick={() => setBlatt(seite + 1)} disabled={seite >= seiten - 1} aria-label="Nächstes Blatt">›</button>
                </>
              )}
            </div>
          </section>

          <section className="pan" id="m-fokus" aria-label="Gewählter Spieler" data-testid="tm-fokus">
            {fokus ? (
              <FokusSpieler
                z={fokus}
                disziplin={disziplin}
                disziplinNamen={disziplinNamen}
                kulisse={kulisse}
                wirkungen={fokusWirkungen}
                cash={cash}
                ueberKasse={ueberKasse}
                freigabeSperre={fokusSperre}
                freigabeAktiv={freigabeAnzeige != null}
                nebelAus={nebelAus}
                kaufSperre={kaufSperre}
                kannKaufen={kannKaufen}
                gemerkt={merkliste.has(fokus.item.playerId)}
                angeheftet={pins.includes(fokus.item.playerId)}
                onDisziplin={(d) => { setDisziplin(d); setBlatt(0); }}
                onVerhandeln={() => { props.onSelectCandidate?.(fokus.item.playerId, fokus.item.name); props.onOpenOfferPanel?.(fokus.item.playerId); setDialog({ art: "kauf", id: fokus.item.playerId }); }}
                onVergleichen={() => pinne(fokus.item.playerId)}
                onErstVerkaufen={() => setAnsicht("verkauf")}
                onDetails={() => props.onOpenPlayerDetails?.({ playerId: fokus.item.playerId })}
                onMerken={() => props.onToggleWishlist?.(fokus.item)}
              />
            ) : (
              <div className="tmk-leer">Wähle einen Spieler in der Liste.</div>
            )}
          </section>
        </div>
      )}

      {(ansicht === "verkauf" || ansicht === "vertraege") && (
        <KaderAnsichten
          modus={ansicht === "verkauf" ? "verkauf" : "vertrag"}
          {...{
            saveId: defaultSaveId,
            seasonId: defaultSeasonId,
            teamId,
            source,
            controlMode,
            roomContext: props.roomContext,
          }}
          teamKuerzel={team?.shortCode ?? ""}
          rosterRows={rosterRows.filter((r) => r.teamId === teamId)}
          spieler={staerkeSpieler}
          staerken={staerken}
          verletzt={verletzt}
          disziplinNamen={disziplinNamen}
          disziplinIds={DISZIPLINEN}
          playerRatingsById={props.playerRatingsById}
          cash={cash}
          teamGehalt={teamGehalt}
          kaderMin={kaderMin}
          freigabeQuote={props.freigabe?.quote ?? null}
          darfVerwalten={darfVerwalten}
          kannVerkaufen={Boolean(darfVerwalten && (transferWindow?.canSell ?? true))}
          verkaufSperre={!darfVerwalten ? "Dieses Team ist nur zum Ansehen freigegeben." : !(transferWindow?.canSell ?? true) ? `Transferfenster: ${transferWindow?.phaseLabel ?? "geschlossen"}.` : null}
          onVerlaengern={(playerId) => setDialog({ art: "verl", id: playerId })}
          onFertig={async (art, text) => {
            setHinweis(text);
            if (art === "verkauf") await props.onSellCompleted?.({ teamId });
            else await props.onRenewCompleted?.({ teamId });
            setNeuLaden((n) => n + 1);
          }}
        />
      )}

      {ansicht === "draft" && (
        <div className="tmk-draft" data-testid="tm-draft-platzhalter">
          <h2>Draft</h2>
          <p>Der Draft bekommt eine eigene Ansicht (Runden, Pick-Kette, Verhandlung im Draft). Bis dahin läuft er wie bisher über die Wunschliste und den Kauf im Markt.</p>
          <button type="button" className="knopf haupt" onClick={() => (props.onOpenDraft ? props.onOpenDraft() : setAnsicht("markt"))}>Zum Markt (heutiger Draft-Weg)</button>
        </div>
      )}

      {dialog?.art === "kauf" && (() => {
        const z = zeilen.find((x) => x.item.playerId === dialog.id);
        if (!z) return null;
        const d = dialogDatenFuerKauf(z);
        return (
          <VerhandlungsTisch
            modus="kauf"
            saveId={defaultSaveId}
            seasonId={defaultSeasonId}
            teamId={teamId}
            teamKuerzel={team?.shortCode ?? ""}
            source={source}
            controlMode={controlMode}
            roomContext={props.roomContext}
            playerId={z.item.playerId}
            name={z.item.name}
            klasse={z.item.className}
            rasse={z.item.race}
            bildUrl={bildUrlVon(z.item)}
            figurUrl={d.figurUrl}
            kulisseUrl={kulisse}
            disziplinName={disziplinNamen[disziplin]}
            eignungText={d.text}
            wirkungen={d.wirk}
            disziplinNamen={disziplinNamen}
            cash={cash}
            teamGehalt={teamGehalt}
            kader={kader}
            kaderMin={kaderMin}
            gesperrtGrund={kaufSperre ?? (z.item.marketValue != null && cash != null && z.item.marketValue > cash ? "Die Kasse reicht nicht für diese Ablöse. Erst verkaufen, dann verhandeln." : null)}
            freigabeFrei={freigabeFrei}
            onErstVerkaufen={() => { setDialog(null); setAnsicht("verkauf"); }}
            onSchliessen={() => { setDialog(null); props.onCloseOfferPanel?.(); }}
            onAbgeschlossen={async ({ gameStateAfter }) => {
              setDialog(null);
              props.onCloseOfferPanel?.();
              setHinweis(`${z.item.name} ist verpflichtet.`);
              await props.onBuyCompleted?.({ teamId, gameStateAfter });
              setFokusId(null);
              setNeuLaden((n) => n + 1);
            }}
          />
        );
      })()}

      {dialog?.art === "verl" && (() => {
        const reihe = rosterRows.find((r) => r.playerId === dialog.id && r.teamId === teamId);
        if (!reihe) return null;
        return (
          <VerhandlungsTisch
            modus="verl"
            saveId={defaultSaveId}
            seasonId={defaultSeasonId}
            teamId={teamId}
            teamKuerzel={team?.shortCode ?? ""}
            source={source}
            controlMode={controlMode}
            roomContext={props.roomContext}
            playerId={reihe.playerId}
            name={reihe.name}
            klasse={reihe.className}
            rasse={reihe.race ?? ""}
            bildUrl={reihe.portraitUrl ?? null}
            figurUrl={(() => { const s = getFigurSpriteForPlayer(reihe.playerId); return s ? figurPoseUrl(s, "south") : null; })()}
            kulisseUrl={kulisse}
            disziplinName={disziplinNamen[disziplin]}
            eignungText={null}
            wirkungen={DISZIPLINEN.map((d) => wirkungMitKandidat(vorbereitung, d, null))}
            disziplinNamen={disziplinNamen}
            cash={cash}
            teamGehalt={teamGehalt}
            kader={kader}
            kaderMin={kaderMin}
            aktuellesGehalt={reihe.salary}
            gesperrtGrund={null}
            freigabeFrei={freigabeFrei}
            onSchliessen={() => setDialog(null)}
            onAbgeschlossen={async () => {
              setDialog(null);
              setHinweis(`${reihe.name}: Vertrag verlängert.`);
              await props.onRenewCompleted?.({ teamId });
              setNeuLaden((n) => n + 1);
            }}
          />
        );
      })()}

      {dialog?.art === "vergleich" && (
        <VergleichDialog
          zeilen={pins.map((id) => zeilen.find((z) => z.item.playerId === id)).filter((z): z is Zeile => Boolean(z))}
          disziplinIds={DISZIPLINEN}
          disziplinNamen={disziplinNamen}
          vorbereitung={vorbereitung}
          disziplin={disziplin}
          kulisse={kulisse}
          cash={cash}
          onEntfernen={(id) => setPins((alt) => alt.filter((x) => x !== id))}
          onVerhandeln={(id) => { setFokusId(id); setDialog({ art: "kauf", id }); }}
          onSchliessen={() => setDialog(null)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

function FokusSpieler(props: {
  z: Zeile;
  disziplin: string;
  disziplinNamen: Record<string, string>;
  kulisse: string | null;
  wirkungen: RangWirkung[];
  cash: number | null;
  ueberKasse: boolean;
  freigabeSperre: string | null;
  freigabeAktiv: boolean;
  nebelAus: boolean;
  kaufSperre: string | null;
  kannKaufen: boolean;
  gemerkt: boolean;
  angeheftet: boolean;
  onDisziplin: (d: string) => void;
  onVerhandeln: () => void;
  onVergleichen: () => void;
  onErstVerkaufen: () => void;
  onDetails: () => void;
  onMerken: () => void;
}) {
  const { z, disziplin, disziplinNamen } = props;
  const it = z.item;
  const sprite = getFigurSpriteForPlayer(it.playerId);
  const bild = bildUrlVon(it);
  const wert = z.sicht.disziplinen[disziplin];
  const wege = bauWege(z.sicht, disziplin);
  const pp = erwartetePpSpanne(wert);
  const spruenge = [...props.wirkungen]
    .filter((w) => w.nachherBest < w.vorher)
    .sort((a, b) => b.vorher - b.nachherBest - (a.vorher - a.nachherBest))
    .slice(0, 3);
  const top3 = Object.entries(z.sicht.disziplinen)
    .sort((a, b) => (b[1].schaetzung ?? 0) - (a[1].schaetzung ?? 0))
    .slice(0, 3)
    .map(([id]) => id);
  const potenzial = it.potentialRange ? `${it.potentialRange.min}–${it.potentialRange.max}` : "—";

  return (
    <>
      <div className="buehne-f" style={props.kulisse ? { backgroundImage: `url(${props.kulisse})` } : undefined}>
        {sprite ? <img className="fig" src={figurPoseUrl(sprite, "south")} alt="" /> : bild ? <img className="por" src={bild} alt="" /> : null}
        <div className="ov">
          {props.nebelAus ? <span className="tag go">Nebel aus (Test)</span> : (it.scoutingLevel ?? 0) >= 5 ? <span className="tag g">voll gescoutet</span> : (it.scoutingLevel ?? 0) === 0 ? <span className="tag a">ungescoutet · Nebel</span> : <span className="tag a">teilweise gescoutet · Stufe {it.scoutingLevel}</span>}
          {props.gemerkt && <span className="tag go">★ Merkliste</span>}
        </div>
        <div className="gr"><strong className="t">{potenzial}</strong><small>Potenzial (Spanne)</small></div>
        <div className="txt"><em>{it.className} · {it.race}</em><h3>{it.name}</h3></div>
      </div>
      <div className="fb">
        <h4>Eignung in 20 Disziplinen <span style={{ marginLeft: "auto", color: "var(--stumm)" }}>Klick wählt die Disziplin · Stufen</span></h4>
        <div className="d20">
          {officialDisciplineWeightOrder.map((d) => {
            const w = z.sicht.disziplinen[d];
            return (
              <button type="button" key={d} className={d === disziplin ? "an" : top3.includes(d) ? "top" : ""} onClick={() => props.onDisziplin(d)} title={`${disziplinNamen[d]} ${w ? w.text : "?"}`}>
                <i style={{ height: `${w?.schaetzung ?? 0}%` }} />
              </button>
            );
          })}
        </div>
        <h4>Wege zum Erfolg in <b>{disziplinNamen[disziplin]}</b></h4>
        <div data-testid="tm-wege">
          {wege.zeilen.map((r, i) => (
            <div key={r.attribut} className={`weg${i === 0 ? " pri" : ""}`}>
              <span>{ATTRIBUT_LABEL_DE[r.attribut] ?? r.attribut}</span>
              <small className="t">{r.gewicht} %</small>
              <span className="bal"><i className={(r.sicht?.prozent ?? 0) >= 62 ? "gutw" : (r.sicht?.prozent ?? 0) >= 45 ? "mit" : "schw"} style={{ width: `${r.sicht?.prozent ?? 0}%` }} /></span>
              <b className="t">{r.sicht?.anzeige ?? "?"}</b>
            </div>
          ))}
        </div>
        <div className="wegurteil"><span className={`tag ${wege.urteil.art === "primaer" ? "g" : wege.urteil.art === "neben" ? "go" : wege.urteil.art === "kein" ? "w" : ""}`}>{wege.urteil.titel}</span> {wege.urteil.text}</div>
        <h4>Wirkung auf deinen Kader <span style={{ marginLeft: "auto", color: "var(--stumm)" }}>könnte {hebtInDisziplinen(props.wirkungen)} von 20 Disziplinen heben</span></h4>
        <div className="wirk">
          {spruenge.length > 0 ? (
            spruenge.map((w) => (
              <div key={w.disziplinId}><b>{disziplinNamen[w.disziplinId]}</b>Rang <RangAnzeige w={w} /></div>
            ))
          ) : (
            <div style={{ gridColumn: "1 / 4" }}>Kein Rang ändert sich (auch im besten Fall nicht).</div>
          )}
        </div>
        <h4>Charakter</h4>
        <div className="rw">
          <div><span>Stärken</span><b style={{ fontWeight: 600 }}>{it.traitsPositive.length > 0 ? it.traitsPositive.join(", ") : it.hiddenPositiveTraitCount > 0 ? `${it.hiddenPositiveTraitCount} verdeckt` : "keine"}</b></div>
          <div><span>Schwächen</span><b style={{ fontWeight: 600 }} className={it.traitsNegative.length ? "minus" : ""}>{it.traitsNegative.length > 0 ? it.traitsNegative.join(", ") : it.hiddenNegativeTraitCount > 0 ? "verdeckt · scouten" : "keine"}</b></div>
        </div>
        <div className="kost">
          <div><small>Ablöse</small><strong className={`t ${props.ueberKasse ? "minus" : ""}`}>{de(it.marketValue ?? 0, 1)} C</strong><em>fest = Marktwert</em></div>
          <div><small>Forderung</small><strong className="t">{de(it.salary ?? 0, 1)} C</strong><em>je Saison · {de(jeSpieltag(it.salary) ?? 0, 2)} C je Spieltag</em></div>
          <div><small>≈ PP</small><strong className="t">{pp ? pp.text.replace("≈ ", "") : "—"}</strong><em>je Einsatz in {disziplinNamen[disziplin]} · Näherung</em></div>
        </div>
        {props.kaufSperre ? <div className="hin w">{props.kaufSperre}</div> : props.freigabeSperre ? <div className="hin w"><b>Gesperrt:</b> {props.freigabeSperre} Verkaufserlöse werden nur zur Quote frei.</div> : props.ueberKasse ? <div className="hin w"><b>Über deiner Kasse:</b> es fehlen {betragC((it.marketValue ?? 0) - (props.cash ?? 0))}.</div> : <div className="hin">{props.freigabeAktiv ? "Passt in die Freigabe." : "Passt in die Kasse."}</div>}
        <div className="akt">
          <button type="button" className={`knopf haupt${props.kannKaufen ? "" : " zu"}`} disabled={!props.kannKaufen} onClick={props.onVerhandeln} data-testid="tm-verhandeln-oeffnen">Verhandeln</button>
          {props.ueberKasse && <button type="button" className="knopf" onClick={props.onErstVerkaufen}>Erst verkaufen</button>}
          <button type="button" className="knopf" onClick={props.onVergleichen}>{props.angeheftet ? "Angeheftet" : "Vergleichen"}</button>
          <button type="button" className="knopf" onClick={props.onMerken}>{props.gemerkt ? "★ entfernen" : "★ merken"}</button>
          <button type="button" className="knopf" onClick={props.onDetails}>Profil</button>
        </div>
      </div>
    </>
  );
}
