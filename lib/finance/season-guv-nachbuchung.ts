/**
 * DIE GESPEICHERTE GuV NACH DER BUCHUNG NACHZIEHEN.
 *
 * GEMELDET VON CHRIS an der Historie von L-K: „warum so viel minus in der aktiven season?" Die
 * Zeile wies −33,4 aus, die tatsächlich gebuchten Bewegungen ergaben −18,8.
 *
 * BEFUND — die Zeile ist zu früh eingefroren. `writeLocalCashPrizeApply`
 * (`cash-prize-apply-service.ts`) schreibt `standings[team].guv` und `.guvPosten` aus
 * `resolveSeasonGuvByTeam`, und zwar VOR den eigentlichen Buchungen. Am Abbild `1hf25q` gemessen,
 * Saison 2, alles innerhalb von 16 Sekunden:
 *
 *   18:08:28.587  cashPrizeApply — schreibt guvPosten   ← die eingefrorene Hochrechnung
 *   18:08:29.110  Sponsor-Abrechnung gebucht
 *   18:08:29.224  Apron-Abrechnung gebucht
 *   18:08:44.841  Vorstandsziele gebucht
 *
 * Danach wurde die Zeile nie wieder angefasst. Sie behauptete deshalb dauerhaft „Apron:
 * Hochrechnung, noch nicht gebucht" und liess ihn aus der Summe, und sie trug bei den
 * Vorstandszielen den Vorschauwert (+3,0), wo −1,0 gebucht wurde.
 *
 * WARUM NEU ABLEITEN UND NICHT EINZELNE POSTEN FLICKEN. `resolveSeasonGuvByTeam` liest inzwischen
 * bei JEDEM Posten den Beleg, sobald es einen gibt: Sponsor über `getSeasonSponsorCashByTeam`
 * (gebuchte Logs plus projizierter Rest), Vorstandsziele über `getObjectiveCashByTeam`, Apron über
 * `getApronCashByTeam`. Nach der Buchung ist ein frischer Aufruf damit die vollständige Wahrheit —
 * und das Ergebnis ist per Konstruktion dieselbe Zahl, die die Oberfläche zeigt, wenn sie live
 * rechnet statt aus dem Spielstand zu lesen. Genau diese Doppelung war das Problem.
 *
 * IDEMPOTENT: die Funktion leitet nur ab und vergleicht, bevor sie schreibt. Zweimal laufen ändert
 * nichts.
 *
 * NUR NACH DER BUCHUNG AUFRUFEN. Mitten in der Saison wäre der Aufruf harmlos, aber sinnlos: dann
 * steht in beiden Zeilen dieselbe Hochrechnung.
 */

import type { GameState, StandingRecord } from "@/lib/data/olyDataTypes";
import { resolveSeasonGuvByTeam } from "@/lib/finance/season-guv-resolver";

export type StandingsGuvNachbuchungResult = {
  gameState: GameState;
  /** Teams, deren Zeile sich wirklich geändert hat. Leer = nichts nachzuziehen. */
  geaenderteTeams: string[];
};

/** Zwei Postenlisten sind gleich, wenn Betrag, Zählen und Notiz aller Zeilen gleich sind. */
function postenGleich(links: StandingRecord["guvPosten"], rechts: StandingRecord["guvPosten"]): boolean {
  if (!Array.isArray(links) || !Array.isArray(rechts) || links.length !== rechts.length) {
    return false;
  }
  return links.every((eintrag, index) => {
    const anderer = rechts[index];
    return (
      anderer != null &&
      eintrag.key === anderer.key &&
      eintrag.amount === anderer.amount &&
      eintrag.counted === anderer.counted &&
      (eintrag.note ?? null) === (anderer.note ?? null)
    );
  });
}

/**
 * Leitet `guv` und `guvPosten` im Saisonstand aus der gemeinsamen Rechnung neu ab. Persistiert
 * NICHTS — das bleibt beim Aufrufer, der seine eigene Save-Führung hat.
 *
 * Teams ohne gespeicherte Postenliste bleiben unberührt: die Liste entsteht bei der
 * Saisonende-Buchung, und wo sie fehlt, gab es diese Buchung nicht.
 */
export function zieheSaisonstandGuvNach(gameState: GameState): StandingsGuvNachbuchungResult {
  const standings = gameState.seasonState.standings ?? {};
  if (Object.keys(standings).length === 0) {
    return { gameState, geaenderteTeams: [] };
  }

  const frisch = resolveSeasonGuvByTeam(gameState);
  const geaenderteTeams: string[] = [];
  const naechsteStandings: Record<string, StandingRecord> = {};

  for (const [teamId, standing] of Object.entries(standings)) {
    const neu = frisch.get(teamId) ?? null;
    if (neu == null || !Array.isArray(standing.guvPosten) || standing.guvPosten.length === 0) {
      naechsteStandings[teamId] = standing;
      continue;
    }
    if (standing.guv === neu.guv && postenGleich(standing.guvPosten, neu.posten)) {
      naechsteStandings[teamId] = standing;
      continue;
    }
    naechsteStandings[teamId] = { ...standing, guv: neu.guv, guvPosten: neu.posten };
    geaenderteTeams.push(teamId);
  }

  if (geaenderteTeams.length === 0) {
    return { gameState, geaenderteTeams: [] };
  }

  return {
    gameState: { ...gameState, seasonState: { ...gameState.seasonState, standings: naechsteStandings } },
    geaenderteTeams,
  };
}
