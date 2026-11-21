/**
 * KI-PLATZWAHL UNTER BELASTUNGSREGEL V2 (Chris 21.11.: „KI rechnet die Resistenz mit — beim Aufstellen
 * leicht gewichtet als Zuschlag zum Platzwert, nicht dominant").
 *
 * Die KI wählt WER spielt unverändert (`buildAiLegacyLineupSuggestion`: Disziplinwert, Frische,
 * Seitengewicht). Bisher stellte sie die Gewählten einer Seite schlicht nach Auswahlwert auf die Plätze
 * 0..n — Slot-Rolle und Belastung spielten keine Rolle. Unter v2 verteilt sie dieselben Spieler so auf
 * die Plätze, dass
 *
 *     Summe( Platzwert-Aufschlag der Rolle  −  BELASTUNG_KI_LASTGEWICHT × Last auf diesem Platz )
 *
 * maximal wird. Der Platzwert-Aufschlag ist derselbe Rollen-Modifikator, den die Wertung je Platz
 * rechnet (`calculateMatchdayProjectedPreview().roleModifier`), die Last dieselbe Formel wie die
 * Buchung (`berechneEinsatzLast`). Mit dem kleinen Gewicht (0,25) kostet ein Punkt Platzwert so viel
 * wie vier Punkte Last — die Resistenz entscheidet nur, wo der Platzwert fast gleich ist.
 *
 * Unter der alten Regel wird diese Funktion nicht gerufen: die laufende Saison bestehender Spielstände
 * bleibt bit-identisch.
 */
import type { PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";
import {
  BELASTUNG_KI_LASTGEWICHT,
  berechneEinsatzLast,
  istBelastungsStufe,
} from "@/lib/fatigue/belastung-regel";
import {
  calculateMatchdayProjectedPreview,
  resolveSlotRolesForDiscipline,
  type MatchdaySlotRoleDefinition,
} from "@/lib/lineups/matchday-slot-roles";

export type PlatzwahlSpieler = {
  playerId: string;
  attributeStats: PlayerAttributeSheetStats | null | undefined;
  /** Trait-Multiplikator der Last (`getPlayerFatigueLoadMultiplier`), 1 ohne Traits. */
  lastFaktor: number;
};

/** Wert eines Spielers auf einem Platz für die KI: Rollen-Aufschlag minus gewichtete Last (Einsatz „Normal“). */
export function kiPlatzwert(input: {
  role: MatchdaySlotRoleDefinition | null;
  spieler: PlatzwahlSpieler;
  altGrundlast: number;
  lastGewicht?: number;
}): { wert: number; rollenAufschlag: number; last: number } {
  const role = input.role;
  if (!role) return { wert: 0, rollenAufschlag: 0, last: 0 };
  const rollenAufschlag = calculateMatchdayProjectedPreview({
    baseScore: 50,
    role,
    attributeStats: input.spieler.attributeStats ?? null,
    currentFatigueCount: 0,
    intensity: "normal",
  }).roleModifier;
  const last = berechneEinsatzLast({
    regel: "v2",
    altGrundlast: input.altGrundlast,
    traitMultiplikator: input.spieler.lastFaktor,
    einsatzMultiplikator: 1,
    slot: {
      stufe: istBelastungsStufe(role.fatigueProfile) ? role.fatigueProfile : "medium",
      resistenz: input.spieler.attributeStats?.[role.strainAttribute] ?? null,
    },
  });
  const gewicht = input.lastGewicht ?? BELASTUNG_KI_LASTGEWICHT;
  return { wert: rollenAufschlag - gewicht * last, rollenAufschlag, last };
}

function permutationen(n: number): number[][] {
  if (n <= 0) return [[]];
  const ergebnis: number[][] = [];
  const reihe = Array.from({ length: n }, (_, i) => i);
  const rek = (k: number) => {
    if (k === n) {
      ergebnis.push(reihe.slice());
      return;
    }
    for (let j = k; j < n; j += 1) {
      [reihe[k], reihe[j]] = [reihe[j]!, reihe[k]!];
      rek(k + 1);
      [reihe[k], reihe[j]] = [reihe[j]!, reihe[k]!];
    }
  };
  rek(0);
  return ergebnis;
}

/**
 * Verteilt die (schon gewählten) Spieler einer Seite auf die Plätze 0..n-1. Rückgabe: Spieler-IDs in
 * Platz-Reihenfolge. Deterministisch; bei Gleichstand bleibt die Eingabereihenfolge (die bisherige
 * Auswahl-Rangfolge). Mehr als 7 Spieler (gibt es nicht, höchstens 6 Plätze) bleiben unverändert.
 */
export function ordneSpielerAufPlaetze(input: {
  disciplineId: string;
  disciplineName?: string | null;
  slotCount: number;
  spieler: PlatzwahlSpieler[];
  altGrundlast: number;
  lastGewicht?: number;
  /**
   * Echte Platznummern, auf die die Spieler verteilt werden (aufsteigend, Länge = Spielerzahl). Fehlt es: 0..n-1.
   * Gebraucht bei Teil-Delegation: der Mensch hat einige Plätze selbst besetzt, die KI füllt nur die freien — die
   * Rollen kommen dann aus der vollen Kaderzahl (`slotCount`) an genau diesen Plätzen, nicht aus einem verkleinerten Team.
   */
  platzNummern?: readonly number[];
}): string[] {
  const n = input.spieler.length;
  if (n <= 1 || n > 7) return input.spieler.map((s) => s.playerId);
  const plaetze = input.platzNummern && input.platzNummern.length === n ? input.platzNummern : Array.from({ length: n }, (_, i) => i);
  const roles = resolveSlotRolesForDiscipline(
    input.disciplineId,
    input.disciplineName ?? input.disciplineId,
    Math.max(input.slotCount, n, ...plaetze.map((platz) => platz + 1)),
  );
  const matrix = input.spieler.map((spieler) =>
    Array.from({ length: n }, (_, slot) =>
      kiPlatzwert({ role: roles[plaetze[slot]!] ?? null, spieler, altGrundlast: input.altGrundlast, lastGewicht: input.lastGewicht }).wert,
    ),
  );
  let beste: number[] | null = null;
  let besterWert = -Infinity;
  for (const perm of permutationen(n)) {
    // perm[slot] = Index des Spielers auf diesem Platz
    let summe = 0;
    for (let slot = 0; slot < n; slot += 1) summe += matrix[perm[slot]!]![slot]!;
    if (summe > besterWert + 1e-9) {
      besterWert = summe;
      beste = perm;
    }
  }
  return (beste ?? input.spieler.map((_, i) => i)).map((index) => input.spieler[index]!.playerId);
}
