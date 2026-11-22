/**
 * REGELSTAND VON FORM + MORAL + FARBREGEL (18.11., Review-Befund 3).
 *
 * Die Schalter stehen in Umgebungsvariablen des SERVERS; im Browser-Bundle gibt es kein `OLY_*`.
 * Wer serverseitig abschaltet, darf die Anzeige im Browser nicht falsch lassen. Deshalb liest der
 * Server den Regelstand EINMAL (`resolveFormMoralRegeln`), legt ihn in den Lineup-Kontext
 * (`LegacyLineupLoadedContext.formMoralRegeln`) und jede Anzeige/lokale Vorschau liest ihn von dort
 * (`regeln`-Parameter der Rechenfunktionen). Fehlt er (alter Kontext), gilt der Schalterstand der
 * Umgebung bzw. im Browser der Standard.
 */
import { FARBREGEL_PM, FARBREGEL_PM_PLUSMINUS, FARBREGEL_SCHMAL, isFormkartenFarbregelEnabled, isFormkartenPlusMinusEnabled, resolveFormkartenFarbregel, type FormkartenFarbregel } from "@/lib/lineups/formkarten-farbregel";
import { isFormMoralEnabled, resolveFormMoralDosisPct } from "@/lib/morale/form-moral-modifikator";

export type FormMoralRegeln = {
  /** Form wird fortgeschrieben und wirkt; Moral skaliert die Arena-Eignung. */
  formMoral: boolean;
  /** Prozent Eignung je Form-Stufe. */
  dosisPct: number;
  /** Kartenregel: "neu" (PM), "schmal" oder "alt" (x2 fuer alle). */
  farbregel: "neu" | "schmal" | "alt";
  /** Plus/Minus-Karten (22.11., `OLY_FORMKARTEN_PLUSMINUS`): Gegenfarbe wirkt mit. Fehlt = aus (bit-identisch zu vorher). */
  plusMinus?: boolean;
};

export function resolveFormMoralRegeln(env?: Record<string, string | undefined>): FormMoralRegeln {
  const farbregel = !isFormkartenFarbregelEnabled(env)
    ? "alt"
    : resolveFormkartenFarbregel(env) === FARBREGEL_SCHMAL
      ? "schmal"
      : "neu";
  const basis: FormMoralRegeln = { formMoral: isFormMoralEnabled(env), dosisPct: resolveFormMoralDosisPct(env), farbregel };
  return farbregel === "neu" && isFormkartenPlusMinusEnabled(env) ? { ...basis, plusMinus: true } : basis;
}

/** Regel-Objekt fuer `calculateFormModifierForSide({ farbregel })`: `null` = alte Regel. */
export function farbregelAusRegeln(regeln: FormMoralRegeln | null | undefined): FormkartenFarbregel | null | undefined {
  if (!regeln) return undefined;
  if (regeln.farbregel === "alt") return null;
  if (regeln.farbregel === "schmal") return FARBREGEL_SCHMAL;
  return regeln.plusMinus ? FARBREGEL_PM_PLUSMINUS : FARBREGEL_PM;
}
