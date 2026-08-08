/**
 * S3 · Arena vor dem Anpfiff (Audit Spieltag, Befunde A1/A2/A3 — Muster 3).
 *
 * Der ehrlichste Befund des Audits: die Arena ERFAND vor dem Start ein Ergebnis.
 * Die Spieltags-Wertung nummerierte bei 0 Punkten alphabetisch durch und gab den
 * ersten drei Teams des Alphabets Medaillen-Optik; dasselbe Team stand als
 * „Rang 19" im Kopf und als Zeile 22 in der Tabelle. Dazu 32 Schloss-Zeilen und
 * 32× „keine Aufstellung", während die einzig relevante Information (deine
 * Einsatzliste fehlt) im Ticker-Fließtext stand.
 *
 * Der Umbau: ein expliziter Pre-Matchday-Zustand (Startbereitschaft als Held mit
 * CTA, Disziplin-Kontext, „Dein Umfeld" aus der EINEN kanonischen Rangquelle) —
 * und die Wertung rendert erst, wenn es etwas zu werten gibt. Der Leerzustand
 * ist ein geteiltes Primitive (`VeloPendingRanking`), damit die Ranks-Seite
 * (Paket W1) denselben „Noch zu vergeben"-Entwurf übernehmen kann.
 *
 * Der Test hält beides fest: die Struktur-Aussagen des Umbaus UND dass jede
 * benutzte CSS-Klasse wirklich in globals.css existiert (CSS fällt still durch).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const ARENA = quelle("app/foundation/discipline-stage/DisciplineStageArena.tsx");
const HOST = quelle("app/foundation/discipline-stage/FoundationDisciplineStageHost.tsx");
const SHELL = quelle("app/foundation/FoundationShellRouterBody.tsx");
const PRIMITIVE = quelle("components/foundation/velo-ui/VeloPendingRanking.tsx");
const KATALOG = quelle("components/foundation/velo-ui/index.ts");
const CSS = quelle("app/globals.css");

// Der Pre-Matchday-Ausschnitt der Arena: von der Zustandsweiche bis zum Beginn
// des regulären Bühnen-Returns (der Smoke-Anker-Kommentar steht direkt danach).
const prematchStart = ARENA.indexOf("if (showPreMatchday) {");
const prematchEnd = ARENA.indexOf("Stabiler Anker fuer die Browser-Smokes");
const PREMATCH = ARENA.slice(prematchStart, prematchEnd);

describe("Beidseitige Klassen-Absicherung (Markup ↔ globals.css)", () => {
  const tokens = new Set<string>();
  for (const match of ARENA.matchAll(/arena-prematch[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  for (const match of PRIMITIVE.matchAll(/velo-pending-ranking[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  // data-Attribute/Testids sind keine Klassen.
  tokens.delete("arena-prematch-lineup-cta");
  tokens.delete("arena-prematch-pending-ranking");

  it("es gibt überhaupt Tokens (der Extraktor läuft nicht ins Leere)", () => {
    expect(tokens.size).toBeGreaterThan(10);
  });

  it.each([...tokens].sort())("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });

  // Rückrichtung: jede in globals.css definierte Klasse der beiden neuen
  // Familien wird auch wirklich benutzt — kein totes CSS in den neuen Blöcken.
  const definierte = new Set<string>();
  for (const match of CSS.matchAll(/\.((?:arena-prematch|velo-pending-ranking)[a-z0-9-]*(?<!-))/g)) {
    definierte.add(match[1]);
  }
  it.each([...definierte].sort())("%s (globals.css) wird im Markup benutzt", (klasse) => {
    const benutzt = ARENA.includes(klasse) || PRIMITIVE.includes(klasse);
    expect(benutzt).toBe(true);
  });
});

describe("Vor dem Start behauptet keine Wertung eine Reihenfolge", () => {
  it("die Spieltags-Wertung rendert nur mit mindestens einer aufgedeckten Disziplin", () => {
    expect(ARENA).toContain("matchdayPanel && (panelD1Revealed || panelD2Revealed) ?");
  });

  it("ohne Wertung steht der erklärende Platzhalter (VeloPendingRanking), keine Tabelle", () => {
    expect(ARENA).toContain('data-testid="arena-stage-pending-ranking"');
    expect(PREMATCH).toContain('data-testid="arena-prematch-pending-ranking"');
    expect(PREMATCH).toContain("Noch zu vergeben");
  });

  it("der Pre-Matchday-Ausschnitt rendert keine Rang-Badges und keine Medaillen-Farben", () => {
    expect(PREMATCH.length).toBeGreaterThan(1000);
    expect(PREMATCH).not.toContain("RankBadge");
    expect(PREMATCH).not.toContain("--nl-gold");
    expect(PREMATCH).not.toContain("--nl-silver");
    expect(PREMATCH).not.toContain("--nl-bronze");
    expect(PREMATCH).not.toContain("DisciplineStageMatchdayPanel");
  });

  it("die Zustandserkennung kommt aus echten Daten (Lineup-Gate, gebuchte Ergebnisse, gelaufene Disziplinen)", () => {
    expect(ARENA).toContain("arenaStartBlockedByLineups &&");
    expect(ARENA).toContain("!matchdayHasBookedResult &&");
    expect(ARENA).toContain("endedDisciplineIds.size === 0");
    expect(ARENA).toContain("hasCurrentMatchdayResult(gameState)");
  });
});

describe("Eine Rangquelle (A1: Kopf ‚Rang 19' vs. Zeile 22)", () => {
  it("der Saison-Rang der Wertung kommt kanonisch aus seasonState.standings", () => {
    expect(ARENA).toContain("const canonicalStandings = gameState.seasonState?.standings ?? {};");
    expect(ARENA).toContain("currentRank: canonicalRankOf(r.teamId) ?? s?.currentRank ?? null");
  });

  it("‚Dein Umfeld' liest dieselbe Quelle und erklärt die Startplätze, statt eine frische Wertung zu suggerieren", () => {
    expect(PREMATCH).toContain("Startplätze aus dem Endstand der Vorsaison");
    expect(ARENA).toContain("const preMatchContext = useMemo(() => {");
    expect(ARENA).toContain("const standings = gameState.seasonState?.standings ?? {};");
  });
});

describe("Die relevante Information ist der Held", () => {
  it("eigene Einsatzliste mit Zählern und echtem CTA", () => {
    expect(PREMATCH).toContain("Plätzen besetzt");
    expect(PREMATCH).toContain('data-testid="arena-prematch-lineup-cta"');
    expect(PREMATCH).toContain("Einsatzliste öffnen →");
  });

  it("der CTA ist bis in den Router verdrahtet (Arena → Einsatzliste)", () => {
    expect(HOST).toContain("onOpenLineup?: (() => void) | null;");
    expect(SHELL).toContain("onOpenLineup={() => setFoundationView(\"lineup\", setActiveView, { push: true })}");
  });

  it("der Smoke-Anker bleibt am Pre-Matchday-Container erhalten", () => {
    expect(PREMATCH).toContain('data-testid="arena-stage"');
  });

  it("kein roher Spieltags-Bezeichner im Kopf (F5)", () => {
    expect(ARENA).toContain("matchdayNumberLabel");
    expect(PREMATCH).toContain("Arena · {matchdayNumberLabel}");
  });
});

describe("VeloPendingRanking ist eine Katalog-Komponente (für W1 wiederverwendbar)", () => {
  it("steht im Velo-Katalog mit einer Wann-benutzen-Zeile", () => {
    expect(KATALOG).toContain("VeloPendingRanking");
    expect(KATALOG).toContain("Leerzustand fuer Wertungen OHNE Daten");
  });

  it("erfindet nichts: Slots, Meta und Texte kommen vollständig vom Aufrufer", () => {
    expect(PRIMITIVE).not.toMatch(/\brank\b/i);
    expect(PRIMITIVE).toContain("slots?: VeloPendingRankingSlot[]");
    expect(PRIMITIVE).toContain("note: string");
  });
});
