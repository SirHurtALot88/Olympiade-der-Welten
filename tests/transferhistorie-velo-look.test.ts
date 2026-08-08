/**
 * GEMELDET: „kannst du bitte … ein rework der Historie machen? also die transferhistorie /
 * die ist nicht wirklich übersichtlich und gut zu bediene und zeigt auch nicht direkt top
 * verkäufe käufe etc und hebt evtl teams hervor usw, das passt noch nicht zu unserem coolen
 * neuen velo style"
 *
 * Der Umbau: echte Top-5-Listen (Käufe/Verkäufe/beste GuV) statt einzelner biggest-Kacheln,
 * ein Team-Board mit Ausgaben-vs-Einnahmen-Balken auf gemeinsamer Skala (`VeloDivergingBar`),
 * das eigene Team hervorgehoben, Filter als kompakter Streifen statt großer Karte.
 *
 * Der Test hält vor allem das fest, was beim Umbau still verlorengeht: dass JEDE Klasse, auf
 * die das Markup zielt, auch wirklich in globals.css existiert. CSS-Klassen fallen still
 * durch — ein grüner Build sagt nichts, wenn `nl-thist-toplist-row` nirgends definiert ist.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const MARKUP = quelle("app/foundation/transfer-history-v2/TransferHistoryV2NewLook.tsx");
const CLIENT = quelle("app/foundation/transfer-history-v2/TransferHistoryV2Client.tsx");
const CSS = quelle("app/globals.css");
const BAR = quelle("components/foundation/velo-ui/VeloDivergingBar.tsx");
const KATALOG = quelle("components/foundation/velo-ui/index.ts");

describe("Jede im Markup benutzte Klasse existiert in globals.css", () => {
  // Alle statischen Klassen-Tokens der Historie-Familie aus dem Markup ziehen.
  // Template-Fragmente wie `is-medal-${…}` werden über ihre echten Varianten
  // (is-medal-1/2/3) geprüft, nicht über den abgeschnittenen Präfix.
  const tokens = new Set<string>();
  for (const match of MARKUP.matchAll(/(?:nl-thist|velo-diverging-bar)[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  for (const match of BAR.matchAll(/velo-diverging-bar[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  tokens.delete("nl-thist-stream"); // Element-ID (Scroll-Anker), keine Klasse.
  tokens.add("nl-thist-toplist-rank");
  for (const medal of ["is-medal-1", "is-medal-2", "is-medal-3"]) {
    tokens.add(medal);
  }

  it.each([...tokens].sort())("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });
});

describe("Top-Listen statt einzelner biggest-Kacheln", () => {
  it("der Client liefert Top-5-Listen für Käufe, Verkäufe und GuV", () => {
    expect(CLIENT).toContain("TOP_LIST_SIZE = 5");
    expect(CLIENT).toContain(".slice(0, TOP_LIST_SIZE)");
    expect(CLIENT).toContain("topBuys={topBuys}");
    expect(CLIENT).toContain("topSales={topSales}");
    expect(CLIENT).toContain("topProfits={topProfits}");
  });

  it("die Einzelwerte sind nur noch der erste Listeneintrag — eine Quelle pro Größe", () => {
    expect(CLIENT).toContain("const biggestBuy = topBuys[0] ?? null;");
    expect(CLIENT).toContain("const biggestSale = topSales[0] ?? null;");
    expect(CLIENT).toContain("const bestProfit = topProfits[0] ?? null;");
  });

  it("das Markup rendert die drei Listen als klickbare Ranglisten", () => {
    expect(MARKUP).toContain('title="Top-Käufe"');
    expect(MARKUP).toContain('title="Top-Verkäufe"');
    expect(MARKUP).toContain('title="Beste Gewinne"');
    expect(MARKUP).toContain("rows.map((row, index)");
    expect(MARKUP).toContain("onPick(row.transferId)");
  });

  it("ein Klick wählt den Deal im Strom aus (Portal, kein toter Klick)", () => {
    expect(MARKUP).toContain("function handlePickHighlight(transferId: string)");
    expect(MARKUP).toContain("onSelectTransfer(transferId)");
    expect(MARKUP).toContain('document.getElementById("nl-thist-stream")');
  });
});

describe("Teams werden hervorgehoben", () => {
  it("das eigene Team trägt Badge und is-own-Hervorhebung", () => {
    expect(MARKUP).toContain("Dein Team");
    expect(MARKUP).toContain('isOwn ? " is-own" : ""');
  });

  it("alle Team-Balken teilen sich eine Skala (teamBoardMax)", () => {
    expect(MARKUP).toContain("Math.max(max, team.spend, team.income)");
    expect(MARKUP).toMatch(/max=\{teamBoardMax\}/);
  });

  it("die eigenen Kennzahlen kommen aus derselben activityCards-Ableitung wie alle Teams", () => {
    expect(MARKUP).toContain("activityCards.find((team) => team.teamId === ownTeamId)");
    expect(MARKUP).not.toContain("ownNetSpendFinal");
  });
});

describe("Bedienbarkeit: Filter als kompakter Streifen, kein Fokus-Tab-Umschalter mehr", () => {
  it("der Filterstreifen ist keine eigene NlCard mehr", () => {
    expect(MARKUP).toContain('className="nl-thist-toolbar"');
    expect(MARKUP).not.toContain("nl-thist-filter-card");
  });

  it("Abgänge sind als Typ-Filter wählbar", () => {
    expect(MARKUP).toContain('<option value="contract_exit">Abgänge</option>');
  });

  it("die Spieler/Teams-Fokus-Tabs sind weg — alles ist direkt sichtbar", () => {
    expect(MARKUP).not.toContain("nl-thist-focus-tabs");
    expect(MARKUP).not.toContain('"players" | "teams"');
  });
});

describe("VeloDivergingBar ist eine Katalog-Komponente, kein Einzelfall", () => {
  it("steht im Velo-Katalog mit einer Wann-benutzen-Zeile", () => {
    expect(KATALOG).toContain("VeloDivergingBar");
    expect(KATALOG).toContain("gegenlaeufige Groessen");
  });

  it("rundet die Balkenanteile, statt Fließkomma-Reste ins Markup zu schreiben", () => {
    expect(BAR).toContain("Math.round(Math.min(1, value / scale) * 10000) / 100");
  });

  it("behandelt kaputte Eingaben defensiv (negative/nicht-endliche Werte zählen als 0)", () => {
    expect(BAR).toContain("Number.isFinite(left) ? Math.max(0, left) : 0");
    expect(BAR).toContain("Number.isFinite(right) ? Math.max(0, right) : 0");
  });
});
