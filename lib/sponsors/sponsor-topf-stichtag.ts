/**
 * SPONSOR-TOPF: STICHTAG, VORAB-ZUSAGE, UEBERTRAG (24.11., Konzept 4.2, 8).
 *
 *   Vorab-Zusage   Zum Saisonwechsel rechnet `stempleVorlaeufig` einen vorlaeufigen Topf (Betriebsteil der Vorsaison + Kader-Ersatz) und den
 *                  vorlaeufigen Grundbetrag je Team in den Stempel. Die KI-Kaufplanung rechnet mit 90 % davon; am Stichtag ist jedes Team
 *                  mindestens bei diesen 90 % (der Fehlbetrag kommt anteilig von den Teams ueber ihrer Untergrenze).
 *   Stichtag       `sichereSponsorTopf` friert Topf, Erwartungsrang, Grundbetrag, Passung, Vertragsart und Farben ein. Aufruf VOR der ersten
 *                  Wertung des ersten Spieltags (zusammen mit dem Einfrieren der Apron-Linien, legacy-matchday-result-apply-service) und als
 *                  Rueckfall beim ersten Buchen. Der Stichtag wartet nie auf einen Menschen: wer nicht unterschrieben hat, bekommt den
 *                  Leistungsvertrag der Marke mit der besten Passung und die KI-Farben (Konzept 8).
 *   Uebertrag      Was der Topf der Vorsaison mehr oder weniger gezahlt hat als geplant (Ziele, Rundung, unverteilte Farb-Toepfe), hoechstens
 *                  3 % des Topfs, geht mit umgekehrtem Vorzeichen in den Topf der naechsten Saison.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { getSeasonSponsorCashByTeam } from "@/lib/sponsor/sponsor-settlement-service";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";
import { gueltigerSponsorStempel, sponsorTopfAktiv } from "@/lib/resolve/sponsor-regel";
import { SPONSOR_TOPF, berechneTopf, richtwertSaison1, runde1, type TopfErgebnis } from "@/lib/sponsors/sponsor-topf-modell";
import { berechneTopfLive, sammleTopfEingabe, sponsorLigaVon, teamPlanPosten } from "@/lib/sponsors/sponsor-topf-eingaben";
import { rechneTopfLive, teamStandenAusLive } from "@/lib/sponsors/sponsor-topf-buchung";
import { baueTopfWahlKontext, besteAngebotNachPassung, type TopfWahlKontext } from "@/lib/sponsors/sponsor-topf-wahl";
import type { SponsorRegelStempel, SponsorTopfVorlaeufig } from "@/lib/sponsors/sponsor-topf-typen";
import { chooseSponsorOffer } from "@/lib/sponsor/sponsor-offer-service";

function schreibeStempel(gameState: GameState, stempel: SponsorRegelStempel): GameState {
  return { ...gameState, seasonState: { ...gameState.seasonState, sponsorRegel: stempel } };
}

/** Vorlaeufiger Topf und Grundbetrag je Team: Betriebsteil der Vorsaison (oder Richtwert) statt der heutigen Kosten, keine Zusage-Untergrenze. */
export function berechneVorlaeufig(gameState: GameState): SponsorTopfVorlaeufig {
  const sammlung = rechneTopfLive(() => sammleTopfEingabe(gameState));
  // Vorlaeufig gelten die Kosten der Vorsaison (K_B des Vorjahres, auf die Teams verteilt) bzw. in Saison 1 der Richtwert; die Plan-Einnahmen
  // der Teams bleiben die heutigen, damit der Betriebsteil genau der Bezug der Bremse ist.
  const teamsRoh = sammlung.eingabe.teams;
  const vorjahr = sammlung.eingabe.betriebsteilVorjahr;
  const vor = vorjahr ?? richtwertSaison1(teamsRoh);
  const n = Math.max(1, teamsRoh.length);
  // Ohne Kader (Neues Spiel vor dem Draft) rechnet der Kader-Ersatz mit dem Richtwert, sonst saehe die KI im Draft einen Topf ohne Ersatz.
  const ohneKader = teamsRoh.every((t) => !(t.kaderwert > 0));
  const teams = teamsRoh.map((t) => ({
    ...t,
    kosten: vorjahr != null ? vorjahr / n + t.planEinnahmen : SPONSOR_TOPF.richtwertKostenSaison1,
    kaderwert: ohneKader ? SPONSOR_TOPF.richtwertKaderwert : t.kaderwert,
  }));
  // Die Rueckkopplung kennt die Abweichung des Liga-Werts erst am Stichtag: vorlaeufig gilt nur die bisher angewandte Korrektur.
  const wertKorrektur = gueltigerSponsorStempel(gameState)?.ligaWertKorrektur ?? 0;
  const e: TopfErgebnis = berechneTopf({ ...sammlung.eingabe, teams, betriebsteilVorjahr: vor, wertKorrektur, zusage: undefined });
  return { topf: e.topf, grund: Object.fromEntries(Object.values(e.teams).map((t) => [t.teamId, t.grundbetrag])) };
}

/** Schreibt die Vorab-Zusage in den Stempel (Saisonwechsel, neues Spiel). Ohne Topf-Regel oder mit eingefrorenem Stand: dieselbe Referenz. */
export function stempleVorlaeufig(gameState: GameState): GameState {
  const stempel = gueltigerSponsorStempel(gameState);
  if (!stempel || stempel.version !== "topf" || stempel.eingefroren) return gameState;
  return schreibeStempel(gameState, { ...stempel, vorlaeufig: berechneVorlaeufig(gameState) });
}

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

/** Teams ohne Vertrag am Stichtag: Leistungsvertrag der Marke mit der besten Passung, Laufzeit 1, KI-Farben (Konzept 8). */
export function fuelleFehlendeVertraege(gameState: GameState): GameState {
  let g = gameState;
  let kontext: TopfWahlKontext | undefined;
  for (const team of gameState.teams) {
    if (getTeamSponsorContract(g, team.teamId)) continue;
    const angebote = getTeamSponsorOffers(g, team.teamId);
    if (angebote.length === 0) continue;
    kontext ??= baueTopfWahlKontext(gameState);
    const ergebnis = chooseSponsorOffer({
      gameState: g,
      teamId: team.teamId,
      offerId: besteAngebotNachPassung(g, team.teamId, angebote).offerId,
      topf: { vertragsart: "leistung", laufzeit: 1, von: "auto" },
      topfKontext: kontext,
    });
    if (ergebnis.error) continue;
    g = ergebnis.gameState;
  }
  return g;
}

/**
 * Friert den Topf ein. Idempotent: ein eingefrorener Stand bleibt. Ohne Topf-Stempel dieselbe Referenz zurueck.
 * Reihenfolge: fehlende Vertraege fuellen, dann rechnen, dann schreiben (der Stand traegt die Vertragsdaten der unterschriebenen Teams).
 */
export function sichereSponsorTopf(gameState: GameState, jetzt: string = new Date().toISOString()): GameState {
  if (!sponsorTopfAktiv(gameState)) return gameState;
  if (gueltigerSponsorStempel(gameState)?.eingefroren) return gameState;
  const mitVertraegen = fuelleFehlendeVertraege(gameState);
  const stempel = gueltigerSponsorStempel(mitVertraegen)!;
  const { ergebnis, sammlung } = rechneTopfLive(() => berechneTopfLive(mitVertraegen));
  return schreibeStempel(mitVertraegen, {
    ...stempel,
    eingefroren: {
      faktor: ergebnis.faktor,
      betriebsteil: ergebnis.betriebsteil,
      betriebsteilRoh: ergebnis.betriebsteilRoh,
      kaderErsatz: ergebnis.kaderErsatz,
      uebertrag: ergebnis.uebertrag,
      topf: ergebnis.topf,
      hauptTopf: ergebnis.hauptTopf,
      farbTopf: ergebnis.farbTopf,
      treueSumme: ergebnis.treueSumme,
      ligaWert: Math.round(sammlung.ligaWert * 10) / 10,
      ligaWertDrift: sammlung.ligaWertDrift == null ? null : Math.round(sammlung.ligaWertDrift * 10) / 10,
      wertKorrektur: ergebnis.wertKorrektur,
      sigma: ergebnis.sigma,
      teams: teamStandenAusLive(ergebnis, sammlung),
      gesperrtAm: jetzt,
    },
  });
}

/**
 * Was die KI-Kaufplanung als Sponsoreinnahme ansetzt (Konzept 7): die Vorab-Zusage (90 % des vorlaeufigen Grundbetrags) plus Treuebonus,
 * Leistungsteil 0. Nach dem Stichtag der eingefrorene Grundbetrag. `null`, wenn der Topf nicht gilt oder noch nichts berechnet ist.
 */
export function topfPlanungSponsor(gameState: GameState, teamId: string): number | null {
  const stempel = gueltigerSponsorStempel(gameState);
  if (!stempel || stempel.version !== "topf") return null;
  const vertrag = getTeamSponsorContract(gameState, teamId);
  const treue = vertrag?.sponsorTopf ? SPONSOR_TOPF.treueBonus[Math.min(3, Math.max(1, vertrag.sponsorTopf.jahr)) - 1] ?? 0 : 0;
  const eingefroren = stempel.eingefroren?.teams[teamId];
  const verdraengt = verdraengteEinnahmenFuerPlanung(gameState, teamId, stempel);
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
  const farbMittel = (4 * SPONSOR_TOPF.farbTopf[liga] * faktor) / 16;
  return (z.tickets ?? 0) + (z.marketing ?? 0) + (z.medaillen ?? 0) + farbMittel;
}
