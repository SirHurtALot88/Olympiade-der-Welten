"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";
import { figurPoseUrl, getFigurSpriteForPlayer } from "@/lib/data/figurenSprites";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import {
  baueLigaStaerken,
  bereiteTeamVor,
  rangGegenLiga,
  wirkungMitKandidat,
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
import { officialDisciplineWeightLabels } from "@/lib/player-generator/official-discipline-weights";
import { getTransfermarktPortraitModel } from "@/lib/market/transfermarkt-lab";

import { bedarfUrteil, ersterAuftritt, schnittVorkommen, slotsKurz, spielplanKurz, spielplanLang } from "@/lib/market/transfermarkt-disziplin-bedarf";
import { berechneFreigabeAnzeige, freigabeKosten, freigabeSperre } from "@/lib/market/transfermarkt-freigabe";

import { FoundationBandSlot } from "@/app/foundation/shell/foundation-band-slot";
import { achseDerDisziplin, ACHSEN_FARBE_HEX, DISZIPLINEN_GEORDNET } from "@/lib/market/disziplin-reihenfolge";
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
import { klickAuswahlOderProfil, nameKlickAuswahlUndProfil, useListenTasten } from "@/app/foundation/shared/klickregel";
import { KasseBlock, MeinKaderListe, WirkungAufKader } from "@/app/foundation/shared/MeinKaderPanel";
import { baueKasseMarkt, kandidatSpanne, type EigenerSpieler, type KandidatEintrag, type KasseAnsicht } from "@/app/foundation/shared/mein-kader-daten";
import { usePortraetVorschau, type VorschauDaten } from "@/app/foundation/shared/PortraetVorschau";
import SpaltenGriff from "@/app/foundation/shared/SpaltenGriff";
import { useSpaltenLayout, type SpaltenDef } from "@/app/foundation/shared/spalten-layout";
import { GrossesProfil } from "@/app/foundation/shared/GrossesProfil";
import KaderAnsichten from "./KaderAnsichten";
import VergleichDialog from "./VergleichDialog";
import VerhandlungsTisch from "./VerhandlungsTisch";
import { useMarktFeed } from "./tm-daten";
import { betragC, begrenze, de, jeSpieltag, rangText } from "./tm-format";
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
const DISZIPLINEN = [...DISZIPLINEN_GEORDNET] as string[];
/** Sortierung der Kaderstärke-Liste: Wichtigkeit, Reihenfolge im Spielplan (Chris, 19.11.) oder feste Matrix-Reihenfolge. */
type StaerkeSort = "wichtigkeit" | "spielplan" | "liste";
const STAERKE_SORTEN: Array<{ id: StaerkeSort; text: string; titel: string }> = [
  { id: "wichtigkeit", text: "Wichtigkeit", titel: "Wichtigste zuerst (Auftritte × Slots)" },
  { id: "spielplan", text: "Spielplan", titel: "In der Reihenfolge, in der die Disziplinen in dieser Saison drankommen" },
  { id: "liste", text: "Matrix", titel: "Feste Reihenfolge nach Achsen (POW, SPE, MEN, SOC)" },
];
/** Mehr als 6 Einsatz-Slots je Disziplin gibt es nicht; 6 = Balken voll. */
const SLOTS_MAX = 6;

/** Spalten der Markt-Liste (Breiten in u); per Ziehen anpassbar und je Benutzer gespeichert (Chris 19.11.). */
export const TM_SPALTEN: SpaltenDef[] = [
  { id: "stern", standard: 1.3, min: 1.3, max: 1.3, fest: true },
  { id: "por", standard: 2.3, min: 1.6, max: 9 },
  { id: "nm", standard: 8, min: 5, max: 24, flex: true },
  { id: "eg", standard: 6.6, min: 4.5, max: 12 },
  { id: "ax", standard: 11.5, min: 8, max: 20 },
  { id: "abl", standard: 3.6, min: 2.8, max: 9 },
  { id: "geh", standard: 4.6, min: 3.6, max: 10 },
  { id: "rang", standard: 5.2, min: 4, max: 10 },
  { id: "ak", standard: 3.2, min: 3.2, max: 14 },
];
const TM_DEF = Object.fromEntries(TM_SPALTEN.map((d) => [d.id, d]));

function rangGegenLigaFuer(staerken: Record<string, Record<string, number>>, teamId: string, disziplinId: string): number {
  return rangGegenLiga(staerken, teamId, disziplinId, staerken[teamId]?.[disziplinId] ?? 20);
}

function bildUrlVon(item: TransfermarktFreeAgentItem): string | null {
  return getTransfermarktPortraitModel(item).src;
}

function eignungText(sicht: SpielerSicht, disziplinId: string): string {
  const wert = sicht.disziplinen[disziplinId];
  return wert ? wert.text : "—";
}

function vorschauDaten(it: TransfermarktFreeAgentItem, sicht: SpielerSicht, bild: string | null): VorschauDaten {
  return {
    bild,
    name: it.name,
    klasse: it.className,
    rasse: it.race,
    achsen: MARKT_ACHSEN.map((a) => {
      const s = sicht.achsen[a];
      return { label: ACHSEN_LABEL[a], anzeige: s.anzeige, exakt: s.exakt, stufe: s.sortWert != null && s.sortWert >= 4.5 ? "h" : s.sortWert != null && s.sortWert >= 3.5 ? "m" : "" };
    }),
  };
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
  const spalten = useSpaltenLayout("transfermarkt", TM_SPALTEN);
  const vorschau = usePortraetVorschau();
  const griff = (id: string) => <SpaltenGriff layout={spalten} def={TM_DEF[id]} />;
  const [sortierung, setSortierung] = useState<SortKey>("eignung");
  // Chris 19.11.: Spaltenköpfe sortieren wieder; ein zweiter Klick auf dieselbe Spalte dreht die Richtung um.
  const [umgekehrt, setUmgekehrt] = useState(false);
  const sortiereNach = (k: SortKey) => {
    if (k === sortierung) setUmgekehrt((u) => !u);
    else {
      setSortierung(k);
      setUmgekehrt(false);
    }
    setBlatt(0);
  };
  const kopfPfeil = (k: SortKey) => (sortierung === k ? ((sortierung === "abloese" || sortierung === "gehalt") !== umgekehrt ? " ▲" : " ▼") : "");
  const [blatt, setBlatt] = useState(0);
  const [fokusId, setFokusId] = useState<string | null>(props.initialPlayerId ?? null);
  const [pins, setPins] = useState<string[]>([]);
  const [dialog, setDialog] = useState<null | { art: "kauf" | "vergleich" | "verl"; id?: string }>(null);
  const [neuLaden, setNeuLaden] = useState(0);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [staerkeSort, setStaerkeSort] = useState<StaerkeSort>("wichtigkeit");

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
    const aufsteigend = (sortierung === "abloese" || sortierung === "gehalt") !== umgekehrt;
    return sortiereNachSicht(liste, schluessel, aufsteigend ? 1 : -1);
  }, [zeilen, nurBezahlbar, nurHebt, nurMerkliste, filter, sortierung, umgekehrt, disziplin, cash, wirkungJeZeile, merkliste]);

  const aktiveWeitere = zaehleAktiveFilter(filter);
  const seiten = Math.max(1, Math.ceil(gefiltert.length / SEITE));
  const seite = begrenze(blatt, 0, seiten - 1);
  const sichtbar = gefiltert.slice(seite * SEITE, seite * SEITE + SEITE);
  const fokus = zeilen.find((z) => z.item.playerId === fokusId) ?? gefiltert[0] ?? null;

  function waehle(id: string, name: string) {
    setFokusId(id);
    props.onSelectCandidate?.(id, name);
  }
  /** Klickregel (UX 19.11.): 1. Klick wählt aus, Klick auf das Ausgewählte öffnet das Profil; der Name tut beides. */
  // Chris 19.11.: das große Profil wie im Draft statt der schmalen Seitenleiste.
  const [profilId, setProfilId] = useState<string | null>(null);
  function profilOeffnen(id: string) {
    if (props.profilHost) setProfilId(id);
    else props.onOpenPlayerDetails?.({ playerId: id });
  }
  function zeilenKlick(z: Zeile) {
    klickAuswahlOderProfil(z.item.playerId, fokus?.item.playerId ?? null, () => waehle(z.item.playerId, z.item.name), profilOeffnen);
  }
  function verhandeln(item: TransfermarktFreeAgentItem) {
    props.onSelectCandidate?.(item.playerId, item.name);
    props.onOpenOfferPanel?.(item.playerId);
    setDialog({ art: "kauf", id: item.playerId });
  }
  function pinne(id: string) {
    setPins((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : alt.length >= 3 ? [...alt.slice(1), id] : [...alt, id]));
  }

  // Tastatur: ↑/↓ bewegt die Auswahl in der Liste, Enter öffnet das Profil. Gekauft wird nie per Taste.
  const sichtbareIds = useMemo(() => sichtbar.map((z) => z.item.playerId), [sichtbar]);
  useListenTasten({
    ids: sichtbareIds,
    gewaehlt: fokus?.item.playerId ?? null,
    waehle: (id) => {
      const z = sichtbar.find((x) => x.item.playerId === id);
      if (z) waehle(id, z.item.name);
    },
    profil: profilOeffnen,
    aktiv: ansicht === "markt" && dialog == null,
  });

  // ---------------------------------------------------------------- Geld
  const teamGehalt = feed.teamContext?.teamSalary ?? null;
  const kader = feed.teamContext?.rosterCount ?? null;
  const kaderMin = feed.teamContext?.playerMin ?? team?.rosterMinTarget ?? 8;
  const kaderLimit = team?.rosterLimit ?? feed.teamContext?.playerOpt ?? null;
  const freiePlaetze = kaderLimit != null && kader != null ? Math.max(0, kaderLimit - kader) : null;
  const freigabeAnzeige = useMemo(() => berechneFreigabeAnzeige(cash, props.freigabe), [cash, props.freigabe]);
  const bedarf = props.disziplinBedarf ?? {};
  const bedarfSchnitt = schnittVorkommen(bedarf);
  const slotsGesamt = Object.values(bedarf).reduce((m, e) => Math.max(m, ...e.auftritte.map((a) => a.nr)), 0);
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

  // Mein Kader in der gewählten Disziplin und Kasse nach dem Kauf: gemeinsames Panel mit dem Draft (`app/foundation/shared`).
  const eigeneFuerPanel = useMemo<EigenerSpieler[]>(
    () =>
      rosterRows
        .filter((r) => r.teamId === teamId)
        .map((r) => ({ playerId: r.playerId, name: r.name, className: r.className, portraitUrl: r.portraitUrl ?? null, wert: r.disciplineRatings?.[disziplin] ?? null, verletzt: verletzt.has(r.playerId) })),
    [rosterRows, teamId, disziplin, verletzt],
  );
  const eigeneFuerPanelAnzahl = eigeneFuerPanel.length;
  const kasseAnsicht = baueKasseMarkt({
    frei: freigabeAnzeige ? freigabeAnzeige.frei : Math.max(0, cash ?? 0),
    preis: fokus ? (freigabeAnzeige ? fokusKosten : (fokus.item.marketValue ?? null)) : null,
  });

  const disziplinNamen = officialDisciplineWeightLabels as Record<string, string>;
  const disziplinReihenfolge = useMemo(() => {
    if (staerkeSort === "liste") return DISZIPLINEN;
    if (staerkeSort === "spielplan") {
      return [...DISZIPLINEN].sort((a, b) => ersterAuftritt(bedarf[a]) - ersterAuftritt(bedarf[b]) || DISZIPLINEN.indexOf(a) - DISZIPLINEN.indexOf(b));
    }
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
      {profilId && props.profilHost ? (
        <GrossesProfil
          hostProps={props.profilHost}
          playerId={profilId}
          darfPicken={false}
          onWechsel={(id) => setProfilId(id)}
          onZu={() => setProfilId(null)}
          zuLabel="← Zurück zum Transfermarkt"
          testidPrefix="tm-profil"
          aktionHinweis="Kauf, Verkauf und Verlängerung laufen im Transfermarkt."
        />
      ) : null}
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
                <span className="sortwahl" role="group" aria-label="Sortierung der Disziplinen" data-testid="tm-staerke-sort">
                  {STAERKE_SORTEN.map((o) => (
                    <button type="button" key={o.id} className={staerkeSort === o.id ? "an" : ""} aria-pressed={staerkeSort === o.id} title={o.titel} onClick={() => setStaerkeSort(o.id)} data-testid={`tm-staerke-sort-${o.id}`}>{o.text}</button>
                  ))}
                </span>
              </div>
              <div className="ks">
                <div className="kz kopf"><span title="Stärke = Ø der besten 6">Disziplin</span><span title="An welchen Spieltagen die Disziplin in dieser Saison drankommt">Spieltag</span><span title="Einsatz-Slots je Auftritt (höchstens 6)">Slots</span><span title="Kaderstärke: Ø der besten 6, grün = mit dem gewählten Spieler">Stärke</span><span>Rang</span><span>{fokus ? "mit ihm" : ""}</span></div>
                {disziplinReihenfolge.map((d) => {
                  const w = fokusWirkungen.find((x) => x.disziplinId === d);
                  const v = eigeneKaderStaerken[d] ?? 20;
                  const vn = w?.staerkeNachherMitte ?? v;
                  const r = w?.vorher ?? 0;
                  const b = bedarf[d];
                  const u = bedarfUrteil({ eintrag: b, schnittVorkommen: bedarfSchnitt, rang: r, ligaGroesse: ligaTeamIds.length });
                  return (
                    <button type="button" key={d} className={`kz${d === disziplin ? " an" : ""}`} onClick={() => { setDisziplin(d); setBlatt(0); }} title={`${disziplinNamen[d]}: ${spielplanLang(b, slotsGesamt)}. ${u.text}. Markt nach ${disziplinNamen[d]} ausrichten`} data-testid={`tm-disziplin-${d}`}>
                      <span className="n" style={staerkeSort === "liste" && achseDerDisziplin(d) ? { borderLeft: `3px solid ${ACHSEN_FARBE_HEX[achseDerDisziplin(d)!]}`, paddingLeft: "calc(.4 * var(--u))" } : undefined}><i className={`bd ${u.art}`} />{disziplinNamen[d]}</span>
                      <span className="t sz">{spielplanKurz(b).replace(/^ST /, "")}</span>
                      <span className="slotpips" aria-label={`Slots je Auftritt: ${slotsKurz(b)}`}>
                        {(b?.auftritte.length ? b.auftritte : [{ nr: 0, slots: null }]).map((a) => (
                          <span key={a.nr} className="reihe">
                            {Array.from({ length: SLOTS_MAX }, (_, i) => <i key={i} className={a.slots != null && i < a.slots ? "voll" : ""} />)}
                          </span>
                        ))}
                      </span>
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
                <span><b>{disziplinNamen[disziplin]}</b>: {spielplanLang(bedarf[disziplin], slotsGesamt)} · Rang {fokusWirkungen.find((x) => x.disziplinId === disziplin)?.vorher ?? "–"}. {fokusBedarf.text}</span>
              </div>
            </section>
          </div>

          <section className="pan" id="m-liste" aria-label="Markt">
            <div className="fl">
              <input placeholder="Name, Klasse, Rasse" value={suche} onChange={(e) => { setSuche(e.target.value); setBlatt(0); }} aria-label="Suche" data-testid="tm-suche" />
              <span className="diszi" title={fokusBedarf.text}><small>Disziplin</small>{disziplinNamen[disziplin]}<small style={{ color: "var(--leise)" }}>{bedarf[disziplin] ? `${spielplanKurz(bedarf[disziplin])} · Slots ${slotsKurz(bedarf[disziplin])}` : ""}</small></span>
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
                    title="Klick: mindestens D, dann C, B, A, S, dann aus."
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
                <button type="button" key={k} className={`fc${sortierung === k ? " an" : ""}`} onClick={() => sortiereNach(k)} data-testid={`tm-sort-${k}`}>{SORT_LABEL[k]}{kopfPfeil(k)}</button>
              ))}
              <span className="sp" />
              <button type="button" className={`fc${spalten.angepasst ? " an" : ""}`} onClick={spalten.zuruecksetzen} title="Spaltenbreiten und Porträtgröße auf Standard" data-testid="tm-spalten-zuruecksetzen">Spalten zurücksetzen</button>
              <button type="button" className="fc" onClick={() => { setSuche(""); setNurBezahlbar(false); setNurHebt(false); setNurMerkliste(false); setFilter(LEERE_FILTER); setSortierung("eignung"); setUmgekehrt(false); setBlatt(0); }}>Filter zurücksetzen</button>
            </div>
            {weitereOffen ? <WeitereFilterPanel filter={filter} onChange={(f) => { setFilter(f); setBlatt(0); }} /> : null}
            <div className={`mt sl${spalten.zeilenMin > 0 ? " pg" : ""}`} style={{ ["--zeilen" as string]: SEITE, ["--spalten" as string]: spalten.vorlage, ["--minbreite" as string]: `calc(${spalten.minBreite} * var(--u))`, ["--zmin" as string]: spalten.zeilenMin > 0 ? `calc(${spalten.zeilenMin} * var(--u))` : "0px", ["--pw" as string]: spalten.breiten.por }} data-testid="tm-tabelle">
              <div className="mz kopf">
                <span />
                <span>{griff("por")}</span>
                <span>Spieler · Weg in {disziplinNamen[disziplin]}{griff("nm")}</span>
                <span className={sortierung === "eignung" ? "so" : ""} style={{ cursor: "pointer" }} role="button" title="Klick sortiert · nochmal klicken dreht die Richtung" onClick={() => sortiereNach("eignung")} data-testid="tm-kopf-eignung">Eignung{kopfPfeil("eignung")}{griff("eg")}</span>
                <span style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", textAlign: "center" }}>{MARKT_ACHSEN.map((a) => <i key={a} style={{ fontStyle: "normal" }}>{ACHSEN_LABEL[a]}</i>)}{griff("ax")}</span>
                <span className={`re ${sortierung === "abloese" ? "so" : ""}`} style={{ cursor: "pointer" }} role="button" title="Klick sortiert · nochmal klicken dreht die Richtung" onClick={() => sortiereNach("abloese")} data-testid="tm-kopf-abloese">Ablöse{kopfPfeil("abloese")}{griff("abl")}</span>
                <span className={`re ${sortierung === "gehalt" ? "so" : ""}`} style={{ cursor: "pointer" }} role="button" title="Klick sortiert · nochmal klicken dreht die Richtung" onClick={() => sortiereNach("gehalt")} data-testid="tm-kopf-gehalt">Gehalt/Saison{kopfPfeil("gehalt")}{griff("geh")}</span>
                <span className={sortierung === "hebt" ? "so" : ""} style={{ cursor: "pointer" }} role="button" title="Klick sortiert · nochmal klicken dreht die Richtung" onClick={() => sortiereNach("hebt")} data-testid="tm-kopf-kaderrang">Kaderrang{kopfPfeil("hebt")}{griff("rang")}</span>
                <span>{griff("ak")}</span>
              </div>
              {feed.busy && sichtbar.length === 0 && <div className="tmk-leer">Transfermarkt wird geladen …</div>}
              {feed.fehler && <div className="tmk-leer w">{feed.fehler}</div>}
              {!feed.busy && !feed.fehler && sichtbar.length === 0 && <div className="tmk-leer">Keine Spieler für diese Filter.</div>}
              {sichtbar.map((z) => {
                const it = z.item;
                const wert = z.sicht.disziplinen[disziplin];
                const w = wirkungJeZeile.get(it.playerId)!;
                const wege = bauWege(z.sicht, disziplin);
                const teuer = cash != null && it.marketValue != null && it.marketValue > cash;
                const bild = bildUrlVon(it);
                const istFokus = fokus?.item.playerId === it.playerId;
                return (
                  <div key={it.playerId} className={`mz${istFokus ? " an" : ""}`} onClick={() => zeilenKlick(z)} title={istFokus ? "Ausgewählt · nochmal klicken oder Enter öffnet das Profil" : "Klick wählt aus"} aria-selected={istFokus} data-testid="tm-zeile" data-player-id={it.playerId}>
                    <Stern an={merkliste.has(it.playerId)} titel="Merkliste" onClick={() => props.onToggleWishlist?.(it)} />
                    {bild ? <img className="por" src={bild} alt="" loading="lazy" data-testid="tm-portrait" onMouseEnter={(e) => vorschau.zeige(e.currentTarget, vorschauDaten(it, z.sicht, bild))} onMouseLeave={vorschau.verstecke} /> : <span className="por" />}
                    <span className="nm">
                      <b><u className="tmk-pl" role="link" title="Name: wählt aus und öffnet das Profil" onClick={(e) => { e.stopPropagation(); nameKlickAuswahlUndProfil(it.playerId, true, () => waehle(it.playerId, it.name), profilOeffnen); }} data-testid="tm-profil-link">{it.name}</u></b>
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
                    <span className={`re ${teuer ? "zt" : ""}`} title={teuer ? "über deiner Kasse" : ""}><b className="t">{de(it.marketValue ?? 0, 1)}</b></span>
                    <span className="re"><b className="t">{de(it.salary ?? 0, 1)}</b><small style={{ display: "block", color: "var(--stumm)", fontSize: "calc(.7 * var(--u))" }}>{de(jeSpieltag(it.salary) ?? 0, 2)}/Spieltag</small></span>
                    <RangAnzeige w={w} />
                    <span className="ak">
                      {istFokus ? (
                        <>
                          <button type="button" className="knopf klein" onClick={(e) => { e.stopPropagation(); profilOeffnen(it.playerId); }} title="Profil öffnen (Enter oder nochmal klicken)" data-testid="tm-zeile-profil">Profil ›</button>
                          {ueberKasse ? (
                            <span className="tag w" title="über deiner Kasse">zu teuer</span>
                          ) : (
                            <button type="button" className={`knopf klein haupt${kannKaufen ? "" : " zu"}`} disabled={!kannKaufen} onClick={(e) => { e.stopPropagation(); verhandeln(it); }} title={kaufSperre ?? "Verhandlungstisch öffnen"} data-testid="tm-zeile-verhandeln">Verhandeln</button>
                          )}
                        </>
                      ) : (
                        <span className="hw">Klick wählt aus</span>
                      )}
                      <button type="button" className={`pinb pin${pins.includes(it.playerId) ? " an" : ""}`} onClick={(e) => { e.stopPropagation(); pinne(it.playerId); }} title="Zum Vergleich anheften">{pins.includes(it.playerId) ? "drin" : "Vgl."}</button>
                    </span>
                  </div>
                );
              })}
            </div>
            {vorschau.karte}
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
                onVerhandeln={() => verhandeln(fokus.item)}
                onVergleichen={() => pinne(fokus.item.playerId)}
                onErstVerkaufen={() => setAnsicht("verkauf")}
                onDetails={() => profilOeffnen(fokus.item.playerId)}
                onMerken={() => props.onToggleWishlist?.(fokus.item)}
                eigene={eigeneFuerPanel}
                kader={kader ?? eigeneFuerPanelAnzahl}
                kaderPflicht={kaderMin}
                kaderWunsch={feed.teamContext?.playerOpt ?? null}
                kaderMax={team?.rosterLimit ?? 14}
                kasse={kasseAnsicht}
                onProfil={profilOeffnen}
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
          onProfil={profilOeffnen}
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
  /** Mein Kader in der gewählten Disziplin (eigene Spieler exakt), Zähler und Kasse: gemeinsames Panel mit dem Draft. */
  eigene: EigenerSpieler[];
  kader: number;
  kaderPflicht: number;
  kaderWunsch: number | null;
  kaderMax: number;
  kasse: KasseAnsicht;
  onProfil: (playerId: string) => void;
}) {
  const { z, disziplin, disziplinNamen } = props;
  const it = z.item;
  const sprite = getFigurSpriteForPlayer(it.playerId);
  const bild = bildUrlVon(it);
  const wert = z.sicht.disziplinen[disziplin];
  const pp = erwartetePpSpanne(wert);
  const kandidat: KandidatEintrag | null = wert && wert.schaetzung != null ? { playerId: it.playerId, name: it.name, className: it.className, portraitUrl: bild, wert: wert.schaetzung, text: wert.text } : null;
  const potenzial = it.potentialRange ? `${it.potentialRange.min}–${it.potentialRange.max}` : "—";

  return (
    <>
      <div className="buehne-f klickbar" style={props.kulisse ? { backgroundImage: `url(${props.kulisse})` } : undefined} onClick={props.onDetails} title="Profil öffnen" data-testid="tm-buehne">
        <span className="tag pf">Profil ›</span>
        {sprite ? <img className="fig" src={figurPoseUrl(sprite, "south")} alt="" /> : bild ? <img className="por" src={bild} alt="" /> : null}
        <div className="ov">
          {props.nebelAus ? <span className="tag go">Nebel aus (Test)</span> : (it.scoutingLevel ?? 0) >= 5 ? <span className="tag g">voll gescoutet</span> : (it.scoutingLevel ?? 0) === 0 ? <span className="tag a">ungescoutet · Nebel</span> : <span className="tag a">teilweise gescoutet · Stufe {it.scoutingLevel}</span>}
          {props.gemerkt && <span className="tag go">★ Merkliste</span>}
        </div>
        <div className="gr"><strong className="t">{potenzial}</strong><small>Potenzial (Spanne)</small></div>
        <div className="txt"><em>Ausgewählt · {it.className} · {it.race}</em><h3>{it.name}</h3></div>
      </div>
      <div className="fb">
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
        </div>
        <WirkungAufKader wirkungen={props.wirkungen} namen={disziplinNamen} />
        <MeinKaderListe
          disziplinName={disziplinNamen[disziplin] ?? disziplin}
          eigene={props.eigene}
          kandidat={kandidat}
          kader={props.kader}
          pflicht={props.kaderPflicht}
          wunsch={props.kaderWunsch}
          max={props.kaderMax}
          onProfil={props.onProfil}
        />
        <KasseBlock kasse={props.kasse} hinweis={props.freigabeAktiv ? "Vorstand gibt Teil frei" : "Kasse des Teams"} nachLabel="Kauf" />
      </div>
    </>
  );
}
