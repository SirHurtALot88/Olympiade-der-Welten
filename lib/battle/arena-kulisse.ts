import type { Fixture } from "@/lib/data/olyDataTypes";
import { buildArenaMatchSeed, seedZuZahl } from "@/lib/battle/arena-seed";
import arenaKulissenNamenJson from "@/data/generated/arena-kulissen-namen.json";

/**
 * KULISSEN-FUNDAMENT (Baustein 1 des konsolidierten Arenen-Konzepts, 15.11.,
 * `docs/design/arenen-mechaniken-konzept-konsolidiert-15-11.md` Abschnitt 5.1 /
 * `docs/design/oberflaechen-effekte-konzept-08-11.md` Abschnitt 2.4). Rein transparent, NULL
 * Spielwirkung: Chris soll im Spielplan sehen, WO ein Duell stattfindet, BEVOR der Spieltag
 * läuft -- heute entscheidet das erst der Motor beim `reset()`, mit `kulisseWaehlen()` in
 * `public/mockups/battle-mode.engine.js` (~Zeile 42737).
 *
 * BIT-IDENTISCH ZUM MOTOR, NICHT NEU ERFUNDEN. `kulisseWaehlen()` baut einen Schlüssel aus
 * Disziplin, Saat, Heim-/Gast-ID und Spieltag und hasht ihn über zwei Funktionen, die im Motor
 * schon für andere Zwecke existieren (`normalisiereSaat()` -- FNV-1a über einen Text-Seed,
 * dieselbe Konstante wie `seedZuZahl()` hier in `arena-seed.ts` -- und `ispyMischeHash()`, ein
 * MurmurHash3-Finalizer-Avalanche-Mix). KEIN `rr()`, kein Zugriff auf den laufenden
 * Zufallszustand -- die Wahl ist eine reine Funktion ihrer fünf Eingänge, s.
 * `tests/arena-kulisse-bit-identisch.test.ts`, der diese Funktionen direkt aus dem
 * Motor-Quelltext zieht und gegen die hier portierten Varianten vergleicht.
 *
 * BEWUSST OHNE DATEIZUGRIFF. `waehleKulisse()`/`waehleKulisseFuerFixture()` laufen auch im
 * Client-Bundle (`lib/foundation/season-matchday-fixtures-overview.ts`, importiert von
 * `SeasonStandingsNewLook.tsx`/`SeasonStandingsV2Client.tsx`, beide "use client") -- ein
 * `node:fs`-Zugriff hier würde den Browser-Build brechen, derselbe Grund, warum `arena-seed.ts`
 * seine Hash-Funktion schon vom Headless-Runner trennt (s. dortiger Kommentar). Die Namen der
 * Kulissen kommen deshalb aus `data/generated/arena-kulissen-namen.json`, einem schlanken
 * Abzug (nur `id`/`label`, keine Bildpfade) von `public/mockups/battle-mode.kulissen.js`
 * (`window.__ARENA_KULISSEN`, von `scripts/baue-arena-kulissen.py` generiert) --
 * `tests/arena-kulisse-bit-identisch.test.ts` prüft auch, dass dieser Abzug noch zum
 * Original passt.
 */

export type ArenaKulisseAuswahl = {
  disziplin: string;
  /** Die stabile Kulissen-ID, z.B. "streetcourt" -- identisch zu `KULISSEN[disc][i].id` im Motor. */
  id: string;
  /** Lesbarer Name für die Anzeige, z.B. "Street-Court". */
  label: string;
};

type KulissenRegistry = Record<string, ReadonlyArray<{ id: string; label: string }>>;

const KULISSEN_NAMEN = arenaKulissenNamenJson as KulissenRegistry;

/**
 * FNV-1a über einen Text-Schlüssel, byte-identisch zum String-Zweig von `normalisiereSaat()`
 * (`battle-mode.engine.js`) UND zu `seedZuZahl()` hier im selben Ordner (beide teilen denselben
 * Offset/Prime -- `normalisiereSaat()` schreibt sie nur als Dezimalzahl statt als Hex-Literal).
 * `kulisseWaehlen()` übergibt `normalisiereSaat()` immer einen (nicht-leeren) Text-Schlüssel,
 * nie eine nackte Zahl -- der Zahlen-Rückfallzweig von `normalisiereSaat()` ("saat||1337")
 * kommt für die Kulissenwahl deshalb nie zum Zug und wird hier bewusst nicht nachgebaut.
 */
function fnv1aText(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** MurmurHash3-Finalizer-Avalanche-Mix, byte-identisch zu `ispyMischeHash()` im Motor. */
function avalancheMix32(x: number): number {
  let h = x >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** `kulisseHash(s) = ispyMischeHash(normalisiereSaat(s))` -- derselbe Einzeiler wie im Motor. */
function kulisseHash(schluessel: string): number {
  return avalancheMix32(fnv1aText(schluessel));
}

/**
 * Derselbe Schlüssel wie `kulisseWaehlen()` im Motor: `[disc, saat, heimId, gastId,
 * spieltag].join("|")`, mit genau denselben Leerwert-Regeln (`saat==null?"":String(saat)`,
 * `heimId||""`, `gastId||""`, `spieltag??""`).
 */
function baueKulisseSchluessel(
  disziplin: string,
  saat: string | number | null | undefined,
  heimTeamId: string | null | undefined,
  gastTeamId: string | null | undefined,
  spieltag: string | number | null | undefined,
): string {
  return [
    disziplin,
    saat == null ? "" : String(saat),
    heimTeamId || "",
    gastTeamId || "",
    spieltag ?? "",
  ].join("|");
}

/**
 * Bit-identische TS-Portierung von `kulisseWaehlen()`. Gibt `null`, wenn diese Disziplin (noch)
 * keine illustrierten Kulissen hat (derselbe Rückfall wie im Motor: `kulisseAktiv=null`).
 */
export function waehleKulisse(
  disziplin: string,
  saat: string | number | null | undefined,
  heimTeamId: string | null | undefined,
  gastTeamId: string | null | undefined,
  spieltag: string | number | null | undefined,
): ArenaKulisseAuswahl | null {
  const liste = KULISSEN_NAMEN[disziplin];
  if (!Array.isArray(liste) || liste.length === 0) return null;
  const schluessel = baueKulisseSchluessel(disziplin, saat, heimTeamId, gastTeamId, spieltag);
  const gewaehlt = liste[kulisseHash(schluessel) % liste.length]!;
  return { disziplin, id: gewaehlt.id, label: gewaehlt.label };
}

/**
 * Komfort-Variante für den Spielplan: zieht Heim-/Gast-ID und die Saat aus einem bestehenden
 * Fixture, über denselben Weg, den `resolveArenaHostSeeds()` (`arena-host-seed.ts`) schon für
 * `seedByDisciplineId` nimmt -- `buildArenaMatchSeed()` + `seedZuZahl()`, keine neue
 * Saat-Konvention. `spieltag` ist bewusst ein eigener Parameter statt aus dem Fixture erraten:
 * die Kulissenwahl im Motor hängt an der NUMERISCHEN `meta.spieltag` (`Season.currentMatchday`),
 * nicht an `fixture.matchdayId` (eine andere, textuelle ID) -- s. `gebuchteSaatFuerAktuelleDisziplin()`
 * im Motor. Für die Buchung selbst (dieselbe Kulisse, egal wer zuschaut) reicht trotzdem
 * `fixture.matchdayId` als Teil der Saat, exakt wie bei `seedByDisciplineId`.
 */
export function waehleKulisseFuerFixture(input: {
  disciplineId: string;
  saveId: string;
  seasonId: string;
  spieltag: string | number | null | undefined;
  fixture: Pick<Fixture, "homeTeamId" | "awayTeamId" | "matchdayId">;
}): ArenaKulisseAuswahl | null {
  const saat = seedZuZahl(
    buildArenaMatchSeed({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.fixture.matchdayId,
      disciplineId: input.disciplineId,
      homeTeamId: input.fixture.homeTeamId,
      awayTeamId: input.fixture.awayTeamId,
    }),
  );
  return waehleKulisse(input.disciplineId, saat, input.fixture.homeTeamId, input.fixture.awayTeamId, input.spieltag);
}

/**
 * Baut das Bootstrap-Feld `kulisseByDisciplineId` für ein ganzes Duell (alle Disziplinen eines
 * Spieltags) -- der Motor liest es, wenn gesetzt, und fällt sonst auf seinen eigenen Hash
 * zurück (s. `kulisseWaehlen()`-Kommentar dort). Nur die `id` wandert in den Umschlag; Label/
 * Bildpfad bleiben beim Motor, der seine eigene `KULISSEN`-Liste ohnehin schon kennt --
 * "kein Effekt ohne Bild" bleibt damit beim Motor, nicht bei dieser Buchung.
 */
export function buildKulisseByDisciplineId(input: {
  saveId: string;
  seasonId: string;
  spieltag: string | number | null | undefined;
  disciplineIds: readonly string[];
  fixture: Pick<Fixture, "homeTeamId" | "awayTeamId" | "matchdayId">;
}): Record<string, string> {
  const kulisseByDisciplineId: Record<string, string> = {};
  for (const disciplineId of input.disciplineIds) {
    const auswahl = waehleKulisseFuerFixture({
      disciplineId,
      saveId: input.saveId,
      seasonId: input.seasonId,
      spieltag: input.spieltag,
      fixture: input.fixture,
    });
    if (auswahl) kulisseByDisciplineId[disciplineId] = auswahl.id;
  }
  return kulisseByDisciplineId;
}
