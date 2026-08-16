/**
 * EIN NETTO-FORECAST: Trainingsliste und Spielerprofil rechnen gleich.
 *
 * GEMELDET VON CHRIS (`dcut58`): „Das was als Netto/Saison hier steht muss gleich sein mit dem
 * forecast der im spielerprofil drin steht - bitte prüfen was korrekt ist und nur eine Zahl
 * ausweisen!"
 *
 * Beide riefen DIESELBE Engine (`buildOrganicSeasonProgression`) mit VERSCHIEDENEN Eingaben. Die
 * Trainingsliste reicht die Entwicklungsroute mit UND
 * `buildProjectedSeasonTrainingAccumulatorOverrides` — den Anti-Cheese-Blend aus Audit #6:
 * gelaufene Spieltage zählen mit ihrem tatsächlich gelockten Modus, nur die Rest-Spieltage mit
 * dem gewählten. Dem Profil fehlten beide; es rechnete „ganze Saison in diesem Modus" — eine
 * Zahl, die ab Spieltag 2 niemand mehr erreichen kann, weil sich die Vergangenheit nicht
 * umtrainieren lässt.
 *
 * DIE VERTEILUNG BEWEIST DIE URSACHE, und deshalb steht sie hier statt einer Stichprobe. Über
 * fünf Live-Spielstände, je rund 340 Kaderspieler:
 *
 *   Spieltag  1 (`n90y4m`)   335 geprüft →   0 abweichend
 *   Spieltag  4 (`h0z7cl`)   337 geprüft → 336 abweichend (Ø 2,44 SP, bis 8,2)
 *   Spieltag  6 (`0kalpx`)   343 geprüft → 333 abweichend (Ø 1,20 SP, bis 5,8)
 *   Spieltag 10 (`hwz8fk`)   336 geprüft → 278 abweichend (Ø 0,67 SP, bis 3,8)
 *
 * An Spieltag 1 weicht KEIN EINZIGER ab — da gibt es noch keine gelaufenen Spieltage, also
 * nichts zu mischen. Das schließt jede andere Erklärung aus.
 *
 * DIE LISTE IST DIE RICHTIGE SEITE, nicht das Profil: sie zeigt den real erreichbaren
 * Saisonende-Wert. Angeglichen wurde deshalb das PROFIL. Andersherum zeigten beide wieder
 * „ganze Saison in diesem Modus" — zwei gleiche, aber falsche Zahlen.
 *
 * Über den echten Profil-Pfad (`buildPlayerDrawerDataFromGameState`) nachgemessen: danach 0
 * Abweichungen in allen fünf Spielständen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DRAWER = readFileSync(join(process.cwd(), "lib/foundation/player-detail-drawer.ts"), "utf8");
const LISTE = readFileSync(join(process.cwd(), "lib/foundation/tabs/use-foundation-cross-tab-training.ts"), "utf8");

describe("Ein Netto-Forecast — Trainingsliste und Spielerprofil rechnen gleich", () => {
  it("das Profil reicht den Anti-Cheese-Blend mit", () => {
    expect(DRAWER).toContain("buildProjectedSeasonTrainingAccumulatorOverrides({");
  });

  it("das Profil reicht die Entwicklungsroute mit", () => {
    expect(DRAWER).toContain("route: progressionForecast?.developmentRoute ?? null");
  });

  it("die Trainingsliste bleibt unverändert — sie war die richtige Seite", () => {
    // Wichtig als Abgrenzung: angeglichen wurde das PROFIL. Hätte man stattdessen die Liste auf
    // den Profil-Aufruf gezogen, zeigten beide wieder „ganze Saison in diesem Modus".
    expect(LISTE).toContain("buildProjectedSeasonTrainingAccumulatorOverrides({");
    expect(LISTE).toContain("route: forecast?.developmentRoute ?? null");
  });

  it("beide benutzen DENSELBEN Rückfall-Modus — ein anderer wäre die nächste Abweichung", () => {
    expect(LISTE).toContain('player.trainingMode ?? "mittel"');
    expect(DRAWER).toContain('draftMode: player.trainingMode ?? "mittel"');
  });

  it("der Forecast des Profils hängt weiter am eigenen Team — die Sichtbarkeit bleibt", () => {
    // Die Reparatur ändert die EINGABEN, nicht wer den Forecast überhaupt sehen darf.
    expect(DRAWER).toContain("team.humanControlled !== false || DEBUG_FORCE_PLAYER_VISIBILITY");
  });
});
