"use client";

/**
 * SAISONSTAND MODERN (18.11.) — der Broadcast-Stil für die echte Tabelle.
 *
 * Vorlage: public/mockups/saisonstand-modern-17-11.html, Entwurf: docs/design/saisonstand-modern-17-11.md.
 * Nimmt dieselben Props wie `SeasonStandingsNewLook` (die klassische Ansicht bleibt per
 * `?saisonstand=klassisch` erreichbar, `lib/season/saisonstand-look.ts`) und erfindet keine Werte:
 * Rang, Punkte, Bilanz, Verhältnis, Geld, Kader, Disziplin-Punkte, Stärke-Rang, Ergebnisse und
 * Matchwinner kommen aus den Props, die der Host ohnehin baut. Neu gerechnet wird nur Anzeige
 * (`lib/season/saisonstand-modern-logik.ts`).
 *
 * Gebaut: A Kern (Kopf mit Liga-Reitern, Tabelle „Sport" und „Verein", Zonen, Form, Sortierung, leerer
 * Zustand, Saisonende), B Teamkarte (Kontextspalte, auf dem Phone ein Blatt), C Spieltage (Ergebnisse,
 * Ansetzungen, Pods), D Disziplin-Matrix, E Saisonverlauf, F „Was auf dem Spiel steht" und Matchwinner.
 * NICHT gebaut (keine Datenquelle oder offen): G Zeitregler, Papierform-Prozent, Rekorde, Spieler-Form.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { BcHero, BcIcon, BcMarke, BcPanel, BcReiter, BcSeg, BcSheet, BcTable, type BcTableColumn } from "@/components/foundation/broadcast";
import { formatNlMoney } from "@/components/foundation/new-look";
import type { SeasonStandingsV2ClientProps, SeasonV2StandingsRow } from "@/app/foundation/season-v2/SeasonStandingsV2Client";
import {
  SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER,
  SEASON_DISCIPLINE_KEY_TO_CATALOG_ID,
  SEASON_DISCIPLINE_LABELS,
  type SeasonDisciplineAreaId,
  type SeasonDisciplineKey,
} from "@/lib/season/season-discipline-area-groups";
import { LEAGUE_SIZE } from "@/lib/season/league-split";
import { beschreibeBilanz, formatiereBilanz } from "@/lib/standings/standings-bilanz";
import {
  abstandZumFuehrer,
  baueVerlaufsLinien,
  bestimmeZone,
  bewegungText,
  formAusVerlauf,
  formPlaetze,
  kaderStaerkeAnteil,
  rangBand,
  sparklinePunkte,
  waehleShowdownPaarungen,
  wertRaenge,
  istDuellVerlauf,
  lagesatz,
  anteilStufe,
  duellPunkteJeDisziplin,
  einsatzZeile,
  matrixStufe,
  rangStufe,
  type DuellZelle,
  stehtAufDemSpiel,
  type StehtAufDemSpiel,
  teileNachLiga,
  mitLigaRang,
  sortiereNachSpielplan,
  bereichsPunkteAusDuellen,
  ZONEN_MARKE_ENDE,
  ZONEN_TEXT,
  type LigaAnsicht,
} from "@/lib/season/saisonstand-modern-logik";
import type { SpieltagsPaarung, SpieltagsUebersicht } from "@/lib/foundation/season-matchday-fixtures-overview";
import "./saisonstand-modern.css";

type Zeile = SeasonV2StandingsRow;
type Ansicht = "tabelle" | "matrix" | "verlauf" | "spieltage" | "bestenliste";
type Satz = "sport" | "verein";
type SortKey = "rank" | "team" | "verh" | "points" | "pow" | "spe" | "men" | "soc" | "kader" | "mw" | "cash" | "sponsor" | "salary" | "gebaeude" | "transfer" | "guv" | "formRest" | "bew" | "sun" | "form" | "abst";

const ZAHL = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const zahl = (w: number | null | undefined) => (w == null || !Number.isFinite(w) ? "–" : ZAHL.format(w));
const vz = (w: number | null | undefined) => (w == null || !Number.isFinite(w) ? "–" : `${w > 0 ? "+" : w < 0 ? "−" : "±"}${ZAHL.format(Math.abs(w))}`);
const AREA_LABEL: Record<SeasonDisciplineAreaId, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };

function istPhone(): boolean {
  try {
    return window.matchMedia("(max-width: 760px)").matches;
  } catch {
    return false;
  }
}
function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const aktualisiere = () => setPhone(istPhone());
    aktualisiere();
    window.addEventListener("resize", aktualisiere);
    return () => window.removeEventListener("resize", aktualisiere);
  }, []);
  return phone;
}

/** Die Hausschrift zeichnet die Ziffer 1 wie ein I („Liga I"): Zahlen in Überschriften setzt die Zifferschrift. */
function HausZahl({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+)/).map((teil, i) => (i % 2 === 1 ? <span key={i} className="ssm-ziffer">{teil}</span> : teil))}
    </>
  );
}

function Wappen({ zeile, klasse = "ssm-wappen" }: { zeile: Pick<Zeile, "logoUrl" | "logoInitials" | "teamName">; klasse?: string }) {
  const [fehler, setFehler] = useState(false);
  return (
    <span className={klasse} aria-hidden="true">
      {zeile.logoInitials}
      {zeile.logoUrl && !fehler ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={zeile.logoUrl} alt="" loading="lazy" decoding="async" onError={() => setFehler(true)} />
      ) : null}
    </span>
  );
}

function Portrait({ url, name, klasse = "ssm-por" }: { url?: string | null; name: string; klasse?: string }) {
  const [fehler, setFehler] = useState(false);
  const kuerzel = name.split(/\s+/).map((t) => t[0] ?? "").join("").slice(0, 2).toUpperCase();
  return (
    <span className={klasse} aria-hidden="true">
      {kuerzel}
      {url && !fehler ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFehler(true)} />
      ) : null}
    </span>
  );
}

function kaderTip(zeile: Zeile, feld: "marketValue" | "salary"): string | undefined {
  const liste = (zeile.hoverKader ?? [])
    .filter((s) => s[feld] != null)
    .sort((a, b) => (b[feld] ?? 0) - (a[feld] ?? 0))
    .slice(0, 5);
  if (liste.length === 0) return undefined;
  return liste.map((s) => `${s.name} · ${formatNlMoney(s[feld])}`).join("\n");
}

export type SeasonStandingsModernProps = SeasonStandingsV2ClientProps & { onZurKlassik?: () => void };

export default function SeasonStandingsModern(props: SeasonStandingsModernProps) {
  const {
    selectedSeasonLabel,
    isArchived,
    isSeasonEnded = false,
    standingsRows: standingsRowsRoh,
    rivalTeamIds,
    teamBilanzByTeamId,
    teamFormCardBonusByTeamId,
    teamStrengthRankByTeamId,
    spielplanDisziplinen,
    teamStrengthValueByTeamId,
    topPlayers,
    disciplineLeaders,
    spieltage,
    verlauf,
    matchwinner,
    titleRace,
    onOpenTeam,
    onOpenPlayer,
    onOpenRanks,
    onOpenPrize,
    onZurKlassik,
    isLoading = false,
  } = props;

  const phone = usePhone();
  // Liga-Rang statt Gesamtrang (siehe `mitLigaRang`); der Rest der Ansicht rechnet mit Platz 1–16 je Liga.
  const standingsRows = useMemo(() => mitLigaRang(standingsRowsRoh), [standingsRowsRoh]);
  const eigene = useMemo(() => standingsRows.find((z) => z.isSelected) ?? null, [standingsRows]);
  const hatLiga = useMemo(() => standingsRows.some((z) => z.leagueTier != null), [standingsRows]);
  const hatWertung = useMemo(() => standingsRows.some((z) => z.points != null && Number.isFinite(z.points)), [standingsRows]);
  const hatVerhaeltnis = useMemo(() => standingsRows.some((z) => z.verhaeltnis != null), [standingsRows]);
  const nachLiga = useMemo(() => teileNachLiga(standingsRows), [standingsRows]);

  const [ansicht, setAnsicht] = useState<Ansicht>("tabelle");
  const [liga, setLiga] = useState<LigaAnsicht | null>(null);
  const [satz, setSatz] = useState<Satz>("sport");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "rank", dir: "asc" });
  const [kartenTeamId, setKartenTeamId] = useState<string | null>(null);
  const [blattOffen, setBlattOffen] = useState(false);
  const [matrixModus, setMatrixModus] = useState<"punkte" | "staerke">("punkte");
  const [matrixSort, setMatrixSort] = useState<string | null>(null);
  /** Richtung der Matrix-Sortierung; ein zweiter Klick auf dieselbe Spalte dreht (statt die Sortierung aufzuheben). */
  const [matrixAuf, setMatrixAuf] = useState(false);
  const klickMatrix = (key: string, startAuf = false) => {
    if (matrixSort === key) setMatrixAuf((a) => !a);
    else {
      setMatrixSort(key);
      setMatrixAuf(startAuf);
    }
  };
  const [verlaufModus, setVerlaufModus] = useState<"rang" | "punkte">("rang");
  const [gewaehlterSpieltag, setSpieltagId] = useState<string | null>(null);
  const [kontextTab, setKontextTab] = useState<"karte" | "showdown">("karte");
  const [spieltagModus, setSpieltagModus] = useState<"ergebnisse" | "ansetzungen">("ergebnisse");

  // Die Liga des eigenen Teams ist der Einstieg; ohne Liga-Zuordnung gibt es nur „gesamt".
  const aktiveLiga: LigaAnsicht = !hatLiga ? "gesamt" : (liga ?? (eigene?.leagueTier === "liga2" ? "liga2" : eigene?.leagueTier === "liga1" ? "liga1" : "liga1"));

  const kartenTeam = useMemo(
    () => standingsRows.find((z) => z.teamId === (kartenTeamId ?? eigene?.teamId)) ?? eigene ?? standingsRows[0] ?? null,
    [standingsRows, kartenTeamId, eigene],
  );

  const spieltagListe = useMemo(() => (spieltage?.verfuegbar ? spieltage.matchdayOptions : []), [spieltage]);
  const naechsterSpieltag = useMemo(() => spieltagListe.find((o) => !o.gespielt) ?? null, [spieltagListe]);
  /*
   * Duellpunkte je Disziplin (2/1/0, Vierergruppe 2-1-0-0) — das, was in die Tabelle eingeht. Nur
   * Alt-Saves ohne Duell-Spielplan zeigen weiter die Leistungspunkte (PPs) aus dem Punkte-Ledger.
   */
  const duellMatrix = useMemo(() => {
    if (!spieltage?.verfuegbar) return null;
    const gespielte = spieltage.matchdayOptions.filter((o) => o.gespielt);
    return duellPunkteJeDisziplin(gespielte.map((o) => spieltage.getUebersicht(o.id)));
  }, [spieltage]);
  // EINE Übersicht des nächsten Spieltags für Kopf, Matrix-Markierung, „Nä."-Spalte und Showdown.
  const naechsteUebersicht = useMemo(
    () => (spieltage?.verfuegbar && naechsterSpieltag ? spieltage.getUebersicht(naechsterSpieltag.id) : null),
    [spieltage, naechsterSpieltag],
  );
  const naechsteDisziplinen = useMemo(() => {
    const ids = new Set<string>();
    const u = naechsteUebersicht;
    if (!u) return ids;
    for (const p of u?.paarungen ?? []) for (const d of p.disziplinen) ids.add(d.disciplineId);
    for (const pod of u?.miniDmPods ?? []) ids.add(pod.disciplineId);
    return ids;
  }, [naechsteUebersicht]);
  /** Gegner im nächsten Spieltag je Team (Spalte „Nä."). */
  const gegnerVon = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of naechsteUebersicht?.paarungen ?? []) {
      m.set(p.homeTeamId, p.awayTeamId);
      m.set(p.awayTeamId, p.homeTeamId);
    }
    return m;
  }, [naechsteUebersicht]);
  const duellZelle = useCallback(
    (teamId: string, key: SeasonDisciplineKey): DuellZelle | null =>
      duellMatrix?.get(teamId)?.get(SEASON_DISCIPLINE_KEY_TO_CATALOG_ID[key]) ?? null,
    [duellMatrix],
  );
  /** Der Zahlenwert einer Matrix-Zelle: Duellpunkte (ganzzahlig) oder, im Alt-Save, PPs. */
  const disziplinWert = useCallback(
    (z: Zeile, key: SeasonDisciplineKey): number | null =>
      duellMatrix ? (duellZelle(z.teamId, key)?.punkte ?? null) : (z.disciplineValues[key] ?? null),
    [duellMatrix, duellZelle],
  );

  /** Bereichspunkte (POW/SPE/MEN/SOC): im Duell-Modus die Duellpunkte der Disziplinen des Bereichs (wie Matrix und Teamkarte), sonst der Wert der Zeile. */
  const bereichWert = useCallback(
    (z: Zeile, id: SeasonDisciplineAreaId): number | null => {
      if (!duellMatrix) return z[id] ?? null;
      const gruppe = SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER.find((g) => g.id === id);
      return bereichsPunkteAusDuellen(duellMatrix, z.teamId, (gruppe?.keys ?? []).map((k) => SEASON_DISCIPLINE_KEY_TO_CATALOG_ID[k]));
    },
    [duellMatrix],
  );

  const gespielteAnzahl = verlauf ? verlauf.spieltage.filter((t) => t.played).length : spieltagListe.filter((o) => o.gespielt).length;
  // Das Feld-Rennen-Ledger kennt nur GEWERTETE Spieltage (`getMatchdaySummaryOptions`), die Spieltags-
  // Liste alle der Saison — sonst stünde mitten in der Saison „Endstand" und „Noch 0 Spieltage".
  const gesamtSpieltage = Math.max(spieltagListe.length, verlauf ? verlauf.spieltage.length : 0);

  // Gewählter Spieltag, sonst der letzte gespielte (vom Host vorgerechnet) — abgeleitet, kein Effekt.
  const spieltagId = spieltage?.verfuegbar
    ? (gewaehlterSpieltag != null && spieltage.matchdayOptions.some((o) => o.id === gewaehlterSpieltag) ? gewaehlterSpieltag : spieltage.defaultMatchdayId)
    : null;

  const uebersicht: SpieltagsUebersicht | null = useMemo(() => {
    if (!spieltage?.verfuegbar || !spieltagId) return null;
    return spieltage.getUebersicht(spieltagId);
  }, [spieltage, spieltagId]);

  // Nur für den Kopf: der nächste Gegner des eigenen Teams. Eine Übersicht, nicht zwanzig.
  const naechsterGegner = useMemo(() => {
    if (!naechsterSpieltag || !eigene) return null;
    const u = naechsteUebersicht;
    const paarung = u?.paarungen.find((p) => p.homeTeamId === eigene.teamId || p.awayTeamId === eigene.teamId);
    if (!paarung) return null;
    const gegnerId = paarung.homeTeamId === eigene.teamId ? paarung.awayTeamId : paarung.homeTeamId;
    return { zeile: standingsRows.find((z) => z.teamId === gegnerId) ?? null, label: naechsterSpieltag.label };
  }, [naechsterSpieltag, naechsteUebersicht, eigene, standingsRows]);

  const zeilenFuer = useCallback(
    (a: LigaAnsicht): Zeile[] => {
      if (!hatLiga) return nachLiga.ohne.length > 0 ? nachLiga.ohne : [...standingsRows].sort((x, y) => (x.rank ?? 999) - (y.rank ?? 999));
      if (a === "liga1") return nachLiga.liga1;
      if (a === "liga2") return nachLiga.liga2;
      return [...nachLiga.liga1, ...nachLiga.liga2, ...nachLiga.ohne];
    },
    [hatLiga, nachLiga, standingsRows],
  );
  const ligaDerZeile = useCallback(
    (z: Zeile | null): Zeile[] => (!z ? [] : !hatLiga ? zeilenFuer("gesamt") : z.leagueTier === "liga2" ? nachLiga.liga2 : z.leagueTier === "liga1" ? nachLiga.liga1 : nachLiga.ohne),
    [hatLiga, nachLiga, zeilenFuer],
  );

  const formSinnvoll = useMemo(() => istDuellVerlauf(verlauf), [verlauf]);
  const formVon = useCallback((teamId: string) => (formSinnvoll ? formAusVerlauf(verlauf?.byTeamId[teamId]) : []), [verlauf, formSinnvoll]);
  /** Formpunkte (Karten-Tank) je Team: gezeigt = gebucht, gleiche Quelle wie die Klassik-Ansicht (`buildSeasonFormCardBonusByTeamId`). */
  const formPunkteVon = useCallback(
    (teamId: string) => {
      const e = teamFormCardBonusByTeamId?.get(teamId);
      return e && e.poolCards > 0 ? e : null;
    },
    [teamFormCardBonusByTeamId],
  );
  const hatFormPunkte = useMemo(() => standingsRows.some((z) => formPunkteVon(z.teamId) != null), [standingsRows, formPunkteVon]);

  const sichtbareZeilen = useMemo(() => {
    const basis = zeilenFuer(aktiveLiga);
    if (sort.key === "rank" && sort.dir === "asc") return basis;
    const wert = (z: Zeile): number | string => {
      switch (sort.key) {
        case "rank": return z.rank ?? Number.POSITIVE_INFINITY;
        case "team": return z.teamName;
        case "verh": return z.verhaeltnis ?? Number.NEGATIVE_INFINITY;
        case "points": return z.points ?? Number.NEGATIVE_INFINITY;
        case "pow": case "spe": case "men": case "soc": return bereichWert(z, sort.key) ?? Number.NEGATIVE_INFINITY;
        case "kader": return z.rosterCount;
        case "mw": return z.marketValueTotal ?? Number.NEGATIVE_INFINITY;
        case "cash": return z.cash ?? Number.NEGATIVE_INFINITY;
        case "sponsor": return z.sponsorTotal ?? Number.NEGATIVE_INFINITY;
        case "salary": return z.salaryTotal ?? Number.NEGATIVE_INFINITY;
        case "gebaeude": return z.buildingCost ?? Number.NEGATIVE_INFINITY;
        case "transfer": return z.transferNet ?? Number.NEGATIVE_INFINITY;
        case "guv": return z.guv ?? Number.NEGATIVE_INFINITY;
        case "formRest": return formPunkteVon(z.teamId)?.remainingPositive ?? Number.NEGATIVE_INFINITY;
        // ± = Platzbewegung zum Spieltag davor; S-U-N nach Siegen, dann Unentschieden; Form = Punkte der letzten Spieltage.
        case "bew": return z.fieldRaceRankDelta ?? Number.NEGATIVE_INFINITY;
        case "sun": {
          const b = teamBilanzByTeamId?.get(z.teamId);
          return b ? b.siege * 1000 + b.unentschieden : Number.NEGATIVE_INFINITY;
        }
        case "form": {
          const f = formVon(z.teamId);
          return f.length > 0 ? f.reduce((x, e) => x + e.punkte, 0) : Number.NEGATIVE_INFINITY;
        }
        // Abstand zum Tabellenführer: kleiner ist besser, deshalb als negativer Wert (absteigend = knapp vorn zuerst).
        case "abst": {
          if (z.points == null) return Number.NEGATIVE_INFINITY;
          return -(abstandZumFuehrer(z, ligaDerZeile(z)) ?? 0);
        }
      }
    };
    const faktor = sort.dir === "asc" ? 1 : -1;
    return [...basis].sort((a, b) => {
      const x = wert(a);
      const y = wert(b);
      const d = typeof x === "string" || typeof y === "string" ? String(x).localeCompare(String(y), "de-DE") : (x as number) - (y as number);
      return d !== 0 ? d * faktor : (a.rank ?? 999) - (b.rank ?? 999);
    });
  }, [zeilenFuer, aktiveLiga, sort, bereichWert, formPunkteVon, formVon, teamBilanzByTeamId, ligaDerZeile]);

  const klickSort = (key: SortKey, standardRichtung: "asc" | "desc" = "desc") =>
    setSort((alt) => (alt.key === key ? { key, dir: alt.dir === "asc" ? "desc" : "asc" } : { key, dir: standardRichtung }));

  // Platzentwicklung je Team (Rang innerhalb der eigenen Liga je GEWERTETEM Spieltag) für die Sparkline.
  const linienJeTeam = useMemo(() => {
    if (!verlauf) return new Map<string, Array<number | null>>();
    return new Map(baueVerlaufsLinien(verlauf, standingsRows).linien.map((l) => [l.teamId, l.raenge] as const));
  }, [verlauf, standingsRows]);
  const hatSparkline = useMemo(() => [...linienJeTeam.values()].some((r) => r.filter((x) => x != null).length >= 2), [linienJeTeam]);
  const hatGegner = gegnerVon.size > 0;
  const gesamtPlatz = (z: Zeile) => (z.rank == null ? null : z.leagueTier === "liga2" ? z.rank + LEAGUE_SIZE : z.rank);

  const waehleTeam = (teamId: string) => {
    setKartenTeamId(teamId);
    setKontextTab("karte");
    if (phone) setBlattOffen(true);
  };

  /* ------------------------------ Tabelle ------------------------------ */
  const teamZelle = (z: Zeile) => (
    <span className="ssm-team" data-bc-tip={kaderTip(z, "marketValue")} data-testid="ssm-team">
      <Wappen zeile={z} />
      <span className="ssm-team__name">{z.teamName}</span>
      <span className="ssm-team__kz">{z.teamCode}</span>
      {z.isSelected ? <BcMarke ton="gelb" titel="Dein Team">DU</BcMarke> : null}
      {!z.isSelected && z.isFrankyTeam ? <BcMarke farbe="var(--bc-gast)" titel="Von einem Mitspieler gesteuert">FRANKY</BcMarke> : null}
      {rivalTeamIds?.has(z.teamId) ? <BcMarke ton="leer" titel="Rivale deines Teams">RIVALE</BcMarke> : null}
      {isSeasonEnded && !isArchived && z.leagueTier ? (() => {
        const zone = bestimmeZone(z.leagueTier, z.rank);
        return zone ? <BcMarke ton={zone === "abstieg" ? "rot" : undefined} farbe={zone === "aufstieg" ? "var(--bc-gut)" : undefined}>{ZONEN_MARKE_ENDE[zone]}</BcMarke> : null;
      })() : null}
    </span>
  );

  const rangZelle = (z: Zeile) => {
    const zone = hatWertung || isSeasonEnded ? bestimmeZone(z.leagueTier, z.rank) : bestimmeZone(z.leagueTier, z.rank);
    return (
      <span className={`ssm-rang${zone ? ` is-${zone}` : ""}`} data-bc-tip={zone ? ZONEN_TEXT[zone] : undefined}>
        {aktiveLiga === "gesamt" && hatLiga ? gesamtPlatz(z) ?? "–" : z.rank ?? "–"}
      </span>
    );
  };

  const bewegungZelle = (z: Zeile) => {
    const b = bewegungText(z.fieldRaceRankDelta);
    return (
      <span className={`ssm-bew bc-${b.ton}`} data-bc-tip={b.ton === "null" ? "Keine Bewegung zum Spieltag davor" : `${b.zahl} Plätze zum Spieltag davor`}>
        {b.ton === "null" ? "–" : `${b.zeichen}${b.zahl}`}
      </span>
    );
  };

  const formZelle = (z: Zeile) => {
    const form = formVon(z.teamId);
    if (form.length === 0) return <span className="bc-null">–</span>;
    return (
      <span className="ssm-form" data-testid="ssm-form" data-bc-tip="Letzte 6 Spieltage, älteste zuerst: grün 3–4 Punkte, grau 2, rot 0–1">
        {formPlaetze(form).map((f, i) => (
          <i key={i} className={`is-${f.ton}`} />
        ))}
      </span>
    );
  };

  const formPunkteZelle = (z: Zeile) => {
    const e = formPunkteVon(z.teamId);
    if (!e) return <span className="bc-null">–</span>;
    const tip = [
      `Formpunkte: ${zahl(e.remainingPositive)} von ${zahl(e.poolPositive)} noch nicht eingesetzt`,
      `${e.cards} von ${e.poolCards} Karten gespielt`,
      e.remainingNegative < 0 ? `offene Minuskarten ${zahl(e.remainingNegative)} kosten am Saisonende Punkte` : null,
      "Ungespielte Pluskarten verfallen am Saisonende",
    ].filter(Boolean).join("\n");
    return (
      <span className="bc-t ssm-formpkt" data-testid="ssm-formpunkte" data-bc-tip={tip}>
        {zahl(e.remainingPositive)}<small> / {zahl(e.poolPositive)}</small>
      </span>
    );
  };

  const verlaufZelle = (z: Zeile) => {
    const raenge = linienJeTeam.get(z.teamId);
    const gruppe = ligaDerZeile(z);
    const spark = raenge ? sparklinePunkte(raenge, Math.max(gruppe.length, 2)) : null;
    if (!spark) return <span className="bc-null">–</span>;
    const letzter = [...(raenge ?? [])].reverse().find((r) => r != null);
    return (
      <svg className={`ssm-spark${z.isSelected ? " is-eigene" : ""}`} viewBox="0 0 84 22" role="img" aria-label="Platzentwicklung" data-testid="ssm-spark" data-bc-tip={`Tabellenplatz in der Liga über ${raenge?.length ?? 0} gewertete Spieltage, jetzt Platz ${letzter}`}>
        <polyline points={spark.punkte} fill="none" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx={spark.ende.x} cy={spark.ende.y} r="2.4" />
      </svg>
    );
  };

  const gegnerZelle = (z: Zeile) => {
    const gegner = standingsRows.find((x) => x.teamId === gegnerVon.get(z.teamId));
    return gegner ? <Wappen zeile={gegner} klasse="ssm-wappen ssm-wappen--klein" /> : <span className="bc-null">–</span>;
  };

  const abstandZelle = (z: Zeile) => {
    const a = abstandZumFuehrer(z, ligaDerZeile(z));
    return <span className="bc-t ssm-abst" data-bc-tip={a == null ? undefined : `${a} Pkt hinter dem Tabellenführer`}>{z.points == null ? "–" : a == null ? "–" : `−${ZAHL.format(a)}`}</span>;
  };

  const bilanzZelle = (z: Zeile) => {
    const b = teamBilanzByTeamId?.get(z.teamId);
    return b ? <span data-bc-tip={beschreibeBilanz(b)} className="bc-t">{formatiereBilanz(b)}</span> : <span className="bc-null">–</span>;
  };

  const geld = (wert: number | null | undefined, vorzeichen = false) => (
    <span className={`bc-t${vorzeichen && wert != null && wert < 0 ? " bc-minus" : ""}`}>{formatNlMoney(wert)}</span>
  );

  // POW/SPE/MEN/SOC: Rang je Bereich innerhalb der angezeigten Liga (Gesamt: über alle 32) -> Band 1–3 grün, 4–6 gelb, 7–10 rot.
  const bereichsRaenge = useMemo(() => {
    const basis = zeilenFuer(aktiveLiga);
    const r = {} as Record<SeasonDisciplineAreaId, Map<string, number>>;
    for (const id of ["pow", "spe", "men", "soc"] as const) r[id] = wertRaenge(basis, (z) => z.teamId, (z) => (z.points == null ? null : bereichWert(z, id)));
    return r;
  }, [zeilenFuer, aktiveLiga, bereichWert]);

  const spaltenSport = useMemo<BcTableColumn<Zeile>[]>(() => {
    const sk = (key: SortKey, d: "asc" | "desc" = "desc") => ({ onKopf: () => klickSort(key, d), aktiv: sort.key === key });
    const bereich = (id: SeasonDisciplineAreaId): BcTableColumn<Zeile> => ({
      key: id, kopf: AREA_LABEL[id], breite: "46px", rechts: true, ...sk(id), render: (z) => {
        const band = hatWertung ? rangBand(bereichsRaenge[id].get(z.teamId)) : null;
        return <span className={`bc-t ssm-band${band ? ` ssm-band--${band}` : ""}`} data-bc-tip={band ? `${AREA_LABEL[id]}: Rang ${bereichsRaenge[id].get(z.teamId)} in dieser Ansicht` : undefined}>{hatWertung ? zahl(bereichWert(z, id)) : "–"}</span>;
      },
    });
    return [
      { key: "rang", kopf: "#", breite: "46px", ...sk("rank", "asc"), render: rangZelle },
      ...(phone ? [] : [{ key: "bew", kopf: "±", breite: "40px", ...sk("bew"), render: bewegungZelle } as BcTableColumn<Zeile>]),
      { key: "team", kopf: "Team", breite: "minmax(0,1fr)", ...sk("team", "asc"), render: teamZelle },
      { key: "sun", kopf: "S-U-N", breite: phone ? "58px" : "64px", rechts: true, ...sk("sun"), render: bilanzZelle },
      ...(hatVerhaeltnis && !phone ? [{ key: "verh", kopf: "Verh.", breite: "52px", rechts: true, ...sk("verh"), render: (z: Zeile) => <span className={`bc-t ${z.verhaeltnis != null && z.verhaeltnis < 0 ? "bc-minus" : z.verhaeltnis != null && z.verhaeltnis > 0 ? "bc-plus" : ""}`}>{vz(z.verhaeltnis)}</span> } as BcTableColumn<Zeile>] : []),
      ...(formSinnvoll ? [{ key: "form", kopf: "Form", breite: phone ? "76px" : "100px", ...sk("form"), render: formZelle } as BcTableColumn<Zeile>] : []),
      ...(hatFormPunkte && !phone ? [{ key: "formpkt", kopf: "Formpkt.", breite: "76px", rechts: true, ...sk("formRest"), render: formPunkteZelle } as BcTableColumn<Zeile>] : []),
      ...(hatSparkline && !phone ? [{ key: "verlauf", kopf: "Verlauf", breite: "92px", rechts: true, render: verlaufZelle } as BcTableColumn<Zeile>] : []),
      ...(phone ? [] : (["pow", "spe", "men", "soc"] as const).map(bereich)),
      ...(hatGegner && !phone ? [{ key: "naech", kopf: "Nä.", breite: "40px", render: gegnerZelle } as BcTableColumn<Zeile>] : []),
      ...(hatWertung && !phone ? [{ key: "abst", kopf: "Abst.", breite: "50px", rechts: true, ...sk("abst"), render: abstandZelle } as BcTableColumn<Zeile>] : []),
      { key: "pkt", kopf: "Pkt", breite: "52px", rechts: true, ...sk("points"), render: (z) => <strong className="ssm-pkt bc-t">{zahl(z.points)}</strong> },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, hatWertung, hatVerhaeltnis, formSinnvoll, hatFormPunkte, formPunkteVon, teamBilanzByTeamId, sort, aktiveLiga, isSeasonEnded, rivalTeamIds, formVon, bereichsRaenge, hatSparkline, hatGegner, linienJeTeam, gegnerVon, standingsRows, nachLiga, bereichWert]);

  const spaltenVerein = useMemo<BcTableColumn<Zeile>[]>(() => {
    const sk = (key: SortKey, d: "asc" | "desc" = "desc") => ({ onKopf: () => klickSort(key, d), aktiv: sort.key === key });
    return [
      { key: "rang", kopf: "#", breite: "46px", ...sk("rank", "asc"), render: rangZelle },
      { key: "team", kopf: "Team", breite: "minmax(0,1fr)", ...sk("team", "asc"), render: teamZelle },
      ...(phone ? [] : [{ key: "kader", kopf: "Kader", breite: "46px", rechts: true, ...sk("kader"), render: (z: Zeile) => <span className="bc-t">{z.rosterCount}</span> } as BcTableColumn<Zeile>]),
      { key: "mw", kopf: "Marktwert", breite: phone ? "74px" : "84px", rechts: true, ...sk("mw"), render: (z) => <span data-bc-tip={kaderTip(z, "marketValue")}>{geld(z.marketValueTotal)}</span> },
      { key: "cash", kopf: "Cash", breite: phone ? "74px" : "84px", rechts: true, ...sk("cash"), render: (z) => <span className={(z.cash ?? 0) < 0 ? "is-neg" : undefined}>{geld(z.cash, true)}</span> },
      ...(phone ? [] : [
        { key: "sponsor", kopf: "Sponsoren", breite: "84px", rechts: true, ...sk("sponsor"), render: (z: Zeile) => geld(z.sponsorTotal) } as BcTableColumn<Zeile>,
        { key: "salary", kopf: "Gehälter", breite: "84px", rechts: true, ...sk("salary"), render: (z: Zeile) => <span data-bc-tip={kaderTip(z, "salary")}>{geld(z.salaryTotal)}</span> } as BcTableColumn<Zeile>,
        { key: "gebaeude", kopf: "Gebäude", breite: "76px", rechts: true, ...sk("gebaeude"), render: (z: Zeile) => geld(z.buildingCost) } as BcTableColumn<Zeile>,
        { key: "transfer", kopf: "Transfers", breite: "84px", rechts: true, ...sk("transfer"), render: (z: Zeile) => <span className={`bc-t${(z.transferNet ?? 0) < 0 ? " bc-minus" : (z.transferNet ?? 0) > 0 ? " bc-plus" : ""}`}>{formatNlMoney(z.transferNet)}</span> } as BcTableColumn<Zeile>,
        { key: "guv", kopf: "GuV", breite: "84px", rechts: true, ...sk("guv"), render: (z: Zeile) => <span className={`bc-t${(z.guv ?? 0) < 0 ? " bc-minus" : (z.guv ?? 0) > 0 ? " bc-plus" : ""}`}>{formatNlMoney(z.guv)}</span> } as BcTableColumn<Zeile>,
      ]),
      { key: "pkt", kopf: "Pkt", breite: "52px", rechts: true, ...sk("points"), render: (z) => <strong className="ssm-pkt bc-t">{zahl(z.points)}</strong> },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, sort, aktiveLiga, isSeasonEnded, rivalTeamIds]);

  const ersteZeileLiga2 = aktiveLiga === "gesamt" && hatLiga ? nachLiga.liga2[0]?.teamId : null;
  const zeilenKlasse = (z: Zeile) =>
    [
      z.isSelected ? "is-eigene" : z.teamId === kartenTeam?.teamId ? "is-karte" : "",
      bestimmeZone(z.leagueTier, z.rank) ? `ssm-zone ssm-zone--${bestimmeZone(z.leagueTier, z.rank)}` : "",
      sort.key === "rank" && sort.dir === "asc" && z.leagueTier === "liga1" && z.rank === LEAGUE_SIZE - 3 ? "ssm-grenze" : "",
      sort.key === "rank" && sort.dir === "asc" && z.leagueTier === "liga2" && z.rank === 3 ? "ssm-grenze" : "",
      z.teamId === ersteZeileLiga2 ? "ssm-ligawechsel" : "",
    ].filter(Boolean).join(" ");

  const leerHinweis = !hatWertung && !isSeasonEnded;

  const tabelle = (
    <BcPanel
      className="ssm-tafel"
      titel={<HausZahl text={aktiveLiga === "gesamt" && hatLiga ? "Gesamt · Platz 1 bis 32" : aktiveLiga === "liga2" ? "Liga 2 · Tabelle" : hatLiga ? "Liga 1 · Tabelle" : "Tabelle"} />}
      kopfInhalt={<span className="ssm-pan-sub">{selectedSeasonLabel}</span>}
      aktionen={
        <BcSeg
          ariaLabel="Spaltensatz"
          wert={satz}
          onWahl={setSatz}
          optionen={[
            { id: "sport", label: "Sport", titel: "Rang, Bilanz, Form, Bereiche, Punkte" },
            { id: "verein", label: "Verein", titel: "Kader, Marktwert, Cash, Sponsoren, Gehälter, Gebäude, Transfers, GuV" },
          ]}
        />
      }
      bodyClassName="ssm-tafel__koerper"
    >
      {leerHinweis ? (
        <div className="ssm-leer" data-testid="ssm-leer">
          Noch keine Wertung in dieser Saison. Die Reihenfolge sind die Startplätze aus dem Endstand der Vorsaison.
        </div>
      ) : null}
      <BcTable
        className="ssm-tabelle"
        spalten={satz === "sport" ? spaltenSport : spaltenVerein}
        zeilen={sichtbareZeilen}
        zeilenKey={(z) => z.teamId}
        onZeile={(z) => waehleTeam(z.teamId)}
        zeilenKlasse={zeilenKlasse}
        zeilenProps={(z) => ({ "data-team-id": z.teamId, "data-testid": "ssm-zeile" } as never)}
        leer={<div className="ssm-leer">Keine Teams in dieser Ansicht.</div>}
      />
      <footer className="ssm-legende">
        {hatLiga ? (
          <>
            <span><i className="ssm-leg ssm-leg--titel" /> Titel</span>
            <span><i className="ssm-leg ssm-leg--aufstieg" /> Aufstieg (Liga 2, Plätze 1–3)</span>
            <span><i className="ssm-leg ssm-leg--abstieg" /> Abstieg (Liga 1, Plätze 14–16)</span>
          </>
        ) : null}
        <span><BcMarke ton="gelb">DU</BcMarke> dein Team</span>
        {satz === "sport" && hatWertung ? (
          <>
            <span data-testid="ssm-legende-baender"><i className="ssm-leg ssm-leg--gut" /> POW/SPE/MEN/SOC Rang 1–3 · <i className="ssm-leg ssm-leg--warn" /> 4–6 · <i className="ssm-leg ssm-leg--risk" /> 7–10</span>
            {formSinnvoll ? <span><span className="ssm-form ssm-form--leg"><i className="is-s" /><i className="is-u" /><i className="is-n" /></span> Form: 3–4 · 2 · 0–1 Punkte je Spieltag</span> : null}
          </>
        ) : null}
        {onOpenRanks ? <button type="button" className="bc-pan__mehr" onClick={onOpenRanks}>Ranks ›</button> : null}
        {onOpenPrize ? <button type="button" className="bc-pan__mehr" onClick={onOpenPrize}>Sponsoren ›</button> : null}
      </footer>
    </BcPanel>
  );

  /* ------------------------------ Teamkarte ------------------------------ */
  const kartenLiga = ligaDerZeile(kartenTeam);
  const kartenKader = useMemo(
    () => [...(kartenTeam?.hoverKader ?? [])].sort((a, b) => (b.ovr ?? -1) - (a.ovr ?? -1)).slice(0, 4),
    [kartenTeam],
  );
  const staerkeInLiga = useCallback(
    (teamId: string, catalogId: string): number | null => {
      const gruppe = ligaDerZeile(standingsRows.find((z) => z.teamId === teamId) ?? null);
      const werte = gruppe
        .map((z) => ({ id: z.teamId, r: teamStrengthRankByTeamId?.get(z.teamId)?.[catalogId] }))
        .filter((e): e is { id: string; r: number } => e.r != null && Number.isFinite(e.r) && e.r > 0)
        .sort((a, b) => a.r - b.r);
      const index = werte.findIndex((e) => e.id === teamId);
      return index < 0 ? null : index + 1;
    },
    [ligaDerZeile, standingsRows, teamStrengthRankByTeamId],
  );

  const verbleibend = gesamtSpieltage > 0 ? gesamtSpieltage - gespielteAnzahl : null;
  const stehtAuf = kartenTeam ? stehtAufDemSpiel(kartenTeam, kartenLiga, isSeasonEnded ? 0 : verbleibend) : [];

  const stehtBlock = (liste: StehtAufDemSpiel[]) =>
    liste.length > 0 ? (
      <section className="ssm-karte__block" data-testid="ssm-steht-auf-dem-spiel">
        <h3 className="bc-gk">Was auf dem Spiel steht</h3>
        {liste.map((x) => (
          <div key={x.id} className="ssm-steht"><span>{x.label}</span><strong className={`bc-t${x.ton === "gut" ? " bc-plus" : x.ton === "warn" ? " bc-minus" : ""}`}>{x.wert}</strong></div>
        ))}
      </section>
    ) : null;

  const teamKarte = kartenTeam ? (
    <div className="ssm-karte" data-testid="ssm-teamkarte">
      <div className="ssm-karte__kopf">
        <Wappen zeile={kartenTeam} klasse="ssm-wappen ssm-wappen--gross" />
        <div style={{ minWidth: 0 }}>
          <div className="ssm-karte__name">{kartenTeam.teamName}</div>
          <div className="ssm-karte__sub">
            {kartenTeam.gmName ? <>GM {kartenTeam.gmName} · </> : null}
            {hatLiga && kartenTeam.leagueTier ? (kartenTeam.leagueTier === "liga1" ? "Liga 1" : "Liga 2") : "Liga"} · {lagesatz(kartenTeam, kartenLiga)}
          </div>
        </div>
      </div>
      <dl className="ssm-karte__zahlen">
        <div><dt>Rang</dt><dd className="bc-t">{kartenTeam.rank ?? "–"}</dd></div>
        <div><dt>Punkte</dt><dd className="bc-t">{zahl(kartenTeam.points)}</dd></div>
        <div><dt>S-U-N</dt><dd className="bc-t">{teamBilanzByTeamId?.get(kartenTeam.teamId) ? formatiereBilanz(teamBilanzByTeamId.get(kartenTeam.teamId)!) : "–"}</dd></div>
        {hatVerhaeltnis ? <div><dt>Verh.</dt><dd className="bc-t">{vz(kartenTeam.verhaeltnis)}</dd></div> : null}
        {formPunkteVon(kartenTeam.teamId) ? (
          <div data-bc-tip="Noch nicht eingesetzte Formpunkte (Pluskarten) von allen der Saison; ungespielte verfallen am Saisonende"><dt>Formpkt.</dt><dd className="bc-t">{zahl(formPunkteVon(kartenTeam.teamId)!.remainingPositive)} / {zahl(formPunkteVon(kartenTeam.teamId)!.poolPositive)}</dd></div>
        ) : null}
      </dl>
      {stehtBlock(stehtAuf)}
      {kartenKader.length > 0 ? (
        <section className="ssm-karte__block">
          <h3 className="bc-gk">Beste Spieler im Kader</h3>
          {kartenKader.map((s) => (
            <button key={s.playerId} type="button" className="ssm-spieler" onClick={() => onOpenPlayer(s.playerId)}>
              <Portrait name={s.name} url={s.portraitUrl} />
              <span className="ssm-spieler__name">{s.name}</span>
              <span className="ssm-spieler__kl">{s.className ?? ""}</span>
              <strong className="bc-t">{s.ovr != null ? Math.round(s.ovr) : "–"}</strong>
            </button>
          ))}
        </section>
      ) : null}
      <section className="ssm-karte__block">
        <h3 className="bc-gk">Disziplinen · Punkte und Kaderstärke</h3>
        <div className="ssm-kacheln">
          {sortiereNachSpielplan(SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER.flatMap((g) => g.keys), (k) => SEASON_DISCIPLINE_KEY_TO_CATALOG_ID[k], spielplanDisziplinen).map((key) => {
            const punkte = disziplinWert(kartenTeam, key);
            const stark = staerkeInLiga(kartenTeam.teamId, SEASON_DISCIPLINE_KEY_TO_CATALOG_ID[key]);
            return (
              <span key={key} className="ssm-kachel" data-bc-tip={`${SEASON_DISCIPLINE_LABELS[key]}: ${punkte == null ? "noch nicht gespielt" : `${zahl(punkte)} Punkte`}${stark ? `, Kaderstärke Platz ${stark}` : ""}`}>
                <b>{SEASON_DISCIPLINE_LABELS[key]}</b>
                <strong className="bc-t">{zahl(punkte)}</strong>
                <em className="bc-t">{stark ? `#${stark}` : ""}</em>
              </span>
            );
          })}
        </div>
      </section>
      <div className="ssm-karte__fuss">
        <button type="button" className="bc-btn" onClick={() => onOpenTeam(kartenTeam.teamId)}><BcIcon name="team" /> Teamprofil</button>
      </div>
    </div>
  ) : (
    <div className="ssm-leer">Kein Team gewählt.</div>
  );

  /* ------------------------------ Matrix ------------------------------ */
  const teamNameVon = (id: string) => standingsRows.find((z) => z.teamId === id)?.teamName ?? id;
  const matrixSchluessel = SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER.flatMap((g) => g.keys);
  const matrixZeilen = useMemo(() => {
    const basis = zeilenFuer(aktiveLiga);
    if (!matrixSort) return basis;
    const faktor = matrixAuf ? -1 : 1;
    if (matrixSort === "__team") return [...basis].sort((a, b) => a.teamName.localeCompare(b.teamName, "de") * -faktor);
    if (matrixSort === "__pkt") return [...basis].sort((a, b) => ((b.points ?? -1) - (a.points ?? -1)) * faktor || (a.rank ?? 999) - (b.rank ?? 999));
    const key = matrixSort as SeasonDisciplineKey;
    return [...basis].sort((a, b) => ((disziplinWert(b, key) ?? -1) - (disziplinWert(a, key) ?? -1)) * faktor || (a.rank ?? 999) - (b.rank ?? 999));
  }, [zeilenFuer, aktiveLiga, matrixSort, matrixAuf, disziplinWert]);
  const matrixSpalten = useMemo(() => {
    const m: Partial<Record<SeasonDisciplineKey, Array<number | null | undefined>>> = {};
    const basis = zeilenFuer(aktiveLiga);
    for (const key of matrixSchluessel) m[key] = basis.map((z) => disziplinWert(z, key));
    return m;
  }, [zeilenFuer, aktiveLiga, matrixSchluessel, disziplinWert]);

  const matrix = (
    <BcPanel
      className="ssm-tafel"
      titel="Disziplin-Matrix"
      aktionen={
        <BcSeg ariaLabel="Matrix-Modus" wert={matrixModus} onWahl={setMatrixModus} optionen={[
          { id: "punkte", label: "Punkte", titel: "Punkte je Disziplin, Farbe nach Platz in der Liga" },
          { id: "staerke", label: "Kaderstärke", titel: "Rang der Kaderstärke in der Liga (reine Kader, nicht der Saisonverlauf)" },
        ]} />
      }
      bodyClassName="ssm-matrix-wrap"
    >
      <div className="ssm-matrix-legende" aria-hidden>
        {duellMatrix && matrixModus === "punkte" ? (
          <>
            <span>Duellpunkte · Sieg 2 · Remis 1 · Niederlage 0 — Anteil der möglichen</span>
            <i className="ssm-stufe-4">alle</i><i className="ssm-stufe-3">mehr als die Hälfte</i><i className="ssm-stufe-2">Hälfte</i><i className="ssm-stufe-1">weniger</i><i className="ssm-stufe-0">keine</i>
          </>
        ) : (
          <>
            <span>Platz in der Liga</span>
            <i className="ssm-stufe-4">Spitze</i><i className="ssm-stufe-3">gut</i><i className="ssm-stufe-2">Mitte</i><i className="ssm-stufe-1">schwach</i><i className="ssm-stufe-0">Schluss</i>
          </>
        )}
        {naechsteDisziplinen.size > 0 ? <em className="ssm-matrix-legende__naechst">am nächsten Spieltag</em> : null}
        <span className="ssm-matrix-legende__leer">· = noch nicht gespielt</span>
      </div>
      <table className="ssm-matrix" data-testid="ssm-matrix">
        <thead>
          <tr>
            <th className="ssm-matrix__team">
              <button type="button" className={matrixSort === "__team" ? "is-an" : undefined} onClick={() => klickMatrix("__team", true)} data-bc-tip="Nach Teamname sortieren, nochmal klicken dreht die Richtung">
                Team{matrixSort === "__team" ? (matrixAuf ? " ▴" : " ▾") : ""}
              </button>
            </th>
            {SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER.map((g, gi) => (
              <Fragment key={g.id}>
                {gi > 0 ? <th className="ssm-matrix__luecke" aria-hidden /> : null}
                <th colSpan={g.keys.length} className={`ssm-matrix__bereich ssm-bereich-${g.id}`}>{AREA_LABEL[g.id]}</th>
              </Fragment>
            ))}
            <th className="ssm-matrix__luecke" aria-hidden />
            <th>
              <button type="button" className={matrixSort === "__pkt" ? "is-an" : undefined} onClick={() => klickMatrix("__pkt")} data-bc-tip="Nach Punkten sortieren, nochmal klicken dreht die Richtung">
                Pkt{matrixSort === "__pkt" ? (matrixAuf ? " ▴" : " ▾") : ""}
              </button>
            </th>
          </tr>
          <tr>
            <th className="ssm-matrix__team" />
            {SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER.map((g, gi) => (
              <Fragment key={g.id}>
                {gi > 0 ? <th className="ssm-matrix__luecke" aria-hidden /> : null}
                {g.keys.map((key) => (
                  <th key={key} className={`ssm-matrix__diszi ssm-bereich-${g.id}${naechsteDisziplinen.has(SEASON_DISCIPLINE_KEY_TO_CATALOG_ID[key]) ? " is-naechster" : ""}`}>
                    <button type="button" className={matrixSort === key ? "is-an" : undefined} onClick={() => klickMatrix(key)} data-bc-tip="Nach dieser Disziplin sortieren, nochmal klicken dreht die Richtung">
                      {SEASON_DISCIPLINE_LABELS[key]}{matrixSort === key ? (matrixAuf ? " ▴" : " ▾") : ""}
                    </button>
                  </th>
                ))}
              </Fragment>
            ))}
            <th className="ssm-matrix__luecke" aria-hidden />
            <th />
          </tr>
        </thead>
        <tbody>
          {matrixZeilen.map((z) => (
            <tr key={z.teamId} className={z.isSelected ? "is-eigene" : undefined}>
              <th className="ssm-matrix__team">
                <button type="button" onClick={() => waehleTeam(z.teamId)}>
                  <Wappen zeile={z} /> <span className="ssm-team__kz">{z.teamCode}</span> {phone ? null : <span className="ssm-team__name">{z.teamName}</span>}
                </button>
              </th>
              {SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER.map((g, gi) => (
                <Fragment key={g.id}>
                  {gi > 0 ? <td className="ssm-matrix__luecke" aria-hidden /> : null}
                  {g.keys.map((key) => {
                    if (matrixModus === "punkte") {
                      if (duellMatrix) {
                        const zelle = duellZelle(z.teamId, key);
                        const stufe = anteilStufe(zelle);
                        return (
                          <td key={key} className={`bc-t ssm-zelle${stufe == null ? "" : ` ssm-stufe-${stufe}`}`} data-bc-tip={zelle ? [`${SEASON_DISCIPLINE_LABELS[key]}: ${zelle.punkte} von ${zelle.moeglich} möglichen Punkten`, ...zelle.einsaetze.map((e) => einsatzZeile(e, teamNameVon))].join("\n") : `${SEASON_DISCIPLINE_LABELS[key]}: noch nicht gespielt`}>
                            {zelle ? zelle.punkte : "·"}
                          </td>
                        );
                      }
                      const w = z.disciplineValues[key];
                      const stufe = matrixStufe(w, matrixSpalten[key] ?? []);
                      return <td key={key} className={`bc-t ssm-zelle${stufe == null ? "" : ` ssm-stufe-${stufe}`}`}>{w == null ? "·" : zahl(w)}</td>;
                    }
                    const r = staerkeInLiga(z.teamId, SEASON_DISCIPLINE_KEY_TO_CATALOG_ID[key]);
                    const stufe = rangStufe(r, zeilenFuer(aktiveLiga).length);
                    return <td key={key} className={`bc-t ssm-zelle${stufe == null ? "" : ` ssm-stufe-${stufe}`}`}>{r ?? "·"}</td>;
                  })}
                </Fragment>
              ))}
              <td className="ssm-matrix__luecke" aria-hidden />
              <td className="bc-t ssm-matrix__summe"><strong>{zahl(z.points)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </BcPanel>
  );

  /* ------------------------------ Verlauf ------------------------------ */
  const verlaufsDaten = useMemo(() => (verlauf ? baueVerlaufsLinien(verlauf, zeilenFuer(aktiveLiga)) : null), [verlauf, zeilenFuer, aktiveLiga]);
  const verlaufAnsicht = (() => {
    if (!verlaufsDaten || verlaufsDaten.tage.length === 0) {
      return (
        <BcPanel className="ssm-tafel" titel="Saisonverlauf">
          <div className="ssm-leer" data-testid="ssm-verlauf-leer">Noch kein Spieltag gewertet — der Verlauf beginnt nach Spieltag 1.</div>
        </BcPanel>
      );
    }
    const B = 860, H = 380, L = 36, R = 120, T = 16, U = 28;
    const n = verlaufsDaten.tage.length;
    const ligaGroesse = Math.max(...verlaufsDaten.linien.map((l) => Math.max(...l.raenge.map((r) => r ?? 0))), 2);
    const werte = verlaufsDaten.linien.flatMap((l) => l.punkte.filter((p): p is number => p != null));
    const pMax = Math.max(...werte, 1);
    const x = (i: number) => L + (n === 1 ? (B - L - R) / 2 : (i / (n - 1)) * (B - L - R));
    const y = (wert: number) => (verlaufModus === "rang" ? T + ((wert - 1) / Math.max(ligaGroesse - 1, 1)) * (H - T - U) : T + (1 - wert / pMax) * (H - T - U));
    const pfad = (l: { raenge: Array<number | null>; punkte: Array<number | null> }) =>
      (verlaufModus === "rang" ? l.raenge : l.punkte).map((w, i) => (w == null ? null : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(w).toFixed(1)}`)).filter(Boolean).join(" ");
    const markiert = new Set([eigene?.teamId, kartenTeam?.teamId].filter(Boolean) as string[]);
    const zeileVon = (id: string) => standingsRows.find((z) => z.teamId === id);
    const zoneAbstieg = aktiveLiga === "liga1" ? ligaGroesse - 2 : null;
    return (
      <BcPanel
        className="ssm-tafel"
        titel="Saisonverlauf"
        aktionen={<BcSeg ariaLabel="Verlauf-Modus" wert={verlaufModus} onWahl={setVerlaufModus} optionen={[{ id: "rang", label: "Rang" }, { id: "punkte", label: "Punkte" }]} />}
        bodyClassName="ssm-verlauf-wrap"
      >
        <svg className="ssm-verlauf" viewBox={`0 0 ${B} ${H}`} role="img" aria-label="Saisonverlauf: Rang oder Punkte je Spieltag" data-testid="ssm-verlauf">
          {verlaufModus === "rang" && aktiveLiga === "liga2" ? <rect x={L} y={y(1) - 8} width={B - L - R} height={y(3) - y(1) + 16} className="ssm-fl ssm-fl--aufstieg" /> : null}
          {verlaufModus === "rang" && aktiveLiga === "liga1" ? (
            <>
              <rect x={L} y={y(1) - 8} width={B - L - R} height={16} className="ssm-fl ssm-fl--titel" />
              {zoneAbstieg ? <rect x={L} y={y(zoneAbstieg) - 8} width={B - L - R} height={y(ligaGroesse) - y(zoneAbstieg) + 16} className="ssm-fl ssm-fl--abstieg" /> : null}
            </>
          ) : null}
          {verlaufsDaten.tage.map((tag, i) => (
            <g key={tag}>
              <line x1={x(i)} x2={x(i)} y1={T} y2={H - U} className="ssm-raster" />
              <text x={x(i)} y={H - 8} textAnchor="middle" className="ssm-achse">{tag}</text>
            </g>
          ))}
          {verlaufsDaten.linien.filter((l) => !markiert.has(l.teamId)).map((l) => (
            <path key={l.teamId} d={pfad(l)} className="ssm-linie" />
          ))}
          {verlaufsDaten.linien.filter((l) => markiert.has(l.teamId)).map((l) => {
            const z = zeileVon(l.teamId);
            const werteL = verlaufModus === "rang" ? l.raenge : l.punkte;
            const letzter = werteL[werteL.length - 1];
            return (
              <g key={l.teamId} className={l.teamId === eigene?.teamId ? "ssm-linie-eigene" : "ssm-linie-gewaehlt"}>
                <path d={pfad(l)} className="ssm-linie ssm-linie--stark" />
                {letzter != null ? <text x={x(werteL.length - 1) + 8} y={y(letzter) + 4} className="ssm-linie-name">{z?.teamCode ?? ""} {z?.teamName ?? ""}</text> : null}
              </g>
            );
          })}
        </svg>
        <p className="ssm-fussnote">Rang innerhalb der Liga. Bei Punktgleichheit entscheidet der heutige Tabellenrang. Klick auf ein Team in der Tabelle legt es als zweite Linie fest.</p>
      </BcPanel>
    );
  })();

  /* ------------------------------ Spieltage ------------------------------ */
  const teamKurz = (id: string) => standingsRows.find((z) => z.teamId === id);
  const paarungsKarte = (p: SpieltagsPaarung, u: SpieltagsUebersicht) => {
    const heim = teamKurz(p.homeTeamId);
    const gast = teamKurz(p.awayTeamId);
    const gesamtH = p.disziplinen.reduce((s, d) => s + (d.punkteHeim ?? 0), 0);
    const gesamtG = p.disziplinen.reduce((s, d) => s + (d.punkteGast ?? 0), 0);
    const eigenSpiel = heim?.isSelected || gast?.isSelected;
    return (
      <article key={p.fixtureId} className={`ssm-paarung${eigenSpiel ? " is-eigene" : ""}`} data-testid="ssm-paarung">
        <header className="ssm-paarung__kopf">
          <button type="button" className="ssm-paarung__team" onClick={() => heim && waehleTeam(heim.teamId)}>
            {heim ? <Wappen zeile={heim} /> : null}<span>{heim?.teamName ?? p.homeTeamId}</span>
          </button>
          <strong className="ssm-paarung__erg bc-t">{p.gespielt ? `${gesamtH} : ${gesamtG}` : "–:–"}</strong>
          <button type="button" className="ssm-paarung__team ssm-paarung__team--gast" onClick={() => gast && waehleTeam(gast.teamId)}>
            <span>{gast?.teamName ?? p.awayTeamId}</span>{gast ? <Wappen zeile={gast} /> : null}
          </button>
        </header>
        {p.istRueckspiel && p.hinspielMatchdayLabel ? <div className="ssm-paarung__hin">Rückspiel · Hinspiel {p.hinspielMatchdayLabel}</div> : null}
        {p.disziplinen.map((d) => {
          const pod = d.resolutionSource === "mini_dm_pod" || d.miniDmPodIdHeim != null;
          const ergebnis = !d.gespielt
            ? "–"
            : pod
              ? `${u.miniDmPods.find((m) => m.podId === d.miniDmPodIdHeim)?.mitglieder.find((m) => m.teamId === p.homeTeamId)?.platz ?? "–"}. / ${u.miniDmPods.find((m) => m.podId === d.miniDmPodIdGast)?.mitglieder.find((m) => m.teamId === p.awayTeamId)?.platz ?? "–"}.`
              : d.ergebnisNormiert
                ? `${d.ergebnisNormiert[0]} : ${d.ergebnisNormiert[1]}`
                : d.seiten
                  ? `${zahl(d.seiten[0])} : ${zahl(d.seiten[1])}`
                  : "";
          const staerkeH = teamStrengthRankByTeamId?.get(p.homeTeamId)?.[d.disciplineId];
          const staerkeG = teamStrengthRankByTeamId?.get(p.awayTeamId)?.[d.disciplineId];
          return (
            <div key={d.disciplineId} className="ssm-paarung__disz">
              <span className="ssm-paarung__dn">{d.disciplineName}{d.occurrenceInSeason ? <em> · {d.occurrenceInSeason}. Durchgang</em> : null}</span>
              {!d.gespielt && staerkeH && staerkeG ? (
                (() => {
                  const pod = d.resolutionSource === "mini_dm_pod" || d.miniDmPodIdHeim != null || d.miniDmPodIdGast != null;
                  const anteil = pod ? null : kaderStaerkeAnteil(teamStrengthValueByTeamId?.get(p.homeTeamId)?.[d.disciplineId], teamStrengthValueByTeamId?.get(p.awayTeamId)?.[d.disciplineId]);
                  return anteil != null ? (
                    <span className="ssm-paarung__st ssm-paarung__st--balken" data-bc-tip={`Kaderstärke ${d.disciplineName}: Rang ${staerkeH} gegen Rang ${staerkeG} — Verhältnis, kein Ergebnis`}>
                      <span className="ssm-wb"><i style={{ width: `${anteil}%` }} /></span><span className="bc-t">{anteil} %</span>
                    </span>
                  ) : (
                    <span className="ssm-paarung__st" data-bc-tip="Stärke-Rang der Kader in dieser Disziplin (1 = stärkster Kader)">#{staerkeH} gg. #{staerkeG}</span>
                  );
                })()
              ) : null}
              <span className="ssm-paarung__pkt bc-t">{d.gespielt ? `${d.punkteHeim ?? 0}:${d.punkteGast ?? 0}` : ""}</span>
              <span className="ssm-paarung__wert bc-t">{ergebnis}</span>
            </div>
          );
        })}
      </article>
    );
  };

  const zeigeAlle = spieltagModus === "ergebnisse" || (uebersicht?.paarungen.every((p) => p.gespielt) ?? true);
  const waehleSpieltagModus = (modus: "ergebnisse" | "ansetzungen") => {
    setSpieltagModus(modus);
    if (modus === "ansetzungen" && naechsterSpieltag) setSpieltagId(naechsterSpieltag.id);
  };
  // Saisonpause: kleine Marke zwischen Spieltag 10 und 11, hervorgehoben an den zwei Spieltagen daneben.
  const pauseInfo = spieltage?.verfuegbar ? spieltage.pause ?? null : null;
  const pauseNaehe = pauseInfo != null && spieltagId != null && (() => {
    const nr = spieltagListe.findIndex((o) => o.id === spieltagId) + 1;
    return nr === pauseInfo.nachSpieltag || nr === pauseInfo.nachSpieltag + 1;
  })();
  const pauseMarke = pauseInfo ? (
    <div className={`ssm-pause${pauseInfo.gebucht ? " is-gebucht" : ""}${pauseNaehe ? " is-nah" : ""}`} data-testid="ssm-pause">
      <span className="ssm-pause__p" aria-hidden="true">P</span>
      <span className="ssm-pause__t">
        <b>Pause · Regeneration</b> zwischen Spieltag {pauseInfo.nachSpieltag} und {pauseInfo.nachSpieltag + 1}
        {pauseInfo.gebucht ? " — gebucht: alle haben einen spielfreien Spieltag erholt." : " — alle erholen sich einen spielfreien Spieltag."}
        {" "}Kein Spieltag, keine Wertung.
      </span>
    </div>
  ) : null;
  const spieltageAnsicht = !spieltage?.verfuegbar ? (
    <BcPanel className="ssm-tafel" titel="Spieltage"><div className="ssm-leer" data-testid="ssm-spieltage-leer">Für diesen Spielstand gibt es keinen Spielplan mit Duellen.</div></BcPanel>
  ) : (
    <BcPanel
      className="ssm-tafel"
      titel={<HausZahl text={spieltagListe.find((o) => o.id === spieltagId)?.label ?? "Spieltage"} />}
      kopfInhalt={
        <span className="ssm-tagwahl" role="group" aria-label="Spieltag wählen">
          <button type="button" className="bc-btn bc-btn--klein" aria-label="Spieltag davor" disabled={!spieltagId || spieltagListe.findIndex((o) => o.id === spieltagId) <= 0}
            onClick={() => setSpieltagId(spieltagListe[Math.max(0, spieltagListe.findIndex((o) => o.id === spieltagId) - 1)]?.id ?? null)}><BcIcon name="links" /></button>
          <button type="button" className="bc-btn bc-btn--klein" aria-label="Spieltag danach" disabled={!spieltagId || spieltagListe.findIndex((o) => o.id === spieltagId) >= spieltagListe.length - 1}
            onClick={() => setSpieltagId(spieltagListe[Math.min(spieltagListe.length - 1, spieltagListe.findIndex((o) => o.id === spieltagId) + 1)]?.id ?? null)}><BcIcon name="rechts" /></button>
        </span>
      }
      aktionen={<BcSeg ariaLabel="Spieltag-Modus" wert={spieltagModus} onWahl={waehleSpieltagModus} optionen={[{ id: "ergebnisse", label: "Ergebnisse" }, { id: "ansetzungen", label: "Ansetzungen" }]} />}
      bodyClassName="ssm-spieltage"
    >
      {pauseMarke}
      {!uebersicht ? (
        <div className="ssm-leer">Kein Spieltag gewählt.</div>
      ) : (
        <>
          {!zeigeAlle ? null : spieltagModus === "ansetzungen" ? (
            <div className="ssm-leer">Dieser Spieltag ist gespielt. Die Ansetzungen zeigen die Paarungen, solange sie offen sind.</div>
          ) : null}
          <div className={`ssm-spalten${aktiveLiga === "gesamt" && hatLiga ? " is-zwei" : ""}`}>
            {(aktiveLiga === "gesamt" || !hatLiga ? (["liga1", "liga2", "ohne"] as const) : ([aktiveLiga] as const)).map((tier) => {
              const liste = uebersicht.paarungen.filter((p) => (tier === "ohne" ? !p.leagueTier : p.leagueTier === tier)).filter((p) => zeigeAlle || !p.gespielt);
              if (liste.length === 0) return null;
              return (
                <section key={tier} className="ssm-spalte">
                  {hatLiga ? <h3 className="bc-gk">{tier === "liga1" ? "Liga 1" : tier === "liga2" ? "Liga 2" : "Ohne Liga"}</h3> : null}
                  {liste.map((p) => paarungsKarte(p, uebersicht))}
                </section>
              );
            })}
          </div>
          {uebersicht.miniDmPods.length > 0 ? (
            <section className="ssm-pods" data-testid="ssm-pods">
              <h3 className="bc-gk">Vierer-Pods</h3>
              <div className="ssm-pods__raster">
                {uebersicht.miniDmPods.map((pod) => (
                  <article key={pod.podId} className="ssm-pod">
                    <header>{pod.disciplineName}{pod.leagueTier ? ` · ${pod.leagueTier === "liga1" ? "Liga 1" : "Liga 2"}` : ""}</header>
                    {pod.mitglieder.map((m) => {
                      const t = teamKurz(m.teamId);
                      return (
                        <div key={m.teamId} className={`ssm-pod__zeile${t?.isSelected ? " is-eigene" : ""}`}>
                          <span className="bc-t">{m.platz ?? "–"}.</span>
                          <span>{t?.teamName ?? m.teamId}</span>
                          <span className="bc-t">{m.teamPoints != null ? `${m.teamPoints} Pkt` : ""}</span>
                        </div>
                      );
                    })}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </BcPanel>
  );

  /* ------------------------------ Bestenliste ------------------------------ */
  const teamCode = (id: string) => standingsRows.find((z) => z.teamId === id)?.teamCode ?? "";
  const bestenliste = (
    <div className="ssm-best" data-testid="ssm-bestenliste">
      <BcPanel className="ssm-tafel" titel="Matchwinner" kopfInhalt={<span className="ssm-pan-sub">bester seines Teams in einem gewonnenen Einsatz</span>}>
        {!matchwinner || matchwinner.length === 0 ? (
          <div className="ssm-leer">Noch keine Matchwinner — sie entstehen mit dem ersten gewerteten Einsatz.</div>
        ) : (
          <ol className="ssm-liste">
            {matchwinner.map((m, i) => (
              <li key={m.playerId}>
                <button type="button" onClick={() => onOpenPlayer(m.playerId)}>
                  <span className="ssm-liste__rang bc-t">{i + 1}</span>
                  <Portrait url={m.portraitUrl} name={m.name} />
                  <span className="ssm-liste__name">{m.name}<em>{teamCode(m.teamId)}</em></span>
                  <span className="ssm-liste__einsaetze bc-t" data-bc-tip="Gewertete Einsätze der Saison">{m.einsaetze} Eins.</span>
                  <strong className="bc-t">{m.matchwinner}</strong>
                </button>
              </li>
            ))}
          </ol>
        )}
      </BcPanel>
      <BcPanel className="ssm-tafel" titel="Disziplin-Beste" kopfInhalt={<span className="ssm-pan-sub">höchster Beitrag je Disziplin</span>}>
        {disciplineLeaders.length === 0 ? (
          <div className="ssm-leer">Für diese Saison liegen keine Einsatz-Daten vor.</div>
        ) : (
          <ol className="ssm-liste">
            {disciplineLeaders.map((l) => (
              <li key={l.disciplineId}>
                <button type="button" onClick={() => onOpenPlayer(l.playerId)}>
                  <span className="ssm-liste__rang">{l.disciplineName}</span>
                  <span className="ssm-liste__name">{l.playerName}<em>{l.teamCode ?? ""}</em></span>
                  <span className="ssm-liste__einsaetze bc-t">{l.appearances}×</span>
                  <strong className="bc-t">{zahl(l.totalContribution)}</strong>
                </button>
              </li>
            ))}
          </ol>
        )}
      </BcPanel>
      {topPlayers.length > 0 ? (
        <BcPanel className="ssm-tafel" titel="Spieler nach PPs">
          <ol className="ssm-liste">
            {topPlayers.slice(0, 10).map((p) => (
              <li key={p.playerId}>
                <button type="button" onClick={() => onOpenPlayer(p.playerId)}>
                  <span className="ssm-liste__rang bc-t">{p.rank}</span>
                  <Portrait url={p.portraitUrl} name={p.name} />
                  <span className="ssm-liste__name">{p.name}<em>{p.teamCode ?? ""}</em></span>
                  <strong className="bc-t">{zahl(p.pps)}</strong>
                </button>
              </li>
            ))}
          </ol>
        </BcPanel>
      ) : null}
    </div>
  );

  /* ------------------------------ Kopf ------------------------------ */
  const ligaReiter: Array<{ id: LigaAnsicht; eyebrow: string; titel: string; zeilen: Zeile[] }> = hatLiga
    ? [
        { id: "liga1", eyebrow: "Spitze", titel: "Liga 1", zeilen: nachLiga.liga1 },
        { id: "liga2", eyebrow: "Aufstieg", titel: "Liga 2", zeilen: nachLiga.liga2 },
        { id: "gesamt", eyebrow: "Alle 32", titel: "Gesamt", zeilen: zeilenFuer("gesamt") },
      ]
    : [];

  const lage = eigene ? lagesatz(eigene, ligaDerZeile(eigene)) : null;
  // Je Liga gerechnet (`lib/season/title-race.ts`): Titel (Liga 1), Aufstieg (Liga 2), Abstieg (Liga 1).
  const aufstiegOffen = titleRace?.leagues.find((r) => r.promotion)?.promotion;
  const abstiegOffen = titleRace?.leagues.find((r) => r.relegation)?.relegation;
  const zaehle = (m: Map<string, string> | null | undefined, wert: string) => (m ? [...m.values()].filter((v) => v === wert).length : 0);
  const rennenTeile = [
    titleRace && titleRace.leaderId && titleRace.contenderIds.size > 1 ? `Meisterschaftskampf: ${titleRace.contenderIds.size} Teams im Rennen` : null,
    zaehle(aufstiegOffen, "im-rennen") > 0 ? `Aufstieg: ${zaehle(aufstiegOffen, "im-rennen")} Teams im Rennen` : null,
    zaehle(abstiegOffen, "gefaehrdet") > 0 ? `Abstieg: ${zaehle(abstiegOffen, "gefaehrdet")} Teams in Gefahr` : null,
  ].filter((t): t is string => t != null);
  const titelKampf = rennenTeile.length > 0 ? rennenTeile.join(" · ") : null;

  const hero = (
    <BcHero
      wappen={eigene?.logoUrl ?? null}
      wappenAlt={eigene?.teamName}
      dachzeile={<>Saisonstand · {selectedSeasonLabel}{isArchived ? " · Archiv" : ""}{gesamtSpieltage > 0 ? ` · ${isSeasonEnded || (gesamtSpieltage > 0 && gespielteAnzahl >= gesamtSpieltage) ? "Endstand" : gespielteAnzahl === 0 ? `vor Spieltag 1 von ${gesamtSpieltage}` : `nach Spieltag ${gespielteAnzahl} von ${gesamtSpieltage}${spieltage?.pause && gespielteAnzahl === spieltage.pause.nachSpieltag ? " · Pause · Regeneration" : ""}`}` : ""}</>}
      titel={eigene?.teamName ?? "Saisonstand"}
      untertitel={<>{lage ? <b>{lage}</b> : null}{titelKampf ? <> · {titelKampf}</> : null}</>}
      mitte={
        ligaReiter.map((r) => {
          const fuehrer = r.zeilen[0];
          const meineId = eigene?.teamId;
          const mein = meineId ? r.zeilen.find((z) => z.teamId === meineId) : null;
          return (
            <BcReiter
              key={r.id}
              aktiv={aktiveLiga === r.id}
              onClick={() => setLiga(r.id)}
              eyebrow={mein ? `${r.eyebrow} · Dein Rang ${r.id === "gesamt" ? gesamtPlatz(mein) : mein.rank}` : r.eyebrow}
              titel={<HausZahl text={r.titel} />}
              symbol={r.id === "gesamt" ? "32" : r.id === "liga1" ? "L1" : "L2"}
              wert={fuehrer && r.id !== "gesamt" ? zahl(fuehrer.points) : null}
              wertNote={fuehrer && r.id !== "gesamt" ? fuehrer.teamCode : null}
              titelAttr={fuehrer ? `${r.titel}: ${fuehrer.teamName} führt` : r.titel}
            />
          );
        })
      }
      rechts={
        <>
          {naechsterGegner?.zeile ? (
            <div className="ssm-gegner" data-testid="ssm-naechster-gegner">
              <span className="bc-gk">{naechsterGegner.label} · gegen</span>
              <strong>{naechsterGegner.zeile.teamName}</strong>
            </div>
          ) : null}
          {onZurKlassik ? (
            <button type="button" className="bc-btn bc-btn--klein" onClick={onZurKlassik} data-bc-tip="Zur bisherigen Saisonstand-Ansicht wechseln" aria-label="Klassische Ansicht">
              Klassisch
            </button>
          ) : null}
        </>
      }
    />
  );

  const ansichtenReiter: Array<{ id: Ansicht; label: string }> = [
    { id: "tabelle", label: "Tabelle" },
    { id: "matrix", label: "Disziplin-Matrix" },
    { id: "verlauf", label: "Saisonverlauf" },
    { id: "spieltage", label: "Spieltage" },
    { id: "bestenliste", label: "Bestenliste" },
  ];

  /* ------------------------------ Showdown (Forecast) ------------------------------ */
  const kurzVonKatalogId = useMemo(() => {
    const m = new Map<string, string>();
    for (const key of Object.keys(SEASON_DISCIPLINE_KEY_TO_CATALOG_ID) as SeasonDisciplineKey[]) m.set(SEASON_DISCIPLINE_KEY_TO_CATALOG_ID[key], SEASON_DISCIPLINE_LABELS[key]);
    return m;
  }, []);
  const showdownPaarungen = useMemo(() => {
    const u = naechsteUebersicht;
    if (!u || !eigene) return [];
    const liste = u.paarungen.filter((p) => !eigene.leagueTier || p.leagueTier === eigene.leagueTier);
    const rangVon = (id: string) => standingsRows.find((z) => z.teamId === id)?.rank ?? null;
    const auswahl = waehleShowdownPaarungen(
      liste.map((p) => ({ id: p.fixtureId, rangHeim: rangVon(p.homeTeamId), rangGast: rangVon(p.awayTeamId), eigen: p.homeTeamId === eigene.teamId || p.awayTeamId === eigene.teamId })),
    );
    return auswahl.flatMap((a) => {
      const paarung = liste.find((p) => p.fixtureId === a.id);
      return paarung ? [{ tag: a.tag, paarung }] : [];
    });
  }, [naechsteUebersicht, eigene, standingsRows]);
  const hatShowdown = showdownPaarungen.length > 0;
  const showdownKarte = (tag: string, p: SpieltagsPaarung) => {
    const heim = teamKurz(p.homeTeamId);
    const gast = teamKurz(p.awayTeamId);
    const eigenSpiel = heim?.isSelected || gast?.isSelected;
    const seite = (z: Zeile | undefined, id: string, klasse: string) => (
      <button type="button" className={klasse} onClick={() => z && waehleTeam(z.teamId)}>
        {z ? <Wappen zeile={z} klasse="ssm-wappen ssm-wappen--mittel" /> : null}
        <b>{z?.teamName ?? id}</b>
        <small className="bc-t">{z?.rank != null ? `${z.rank}. · ${zahl(z.points)} Pkt` : ""}</small>
      </button>
    );
    return (
      <article key={p.fixtureId} className={`ssm-sd${eigenSpiel ? " is-eigene" : ""}`} data-testid="ssm-showdown-paarung">
        <header className="ssm-sd__kopf"><span>{tag}</span><small>{p.leagueTier === "liga1" ? "Liga 1" : p.leagueTier === "liga2" ? "Liga 2" : ""}</small></header>
        <div className="ssm-sd__par">
          {seite(heim, p.homeTeamId, "ssm-sd__team ssm-sd__team--heim")}
          <span className="ssm-sd__vs">vs</span>
          {seite(gast, p.awayTeamId, "ssm-sd__team ssm-sd__team--gast")}
        </div>
        {p.disziplinen.map((d) => {
          const pod = d.resolutionSource === "mini_dm_pod" || d.miniDmPodIdHeim != null || d.miniDmPodIdGast != null;
          const rH = staerkeInLiga(p.homeTeamId, d.disciplineId);
          const rG = staerkeInLiga(p.awayTeamId, d.disciplineId);
          const wH = teamStrengthValueByTeamId?.get(p.homeTeamId)?.[d.disciplineId];
          const wG = teamStrengthValueByTeamId?.get(p.awayTeamId)?.[d.disciplineId];
          const anteil = pod ? null : kaderStaerkeAnteil(wH, wG);
          const kurz = kurzVonKatalogId.get(d.disciplineId) ?? d.disciplineName;
          const tipp = `${d.disciplineName} · Kaderstärke${rH && rG ? `: Rang ${rH} gegen Rang ${rG}` : ""}${wH != null && wG != null ? ` (Werte ${zahl(wH)} : ${zahl(wG)})` : ""}${pod ? " · Vierer-Pod: kein Zweikampf" : ""}`;
          return (
            <div key={d.disciplineId} className="ssm-sd__pf" data-bc-tip={tipp} data-testid="ssm-showdown-zeile">
              <span className="bc-gk">{kurz}</span>
              {anteil != null ? (
                <>
                  <span className="ssm-wb" role="img" aria-label={`Kaderstärke ${heim?.teamName ?? ""} ${anteil} Prozent`}><i style={{ width: `${anteil}%` }} /></span>
                  <span className="bc-t ssm-sd__pct">{anteil} %</span>
                </>
              ) : (
                <>
                  <span className="ssm-sd__chips">{pod ? "Vierer-Pod · " : ""}Kaderstärke {rH ? `#${rH}` : "–"} · {rG ? `#${rG}` : "–"}</span>
                  <span />
                </>
              )}
            </div>
          );
        })}
      </article>
    );
  };
  const showdown = hatShowdown ? (
    <div className="ssm-showdown" data-testid="ssm-showdown">
      <h3 className="bc-gk">{naechsterSpieltag?.label ?? "Nächster Spieltag"} · Kaderstärke der Disziplin</h3>
      {showdownPaarungen.map(({ tag, paarung }) => showdownKarte(tag, paarung))}
      <p className="ssm-fussnote">Balken = Verhältnis der Kaderstärke beider Teams (Top-6-Eignung der Disziplin), kein Ergebnis und keine Prognose.</p>
      {eigene ? stehtBlock(stehtAufDemSpiel(eigene, ligaDerZeile(eigene), isSeasonEnded ? 0 : verbleibend)) : null}
    </div>
  ) : null;

  const kontext = (
    <aside className="ssm-kontext" aria-label="Teamkarte und Showdown">
      <BcSheet offen={blattOffen} onSchliessen={() => setBlattOffen(false)} titel={kontextTab === "showdown" && hatShowdown ? "Showdown" : kartenTeam?.teamName ?? "Team"} className="ssm-blatt">
        {hatShowdown ? (
          <nav className="ssm-ktabs" role="tablist" aria-label="Kontext">
            <button type="button" role="tab" aria-selected={kontextTab === "karte"} className={kontextTab === "karte" ? "is-an" : undefined} onClick={() => setKontextTab("karte")}>Teamkarte</button>
            <button type="button" role="tab" aria-selected={kontextTab === "showdown"} className={kontextTab === "showdown" ? "is-an" : undefined} onClick={() => setKontextTab("showdown")} data-testid="ssm-tab-showdown">Showdown</button>
          </nav>
        ) : null}
        <div className="bc-pan__koerper">{kontextTab === "showdown" && showdown ? showdown : teamKarte}</div>
      </BcSheet>
    </aside>
  );

  return (
    <div className="bc ssm" data-testid="saisonstand-modern" aria-busy={isLoading || undefined}>
      {hero}
      <nav className="ssm-ansichten" role="tablist" aria-label="Ansicht">
        {ansichtenReiter.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={ansicht === a.id} className={ansicht === a.id ? "is-an" : undefined} onClick={() => setAnsicht(a.id)}>
            {a.label}
          </button>
        ))}
      </nav>
      <div className="ssm-arbeit">
        <div className="ssm-haupt">
          {ansicht === "tabelle" ? tabelle : null}
          {ansicht === "matrix" ? matrix : null}
          {ansicht === "verlauf" ? verlaufAnsicht : null}
          {ansicht === "spieltage" ? spieltageAnsicht : null}
          {ansicht === "bestenliste" ? bestenliste : null}
        </div>
        {kontext}
      </div>
      <div className="bc-sr" aria-live="polite">{kartenTeam ? `Teamkarte: ${kartenTeam.teamName}` : ""}</div>
    </div>
  );
}
