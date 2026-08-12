/**
 * T7 · Wünsche von Chris zur Trainingsansicht (SPIELER / INTENSITÄT / NETTO-SAISON /
 * BELASTUNG / KLASSEN-VORSCHLAG):
 *
 *   „die infos sollten hier auch als sterne stehen oder nimm einfach unser standard
 *    portrait! in den spalten würde ich CA und PO noch hinzufügen! und Gehalt +
 *    Vertragslaufzeit FL/BL wäre sehr hilfreich in der ansicht damit man weiß welche
 *    spieler mit langem vertrag man entwickeln sollte"
 *
 * Anlass für Punkt 1 war ein Screenshot der Hover-Portraitkarte dieser Ansicht: CA
 * stand dort als rohe Zahl ("CA 45"), PO direkt daneben schon als Sterne ("PO 4,5
 * Sterne") — zwei Sprachen für dieselbe Skala. Der Fix nutzt den vorhandenen
 * `NlAbilityStars`-Sterne-Slot der Standard-Portraitkarte (`newLook`/`caScore`/
 * `poScore`, denselben, den Kaderliste und die aufgeklappte Trainings-Detailzeile
 * schon benutzen) statt eine zweite CA/PO-Darstellung zu bauen.
 *
 * Diese Suite hält die drei Punkte an der Tabelle fest, die Chris' Screenshot zeigt
 * (SPIELER/INTENSITÄT/NETTO-SAISON/BELASTUNG/KLASSEN-VORSCHLAG) — also
 * `TrainingCompactNewLook.tsx`, nicht die tote `TrainingPlayerLane` in
 * `training-view-shared.tsx` (siehe deren Kommentar in
 * foundation-training-facilities-ui-contract.test.ts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildContextOverlayStats,
  buildTrainingOverlayStats,
} from "@/lib/foundation/player-portrait-stat-presets";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";

const root = process.cwd();
const quelle = (pfad: string) => readFileSync(join(root, pfad), "utf8");

const MARKUP = quelle("app/foundation/training-compact/TrainingCompactNewLook.tsx");
const DERIVATIONS = quelle("lib/foundation/tabs/use-training-panel-derivations.ts");
const ROW_VIEW = quelle("lib/foundation/training-player-row-view.ts");
const ROW_VIEW_TYPES = quelle("app/foundation/training-facilities-v2/training-view-types.ts");

describe("Punkt 1 — CA als Sterne statt Zahl, konsistent zu PO", () => {
  it("die Hover-Portraitkarte zeigt CA/PO über den geteilten Sterne-Slot der Standardkarte (newLook + caScore/poScore)", () => {
    // Die Standardkarte (`FoundationPlayerPortraitCard`) hat bereits einen CA/PO-
    // Sterne-Slot (`NlAbilityStars` hinter `newLook`) — dieselbe Karte, die auch die
    // Kaderliste benutzt. Der Trainings-Preview aktiviert ihn jetzt, statt eine
    // eigene, zweite CA/PO-Darstellung zu bauen ("eine Komponente weniger ist
    // besser als zwei, die auseinanderlaufen").
    const previewPropsBlock = MARKUP.slice(
      MARKUP.indexOf("const portraitPreviewProps"),
      MARKUP.indexOf("return (\n    <>"),
    );
    expect(previewPropsBlock).toContain("newLook: true");
    expect(previewPropsBlock).toContain("known: true");
    expect(previewPropsBlock).toContain("caScore: row.developmentStars.currentAbilityRating");
    expect(previewPropsBlock).toContain("poScore: row.developmentStars.potentialRating");
    // Keine zweite, text-basierte CA/PO-Zahl mehr im `training`-ContextData-Preset.
    expect(previewPropsBlock).not.toContain("caRating:");
    expect(previewPropsBlock).not.toContain("poDisplay:");
  });

  it("der 'training'-Overlay-Stat-Preset baut nur noch den Forecast-Chip — CA/PO kommen aus dem Sterne-Slot, nicht mehr als Text", () => {
    // Vorher: stat("CA", formatNumber(data.caRating, 0)) — die rohe Zahl aus Chris'
    // Screenshot. Direkter Funktionstest statt nur Quelltext, damit ein Rückfall in
    // die alte Text-Darstellung wirklich rot wird.
    const stats = buildTrainingOverlayStats({ netSetpoints: 1.2 });
    expect(stats.map((entry) => entry.label)).toEqual(["Forecast"]);
    expect(stats.some((entry) => entry.label === "CA")).toBe(false);
    expect(stats.some((entry) => entry.label === "PO")).toBe(false);

    const heatPools = createEmptyLeaguePlayerHeatPools();
    const contextStats = buildContextOverlayStats({
      context: "training",
      density: "full",
      contextData: { training: { netSetpoints: 0.4 } },
      playerOvr: null,
      playerMvs: null,
      leagueHeatPools: heatPools,
    });
    expect(contextStats.some((entry) => entry.label === "CA")).toBe(false);
    expect(contextStats.some((entry) => entry.label === "PO")).toBe(false);
  });
});

describe("Punkt 2 — CA/PO als eigene Spalte, als Sterne", () => {
  it("die Kopfzeile trägt eine 'CA/PO'-Spalte", () => {
    expect(MARKUP).toContain("CA/PO");
  });

  it("die Spalte rendert denselben NlAbilityStars-Sterne-Baustein wie die Kaderliste, gespeist aus row.developmentStars", () => {
    expect(MARKUP).toContain('<td className="nl-training-row-ability">');
    const abilityCellBlock = MARKUP.slice(
      MARKUP.indexOf('<td className="nl-training-row-ability">'),
      MARKUP.indexOf('<td className="nl-training-row-modes">'),
    );
    expect(abilityCellBlock).toContain("<NlAbilityStars");
    expect(abilityCellBlock).toContain("caScore={row.developmentStars.currentAbilityRating}");
    expect(abilityCellBlock).toContain("poScore={row.developmentStars.potentialRating}");
    // Eigener Kader (kein Fog-of-War) — dieselbe Begründung wie beim Hover-Steckbrief.
    expect(abilityCellBlock).toMatch(/\bknown\b/);
  });
});

describe("Punkt 3 — Gehalt + Vertragslaufzeit (FL/BL)", () => {
  it("die Kopfzeile trägt 'Gehalt'- und 'Vertrag'-Spalten", () => {
    const theadBlock = MARKUP.slice(MARKUP.indexOf("<thead>"), MARKUP.indexOf("</thead>"));
    expect(theadBlock).toMatch(/>\s*Gehalt\s*</);
    expect(theadBlock).toMatch(/>\s*Vertrag\s*</);
  });

  it("Gehalt/Vertrag kommen aus row.economy, NICHT aus einer neuen Rechnung im Markup", () => {
    expect(MARKUP).toContain('<td className="nl-training-row-salary">');
    expect(MARKUP).toContain("formatNlMoney(row.economy.salary)");
    expect(MARKUP).toContain('<td className="nl-training-row-contract">');
    expect(MARKUP).toContain("row.economy.contractLength");
    expect(MARKUP).toContain("formatContractShapeShortLabel");
    expect(MARKUP).toContain("formatContractShapeLabel");
  });

  it("row.economy wird aus derselben Quelle abgeleitet wie das Gehalt in der Kaderliste (getRosterEntryDisplaySalary → resolvePlayerEconomyContract), kein zweiter Rechenweg", () => {
    expect(DERIVATIONS).toContain("getRosterEntryDisplaySalary");
    expect(DERIVATIONS).toContain("economy: {");
    expect(DERIVATIONS).toContain("salary: getRosterEntryDisplaySalary(entry, trainingPlayer)");
    expect(DERIVATIONS).toContain("contractLength: entry.contractLength ?? null");
    expect(DERIVATIONS).toContain("contractShape: entry.contractShape ?? null");
  });

  it("der Row-View-Typ und -Builder tragen das economy-Feld durch (Gehalt/Vertrag reisen mit der Zeile, nicht separat nachgeschlagen)", () => {
    expect(ROW_VIEW_TYPES).toContain("economy: {");
    expect(ROW_VIEW).toContain("economy: row.economy");
  });

  it("die Restlaufzeit ist auf einen Blick lesbar (Zahl in Saisons, nicht nur das Gehalt) — Chris' Begründung: 'damit man weiß welche Spieler mit langem Vertrag man entwickeln sollte'", () => {
    const contractCellBlock = MARKUP.slice(
      MARKUP.indexOf('<td className="nl-training-row-contract">'),
      MARKUP.indexOf('<td className="nl-training-row-suggest">'),
    );
    expect(contractCellBlock).toContain("{row.economy.contractLength}J");
  });
});

describe("Breite Tabelle — bestehendes Scroll-Muster bleibt, neue Klassen sind gestylt", () => {
  it("bleibt im horizontal scrollenden Container der Datei (kein neues Layout-Muster)", () => {
    expect(MARKUP).toContain('className="nl-training-table-scroll"');
  });

  it("die aufgeklappte Detailzeile überspannt alle 9 Kopfzellen (6 vorher + CA/PO, Gehalt, Vertrag)", () => {
    expect(MARKUP).toContain("<td colSpan={9}>");
  });

  it("jede neue nl-training-row-*-Klasse aus dieser Spalten-Erweiterung ist in globals.css definiert", () => {
    const CSS = quelle("app/globals.css");
    for (const klasse of [
      "nl-training-row-ability",
      "nl-training-row-salary",
      "nl-training-row-contract",
      "nl-training-row-contract-value",
      "nl-training-row-contract-shape",
    ]) {
      expect(CSS, klasse).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
    }
    expect(CSS).toContain(".nl-training-row-contract-value.is-expiring");
  });
});
