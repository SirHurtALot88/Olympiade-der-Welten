/** Eingabe und Antwort des Schreibwegs `POST /api/arena` (Finanzseite, Reiter Arena). Nur Typen, client-sicher. */
import type { ArenaBereich, DauerkartenStufe } from "@/lib/arena/arena-typen";

export type ArenaAktionEingabe =
  | { aktion: "ausbau"; schritte: Partial<Record<ArenaBereich, number>> }
  | { aktion: "dauerkarten"; stufe: DauerkartenStufe };

export type ArenaAktionAntwort = { ok: boolean; reason: string | null; meldung: string };

export type ArenaAktionFn = (input: ArenaAktionEingabe) => Promise<ArenaAktionAntwort>;
