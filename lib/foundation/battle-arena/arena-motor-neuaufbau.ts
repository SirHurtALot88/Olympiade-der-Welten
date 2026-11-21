/**
 * MOTOR-NEUAUFBAU IN DER SPIELTAGS-ANSICHT (Arena-Fluss 21.11., docs/design/arena-fluss-21-11.md).
 *
 * Chris: „das Endergebnis resettet immer" und „nach D1 springt die Arena von selbst weiter". Gemessen
 * am Live-Abbild (Spieltag 12, D1 Mini-DM, D2 Basketball): die Buchung von D1 aendert den Spielstand,
 * den der Host als Motor-Nutzlast (`umschlag`) einhaengt — bis 21.11. buchte der D1-Commit den
 * Trainingszuwachs auf Attribute und Disziplinwerte. Die Signatur der Nutzlast kippte, der Host riss
 * den Motor mit dem gerade gezeigten Endstand ab, zeigte das Ladebild (mit dem Ausblick auf D2) und
 * baute D1 von vorn auf.
 *
 * Die Ursache ist im Trainings-Commit behoben (`spieltagOffen`). Diese Regel ist die zweite Sicherung
 * im Browser: hat der Zuschauer die Disziplin schon angeschaut (Vorstellung weggeklickt, Quick-Sim)
 * oder steht ihr Endstand, wird der Motor fuer DIESE Disziplin nicht mehr neu aufgebaut. Eine
 * geaenderte Nutzlast wirkt erst beim naechsten Disziplinwechsel (Klick auf „Weiter" zu D2) — dort
 * baut der Host mit dem dann aktuellen Stand neu auf.
 *
 * Reine Funktion ohne DOM, damit sie ohne Browser pruefbar ist (`tests/arena-motor-neuaufbau.test.ts`).
 */
export type MotorNeuaufbauEntscheidung =
  /** Gleiche Nutzlast, Motor steht: nichts tun. */
  | "behalten"
  /** Nutzlast anders, aber die gezeigte Disziplin ist angeschaut/beendet: stehen lassen bis zum Wechsel. */
  | "aufschieben"
  /** Neu einhaengen (erster Aufbau, Disziplinwechsel mit neuer Nutzlast, oder noch nicht angeschaut). */
  | "neu";

export function entscheideMotorNeuaufbau(input: {
  /** Signatur der jetzt gewuenschten Nutzlast (`null` ausserhalb der Spieltags-Ansicht). */
  signatur: string | null;
  /** Signatur der eingehaengten Instanz (`null`, solange keine steht). */
  gemounteteSignatur: string | null;
  /** Steht ein Motor im Container? */
  motorSteht: boolean;
  /** Disziplin, die gerade gezeigt werden soll. */
  aktuelleDisziplin: string | null;
  /** Disziplin, deren Spiel zuletzt zu Ende lief (`oly-arena:ende`), sonst `null`. */
  endeDisziplin: string | null;
  /** Disziplin, deren Vorstellung weggeklickt (oder per Quick-Sim uebersprungen) wurde, sonst `null`. */
  angeschauteDisziplin: string | null;
}): MotorNeuaufbauEntscheidung {
  const { signatur, gemounteteSignatur, motorSteht, aktuelleDisziplin } = input;
  if (signatur == null || !motorSteht || gemounteteSignatur == null) return "neu";
  if (signatur === gemounteteSignatur) return "behalten";
  if (
    aktuelleDisziplin != null &&
    (input.endeDisziplin === aktuelleDisziplin || input.angeschauteDisziplin === aktuelleDisziplin)
  ) {
    return "aufschieben";
  }
  return "neu";
}
