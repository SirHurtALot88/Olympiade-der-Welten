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
import { FARBREGEL_PM, FARBREGEL_SCHMAL, isFormkartenFarbregelEnabled, resolveFormkartenFarbregel, type FormkartenFarbregel } from "@/lib/lineups/formkarten-farbregel";
import { isFormMoralEnabled, resolveFormMoralDosisPct } from "@/lib/morale/form-moral-modifikator";

export type FormMoralRegeln = {
  /** Form wird fortgeschrieben und wirkt; Moral skaliert die Arena-Eignung. */
  formMoral: boolean;
  /** Prozent Eignung je Form-Stufe. */
  dosisPct: number;
  /** Kartenregel: "neu" (PM), "schmal" oder "alt" (x2 fuer alle). */
  farbregel: "neu" | "schmal" | "alt";
};

export function resolveFormMoralRegeln(env?: Record<string, string | undefined>): FormMoralRegeln {
  const farbregel = !isFormkartenFarbregelEnabled(env)
    ? "alt"
    : resolveFormkartenFarbregel(env) === FARBREGEL_SCHMAL
      ? "schmal"
      : "neu";
  return { formMoral: isFormMoralEnabled(env), dosisPct: resolveFormMoralDosisPct(env), farbregel };
}

/** Regel-Objekt fuer `calculateFormModifierForSide({ farbregel })`: `null` = alte Regel. */
export function farbregelAusRegeln(regeln: FormMoralRegeln | null | undefined): FormkartenFarbregel | null | undefined {
  if (!regeln) return undefined;
  return regeln.farbregel === "alt" ? null : regeln.farbregel === "schmal" ? FARBREGEL_SCHMAL : FARBREGEL_PM;
}
