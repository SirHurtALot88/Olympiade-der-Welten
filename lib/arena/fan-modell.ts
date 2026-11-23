/**
 * FAN-MODELL ORGANISCH (Chris, 23.11.): die Fanbasis haengt NICHT an der Stadiongroesse. Reine Rechnung, ohne Spielstand und ohne
 * Zufall (client-sicher: Seite, Server und Messskripte rechnen dieselbe Funktion, damit gezeigt = gebucht gilt). Doku und Messung:
 * docs/design/arena-tickets-medaillen-22-11.md Abschnitt "Fan-Modell organisch".
 *
 * Fans aendern sich
 *   - je Spieltag in kleinen Schritten: Ergebnis gegen die Erwartung aus der Kaderstaerke, Punkte ueber/unter dem Schnitt, Serien,
 *     Rueckzug zum Langzeitwert des Teams (Anker);
 *   - bei Kauf und Verkauf eines Stars (Marketability, Leistung): ein Kauf bringt Fans, ein Verkauf (auch Vertragsende) kostet sie;
 *   - am Saisonende in einem groesseren Schritt: Tabellenplatz, Platz gegen Erwartung, Titel oder Farb-Meister, Aufstieg, Abstieg.
 * Je Saison bleibt die Fanbasis zwischen -15 % und +30 % ihres Saisonstarts; der Anker folgt der Fanbasis langsam.
 */

export type FanGrund = { id: string; label: string; delta: number };

/** Alle Stellschrauben an einem Ort (Kalibrierung 23.11., siehe Doku). */
export const FAN_KONFIG = {
  /** Fanbasis eines Teams mit Beliebtheit 1 und Matrix-Beliebtheit 5,5 (neues Spiel). */
  start: 5000,
  /** Anteil der Matrix-Beliebtheit (TeamIdentity.popularity 1..10) am Start; der Rest ist der Beliebtheits-KPI. */
  startMatrixAnteil: 0.5,
  /** Matrix-Beliebtheit p (1..10) -> Faktor 0,45 + 0,12 x p (0,57 bis 1,65). */
  matrixFaktorGrund: 0.45,
  matrixFaktorJePunkt: 0.12,
  /** Anteil der Fanbasis je Tabellenpunkt ueber/unter der Erwartung eines Spieltags. */
  ergebnisRelativ: 0.0035,
  /** Anteil der Fanbasis je Tabellenpunkt ueber/unter dem Schnitt (2 Punkte) eines Spieltags. */
  ergebnisAbsolut: 0.0035,
  /** Serie ab drei: Anteil je Spieltag. */
  serie: 0.004,
  /** Rueckzug zum Anker je Spieltag (ca. 20 % je Saison). */
  zerfall: 0.011,
  /** Anteil, mit dem der Anker am Saisonende der Fanbasis folgt. */
  ankerFolge: 0.4,
  /** Saisonende: Tabellenplatz von -platz bis +platz (Rang 1 = +platz). */
  platz: 0.1,
  /** Saisonende: Platz gegen die Erwartung der Kaderstaerke. */
  erwartung: 0.1,
  titel: 0.06,
  aufstieg: 0.08,
  abstieg: 0.08,
  /** Fans je Stern-Gewicht (Kauf/Verkauf). */
  stern: 1200,
  /** Stern-Gewichte darunter zaehlen nicht. */
  sternMin: 0.05,
  /** Schranke je Saison, Anteil am Saisonstart. */
  minSaison: 0.85,
  maxSaison: 1.3,
} as const;

const klemme = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const r0 = (v: number) => Math.round(v);

/** Start der Fanbasis (neues Spiel): 5.000 x (Beliebtheits-KPI und Matrix-Beliebtheit gemischt). Unabhaengig vom Stadion. */
export function fanbasisStart(beliebtheit: number, matrixBeliebtheit: number | null): number {
  const m = matrixBeliebtheit == null ? 1 : FAN_KONFIG.matrixFaktorGrund + FAN_KONFIG.matrixFaktorJePunkt * matrixBeliebtheit;
  const mix = matrixBeliebtheit == null ? beliebtheit : (1 - FAN_KONFIG.startMatrixAnteil) * beliebtheit + FAN_KONFIG.startMatrixAnteil * m;
  return r0(FAN_KONFIG.start * mix);
}

/** Erwartete Tabellenpunkte eines Spieltags (0..4) aus der Kaderstaerke: `staerke` 0 (schwaechster Kader der Liga) bis 1 (staerkster). */
export function erwartetePunkteJeSpieltag(staerke: number): number {
  return 1.3 + 1.4 * klemme(staerke, 0, 1);
}

/** Stern-Gewicht eines Spielers (0..1): Marketability (0..100) und Leistungsperzentil (0..100). Kauf und Verkauf bewegen Fans damit. */
export function sternGewicht(marketability: number, leistungPerz: number): number {
  const m = klemme((marketability - 30) / 70, 0, 1);
  return Math.round(m * m * (0.5 + 0.5 * klemme(leistungPerz, 0, 100) / 100) * 1000) / 1000;
}

/** Fan-Wirkung eines Zu- oder Abgangs: Kauf positiv, Verkauf (auch Vertragsende) negativ. */
export function sternFans(gewicht: number, kauf: boolean): number {
  return (kauf ? 1 : -1) * gewicht * FAN_KONFIG.stern;
}

export type SpieltagFanEingabe = {
  fanbasis: number;
  anker: number;
  /** Tabellenpunkte dieses Spieltags (0..4); `null` = kein gewerteter Spieltag. */
  deltaPunkte: number | null;
  erwartetePunkte: number;
  serie: number;
};

/** Die Aenderungen der Fanbasis nach einem Spieltag (ohne Stars), als Gruende mit Fans. */
export function fanGruendeSpieltag(e: SpieltagFanEingabe): FanGrund[] {
  const aus: FanGrund[] = [];
  if (e.deltaPunkte != null) {
    const rel = e.fanbasis * FAN_KONFIG.ergebnisRelativ * (e.deltaPunkte - e.erwartetePunkte);
    aus.push({ id: "erwartung", label: rel >= 0 ? "Ergebnisse über Erwartung" : "Ergebnisse unter Erwartung", delta: rel });
    const abs = e.fanbasis * FAN_KONFIG.ergebnisAbsolut * (e.deltaPunkte - 2);
    aus.push({ id: "ergebnis", label: abs >= 0 ? "Siege und Punkte" : "Niederlagen", delta: abs });
  }
  if (e.serie >= 3) aus.push({ id: "serie", label: `Siegesserie (${e.serie})`, delta: e.fanbasis * FAN_KONFIG.serie });
  else if (e.serie <= -3) aus.push({ id: "serie", label: `Niederlagenserie (${-e.serie})`, delta: -e.fanbasis * FAN_KONFIG.serie });
  aus.push({ id: "anker", label: e.anker >= e.fanbasis ? "Rückkehr zur Stammkundschaft" : "Abkühlung zur Stammkundschaft", delta: (e.anker - e.fanbasis) * FAN_KONFIG.zerfall });
  return aus;
}

export type SaisonendeFanEingabe = {
  fanbasis: number;
  /** Tabellenanteil am Ende: 1 = Meister, 0 = Letzter. */
  rangAnteil: number | null;
  /** Erwarteter Anteil aus der Kaderstaerke (1 = staerkster Kader). */
  erwartungAnteil: number | null;
  titel: boolean;
  aufgestiegen: boolean;
  abgestiegen: boolean;
};

/** Der grosse Schritt am Saisonende, als Gruende mit Fans. */
export function fanGruendeSaisonende(e: SaisonendeFanEingabe): FanGrund[] {
  const aus: FanGrund[] = [];
  if (e.rangAnteil != null) {
    aus.push({ id: "platz", label: "Tabellenplatz am Saisonende", delta: e.fanbasis * FAN_KONFIG.platz * (2 * e.rangAnteil - 1) });
    if (e.erwartungAnteil != null) aus.push({ id: "platz-erwartung", label: "Platz gegen Erwartung", delta: e.fanbasis * FAN_KONFIG.erwartung * (e.rangAnteil - e.erwartungAnteil) });
  }
  if (e.titel) aus.push({ id: "titel", label: "Titel oder Farb-Meister", delta: e.fanbasis * FAN_KONFIG.titel });
  if (e.aufgestiegen) aus.push({ id: "aufstieg", label: "Aufstieg", delta: e.fanbasis * FAN_KONFIG.aufstieg });
  if (e.abgestiegen) aus.push({ id: "abstieg", label: "Abstieg", delta: -e.fanbasis * FAN_KONFIG.abstieg });
  return aus;
}

/** Wendet die Gruende an und haelt die Fanbasis in der Saison-Schranke (-15 % bis +30 % des Saisonstarts). Gibt die gerundeten, wirklich gebuchten Gruende zurueck. */
export function wendeFanGruendeAn(fanbasis: number, saisonStart: number, gruende: readonly FanGrund[]): { fanbasis: number; gruende: FanGrund[]; gekappt: boolean } {
  const summe = gruende.reduce((s, g) => s + g.delta, 0);
  const roh = fanbasis + summe;
  const unten = saisonStart * FAN_KONFIG.minSaison;
  const oben = saisonStart * FAN_KONFIG.maxSaison;
  const neu = klemme(roh, Math.min(unten, fanbasis), Math.max(oben, fanbasis));
  // Gekappte Summe anteilig auf die Gruende verteilen (gezeigt = gebucht).
  const faktor = summe !== 0 ? (neu - fanbasis) / summe : 1;
  const gebucht = gruende.map((g) => ({ ...g, delta: g.delta * faktor }));
  return { fanbasis: neu, gruende: gebucht, gekappt: Math.abs(neu - roh) > 1e-9 };
}

/** Der Anker am Saisonende: folgt der Fanbasis langsam. */
export function ankerNachSaison(anker: number, fanbasis: number): number {
  return anker + (fanbasis - anker) * FAN_KONFIG.ankerFolge;
}

/** Fuegt `neu` in eine Bilanz (je Grund-Id summiert) ein. */
export function fanBilanzAddiere(bilanz: readonly FanGrund[] | undefined, neu: readonly FanGrund[]): FanGrund[] {
  const m = new Map<string, FanGrund>((bilanz ?? []).map((g) => [g.id, { ...g }]));
  for (const g of neu) {
    if (Math.abs(g.delta) < 1e-9) continue;
    const alt = m.get(g.id);
    if (alt) alt.delta += g.delta;
    else m.set(g.id, { ...g });
  }
  return [...m.values()].map((g) => ({ ...g, delta: Math.round(g.delta * 10) / 10 }));
}

/** Gruende fuer die Anzeige: nach Betrag sortiert, ohne Kleinkram unter 5 Fans; Spieltag-Posten (Ergebnis, Serie, Anker) zusammengefasst nach Id. */
export function fanGruendeAnzeige(gruende: readonly FanGrund[] | undefined, max = 4): FanGrund[] {
  return [...(gruende ?? [])]
    .filter((g) => Math.abs(g.delta) >= 5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, max)
    .map((g) => ({ ...g, delta: r0(g.delta) }));
}

/**
 * Fan-Trend fuer die KI-Prognose (statt Auslastung): erwartete Fanbasis der naechsten Saison. Hochrechnung der bisherigen Aenderung
 * dieser Saison (ab Spieltag 5), sonst der Trend der Vorsaison; gedaempft (70 %) und auf die Saison-Schranke begrenzt.
 */
export function fanPrognoseFaktor(e: { fanbasis: number; saisonStart: number | undefined; spieltage: number; trendVorsaison: number | undefined; saisonLaenge?: number }): number {
  const laenge = e.saisonLaenge ?? 20;
  let trend = e.trendVorsaison ?? 0;
  if (e.saisonStart && e.saisonStart > 0 && e.spieltage >= 5) trend = ((e.fanbasis - e.saisonStart) / e.saisonStart) * (laenge / e.spieltage);
  return 1 + klemme(0.7 * trend, FAN_KONFIG.minSaison - 1, FAN_KONFIG.maxSaison - 1);
}

/* ------------------------------------------------------------------------------------------------ Start-Stadion */

export const START_STADION = {
  /** Gewichte der Mischung (Summe 1): Beliebtheit/Tradition aus der Matrix, Liga, Budget (nur ein kleiner Teil). */
  gewichtBeliebtheit: 0.6,
  gewichtLiga: 0.25,
  gewichtBudget: 0.15,
  /** Zusatzplaetze ueber der Grundarena: 0 bis 3 Schritte a 1.000 Plaetze (Steh, Sitz, Steh). */
  maxSchritte: 3,
} as const;

/**
 * Start-Ausbau eines Teams: `popAnteil` 0..1 (Matrix-Beliebtheit, auf den Mittelwert der Liga bezogen), `liga1`, `budgetAnteil` 0 (aermstes) bis 1 (reichstes).
 * Ergebnis: Anzahl Schritte 0..3. Das Budget zaehlt nur 15 %, damit die Starken nicht doppelt gewinnen (Chris, 23.11.).
 */
export function startStadionSchritte(popAnteil: number, liga1: boolean, budgetAnteil: number): number {
  const m = START_STADION.gewichtBeliebtheit * klemme(popAnteil, 0, 1) + START_STADION.gewichtLiga * (liga1 ? 1 : 0) + START_STADION.gewichtBudget * klemme(budgetAnteil, 0, 1);
  return Math.min(START_STADION.maxSchritte, Math.max(0, Math.round(START_STADION.maxSchritte * m)));
}

/** Plaetze der Start-Arena: Grundarena plus `schritte` Schritte (1: +1.000 Steh, 2: +1.000 Sitz, 3: nochmals +1.000 Steh). */
export function startStadionPlaetze(grund: { steh: number; sitz: number; loge: number }, schritte: number) {
  const s = Math.min(START_STADION.maxSchritte, Math.max(0, Math.round(schritte)));
  return { steh: grund.steh + 1000 * Math.ceil(s / 2), sitz: grund.sitz + 1000 * Math.floor(s / 2), loge: grund.loge };
}
