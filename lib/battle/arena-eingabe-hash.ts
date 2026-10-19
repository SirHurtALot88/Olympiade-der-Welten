import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaTeam } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { buildArenaAufstellungBeide } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import { findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";
import { buildArenaMatchSeed } from "@/lib/battle/arena-seed";

/**
 * OPUS-AUFLAGE B2 (`docs/design/battle-arena-auto-run-anbindung-plan-16-10.md` Abschnitt 9,
 * Punkt 2; Plan Abschnitt 5.2 "Eingabe-Fingerabdruck fehlt"): EIN Fingerabdruck ueber ALLES, was
 * ein Arena-Duell dieser Disziplin dieses Spieltags tatsaechlich bestimmt — nicht nur die
 * Aufstellungs-Signatur des Snapshots (`buildMatchdayResolveSignature`, die nur Slots/Formkarten/
 * Verfuegbarkeit deckt, s. dortiger Kommentar), sondern zusaetzlich:
 *
 *   - die Saat jedes Fixtures dieser Disziplin (`buildArenaMatchSeed`) — deckt Formkarten
 *     (seit 15.10. in die Saat gekoppelt) UND den Mutator-Wurf implizit mit ab, weil beide in den
 *     ECHTEN Kader/Aufstellungs-Daten unten landen, nicht weil der String selbst sie enthaelt;
 *   - den vollen Kader BEIDER Seiten jedes Fixtures (`buildArenaTeam`) — Attribute, Form,
 *     Trait-Zuschlaege;
 *   - die Teilaufstellung beider Seiten (`buildArenaAufstellungBeide`) — Slot-Zuordnung je Spieler;
 *   - den ECHTEN Spieltagswurf der Mutatoren (`mutatoren`, vom Aufrufer uebergeben — der Vorlauf
 *     zieht ihn ohnehin schon fuer `runBattleModeArenaMatchday()`, s. dort);
 *   - einen Hash der Motor-Dateien selbst (`battle-mode.engine.js`/`battle-mode.rezepte.js`), weil
 *     ein Deploy zwischen Vorlauf und Buchung die Rechenvorschrift aendern koennte.
 *
 * Wird VOM VORLAUF beim Start/Ende gespeichert (`ArenaVorlaufDisziplinEintrag.eingabeHash`) UND
 * ERNEUT von `resolveMatchdayPreviewToBook()` (`lib/foundation/matchday-resolve-snapshot.ts`) beim
 * Buchen berechnet — weicht er ab, wird die Vorberechnung fuer diesen Spieltag NICHT gebucht
 * (Plan Abschnitt 9, Punkt 2: "nicht nur diagnostisch speichern"). Rein lesend, keine
 * Seiteneffekte, kein Playwright-Import -- importierbar ueberall, wo `GameState` schon bekannt ist.
 */

let motorDateiHashCache: string | null = null;

function leseMotorDateiHash(): string {
  if (motorDateiHashCache) return motorDateiHashCache;
  const hash = createHash("sha256");
  for (const datei of ["battle-mode.engine.js", "battle-mode.rezepte.js"]) {
    const dateiPfad = path.resolve(process.cwd(), "public", "mockups", datei);
    if (existsSync(dateiPfad)) {
      hash.update(readFileSync(dateiPfad));
    } else {
      hash.update(`fehlt:${datei}`);
    }
  }
  motorDateiHashCache = hash.digest("hex");
  return motorDateiHashCache;
}

export function berechneArenaEingabeHash(input: {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  disciplineId: string;
  mutatoren: readonly string[];
}): string {
  const fixtures = findeSpieltagsFixtures(input.gameState, input.matchdayId);
  const teile: string[] = [];
  for (const fixture of [...fixtures].sort((left, right) =>
    `${left.homeTeamId}:${left.awayTeamId}`.localeCompare(`${right.homeTeamId}:${right.awayTeamId}`),
  )) {
    const seed = buildArenaMatchSeed({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      disciplineId: input.disciplineId,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
    });
    const heim = buildArenaTeam(input.gameState, fixture.homeTeamId);
    const gast = buildArenaTeam(input.gameState, fixture.awayTeamId);
    const aufstellung = buildArenaAufstellungBeide(input.gameState, fixture.homeTeamId, fixture.awayTeamId, input.matchdayId);
    teile.push(JSON.stringify({ seed, heim, gast, aufstellung }));
  }
  const mutatoren = [...input.mutatoren].map((trait) => String(trait).trim()).filter(Boolean).sort();

  return createHash("sha256")
    .update(JSON.stringify({ disciplineId: input.disciplineId, teile, mutatoren, motorHash: leseMotorDateiHash() }))
    .digest("hex");
}
