/**
 * W1 (Ranks-Umbau) + W4 (Spielplan-Feinschliff) — Struktur- und Klassen-Wächter.
 *
 * STAND 22.11.: Die Ranks-Seite ist neu gebaut (`RanksModern`, Wächter: tests/ranks-modern-nebel.test.ts); die alte
 * Matrix samt Gruppenband, Heat-Stufen, Dein-Team-Chip und PP-Board-Leerzustand ist samt ihren Wächtern entfallen.
 * Hier bleiben: das ECHTE Vorsaison-Podium aus den Season-Snapshots (`buildPreviousSeasonPodium`, von Leaders und
 * Historie genutzt), die GameTerm-Fuzzy-Regel (ganze Wörter) und der Spielplan-Feinschliff der Diszis-Seite.
 *
 * Dazu die beidseitige Absicherung wie in transferhistorie-velo-look.test.ts:
 * CSS-Klassen fallen still durch — jede im Markup benutzte Klasse der neuen
 * Familien muss in globals.css existieren.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getGameTermTooltip } from "@/lib/ui/game-encyclopedia";
import { buildPreviousSeasonPodium } from "@/lib/foundation/ranks-previous-season-podium";
import type { GameState } from "@/lib/data/olyDataTypes";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const DISZIS = quelle("app/foundation/ranks-v2/FoundationDiszisNewLook.tsx");
const CSS = quelle("app/globals.css");

/* ------------------------------------------------------------------ */
/* Beidseitige Klassen-Absicherung                                     */
/* ------------------------------------------------------------------ */

describe("Jede im Markup benutzte Klasse der neuen Familien existiert in globals.css", () => {
  const tokens = new Set<string>();
  for (const match of DISZIS.matchAll(/(?:nl-diszis-details|nl-diszis-mutator-hint)[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  // Template-Fragment `is-${group.category}` → echte Varianten prüfen.
  for (const variant of ["is-power", "is-speed", "is-mental", "is-social", "is-base", "is-team"]) {
    tokens.add(variant);
  }
  // data-testids, keine Klassen:
  tokens.delete("ranks-axis-group-row");
  tokens.delete("nl-ranks-pending-ranking");

  it("die Extraktion findet die Kernklassen (sonst prüft der Test nichts)", () => {
    for (const kern of [
      "nl-diszis-details-toggle",
      "nl-diszis-mutator-hint",
    ]) {
      expect([...tokens]).toContain(kern);
    }
  });

  it.each([...tokens].sort())("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });
});

describe("buildPreviousSeasonPodium: eine Quelle, nichts erfunden", () => {
  const gameStateMit = (snapshots: unknown[], liveSeasonId = "season-2") =>
    ({
      season: { id: liveSeasonId, name: "Season 2" },
      teams: [],
      seasonState: { seasonSnapshots: snapshots },
    }) as unknown as GameState;

  const snapshot = {
    seasonId: "season-1",
    seasonName: "Season 1",
    archivedAt: "",
    finalStandings: [
      { teamId: "t3", teamCode: "L-R", teamName: "Last Ride", rank: 3, points: 100 },
      { teamId: "t1", teamCode: "Z-H", teamName: "Zero Heroes", rank: 1, points: 140 },
      { teamId: "t2", teamCode: "M-M", teamName: "Mayhem Mavericks", rank: 2, points: 120 },
      { teamId: "t4", teamCode: "S-C", teamName: "Stronghold Crusaders", rank: 17, points: 60 },
    ],
    playerPerformances: [],
  };

  it("liefert das Top-3 der letzten abgeschlossenen Saison, nach Rang sortiert", () => {
    const podium = buildPreviousSeasonPodium(gameStateMit([snapshot]));
    expect(podium?.seasonId).toBe("season-1");
    expect(podium?.entries.map((entry) => entry.teamCode)).toEqual(["Z-H", "M-M", "L-R"]);
    expect(podium?.entries[0]?.points).toBe(140);
  });

  it("ohne abgeschlossene Vorsaison: null (keine Erfindung)", () => {
    expect(buildPreviousSeasonPodium(gameStateMit([]))).toBeNull();
  });

  it("die laufende Saison zählt nie als Vorsaison", () => {
    expect(buildPreviousSeasonPodium(gameStateMit([{ ...snapshot, seasonId: "season-2" }]))).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 5 · Kürzel-Tooltips + GameTerm-Substring-Fehler                     */
/* ------------------------------------------------------------------ */

describe("Kürzel werden aufgelöst, der Fuzzy-Match arbeitet auf ganzen Wörtern", () => {
  it("speed-schach (SCH) bekommt NICHT mehr den Achsen-Tooltip", () => {
    expect(getGameTermTooltip("speed-schach")).toBeNull();
  });

  it("Zins-Range trifft NICHT mehr die Rang-Erklärung (derselbe Substring-Fehler)", () => {
    expect(getGameTermTooltip("Zins-Range")).toBeNull();
  });

  it("echte Treffer bleiben erhalten (exakt und wortweise)", () => {
    expect(getGameTermTooltip("POW")).toContain("Hauptachsen");
    expect(getGameTermTooltip("PP POW")).toContain("Hauptachsen");
    expect(getGameTermTooltip("Total PPs")).toContain("Punktebeitrag");
    expect(getGameTermTooltip("Marktwert")).toContain("MW");
  });
});

/* ------------------------------------------------------------------ */
/* 6 · W4 · Spielplan                                                  */
/* ------------------------------------------------------------------ */

describe("W4 · Spielplan-Feinschliff", () => {
  it("Seed-/Quelle-Infos stecken hinter dem Details-Aufklappen", () => {
    expect(DISZIS).toContain('data-testid="nl-diszis-details-toggle"');
    expect(DISZIS).toContain("scheduleDetailsOpen ? (");
    // Der Quelle-Status ist kein StatChip im Kartenkopf mehr …
    expect(DISZIS).not.toContain('<StatChip label="Quelle"');
    // … und keine 10-fache Karten-Fußzeile.
    expect(DISZIS).not.toContain("nl-diszis-md-card-foot");
  });

  it("ohne gewerteten Spieltag: EIN Hinweissatz statt 40× 'ausstehend'", () => {
    expect(DISZIS).toContain("anyMutatorResolved");
    expect(DISZIS).toContain('data-testid="nl-diszis-mutator-hint"');
    expect(DISZIS).toContain("{anyMutatorResolved ? (");
  });

  it("das '· läuft'-Tag: volle Tinte auf dem akzent-getönten Kartenkopf (W4-Befund 3; Akzent-Text maß dort nur 4,24:1)", () => {
    const block = CSS.match(/\.is-new-look \.nl-diszis-md-current-tag \{[^}]+\}/)?.[0] ?? "";
    expect(block).toContain("color: var(--nl-ink)");
    expect(block).not.toContain("color: var(--nl-accent);");
  });

  it("die Nummernspalten erklären Original vs. Reihenfolge", () => {
    expect(DISZIS).toContain("Fester Platz der Disziplin im ursprünglichen Draftboard");
    expect(DISZIS).toContain("wird pro Saison neu ausgelost");
  });
});
