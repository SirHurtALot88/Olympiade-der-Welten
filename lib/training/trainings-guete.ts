/**
 * TRAININGSGUETE (Stempel "neu2", Chris 23.11.: Verteilung 10/20/40/20/10, docs/design/entwicklung-balance-22-11.md Abschnitt 9).
 *
 * Wer gut trainiert, soll nach ein paar Saisons spuerbar besser sein, wer ueberlastet ist, spuerbar schlechter. Die Guete eines Spielers an einem
 * Trainingstag ist ein Faktor auf sein Trainingsbudget und besteht aus Ursachen, die der Manager beeinflusst, plus der Entfaltung der Saison:
 *
 *   Passung      gewaehlte Intensitaet gegen den Wunsch des Spielers (`resolvePreferredTrainingMode`): erfuellt +, daneben -
 *   Belastung    Gesamtbelastung (`fatigue`): ab 50 ueberlastet, ab 80 am Limit, im Modus "hart" staerker; kostet zusaetzlich Substanz (Abbau)
 *   Entfaltung   Lernphase der Saison, fest je Spieler und Saison aus der Id (kein Wuerfel je Spieltag, Buchung = Vorschau = Heatmap)
 *
 * Vorlieben (Liebling x1,3 / ungeliebt x0,5), Fokus (0,5 bis 1,5), der Potenzial-Beschleuniger, Trait Diligent und die Ertragskurve zur Decke
 * wirken weiter im Budget und kommen hier nicht noch einmal vor. Die Matrix wird nicht beruehrt.
 */

export type TrainingsModus = "leicht" | "mittel" | "hart";

/** Stellschrauben; Messlaeufe ueberschreiben sie ueber `setzeGueteParameterFuerMessung` (nie im Spiel, nie ueber die Umgebung). */
export type GueteParameter = {
  /** Passung der Intensitaet zum Wunsch: erfuellt / eine Stufe daneben / zwei Stufen daneben. */
  passungErfuellt: number;
  passungAbweichung1: number;
  passungAbweichung2: number;
  /** Belastung: ab 50 ueberlastet, ab 80 am Limit (Zuschlaege als negative Zahlen). */
  belastungUeberlastet: number;
  belastungLimit: number;
  /** Faktor auf die Belastungswirkung im Modus "hart" (leicht: 0). */
  belastungHartFaktor: number;
  /** Anteil der Belastungs-Abschlaege, der als Aufschlag auf den Abbau dazukommt. */
  belastungAbbauAnteil: number;
  /** Entfaltung je Spieler und Saison: gleichverteilt zwischen -x und +x. */
  entfaltung: number;
  /** Grenzen des Gesamtfaktors. */
  guteMin: number;
  guteMax: number;
  /** Eichfaktor, damit der Mittelwert der Guete im Spiel bei 1 liegt. */
  ausgleich: number;
};

export const GUETE_PARAMETER_STANDARD: GueteParameter = {
  passungErfuellt: 0.2,
  passungAbweichung1: -0.15,
  passungAbweichung2: -0.35,
  belastungUeberlastet: -0.15,
  belastungLimit: -0.4,
  belastungHartFaktor: 1.5,
  belastungAbbauAnteil: 1.0,
  entfaltung: 0.5,
  guteMin: 0.35,
  guteMax: 1.9,
  ausgleich: 1,
};

let ueberschreibung: Partial<GueteParameter> = {};

/** NUR MESSLAEUFE (`OLY_GUETE_PARAMS` in `scripts/miss-entwicklung.ts`). */
export function setzeGueteParameterFuerMessung(werte: Partial<GueteParameter> | null): void {
  ueberschreibung = werte ?? {};
}

export function gueteParameter(): GueteParameter {
  return { ...GUETE_PARAMETER_STANDARD, ...ueberschreibung };
}

/** FNV-1a 32 Bit auf 0..1. */
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

const STUFEN: readonly TrainingsModus[] = ["leicht", "mittel", "hart"];

export type TrainingsGuete = {
  /** Gesamtfaktor auf das Trainingsbudget des Spieltags (nach Ausgleich und Grenzen). */
  faktor: number;
  /** Teile (additiv, vor Ausgleich und Grenzen). */
  passung: number;
  belastung: number;
  entfaltung: number;
  /** Faktor auf den Abbau des Spieltags (>= 1: Ueberlastung kostet auch Substanz). */
  abbauFaktor: number;
};

/**
 * Die Guete EINES Spielers an einem Trainingstag. `wunsch` = bevorzugter Modus (oder `null`), `modus` = gewaehlter Modus,
 * `belastung` = `player.fatigue` (Gesamtbelastung).
 */
export function trainingsGuete(input: {
  playerId: string;
  seasonId: string;
  modus: TrainingsModus;
  wunsch: TrainingsModus | null;
  belastung: number;
}): TrainingsGuete {
  const g = gueteParameter();
  let passung = 0;
  if (input.wunsch) {
    const luecke = Math.abs(STUFEN.indexOf(input.modus) - STUFEN.indexOf(input.wunsch));
    passung = luecke === 0 ? g.passungErfuellt : luecke === 1 ? g.passungAbweichung1 : g.passungAbweichung2;
  }
  const last = Number.isFinite(input.belastung) ? input.belastung : 0;
  const modusFaktor = input.modus === "hart" ? g.belastungHartFaktor : input.modus === "leicht" ? 0 : 1;
  const belastung = (last >= 80 ? g.belastungLimit : last >= 50 ? g.belastungUeberlastet : 0) * modusFaktor + 0;
  const entfaltung = (hash01(`${input.playerId}|${input.seasonId}|entfaltung`) * 2 - 1) * g.entfaltung;
  const faktor = Math.max(g.guteMin, Math.min(g.guteMax, (1 + passung + belastung + entfaltung) * g.ausgleich));
  return { faktor, passung, belastung, entfaltung, abbauFaktor: 1 + Math.max(0, -belastung) * g.belastungAbbauAnteil };
}
