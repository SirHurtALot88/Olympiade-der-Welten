import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import { buildPlayerRatingContractMap, type PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import { buildPlayerDrawerDataFromGameState } from "@/lib/foundation/player-detail-drawer";

/**
 * Bug 2026-08-04 (bug-2026-08-04T18-24-56-441Z-ubsbt6): "Die OVR die in der Diszi
 * angezeigt werden [...] beziehen sich immernoch auf die Diszi bzw den spieltag [...]
 * es gibt keine spieltag OVR sondern nur die aus ALLEN spieltagen die überall
 * ausgewiesen wird."
 *
 * GEMESSENE URSACHE: Die Disziplin-Bühne (DisciplineStageArena.tsx) und ihre Spieler-/
 * Team-Karte (DisciplineStageDrawer.tsx) rechneten OVR/Rang bislang IMMER lokal aus
 * `gameState` — dem KOMPAKTEN Client-Payload (`compactFoundationInitialGameState`),
 * der `seasonState.matchdayResults`/`disciplineResults` auf den AKTIVEN Spieltag
 * beschneidet und `persistedSeasonDerivations` ganz streicht (siehe
 * docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md). Das ergibt keine leere, sondern eine
 * PLAUSIBLE FALSCHE Saison-OVR — auf einem echten Spielstand (Saison 1, 5 von 10
 * Spieltagen gespielt) 81,61 statt der kanonischen 58,87 für denselben Spieler,
 * denselben Wert, den Kader/Spielerprofil/Ranglisten zeigen (dort läuft die Berechnung
 * serverseitig gegen den VOLLEN Save, `/api/season/ratings-slice`).
 *
 * Fix: Arena und Drawer bevorzugen jetzt eine durchgereichte kanonische Rating-Map
 * (`canonicalRatingByPlayerId` / `ratingByPlayerId`) und rechnen nur noch lokal nach,
 * wenn keine da ist (z. B. `dev-arena` ohne Shell-Kontext).
 *
 * SEITHER hat sich die eine Hälfte der Aussage gedreht. Die Beschneidung von
 * `matchdayResults`/`disciplineResults` ist ersatzlos entfallen (Herleitung samt
 * Messung in `compactFoundationInitialGameState`), und damit ist die Ursache dieser
 * Meldung an der Wurzel weg: auf genau dieser Fixture gemessen weicht die rein lokale
 * Rechnung auf dem kompakten Payload für KEINEN der 348 Kaderspieler mehr von der
 * kanonischen OVR ab — größte Abweichung 0,0. Die Fälle, die früher „VORHER
 * (reproduziert den gemeldeten Fehler)" und „ohne liveRatingsById falsch" hießen,
 * prüfen deshalb unten die umgekehrte Aussage, mit denselben Werten.
 *
 * Was unverändert gilt und hier weiter festgehalten wird: die Verdrahtung. Die
 * kanonische Karte bleibt die bevorzugte Quelle (sie stammt vom vollen Save und ist
 * unabhängig davon richtig, was der Client-Payload gerade mitbringt), der lokale
 * Fallback bleibt defensiv erhalten, und beide Codepfade reichen sie tatsächlich durch.
 */

/**
 * DIE FIXTURE LIEGT WIEDER IM REPO — neu gebaut, nicht wiedergefunden.
 *
 * Chris: „arena ovr etc fixtures kannst du holen und bauen." Erzeugt ueber die vorhandene Kette,
 * jeder Schritt mit `--write` (ohne ihn tun sie nichts und melden trotzdem Erfolg):
 *
 *     npx tsx scripts/season1-autoprep-topup.ts --write
 *     npx tsx scripts/season1-autoprep.ts --write
 *     npx tsx scripts/season1-simulation-run.ts --write
 *
 * Der Stand traegt eine ECHTE Spieltags-Historie: 10 gewertete Spieltage, 640 Disziplin-Ergebnisse,
 * 2.549 Spieler-Leistungen, 398 Kaderzeilen. Genau das braucht die Suite — der kompakte Payload
 * muss etwas zu streichen haben.
 *
 * AUF DAS NOETIGE GEKUERZT, damit eine Testdatei keine 2,8 MB in die Historie traegt:
 *   • nur Kaderspieler (398 statt 2.984) — die Suite vergleicht ueber die Kaderspieler,
 *   • ohne `persistedSeasonDerivations` (5,9 MB roh): das ist ein CACHE, und diese Suite rechnet
 *     die Ableitungen ohnehin frisch (`buildPlayerRatingContractMap`).
 * Bleiben 1,55 MB gepackt.
 *
 * DIE ALTE LAGE, zum Verstaendnis, warum hier so viel Text steht:
 *
 * `fresh-season-1-1785739623457.json.gz` ist ein Auto-Export-Artefakt (Zeitstempel im Namen),
 * das einmal versehentlich eingecheckt und in Commit `cbbd6ce` wieder geloescht wurde. Seitdem
 * bricht diese Datei schon beim EINSAMMELN ab — der Ladeaufruf steht auf Modulebene, also
 * scheitert nicht ein Test, sondern die ganze Suite mit ENOENT.
 *
 * Sie laeuft jetzt nur noch, wenn die Fixture da ist, und meldet sonst sichtbar
 * „uebersprungen". Das ist ehrlicher als ein Dauerrot, das nichts ueber den Code aussagt.
 *
 * Warum nicht einfach eine neue Fixture erzeugen: Die Suite braucht einen Spielstand mit
 * ECHTER Spieltags-Historie (der kompakte Payload muss etwas zu streichen haben) UND einem
 * Spieler, dessen lokal nachgerechnetes OVR um mehr als 5 Punkte vom kanonischen abweicht.
 * Das laesst sich nicht aus dem Stand konstruieren, sondern faellt in einem gelaufenen Save an.
 * Wer die Suite dauerhaft zurueckhaben will, legt einen solchen Save unter dem Namen unten ab.
 */
const REPO_ROOT = process.cwd();
const FIXTURE_FILE = "arena-season1-save.json.gz";
const FIXTURE_PATH = join(REPO_ROOT, "tests/_fixtures/season1-regression", FIXTURE_FILE);
const FIXTURE_VORHANDEN = existsSync(FIXTURE_PATH);

function loadFixtureGameState(): GameState {
  const raw = gunzipSync(readFileSync(FIXTURE_PATH)).toString("utf8");
  const parsed = JSON.parse(raw) as { gameState?: GameState } | GameState;
  return ("gameState" in parsed ? parsed.gameState : parsed) as GameState;
}

// Ohne Fixture wird hier NICHTS geladen und nichts gerechnet — die Suite darunter ist
// uebersprungen, die Platzhalter werden nie angefasst.
const fullGameState = FIXTURE_VORHANDEN ? loadFixtureGameState() : ({} as GameState);
const compactGameState = FIXTURE_VORHANDEN
  ? compactFoundationInitialGameState(fullGameState)
  : ({} as GameState);

// Sanity: die Fixture hat tatsächlich Saison-Historie, die der kompakte Payload streicht
// (sonst würde diese Suite gar nichts Aussagekräftiges messen).
const activeMatchdayId = FIXTURE_VORHANDEN ? fullGameState.matchdayState.matchdayId : null;
const completedMatchdayResultCount = FIXTURE_VORHANDEN
  ? (fullGameState.seasonState.matchdayResults ?? []).filter((r) => r.matchdayId !== activeMatchdayId).length
  : 0;

// Kanonische Ratings: buildPlayerRatingContractMap auf dem VOLLEN Save — exakt das, was
// der Server für `/api/season/ratings-slice` rechnet (getSeasonDerivations ->
// computeSeasonDerivationsFresh -> buildPlayerRatingContractMap(gameState, ledger)), und
// damit dieselbe Zahl, die Kader/Spielerprofil/Ranglisten anzeigen.
const canonicalRatingByPlayerId = FIXTURE_VORHANDEN
  ? buildPlayerRatingContractMap(fullGameState)
  : new Map<string, PlayerRatingContractRow>();

/** Alle Kaderspieler der Fixture — die Grundmenge, ueber die unten verglichen wird. */
const rosterPlayerIds = FIXTURE_VORHANDEN
  ? Array.from(new Set((fullGameState.rosters ?? []).map((r) => r.playerId).filter(Boolean)))
  : [];

/**
 * FRUEHER WURDE HIER GESUCHT: ein Spieler, dessen lokal auf dem kompakten Payload
 * nachgerechnete OVR um mehr als 5 Punkte von der kanonischen abwich — das Gegenbeispiel,
 * um das diese Suite gebaut war. Seit die Beschneidung entfallen ist, gibt es keinen
 * solchen Spieler mehr (Abweichung 0,0 bei allen 348), die Suche lieferte `undefined` und
 * riss jeden Fall mit sich, der sie benutzte.
 *
 * Stattdessen ein deterministischer Vertreter: der erste Kaderspieler mit kanonischer OVR.
 * Die Suite prueft ihre Aussage ohnehin unten ueber ALLE Kaderspieler, nicht nur ueber ihn.
 */
const examplePlayerId = rosterPlayerIds.find(
  (pid) => canonicalRatingByPlayerId.get(pid)?.ovrNormalized != null,
);

describe.skipIf(!FIXTURE_VORHANDEN)("Diszi-Bühne: kanonische Saison-OVR statt lokaler Neuberechnung auf dem kompakten Payload", () => {
  it("fixture hat echte Spieltags-Historie — und der kompakte Payload traegt sie vollstaendig", () => {
    // FRUEHER STAND HIER: der kompakte Payload behalte nur die Verzeichniszeile des aktiven
    // Spieltags. Beide Beschneidungen sind entfallen, also faehrt die Historie mit.
    expect(completedMatchdayResultCount).toBeGreaterThan(0);
    expect(compactGameState.seasonState.matchdayResults ?? []).toHaveLength(
      (fullGameState.seasonState.matchdayResults ?? []).length,
    );
    expect(compactGameState.seasonState.disciplineResults ?? []).toHaveLength(
      (fullGameState.seasonState.disciplineResults ?? []).length,
    );
    expect(examplePlayerId).toBeTruthy();

    // Ein kompakter Payload ist er trotzdem — der Berg bleibt weg, und genau deshalb ist die
    // kanonische Karte weiter die bevorzugte Quelle.
    expect(compactGameState.seasonState.persistedSeasonDerivations).toBeUndefined();
    // `playerBaselines` fahren seit dem Audit vom 11.08. SCHLANK mit statt gar nicht: der
    // Wirtschaftsbezug wird von der Marktwert-Anzeige gebraucht (ohne ihn zeigte sie fuer 498
    // von 540 gepruefte Spieler eine andere Zahl), die Attribute nicht.
    expect(compactGameState.playerBaselines?.length).toBe(fullGameState.playerBaselines?.length);
    expect((compactGameState.playerBaselines?.[0] as Record<string, unknown> | undefined)?.attributes).toBeUndefined();
  });

  it("die rein lokale Rechnung auf dem kompakten Payload trifft die kanonische OVR — bei JEDEM Kaderspieler", () => {
    /**
     * FRUEHER HIESS DIESER FALL „VORHER (reproduziert den gemeldeten Fehler)" und verlangte
     * eine Abweichung von MEHR ALS 5 Punkten: auf einem echten Spielstand 81,61 statt der
     * kanonischen 58,87 fuer denselben Spieler. Zustande kam sie, weil
     * `buildPlayerRatingContractMap` den Saison-Ledger aus `matchdayResults`/
     * `disciplineResults` neu rechnet und im Browser nur den aktiven Spieltag davon sah.
     *
     * Beides faehrt jetzt vollstaendig mit, also ist die Abweichung weg — nicht kleiner,
     * sondern null. Das ist die Aussage, die etwas wert ist, und sie wird ueber ALLE
     * Kaderspieler geprueft statt ueber ein einzelnes Gegenbeispiel.
     */
    const localOnlyRatingByPlayerId = buildPlayerRatingContractMap(compactGameState);

    let verglichen = 0;
    let groessteAbweichung = 0;
    for (const playerId of rosterPlayerIds) {
      const canonical = canonicalRatingByPlayerId.get(playerId)?.ovrNormalized;
      const localOnly = localOnlyRatingByPlayerId.get(playerId)?.ovrNormalized;
      if (canonical == null || localOnly == null) continue;
      verglichen += 1;
      groessteAbweichung = Math.max(groessteAbweichung, Math.abs(canonical - localOnly));
    }

    // Die Fixture muss ueberhaupt genug Spieler hergeben, sonst misst der Fall nichts.
    expect(verglichen).toBeGreaterThan(100);
    expect(groessteAbweichung).toBe(0);
  });

  it("NACHHER: die Arena-Priorisierung (kanonische Karte vor lokaler Rechnung) liefert dieselbe OVR wie Kader/Spielerprofil", () => {
    // Dieselbe Auswahl-Logik wie in DisciplineStageArena.tsx (ratingByPlayerId-Memo) und
    // DisciplineStageDrawer.tsx (TeamBody): kanonische Map bevorzugt, lokaler Fallback nur
    // wenn sie fehlt/leer ist.
    function resolveRatingByPlayerId(
      gameState: GameState,
      canonical: Map<string, PlayerRatingContractRow> | null | undefined,
    ): Map<string, PlayerRatingContractRow> {
      if (canonical && canonical.size > 0) {
        return canonical;
      }
      return buildPlayerRatingContractMap(gameState);
    }

    const ratingByPlayerId = resolveRatingByPlayerId(compactGameState, canonicalRatingByPlayerId);
    expect(ratingByPlayerId.get(examplePlayerId!)?.ovrNormalized).toBe(
      canonicalRatingByPlayerId.get(examplePlayerId!)?.ovrNormalized,
    );

    // Ohne kanonische Karte (z. B. dev-arena ohne Shell-Kontext) bleibt der defensive
    // lokale Fallback erhalten — das Verhalten ändert sich dort bewusst NICHT.
    const fallbackOnly = resolveRatingByPlayerId(compactGameState, null);
    expect(fallbackOnly.get(examplePlayerId!)?.ovrNormalized).toBe(
      buildPlayerRatingContractMap(compactGameState).get(examplePlayerId!)?.ovrNormalized,
    );
  });

  it("DisciplineStageDrawer.tsx: PlayerBody reicht die kanonische Karte tatsächlich als liveRatingsById durch", () => {
    const drawerSource = readFileSync(
      join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageDrawer.tsx"),
      "utf8",
    );
    expect(drawerSource).toContain("liveRatingsById: ratingByPlayerId ?? null,");
  });

  it("PlayerBody-Codepfad (buildPlayerDrawerDataFromGameState): mit liveRatingsById kanonisch — und ohne inzwischen ebenso", () => {
    // FRUEHER STAND HIER `expect(withoutFix?.ovr).not.toBe(canonicalOvr)`: ohne die
    // durchgereichte Karte rechnete der PlayerBody lokal auf dem beschnittenen Payload und
    // landete daneben. Der Payload ist nicht mehr beschnitten, also trifft auch der lokale
    // Weg die kanonische Zahl. Die Durchreichung bleibt trotzdem der verdrahtete Weg — sie
    // ist unabhaengig davon richtig, was der Payload gerade mitbringt.
    const canonicalOvr = canonicalRatingByPlayerId.get(examplePlayerId!)?.ovrNormalized ?? null;
    expect(canonicalOvr).not.toBeNull();

    const withoutFix = buildPlayerDrawerDataFromGameState({
      gameState: compactGameState,
      playerId: examplePlayerId!,
      source: "sqlite",
    });
    expect(withoutFix?.ovr).toBe(canonicalOvr);

    const withFix = buildPlayerDrawerDataFromGameState({
      gameState: compactGameState,
      playerId: examplePlayerId!,
      source: "sqlite",
      liveRatingsById: canonicalRatingByPlayerId,
    });
    expect(withFix?.ovr).toBe(canonicalOvr);
  });

  it("DisciplineStageArena.tsx: ratingByPlayerId bevorzugt canonicalRatingByPlayerId vor der lokalen Rechnung", () => {
    const arenaSource = readFileSync(
      join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageArena.tsx"),
      "utf8",
    );
    expect(arenaSource).toContain(
      "if (canonicalRatingByPlayerId && canonicalRatingByPlayerId.size > 0) {\n      return canonicalRatingByPlayerId;\n    }",
    );
  });

  it("use-foundation-shell-router-body-scope.tsx: matchdayArena löst jetzt den Ratings-Slice-Fetch aus", () => {
    const scopeSource = readFileSync(
      join(REPO_ROOT, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
      "utf8",
    );
    expect(scopeSource).toContain('activeView === "matchdayArena";');
  });

  it("FoundationShellRouterBody.tsx: reicht playerRatingsById als canonicalRatingByPlayerId an die Bühne durch", () => {
    const bodySource = readFileSync(join(REPO_ROOT, "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
    expect(bodySource).toContain("canonicalRatingByPlayerId={playerRatingsById}");
  });
});
