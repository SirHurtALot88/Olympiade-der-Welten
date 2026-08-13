/**
 * EIN NEUER SPIELSTAND OHNE EIGENES TEAM IST KEINER.
 *
 * GEMELDET VON CHRIS: „wenn ich in settings hier mein team wähle soll das automatisch konfiguriert
 * werden dass AI die anderen teams übernimmt und nicht dass manual auf 0 bleibt in dem save …
 * aktuell passiert das öfters ich wähle dort ein team aus aber dann wird für mich gepickt usw".
 *
 * BEFUND, an seinen sieben Spielständen nachgemessen:
 *
 *   `new-game-…` („Oly New Game Custom …", Klub-Portfolio-Assistent) → manual=1 / ai=31  ✓
 *   `save-…`     („Neues Spiel …", dieser Weg)                       → manual=0 / ai=32  ✗
 *
 * In den Team-Einstellungen liegen zwei Knöpfe mit fast gleichem Namen übereinander: „Neues Spiel
 * erstellen" (der Assistent) und „Neues Spiel anlegen" (der nackte Weg über `createSave`). Der
 * zweite baute den Spielstand direkt aus dem Saatzustand, und der kennt keinen Spieler. Wer ihn
 * trifft, landet als Zuschauer in seiner eigenen Liga: die KI steuert alle 32 Teams, und beim
 * nächsten Spieltag „wird für einen gepickt".
 *
 * Gepinnt wird die EIGENSCHAFT: ein neu angelegter Spielstand hat ein eigenes Team, solange
 * irgendwo eine Angabe dazu vorliegt — und alle übrigen Teams gehören der KI.
 */
import { describe, expect, it } from "vitest";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

function frischerDienst() {
  process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-neusave-${Math.random().toString(36).slice(2)}.sqlite`;
  return createPersistenceService();
}

function zaehleSteuerung(gameState: { seasonState: { teamControlSettings?: Record<string, { controlMode?: string }> } }) {
  const werte = Object.values(gameState.seasonState.teamControlSettings ?? {});
  return {
    manual: werte.filter((s) => s?.controlMode === "manual").length,
    ai: werte.filter((s) => s?.controlMode === "ai").length,
    gesamt: werte.length,
  };
}

describe("Neuer Spielstand · ein eigenes Team ist Pflicht", () => {
  it("erfindet kein Team, wenn es nirgends eine Angabe gibt", () => {
    // Keine erfundenen Zahlen — auch nicht bei der Steuerung. Ohne jede Angabe bleibt es beim
    // Saatzustand (dort steht manual=0/ai=32), statt irgendein Team zum Lieblingsklub zu erklaeren.
    //
    // MUSS DER ERSTE FALL DIESER DATEI SEIN: die Faelle teilen sich EINE Datenbank, und jeder
    // spaetere legt Spielstaende mit eigenem Team an — dann gaebe es sehr wohl eine Angabe zu
    // erben, und die Pruefung waere gegenstandslos.
    const persistence = frischerDienst();
    persistence.bootstrapSingleplayerSave();
    const neu = persistence.createSave("Ohne alles", null, null);
    expect(zaehleSteuerung(neu.gameState).manual).toBe(0);
  });

  it("macht das gewählte Team zu meinem und den Rest zur KI", () => {
    const persistence = frischerDienst();
    const basis = persistence.bootstrapSingleplayerSave().save;
    const meins = basis.gameState.teams[3]!.teamId;

    const neu = persistence.createSave("Neues Spiel", null, [meins]);
    const zahlen = zaehleSteuerung(neu.gameState);

    expect(zahlen.manual).toBe(1);
    expect(zahlen.ai).toBe(zahlen.gesamt - 1);
    expect(neu.gameState.seasonState.teamControlSettings?.[meins]?.controlMode).toBe("manual");
  });

  it("übernimmt mehrere gewählte Klubs (bis zu 4 sind möglich)", () => {
    const persistence = frischerDienst();
    const basis = persistence.bootstrapSingleplayerSave().save;
    const meine = basis.gameState.teams.slice(0, 3).map((team) => team.teamId);

    const zahlen = zaehleSteuerung(persistence.createSave("Neues Spiel", null, meine).gameState);
    expect(zahlen.manual).toBe(3);
    expect(zahlen.ai).toBe(zahlen.gesamt - 3);
  });

  /**
   * DER GEMELDETE FALL: der Knopf schickte gar keine Auswahl mit. Dann darf nicht „niemand"
   * herauskommen — übernommen wird, was im laufenden Spielstand gilt.
   */
  it("erbt mein Team vom laufenden Spielstand, wenn keine Auswahl mitkommt", () => {
    const persistence = frischerDienst();
    const basis = persistence.bootstrapSingleplayerSave().save;
    const meins = basis.gameState.teams[5]!.teamId;
    // Erster Stand mit eigenem Team — der ist danach der geladene.
    persistence.createSave("Erster", null, [meins]);

    const zweiter = persistence.createSave("Neues Spiel ohne Auswahl", null, null);
    expect(zaehleSteuerung(zweiter.gameState).manual).toBe(1);
    expect(zweiter.gameState.seasonState.teamControlSettings?.[meins]?.controlMode).toBe("manual");
  });


  it("ignoriert Kennungen, die es im neuen Spielstand gar nicht gibt", () => {
    // Eine Steuerung ins Leere zu schreiben waere schlimmer als keine.
    const persistence = frischerDienst();
    persistence.bootstrapSingleplayerSave();
    const neu = persistence.createSave("Mit Unsinn", null, ["gibt-es-nicht"]);
    expect(zaehleSteuerung(neu.gameState).manual).toBe(0);
  });

  it("reicht die Klub-Auswahl vom Knopf bis in die Anfrage durch", async () => {
    // Ohne diese eine Zeile im Knopf bliebe der Dienst wirkungslos.
    const fs = await import("node:fs");
    const quelle = fs.readFileSync("app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx", "utf8");
    expect(quelle).toContain('runSaveAction({ action: "create", name, manualTeamIds: newGameChrisTeamIds })');
  });
});
