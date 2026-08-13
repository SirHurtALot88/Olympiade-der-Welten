/**
 * ES GIBT GENAU EINEN WEG ZU EINEM NEUEN SPIELSTAND.
 *
 * GEMELDET VON CHRIS: „säuber die ganzen reiter dass es WIRKLICH nur noch einen weg gibt!!! und
 * zwar am besten den ich dir gezeigt hab im screenshot: team auswählen die human gesteuert sind
 * durch anklicken und dann ‚Neues Spiel anlegen'" — davor: „aktuell startet jedes game mit 0
 * manuellen spielern und ich weiß gar nicht mehr was ich wo einstellen muss".
 *
 * BEFUND: es waren VIER Stellen, an denen entschieden wurde, wem ein Team gehört.
 *
 *   1. Spielstände & Start → Klub-Picker + „Neues Spiel erstellen"   (Assistent, richtig)
 *   2. Spielstände & Start → „Neues Spiel anlegen"                    (20 Zeilen tiefer, roh)
 *   3. Spielmodus & KI     → Dropdown „Dein Team"                     (Solo-Fall)
 *   4. Spielmodus & KI     → 32-Karten-Raster                         (dieselbe Sache)
 *
 * (2) baute den Stand direkt aus dem Saatzustand, und der kennt keinen Spieler — an Chris'
 * Spielständen nachgemessen trugen alle über den Assistenten angelegten manual=1/ai=31, beide
 * über diesen Weg angelegten manual=0/ai=32. (3) und (4) sind dieselbe Entscheidung zweimal,
 * innerhalb EINES Reiters.
 *
 * Übrig bleibt EINS: das Anlegen. Ein Weg, ein Knopf, eine Entscheidung — wem ein Team gehört,
 * wird genau einmal festgelegt und steht danach fest. (3) und (4) sind ersatzlos entfallen; der
 * KI-Reiter ZEIGT die Zuordnung nur noch an. Siehe den Nachtrag weiter unten, warum auch das
 * Korrigieren weg ist.
 *
 * Warum Quelltext-Prüfungen: das Projekt fährt vitest ohne jsdom, für diesen Bildschirm gibt es
 * keinen Render-Pfad ohne kompletten GameState (siehe `new-game-setup-ui-contract.test.ts`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ANSICHT = readFileSync(
  join(process.cwd(), "app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx"),
  "utf8",
);

describe("Neues Spiel · genau ein Weg", () => {
  it("kennt nur noch EINEN Knopf, der ein Spiel anlegt", () => {
    const treffer = ANSICHT.match(/Neues Spiel anlegen<\/button>|>\s*Neues Spiel anlegen\s*<\/button>/g) ?? [];
    // Der Text steht genau einmal als Beschriftung — im Assistenten.
    const beschriftungen = ANSICHT.match(/"Neues Spiel anlegen"/g) ?? [];
    expect(beschriftungen.length + treffer.length).toBeGreaterThan(0);
    expect(ANSICHT).toContain('{pendingNewGameCreate ? "Prüft & legt an..." : newGameBusy ? "Arbeitet..." : "Neues Spiel anlegen"}');
  });

  it("hat den zweiten, rohen Anlege-Knopf nicht mehr", () => {
    // Er rief `runSaveAction({ action: "create" })` direkt auf — ohne Assistent, ohne Vorschau.
    expect(ANSICHT).not.toMatch(/runSaveAction\(\{\s*action:\s*"create"/);
  });

  it("verweigert das Anlegen, solange kein eigener Klub angetippt ist", () => {
    // Der Riegel: ein Spielstand ohne eigenes Team macht einen zum Zuschauer der eigenen Liga.
    expect(ANSICHT).toContain("newGameChrisTeamIds.length === 0");
    expect(ANSICHT).toContain('data-testid="new-game-needs-own-team"');
  });

  it("sagt beim gesperrten Knopf auch, WARUM er gesperrt ist", () => {
    // Ein grauer Knopf ohne Grund ist dasselbe Uebel wie ein roher Fehlercode.
    expect(ANSICHT).toContain("Noch kein eigener Klub gewählt.");
  });
});

/**
 * NACHTRAG — Chris: „ich will keine spielstände mehr reparieren, hau es raus mach mir nur einen
 * sauber verknüpften weg für die zukunft damit ich sauber bin!"
 *
 * Ich hatte das Zuordnungs-Raster im KI-Reiter zunächst als Reparaturweg behalten. Das war der
 * falsche Kompromiss: ein zweites 32-Karten-Raster, das dem Klub-Picker zum Verwechseln ähnlich
 * sieht, IST die Falle — und einen Reparaturweg braucht nur, wo etwas kaputt entstehen kann. Seit
 * der rohe Anlege-Knopf weg ist und ohne eigenen Klub kein Spiel mehr entsteht, kann es das nicht.
 */
describe("KI-Reiter · zeigt an, entscheidet nicht", () => {
  it("hat das doppelte Solo-Dropdown nicht mehr", () => {
    expect(ANSICHT).not.toContain('data-testid="solo-player-team-select"');
  });

  it("hat auch das zweite Klub-Raster nicht mehr", () => {
    expect(ANSICHT).not.toContain('data-testid="game-mode-ownership-picker"');
    expect(ANSICHT).not.toContain('data-testid="game-mode-ownership-panel"');
  });

  it("zeigt die Zuordnung weiterhin — sehen ja, ändern nein", () => {
    expect(ANSICHT).toContain('data-testid="game-mode-ownership-readonly"');
    expect(ANSICHT).toContain("Wer steuert was");
  });

  it("verweist für eine andere Zuordnung auf den einen Weg", () => {
    expect(ANSICHT).toContain('Festgelegt beim Anlegen des Spielstands unter „Spielstände &amp; Start"');
  });

  it("heißt jetzt nach dem, was es noch tut", () => {
    expect(ANSICHT).toContain('{ id: "control", label: "KI-Verhalten" }');
    expect(ANSICHT).not.toContain('title="Spielmodus & Team-Zuordnung"');
  });
});
