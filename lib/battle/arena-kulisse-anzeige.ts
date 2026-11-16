import type { Fixture } from "@/lib/data/olyDataTypes";
import { buildArenaMatchSeed, seedZuZahl } from "@/lib/battle/arena-seed";
import { hatKulissenProfil, waehleKulisseFuerFixture, waehleKulisseIndex } from "@/lib/battle/arena-kulisse";
import { isViererPodDiscipline } from "@/lib/season/season-discipline-schedule";
import arenaKulissenNamenJson from "@/data/generated/arena-kulissen-namen.json";

/**
 * KULISSEN-FUNDAMENT (Baustein 1 des konsolidierten Arenen-Konzepts, 15.11.,
 * `docs/design/arenen-mechaniken-konzept-konsolidiert-15-11.md` Abschnitt 5.1): der Spielplan
 * (Spieltage-Tab im Saisonstand) zeigt, WO ein Duell stattfindet, BEVOR der Spieltag laeuft.
 * Reine Anzeige, NULL Spielwirkung.
 *
 * Ergaenzt `arena-kulisse.ts` (Oberflaechen-Effekte, #1354), ersetzt sie nicht:
 *
 *  - Disziplinen MIT Kulissen-Profil (heute Tennis): die Anzeige ist genau die GEBUCHTE Variante
 *    (`waehleKulisseFuerFixture`, dieselbe, die Host und Runner als `kulisseByDisciplineId`
 *    mitgeben und die der Motor in `kulisseWaehlen()` zuerst nimmt) -- "gezeigt = gebucht".
 *  - Alle uebrigen Disziplinen mit illustrierten Kulissen: der Host bucht nichts, der Motor
 *    waehlt selbst per Hash ueber Disziplin|Saat|Heim|Gast|Spieltag. Die Anzeige sagt diese Wahl
 *    VORAUS, mit derselben Hash-Rechnung (`waehleKulisseIndex`, bit-identisch zum Motor) und denselben
 *    Eingaben, die der Host dem Motor gibt (Saat = `seedZuZahl(buildArenaMatchSeed(...))`,
 *    Heim/Gast in Fixture-Orientierung, `spieltag` = NUMERISCHER Spieltag wie
 *    `meta.spieltag = Season.currentMatchday`, nicht die textuelle `matchdayId`).
 *  - Vierer-Pod-Disziplinen (Mini-DM, Battlefield, Takeshi's Castle, Staffel): der Motor nimmt
 *    dort eine Pod-Saat statt der Duell-Saat -- keine Vorhersage moeglich, also `null` statt
 *    einer Anzeige, die der Motor dann nicht zeigt.
 *
 * Die Namen kommen aus `data/generated/arena-kulissen-namen.json`, einem schlanken id/label-Abzug
 * von `public/mockups/battle-mode.kulissen.js` (kein `node:fs` im Client-Bundle -- diese Datei
 * wird vom Spielplan, "use client", importiert). `tests/arena-kulisse-bit-identisch.test.ts`
 * prueft, dass der Abzug zum Original passt und dass die Wahl dem Motor-Hash entspricht.
 */

export type ArenaKulisseAuswahl = {
  disziplin: string;
  /** Die stabile Kulissen-ID, z.B. "streetcourt" -- identisch zu `KULISSEN[disc][i].id` im Motor. */
  id: string;
  /** Lesbarer Name fuer die Anzeige, z.B. "Street-Court". */
  label: string;
};

type KulissenRegistry = Record<string, ReadonlyArray<{ id: string; label: string }>>;

const KULISSEN_NAMEN = arenaKulissenNamenJson as KulissenRegistry;

/** Die Kulissen-Namen einer Disziplin in Motor-Reihenfolge (leer, wenn sie keine illustrierten hat). */
export function kulissenNamenVon(disziplin: string): ReadonlyArray<{ id: string; label: string }> {
  const liste = KULISSEN_NAMEN[disziplin];
  return Array.isArray(liste) ? liste : [];
}

export function waehleKulisseAnzeige(input: {
  disciplineId: string;
  saveId: string;
  seasonId: string;
  /** Numerischer Spieltag (1-basiert), wie `Season.currentMatchday` im Host. */
  spieltag: string | number | null | undefined;
  fixture: Pick<Fixture, "homeTeamId" | "awayTeamId" | "matchdayId">;
}): ArenaKulisseAuswahl | null {
  const { disciplineId, fixture } = input;
  const liste = kulissenNamenVon(disciplineId);
  if (liste.length === 0 || isViererPodDiscipline(disciplineId)) return null;
  const saat = seedZuZahl(
    buildArenaMatchSeed({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: fixture.matchdayId,
      disciplineId,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
    }),
  );
  if (hatKulissenProfil(disciplineId)) {
    const gebucht = waehleKulisseFuerFixture({
      disziplin: disciplineId,
      saat,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      matchdayId: fixture.matchdayId,
    });
    // "Kein Effekt ohne Bild": nur eine ID, die der Motor auch in seiner Liste hat, zaehlt.
    const eintrag = gebucht ? liste.find((k) => k.id === gebucht.id) : undefined;
    return eintrag ? { disziplin: disciplineId, id: eintrag.id, label: eintrag.label } : null;
  }
  const index = waehleKulisseIndex(
    liste.length,
    disciplineId,
    saat,
    fixture.homeTeamId,
    fixture.awayTeamId,
    input.spieltag,
  );
  const gewaehlt = liste[index];
  return gewaehlt ? { disziplin: disciplineId, id: gewaehlt.id, label: gewaehlt.label } : null;
}
