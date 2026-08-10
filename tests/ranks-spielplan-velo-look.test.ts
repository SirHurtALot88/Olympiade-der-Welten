/**
 * W1 (Ranks-Umbau) + W4 (Spielplan-Feinschliff) — Struktur- und Klassen-Wächter.
 *
 * Die tragenden Aussagen des Umbaus:
 * 1. Achsen-Gruppen statt px-Spalten-Manager (Chris' Entscheidung): die Matrix
 *    hat ein Gruppenband + Gruppen-Schalter, der ColumnVisibilityManager ist raus.
 * 2. Zwei Farbsysteme getrennt: Achsenfarbe NUR im Gruppenband, Zellenfarbe =
 *    Rang (mit Legende); die Heat-Stufen der Matrix sind voll deckend >= 4,5:1.
 * 3. PP-Board am Saisonstart (Muster 3): keine Alphabet-Medaillen — der
 *    Leerzustand läuft über das Katalog-Primitive VeloPendingRanking plus das
 *    ECHTE Vorsaison-Podium aus den Season-Snapshots.
 * 4. Kürzel-Tooltips: volle Disziplinnamen; der GameTerm-Fuzzy-Match arbeitet
 *    auf ganzen Wörtern (kein "speed-schach" → Achsen-Tooltip, kein
 *    "Zins-Range" → "Rang" mehr).
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

const ROUTER = quelle("app/foundation/FoundationShellRouterBody.tsx");
const RANKS_BOARD = quelle("app/foundation/ranks-v2/FoundationRanksNewLook.tsx");
const DISZIS = quelle("app/foundation/ranks-v2/FoundationDiszisNewLook.tsx");
const CSS = quelle("app/globals.css");

/* ------------------------------------------------------------------ */
/* Beidseitige Klassen-Absicherung                                     */
/* ------------------------------------------------------------------ */

describe("Jede im Markup benutzte Klasse der neuen Familien existiert in globals.css", () => {
  const tokens = new Set<string>();
  for (const match of ROUTER.matchAll(
    /(?:ranks-color-legend|ranks-heatstrip|ranks-axis-group|ranks-group-row|ranks-group-cell|ranks-table-scrollwrap|ranks-own-tag)[a-z0-9-]*(?<!-)/g,
  )) {
    tokens.add(match[0]);
  }
  for (const match of RANKS_BOARD.matchAll(/(?:nl-ranks-pending|nl-ranks-prev-podium)[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
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
      "ranks-color-legend",
      "ranks-axis-group-toggle",
      "ranks-group-cell",
      "ranks-own-tag",
      "nl-ranks-pending",
      "nl-ranks-prev-podium-row",
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

/* ------------------------------------------------------------------ */
/* 1 · Achsen-Gruppen statt Spalten-Manager                            */
/* ------------------------------------------------------------------ */

describe("Achsen-Gruppen ersetzen den px-Spalten-Manager (Chris' Entscheidung)", () => {
  it("die Ranks-Matrix hat keinen ColumnVisibilityManager mehr", () => {
    expect(ROUTER).not.toContain("<ColumnVisibilityManager");
  });

  it("die Gruppen-Schalter schalten über den bestehenden Spalten-Store", () => {
    expect(ROUTER).toContain('data-testid="ranks-axis-groups"');
    expect(ROUTER).toContain('setTableColumnVisible("disciplineRanksTable", column.id, !group.anyVisible)');
    expect(ROUTER).toContain('resetTableLayout("disciplineRanksTable", disciplineRanksColumns)');
  });

  it("das Gruppenband steht im Tabellenkopf (colSpan je Achsen-Block)", () => {
    expect(ROUTER).toContain('data-testid="ranks-axis-group-row"');
    expect(ROUTER).toContain("colSpan={group.span}");
    expect(ROUTER).toContain('scope="colgroup"');
  });
});

/* ------------------------------------------------------------------ */
/* 2 · Farbgrammatik: Achse nur im Band, Zellenfarbe = Rang            */
/* ------------------------------------------------------------------ */

describe("Farbsysteme getrennt und erklärt", () => {
  it("die Legende benennt beide Systeme", () => {
    expect(ROUTER).toContain("Zellenfarbe = Rang:");
    expect(ROUTER).toContain("Farbband oben = Achse");
  });

  it("Disziplin- und Aggregat-Köpfe sind neutral (Achsenfarbe raus)", () => {
    // Die alten Achsen-Hintergründe der Kopfzellen sind entfernt.
    expect(CSS).not.toContain("background: rgba(181, 53, 48, 0.92)");
    expect(CSS).not.toContain("background: linear-gradient(180deg, rgba(132, 61, 58, 0.98)");
    // Die rank-muted-Zellen tragen keine Achsen-Tönung mehr.
    expect(CSS).not.toContain("td.ranks-discipline-cell-power.rank-muted");
    expect(CSS).not.toContain("td.ranks-metric-cell-soc.rank-muted");
  });

  it("die Achsenfarbe lebt im Gruppenband (border-top je Achse)", () => {
    expect(CSS).toContain(".ranks-table thead .ranks-group-row .ranks-group-cell.is-power");
    expect(CSS).toContain(".ranks-table thead .ranks-group-row .ranks-group-cell.is-social");
  });

  it("rank-muted ist nicht mehr die 0.62-Alpha-Tinte", () => {
    expect(CSS).not.toContain("color: rgba(242, 237, 226, 0.62);\n  font-weight: 500;");
  });
});

describe("Heat-Stufen der Matrix: voll deckend und rechnerisch >= 4,5:1", () => {
  // WCAG-Kontrast der in #discipline-ranks gesetzten Stufen — nachgerechnet,
  // nicht geglaubt (Luminanz-Rechnung wie in nl-accent-text-regel.test.ts).
  const hexLuminanz = (hex: string): number => {
    const h = hex.replace("#", "");
    const kanal = (i: number) => {
      const v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * kanal(0) + 0.7152 * kanal(2) + 0.0722 * kanal(4);
  };
  const kontrast = (a: number, b: number) => {
    const [hell, dunkel] = a > b ? [a, b] : [b, a];
    return (hell + 0.05) / (dunkel + 0.05);
  };
  const cssWert = (name: string): string => {
    const match = CSS.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`));
    if (!match) throw new Error(`${name} nicht in globals.css gefunden`);
    return match[1];
  };

  const ink = hexLuminanz(cssWert("--ranks-heat-ink"));

  it.each([["--ranks-heat-strong-bg"], ["--ranks-heat-mid-bg"], ["--ranks-heat-weak-bg"]])(
    "Zellwert-Tinte auf %s >= 4,5:1",
    (token) => {
      expect(kontrast(ink, hexLuminanz(cssWert(token)))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("Delta-Chips erben auf Heat-Flächen die Zell-Tinte", () => {
    expect(CSS).toContain("#discipline-ranks td.rank-strong .ranks-rank-delta");
    expect(CSS).toMatch(/#discipline-ranks td\.rank-weak \.ranks-rank-delta \{\n  color: inherit;/);
  });
});

/* ------------------------------------------------------------------ */
/* 3 · Eigene Zeile + Teamfarbe als Text                               */
/* ------------------------------------------------------------------ */

describe("Eigene Zeile ist verankert", () => {
  /**
   * GEMELDET VON CHRIS: „kannst du oben das eigene team entfernen? das irritiert auf jeden fall
   * wenn man mal 4 teams zb steuern würde."
   *
   * Oben an der Tabelle hing eine KOPIE der eigenen Zeile. Sie setzte genau ein eigenes Team
   * voraus — gepinnt wurde `activeManagerTeamId`, also das gerade ausgewählte. Wer mehrere Teams
   * steuert, sah eins davon doppelt und die anderen nicht, und die Auszeichnung sprang je nach
   * Auswahl auf ein anderes Team.
   *
   * Die eigenen Teams bleiben auffindbar, aber ueber Merkmale, die mit JEDER Anzahl funktionieren:
   * Chip an der Zeile, Akzentlinie, Besitzer-Toenung. Diese Zeilen halten fest, dass die Kopie
   * nicht zurueckkommt.
   */
  it("pinnt keine Kopie der eigenen Zeile mehr ueber die Tabelle", () => {
    expect(ROUTER).not.toContain("pinnedOwnRankRow");
    expect(ROUTER).not.toContain("steht auch unten im Feld");
    expect(ROUTER).not.toContain("ranks-own-pinned-row");
    expect(CSS).not.toContain("ranks-own-pinned");
  });

  it("markiert stattdessen jede gesteuerte Zeile an Ort und Stelle", () => {
    // Der Chip haengt am Team-Vergleich, nicht an einer gepinnten Sonderzeile.
    expect(ROUTER).toContain('row.team.teamId === activeManagerTeamId ? (');
    expect(ROUTER).toContain('<span className="ranks-own-tag">Dein Team</span>');
    // Und die Besitzer-Toenung trifft ALLE gesteuerten Teams, nicht nur das aktive.
    expect(ROUTER).toContain("getOwnerTeamHighlightClass(resolvedTeamControlSettings[row.team.teamId])");
  });

  it("der Dein-Team-Chip in der Matrix: volle Tinte auf akzent-getöntem Grund (gemessen war Akzent-Text dort 3,55:1)", () => {
    const ownTagBlock = CSS.match(/\.ranks-own-tag \{[^}]+\}/)?.[0] ?? "";
    expect(ownTagBlock).toContain("color: var(--nl-ink");
    expect(ownTagBlock).not.toContain("color: var(--nl-accent)");
  });

  it("der Dein-Team-Tag im PP-Board nutzt --nl-accent-text statt rohem Akzent (Q1, 3,18:1)", () => {
    const nlOwnTagBlock = CSS.match(/\.is-new-look \.nl-ranks-own-tag \{[^}]+\}/)?.[0] ?? "";
    expect(nlOwnTagBlock).toContain("var(--nl-accent-text)");
    expect(nlOwnTagBlock).not.toContain("color: var(--nl-accent);");
  });
});

/* ------------------------------------------------------------------ */
/* 4 · PP-Board-Saisonstart: VeloPendingRanking + Vorsaison-Podium     */
/* ------------------------------------------------------------------ */

describe("PP-Board behauptet ohne Werte keine Reihenfolge (Muster 3)", () => {
  it("nutzt das Katalog-Primitive VeloPendingRanking, keinen Eigenbau", () => {
    expect(RANKS_BOARD).toContain('import { VeloPendingRanking } from "@/components/foundation/velo-ui"');
    expect(RANKS_BOARD).toContain("<VeloPendingRanking");
  });

  it("der Leerzustand ersetzt Chips, Chart und Board vollständig", () => {
    expect(RANKS_BOARD).toContain("boardIsPending ? undefined :");
    expect(RANKS_BOARD).toContain("{!boardIsPending && metricStats ? (");
    expect(RANKS_BOARD).toContain("{!boardIsPending && metricBars.length > 0 ? (");
    expect(RANKS_BOARD).toContain("{boardIsPending ? null : (");
  });

  it("auch ein reiner Formkarten-Bonus zählt als echter Wert (kein falscher Leerzustand)", () => {
    expect(RANKS_BOARD).toContain("(row.formBonus[entry.id] ?? 0) === 0");
  });

  it("das Vorsaison-Podium rendert nur echte Snapshot-Daten", () => {
    expect(RANKS_BOARD).toContain("previousSeasonPodium && previousSeasonPodium.entries.length > 0");
    expect(RANKS_BOARD).toContain("Vorsaison · Endstand {previousSeasonPodium.seasonLabel}");
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
  it("Disziplin-Spalten tragen den vollen Namen als Tooltip", () => {
    expect(ROUTER).toContain("`${discipline.name} — Teamstärke-Rang in dieser Disziplin");
    expect(ROUTER).toContain("RANKS_AGGREGATE_COLUMN_TOOLTIPS[column.id]");
  });

  it("alle fünf Aggregat-Kürzel haben eine feste Erklärung", () => {
    for (const key of ["totalRank", "powRank", "speRank", "menRank", "socRank"]) {
      expect(ROUTER).toContain(`${key}: "`);
    }
  });

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
