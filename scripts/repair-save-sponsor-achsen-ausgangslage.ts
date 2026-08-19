/**
 * REPARATUR: die eingefrorene Ausgangslage der Sponsor-Achse „Ausbau" in Saison-1-Vertraegen.
 *
 * GEMELDET VON CHRIS: „Ich habe als Saisonziel den Ausbau von 2 Gebäuden meiner Wahl — das habe ich
 * bereits erledigt. Da würde ich erwarten, dass das Ziel schon als abgeschlossen da steht und auch
 * finanziell in die GuV schon mit einberechnet und ausgewiesen wird."
 *
 * WAS SCHIEFGING. `ensureSeasonSponsorOffers` verglich die Zahl vorhandener Angebote gegen eine
 * eingetippte 5, waehrend `SPONSOR_ANGEBOTE_JE_TEAM` laengst 3 war. Die Bedingung konnte nie mehr
 * wahr werden, die Funktion erzeugte bei JEDEM Aufruf neu — und sie laeuft bei jedem Laden des
 * Spielstands. Der Wurf selbst ist saatgebunden und lieferte dieselben Sponsoren; mitgewandert ist
 * nur die AUSGANGSLAGE der Achse, die `buildSponsorOffersForTeam` aus dem lebenden Zustand
 * einfriert. Die Vorsaison baut erst die Gebaeude und waehlt danach den Sponsor: jede gebaute Stufe
 * landete damit in der Ausgangslage statt auf dem Ziel.
 *
 * Der Code ist repariert (sponsor-offer-service.ts). Bereits UNTERSCHRIEBENE Vertraege tragen die
 * falsche Zahl aber weiter mit sich — dieses Skript setzt sie gerade.
 *
 * WARUM NUR SAISON 1 UND NUR „AUSBAU". Fuer einen Saison-1-Vertrag ist die richtige Ausgangslage
 * beweisbar 0: ein neues Spiel startet mit jedem Gebaeude auf Stufe 0, und die Angebote entstehen
 * in `buildNewGameStateFromBaseline`, bevor irgendetwas gebaut werden kann. Fuer spaetere Saisons
 * waere der richtige Wert der Gebaeudestand zu Saisonbeginn — der steht nirgends, und ihn zu raten
 * hiesse, einen Vertrag nach Gutduenken zu verschieben. `soliditaet` ist aus demselben Grund
 * ausgenommen: ihre Ausgangslage ist die Finanzlage bei Erzeugung, und die ist nicht mehr
 * rekonstruierbar. Betroffene Vertraege werden deshalb GEMELDET, nicht angefasst.
 *
 * Ohne `--schreiben` wird nichts gespeichert.
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  heileSponsorAchsenAusgangslage,
  istVerschobeneAusbauAchse,
} from "@/lib/sponsor/sponsor-achsen-ausgangslage-heilung";
import { evaluateSponsorV4Axis } from "@/lib/sponsor/sponsor-v4-axes";
import { sponsorV4AxisTermsFromComponent } from "@/lib/sponsor/sponsor-objective-evaluator";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import type { GameState } from "@/lib/data/olyDataTypes";

const schreiben = process.argv.includes("--schreiben");
const persistence = createPersistenceService();
const saveId = process.env.SAVE_ID ?? null;
const save = saveId ? persistence.getSaveById(saveId) : persistence.getActiveSave();
if (!save?.gameState) {
  throw new Error(`Kein Spielstand gefunden (SAVE_ID=${saveId ?? "<aktiver>"}).`);
}

const gameState = save.gameState as GameState;
const seasonId = gameState.season.id;
console.log(`Spielstand ${save.saveId} · Saison ${seasonId} · ${schreiben ? "SCHREIBEND" : "Trockenlauf"}\n`);

function sponsorGesamt(stand: GameState, teamId: string): number {
  const zeilen = previewSponsorSettlement(stand, "season_end").rows.filter((row) => row.teamId === teamId);
  return Math.round(zeilen.reduce((summe, row) => summe + row.cashDelta, 0) * 100) / 100;
}

/**
 * EINE RECHENSTELLE: die Heilung selbst steht in
 * `lib/sponsor/sponsor-achsen-ausgangslage-heilung.ts` und laeuft im Spiel bei jedem Laden des
 * Spielstands. Dieses Skript ruft genau dieselbe Funktion auf — es ist der PRUEFSTAND dazu, kein
 * zweiter Weg: es zeigt vorher/nachher in C, damit man die Wirkung sieht, statt sie zu glauben.
 *
 * Wer das Spiel einmal laedt, braucht das Skript deshalb gar nicht mehr. Es bleibt fuer den Fall,
 * dass man die Wirkung an einem ABBILD nachrechnen will, ohne den laufenden Stand anzufassen.
 */
const naechsterStand = heileSponsorAchsenAusgangslage(gameState);
const geaendert = Object.values(gameState.seasonState.sponsorContractsByTeamId ?? {})
  .flatMap((vertrag) => vertrag?.components ?? [])
  .filter(istVerschobeneAusbauAchse).length;

for (const [teamId, vertrag] of Object.entries(gameState.seasonState.sponsorContractsByTeamId ?? {})) {
  for (const komponente of vertrag?.components ?? []) {
    const terms = sponsorV4AxisTermsFromComponent(komponente);
    if (!terms || terms.baseline === 0) continue;
    if (istVerschobeneAusbauAchse(komponente) && naechsterStand !== gameState) {
      const nachher = evaluateSponsorV4Axis(naechsterStand, teamId, { ...terms, baseline: 0 });
      console.log(
        `  ${teamId}: axisbase ${terms.baseline} → 0 · Achse ${evaluateSponsorV4Axis(gameState, teamId, terms).metric} → ${nachher.metric} von ${nachher.target} ${nachher.unit}`,
      );
    } else {
      console.log(
        `  (unangetastet) ${teamId}: Achse „${terms.key}" mit Ausgangslage ${terms.baseline} (Saison ${seasonId}) — nicht rekonstruierbar, bleibt stehen`,
      );
    }
  }
}

if (geaendert === 0) {
  console.log("\nNichts zu reparieren.");
  process.exit(0);
}

console.log(`\n${geaendert} Vertragskomponente(n) betroffen. Wirkung auf die Sponsor-Abrechnung:`);
for (const team of gameState.teams) {
  const vorher = sponsorGesamt(gameState, team.teamId);
  const nachher = sponsorGesamt(naechsterStand, team.teamId);
  if (vorher === nachher) continue;
  console.log(`  ${team.teamId.padEnd(6)} ${vorher.toFixed(2)} → ${nachher.toFixed(2)} C (${(nachher - vorher > 0 ? "+" : "")}${(nachher - vorher).toFixed(2)})`);
}

if (!schreiben) {
  console.log("\nTrockenlauf — nichts gespeichert. Mit --schreiben anwenden.");
  process.exit(0);
}

persistence.saveSingleplayerState(save.saveId, naechsterStand);
console.log("\nGespeichert.");
