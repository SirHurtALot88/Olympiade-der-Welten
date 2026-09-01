// Sprite-GROESSE (Skala 1-10, Chris' Sheet, s. data/generated/oly-player-groesse.json und
// dessen Kommentar) — analoges Muster zu lib/data/playerAttributeSheetData.ts: eine reine
// Nachschlage-Datei, kein Bestandteil des Player-Kern-Datenmodells (olyDataTypes.ts bleibt
// unangetastet). Konsumiert wird das aktuell allein von der Battle-Arena-Bruecke
// (lib/foundation/battle-arena/arena-kader-adapter.ts), die daraus u.groesse fuer den
// Motor (public/mockups/battle-mode.engine.js, s. dort groesseFaktor) fuellt.
//
// 2 von 2984 Spielern haben im Original-Sheet keinen Wert (`groesse: null`, z.B. "Rask")
// — getPlayerGroesse gibt fuer sie null zurueck, der Motor faellt dann auf den
// Default-Faktor 1.0 zurueck (s. groesseFaktor: kein Wert => 1, nicht die bei Skala 5
// rechnerisch entstehende 1,022).
import groesseRows from "@/data/generated/oly-player-groesse.json";
import { normalizeAttributeSheetName } from "@/lib/data/playerAttributeSheet";

type PlayerGroesseRow = { name: string; groesse: number | null };

const rows = groesseRows as PlayerGroesseRow[];

function normalizeName(name: string) {
  return normalizeAttributeSheetName(name).trim().toLocaleLowerCase("de");
}

const groesseByNormalizedName = new Map(rows.map((row) => [normalizeName(row.name), row.groesse] as const));

/** Groesse (1-10) fuer einen Spielernamen, oder null wenn unbekannt/nicht gesetzt. */
export function getPlayerGroesse(name: string): number | null {
  return groesseByNormalizedName.get(normalizeName(name)) ?? null;
}
