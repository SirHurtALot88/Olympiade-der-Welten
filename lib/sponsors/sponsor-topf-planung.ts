/**
 * SPONSOR-TOPF: PLANWERT FUER DIE KI-PLANUNG (24.11.). Eigene, reine Datei (kein Persistenz-, kein Angebots-Import), weil Vorstand-Freigabe und
 * Kreditpruefung ueber `sponsor-erwartung.ts` auch im Client-Bundle landen.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { gueltigerSponsorStempel } from "@/lib/resolve/sponsor-regel";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { SPONSOR_TOPF, runde1 } from "@/lib/sponsors/sponsor-topf-modell";
import { ligaGroesseVon, sponsorLigaVon, teamPlanPosten } from "@/lib/sponsors/sponsor-topf-eingaben";
import type { SponsorRegelStempel } from "@/lib/sponsors/sponsor-topf-typen";

/**
 * Was die KI-Kaufplanung als Sponsoreinnahme ansetzt (Konzept 7): die Vorab-Zusage (90 % des vorlaeufigen Grundbetrags) plus Treuebonus,
 * Leistungsteil 0. Nach dem Stichtag der eingefrorene Grundbetrag. `null`, wenn der Topf nicht gilt oder noch nichts berechnet ist.
 */
export function topfPlanungSponsor(gameState: GameState, teamId: string, opts: { mitVerdraengtem?: boolean } = {}): number | null {
  const stempel = gueltigerSponsorStempel(gameState);
  if (!stempel || stempel.version !== "topf") return null;
  const vertrag = getTeamSponsorContract(gameState, teamId);
  const treue = vertrag?.sponsorTopf ? SPONSOR_TOPF.treueBonus[Math.min(3, Math.max(1, vertrag.sponsorTopf.jahr)) - 1] ?? 0 : 0;
  const eingefroren = stempel.eingefroren?.teams[teamId];
  const verdraengt = opts.mitVerdraengtem ? verdraengteEinnahmenFuerPlanung(gameState, teamId, stempel) : 0;
  if (eingefroren) return runde1(eingefroren.grundbetrag + eingefroren.treue + verdraengt);
  const vorl = stempel.vorlaeufig?.grund[teamId];
  if (vorl == null) return null;
  return runde1(vorl * SPONSOR_TOPF.zusage + treue + verdraengt);
}

/**
 * Was der Topf den Sponsorgeldern der Teams "weggenommen" und als eigene Einnahme gegeben hat (Tickets samt Dauerkarten, Marketing, Medaillen)
 * plus der erwartete Farb-Anteil. Die KI-Planung zaehlt diese Posten sonst nirgends; ohne sie plante sie mit deutlich weniger Geld, als das Team
 * hat, und kaufte kleinere Kader als im alten System (gemessen: Lauf TOPF gegen BASIS, 24.11.).
 */
function verdraengteEinnahmenFuerPlanung(gameState: GameState, teamId: string, stempel: SponsorRegelStempel): number {
  const z = teamPlanPosten(gameState, teamId).zeilen;
  const liga = sponsorLigaVon(gameState, teamId);
  const faktor = stempel.eingefroren?.faktor ?? 1;
  const farbMittel = (4 * SPONSOR_TOPF.farbTopf[liga] * faktor) / ligaGroesseVon(gameState, teamId);
  return (z.tickets ?? 0) + (z.marketing ?? 0) + (z.medaillen ?? 0) + farbMittel;
}
