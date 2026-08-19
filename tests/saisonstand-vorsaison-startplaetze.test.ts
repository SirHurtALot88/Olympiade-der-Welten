/**
 * Durchklick-Test-Befund G2 · Saisonstand vor Spieltag 1.
 *
 * Ergebnisseite und Arena sagen wörtlich „Bis dahin steht hier bewusst keine
 * Reihenfolge" — der Saisonstand daneben zeigte kommentarlos Rang 1–32 mit
 * lauter „—", der Board-Reiter vergab sogar Gold/Silber/Bronze, und
 * „Top-Spieler der Saison" listete #1–#10 mit ausschließlich „—".
 *
 * Der Prüfer hat die Reihenfolge abgeglichen: sie ist der ENDSTAND DER
 * VORSAISON (deckungsgleich mit der Ewigen Tabelle) — eine legitime Basis.
 * Lösung deshalb „beschriften statt löschen":
 *  - Eine Kopfzeilen-Notiz erklärt die Reihenfolge als Startplätze.
 *  - Medaillen-Optik gibt es erst, wenn irgendein Team echte Punkte trägt.
 *  - Der „Top-Spieler"-Block kollabiert zum geteilten VeloPendingRanking
 *    (dasselbe Primitive wie Arena, Ranks, Ergebnisseite und Leaders).
 *
 * Beidseitige Prüfung wie in transferhistorie-velo-look.test.ts: jede neue
 * CSS-Klasse muss im TSX UND im CSS existieren.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const TSX = readFileSync(
  join(process.cwd(), "app/foundation/season-v2/SeasonStandingsNewLook.tsx"),
  "utf8",
);
const CO_CSS = readFileSync(
  join(process.cwd(), "app/foundation/season-v2/season-standings-new-look.css"),
  "utf8",
);

describe("G2: Startplätze werden beschriftet, nicht gelöscht", () => {
  it("es gibt EINE Wertungs-Erkennung (hasSeasonScoring) auf row.points-Basis", () => {
    expect(TSX).toContain("const hasSeasonScoring = useMemo(");
    expect(TSX).toContain("boardRows.some((row) => row.points != null");
  });

  it("die Kopfzeilen-Notiz nennt den Vorsaison-Endstand als Quelle der Reihenfolge", () => {
    expect(TSX).toContain("nl-standings-preseason-note");
    expect(TSX).toContain("Endstand der Vorsaison");
    expect(TSX).toContain("ab Spieltag 1");
  });

  it("… und ihre CSS-Klasse existiert wirklich (beidseitige Prüfung)", () => {
    expect(CO_CSS).toContain(".is-new-look .nl-standings-preseason-note");
  });

  it("Gegenprobe Archiv: eine archivierte Saison bekommt die Notiz nicht", () => {
    expect(TSX).toContain("!hasSeasonScoring && !isArchived && boardRows.length > 0");
  });
});

describe("G2: keine Medaillen für 0 Punkte", () => {
  it("Board-Medaille und Podium-Glow hängen an hasSeasonScoring", () => {
    const start = TSX.indexOf("function renderBoardRow(");
    expect(start).toBeGreaterThan(-1);
    const block = TSX.slice(start, start + 2400);
    expect(block).toContain("const isPodium = hasSeasonScoring &&");
    expect(block).toContain("const medalKind = !hasSeasonScoring");
    // Der gewertete Fall bleibt unverändert: Medaille + sichtbare Rangzahl (S6).
    expect(block).toContain("<NlMedalBadge kind={medalKind}");
  });
});

describe("G2: Top-Spieler ohne PPs → geteiltes VeloPendingRanking", () => {
  it("die Pending-Erkennung prüft ALLE Kandidaten auf pps == null", () => {
    expect(TSX).toContain("topPlayersStrip.every((player) => player.pps == null)");
  });

  it("beide Ansichten (Board-Streifen und Daten-Raster) nutzen dieselbe Pending-Karte", () => {
    expect(TSX).toContain("function renderTopPlayersPendingCard()");
    expect((TSX.match(/renderTopPlayersPendingCard\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(TSX).toContain("<VeloPendingRanking");
    expect(TSX).toContain('title="Top-Spieler — noch zu vergeben"');
  });

  it("Gegenprobe: mit Wertung bleibt die echte Liste bestehen", () => {
    // Der gefüllte Fall rendert weiterhin die klickbaren Spieler-Kacheln.
    expect(TSX).toContain('aria-label="Top-Spieler der Saison"');
    expect(TSX).toContain("buildTopPlayerTitle(player)");
  });
});

describe("G5: die Kopfzeile spricht Spielerdeutsch, Status-Flags nur noch im Tooltip", () => {
  it("keine rohe Status-Reihe mehr als Eyebrow", () => {
    expect(TSX).not.toContain('`${sourceBadgeLabel} · ${isArchived ? "Archiv" : "Live"} · ${sourceLabel}`');
    /*
     * HIER STANDEN DIE BEIDEN TEXTE WOERTLICH — und genau das ist seit Befund B5 falsch.
     *
     * Die Zeile war an ZWEI Stellen getippt (Saisonstand und Raenge), und deshalb fehlte an
     * beiden der dritte Zustand: eine Saison, die nicht archiviert und trotzdem durch ist,
     * las sich als „Saison laeuft" — direkt unter der Ueberschrift „Saison abgeschlossen".
     *
     * Die Texte leben jetzt in `lib/foundation/liga-wertung-kopfzeile.ts`. Der Anspruch dieses
     * Falls bleibt derselbe (Klartext statt Status-Flags), er prueft ihn nur an der richtigen
     * Stelle: die Ansicht RUFT die Rechenstelle, statt Text nachzutippen. Dass die drei
     * Zustaende stimmen, haelt `tests/saisonende-widersprueche.test.ts` fest.
     */
    expect(TSX).toContain("resolveLigaWertungKopfzeile(");
    expect(TSX).not.toContain('"Liga-Wertung · Saison läuft"');
  });

  it("die technische Quelle bleibt als Tooltip erhalten (nichts wird verschwiegen)", () => {
    expect(TSX).toContain("title={`${sourceBadgeLabel} · ${sourceLabel}`}");
  });
});
