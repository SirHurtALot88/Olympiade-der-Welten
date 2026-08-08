/**
 * T1/T2 · Teams: „Liste & Verträge" als zweite Ansicht, Portraits entrümpelt.
 *
 * Chris' Vorgaben (wörtlich): „Team -> kader als tabelle ist für mich 2. ansicht kann mit
 * verträgen quasi kombiniert werden oder? Ich will die portrait ansicht wieterhin haben!
 * denk dran es ist ein game und kein excel."
 *
 * Dazu seine Screenshot-Befunde von der Team-Seite:
 *  - Die Cash-Sparkline war fest auf `good` verdrahtet (grüne Linie für einen Absturz von
 *    91,3 auf 7,1 Mio), während der Delta-Chip daneben korrekt rot war.
 *  - Die Punkte-Kachel renderte bei EINER Saison einen einzelnen Riesenbalken — der
 *    96px-Deckel existierte nur auf dem Team-Profil, nicht auf der Teams-Seite.
 *
 * Der Test hält die Regeln fest und prüft beidseitig, dass jede benutzte Klasse in
 * globals.css existiert (CSS-Klassen fallen still durch).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const TEAMS = quelle("app/foundation/teams-v2/FoundationTeamsNewLook.tsx");
const PROFIL = quelle("app/foundation/team-profile/TeamProfileNewLook.tsx");
const CSS = quelle("app/globals.css");

describe("Portraits bleiben Standard, die Tabelle wird Liste-und-Verträge", () => {
  it("die Startansicht ist immer das Portrait-Grid", () => {
    expect(TEAMS).toContain('return "portraits";');
  });

  it("die zweite Ansicht heißt Liste & Verträge", () => {
    expect(TEAMS).toContain('{ id: "tabelle", label: "Liste & Verträge" }');
  });

  it("die Auslauf-Zusammenfassung hat EINE Quelle und zwei Darstellungen", () => {
    expect(TEAMS).toContain('function renderContractPlanningSummary(variant: "list" | "compact")');
    // Über der Tabelle die volle Fassung …
    expect(TEAMS).toContain('renderContractPlanningSummary("list")');
    // … unter den Portraits die kompakte mit Absprung in die Listenansicht.
    expect(TEAMS).toContain('renderContractPlanningSummary("compact")');
    expect(TEAMS).toContain('setRosterMode("tabelle");');
  });

  it("die dritte Kopie der per-Spieler-Vertragsdaten (Extra-Liste) ist weg", () => {
    expect(TEAMS).not.toContain("nl-teams-contracts-list");
    expect(TEAMS).not.toContain("nl-teams-contracts-row");
  });

  it("Läuft-aus ist ein beschrifteter Chip statt unerklärter Goldfärbung (Audit T7)", () => {
    expect(TEAMS).toContain("nl-teams-expiring-chip");
    expect(CSS).not.toContain(".nl-teams-table-row.is-contract-expiring .nl-teams-playername");
  });

  it("der alte Verträge-Reiter bleibt bestehen (fällt erst, wenn die neue Ansicht alles trägt)", () => {
    const body = quelle("app/foundation/FoundationShellRouterBody.tsx");
    expect(body).toContain('{ id: "contracts", label: "Verträge" }');
    // Das Verlängern-Modal bleibt auf Body-Ebene gemountet und aus beiden Wegen erreichbar.
    expect(body).toContain("<ContractRenewalNegotiationModal");
  });
});

describe("Portrait-Karten ohne Vertragskram (T2, game statt excel)", () => {
  it("die Kader-Portraits tragen nur noch MW als Economy-Kennzahl", () => {
    const grid = TEAMS.slice(TEAMS.indexOf("function renderRosterGrid"), TEAMS.indexOf("function renderContractPlanningSummary"));
    expect(grid).toContain('label: "MW"');
    expect(grid).not.toContain('label: "Gehalt"');
    expect(grid).not.toContain('label: "LZ"');
  });

  it("die Kennzahl-Kürzel erklären sich per Tooltip", () => {
    const presets = quelle("lib/foundation/player-portrait-stat-presets.ts");
    expect(presets).toContain("OVR — Gesamtstärke (Overall)");
    expect(presets).toContain("PPs — Performance-Punkte dieser Saison, füllen sich ab Spieltag 1");
    expect(presets).toContain("MVS — Marktwert-Score");
  });
});

describe("Saison-Verlauf: Ton aus der Richtung, ein Datenpunkt ist kein Verlauf", () => {
  it("MW-/Cash-Sparkline-Ton kommt aus dem Saison-Delta — derselben Quelle wie der Delta-Chip", () => {
    for (const src of [TEAMS, PROFIL]) {
      expect(src).toContain("nlTrendToneFromDelta(seasonDeltas?.marketValueDelta)");
      expect(src).toContain("nlTrendToneFromDelta(seasonDeltas?.cashDelta)");
      expect(src).not.toMatch(/points=\{developmentSeries\.(marketValueSpark|cashSpark)\}\s*\n\s*tone="good"/);
    }
  });

  it("die Punkte-Kachel rendert erst ab zwei Datenpunkten ein Diagramm", () => {
    for (const src of [TEAMS, PROFIL]) {
      expect(src).toContain("developmentSeries.pointBars.length >= 2 ? (");
      expect(src).toContain("Erst eine Saison mit Punkten");
    }
  });

  it("der 96px-Deckel gilt jetzt auch auf der Teams-Seite", () => {
    const block = CSS.slice(CSS.indexOf(".is-new-look .nl-teams-development-bars {"));
    expect(block.slice(0, 500)).toContain("max-height: 96px");
  });
});

describe("Jede im Teams-Markup benutzte neue Klasse existiert in globals.css", () => {
  const tokens = new Set<string>();
  for (const match of TEAMS.matchAll(/(?:nl-teams-contractplan|nl-teams-expiring-chip|nl-teams-table-legend|nl-teamdisc-row-medal)[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  it("es gibt überhaupt neue Klassen zu prüfen", () => {
    expect(tokens.size).toBeGreaterThanOrEqual(4);
  });
  it.each([...tokens].sort())("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });
});
