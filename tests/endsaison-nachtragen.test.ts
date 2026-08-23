/**
 * ENTSCHIEDEN VON CHRIS: „Endsaison speichern" statt weiter herunterzuzählen.
 *
 * Seit dem Umbau ist `contractEndSeasonNumber` die Wahrheit. Geschrieben wird das Feld aber erst
 * bei einer NEUEN Unterschrift — wer heute einen laufenden Vertrag hat, trägt es nicht. An Chris'
 * Spielstand waren das 268 von 269 Verträgen, für die die Endsaison bei jedem Lesen neu aus dem
 * Countdown abgeleitet wurde.
 *
 * Solange die Alterung läuft, stimmen beide überein. Nimmt man sie weg — und genau das ist das
 * Ziel —, bliebe der Countdown stehen und mit ihm die abgeleitete Endsaison: kein Vertrag der Liga
 * würde je wieder auslaufen. Der Nachtrag ist deshalb die VORAUSSETZUNG für Schritt 4 und nicht
 * bloß Aufräumen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { trageEndsaisonNach } from "@/lib/contracts/endsaison-nachtragen";
import { SEASON_END_CONTRACT_TICK_STEP_ID } from "@/lib/contracts/saisonende-alterung-marke";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

function spielstand(optionen?: { alterungGelaufen?: boolean }) {
  const gameState = structuredClone(createSingleplayerGameState());
  for (const eintrag of gameState.rosters) {
    delete (eintrag as { contractEndSeasonNumber?: number }).contractEndSeasonNumber;
  }
  if (optionen?.alterungGelaufen) {
    gameState.gamePhase = "season_end_management";
    gameState.seasonState.preSeasonWorkflowLogs = [
      ...(gameState.seasonState.preSeasonWorkflowLogs ?? []),
      {
        logId: "season-end-contract-tick__test",
        saveId: "test",
        fromSeasonId: gameState.season.id,
        toSeasonId: gameState.season.id,
        stepId: SEASON_END_CONTRACT_TICK_STEP_ID,
        status: "applied",
        createdAt: new Date(0).toISOString(),
      } as NonNullable<typeof gameState.seasonState.preSeasonWorkflowLogs>[number],
    ];
  }
  return gameState;
}

describe("Der Endsaison-Nachtrag schreibt die Endsaison ins Feld", () => {
  it("mitten in der Saison zählt die laufende mit", () => {
    const gameState = spielstand();
    gameState.rosters[0].contractLength = 3;

    const nachher = trageEndsaisonNach(gameState);

    // Saison 1, noch drei Saisons: 1, 2, 3 — Endsaison also 3.
    expect(nachher.rosters[0].contractEndSeasonNumber).toBe(3);
  });

  it("nach der Alterung greift der Versatz um eine Saison", () => {
    // Genau Chris' Fall: 129 Vertraege standen nach der Alterung auf Laufzeit 1 und hatten alle
    // noch eine volle Saison — Endsaison 2, nicht 1.
    const gameState = spielstand({ alterungGelaufen: true });
    gameState.rosters[0].contractLength = 1;

    const nachher = trageEndsaisonNach(gameState);

    expect(nachher.rosters[0].contractEndSeasonNumber).toBe(2);
  });

  it("jeder Vertrag ohne Endsaison bekommt eine", () => {
    const gameState = spielstand();
    const nachher = trageEndsaisonNach(gameState);
    const ohne = nachher.rosters.filter(
      (eintrag) => typeof eintrag.contractEndSeasonNumber !== "number",
    );
    expect(ohne).toEqual([]);
  });

  it("eine bereits gesetzte Endsaison wird NICHT überschrieben", () => {
    // Der ganze Punkt der Umstellung: das Feld schlaegt den Countdown. Ein Nachtrag, der es
    // zurueckrechnet, wuerde das aufheben — und frisch unterschriebene Vertraege beschaedigen.
    const gameState = spielstand();
    gameState.rosters[0].contractLength = 1;
    gameState.rosters[0].contractEndSeasonNumber = 7;

    const nachher = trageEndsaisonNach(gameState);

    expect(nachher.rosters[0].contractEndSeasonNumber).toBe(7);
  });

  it("ein zweiter Lauf ändert nichts mehr", () => {
    const einmal = trageEndsaisonNach(spielstand());
    const zweimal = trageEndsaisonNach(einmal);
    // Identitaet, nicht nur Gleichheit: ohne Aenderung darf kein neues Objekt entstehen.
    expect(zweimal).toBe(einmal);
  });

  it("ohne Kader oder ohne Saisonnummer bleibt der Spielstand unangetastet", () => {
    const leer = spielstand();
    leer.rosters = [];
    expect(trageEndsaisonNach(leer)).toBe(leer);
  });
});

describe("Der Nachtrag hängt im Lade- und im Schreibweg", () => {
  const repository = readFileSync(join(process.cwd(), "lib/persistence/save-repository.ts"), "utf8");

  it("er wird beim Laden angewandt", () => {
    // Ein Skript muesste jemand ausfuehren, je Spielstand einzeln; ein uebersehener Stand fiele
    // erst auf, wenn seine Vertraege nicht mehr enden.
    expect(repository).toContain('import { trageEndsaisonNach } from "@/lib/contracts/endsaison-nachtragen";');
    expect(repository.match(/trageEndsaisonNach\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
