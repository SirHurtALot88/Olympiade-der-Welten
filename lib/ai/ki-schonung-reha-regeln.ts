import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * KI-SCHONUNG, ROTATION UND REHA (Chris 21.11.: „ja bau die KI-Schonung und Reha so ein“).
 *
 * Grundlage: docs/design/ki-schonung-reha-analyse-21-11.md (Regeln R1 bis R6, Messung am Live-Abbild).
 * Alle Schwellen stehen HIER und nur hier; die Rechenstellen (`getAiIntensityForSide`,
 * `buildAiLegacyLineupSuggestion`, KI-Reha-Bau, KI-Kaderplanung) lesen diese Konstanten.
 *
 * REINE FUNKTIONEN, keine Server-Importe. Die Regeln gelten fuer KI-Teams UND fuer menschliche Teams mit
 * delegiertem Bereich (gleicher Code); was der Mensch selbst gesetzt hat, bleibt unangetastet
 * (`mergeDelegatedLineupModifiers`, `isBereichDelegiert`).
 */

/** R1: Push nur, solange der Seiten-Durchschnitt der Erschoepfung (VOR dem Spieltag) hoechstens so hoch ist (vorher 65). */
export const KI_PUSH_DECKEL_SEITEN_FATIGUE = 30;

/** R1: Ab so wenig Luft (Kader minus Spieltagsbedarf) gilt der Kader als duenn: kein Push. */
export const KI_DUENNER_KADER_LUFT = 1;

/** R2: Die Seite wird geschont (conserve), sobald ihr Erschoepfungs-Durchschnitt diese Marke erreicht - die ganze Saison, unabhaengig von Push. */
export const KI_SCHONEN_AB_SEITEN_FATIGUE = 40;

/** R2: Das Schonen an Spieltag 1 bis 2 gilt nur noch bei Seiten-Durchschnitt ueber dieser Marke (frische Seiten: wirkungslos, kostet Score). */
export const KI_FRUEHSCHONEN_SPIELTAGE = 2;
export const KI_FRUEHSCHONEN_MIN_SEITEN_FATIGUE = 25;

/** R3: Ein Starter ueber dieser Erschoepfung wird gegen frischeren Ersatz getauscht, wenn der Eignungsverlust klein bleibt. */
export const KI_TAUSCH_STARTER_FATIGUE = 40;
/** R3: Der Ersatz muss mindestens so viele Punkte frischer sein. */
export const KI_TAUSCH_MIN_FRISCHE_VORTEIL = 10;
/**
 * R3: hoechster Eignungsverlust des Tauschs, als Anteil der Eignung des Starters. Begruendung: bei Spielerwerten um
 * 100 bis 150 sind 8 % rund 8 bis 12 Punkte, also weniger als die Leistungseinbusse und Auswahlabzuege, die
 * Erschoepfung ueber 55 ohnehin kostet (Abzug 3 / 9 / 12 ab 55 / 70 / 85 plus Leistungsmultiplikator); gemessen
 * kostet ein Tausch die Seite im Mittel unter 0,5 % Eignung und senkt das Risiko des Platzes von rund 4 % auf unter 1 %.
 */
export const KI_TAUSCH_MAX_EIGNUNGSVERLUST_ANTEIL = 0.08;

/** R4: Reha (Recovery Center). Stufe 1 bei duennem Kader, hoher Saison-Erschoepfung oder Verletzungslast. */
export const KI_REHA_KADER_LUFT_STUFE1 = 2; // Kader <= Spitzenbedarf - 2
export const KI_REHA_FATIGUE_HOCH = 40; // Kader-Durchschnitt der Erschoepfung
export const KI_REHA_VERLETZUNGEN_STUFE1 = 3; // Verletzungen dieser Saison (oder Vorsaison >= KI_REHA_VORSAISON_STUFE1)
export const KI_REHA_VORSAISON_STUFE1 = 4;
/** R4: Stufe 2 bei hoher Verletzungslast oder genug freiem Geld nach Ruecklage bei Finanzwert >= 6. */
export const KI_REHA_VERLETZUNGEN_STUFE2 = 5;
export const KI_REHA_VORSAISON_STUFE2 = 7;
export const KI_REHA_FREIES_GELD_STUFE2 = 30;
export const KI_REHA_FINANZWERT_STUFE2 = 6;
/** R4: Ruecklage in Saison 1 ist halb so hoch wie ueblich (Chris 18.11., Draft-Ruecklage). */
export const KI_REHA_RUECKLAGE_S1_FAKTOR = 0.5;
/** R4: Spitzenbedarf, wenn der Spielplan keinen liefert (Chris: min 4, max 12 je Spieltag). */
export const KI_SPITZENBEDARF_FALLBACK = 12;

/**
 * R5 (Chris 22.11.: „das KI-Kaderziel richtet sich nach der hoechsten Platzsumme eines Spieltags, bis 12, plus 1 bis 2 Ersatz,
 * gedeckelt auf 14“): Ersatzplaetze ueber dem Spitzenbedarf. Gilt ab Saison 1 (Draft) und ab Saison 2 gleich. Gemessen holten Teams
 * mit hoechstens 10 Spielern 2 bis 4 Siege weniger als die Kaderstaerke erwarten laesst (Review 22.11. Befund 4).
 */
export const KI_KADER_ERSATZ_PLAETZE = 1;
/** R5: Auffuell-Ziel = Spitzenbedarf (hoechstens 12) plus Ersatz, mindestens 8; die Obergrenze 14 setzt `playerMax`. */
export function kiMindestKaderFuerRotation(spitzenbedarf: number): number {
  return Math.max(8, Math.min(12, spitzenbedarf) + KI_KADER_ERSATZ_PLAETZE);
}

/** Hoechster Spieltagsbedarf (Summe beider Disziplinen) im Spielplan der Saison; ohne Spielplan der Fallback. */
export function resolveSpitzenbedarf(gameState: GameState): number {
  let max = 0;
  for (const eintrag of gameState.seasonState?.disciplineSchedule ?? []) {
    if (eintrag.seasonId && eintrag.seasonId !== gameState.season?.id) continue;
    const summe = Number(eintrag.discipline1?.playerCount ?? 0) + Number(eintrag.discipline2?.playerCount ?? 0);
    if (Number.isFinite(summe) && summe > max) max = summe;
  }
  return max > 0 ? max : KI_SPITZENBEDARF_FALLBACK;
}

export type KiIntensitaet = "conserve" | "normal" | "push";

/** Ist der Kader duenn? Luft = Spieler im Kader minus Spieltagsbedarf. */
export function istKaderDuenn(kaderGroesse: number, spieltagsBedarf: number): boolean {
  return kaderGroesse - spieltagsBedarf <= KI_DUENNER_KADER_LUFT;
}

/**
 * R1 + R2: die Intensitaet einer Disziplin-Seite der KI. Reihenfolge:
 *   1. Seiten-Durchschnitt >= 40: schonen, die ganze Saison, egal wer pushen will (R2).
 *   2. Schwaches Disziplinfenster: normal; schonen an Spieltag 1 bis 2 nur bei Seiten-Durchschnitt > 25 (R2).
 *   3. Push-Wunsch (auch der Kapitaen): Push nur bis Seiten-Durchschnitt 30 und nur mit tiefem Kader (R1).
 *   4. Sonst normal; der alte Fruehschonen-Zweig fuer chancenlose Seiten gilt ebenfalls nur ueber 25.
 */
export function bestimmeKiSeitenIntensitaet(input: {
  avgSideFatigue: number;
  matchdayIndex: number;
  duennerKader: boolean;
  isWeakDisciplineWindow: boolean;
  wantsPush: boolean;
  /** Der alte Zweig „Spieltag 1 bis 2, Rang >= 24, schwache Spitze“. */
  chancenloseSeiteImAnlauf: boolean;
  pushDeckel?: number;
}): KiIntensitaet {
  const avg = Number.isFinite(input.avgSideFatigue) ? input.avgSideFatigue : 0;
  const deckel = input.pushDeckel ?? KI_PUSH_DECKEL_SEITEN_FATIGUE;
  if (avg >= KI_SCHONEN_AB_SEITEN_FATIGUE) return "conserve";
  const fruehSchonen = input.matchdayIndex <= KI_FRUEHSCHONEN_SPIELTAGE && avg > KI_FRUEHSCHONEN_MIN_SEITEN_FATIGUE;
  if (input.isWeakDisciplineWindow) return fruehSchonen ? "conserve" : "normal";
  if (input.wantsPush) {
    return !input.duennerKader && avg <= deckel ? "push" : "normal";
  }
  if (input.chancenloseSeiteImAnlauf && fruehSchonen) return "conserve";
  return "normal";
}

/** Eignung des Ersatzes darf hoechstens um den Anteil unter der des Starters liegen (R3). */
export function istTauschEignungsverlustKlein(starterEignung: number, ersatzEignung: number): boolean {
  if (!Number.isFinite(starterEignung) || !Number.isFinite(ersatzEignung)) return false;
  return starterEignung - ersatzEignung <= Math.max(0, starterEignung) * KI_TAUSCH_MAX_EIGNUNGSVERLUST_ANTEIL;
}

export type KiRehaEingabe = {
  kaderGroesse: number;
  spitzenbedarf: number;
  /** Kader-Durchschnitt der Erschoepfung jetzt. */
  fatigueAvg: number;
  verletzungenDieseSaison: number;
  verletzungenVorsaison: number;
  aktuelleStufe: number;
  /** Finanzwert 1 bis 10. */
  finanzwert: number;
  /** Kasse minus Ruecklage nach Finanzwert (kann negativ sein). */
  freiesGeldNachRuecklage: number;
  /** Kosten der naechsten Stufe. */
  naechsteStufeKosten: number | null;
};

export type KiRehaEntscheidung = {
  /** Gewuenschte Stufe (0 = kein Bedarf oder schon erreicht). Gebaut wird je Spieltag EINE Stufe in Richtung Ziel. */
  zielStufe: 0 | 1 | 2;
  /** Jetzt eine Stufe bauen: Bedarf da, Stufe noch nicht erreicht, Geld nach Ruecklage reicht. */
  bauen: boolean;
  grund: string[];
  /** Es gibt einen Grund, aber das Geld (nach Ruecklage) reicht nicht. */
  amGeldGescheitert: boolean;
};

/**
 * R4: Reha-Investitionsregel. Stufe 1: duenner Kader (<= Spitzenbedarf - 2) ODER hohe Saison-Erschoepfung ODER
 * Verletzungslast. Stufe 2: hohe Verletzungslast ODER (freies Geld >= 30 und Finanzwert >= 6). Ueber Stufe 2 baut die
 * KI nicht von sich aus. Bezahlt wird nur, was nach der Ruecklage frei ist.
 */
export function entscheideKiReha(input: KiRehaEingabe): KiRehaEntscheidung {
  const grund: string[] = [];
  const duenn = input.kaderGroesse <= input.spitzenbedarf - KI_REHA_KADER_LUFT_STUFE1;
  const muede = input.fatigueAvg >= KI_REHA_FATIGUE_HOCH;
  const verletzt =
    input.verletzungenDieseSaison >= KI_REHA_VERLETZUNGEN_STUFE1 || input.verletzungenVorsaison >= KI_REHA_VORSAISON_STUFE1;
  const verletztStark =
    input.verletzungenDieseSaison >= KI_REHA_VERLETZUNGEN_STUFE2 || input.verletzungenVorsaison >= KI_REHA_VORSAISON_STUFE2;
  const reich =
    input.freiesGeldNachRuecklage >= KI_REHA_FREIES_GELD_STUFE2 && input.finanzwert >= KI_REHA_FINANZWERT_STUFE2;

  let wunsch: 0 | 1 | 2 = 0;
  if (duenn) {
    wunsch = 1;
    grund.push("duenner_kader");
  }
  if (muede) {
    wunsch = 1;
    grund.push("hohe_erschoepfung");
  }
  if (verletzt) {
    wunsch = 1;
    grund.push("verletzungslast");
  }
  if (verletztStark) {
    wunsch = 2;
    grund.push("hohe_verletzungslast");
  }
  if (reich) {
    wunsch = 2;
    grund.push("freies_geld_bei_finanzwert");
  }
  if (wunsch === 0 || input.aktuelleStufe >= wunsch) return { zielStufe: wunsch, grund, amGeldGescheitert: false, bauen: false };
  const kosten = input.naechsteStufeKosten;
  if (kosten == null || kosten > input.freiesGeldNachRuecklage + 1e-9) {
    return { zielStufe: wunsch, grund, amGeldGescheitert: true, bauen: false };
  }
  return { zielStufe: wunsch, grund, amGeldGescheitert: false, bauen: true };
}
