/**
 * DIE MERKLISTEN-ANSICHT MUSS ERREICHBAR SEIN — nicht nur existieren.
 *
 * Eine neue Ansicht in dieser Schale haengt an VIER Stellen, und drei davon fallen still aus,
 * wenn man sie vergisst: die Ansicht ist gebaut, aber kein Weg fuehrt hin.
 *
 * ZWEI PARALLELE LISTEN DER ANSICHTEN — beim Einbau nachgemessen: `FOUNDATION_VIEW_IDS`
 * (foundation-view-routing.ts) und der Union-Typ `FoundationView`
 * (tabs/foundation-page-types.ts) zaehlen dieselben Ansichten getrennt auf. Wer nur eine von
 * beiden pflegt, bekommt einen Typfehler an einer voellig anderen Stelle — beim Einbau der
 * Merkliste waren es vierzehn Meldungen in drei fremden Dateien, keine davon an der neuen
 * Ansicht. Der letzte Test hier vergleicht deshalb beide Listen vollstaendig.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FOUNDATION_VIEW_IDS, SCOUTING_MERKLISTE_TAB, istAlterMerklisteLink, normalizeFoundationViewParam } from "@/lib/foundation/foundation-view-routing";
import { FOUNDATION_NAV_GROUPS } from "@/lib/foundation/foundation-nav-config";

const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const ROUTER = lies("app/foundation/FoundationShellRouterBody.tsx");
const SCOPE = lies("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const CSS = lies("app/globals.css");
const ANSICHT = lies("app/foundation/merkliste-v2/MerklisteClient.tsx");

describe("Merkliste ist ein Reiter der Scouting-Seite (22.11.)", () => {
  it("ist keine eigene Ansicht und steht nicht einzeln in der Navigation", () => {
    expect(FOUNDATION_VIEW_IDS).not.toContain("merkliste");
    const alleItems = FOUNDATION_NAV_GROUPS.flatMap((gruppe) => gruppe.items);
    expect(alleItems.find((item) => item.id === "merkliste")).toBeUndefined();
    expect(alleItems.find((item) => item.id === "scoutingCenterV2")).toBeTruthy();
  });

  it("alte Links view=merkliste leiten auf Scouting um, Reiter Merkliste aktiv", () => {
    expect(normalizeFoundationViewParam("merkliste")).toBe("scoutingCenterV2");
    expect(istAlterMerklisteLink("merkliste")).toBe(true);
    expect(istAlterMerklisteLink("scouting-v2")).toBe(false);
    expect(SCOUTING_MERKLISTE_TAB).toBe("merkliste");
    expect(SCOPE).toContain('setScoutingCenterTab("merkliste")');
  });

  it("hat in der Scouting-Unternavigation einen Reiter Merkliste und rendert dort den Host mit Props", () => {
    expect(ROUTER).toContain('{ id: "merkliste", label: "Merkliste" }');
    expect(ROUTER).toContain('scoutingCenterTab === "merkliste"');
    expect(ROUTER).toContain("<FoundationMerklisteHost {...foundationMerklisteHostProps} />");
    expect(ROUTER).not.toContain('activeView === "merkliste"');
    expect(ROUTER).toMatch(/^\s{2}foundationMerklisteHostProps,$/m);
  });

  it("bekommt ihre Daten aus der Schale — mit Besitzer und beiden Entfernen-Rueckrufen", () => {
    expect(SCOPE).toContain("const foundationMerklisteHostProps: FoundationMerklisteHostProps = {");
    expect(SCOPE).toContain("normalisiereMerklistenBesitzer(activeOwnerId)");
    expect(SCOPE).toContain("baueMerklistenAnsicht(");
    expect(SCOPE).toContain('art: "team", id: teamId');
    expect(SCOPE).toContain('art: "spieler", id: playerId');
  });

  it("schreibt auch hier ohne Netzaufruf — der Autosave nimmt es mit", () => {
    const block = SCOPE.slice(
      SCOPE.indexOf("const foundationMerklisteHostProps"),
      SCOPE.indexOf("const foundationAllTimeTableHostProps"),
    );
    expect(block).not.toContain("fetch(");
  });

  it("zeigt statt einer leeren Tabelle einen Satz, der den Weg erklaert", () => {
    // Dieselbe Regel, an der die alten leeren Kaesten auf der Arena-Tafel gescheitert sind.
    expect(ANSICHT).toContain("Noch nichts gemerkt.");
    expect(ANSICHT).toContain("merkliste-leer");
    expect(CSS).toContain(".merkliste-leer {");
  });

  it("hat fuer jede eigene Klasse eine Regel im Stylesheet", () => {
    const klassen = new Set(
      [...ANSICHT.matchAll(/"(merkliste-[a-z0-9-]*(?<!-))"/g)].map((treffer) => treffer[1] as string),
    );
    expect(klassen.size).toBeGreaterThan(5);
    const ohneRegel = [...klassen].filter((klasse) => !CSS.includes(`.${klasse} `) && !CSS.includes(`.${klasse} {`));
    expect(ohneRegel, "Klassen ohne CSS-Regel — die Ansicht waere dort unformatiert").toEqual([]);
  });
});

describe("Die zwei Listen der Ansichten", () => {
  it("zaehlen exakt dieselben Ansichten auf", () => {
    // GEMESSEN beim Einbau: nur `FOUNDATION_VIEW_IDS` zu pflegen erzeugte vierzehn Typfehler in
    // drei fremden Dateien, keiner davon an der neuen Ansicht. Dieser Vergleich sagt stattdessen
    // in einem Satz, was fehlt.
    const union = lies("lib/foundation/tabs/foundation-page-types.ts");
    const block = union.slice(union.indexOf("export type FoundationView ="));
    const ausUnion = new Set(
      [...block.slice(0, block.indexOf(";")).matchAll(/"([a-zA-Z0-9]+)"/g)].map((treffer) => treffer[1] as string),
    );
    const ausListe = new Set<string>(FOUNDATION_VIEW_IDS);

    expect([...ausListe].filter((id) => !ausUnion.has(id)), "fehlt im Union-Typ FoundationView").toEqual([]);
    expect([...ausUnion].filter((id) => !ausListe.has(id)), "fehlt in FOUNDATION_VIEW_IDS").toEqual([]);
  });
});
