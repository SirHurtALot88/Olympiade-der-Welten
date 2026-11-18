/**
 * FORMKARTEN-FARBREGEL (Konzept 17.11., docs/design/form-moral-17-11.md Abschnitt 6). STANDARD AUS.
 *
 * Chris: „ne gelbe Formkarte in einer gelben Diszi gibt einen kleinen Boost für alle Spieler + noch
 * einen Boost für die Spieler, die genau die Farbe auch haben! so können manche doppelt profitieren,
 * dann sollten die Formkarten aber nicht mehr ganz so powerful sein und bis zu +16 geben."
 *
 * ALT (`calculateFormModifierForSide`): jede Karte wirkt GLEICH auf alle Spieler der Seite, x2 wenn
 * Kartenfarbe = Disziplinfarbe (bis +16 je Karte).
 *
 * NEU (diese Datei), je Karte mit Wert v (Betrag 1..8, Vorzeichen bleibt):
 *   alle Spieler            v x `alleFremd`   (Karte in fremder Disziplinfarbe)
 *                           v x `allePassend` (Karte in passender Disziplinfarbe)
 *   Farbträger (Klassen-    zusätzlich v x `traeger` (beide Fälle)
 *   farbe = Kartenfarbe)
 * Negativkarten spiegelbildlich: Strafe für alle, Zusatzstrafe für die Farbträger.
 *
 * VERZAHNUNG MIT DER SPIELER-FORM (nur Pluskarten): ein Farbträger in Form ▲/▲▲ bekommt den
 * Zusatzanteil um `FORM_TRAEGER_HEBEL` je Stufe verstärkt ("heiße Spieler mit passender Karte").
 *
 * Reine Funktionen, keine schweren Importe (der Arena-Adapter ist auch im Browser-Bundle).
 */

export type FormkartenFarbregel = {
  alleFremd: number;
  allePassend: number;
  traeger: number;
};

/** PM-Vorschlag 17.11.: Spitze 12 (passend, Farbträger) statt 16. */
export const FARBREGEL_PM: FormkartenFarbregel = { alleFremd: 0.5, allePassend: 1.0, traeger: 0.5 };
/** Schmalere Spitze (10), falls die Messung die PM-Faktoren zu stark findet. */
export const FARBREGEL_SCHMAL: FormkartenFarbregel = { alleFremd: 0.5, allePassend: 0.75, traeger: 0.5 };
/** Zusatzhebel auf den Träger-Anteil je Form-Stufe (>0) einer Pluskarte. */
export const FORM_TRAEGER_HEBEL = 0.125;

export type FormkartePlay = { wert: number; farbe: string | null };

export function isFormkartenFarbregelEnabled(env: Record<string, string | undefined> = lieseUmgebung()): boolean {
  const roh = (env.OLY_FORMKARTEN_FARBREGEL ?? "").trim().toLowerCase();
  return roh === "1" || roh === "neu" || roh === "an" || roh === "on" || roh === "true";
}

/** `OLY_FORMKARTEN_FARBREGEL=schmal` wählt die schmale Variante, sonst die PM-Faktoren. */
export function resolveFormkartenFarbregel(env: Record<string, string | undefined> = lieseUmgebung()): FormkartenFarbregel {
  return (env.OLY_FORMKARTEN_FARBREGEL ?? "").trim().toLowerCase() === "schmal" ? FARBREGEL_SCHMAL : FARBREGEL_PM;
}

function lieseUmgebung(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

/** Wert einer Karte für EINEN Spieler nach der neuen Regel. */
export function kartenWertFuerSpieler(input: {
  karte: FormkartePlay;
  disziplinFarbe: string | null | undefined;
  spielerFarbe: string | null | undefined;
  formStufe?: number;
  regel?: FormkartenFarbregel;
}): number {
  const regel = input.regel ?? FARBREGEL_PM;
  const v = input.karte.wert;
  if (!Number.isFinite(v) || v === 0) return 0;
  const passend = Boolean(input.karte.farbe) && input.karte.farbe === input.disziplinFarbe;
  const alle = v * (passend ? regel.allePassend : regel.alleFremd);
  const istTraeger = Boolean(input.karte.farbe) && input.karte.farbe === input.spielerFarbe;
  if (!istTraeger) return alle;
  const stufe = input.formStufe ?? 0;
  const hebel = v > 0 && stufe > 0 ? 1 + FORM_TRAEGER_HEBEL * stufe : 1;
  return alle + v * regel.traeger * hebel;
}

/** Summe bis zu zwei Karten für EINEN Spieler (Wert ganzzahlig auf eine Dezimale gerundet). */
export function formkartenSummeFuerSpieler(input: {
  karten: FormkartePlay[];
  disziplinFarbe: string | null | undefined;
  spielerFarbe: string | null | undefined;
  formStufe?: number;
  regel?: FormkartenFarbregel;
}): number {
  const summe = input.karten.reduce(
    (acc, karte) =>
      acc +
      kartenWertFuerSpieler({
        karte,
        disziplinFarbe: input.disziplinFarbe,
        spielerFarbe: input.spielerFarbe,
        formStufe: input.formStufe,
        regel: input.regel,
      }),
    0,
  );
  return Number(summe.toFixed(1));
}

/** Alte Regel je Karte (Referenz für Messung und Test): alle gleich, x2 bei passender Disziplinfarbe. */
export function kartenWertAltRegel(karte: FormkartePlay, disziplinFarbe: string | null | undefined): number {
  return karte.wert * (karte.farbe && karte.farbe === disziplinFarbe ? 2 : 1);
}

/**
 * Hinweistext für die Einsatzliste, z. B. "Karte Gelb: +4 für alle, +4 für 3 gelbe Spieler".
 * `traegerAnzahl` = Spieler der Seite mit Klassenfarbe = Kartenfarbe.
 */
export function formkartenHinweis(input: {
  karte: FormkartePlay;
  disziplinFarbe: string | null | undefined;
  traegerAnzahl: number;
  regel?: FormkartenFarbregel;
}): string {
  const regel = input.regel ?? FARBREGEL_PM;
  const passend = Boolean(input.karte.farbe) && input.karte.farbe === input.disziplinFarbe;
  const alle = input.karte.wert * (passend ? regel.allePassend : regel.alleFremd);
  const extra = input.karte.wert * regel.traeger;
  const vz = (x: number) => `${x >= 0 ? "+" : ""}${Number(x.toFixed(1))}`;
  const farbe = input.karte.farbe ?? "?";
  return input.traegerAnzahl > 0
    ? `Karte ${farbe}: ${vz(alle)} für alle, ${vz(extra)} zusätzlich für ${input.traegerAnzahl} Spieler dieser Farbe`
    : `Karte ${farbe}: ${vz(alle)} für alle, kein Spieler dieser Farbe im Einsatz`;
}
