/**
 * DER SPIELPLAN DECKELT DIE SPIELERZAHL NICHT MEHR.
 *
 * Chris: „der spielplan soll nichts deckeln! auch 12 soll möglich sein! das soll ja dann der
 * vorteil sein für teams die bereit sind auch mal 12 oder 13 spieler zu picken!"
 *
 * Vorher lag der Standard bei 10 kombinierten Spielern je Spieltag. Der Disziplin-Pool traegt
 * aber Disziplinen bis 6 Spieler — die beiden groessten ergeben zusammen 12. Der Deckel nahm
 * damit genau die Entscheidung aus dem Spiel, um die es geht: einen breiten Kader zu halten,
 * um an einem grossen Spieltag alle Plaetze besetzen zu koennen.
 *
 * Der Deckel war ohnehin nur halb wirksam: fand sich kein Partner darunter, griff eine
 * Ersatzregel, nahm die kleinste verfuegbare Disziplin und warnte — die Grenze wurde also
 * gerissen statt eingehalten.
 */
import { describe, expect, it } from "vitest";

import type { Discipline } from "@/lib/data/olyDataTypes";
import { buildSeasonSeededDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

/** Pool im Zuschnitt des echten Spiels: je vier Disziplinen mit 2, 3, 4, 5 und 6 Spielern. */
function baueDisziplinen(): Discipline[] {
  const pool: Discipline[] = [];
  for (const anzahl of [2, 3, 4, 5, 6]) {
    for (let lauf = 1; lauf <= 4; lauf += 1) {
      pool.push({
        id: `diszi-${anzahl}-${lauf}`,
        name: `Disziplin ${anzahl}/${lauf}`,
        category: "power",
        playerCount: anzahl,
      } as unknown as Discipline);
    }
  }
  return pool;
}

function summenJeSpieltag(maxCombinedPlayerCount?: number) {
  const plan = buildSeasonSeededDisciplineSchedule({
    saveId: "save-deckel-probe",
    seasonId: "season-1",
    disciplines: baueDisziplinen(),
    matchdayCount: 10,
    ...(maxCombinedPlayerCount == null ? {} : { maxCombinedPlayerCount }),
  });
  return {
    summen: plan.entries.map(
      (eintrag) => (eintrag.discipline1?.playerCount ?? 0) + (eintrag.discipline2?.playerCount ?? 0),
    ),
    warnungen: plan.warnings.filter((warnung) => warnung.includes("over_roster_limit")),
  };
}

describe("Spielplan ohne Deckel", () => {
  it("laesst grosse Spieltage zu, statt sie wegzufiltern", () => {
    const { summen, warnungen } = summenJeSpieltag();

    // Der Pool gibt maximal 6 + 6 = 12 her; ohne Deckel muss das auch vorkommen duerfen.
    expect(Math.max(...summen)).toBeGreaterThan(10);
    // Und die Ersatzregel muss gar nicht mehr einspringen.
    expect(warnungen).toEqual([]);
  });

  it("ein ausdruecklicher Deckel wirkt weiterhin — als Vorzug, nicht als harte Grenze", () => {
    // Der Parameter bleibt fuer Tests und Sonderlaeufe. Wichtig zu wissen, wie er wirkt: findet
    // sich kein Partner darunter, nimmt eine Ersatzregel die kleinste verfuegbare Disziplin und
    // warnt — die Grenze wird dann gerissen. Das war schon vorher so und ist der Grund, warum
    // selbst mit Deckel 10 ein Spieltag mit 11 Spielern vorkam.
    const { summen, warnungen } = summenJeSpieltag(8);

    // Der Vorzug wirkt: mit Deckel bleiben mehr Spieltage klein als ohne.
    const ohne = summenJeSpieltag();
    const kleineMitDeckel = summen.filter((summe) => summe <= 8).length;
    const kleineOhneDeckel = ohne.summen.filter((summe) => summe <= 8).length;
    expect(kleineMitDeckel).toBeGreaterThanOrEqual(kleineOhneDeckel);
    expect(kleineMitDeckel).toBeGreaterThan(0);
    // Wo sie gerissen wird, sagt der Spielplan es auch.
    if (summen.some((summe) => summe > 8)) {
      expect(warnungen.length).toBeGreaterThan(0);
    }
  });

  it("Gegenprobe zum alten Standard: mit 10 faellt der grosse Spieltag weg", () => {
    // Genau das war das gemeldete Verhalten — festgehalten, damit klar bleibt, was sich
    // geaendert hat und warum der alte Wert nicht versehentlich zurueckkommt.
    const alt = summenJeSpieltag(10);
    const neu = summenJeSpieltag();
    expect(Math.max(...alt.summen)).toBeLessThan(Math.max(...neu.summen));
  });
});
