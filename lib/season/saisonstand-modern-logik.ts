/**
 * SAISONSTAND MODERN — die reine Logik hinter der Broadcast-Ansicht (18.11.).
 *
 * Vorlage: public/mockups/saisonstand-modern-17-11.html, Entwurf: docs/design/saisonstand-modern-17-11.md.
 * Nichts hier erfindet Spielwerte: Rang, Punkte, Liga kommen fertig aus den Standings-Zeilen, die
 * Zeitreihe aus dem Feld-Rennen-Ledger. Neu gerechnet wird nur Anzeige: Zonen, Lagesatz, Abstände,
 * Form-Kästchen, Ranglinien je Liga, Heatmap-Anteile. React-frei, damit alles ohne Rendering prüfbar ist.
 */
import { LEAGUE_SIZE, RELEGATION_COUNT, type LeagueTier } from "@/lib/season/league-split";
import type { SpieltagsUebersicht } from "@/lib/foundation/season-matchday-fixtures-overview";

/** Titel (Liga 1, Platz 1), Aufstieg (Liga 2, Plätze 1–3), Abstieg (Liga 1, Plätze 14–16). */
export type SaisonstandZone = "titel" | "aufstieg" | "abstieg";

/** Das Minimum, das die Logik an einer Tabellenzeile liest. */
export type SaisonstandZeile = {
  teamId: string;
  teamName: string;
  rank: number | null;
  points: number | null;
  leagueTier?: LeagueTier | null;
  isSelected?: boolean;
};

export function bestimmeZone(tier: LeagueTier | null | undefined, rank: number | null | undefined): SaisonstandZone | null {
  if (!tier || rank == null || !Number.isFinite(rank)) return null;
  if (tier === "liga1") {
    if (rank === 1) return "titel";
    if (rank > LEAGUE_SIZE - RELEGATION_COUNT) return "abstieg";
    return null;
  }
  return rank <= RELEGATION_COUNT ? "aufstieg" : null;
}

export const ZONEN_TEXT: Record<SaisonstandZone, string> = {
  titel: "Meisterschaft",
  aufstieg: "Aufstieg in Liga 1",
  abstieg: "Abstieg in Liga 2",
};

/** Saisonende: aus den Zonen werden die Marken „Meister", „Aufstieg", „Abstieg". */
export const ZONEN_MARKE_ENDE: Record<SaisonstandZone, string> = {
  titel: "Meister",
  aufstieg: "Aufstieg",
  abstieg: "Abstieg",
};

export type LigaAnsicht = "liga1" | "liga2" | "gesamt";

export function teileNachLiga<T extends { leagueTier?: LeagueTier | null; rank: number | null }>(
  zeilen: readonly T[],
): { liga1: T[]; liga2: T[]; ohne: T[] } {
  const nachRang = (a: T, b: T) => (a.rank ?? 999) - (b.rank ?? 999);
  return {
    liga1: zeilen.filter((z) => z.leagueTier === "liga1").sort(nachRang),
    liga2: zeilen.filter((z) => z.leagueTier === "liga2").sort(nachRang),
    ohne: zeilen.filter((z) => !z.leagueTier).sort(nachRang),
  };
}

const punkte = (z: Pick<SaisonstandZeile, "points"> | undefined | null) => (z?.points != null && Number.isFinite(z.points) ? z.points : null);
const pktText = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? "Pkt" : "Pkt"}`;

/**
 * Die Lage in einem Satz („1 Pkt hinter Aufstiegsplatz 3"). `liga` ist die nach Rang sortierte
 * Zeilenliste der Liga des Teams. Ohne Wertung (Saisonstart) gibt es keine Punkte, nur den Startplatz.
 */
export function lagesatz(zeile: SaisonstandZeile, liga: readonly SaisonstandZeile[]): string {
  const eigene = punkte(zeile);
  if (eigene == null) return zeile.rank != null ? `Startplatz ${zeile.rank}` : "Noch keine Wertung";
  const tier = zeile.leagueTier ?? null;
  const rang = zeile.rank;
  if (!tier || rang == null) return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(eigene)} Punkte`;
  const beiRang = (r: number) => punkte(liga.find((z) => z.rank === r));
  if (tier === "liga2") {
    const grenze = beiRang(RELEGATION_COUNT);
    if (rang > RELEGATION_COUNT) {
      return grenze != null ? `${pktText(grenze - eigene)} hinter Aufstiegsplatz ${RELEGATION_COUNT}` : "Außerhalb der Aufstiegsplätze";
    }
    const erster = beiRang(RELEGATION_COUNT + 1);
    return erster != null ? `${pktText(eigene - erster)} vor Platz ${RELEGATION_COUNT + 1}` : "Auf einem Aufstiegsplatz";
  }
  const rettung = LEAGUE_SIZE - RELEGATION_COUNT;
  if (rang > rettung) {
    const grenze = beiRang(rettung);
    return grenze != null ? `${pktText(grenze - eigene)} hinter Rettungsplatz ${rettung}` : "In der Abstiegszone";
  }
  if (rang === 1) {
    const zweiter = beiRang(2);
    return zweiter != null ? `${pktText(eigene - zweiter)} vor Platz 2` : "Tabellenführer";
  }
  const abstieg = beiRang(rettung + 1);
  return abstieg != null ? `${pktText(eigene - abstieg)} vor der Abstiegszone` : `Platz ${rang}`;
}

export type StehtAufDemSpiel = { id: string; label: string; wert: string; ton: "gut" | "warn" | "leise" };

/**
 * „Was auf dem Spiel steht": Abstand an Titel-, Aufstiegs- und Abstiegslinie, plus die höchstens noch
 * erreichbaren Punkte (Basis 2 Einsätze × 2 Punkte je Spieltag; Bonus und Mutator sind darin nicht gerechnet).
 */
export function stehtAufDemSpiel(
  zeile: SaisonstandZeile,
  liga: readonly SaisonstandZeile[],
  verbleibendeSpieltage: number | null,
): StehtAufDemSpiel[] {
  const eigene = punkte(zeile);
  const tier = zeile.leagueTier ?? null;
  const rang = zeile.rank;
  const aus: StehtAufDemSpiel[] = [];
  if (eigene == null || !tier || rang == null) return aus;
  const beiRang = (r: number) => punkte(liga.find((z) => z.rank === r));
  const vorzeichen = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "±0");
  if (tier === "liga1") {
    const erster = beiRang(1);
    if (erster != null && rang !== 1) aus.push({ id: "titel", label: "Zum Titel", wert: `${vorzeichen(eigene - erster)} Pkt`, ton: "leise" });
    const rettung = beiRang(LEAGUE_SIZE - RELEGATION_COUNT);
    const ersterAbsteiger = beiRang(LEAGUE_SIZE - RELEGATION_COUNT + 1);
    if (rang > LEAGUE_SIZE - RELEGATION_COUNT && rettung != null) aus.push({ id: "rettung", label: "Zur Rettung", wert: `${vorzeichen(eigene - rettung)} Pkt`, ton: "warn" });
    else if (ersterAbsteiger != null) aus.push({ id: "abstieg", label: "Zur Abstiegszone", wert: `${vorzeichen(eigene - ersterAbsteiger)} Pkt`, ton: "gut" });
  } else {
    const grenze = beiRang(RELEGATION_COUNT);
    const darunter = beiRang(RELEGATION_COUNT + 1);
    if (rang > RELEGATION_COUNT && grenze != null) aus.push({ id: "aufstieg", label: "Zum Aufstieg", wert: `${vorzeichen(eigene - grenze)} Pkt`, ton: "leise" });
    else if (darunter != null) aus.push({ id: "polster", label: "Polster auf Platz 4", wert: `${vorzeichen(eigene - darunter)} Pkt`, ton: "gut" });
  }
  if (verbleibendeSpieltage != null && verbleibendeSpieltage >= 0) {
    aus.push({ id: "rest", label: `Noch ${verbleibendeSpieltage} Spieltage`, wert: `bis ${verbleibendeSpieltage * 4} Pkt`, ton: "leise" });
  }
  return aus;
}

/** Zeile des Feld-Rennen-Ledgers, so schmal wie die Ansicht sie braucht. */
export type VerlaufEintrag = { played: boolean; tagespunkte: number | null; cumulativePoints: number };
export type SaisonVerlauf = {
  /** Spieltags-Nummern (1-basiert) in Reihenfolge — ALLE der Saison, gespielt oder nicht. */
  spieltage: Array<{ nummer: number; played: boolean }>;
  byTeamId: Record<string, VerlaufEintrag[]>;
};

/**
 * Die Form-Schwellen (3–4 / 2 / 0–1) gelten nur für Duell-Wertung, in der ein Spieltag höchstens 4
 * Punkte bringt. Ältere Saves (Manager Mode, Rangtabelle) tragen als Tagespunkte die PPs-Summe — dort
 * wäre jede Form „Sieg", also zeigt die Ansicht gar keine.
 */
export function istDuellVerlauf(verlauf: SaisonVerlauf | null | undefined): boolean {
  if (!verlauf) return false;
  let gesehen = false;
  for (const eintraege of Object.values(verlauf.byTeamId)) {
    for (const e of eintraege) {
      if (!e.played || e.tagespunkte == null) continue;
      gesehen = true;
      if (e.tagespunkte > 4) return false;
    }
  }
  return gesehen;
}

export type FormTon = "s" | "u" | "n";

/** Das Mockup zeigt die letzten sechs Spieltage. */
export const FORM_ANZAHL = 6;

/** Immer `anzahl` Plätze: vorn leere Plätze („o"), dann die Form, ältester zuerst. */
export function formPlaetze(form: ReadonlyArray<{ ton: FormTon; punkte: number }>, anzahl = FORM_ANZAHL): Array<{ ton: FormTon | "o"; punkte: number | null }> {
  const rest = form.slice(-anzahl);
  return [
    ...Array.from({ length: Math.max(0, anzahl - rest.length) }, () => ({ ton: "o" as const, punkte: null })),
    ...rest,
  ];
}

/**
 * Form aus den Tagespunkten der letzten gespielten Spieltage: 3–4 Punkte = Sieg (grün),
 * 2 = Unentschieden (grau), 0–1 = Niederlage (rot). Ältester zuerst. Ein Spieltag trägt zwei Einsätze
 * zu je 2/1/0 Punkten, daher höchstens 4 — die Schwellen sind Anzeige, keine Wertungsregel.
 */
export function formAusVerlauf(eintraege: readonly VerlaufEintrag[] | undefined | null, anzahl = FORM_ANZAHL): Array<{ ton: FormTon; punkte: number }> {
  const gespielt = (eintraege ?? []).filter((e) => e.played && e.tagespunkte != null);
  return gespielt.slice(-anzahl).map((e) => {
    const p = e.tagespunkte ?? 0;
    return { ton: p >= 3 ? "s" : p >= 2 ? "u" : "n", punkte: p };
  });
}

export type VerlaufsLinie = { teamId: string; raenge: Array<number | null>; punkte: Array<number | null> };

/**
 * Rang je gespieltem Spieltag, GEZÄHLT INNERHALB DER LIGA des Teams (der Ledger selbst ordnet über
 * alle 32). Gleichstand an Punkten: der heutige Tabellenrang entscheidet — so endet die Linie genau auf
 * dem Platz, den die Tabelle zeigt. Der Verhältnis-Tiebreaker je Spieltag ist nicht gespeichert.
 */
export function baueVerlaufsLinien(verlauf: SaisonVerlauf, zeilen: readonly SaisonstandZeile[]): { tage: number[]; linien: VerlaufsLinie[] } {
  const tage = verlauf.spieltage.filter((t) => t.played).map((t) => t.nummer);
  const gespielteIndizes = verlauf.spieltage.map((t, i) => (t.played ? i : -1)).filter((i) => i >= 0);
  const linien = new Map<string, VerlaufsLinie>(
    zeilen.map((z) => [z.teamId, { teamId: z.teamId, raenge: [], punkte: [] }]),
  );
  for (const index of gespielteIndizes) {
    const tiers = new Map<string, SaisonstandZeile[]>();
    for (const z of zeilen) {
      const key = z.leagueTier ?? "alle";
      tiers.set(key, [...(tiers.get(key) ?? []), z]);
    }
    for (const gruppe of tiers.values()) {
      const mitPunkten = gruppe.map((z) => ({ z, p: verlauf.byTeamId[z.teamId]?.[index]?.cumulativePoints ?? null }));
      mitPunkten.sort((a, b) => (b.p ?? -1) - (a.p ?? -1) || (a.z.rank ?? 999) - (b.z.rank ?? 999));
      mitPunkten.forEach((eintrag, platz) => {
        const linie = linien.get(eintrag.z.teamId);
        if (!linie) return;
        linie.raenge.push(eintrag.p == null ? null : platz + 1);
        linie.punkte.push(eintrag.p);
      });
    }
  }
  return { tage, linien: [...linien.values()] };
}

/**
 * Heatmap-Anteil einer Matrix-Zelle: Wert gegen den besten Wert derselben Disziplin (0..1).
 * Bewusst relativ zur Spalte, nicht gegen ein festes Maximum: wie viele Punkte eine Disziplin bisher
 * hergegeben hat, hängt davon ab, wie oft sie schon lief.
 */
export function matrixAnteil(wert: number | null | undefined, spaltenMaximum: number): number | null {
  if (wert == null || !Number.isFinite(wert)) return null;
  if (!(spaltenMaximum > 0)) return 0;
  return Math.max(0, Math.min(1, wert / spaltenMaximum));
}

/** Tooltip-Text für eine Rangbewegung. */
export function bewegungText(delta: number | null | undefined): { zeichen: "▲" | "▼" | "–"; zahl: number; ton: "plus" | "minus" | "null" } {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return { zeichen: "–", zahl: 0, ton: "null" };
  return delta > 0 ? { zeichen: "▲", zahl: delta, ton: "plus" } : { zeichen: "▼", zahl: Math.abs(delta), ton: "minus" };
}

/**
 * Fünf klar getrennte Stufen je Disziplin-Spalte (Chris 18.11.: „Punkte in der Matrix besser
 * voneinander abheben"). Stufe nach Platz in der Spalte, nicht nach Anteil am Besten: ein
 * Anteils-Verlauf landet bei 16 Teams fast immer im matschigen Mittelfeld.
 * 4 = Spitze (oberstes Fünftel), 3 = gut, 2 = Mitte, 1 = schwach, 0 = Schluss. Gleiche Werte
 * teilen sich die bessere Stufe. null = kein Wert.
 */
export function matrixStufe(wert: number | null | undefined, spaltenWerte: ReadonlyArray<number | null | undefined>): number | null {
  if (wert == null || !Number.isFinite(wert)) return null;
  const gueltig = spaltenWerte.filter((w): w is number => w != null && Number.isFinite(w));
  if (gueltig.length <= 1) return 2;
  const besser = gueltig.filter((w) => w > wert).length;
  return rangStufe(besser + 1, gueltig.length);
}

/** Stufe 0–4 aus einem Platz (1 = bester) unter n Teilnehmern. */
export function rangStufe(platz: number | null | undefined, n: number): number | null {
  if (platz == null || !Number.isFinite(platz) || n <= 0) return null;
  if (n === 1) return 2;
  const anteil = (Math.min(Math.max(platz, 1), n) - 1) / (n - 1);
  return Math.max(0, Math.min(4, 4 - Math.floor(anteil * 5 - 1e-9)));
}

/** EIN Einsatz einer Disziplin: gegen wen, mit welcher Zahl, wie ausgegangen (für den Tooltip der Matrix). */
export type DuellEinsatz = {
  /** Spieltag-Nummer (1-basiert). */
  spieltag: number;
  /** Ein Gegner im Duell, drei in der Vierergruppe. */
  gegner: string[];
  /** 0–10-Normierung (`ergebnisNormiert`), sonst gerundete Rohwerte (`seiten`), sonst null. */
  eigene: number | null;
  gegnerZahl: number | null;
  punkte: number;
  ausgang: "sieg" | "remis" | "niederlage";
  /** Nur Vierergruppe: Platz 1–4. */
  platz: number | null;
};

/** Duellpunkte eines Teams in einer Disziplin: geholt und möglich (2 je gespieltem Einsatz), dazu die Einzeleinsätze. */
export type DuellZelle = { punkte: number; moeglich: number; einsaetze: DuellEinsatz[] };

const ausgangVon = (p: number): DuellEinsatz["ausgang"] => (p >= 2 ? "sieg" : p === 1 ? "remis" : "niederlage");

/** Eine Tooltip-Zeile je Einsatz: „2 Pkt · Sieg 8–4 gegen Royal Court (Spieltag 3)". */
export function einsatzZeile(e: DuellEinsatz, name: (teamId: string) => string): string {
  const wer = e.gegner.map(name).join(", ");
  if (e.platz != null) return `${e.punkte} Pkt · Platz ${e.platz} von 4 · gegen ${wer} (Spieltag ${e.spieltag})`;
  const wort = e.ausgang === "sieg" ? "Sieg" : e.ausgang === "remis" ? "Unentschieden" : "Niederlage";
  const zahlen = e.eigene != null && e.gegnerZahl != null ? ` ${e.eigene}–${e.gegnerZahl}` : "";
  return `${e.punkte} Pkt · ${wort}${zahlen} gegen ${wer} (Spieltag ${e.spieltag})`;
}

/**
 * Duellpunkte je Team und Disziplin (Katalog-Id) über alle gespielten Spieltage — die Zahl, die in
 * die Tabelle eingeht (2 Sieg / 1 Unentschieden / 0 Niederlage, Vierergruppe 2-1-0-0). Chris 18.11.:
 * „warum sind da noch Nachkommastellen? Man bekommt pro Sieg doch 2 Punkte, unentschieden 1."
 * Die Leistungspunkte der Spieler (PPs, mit Komma) gehören nicht in diese Matrix.
 */
export function duellPunkteJeDisziplin(
  uebersichten: ReadonlyArray<Pick<SpieltagsUebersicht, "paarungen" | "miniDmPods"> & { matchdayIndex?: number } | null | undefined>,
): Map<string, Map<string, DuellZelle>> {
  const ergebnis = new Map<string, Map<string, DuellZelle>>();
  const buche = (teamId: string, disciplineId: string, punkte: number, einsatz: Omit<DuellEinsatz, "punkte" | "ausgang">) => {
    let jeDisziplin = ergebnis.get(teamId);
    if (!jeDisziplin) ergebnis.set(teamId, (jeDisziplin = new Map()));
    const zelle = jeDisziplin.get(disciplineId) ?? { punkte: 0, moeglich: 0, einsaetze: [] };
    zelle.punkte += punkte;
    zelle.moeglich += 2;
    zelle.einsaetze.push({ ...einsatz, punkte, ausgang: ausgangVon(punkte) });
    jeDisziplin.set(disciplineId, zelle);
  };
  uebersichten.forEach((u, position) => {
    if (!u) return;
    const spieltag = (u.matchdayIndex ?? position) + 1;
    for (const p of u.paarungen) {
      for (const d of p.disziplinen) {
        if (!d.gespielt || d.punkteHeim == null || d.punkteGast == null) continue;
        // Vierergruppen-Disziplinen (Mini-DM, Battlefield) stehen hier UND in `miniDmPods`: dort zählen,
        // sonst würden die Punkte doppelt gebucht (Pkt-Spalte wäre kleiner als die Zeilensumme).
        // Zahlen aus Sicht der jeweiligen Seite: bevorzugt die 0–10-Normierung, sonst die gerundeten Rohwerte.
        const zahlen: [number, number] | null = d.ergebnisNormiert ?? (d.seiten ? [Math.round(d.seiten[0]), Math.round(d.seiten[1])] : null);
        if (!d.miniDmPodIdHeim) buche(p.homeTeamId, d.disciplineId, d.punkteHeim, { spieltag, gegner: [p.awayTeamId], eigene: zahlen?.[0] ?? null, gegnerZahl: zahlen?.[1] ?? null, platz: null });
        if (!d.miniDmPodIdGast) buche(p.awayTeamId, d.disciplineId, d.punkteGast, { spieltag, gegner: [p.homeTeamId], eigene: zahlen?.[1] ?? null, gegnerZahl: zahlen?.[0] ?? null, platz: null });
      }
    }
    for (const pod of u.miniDmPods ?? []) {
      for (const m of pod.mitglieder) {
        if (m.teamPoints == null) continue;
        buche(m.teamId, pod.disciplineId, m.teamPoints, {
          spieltag, gegner: pod.mitglieder.filter((x) => x.teamId !== m.teamId).map((x) => x.teamId), eigene: null, gegnerZahl: null, platz: m.platz,
        });
      }
    }
  });
  return ergebnis;
}

/** Stufe 0–4 nach Anteil der möglichen Duellpunkte: keine · weniger als die Hälfte · Hälfte · mehr · alle. */
export function anteilStufe(zelle: DuellZelle | null | undefined): number | null {
  if (!zelle || !(zelle.moeglich > 0)) return null;
  const a = zelle.punkte / zelle.moeglich;
  if (a <= 0) return 0;
  if (a >= 1) return 4;
  if (a < 0.5) return 1;
  if (a > 0.5) return 3;
  return 2;
}

/* ------------------------------------------------------------------------------------------------
 * Runde 2 (18.11.): Rang-Bänder der Bereiche, Sparkline, Abstand zum Führer, Kaderstärke-Verhältnis.
 * ---------------------------------------------------------------------------------------------- */

export type RangBand = "gut" | "warn" | "risk";

/** Projekt-Konvention (Top-10-Markierung): Rang 1–3 gut (grün), 4–6 warn (gelb), 7–10 risk (rot), ab 11 keine. */
export function rangBand(rang: number | null | undefined): RangBand | null {
  if (rang == null || !Number.isFinite(rang) || rang < 1) return null;
  if (rang <= 3) return "gut";
  if (rang <= 6) return "warn";
  if (rang <= 10) return "risk";
  return null;
}

/**
 * Rang je Team nach einem Wert (höher = besser) innerhalb der übergebenen Gruppe. Gleichstand teilt den
 * SCHLECHTEREN Rang (wie `buildValueRanks` der klassischen Ansicht): zu Saisonbeginn stehen alle auf 0
 * und bekommen dann keinen grünen Rang. Teams ohne Wert tauchen nicht auf.
 */
export function wertRaenge<T>(gruppe: readonly T[], id: (t: T) => string, wert: (t: T) => number | null | undefined): Map<string, number> {
  const werte = gruppe.map((t) => ({ id: id(t), w: wert(t) })).filter((e): e is { id: string; w: number } => e.w != null && Number.isFinite(e.w));
  return new Map(werte.map((e) => [e.id, werte.filter((o) => o.w >= e.w).length] as const));
}

/** Sparkline des Tabellenplatzes: Punkte für ein `<polyline>` und der Endpunkt. Platz 1 liegt oben. */
export function sparklinePunkte(
  raenge: ReadonlyArray<number | null>,
  ligaGroesse: number,
  breite = 84,
  hoehe = 22,
): { punkte: string; ende: { x: number; y: number } } | null {
  const gueltig = raenge.map((r, i) => ({ r, i })).filter((e): e is { r: number; i: number } => e.r != null && Number.isFinite(e.r));
  if (gueltig.length < 2) return null;
  const n = raenge.length;
  const x = (i: number) => 3 + (i / (n - 1)) * (breite - 8);
  const y = (r: number) => 3 + ((r - 1) / Math.max(ligaGroesse - 1, 1)) * (hoehe - 6);
  const punkte = gueltig.map((e) => `${x(e.i).toFixed(1)},${y(e.r).toFixed(1)}`);
  const letzter = gueltig[gueltig.length - 1]!;
  return { punkte: punkte.join(" "), ende: { x: Number(x(letzter.i).toFixed(1)), y: Number(y(letzter.r).toFixed(1)) } };
}

/** Punkte hinter dem Tabellenführer der Liga (Zahl > 0); der Führer selbst und Teams ohne Wertung: null. */
export function abstandZumFuehrer(zeile: Pick<SaisonstandZeile, "points">, liga: ReadonlyArray<Pick<SaisonstandZeile, "points">>): number | null {
  const eigene = punkte(zeile);
  if (eigene == null) return null;
  const beste = Math.max(...liga.map((z) => punkte(z) ?? Number.NEGATIVE_INFINITY));
  if (!Number.isFinite(beste)) return null;
  const abstand = beste - eigene;
  return abstand > 0 ? abstand : null;
}

/**
 * Kaderstärke-Verhältnis zweier Teams in einer Disziplin: Anteil A an A+B in ganzen Prozent.
 * KEINE Siegchance und keine Prognose — nur das Verhältnis der beiden Kaderstärke-Werte (Top-6-Summe
 * der Disziplin-Eignung). Ohne Werte oder ohne Summe: null.
 */
export function kaderStaerkeAnteil(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0 || a + b <= 0) return null;
  return Math.round((a / (a + b)) * 100);
}

export type ShowdownKandidat = { id: string; rangHeim: number | null; rangGast: number | null; eigen: boolean };
export type ShowdownAuswahl = { id: string; tag: "Dein Spiel" | "Spitzenspiel" | "Kellerduell" };

/**
 * Welche Paarungen der eigenen Liga der Showdown zeigt: das eigene Spiel, das Spitzenspiel (kleinste
 * Rangsumme) und das Kellerduell (größte Rangsumme). Eine Paarung steht nur einmal da.
 */
export function waehleShowdownPaarungen(kandidaten: readonly ShowdownKandidat[]): ShowdownAuswahl[] {
  const aus: ShowdownAuswahl[] = [];
  const eigen = kandidaten.find((k) => k.eigen);
  if (eigen) aus.push({ id: eigen.id, tag: "Dein Spiel" });
  const summe = (k: ShowdownKandidat) => (k.rangHeim != null && k.rangGast != null ? k.rangHeim + k.rangGast : null);
  const rest = kandidaten.filter((k) => !k.eigen && summe(k) != null).sort((x, y) => summe(x)! - summe(y)!);
  const spitze = rest[0];
  const keller = rest.length > 1 ? rest[rest.length - 1] : undefined;
  if (spitze) aus.push({ id: spitze.id, tag: "Spitzenspiel" });
  if (keller) aus.push({ id: keller.id, tag: "Kellerduell" });
  return aus;
}


/**
 * Liga-Rang statt Gesamtrang: die Standings-Zeilen tragen je nach Quelle den Rang über alle 32 Teams
 * (Abnahme 18.11.: Liga 1 zeigte 1, 3, 4, 8 … 32). Die Ansicht rechnet aber mit Platz 1–16 je Liga (Zonen, Lagesatz, Gesamt = Rang + 16).
 * Neuer Rang = 1 + Zahl der Teams DERSELBEN Liga mit besserem Rang; gleiche Ränge bleiben gleich. Auf schon richtigen Liga-Rängen ändert das nichts.
 */
export function mitLigaRang<T extends { leagueTier?: LeagueTier | null; rank: number | null }>(zeilen: readonly T[]): T[] {
  return zeilen.map((z) => {
    if (!z.leagueTier || z.rank == null) return z;
    const besser = zeilen.filter((o) => o.leagueTier === z.leagueTier && o.rank != null && o.rank < (z.rank as number)).length;
    return besser + 1 === z.rank ? z : { ...z, rank: besser + 1 };
  });
}

/**
 * Punkte eines Teams je Bereich (POW/SPE/MEN/SOC) aus den Duellpunkten der Disziplinen des Bereichs: DIESELBE Quelle wie die Matrix und die
 * Teamkarte. Die Leistungspunkte (PPs) des Ledgers stehen im Duell-Modus nicht in der Zeile (zeigte überall 0).
 */
export function bereichsPunkteAusDuellen(
  duellMatrix: ReadonlyMap<string, ReadonlyMap<string, { punkte: number }>>,
  teamId: string,
  katalogIds: readonly string[],
): number {
  const zeile = duellMatrix.get(teamId);
  return katalogIds.reduce((summe, id) => summe + (zeile?.get(id)?.punkte ?? 0), 0);
}
