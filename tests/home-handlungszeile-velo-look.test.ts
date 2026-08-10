/**
 * S1 · Home-Umbau (Audit Spieltag, Befunde H2/H3/H6/H7, O1/O3/O4).
 *
 * Chris' bindende Vorgaben schlagen das Mockup: die großen Spielerkarten
 * BLEIBEN, CA/PO bleiben Sterne, PPs/MVS bleiben auch bei 0/„—" sichtbar
 * (und werden erklärt statt versteckt).
 *
 * Der Umbau:
 * - EINE Handlungszeile ganz oben („Nächster Schritt") mit echtem Button —
 *   vorher stand „Lineup fehlt" dreimal auf der Seite und war nirgends klickbar.
 * - Jede Zahl genau einmal: die Karten „Teamzustand" (= Hero-Rang) und
 *   „Aufgaben" (= Entscheidungen-Zähler) sind entfallen.
 * - OVR vollständig statt „77,0 …" — dieselbe Chip-Lösung wie auf den
 *   Teams-Portraits (PR #458), auf die Home-Kartenreihe gescoped.
 * - Office eingedampft: Kapitänwahl als Vergleichstabelle + Board-Kontext +
 *   Notizen; die fünffach parallelen Aufgaben-Spalten sind weg.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const HOME = quelle("app/foundation/home-v2/HomeV2NewLook.tsx");
const OFFICE = quelle("app/foundation/home-v2/ManagerOfficeClient.tsx");
const TYPES = quelle("app/foundation/home-v2/home-v2-types.ts");
const SHELL = quelle("app/foundation/FoundationShellRouterBody.tsx");
const SCOPE = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const PRESETS = quelle("lib/foundation/player-portrait-stat-presets.ts");
const CSS = quelle("app/globals.css");

describe("Beidseitige Klassen-Absicherung (Markup ↔ globals.css)", () => {
  const tokens = new Set<string>();
  for (const match of HOME.matchAll(/nl-home-(?:next-band|captain)[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  for (const match of OFFICE.matchAll(/foundation-hq-(?:captain-table|captain-row|captain-name|captain-lead|captain-style|captain-active-pill|notes)[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }

  it("es gibt überhaupt Tokens (der Extraktor läuft nicht ins Leere)", () => {
    expect(tokens.size).toBeGreaterThan(8);
  });

  it.each([...tokens].sort())("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });

  const definierte = new Set<string>();
  for (const match of CSS.matchAll(/\.((?:nl-home-next-band|nl-home-captain|foundation-hq-captain-table|foundation-hq-captain-row|foundation-hq-captain-name|foundation-hq-captain-lead|foundation-hq-captain-style|foundation-hq-captain-active-pill|foundation-hq-notes)[a-z0-9-]*(?<!-))/g)) {
    definierte.add(match[1]);
  }
  it.each([...definierte].sort())("%s (globals.css) wird im Markup benutzt", (klasse) => {
    expect(HOME.includes(klasse) || OFFICE.includes(klasse)).toBe(true);
  });
});

describe("Genau EIN Lineup-Hinweis — und der ist klickbar", () => {
  it("die Handlungszeile rendert die dringendste Karte mit echtem CTA-Button", () => {
    expect(HOME).toContain("const primaryTodayCard = todayCards[0] ?? null;");
    expect(HOME).toContain('data-testid="nl-home-next-band-cta"');
    expect(HOME).toContain("nextBandCtaLabel(primaryTodayCard)");
  });

  it("die alte Drei-Karten-Reihe ist weg (Teamzustand = Hero-Rang, Aufgaben = Entscheidungen-Zähler)", () => {
    expect(HOME).not.toContain("nl-home-today-card");
    expect(HOME).not.toContain("visibleTodayCards");
  });

  it("Warnungs-Chips doppeln die Handlungszeile nicht und sind klickbar", () => {
    expect(HOME).toContain('const bandCoversLineup = primaryTodayCard?.key === "lineup";');
    expect(HOME).toContain('const LINEUP_WARNING_KEYS = ["missing_lineups", "lineup_not_submitted"];');
    expect(HOME).toContain("const warningTargets: Record<string, (() => void) | undefined>");
    // Chips tragen jetzt Schlüssel + Label (Typ), die Shell liefert beides.
    expect(TYPES).toContain("export type HomeV2WarningChip");
    expect(SHELL).toContain("({ key: warning, label: formatHomeWarningLabel(warning) })");
  });

  it("steht die Einsatzliste, führt der nächste Schritt in die Arena statt zurück in den Editor", () => {
    expect(HOME).toContain('if (card.tone === "ready" && onOpenArena)');
    expect(SHELL).toContain('onOpenArena: () => setFoundationView("matchdayArena", setActiveView, { push: true })');
  });

  it("die Karte spricht Handlung statt Kryptik — der Text ‚erst Team setzen' ist weg", () => {
    expect(SCOPE).not.toContain("erst Team setzen");
    expect(SCOPE).toContain("ohne Einsatzliste startet der Spieltag nicht");
  });
});

describe("Chris-Overrides: Karten bleiben, Sterne bleiben, 0 wird erklärt", () => {
  it("die großen Spielerkarten samt CA/PO-Sternen bleiben", () => {
    expect(HOME).toContain("FoundationPlayerPortraitCard");
    expect(HOME).toContain("caStars={player.caStars}");
    expect(HOME).toContain("poStars={player.poStars}");
  });

  it("PPs/MVS werden bei 0/— erklärt statt versteckt", () => {
    expect(PRESETS).toContain("füllen sich ab Spieltag 1");
    expect(PRESETS).toContain("noch keine Wertung, füllt sich ab Spieltag 1");
  });

  it("leere Hero-KPIs (GuV, Saisonpunkte) sagen dazu, wann sie sich füllen", () => {
    // Die GuV-Kachel unterscheidet seit #472 ZWEI leere Zustände, statt beide „ab Spieltag 1"
    // zu nennen: Vor dem ersten Spieltag füllt sie sich noch, danach ist schlicht nichts
    // gebucht. Der Test hing an der alten, undifferenzierten Zeichenkette — geprüft wird
    // jetzt die Unterscheidung selbst, denn genau sie ist die Zusage.
    expect(HOME).toContain('playedMatchdayCount > 0 ? "noch keine Buchung" : "ab Spieltag 1"');
    expect(HOME).toContain('sub={points == null ? "ab Spieltag 1" : undefined}');
  });

  it("OVR wird nicht mehr abgeschnitten — dieselbe Lösung wie auf den Teams-Portraits (#458)", () => {
    expect(CSS).toContain(".nl-home-portrait-grid .home-v2-player-stat strong");
    const fix = CSS.slice(CSS.indexOf(".nl-home-portrait-grid .home-v2-player-stat strong"));
    expect(fix).toContain("overflow: visible;");
    expect(fix).toContain("text-overflow: clip;");
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

  it("der Kapitän-Hinweis der Übersicht nutzt dieselbe Kandidaten-Quelle wie das Office", () => {
    expect(HOME).toContain("nl-home-captain-row");
    expect(SHELL).toContain("const candidates = selectedTeamCaptainCandidates ?? [];");
    expect(TYPES).toContain("export type HomeV2CaptainSummary");
  });
});
