/**
 * SPONSOR-TOPF: UEBERTRAG (24.11.). Eigene Datei, damit `sponsor-settlement-service.ts` den Stichtag rufen kann, ohne dass Stichtag und
 * Abrechnung einander importieren.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { gueltigerSponsorStempel } from "@/lib/resolve/sponsor-regel";
import { getSeasonSponsorCashByTeam } from "@/lib/sponsor/sponsor-settlement-service";
import { SPONSOR_TOPF, runde1 } from "@/lib/sponsors/sponsor-topf-modell";

/** Der Uebertrag fuer den Topf der naechsten Saison aus der abgelaufenen (gebuchten) Saison. 0 ohne eingefrorenen Topf-Stand. */
export function uebertragFuerSaisonwechsel(abgelaufen: GameState): number {
  const stempel = gueltigerSponsorStempel(abgelaufen);
  const f = stempel?.eingefroren;
  if (!stempel || stempel.version !== "topf" || !f) return 0;
  let gezahlt = 0;
  for (const v of getSeasonSponsorCashByTeam(abgelaufen).values()) gezahlt += v;
  const deckel = SPONSOR_TOPF.uebertragDeckel * f.topf;
  return runde1(Math.min(deckel, Math.max(-deckel, gezahlt - f.topf)));
}

