/**
 * DIE ARENA DARF NICHT „FERTIG" SAGEN, WENN DER SAVE ES ANDERS SIEHT.
 *
 * GEMELDET VON CHRIS: „aber MD4 hat nicht gescored und blocked auch so dass ich nicht weiter komme
 * und abschliessen kann das ist mein problem, nicht dass dort keine punkte sind."
 *
 * BEFUND am Spielstand (`new-game-1786465783606-0kalpx`, Saison 1, Spieltag 4): D1 (Wettessen) mit
 * 32 Ergebniszeilen gebucht, D2 (Mini-DM) mit NULL — obwohl alle 32 Aufstellungen für D2 vorlagen
 * (64 Einträge, Vertrag sauber, 2 Pflichtspieler je Team). Die Arena war für D2 gelaufen, die
 * BUCHUNG kam nicht durch.
 *
 * URSACHE: Der Weiterführungs-Block unter der Bühne entschied allein an der ANGEZEIGTEN SEITE:
 *
 *     const guideToSecondDiscipline =
 *       !devMode && activeDisciplineSide === "d1" && secondDisciplineId != null && …
 *
 * Stand man auf D2 und war D2 ungewertet, war die Bedingung falsch — und die Ansicht fiel in den
 * Zweig darunter, der „Beide Disziplinen sind gewertet" behauptet und den Abschluss-Knopf zeigt.
 * Der blockte dann, weil `getMatchdayScoringProgress` `partial` meldet. Eine Sackgasse mit falscher
 * Auskunft: die Arena sagt fertig, der Spieltagswechsel sagt nein, und einen Weg zurück zur Wertung
 * bot die Seite nicht an.
 *
 * NICHT die Ursache und bewusst unangetastet: dass der Spieltagswechsel bei halbem Spieltag blockt.
 * Das ist Absicht (`result_apply_incomplete_missing_d2_for_current_matchday`) — ohne den Schutz
 * fehlte jeder in D2 aufgestellte Spieler dauerhaft in `playerDisciplinePerformances`.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const ARENA = await fs.readFile(
  path.join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageArena.tsx"),
  "utf8",
);

/** Der Block unter der Bühne — nur dort wird weitergeführt bzw. abgeschlossen. */
const WEITERFUEHRUNG = ARENA.slice(ARENA.indexOf("const secondDisciplineId = matchdaySides.d2"));

describe("Arena: ungewertete Seite führt nicht in die Sackgasse", () => {
  it("entscheidet NICHT mehr allein an der angezeigten Seite", () => {
    // Genau diese Form war der Fehler: sie fragt, was angezeigt wird, nicht was gewertet ist.
    expect(WEITERFUEHRUNG).not.toContain('activeDisciplineSide === "d1" && secondDisciplineId != null');
  });

  it("liest den Wertungsstand aus dem SPIELSTAND, für beide Seiten", () => {
    // `scoringProgress` überlebt den Reload und ist die einzige Quelle, die weiss, was gebucht ist.
    expect(WEITERFUEHRUNG).toContain("scoringProgress?.d1.scored");
    expect(WEITERFUEHRUNG).toContain("scoringProgress?.d2.scored");
  });

  it("meldet eine gelaufene, aber ungebuchte Seite — statt „beide gewertet\" zu behaupten", () => {
    // Der Zweig, der Chris' Fall auffängt. Ohne ihn landete man im Abschluss-Zweig.
    expect(WEITERFUEHRUNG).toContain("arena-side-not-booked");
    expect(WEITERFUEHRUNG).toContain("!eigeneSeiteGewertet");
  });

  it("führt zur anderen Seite, egal auf welcher man steht — solange sie geplant und ungewertet ist", () => {
    expect(WEITERFUEHRUNG).toContain("andereSeiteGeplant");
    expect(WEITERFUEHRUNG).toContain("!andereSeiteGewertet");
  });

  it("der Abschluss-Knopf bleibt der letzte Zweig — er kommt erst nach beiden Prüfungen", () => {
    const ungebucht = WEITERFUEHRUNG.indexOf("arena-side-not-booked");
    const fuehrung = WEITERFUEHRUNG.indexOf("guideToSecondDiscipline");
    const abschluss = WEITERFUEHRUNG.indexOf("arena-finish-matchday");
    expect(ungebucht).toBeGreaterThan(-1);
    expect(fuehrung).toBeGreaterThan(-1);
    expect(abschluss).toBeGreaterThan(ungebucht);
    expect(abschluss).toBeGreaterThan(fuehrung);
  });

  it("der Halb-Spieltag-Schutz im Spieltagswechsel bleibt unangetastet", async () => {
    // Gegenprobe zur Versuchung, den Blocker einfach zu entfernen: er muss stehen bleiben.
    const progress = await fs.readFile(
      path.join(process.cwd(), "lib/season/matchday-progress-service.ts"),
      "utf8",
    );
    expect(progress).toContain("result_apply_incomplete_missing_d2_for_current_matchday");
  });
});
