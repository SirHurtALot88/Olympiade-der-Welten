/**
 * GEMELDET: „die Trainingsansicht setzt das aktive Team auf M-M zurueck" — reproduzierbar ueber
 * drei Teams.
 *
 * Im Browser nachgemessen war es nicht die Trainingsansicht, sondern DREI Stellen, die alle
 * dasselbe taten: ein im Picker gewaehltes A-A war nach jedem Ansichtswechsel und nach jedem
 * Reload wieder M-M, und `?team=A-A` direkt aufgerufen landete gar nicht erst dort.
 *
 *  1. `withOwnedTeamGuard` schnappte JEDEN nicht selbst gesteuerten Kandidaten aufs eigene Team
 *     zurueck — auch eine gerade getroffene Wahl. Das widersprach dem Team-Picker, der bewusst
 *     alle 32 Teams listet und Schreibaktionen getrennt sperrt.
 *  2. Die Trainingsansicht stand in `managementViews` und schaltete deshalb weg, obwohl sie
 *     laengst einen Nur-Ansicht-Modus hat („Training ist nur zur Ansicht offen").
 *  3. `loadSave` uebersprang den Resolver ganz und setzte bei jedem Save-Laden den Startklub —
 *     und ein Ansichtswechsel laedt den Save neu.
 *
 * Was NICHT weichen darf: der Schutz vor einem veralteten `team=`-Parameter aus einem anderen
 * Spielstand. Unterschieden wird jetzt daran, ob die Wahl fuer DIESEN Save gespeichert ist.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const HELPERS = quelle("lib/foundation/tabs/foundation-page-module-helpers.tsx");
const SCOPE = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const PERSIST = quelle("lib/foundation/tabs/use-foundation-persistence-actions.ts");

describe("1. Der Schutz greift nur noch bei fremder Herkunft", () => {
  it("kennt eine Ausnahme für eine bewusste Auswahl", () => {
    expect(HELPERS).toContain("const withOwnedTeamGuard = (");
    expect(HELPERS).toContain("optionen?.bewusst");
  });

  it("misst eine bewusste Wahl an der für DIESEN Save gespeicherten Auswahl", () => {
    // Save-gebunden, weil `readStoredFoundationManagerTeamId` die saveId prüft — genau so bleibt
    // ein Parameter aus einem anderen Spielstand ein Fremdkörper.
    expect(HELPERS).toContain("const gespeicherteAuswahl = options?.ignoreStoredPreference");
    expect(HELPERS).toContain("readStoredFoundationManagerTeamId(teams, options?.activeSaveId)");
    expect(HELPERS).toContain("istBewussteAuswahl(requestedFromUrl)");
  });

  it("lässt das in dieser Sitzung aktive Team unangetastet", () => {
    const strecke = HELPERS.slice(HELPERS.indexOf("const currentTeamId = options?.currentTeamId"));
    expect(strecke.slice(0, 700)).toContain("bewusst: true");
  });
});

describe("2. Die gespeicherte Wahl schlägt den Startklub", () => {
  it("prüft die gespeicherte Auswahl VOR dem Startklub des Spielstands", () => {
    const stelleGespeichert = HELPERS.indexOf("if (gespeicherteAuswahl) {");
    const stelleStartklub = HELPERS.indexOf("const requestedFromSave = resolveFoundationTeamId(teams, options?.savedTeamId);");
    expect(stelleGespeichert).toBeGreaterThan(0);
    expect(stelleStartklub).toBeGreaterThan(0);
    expect(stelleGespeichert).toBeLessThan(stelleStartklub);
  });

  it("behält den Startklub als Rückfall für den ersten Start", () => {
    expect(HELPERS).toContain('{ teamId: requestedFromSave, source: "saved_preference", warning: invalidRouteWarning }');
  });
});

describe("3. Training schaltet nicht mehr weg", () => {
  it("steht nicht mehr in den umschaltenden Management-Ansichten", () => {
    const menge = SCOPE.slice(SCOPE.indexOf("const managementViews = useMemo("), SCOPE.indexOf("const managementViews = useMemo(") + 400);
    for (const ansicht of ["training", "trainingCompact", "trainingV2"]) {
      expect(menge).not.toContain(`"${ansicht}"`);
    }
  });

  it("lässt die Ansichten ohne Lesemodus weiterhin umschalten", () => {
    const menge = SCOPE.slice(SCOPE.indexOf("const managementViews = useMemo("), SCOPE.indexOf("const managementViews = useMemo(") + 400);
    for (const ansicht of ["lineup", "market", "marketV2", "teamSettings"]) {
      expect(menge).toContain(`"${ansicht}"`);
    }
  });

  it("der Nur-Ansicht-Modus der Trainingsansicht ist weiterhin verdrahtet", () => {
    // Ohne ihn wäre das Wegschalten kein Fehler gewesen, sondern der einzige Schutz.
    expect(SCOPE).toContain("managementLocked: isSelectedTeamManagementLocked");
    expect(SCOPE).toContain("Training ist nur zur Ansicht offen.");
  });
});

describe("4. Das Save-Laden überschreibt die Wahl nicht mehr", () => {
  it("nimmt den Startklub nur ohne gespeicherte Wahl für diesen Save", () => {
    const treffer = PERSIST.split("!gespeicherteAuswahlFuerSave && saveSelectedTeamId").length - 1;
    // Zwei Ladepfade in dieser Datei — beide müssen die Bedingung tragen, sonst bleibt einer offen.
    expect(treffer).toBe(2);
    expect(PERSIST).toContain("readStoredFoundationManagerTeamId(nextGameState.teams, payload.save.saveId)");
  });
});
