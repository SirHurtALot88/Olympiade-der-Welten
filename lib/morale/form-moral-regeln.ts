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
import { FARBREGEL_PM, FARBREGEL_PM_PLUSMINUS, FARBREGEL_SCHMAL, isFormkartenFarbregelEnabled, resolveFormkartenFarbregel, type FormkartenFarbregel } from "@/lib/lineups/formkarten-farbregel";
import { formkartenPlusMinusFuer, type FormkartenRegelQuelle } from "@/lib/resolve/formkarten-regel";
import { isFormMoralEnabled, resolveFormMoralDosisPct } from "@/lib/morale/form-moral-modifikator";

export type FormMoralRegeln = {
  /** Form wird fortgeschrieben und wirkt; Moral skaliert die Arena-Eignung. */
  formMoral: boolean;
  /** Prozent Eignung je Form-Stufe. */
  dosisPct: number;
  /** Kartenregel: "neu" (PM), "schmal" oder "alt" (x2 fuer alle). */
  farbregel: "neu" | "schmal" | "alt";
  /** Plus/Minus-Karten (22.11., Saison-Stempel `formkartenRegel`): Gegenfarbe wirkt mit. Fehlt = aus (bit-identisch zu vorher). */
  plusMinus?: boolean;
};

/**
 * `gameState`: der Spielstand, dessen Saison-Stempel `formkartenRegel` die Plus/Minus-Regel bestimmt (22.11.). Ohne
 * Spielstand gilt die Regel von 18.11. Die Umgebungsvariable `OLY_FORMKARTEN_PLUSMINUS` wirkt nur beim Stempeln.
 */
export function resolveFormMoralRegeln(env?: Record<string, string | undefined>, gameState?: FormkartenRegelQuelle): FormMoralRegeln {
  const farbregel = !isFormkartenFarbregelEnabled(env)
    ? "alt"
    : resolveFormkartenFarbregel(env) === FARBREGEL_SCHMAL
      ? "schmal"
      : "neu";
  const basis: FormMoralRegeln = { formMoral: isFormMoralEnabled(env), dosisPct: resolveFormMoralDosisPct(env), farbregel };
  return farbregel === "neu" && formkartenPlusMinusFuer(gameState) ? { ...basis, plusMinus: true } : basis;
}

/** Regel-Objekt fuer `calculateFormModifierForSide({ farbregel })`: `null` = alte Regel. */
export function farbregelAusRegeln(regeln: FormMoralRegeln | null | undefined): FormkartenFarbregel | null | undefined {
  if (!regeln) return undefined;
  if (regeln.farbregel === "alt") return null;
  if (regeln.farbregel === "schmal") return FARBREGEL_SCHMAL;
  return regeln.plusMinus ? FARBREGEL_PM_PLUSMINUS : FARBREGEL_PM;
}
