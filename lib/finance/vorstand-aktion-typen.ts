/** Eingabe und Ergebnis des Schreibwegs `POST /api/finance/vorstand` (Finanzseite und Office). Nur Typen. */
import type { GespraechAntrag } from "@/lib/finance/vorstand-gespraech";

export type VorstandAktionEingabe = {
  aktion:
    | "umschichten"
    | "vorstand_fordert_annehmen"
    | "gespraech_antrag"
    | "gespraech_annehmen"
    | "gespraech_zurueckziehen"
    | "praemien_setzen";
  betrag?: number;
  antrag?: GespraechAntrag;
  siegStufe?: number;
  treueStufe?: number;
};

export type VorstandAktionAntwort = { ok: boolean; reason: string | null; meldung: string };

export type VorstandAktionFn = (input: VorstandAktionEingabe) => Promise<VorstandAktionAntwort>;
