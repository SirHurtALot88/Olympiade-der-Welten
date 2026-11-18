/**
 * STARTSEITE MODERN (18.11.) — die reine Datenseite der neuen Home-Ansicht.
 *
 * Vorlage: public/mockups/oly-start-modern-18-11.html, Doku: docs/design/oly-start-modern-18-11.md.
 * Nichts hier erfindet Spielwerte. Rang, Punkte, Verhältnis kommen aus den Standings-Zeilen, S-U-N aus
 * den gebuchten Duell-Zeilen (`summiereSaisonBilanz`), Kaderstärke aus `buildTeamDisciplineRankRowsFromGameState`,
 * Paarungen aus `buildSpieltagsUebersicht`. Was es (noch) nicht gibt — Kassenkurve je Spieltag, Apron-Abstand,
 * Einsatzliste je Disziplin, Spieler des Tages —, liefert diese Funktion NICHT und die Ansicht blendet es aus.
 *
 * React-frei, damit Papierform-Regel, Ampel, Liga-Tabelle und Saisonbilanz ohne Rendering prüfbar sind.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";
import { buildSpieltagsUebersicht, type SpieltagsPaarung, type SpieltagsUebersicht } from "@/lib/foundation/season-matchday-fixtures-overview";
import { buildTeamDisciplineRankRowsFromGameState, type TeamDisciplineRankRowCore } from "@/lib/foundation/team-discipline-rank-engine";
import { baueFormMoralAnzeige, type FormMoralAnzeige } from "@/lib/lineups/form-moral-anzeige";
import { getSeasonDisciplineScheduleEntry } from "@/lib/season/season-discipline-schedule";
import { LEAGUE_SIZE, type LeagueTier } from "@/lib/season/league-split";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import {
  bestimmeZone,
  formAusVerlauf,
  istDuellVerlauf,
  lagesatz,
  stehtAufDemSpiel,
  ZONEN_MARKE_ENDE,
  type FormTon,
  type SaisonVerlauf,
  type SaisonstandZone,
  type StehtAufDemSpiel,
} from "@/lib/season/saisonstand-modern-logik";
import { summiereSaisonBilanz, type SaisonBilanz } from "@/lib/standings/standings-bilanz";
import {
  baueAbgeleiteteEntscheidungen,
  bestesHeimspiel,
  einsatzStatus,
  spielerDerSaison,
  spielerDesTages,
  type AbgeleiteteEntscheidung,
  type EinsatzStatus,
  type SeitenEinsatz,
  type SpielerEhrung,
} from "@/lib/foundation/startseite-modern-zustand";

/* ------------------------------------------------------------------ Regeln (reine Anzeige) */

export type Ton = "plus" | "minus" | "acht";

/**
 * Papierform-Wort aus dem Kaderstärke-Anteil A/(A+B) in Prozent. Chris-PM 18.11.: erst ab 55 % „Vorteil",
 * unter 45 % „Nachteil", dazwischen „offen". Eine Anzeigeregel, keine Siegchance.
 */
export function papierform(anteilProzent: number | null | undefined): { wort: "Vorteil" | "Nachteil" | "offen"; ton: Ton } | null {
  if (anteilProzent == null || !Number.isFinite(anteilProzent)) return null;
  if (anteilProzent >= 55) return { wort: "Vorteil", ton: "plus" };
  if (anteilProzent <= 45) return { wort: "Nachteil", ton: "minus" };
  return { wort: "offen", ton: "acht" };
}

/** Vierergruppe: Rang 1 der Kaderstärke „Vorteil", Rang 4 „Nachteil", sonst „offen". */
export function papierformVierer(rangInGruppe: number | null | undefined): { wort: "Vorteil" | "Nachteil" | "offen"; ton: Ton } | null {
  if (rangInGruppe == null || !Number.isFinite(rangInGruppe)) return null;
  if (rangInGruppe <= 1) return { wort: "Vorteil", ton: "plus" };
  if (rangInGruppe >= 4) return { wort: "Nachteil", ton: "minus" };
  return { wort: "offen", ton: "acht" };
}

export type Ampel = "a" | "b" | "c" | "";

/** Top-10-Ampel der Disziplin-Kacheln: 1–3 grün, 4–6 gelb, 7–10 rot, ab 11 neutral. */
export function ampelFuerRang(rang: number | null | undefined): Ampel {
  if (rang == null || !Number.isFinite(rang) || rang < 1) return "";
  if (rang <= 3) return "a";
  if (rang <= 6) return "b";
  if (rang <= 10) return "c";
  return "";
}

/** „14-0-10" — S-U-N zählt Disziplin-Duelle, nicht Spieltage. */
export function sunText(b: Pick<SaisonBilanz, "siege" | "unentschieden" | "niederlagen">): string {
  return `${b.siege}-${b.unentschieden}-${b.niederlagen}`;
}

/** Anzahl Duelle hinter S-U-N: „24 Duelle" (nie „Spiele"). */
export function duelleText(b: Pick<SaisonBilanz, "siege" | "unentschieden" | "niederlagen">): string {
  const n = b.siege + b.unentschieden + b.niederlagen;
  return `${n} ${n === 1 ? "Duell" : "Duelle"}`;
}

/* ------------------------------------------------------------------ Eingabe und Ausgabe */

export type StartseiteStandRow = {
  teamId: string;
  teamName: string;
  teamCode: string;
  rank: number | null;
  points: number | null;
  verhaeltnis: number | null;
  logoUrl: string | null;
  logoInitials: string;
  leagueTier: LeagueTier | null;
};

export type LigaZeile = {
  teamId: string;
  name: string;
  code: string;
  logoUrl: string | null;
  logoInitials: string;
  /** Platz in der Liga; `null` vor der ersten Wertung (Tabelle dann alphabetisch). */
  rang: number | null;
  punkte: number;
  verhaeltnis: number | null;
  bilanz: SaisonBilanz | null;
  form: FormTon[];
  /** >0 = Plätze gutgemacht, <0 = verloren. */
  bewegung: number | null;
  zone: SaisonstandZone | null;
  istEigen: boolean;
  istGegner: boolean;
};

export type KartenMitglied = { teamId: string; name: string; logoUrl: string | null; logoInitials: string; rang: number | null; staerke: number; istEigen: boolean };

export type SpieltagsKarte = {
  disciplineId: string;
  name: string;
  /** Kulissenname (PixelLab), falls die Disziplin illustrierte Kulissen hat. */
  kulisse: string | null;
  bild: string | null;
  durchgang: 1 | 2 | null;
  art: "duell" | "vierer";
  rangEigen: number | null;
  rangGegner: number | null;
  /** Anteil der eigenen Kaderstärke an A+B in Prozent (nur Duell). */
  anteil: number | null;
  papier: { wort: "Vorteil" | "Nachteil" | "offen"; ton: Ton } | null;
  gruppe: KartenMitglied[];
  /** Einsatzliste dieser Disziplin-Seite (x von n Plätzen); `null`, wenn der Entwurf nicht zum gezeigten Spieltag gehört. */
  einsatz: SeitenEinsatz | null;
  /** Hat das Team einen Formkarten-Pool? Sonst gibt es nichts zu legen und die Zeile entfällt. */
  hatFormkartenPool: boolean;
};

export type NaechsterSpieltag = {
  nummer: number;
  heim: boolean | null;
  gegner: { teamId: string; name: string; logoUrl: string | null; logoInitials: string; rang: number | null; punkte: number | null; bilanz: SaisonBilanz | null } | null;
  karten: SpieltagsKarte[];
};

export type DisziplinKachel = {
  disciplineId: string;
  name: string;
  rang: number | null;
  ampel: Ampel;
  heute: boolean;
  punkte: number;
  moeglich: number;
  bild: string | null;
};

export type LetzteMeldung = { id: string; disziplin: string; text: string; ergebnis: string | null; punkte: number; ton: "plus" | "minus" | "acht" | "null" };

export type Saisonbilanz = {
  rang: number | null;
  wort: string | null;
  punkte: number;
  bilanz: SaisonBilanz | null;
  verhaeltnis: number | null;
  zeilen: Array<{ label: string; wert: string }>;
};

export type StartseiteDaten = {
  ligaTier: LeagueTier | null;
  ligaName: string;
  zeilen: LigaZeile[];
  eigene: LigaZeile | null;
  hatWertung: boolean;
  gespielteSpieltage: number;
  gesamtSpieltage: number;
  saisonEnde: boolean;
  lage: string;
  naechster: NaechsterSpieltag | null;
  dieseDisziplinen: string[];
  disziplinen: DisziplinKachel[];
  aufDemSpiel: StehtAufDemSpiel[];
  letzterSpieltag: { nummer: number; punkte: number; moeglich: number; meldungen: LetzteMeldung[] } | null;
  bilanzEnde: Saisonbilanz | null;
  /** Die zwei Kulissenbilder für den Kopf (Disziplin 1 links, 2 rechts). */
  kopfBilder: string[];
  formMoral: Record<string, FormMoralAnzeige>;
  tabellenfuehrer: { name: string; punkte: number } | null;
  einsatz: EinsatzStatus | null;
  /** Aus dem echten Zustand abgeleitete Entscheidungen (Einsatzliste, Minuskarte, Moral, Verträge). */
  entscheidungen: AbgeleiteteEntscheidung[];
  spielerDesTages: (SpielerEhrung & { formStufe: number | null }) | null;
};

export type StartseiteEingabe = {
  gameState: GameState;
  teamId: string;
  saveId?: string | null;
  rows: readonly StartseiteStandRow[];
  verlauf: SaisonVerlauf | null;
  bewegungByTeamId?: (teamId: string) => number | null;
  /** Nur für Tests: eigene Übersicht statt `buildSpieltagsUebersicht`. */
  uebersichtFuer?: (matchdayId: string) => SpieltagsUebersicht | null;
  /** Nur für Tests: fertige Stärke-Zeilen. */
  staerkeZeilen?: readonly TeamDisciplineRankRowCore[];
};

/* ------------------------------------------------------------------ Duellpunkte des eigenen Teams */

/** Duellpunkte (2/1/0 je Einsatz) und mögliche Punkte des Teams je Disziplin, aus den gebuchten Zeilen. */
export function duellPunkteEigen(gameState: Pick<GameState, "seasonState" | "season">, teamId: string): Map<string, { punkte: number; moeglich: number }> {
  const gewertet = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((r) => r.seasonId === gameState.season.id && r.status === "preview_applied")
      .map((r) => r.id),
  );
  const aus = new Map<string, { punkte: number; moeglich: number }>();
  for (const row of gameState.seasonState.disciplineResults ?? []) {
    if (row.teamId !== teamId || !gewertet.has(row.matchdayResultId)) continue;
    const quelle = row.resolutionSource;
    if (!(quelle === "arena" || quelle === "pps_duell" || quelle === "mini_dm_pod") || typeof row.teamPoints !== "number") continue;
    const zelle = aus.get(row.disciplineId) ?? { punkte: 0, moeglich: 0 };
    zelle.punkte += row.teamPoints;
    zelle.moeglich += 2;
    aus.set(row.disciplineId, zelle);
  }
  return aus;
}

/* ------------------------------------------------------------------ Hilfen */

const ligaName = (tier: LeagueTier | null): string => {
  const m = /^liga(\d+)$/.exec(tier ?? "");
  return m ? `Liga ${m[1]}` : "Gesamt";
};

const nummerAusId = (gameState: GameState, matchdayId: string): number => gameState.season.matchdayIds.indexOf(matchdayId) + 1;

function eigenePaarung(uebersicht: SpieltagsUebersicht | null, teamId: string): SpieltagsPaarung | null {
  if (!uebersicht) return null;
  return uebersicht.paarungen.find((p) => p.homeTeamId === teamId || p.awayTeamId === teamId) ?? null;
}

/** Eigene Seite eines Duell-Ergebnisses: 0..10-Wert und Teampunkte. */
function eigeneSeite(d: SpieltagsPaarung["disziplinen"][number], heim: boolean): { punkte: number | null; eigen: number | null; fremd: number | null } {
  const punkte = heim ? d.punkteHeim : d.punkteGast;
  const norm = d.ergebnisNormiert;
  return {
    punkte,
    eigen: norm ? (heim ? norm[0] : norm[1]) : null,
    fremd: norm ? (heim ? norm[1] : norm[0]) : null,
  };
}

/* ------------------------------------------------------------------ Hauptfunktion */

export function baueStartseiteModern(eingabe: StartseiteEingabe): StartseiteDaten {
  const { gameState, teamId, saveId = null, rows, verlauf } = eingabe;
  const eigeneRow = rows.find((r) => r.teamId === teamId) ?? null;
  const tier = eigeneRow?.leagueTier ?? null;
  const bilanzen = summiereSaisonBilanz(gameState, gameState.season.id);
  const duellVerlauf = istDuellVerlauf(verlauf);

  const gesamtSpieltage = gameState.season.matchdayIds.length;
  const gespielteAusVerlauf = verlauf ? verlauf.spieltage.filter((t) => t.played).length : null;
  const gespielteAusResultaten = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((r) => r.seasonId === gameState.season.id && r.status === "preview_applied")
      .map((r) => r.matchdayId),
  ).size;
  const gespielteSpieltage = Math.min(gesamtSpieltage, Math.max(gespielteAusVerlauf ?? 0, gespielteAusResultaten));
  const saisonEnde = isSeasonEndPhase(gameState.gamePhase) || (gesamtSpieltage > 0 && gespielteSpieltage >= gesamtSpieltage);
  const hatWertung = gespielteSpieltage > 0;

  /* ---- Liga-Tabelle */
  const ligaRows = rows.filter((r) => (tier ? r.leagueTier === tier : true));
  const gegnerIdVorab = ((): string | null => {
    const id = gameState.season.matchdayIds[Math.min(gespielteSpieltage, gesamtSpieltage - 1)];
    if (!id || saisonEnde) return null;
    const p = eigenePaarung((eingabe.uebersichtFuer ?? ((m) => buildSpieltagsUebersicht(gameState, m, { saveId })))(id), teamId);
    if (!p) return null;
    return p.homeTeamId === teamId ? p.awayTeamId : p.homeTeamId;
  })();

  const zeilenRoh: LigaZeile[] = ligaRows.map((r) => ({
    teamId: r.teamId,
    name: r.teamName,
    code: r.teamCode,
    logoUrl: r.logoUrl,
    logoInitials: r.logoInitials,
    rang: hatWertung ? r.rank : null,
    punkte: r.points ?? 0,
    verhaeltnis: hatWertung ? r.verhaeltnis : null,
    bilanz: bilanzen?.get(r.teamId) ?? null,
    form: duellVerlauf ? formAusVerlauf(verlauf?.byTeamId[r.teamId], 5).map((f) => f.ton) : [],
    bewegung: hatWertung ? eingabe.bewegungByTeamId?.(r.teamId) ?? null : null,
    zone: hatWertung || saisonEnde ? bestimmeZone(r.leagueTier, r.rank) : null,
    istEigen: r.teamId === teamId,
    istGegner: r.teamId === gegnerIdVorab,
  }));
  const zeilen = hatWertung
    ? [...zeilenRoh].sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999) || b.punkte - a.punkte)
    : [...zeilenRoh].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const eigene = zeilen.find((z) => z.istEigen) ?? null;

  const ligaFuerLage = zeilen.map((z) => ({ teamId: z.teamId, teamName: z.name, rank: z.rang, points: z.punkte, leagueTier: tier }));
  const lageZeile = eigene ? { teamId: eigene.teamId, teamName: eigene.name, rank: eigene.rang, points: hatWertung ? eigene.punkte : null, leagueTier: tier } : null;
  const lage = lageZeile ? lagesatz(lageZeile, ligaFuerLage) : "";
  const verbleibend = Math.max(0, gesamtSpieltage - gespielteSpieltage);
  const aufDemSpiel = lageZeile && hatWertung && !saisonEnde ? stehtAufDemSpiel({ ...lageZeile, points: eigene?.punkte ?? null }, ligaFuerLage, verbleibend) : [];

  /* ---- Kaderstärke je Disziplin */
  const staerke = eingabe.staerkeZeilen ?? buildTeamDisciplineRankRowsFromGameState(gameState, gameState.disciplines);
  const staerkeById = new Map(staerke.map((s) => [s.teamId, s] as const));
  const eigeneStaerke = staerkeById.get(teamId) ?? null;
  const zeileDe = (id: string) => rows.find((r) => r.teamId === id) ?? null;
  const mitglied = (id: string, disciplineId: string): KartenMitglied => {
    const r = zeileDe(id);
    const s = staerkeById.get(id);
    return {
      teamId: id,
      name: r?.teamName ?? s?.teamName ?? id,
      logoUrl: r?.logoUrl ?? null,
      logoInitials: r?.logoInitials ?? "?",
      rang: s?.disciplineRanks[disciplineId] ?? null,
      staerke: s?.scorePack.disciplines[disciplineId] ?? 0,
      istEigen: id === teamId,
    };
  };

  /* ---- Nächster Spieltag */
  const uebersichtFuer = eingabe.uebersichtFuer ?? ((m: string) => buildSpieltagsUebersicht(gameState, m, { saveId }));
  const naechsteId = !saisonEnde && gesamtSpieltage > 0 ? gameState.season.matchdayIds[Math.min(gespielteSpieltage, gesamtSpieltage - 1)] ?? null : null;
  const eintrag = naechsteId ? getSeasonDisciplineScheduleEntry(gameState, naechsteId, { saveId }) : null;
  const dieseDisziplinen = [eintrag?.discipline1?.disciplineId, eintrag?.discipline2?.disciplineId].filter((x): x is string => Boolean(x));
  const dName = (id: string) => gameState.disciplines.find((d) => d.id === id)?.name ?? id;

  const einsatz = naechsteId ? einsatzStatus(gameState, teamId, naechsteId) : null;
  let naechster: NaechsterSpieltag | null = null;
  if (naechsteId) {
    const uebersicht = uebersichtFuer(naechsteId);
    const paarung = eigenePaarung(uebersicht, teamId);
    const karten: SpieltagsKarte[] = [];
    let gegner: NaechsterSpieltag["gegner"] = null;
    if (paarung) {
      const heim = paarung.homeTeamId === teamId;
      const gegnerId = heim ? paarung.awayTeamId : paarung.homeTeamId;
      const gz = zeileDe(gegnerId);
      gegner = {
        teamId: gegnerId,
        name: gz?.teamName ?? gegnerId,
        logoUrl: gz?.logoUrl ?? null,
        logoInitials: gz?.logoInitials ?? "?",
        rang: hatWertung ? gz?.rank ?? null : null,
        punkte: hatWertung ? gz?.points ?? 0 : null,
        bilanz: bilanzen?.get(gegnerId) ?? null,
      };
      for (const d of [...paarung.disziplinen].sort((a, b) => a.disciplineSide.localeCompare(b.disciplineSide))) {
        const podId = heim ? d.miniDmPodIdHeim : d.miniDmPodIdGast;
        const kulisseId = d.kulisse?.id ?? null;
        const basis = {
          disciplineId: d.disciplineId,
          name: d.disciplineName || dName(d.disciplineId),
          kulisse: d.kulisse?.label ?? null,
          bild: einsatzlisteKulisseBild(d.disciplineId, kulisseId),
          durchgang: d.occurrenceInSeason,
        };
        if (podId) {
          const pod = (uebersicht?.miniDmPods ?? []).find((p) => p.podId === podId);
          const gruppe = (pod?.mitglieder ?? []).map((m) => mitglied(m.teamId, d.disciplineId));
          const nachStaerke = [...gruppe].sort((a, b) => b.staerke - a.staerke);
          const platz = nachStaerke.findIndex((g) => g.istEigen) + 1;
          karten.push({
            ...basis,
            art: "vierer",
            rangEigen: eigeneStaerke?.disciplineRanks[d.disciplineId] ?? null,
            rangGegner: null,
            anteil: null,
            papier: platz > 0 ? papierformVierer(platz) : null,
            gruppe: nachStaerke,
            einsatz: einsatz ? einsatz[d.disciplineSide] : null,
            hatFormkartenPool: einsatz?.hatFormkartenPool ?? false,
          });
        } else {
          const a = eigeneStaerke?.scorePack.disciplines[d.disciplineId] ?? 0;
          const g = staerkeById.get(gegnerId)?.scorePack.disciplines[d.disciplineId] ?? 0;
          const anteil = a + g > 0 ? (a / (a + g)) * 100 : null;
          karten.push({
            ...basis,
            art: "duell",
            rangEigen: eigeneStaerke?.disciplineRanks[d.disciplineId] ?? null,
            rangGegner: staerkeById.get(gegnerId)?.disciplineRanks[d.disciplineId] ?? null,
            anteil,
            papier: papierform(anteil),
            gruppe: [],
            einsatz: einsatz ? einsatz[d.disciplineSide] : null,
            hatFormkartenPool: einsatz?.hatFormkartenPool ?? false,
          });
        }
      }
      naechster = { nummer: nummerAusId(gameState, naechsteId), heim, gegner, karten };
    } else {
      naechster = { nummer: nummerAusId(gameState, naechsteId), heim: null, gegner: null, karten: [] };
    }
  }

  /* ---- Disziplin-Kacheln */
  const punkteEigen = duellPunkteEigen(gameState, teamId);
  const disziplinen: DisziplinKachel[] = gameState.disciplines
    .map((d) => {
      const z = punkteEigen.get(d.id);
      const rang = eigeneStaerke?.disciplineRanks[d.id] ?? null;
      return {
        disciplineId: d.id,
        name: d.name,
        rang: rang && rang > 0 ? rang : null,
        ampel: ampelFuerRang(rang),
        heute: dieseDisziplinen.includes(d.id),
        punkte: z?.punkte ?? 0,
        moeglich: z?.moeglich ?? 0,
        bild: einsatzlisteKulisseBild(d.id),
      };
    })
    .sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999) || a.name.localeCompare(b.name, "de"));

  /* ---- Letzter Spieltag */
  let letzterSpieltag: StartseiteDaten["letzterSpieltag"] = null;
  if (hatWertung) {
    const letzteId = gameState.season.matchdayIds[gespielteSpieltage - 1];
    const uebersicht = letzteId ? uebersichtFuer(letzteId) : null;
    const paarung = eigenePaarung(uebersicht, teamId);
    if (letzteId && paarung) {
      const heim = paarung.homeTeamId === teamId;
      const gegnerName = zeileDe(heim ? paarung.awayTeamId : paarung.homeTeamId)?.teamName ?? "";
      const meldungen: LetzteMeldung[] = [];
      let summe = 0;
      let moeglich = 0;
      for (const d of paarung.disziplinen) {
        if (!d.gespielt) continue;
        const podId = heim ? d.miniDmPodIdHeim : d.miniDmPodIdGast;
        if (podId) {
          const pod = (uebersicht?.miniDmPods ?? []).find((p) => p.podId === podId);
          const m = pod?.mitglieder.find((x) => x.teamId === teamId);
          if (m && m.teamPoints != null) {
            summe += m.teamPoints;
            moeglich += 2;
            meldungen.push({
              id: `${d.disciplineId}-pod`,
              disziplin: d.disciplineName,
              text: m.platz ? `Platz ${m.platz} in der Vierergruppe` : "Vierergruppe",
              ergebnis: null,
              punkte: m.teamPoints,
              ton: m.teamPoints >= 2 ? "plus" : m.teamPoints >= 1 ? "acht" : "null",
            });
          }
          continue;
        }
        const s = eigeneSeite(d, heim);
        if (s.punkte == null) continue;
        summe += s.punkte;
        moeglich += 2;
        meldungen.push({
          id: d.disciplineId,
          disziplin: d.disciplineName,
          text: `${s.punkte >= 2 ? "Sieg" : s.punkte >= 1 ? "Remis" : "Niederlage"}${gegnerName ? ` gegen ${gegnerName}` : ""}`,
          ergebnis: s.eigen != null && s.fremd != null ? `${s.eigen} : ${s.fremd}` : null,
          punkte: s.punkte,
          ton: s.punkte >= 2 ? "plus" : s.punkte >= 1 ? "acht" : "null",
        });
      }
      if (meldungen.length > 0) letzterSpieltag = { nummer: nummerAusId(gameState, letzteId), punkte: summe, moeglich, meldungen };
    }
  }

  /* ---- Saisonbilanz (nach Spieltag 20) */
  let bilanzEnde: Saisonbilanz | null = null;
  if (saisonEnde && eigene) {
    const zellen = [...punkteEigen.entries()].filter(([, z]) => z.moeglich > 0);
    const anteil = (z: { punkte: number; moeglich: number }) => z.punkte / z.moeglich;
    const beste = [...zellen].sort((a, b) => anteil(b[1]) - anteil(a[1]) || b[1].moeglich - a[1].moeglich)[0];
    const schwaechste = [...zellen].sort((a, b) => anteil(a[1]) - anteil(b[1]) || b[1].moeglich - a[1].moeglich)[0];
    const naechsterDarunter = zeilen.find((z) => z.rang === (eigene.rang ?? 0) + 1);
    const zeilenBilanz: Saisonbilanz["zeilen"] = [];
    if (beste) zeilenBilanz.push({ label: "Beste Disziplin", wert: `${dName(beste[0])} · ${beste[1].punkte} von ${beste[1].moeglich} Pkt` });
    if (schwaechste && schwaechste[0] !== beste?.[0]) zeilenBilanz.push({ label: "Schwächste Disziplin", wert: `${dName(schwaechste[0])} · ${schwaechste[1].punkte} von ${schwaechste[1].moeglich} Pkt` });
    if (naechsterDarunter) {
      const d = eigene.punkte - naechsterDarunter.punkte;
      zeilenBilanz.push({ label: "Abstand nach hinten", wert: `${d >= 0 ? "+" : "−"}${Math.abs(d)} Pkt auf ${naechsterDarunter.name} (${naechsterDarunter.rang}.)` });
    }
    const saisonSpieler = spielerDerSaison(gameState, teamId);
    if (saisonSpieler) zeilenBilanz.push({ label: "Spieler der Saison", wert: `${saisonSpieler.name} · ${saisonSpieler.text}` });
    const heim = bestesHeimspiel(gameState, teamId);
    if (heim) {
      const gegnerName = zeileDe(heim.gegnerId)?.teamName ?? heim.gegnerId;
      zeilenBilanz.push({ label: "Bestes Heimspiel", wert: `Spieltag ${heim.spieltag} · ${heim.punkte} von ${heim.moeglich} Pkt gegen ${gegnerName}` });
    }
    bilanzEnde = {
      rang: eigene.rang,
      wort: eigene.zone ? ZONEN_MARKE_ENDE[eigene.zone] : null,
      punkte: eigene.punkte,
      bilanz: eigene.bilanz,
      verhaeltnis: eigene.verhaeltnis,
      zeilen: zeilenBilanz,
    };
  }

  /* ---- Form und Moral des Kaders */
  const formMoral: Record<string, FormMoralAnzeige> = {};
  for (const r of gameState.rosters) {
    if (r.teamId === teamId) formMoral[r.playerId] = baueFormMoralAnzeige(gameState, r.playerId);
  }

  const kopfBilder = dieseDisziplinen
    .map((id) => naechster?.karten.find((k) => k.disciplineId === id)?.bild ?? einsatzlisteKulisseBild(id))
    .filter((x): x is string => Boolean(x));
  const fuehrer = hatWertung ? zeilen[0] ?? null : null;
  const entscheidungen = baueAbgeleiteteEntscheidungen({ gameState, teamId, einsatz, formMoral, gespielteSpieltage, gesamtSpieltage, saisonEnde });
  const tagesEhrung = hatWertung ? spielerDesTages(gameState, teamId, gameState.season.matchdayIds[gespielteSpieltage - 1] ?? "") : null;

  return {
    ligaTier: tier,
    ligaName: ligaName(tier),
    zeilen,
    eigene,
    hatWertung,
    gespielteSpieltage,
    gesamtSpieltage,
    saisonEnde,
    lage,
    naechster,
    dieseDisziplinen,
    disziplinen,
    aufDemSpiel,
    letzterSpieltag,
    bilanzEnde,
    kopfBilder,
    formMoral,
    tabellenfuehrer: fuehrer ? { name: fuehrer.name, punkte: fuehrer.punkte } : null,
    einsatz,
    entscheidungen,
    spielerDesTages: tagesEhrung ? { ...tagesEhrung, formStufe: formMoral[tagesEhrung.playerId]?.formVerfuegbar ? formMoral[tagesEhrung.playerId]!.formStufe : null } : null,
  };
}

export const STARTSEITE_LIGA_GROESSE = LEAGUE_SIZE;
