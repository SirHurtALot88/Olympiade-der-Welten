import type { GameState, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import { sponsorV4AxisKeyFromSpecialKey } from "@/lib/sponsor/sponsor-v4-axes";

/**
 * REPARATUR EINER ZUSAGE, DIE EIN FEHLER VERSCHOBEN HAT.
 *
 * GEMELDET VON CHRIS (19.08.): „Ich habe als Saisonziel den Ausbau von 2 Gebäuden meiner Wahl — das
 * habe ich bereits erledigt. Da würde ich erwarten, dass das Ziel schon als abgeschlossen da steht
 * und auch finanziell in die GuV schon mit einberechnet und ausgewiesen wird."
 *
 * WAS SCHIEFGING (Ursache behoben in `ensureSeasonSponsorOffers`): eine V4-Achse misst gegen die bei
 * Angebotserzeugung eingefrorene eigene Ausgangslage — `axisbase:` im `targetValue`. Die
 * Angebots-Erzeugung wurde durch einen veralteten Zahlenvergleich bei JEDEM Laden des Spielstands
 * erneut ausgefuehrt, und dabei wanderte diese Ausgangslage mit dem lebenden Zustand mit. Fuer die
 * Achse „Ausbau" heisst das: die Vorsaison baut erst die Gebaeude und waehlt danach den Sponsor —
 * jede gebaute Stufe landete in der Ausgangslage statt auf dem Ziel, und bei Unterschrift stand die
 * Achse garantiert auf 0.
 *
 * WARUM DAS HIER GEHEILT WIRD UND NICHT PER DATENBANK-TAUSCH: der Fehler steckt in bereits
 * UNTERSCHRIEBENEN Vertraegen und verschwindet nicht dadurch, dass der erzeugende Code repariert
 * ist. Ein Austausch der ganzen SQLite waere der grobe Weg und wuerfe alles weg, was zwischen
 * Abbild und Einspielen gespielt wurde. Diese Heilung fasst genau ein Feld an.
 *
 * WARUM NUR SAISON 1 UND NUR „AUSBAU" — die Grenze ist keine Vorsicht, sondern Beweisbarkeit:
 *
 *  - In Saison 1 ist die richtige Ausgangslage fuer „Ausbau" nachweislich 0. Ein neues Spiel startet
 *    mit jedem Gebaeude auf Stufe 0, und die Angebote entstehen in `buildNewGameStateFromBaseline`,
 *    bevor irgendetwas gebaut werden kann.
 *  - Ab Saison 2 waere der richtige Wert der Gebaeudestand zu Saisonbeginn. Der steht nirgends. Ihn
 *    zu schaetzen hiesse, einen laufenden Vertrag nach Gutduenken zu verschieben — schlimmer als der
 *    Fehler, den es zu beheben gilt.
 *  - `soliditaet` (die einzige andere betroffene Achse im Bestand) misst die Finanzlage bei
 *    Erzeugung. Auch die ist nicht rekonstruierbar. Sie bleibt unangetastet.
 *
 * IDEMPOTENT: nach der Heilung steht `axisbase:0`, und `braucht...` liefert fuer denselben Stand
 * nie wieder true. Ein zweiter Aufruf gibt denselben `gameState` zurueck — Identitaet, nicht Kopie,
 * damit der Aufrufer am `===` erkennt, ob es etwas zu speichern gibt.
 */
export const HEILBARE_ACHSE = "ausbau";
export const HEILBARE_SAISON = "season-1";

function ausgangslageAusZielwert(targetValue: SponsorOfferComponent["targetValue"]): number | null {
  if (typeof targetValue !== "string") return null;
  const roh = /(?:^|;)axisbase:([^;]*)/.exec(targetValue)?.[1];
  const zahl = roh != null ? Number(roh) : NaN;
  return Number.isFinite(zahl) ? zahl : null;
}

/** Traegt diese Komponente eine „Ausbau"-Ausgangslage, die ueber 0 verschoben wurde? */
export function istVerschobeneAusbauAchse(component: SponsorOfferComponent): boolean {
  if (sponsorV4AxisKeyFromSpecialKey(component.specialKey ?? "") !== HEILBARE_ACHSE) return false;
  const ausgangslage = ausgangslageAusZielwert(component.targetValue);
  return ausgangslage != null && ausgangslage > 0;
}

/**
 * Setzt die verschobene Ausgangslage in den Vertraegen der LAUFENDEN Saison 1 zurueck auf 0.
 * Gibt denselben `gameState` zurueck, wenn nichts zu tun war.
 */
export function heileSponsorAchsenAusgangslage(gameState: GameState): GameState {
  if (gameState.season.id !== HEILBARE_SAISON) {
    return gameState;
  }
  const vertraege = gameState.seasonState.sponsorContractsByTeamId ?? {};
  let geaendert = false;
  const naechsteVertraege: typeof vertraege = {};

  for (const [teamId, vertrag] of Object.entries(vertraege)) {
    // Nur der Vertrag DIESER Saison — ein alter Vertrag ist Geschichte und wird nicht nachjustiert.
    if (!vertrag || vertrag.seasonId !== HEILBARE_SAISON) {
      naechsteVertraege[teamId] = vertrag;
      continue;
    }
    const komponenten = vertrag.components ?? [];
    if (!komponenten.some(istVerschobeneAusbauAchse)) {
      naechsteVertraege[teamId] = vertrag;
      continue;
    }
    geaendert = true;
    naechsteVertraege[teamId] = {
      ...vertrag,
      components: komponenten.map((komponente) =>
        istVerschobeneAusbauAchse(komponente)
          ? { ...komponente, targetValue: String(komponente.targetValue).replace(/axisbase:[^;]*/, "axisbase:0") }
          : komponente,
      ),
    };
  }

  if (!geaendert) {
    return gameState;
  }
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, sponsorContractsByTeamId: naechsteVertraege },
  };
}
