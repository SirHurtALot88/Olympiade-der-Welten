/**
 * Office (Home-Reiter „Office"): zwei Blöcke statt fünf paralleler Antworten (O1/O3/O4).
 *
 * Bis 18.11. prüfte diese Datei auch die alte Home-Übersicht (`HomeV2NewLook`: Handlungszeile, Spielerkarten,
 * Hero-KPIs). Die Übersicht ist seit 18.11. die neue Startseite (`HomeModern`, Mockup
 * oly-start-modern-18-11.html); ihre Verträge stehen in `tests/startseite-modern-vertraege.test.ts`.
 * Hier bleibt, was das Office betrifft.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const OFFICE = quelle("app/foundation/home-v2/ManagerOfficeClient.tsx");
const TYPES = quelle("app/foundation/home-v2/home-v2-types.ts");
const SHELL = quelle("app/foundation/FoundationShellRouterBody.tsx");
const SCOPE = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const PRESETS = quelle("lib/foundation/player-portrait-stat-presets.ts");
const CSS = quelle("app/globals.css");

describe("Beidseitige Klassen-Absicherung Office (Markup ↔ globals.css)", () => {
  const tokens = new Set<string>();
  for (const match of OFFICE.matchAll(/foundation-hq-(?:captain-table|captain-row|captain-name|captain-lead|captain-style|captain-active-pill|notes)[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }

  it("es gibt überhaupt Tokens (der Extraktor läuft nicht ins Leere)", () => {
    expect(tokens.size).toBeGreaterThan(5);
  });

  it.each([...tokens].sort())("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });
});

describe("Handlungstext der Flow-Karte", () => {
  it("die Karte spricht Handlung statt Kryptik — der Text ‚erst Team setzen' ist weg", () => {
    expect(SCOPE).not.toContain("erst Team setzen");
    expect(SCOPE).toContain("ohne Taktik startet der Spieltag nicht");
  });

  it("Warnungs-Chips tragen Schlüssel + Label, die Shell liefert beides", () => {
    expect(TYPES).toContain("export type HomeV2WarningChip");
    expect(SHELL).toContain("({ key: warning, label: formatHomeWarningLabel(warning) })");
  });

  it("PPs/MVS werden bei 0/— erklärt statt versteckt", () => {
    expect(PRESETS).toContain("füllen sich ab Spieltag 1");
    expect(PRESETS).toContain("noch keine Wertung, füllt sich ab Spieltag 1");
  });
});

describe("Office: zwei Blöcke statt fünf paralleler Antworten (O1/O3/O4)", () => {
  it("die Kapitänwahl ist eine Vergleichstabelle, nach Leadership sortiert", () => {
    expect(OFFICE).toContain('data-testid="foundation-hq-captain-table"');
    expect(OFFICE).toContain(".sort((left, right) => right.leadershipScore - left.leadershipScore)");
    expect(OFFICE).toContain("buildCaptainEffectExplanations(candidate)");
    expect(OFFICE).toContain("foundation-hq-captain-lead-bar");
  });

  it("die Duplikat-Flächen sind weg (Manager-Fokus-Rail, KPI-Strip, Sofort/Season/Preseason-Spalten)", () => {
    expect(OFFICE).not.toContain("foundation-hq-priority-grid");
    expect(OFFICE).not.toContain("foundation-hq-state-strip");
    expect(OFFICE).not.toContain("foundation-hq-zones");
    expect(OFFICE).not.toContain("Was du jetzt tun solltest");
  });

  it("Leerzustände sind eine dezente Zeile, keine gleichrangigen Karten", () => {
    expect(OFFICE).toContain("foundation-hq-notes-empty");
    expect(OFFICE).toContain("Gerade nichts vorzubereiten");
  });
});
