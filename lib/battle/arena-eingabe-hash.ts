import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaTeam } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { buildArenaAufstellung, buildArenaAufstellungBeide } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import { findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";
import { buildArenaMatchSeed, buildMiniDmFfaPodMatchSeed } from "@/lib/battle/arena-seed";
import { getMiniDmPodsForMatchday } from "@/lib/season/mini-dm-pod-schedule";

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

/**
 * MINI-DM-FFA-EINGABE-HASH (PR 5 des 6-PR-Opus-Plans 21.10., "Vorlauf-Verdrahtung"). Eigene
 * Funktion statt `berechneArenaEingabeHash()` fuer `disciplineId === MINI_DM_DISCIPLINE_ID`: ein
 * Mini-DM-Pod ist KEIN `findeSpieltagsFixtures()`-Zweier-Duell (vier Teams, s.
 * `lib/season/mini-dm-pod-schedule.ts`) — die generische Funktion fuende dafuer keine (oder die
 * falschen) Fixtures und bliebe strukturell blind fuer `playerCount`/die k-Rollen-Aufstellung.
 *
 * DECKT (Opus-Auflage B2 analog, hier um `playerCount` erweitert, s. Kommentar an
 * `berechneArenaEingabeHash()` oben fuer die volle Begruendung des Musters):
 *   - jeden Pod-Seed (`buildMiniDmFfaPodMatchSeed()`);
 *   - den vollen Kader UND die volle Teilaufstellung ALLER VIER Pod-Teams (nicht nur zweier Seiten);
 *   - `playerCount` (k = 2..6) SELBST — ohne dieses Feld wuerde ein Kadergroessenwechsel
 *     zwischen zwei Spieltagen mit sonst identischer Aufstellung (seltener, aber moeglich bei
 *     einem erneuten Saison-Wurf) denselben Hash liefern und eine veraltete Vorberechnung faelschlich
 *     als noch gueltig buchen (CLAUDE.md-Pflichtpruefung, Opus-Plan Punkt 4: "k UND die vollstaendige
 *     k-Rollen-Aufstellung mit einbeziehen, sonst kollidieren Cache-Eintraege zwischen verschiedenen
 *     Kadergroessen");
 *   - denselben Motor-Datei-Hash wie oben (derselbe Deploy-Schutz).
 *
 * Faellt (wie `berechneArenaEingabeHash()`) niemals auf `null` zurueck, selbst wenn an diesem
 * Spieltag gar kein Mini-DM-Pod (mehr) steht (`teile` bleibt dann leer) — derselbe Fall wie ein
 * Spieltag ohne Fixtures fuer die generische Funktion oben: ein leerer, aber wohldefinierter Hash,
 * kein Sonderfall fuer den Aufrufer.
 */
export function berechneMiniDmFfaEingabeHash(input: {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  playerCount: number | null;
  mutatoren: readonly string[];
}): string {
  const pods = getMiniDmPodsForMatchday(input.gameState, input.matchdayId, { saveId: input.saveId });
  const teile: string[] = [];
  for (const pod of [...pods].sort((left, right) => left.id.localeCompare(right.id))) {
    const seed = buildMiniDmFfaPodMatchSeed({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      podId: pod.id,
    });
    const kaderJeTeam = pod.teamIds.map((teamId) => buildArenaTeam(input.gameState, teamId));
    const aufstellungJeTeam = pod.teamIds.map((teamId) => buildArenaAufstellung(input.gameState, teamId, input.matchdayId));
    teile.push(JSON.stringify({ podId: pod.id, seed, kaderJeTeam, aufstellungJeTeam }));
  }
  const mutatoren = [...input.mutatoren].map((trait) => String(trait).trim()).filter(Boolean).sort();

  return createHash("sha256")
    .update(
      JSON.stringify({
        disciplineId: "mini-dm",
        playerCount: input.playerCount,
        teile,
        mutatoren,
        motorHash: leseMotorDateiHash(),
      }),
    )
    .digest("hex");
}
