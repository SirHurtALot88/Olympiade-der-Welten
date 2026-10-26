import type { Fixture } from "@/lib/data/olyDataTypes";
import { buildArenaMatchSeed, seedZuZahl } from "@/lib/battle/arena-seed";

/**
 * DIE HOST-SAATBERECHNUNG, HERAUSGEZOGEN (PR4 "Determinismus-Feinschliff", Plan
 * `docs/design/battle-arena-auto-run-anbindung-plan-16-10.md` Abschnitt 5.2 "Host-Orientierung
 * (F9)" und Abschnitt 5.3). Die Orientierungs-Unabhaengigkeit selbst (den Seed aus dem ECHTEN
 * Fixture bauen, nie aus `heimTeamId`/`gastTeamId` direkt) wurde bereits in PR 3 in
 * `FoundationBattleArenaHost.tsx` eingebaut (s. dortiger F9-FIX-Kommentar) — dieser Modul zieht
 * genau diese Logik als reine, Chromium-/React-freie Funktion heraus, aus zwei Gruenden:
 *
 *  1. Section 5.3 des Plans verlangt einen eigenen Test (`tests/arena-seed-identitaet.test.ts`),
 *     der Runner-Eingabebau und Host-Saatberechnung vergleicht, "als reine Funktion
 *     herausgezogen" — vorher stand die Logik nur als `useMemo`-Block mitten im Host-Bauteil und
 *     war ohne React-Rendering nicht pruefbar.
 *  2. Eine zweite, unabhaengig gepflegte Kopie dieser Logik ist genau die Bugklasse, die dieses
 *     Projekt bereits teuer erwischt hat (s. Kommentar in `arena-seed.ts`) — der Host importiert
 *     ab jetzt diese eine Funktion, statt den Fixture-Abgleich inline zu wiederholen.
 *
 * `fixtureIndex` ist bewusst ein Parameter (nicht intern gebaut): der Aufrufer hat ihn ohnehin
 * schon ueber `baueFixtureIndex(findeSpieltagsFixtures(...))` (`lib/resolve/battle-mode-pps-duell.ts`)
 * — exakt denselben `seasonState.schedule`, aus dem auch `findLeagueFixturesForMatchday()`
 * (Runner-Seite, `battle-mode-arena-team-points.ts`) seine Fixtures liest.
 */
export type ArenaHostSeedInput = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  /** Die an diesem Spieltag arena-aufgeloesten Disziplinen-Slots (D1/D2), s. `ARENA_RESOLVED_DISCIPLINE_IDS`. */
  disciplineIds: readonly string[];
  heimTeamId: string;
  gastTeamId: string;
  /** `teamId -> sein Fixture dieses Spieltags`, s. `baueFixtureIndex()`. */
  fixtureIndex: ReadonlyMap<string, Fixture>;
};

export type ArenaHostSeedResult = {
  /** Je Disziplin der normalisierte Zahl-Seed — nur gesetzt, wenn heim/gast das echte Fixture sind. */
  seedByDisciplineId: Record<string, number>;
  /**
   * `true`, wenn fuer `heimTeamId` an diesem Spieltag KEIN Fixture existiert, oder es existiert,
   * aber `gastTeamId` ist nicht dessen Gegner (in beliebiger Orientierung). In diesem Fall bleibt
   * `seedByDisciplineId` leer und der Motor faellt auf seine eigene Ersatzsaat (1337) zurueck —
   * das gezeigte Spiel ist dann NICHT das, was fuer diesen Spieltag gezaehlt hat (bzw. zaehlen
   * wird). `false` auch dann, wenn gar keine Entscheidung moeglich ist (leere/ungueltige Eingabe)
   * — ein Hinweis macht nur Sinn, wenn tatsaechlich ein Team-Paar gewaehlt ist.
   */
  istKeinGewertetesDuell: boolean;
};

export function resolveArenaHostSeeds(input: ArenaHostSeedInput): ArenaHostSeedResult {
  const { saveId, seasonId, matchdayId, disciplineIds, heimTeamId, gastTeamId, fixtureIndex } = input;
  const leer: ArenaHostSeedResult = { seedByDisciplineId: {}, istKeinGewertetesDuell: false };
  if (!saveId || !seasonId || !matchdayId || !heimTeamId || !gastTeamId || heimTeamId === gastTeamId) {
    return leer;
  }

  const echtesFixture = fixtureIndex.get(heimTeamId);
  const istDasGewaehltePaar =
    echtesFixture != null &&
    ((echtesFixture.homeTeamId === heimTeamId && echtesFixture.awayTeamId === gastTeamId) ||
      (echtesFixture.homeTeamId === gastTeamId && echtesFixture.awayTeamId === heimTeamId));

  if (!istDasGewaehltePaar || !echtesFixture) {
    // Kein Fixture dieses Spieltags fuer dieses Paar -- kein Eintrag, Motor faellt auf 1337.
    return { seedByDisciplineId: {}, istKeinGewertetesDuell: true };
  }

  const seedByDisciplineId: Record<string, number> = {};
  for (const disciplineId of disciplineIds) {
    // IMMER `echtesFixture.homeTeamId`/`.awayTeamId`, NIE `heimTeamId`/`gastTeamId` direkt --
    // orientierungsunabhaengig von der UI-Auswahl, s. Dateikommentar.
    seedByDisciplineId[disciplineId] = seedZuZahl(
      buildArenaMatchSeed({
        saveId,
        seasonId,
        matchdayId,
        disciplineId,
        homeTeamId: echtesFixture.homeTeamId,
        awayTeamId: echtesFixture.awayTeamId,
      }),
    );
  }
  return { seedByDisciplineId, istKeinGewertetesDuell: false };
}
