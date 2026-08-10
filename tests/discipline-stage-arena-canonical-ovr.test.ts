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
 * wenn keine da ist (z. B. `dev-arena` ohne Shell-Kontext). Diese Suite hält beide
 * Seiten fest: den (weiterhin reproduzierbaren) Fehler bei rein lokaler Rechnung, und
 * dass die tatsächlich verdrahteten Codepfade (buildPlayerDrawerDataFromGameState mit
 * `liveRatingsById`, dieselbe Priorisierung wie in TeamBody/Arena) ihn beheben.
 */

/**
 * DIE FIXTURE DIESER SUITE LIEGT NICHT MEHR IM REPO.
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
const FIXTURE_FILE = "fresh-season-1-1785739623457.json.gz";
const FIXTURE_PATH = join(REPO_ROOT, "data/online-saves", FIXTURE_FILE);
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

const examplePlayerId = !FIXTURE_VORHANDEN
  ? undefined
  : Array.from(new Set((fullGameState.rosters ?? []).map((r) => r.playerId).filter(Boolean))).find((pid) => {
  const canonical = canonicalRatingByPlayerId.get(pid)?.ovrNormalized;
  const compact = buildPlayerRatingContractMap(compactGameState).get(pid)?.ovrNormalized;
  return canonical != null && compact != null && Math.abs(canonical - compact) > 5;
});

describe.skipIf(!FIXTURE_VORHANDEN)("Diszi-Bühne: kanonische Saison-OVR statt lokaler Neuberechnung auf dem kompakten Payload", () => {
  it("fixture hat echte, vom kompakten Payload gestrichene Spieltags-Historie", () => {
    expect(completedMatchdayResultCount).toBeGreaterThan(0);
    expect(compactGameState.seasonState.matchdayResults ?? []).toHaveLength(
      (fullGameState.seasonState.matchdayResults ?? []).filter((r) => r.matchdayId === activeMatchdayId).length,
    );
    expect(examplePlayerId).toBeTruthy();
  });

  it("VORHER (reproduziert den gemeldeten Fehler): rein lokale Rechnung auf dem kompakten Payload weicht von der kanonischen OVR ab", () => {
    // Das ist exakt der Aufruf, den die Bühne vor dem Fix für JEDEN Aufbau nutzte:
    // `buildPlayerRatingContractMap(gameState)` ohne jede kanonische Quelle daneben.
    const localOnlyRatingByPlayerId = buildPlayerRatingContractMap(compactGameState);
    const canonical = canonicalRatingByPlayerId.get(examplePlayerId!)?.ovrNormalized;
    const localOnly = localOnlyRatingByPlayerId.get(examplePlayerId!)?.ovrNormalized;

    expect(canonical).not.toBeNull();
    expect(localOnly).not.toBeNull();
    expect(localOnly).not.toBe(canonical);
    expect(Math.abs((localOnly ?? 0) - (canonical ?? 0))).toBeGreaterThan(5);
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

  it("PlayerBody-Codepfad (buildPlayerDrawerDataFromGameState): ohne liveRatingsById falsch, mit liveRatingsById kanonisch — auf demselben kompakten Payload", () => {
    const canonicalOvr = canonicalRatingByPlayerId.get(examplePlayerId!)?.ovrNormalized ?? null;
    expect(canonicalOvr).not.toBeNull();

    const withoutFix = buildPlayerDrawerDataFromGameState({
      gameState: compactGameState,
      playerId: examplePlayerId!,
      source: "sqlite",
    });
    expect(withoutFix?.ovr).not.toBe(canonicalOvr);

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
