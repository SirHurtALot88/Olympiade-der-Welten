/**
 * KI-BEWERTUNG DES ARENA-AUSBAUS (client-sicher; der Lauf mit dem Schreiben steht in `arena-ki.ts`). KI-AUSBAU DER ARENA (22.11., docs/design/finanzen-posten-22-11.md h.4 und i.1): die KI baut nach DENSELBEN Regeln wie der Mensch
 * (`bauArenaAus`: Kasse, Obergrenzen, harte Vorstands-Freigabe aus dem Investitionstopf) und nur, wenn sich der Ausbau laut
 * "bringt ca." lohnt.
 *
 *   - nur in Bereichen mit Empfehlung: Schnitt der letzten drei Heimspiele bei 90 % oder mehr (mindestens zwei gespielt);
 *   - so viele Schritte, wie der Ueberhang der Nachfrage fuellt, hoechstens drei je Bereich und Saison;
 *   - nur, wenn "Erwartet" den Bau in hoechstens vier Saisons bezahlt (i.1; vorher sechs);
 *   - Logen nur mit Erfolg und grossem Sponsor (Sponsor-Stufe und Tabellenplatz je mindestens die Haelfte);
 *   - gebaut wird nur, was nach der Ruecklage nach Finanzwert (`resolveKiRuecklageFuerTeam`) noch frei ist, wie beim Reha-Bau.
 *
 * Laeuft beim Spieltagsabschluss fuer KI-Teams und fuer Menschen-Teams mit delegiertem Bereich "Gebaeude"; Menschen ohne Delegation
 * bleiben unberuehrt. Ein Fehlschlag kippt den schon geschriebenen Spieltagswechsel nie.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { KI_REHA_RUECKLAGE_S1_FAKTOR } from "@/lib/ai/ki-schonung-reha-regeln";
import { resolveKiRuecklageFuerTeam } from "@/lib/finance/ki-ruecklage";
import { FANBASIS_WACHSTUM_SAISON, SCHRITT_GROESSE, ausbauVorschau, fanMaximum, maxSchritte, plaetzeNachSchritten, schritteGebaut } from "@/lib/arena/arena-modell";
import { arenaAktiv } from "@/lib/arena/arena-regel";
import { holeArenaStand, istLiga1, letzteDreiSchnitt, ligaTabellenAnteil, sponsorStufen, heimspieleDerSaison } from "@/lib/arena/arena-stand";
import { ARENA_BEREICHE, type ArenaBereich } from "@/lib/arena/arena-typen";

export const KI_MAX_SCHRITTE_JE_BEREICH_UND_SAISON = 3;
export const KI_MAX_BEZAHLT_SAISONS = 4;
export const KI_EMPFEHLUNG_AUSLASTUNG = 0.9;

export type KiArenaEntscheidung = {
  /** Gewuenschte Schritte je Bereich (nur Bereiche mit Empfehlung und Amortisation). */
  schritte: Partial<Record<ArenaBereich, number>>;
  grund: string[];
  /** Bereiche mit Empfehlung, die am Geld, an der Amortisation oder an der Grenze scheitern. */
  abgelehnt: Array<{ bereich: ArenaBereich; grund: string }>;
};

function saisonNummer(gameState: GameState): number {
  return Number(/(\d+)\s*$/.exec(gameState.season?.id ?? "")?.[1] ?? 1);
}

/** Geld, das nach der Ruecklage nach Finanzwert noch frei ist (wie beim KI-Reha-Bau). */
export function freiesGeldNachRuecklage(gameState: GameState, teamId: string): number {
  const team = gameState.teams.find((t) => t.teamId === teamId);
  if (!team) return 0;
  const eintraege = gameState.rosters.filter((r) => r.teamId === teamId);
  const spieler = new Map(gameState.players.map((p) => [p.id, p] as const));
  const identity = gameState.teamIdentities.find((e) => e.teamId === teamId);
  const ruecklage = resolveKiRuecklageFuerTeam(gameState, teamId, {
    cash: team.cash ?? 0,
    rosterSalaryTotal: eintraege.reduce((sum, e) => sum + (e.salary ?? 0), 0),
    rosterMarketValue:
      saisonNummer(gameState) <= 1
        ? 0
        : eintraege.reduce((sum, e) => sum + Math.max(0, spieler.get(e.playerId)?.marketValue ?? spieler.get(e.playerId)?.displayMarketValue ?? 0), 0),
    finances: identity?.finances,
  }).ruecklage;
  return (team.cash ?? 0) - (saisonNummer(gameState) <= 1 ? ruecklage * KI_REHA_RUECKLAGE_S1_FAKTOR : ruecklage);
}

/**
 * Fanbasis nach dem Ausbau, wie die KI sie erwartet: haengt die Fanbasis am Fan-Maximum, wachsen die Fans nur mit mehr Plaetzen (h.3 "wer am
 * Maximum haengt, muss bauen"); die KI rechnet dann mit einer Saison Wachstum (hoechstens +22 %) bis zum neuen Maximum.
 */
function fanbasisNach(fanbasis: number, vorher: Parameters<typeof fanMaximum>[0], nachher: Parameters<typeof fanMaximum>[0]): number {
  if (fanbasis < 0.95 * fanMaximum(vorher)) return fanbasis;
  return Math.min(fanMaximum(nachher), fanbasis * FANBASIS_WACHSTUM_SAISON);
}

/** Bewertet den Ausbau fuer EIN Team; ohne zu schreiben. Fuer Tests und Messskripte exportiert. */
export function bewerteKiArena(gameState: GameState, teamId: string): KiArenaEntscheidung | null {
  if (!arenaAktiv(gameState)) return null;
  const stand = holeArenaStand(gameState, teamId);
  const schnitt = letzteDreiSchnitt(stand);
  const aus: KiArenaEntscheidung = { schritte: {}, grund: [], abgelehnt: [] };
  if (!schnitt || schnitt.n < 2) return aus;
  const sponsor = sponsorStufen(gameState).get(teamId) ?? 0.5;
  const tabelle = ligaTabellenAnteil(gameState, teamId);
  const heim = heimspieleDerSaison(gameState, teamId);
  let frei = freiesGeldNachRuecklage(gameState, teamId);
  const kandidaten: Array<{ b: ArenaBereich; schritte: number; bezahlt: number }> = [];
  for (const b of ARENA_BEREICHE) {
    if (stand.plaetze[b] <= 0 && b !== "loge") continue;
    if (schnitt.auslastung[b] < KI_EMPFEHLUNG_AUSLASTUNG) continue;
    if (b === "loge" && !(sponsor >= 0.5 && tabelle >= 0.5)) {
      aus.abgelehnt.push({ bereich: b, grund: "Logen erst mit Erfolg und großem Sponsor" });
      continue;
    }
    const grenze = Math.min(KI_MAX_SCHRITTE_JE_BEREICH_UND_SAISON - stand.ausbauSaison[b], maxSchritte(b) - schritteGebaut(b, stand.plaetze[b]));
    if (grenze <= 0) {
      aus.abgelehnt.push({ bereich: b, grund: "Grenze erreicht" });
      continue;
    }
    // Ueberhang der Nachfrage in Schritten (mindestens einer, weil der Bereich voll ist); Logen fuellen sich anteilig, dort ein Schritt.
    const ueberhang = b === "loge" ? 1 : Math.max(1, Math.floor((schnitt.nachfrage[b] - stand.plaetze[b]) / SCHRITT_GROESSE[b]));
    // Schritte so weit zuruecknehmen, bis sie sich in vier Saisons bezahlen und das freie Geld reicht.
    for (let n = Math.min(ueberhang, grenze); n >= 1; n -= 1) {
      const v = ausbauVorschau({ plaetze: stand.plaetze, schritte: { [b]: n }, fanbasis: stand.fanbasis, fanbasisNachher: fanbasisNach(stand.fanbasis, stand.plaetze, plaetzeNachSchritten(stand.plaetze, { [b]: n })), stimmung: stand.stimmung, liga1: istLiga1(gameState, teamId), sponsorStufe: sponsor, tabellenAnteil: tabelle, heimspiele: heim });
      if (v.bezahltErwartet != null && v.bezahltErwartet <= KI_MAX_BEZAHLT_SAISONS) {
        kandidaten.push({ b, schritte: n, bezahlt: v.bezahltErwartet });
        break;
      }
      if (n === 1) aus.abgelehnt.push({ bereich: b, grund: "zahlt sich nicht in vier Saisons aus" });
    }
  }
  kandidaten.sort((a, c) => a.bezahlt - c.bezahlt);
  const gewaehlt: Partial<Record<ArenaBereich, number>> = {};
  for (const k of kandidaten) {
    const v = ausbauVorschau({ plaetze: stand.plaetze, schritte: { [k.b]: k.schritte }, fanbasis: stand.fanbasis, stimmung: stand.stimmung, liga1: istLiga1(gameState, teamId), sponsorStufe: sponsor, tabellenAnteil: tabelle, heimspiele: heim });
    if (v.kosten > frei + 1e-9) {
      aus.abgelehnt.push({ bereich: k.b, grund: "das freie Geld nach der Rücklage reicht nicht" });
      continue;
    }
    frei -= v.kosten;
    gewaehlt[k.b] = k.schritte;
    aus.grund.push(`${k.b}: ${k.schritte} Schritt(e), bezahlt nach ${k.bezahlt.toFixed(1)} Saisons`);
  }
  aus.schritte = gewaehlt;
  return aus;
}

