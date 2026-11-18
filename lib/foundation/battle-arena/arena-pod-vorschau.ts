/**
 * ARENA-POD MIT VORSCHAU (17.11., Block 1 "vier Teams in der Battle Arena").
 *
 * Chris am 17.11.: "in takeshi laufen alle gleichzeitig los was ok ist, aber dort sind gerade auch nur
 * 2 teams - das sollte doch auch auf 4 teams angepasst sein?" und "staffel sollte auch 4 teams haben
 * genau wie battlefield und hat bisher auch nur 2 teams in der battle arena".
 *
 * Befund am Live-Abbild (17.11., Spielstand "Oly New Game Custom", Saison 1, Spieltag 1): die Liga
 * bucht Takeshi's Castle (Spieltag 2, 19), Staffel (7, 20) und Battlefield (1, 17) laengst als
 * Vierergruppe -- aber der Host suchte den Pod nur am AKTUELLEN Spieltag. Spieltag 1 traegt Climbing +
 * Battlefield; Battlefield zeigte deshalb vier Teams, Takeshi und Staffel fielen auf das Zwei-Team-
 * Duell zurueck, weil es fuer sie HEUTE keinen Pod gibt. Kein Motorfehler, eine Host-Annahme.
 *
 * Diese Funktion sucht den Pod des Bezugsteams zuerst am aktuellen Spieltag ("heute"). Gibt es dort
 * keinen, nimmt sie den NAECHSTEN Spieltag, an dem die Disziplin als Pod ansteht ("vorschau"); gibt es
 * keinen spaeteren mehr, den letzten davor ("rueckblick"). Zurueck kommt auch die `matchdayId` dieses
 * Spieltags -- der Host leitet daraus Saat, k und Aufstellung ab, mit denselben Funktionen wie der
 * zaehlende Lauf (`runBahnPodFixtures`/`runBattlefieldPodMatchday`). Die gezeigte Vierergruppe ist also
 * die, die an jenem Spieltag gebucht wird ("gezeigt = gebucht", solange sich Aufstellung und Kader bis
 * dahin nicht aendern) -- keine erfundene Gruppe.
 *
 * Reine Funktion, liest nur. Keine Aenderung an Pod-Bildung oder Buchung.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { getPodForTeam, type MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

export type ArenaPodTreffer = {
  pod: MiniDmPod;
  /** Spieltag, an dem genau diese Vierergruppe gebucht wird. */
  matchdayId: string;
  /** 1-basiert, fuer den Hinweistext. */
  spieltagNummer: number;
  art: "heute" | "vorschau" | "rueckblick";
};

export function findeArenaPodMitVorschau(
  gameState: GameState,
  teamId: string | null | undefined,
  aktuellerMatchdayId: string | null | undefined,
  disciplineId: string,
  options: { saveId?: string | null; nurHeute?: boolean } = {},
): ArenaPodTreffer | null {
  if (!teamId || !aktuellerMatchdayId) return null;
  const saveId = options.saveId ?? null;
  const plan = getSeasonDisciplineSchedule(gameState, { saveId });
  const nummerVon = (matchdayId: string) => {
    const i = plan.findIndex((e) => e.matchdayId === matchdayId);
    return i >= 0 ? i + 1 : 0;
  };
  const heute = getPodForTeam(gameState, teamId, aktuellerMatchdayId, disciplineId, { saveId });
  if (heute) {
    return { pod: heute, matchdayId: aktuellerMatchdayId, spieltagNummer: nummerVon(aktuellerMatchdayId), art: "heute" };
  }
  if (options.nurHeute) return null;
  const jetzt = plan.findIndex((e) => e.matchdayId === aktuellerMatchdayId);
  if (jetzt < 0) return null;
  const traegt = (i: number) => {
    const e = plan[i];
    return e?.discipline1?.disciplineId === disciplineId || e?.discipline2?.disciplineId === disciplineId;
  };
  const versuche = (i: number, art: ArenaPodTreffer["art"]): ArenaPodTreffer | null => {
    if (!traegt(i)) return null;
    const matchdayId = plan[i].matchdayId;
    const pod = getPodForTeam(gameState, teamId, matchdayId, disciplineId, { saveId });
    return pod ? { pod, matchdayId, spieltagNummer: i + 1, art } : null;
  };
  for (let i = jetzt + 1; i < plan.length; i += 1) {
    const t = versuche(i, "vorschau");
    if (t) return t;
  }
  for (let i = jetzt - 1; i >= 0; i -= 1) {
    const t = versuche(i, "rueckblick");
    if (t) return t;
  }
  return null;
}
