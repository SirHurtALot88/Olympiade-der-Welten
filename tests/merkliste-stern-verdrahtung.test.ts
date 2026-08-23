/**
 * DER STERN MUSS ANGESCHLOSSEN SEIN — nicht nur gezeichnet.
 *
 * Das Muster, das dieses Repo mehrfach getroffen hat, ist „gebaut, aber nie verdrahtet": ein
 * fertiger Dienst, eine fertige Ansicht, und dazwischen fehlt die Leitung. Beim Merklisten-Stern
 * gab es die Kante wirklich — `activeOwnerId` erreichte die Teamansicht nicht, und ohne dieses
 * Feld faellt die Besitzer-Normalisierung auf den Standardbesitzer zurueck. Im Solo faellt das nie
 * auf; im Koop schriebe Franky in Chris' Liste, und niemand saehe warum.
 *
 * WARUM DER TEST DEN QUELLTEXT LIEST: die Ansichten sind React-Komponenten mit Portalen, Tabellen
 * und einem Dutzend Rueckrufen; diese Testumgebung laeuft mit `environment: "node"` und kann sie
 * gar nicht rendern. Ein Rendertest davon pruefte am Ende die Attrappen. Die Regel selbst ist
 * dagegen scharf formulierbar — und genau sie steht hier.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const ANSICHT = lies("app/foundation/teams-v2/FoundationTeamsNewLook.tsx");
const HOST = lies("app/foundation/teams-v2/FoundationTeamsViewHost.tsx");
const SCHALE = lies("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const CSS = lies("app/globals.css");

describe("Merklisten-Stern in der Teamansicht", () => {
  it("sitzt am Teamnamen und am Spieler in der Kadertabelle", () => {
    expect(ANSICHT).toContain('data-testid="nl-merk-stern-team"');
    expect(ANSICHT).toContain("onToggleTeamMerken(selectedTeam.teamId)");
    expect(ANSICHT).toContain("onToggleSpielerMerken(player.id)");
  });

  it("verschwindet ganz, wenn kein Rueckruf da ist — statt als toter Knopf dazustehen", () => {
    // Beide Sterne haengen an der Existenz ihres Rueckrufs. Ein Knopf, der nichts tut, waere
    // schlimmer als keiner: er verspricht etwas, das nicht passiert.
    expect(ANSICHT).toContain("{onToggleTeamMerken ? (");
    expect(ANSICHT).toContain("{onToggleSpielerMerken ? (");
  });

  it("sagt dem Vorlese-Programm, ob er gesetzt ist", () => {
    // `aria-pressed` ist der Unterschied zwischen „Knopf" und „Schalter". Ohne ihn ist fuer
    // niemanden hoerbar, ob das Lesezeichen liegt.
    const trefferAriaPressed = ANSICHT.match(/aria-pressed=\{Boolean\(gemerkte(Team|Spieler)Ids\?\.has\(/g) ?? [];
    expect(trefferAriaPressed.length).toBe(2);
  });

  it("hat seine Klasse auch im Stylesheet — sonst ist er unsichtbar", () => {
    expect(ANSICHT).toContain("nl-merk-stern");
    expect(CSS).toContain(".is-new-look .nl-merk-stern {");
    expect(CSS).toContain(".is-new-look .nl-merk-stern.is-gemerkt {");
  });
});

describe("Die Leitung bis zum Besitzer", () => {
  it("der Host bekommt activeOwnerId als eigene Prop, nicht aus dem Rest-Bündel", () => {
    // GEMESSEN: vorher stand das Feld gar nicht in den Host-Props. Ein Zugriff ueber das
    // Rest-Bündel (`panelProps`) haette immer `undefined` geliefert — still und ohne Fehler.
    expect(HOST).toMatch(/activeOwnerId\?: string \| null;/);
    expect(HOST).toContain("const merklisteOwnerId = normalisiereMerklistenBesitzer(activeOwnerId);");
  });

  it("die Schale reicht activeOwnerId an die Teamansicht durch", () => {
    const block = SCHALE.slice(SCHALE.indexOf("const foundationTeamsViewHostProps"));
    expect(block.slice(0, block.indexOf("};"))).toContain("activeOwnerId,");
  });

  it("schreibt ohne eigene Route — der Autosave nimmt es mit", () => {
    // Ein Lesezeichen ist keine Spielaktion. Eine Route je Klick wuerde den gemeinsamen
    // Koop-Spielstand bei jedem Klick fortschreiben und dem Mitspieler eine neue Version
    // unterschieben. Wer hier eine `fetch`-Zeile einbaut, faellt auf.
    const merkBlock = HOST.slice(HOST.indexOf("MERKLISTE"), HOST.indexOf("// \"Neuer Look\" Gate"));
    expect(merkBlock).toContain("schalteMerkliste(");
    expect(merkBlock).not.toContain("fetch(");
  });
});
