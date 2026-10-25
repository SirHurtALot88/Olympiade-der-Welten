import type { ArenaVorlaufDisziplinEintrag, ArenaVorlaufRecord, ArenaVorlaufStatus, GameState } from "@/lib/data/olyDataTypes";
import { loadAllLocalLegacyLineupContexts } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { resolveMatchdayMutatorTraitsForDiscipline } from "@/lib/lineups/legacy-lineup-modifiers";
import {
  ARENA_RESOLVED_DISCIPLINE_IDS,
  runBattleModeArenaMatchday,
  type ArenaTeamPointsOverride,
} from "@/lib/resolve/battle-mode-arena-team-points";
import type { ArenaAusfall, ArenaAusfallGrund } from "@/lib/resolve/legacy-matchday-resolve-types";
import type { runArenaFixtures, RunArenaFixturesOptions, runMiniDmFfaPodFixtures, RunMiniDmFfaPodFixturesOptions } from "@/lib/battle/arena-headless-runner";
import { berechneArenaEingabeHash, berechneMiniDmFfaEingabeHash } from "@/lib/battle/arena-eingabe-hash";
import { MINI_DM_FFA_VORLAUF_AKTIV } from "@/lib/battle/arena-resolved-disciplines";

import { MINI_DM_DISCIPLINE_ID } from "@/lib/season/season-discipline-schedule";
import {
  runMiniDmFfaMatchday,
  resolveMiniDmFfaPlayerCountForMatchday,
} from "@/lib/resolve/mini-dm-ffa-matchday";
import type { MiniDmFfaPodRohdaten } from "@/lib/resolve/mini-dm-pod-resolve";
import { isBattleModeSave } from "@/lib/season/game-mode";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { requireLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import type { PersistenceService } from "@/lib/persistence/types";
import {
  beginArenaVorlauf,
  buildMatchdayResolveSignature,
  ensureMatchdayResolveSnapshot,
  finishArenaVorlauf,
  readArenaVorlaufRecord,
  writeMatchdayResolveSnapshot,
  type MatchdayResolveScope,
} from "@/lib/foundation/matchday-resolve-snapshot";
import { mitChromiumSemaphor } from "@/lib/battle/arena-chromium-semaphor";

/**
 * ECHTER ROLLBACK-MECHANISMUS (OPUS-REVIEW, PR 5, Pflicht-Fix 8): `MINI_DM_FFA_VORLAUF_AKTIV`
 * (arena-resolved-disciplines.ts) ist eine reine Code-Konstante -- ein Abschalten braucht Commit +
 * CI + Deploy + Docker-Build, nicht "eine Zeile, kein Deploy-Wettlauf", wie der Kommentar dort es
 * behauptet. DIESE Datei ist bewusst der Ort fuer die Umgebungsvariable (nicht
 * arena-resolved-disciplines.ts): jene Datei ist client-importierbar (`FoundationBattleArenaHost.tsx`,
 * s. ihr eigener Kopfkommentar) und darf deshalb kein `process.env` lesen -- `arena-vorlauf-service.ts`
 * laeuft dagegen ausschliesslich serverseitig.
 *
 * `OLY_MINI_DM_FFA_VORLAUF=aus` auf dem Server (`deploy/hetzner/.env`, s. `.env.example` dort)
 * schaltet den Mini-DM-FFA-Vorlauf ab. **KORRIGIERT nach der zweiten Opus-Review-Runde (24.10.):**
 * ein blosser Container-NEUSTART reicht NICHT -- `docker-compose.yml` reicht die Variable per
 * `${OLY_MINI_DM_FFA_VORLAUF:-}`-Interpolation durch, und diese Interpolation liest Compose nur
 * beim ERSTELLEN/NEU-ERSTELLEN des Containers (`docker compose up -d`), nicht bei einem blossen
 * `docker restart` auf dem bereits laufenden Container (der behaelt die beim letzten `up`
 * eingefrorene Umgebung, `.env` wird dabei nicht neu gelesen). Auf dem Server also: Eintrag in
 * `deploy/hetzner/.env` setzen, dann `docker compose up -d` im Repo-Verzeichnis -- genau derselbe
 * Mechanismus wie beim Geschwister-Notschalter `OLY_ARENA_TIER_PARALLEL` (PR #1290,
 * battle-mode-arena-team-points.ts). Jeder andere Wert (inkl. fehlend/leer) laesst
 * `MINI_DM_FFA_VORLAUF_AKTIV` unveraendert wirken (Code-Konstante bleibt die Grundeinstellung).
 *
 * WICHTIG, UND DAS GEHOERT IN JEDE ROLLBACK-ENTSCHEIDUNG: das Abschalten wirkt nur VORWAERTS, auf
 * Spieltage, deren Vorlauf NACH dem `docker compose up -d` beginnt. Ein Mini-DM-Spieltag, dessen
 * Snapshot VOR dem Abschalten bereits mit `quelle: "ffa"` fertiggestellt wurde, bucht beim
 * Season-Finish WEITERHIN mit diesem bereits berechneten FFA-Ergebnis -- `kickoffArenaMatchdayApply`
 * liest den fertigen Snapshot, nicht den aktuellen Wert dieses Schalters. Das ist erwartbar
 * (derselbe Snapshot-vorher, buchen-nachher-Grundsatz wie bei jeder anderen Arena-Disziplin), aber
 * ausdruecklich festgehalten, damit niemand nach einem Abschalten einen bereits "ffa"-gebuchten
 * Spieltag als Bug meldet.
 */
function istMiniDmFfaVorlaufAktiv(): boolean {
  // Trim + Kleinschreibung, angeglichen an `resolveArenaTierParallelEnabled()`
  // (battle-mode-arena-team-points.ts) -- derselbe Normalisierungs-Stil fuer denselben "Server-
  // Notschalter"-Zweck.
  const raw = typeof process !== "undefined" ? process.env?.OLY_MINI_DM_FFA_VORLAUF?.trim().toLowerCase() : undefined;
  if (raw === "aus") {
    return false;
  }
  return MINI_DM_FFA_VORLAUF_AKTIV;
}

/**
 * ARENA-VORLAUF (PR 3, K1 — `docs/design/battle-arena-auto-run-anbindung-plan-16-10.md`
 * Abschnitt 2, insb. 2.2/2.6/2.7/5.2). DER EINE ORT, an dem ein Battle-Spieltag die Arena
 * tatsaechlich anwirft — Auto-Run (`matchday-auto-run-service.ts`), Kickoff
 * (`arena-matchday-resolve-service.ts`, ab PR 3 nur noch ein Mantel darum) und die
 * Lineup-/Arena-Base-Routen rufen alle hierher, statt je eine eigene Arena-Startlogik zu halten.
 *
 * GRUNDSATZ (Plan 2.1): der Vorlauf rechnet, SOBALD das Feld eines Spieltags steht — am Snapshot,
 * nicht beim Buchen. Die Buehne zeigt danach Arena-Zeilen, der Auto-Run bucht genau diesen
 * Snapshot. Im Buchungspfad startet dadurch kein Chromium mehr (`resolveMatchdayPreviewToBook()`
 * liest nur noch, s. `matchday-resolve-snapshot.ts`).
 */

export type ArenaModus = "hintergrund" | "inline" | "aus";

export type ArenaVorlaufKickoffErgebnis = {
  /** `false`: Manager Mode oder keine arena-aufgeloeste Disziplin an D1/D2 — der Aufrufer bucht wie bisher. */
  applicable: boolean;
  status: ArenaVorlaufStatus | null;
  record: ArenaVorlaufRecord | null;
};

/**
 * Timeout-Budget (Opus-Auflage, Plan Abschnitt 9 Punkt 1): per ENV konfigurierbar, Standard an der
 * `scripts/messe-arena-spieltag.ts`-Messung orientiert (Median 12,7s lokal, 4 Kerne — der hier
 * gewartete Teil ist NICHT die ganze Simulation, s. `arena-headless-runner.ts`s
 * `wartenAufMotor()`: er deckt nur das Laden/Neueinhaengen des Motors je Fixture ab, nicht das
 * synchrone `spieleFeldspiel()`/... selbst, das danach ohne eigenes Timeout rechnet). 20s Standard
 * x spaetestens auf dem CX23 (Faktor 1,5-2 laut Plan-Hochrechnung, dort noch nicht live gemessen)
 * ist knapp mehr als das geforderte 3x des lokalen Medians (12,7s) -- deshalb per ENV erhoehbar,
 * OHNE einen Deploy abzuwarten, bis die echte CX23-Zahl aus Abschnitt 6.3 vorliegt.
 */
export function resolveArenaSeitenTimeoutMs(): number {
  const raw = process.env.OLY_ARENA_SEITEN_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20_000;
}

/**
 * WELCHE arena-aufgeloesten Disziplinen (0, 1 oder 2, WEG B) an diesem Spieltag D1/D2 sind.
 * Verschoben aus `arena-matchday-resolve-service.ts` (dort bis PR 3 eine private Funktion) —
 * EINE Implementierung, jetzt von Vorlauf UND Kickoff-Mantel genutzt, statt einer zweiten Kopie.
 */
export function determineArenaDisciplineContexts(
  contextResults: ReturnType<typeof loadAllLocalLegacyLineupContexts>,
): {
  contexts: LegacyLineupLoadedContext[];
  arenaDisciplineIds: string[];
  mutatorTraitsByDisciplineId: Map<string, string[]>;
  /**
   * MINI-DM-FFA (PR 5 des 6-PR-Opus-Plans 21.10.): `true`, wenn Mini-DM an diesem Spieltag an D1
   * ODER D2 steht UND `MINI_DM_FFA_VORLAUF_AKTIV` an ist. ABSICHTLICH NICHT Teil von `kandidaten`/
   * `arenaDisciplineIds` -- Mini-DM hat keinen Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS` (eigener
   * Pod-Resolve-Pfad, kein Zweier-Duell-Chassis, s. Kommentar an `MINI_DM_FFA_VORLAUF_AKTIV`,
   * arena-resolved-disciplines.ts) und wuerde im generischen `runBattleModeArenaMatchday()`-Loop
   * (`fuehreVorlaufAus()` unten) falsch dispatcht. `false`, solange `MINI_DM_FFA_VORLAUF_AKTIV` aus
   * ist -- der Rollback-Schalter wirkt dadurch schon hier, nicht erst im Vorlauf selbst.
   */
  miniDmPresent: boolean;
} {
  const contexts = contextResults.flatMap((result) => (result.ok ? [result.context] : []));
  const kandidaten = new Set<string>();
  let miniDmPresent = false;
  for (const context of contexts) {
    const d1 = context.contextMeta.d1DisciplineId;
    const d2 = context.contextMeta.d2DisciplineId;
    if (d1 && ARENA_RESOLVED_DISCIPLINE_IDS.has(d1)) kandidaten.add(d1);
    if (d2 && ARENA_RESOLVED_DISCIPLINE_IDS.has(d2)) kandidaten.add(d2);
    if (istMiniDmFfaVorlaufAktiv() && (d1 === MINI_DM_DISCIPLINE_ID || d2 === MINI_DM_DISCIPLINE_ID)) {
      miniDmPresent = true;
    }
  }
  const mutatorTraitsByDisciplineId = new Map<string, string[]>();
  const basis = contexts[0];
  if (basis) {
    for (const disciplineId of kandidaten) {
      mutatorTraitsByDisciplineId.set(
        disciplineId,
        resolveMatchdayMutatorTraitsForDiscipline({
          saveId: basis.saveId,
          seasonId: basis.seasonId,
          matchdayId: basis.matchdayId,
          d1DisciplineId: basis.contextMeta.d1DisciplineId,
          d2DisciplineId: basis.contextMeta.d2DisciplineId,
          disciplineId,
        }) ?? [],
      );
    }
    if (miniDmPresent) {
      mutatorTraitsByDisciplineId.set(
        MINI_DM_DISCIPLINE_ID,
        resolveMatchdayMutatorTraitsForDiscipline({
          saveId: basis.saveId,
          seasonId: basis.seasonId,
          matchdayId: basis.matchdayId,
          d1DisciplineId: basis.contextMeta.d1DisciplineId,
          d2DisciplineId: basis.contextMeta.d2DisciplineId,
          disciplineId: MINI_DM_DISCIPLINE_ID,
        }) ?? [],
      );
    }
  }
  return { contexts, arenaDisciplineIds: [...kandidaten], mutatorTraitsByDisciplineId, miniDmPresent };
}

function ermittleAnwendbarkeit(persistence: PersistenceService, scope: MatchdayResolveScope) {
  const { save } = requireLocalPersistedSave(persistence, scope.saveId);
  if (!isBattleModeSave(save.gameState)) {
    return { applicable: false as const, gameState: save.gameState };
  }
  const contextResults = loadAllLocalLegacyLineupContexts(scope, persistence);
  const { arenaDisciplineIds, mutatorTraitsByDisciplineId, miniDmPresent } = determineArenaDisciplineContexts(contextResults);
  // MINI-DM-FFA (PR 5): ein Spieltag mit Mini-DM an D1/D2, aber OHNE jede andere arena-aufgeloeste
  // Disziplin, ist jetzt EBENFALLS anwendbar -- vorher (`arenaDisciplineIds.length === 0`) haette der
  // Vorlauf fuer einen solchen Spieltag nie angefangen, und `fuehreVorlaufAus()` haette den
  // Mini-DM-Zweig deshalb nie erreicht.
  if (arenaDisciplineIds.length === 0 && !miniDmPresent) {
    return { applicable: false as const, gameState: save.gameState };
  }
  return { applicable: true as const, gameState: save.gameState, arenaDisciplineIds, mutatorTraitsByDisciplineId, miniDmPresent };
}

/** Grob kategorisiert eine Fehlermeldung/Warnung in einen `ArenaAusfallGrund` (Plan Abschnitt 3.1). */
function leiteGrundAusText(text: string): ArenaAusfallGrund {
  const t = text.toLowerCase();
  if (t.includes("timeout") || t.includes("nicht rechtzeitig bereit")) return "timeout";
  if (t.includes("executable doesn't exist") || t.includes("failed to launch") || t.includes("econnrefused") || t.includes("enoent")) {
    return "chromium_start";
  }
  if (t.includes("closed") || t.includes("crash") || t.includes("disconnected") || t.includes("target")) return "absturz";
  return "absturz";
}

/**
 * Leitet aus den Warnungen von `runBattleModeArenaMatchday()` ab, ob (und warum) diese Disziplin
 * ganz oder teilweise ausgefallen ist. `null`, wenn kein Team ohne Arena-Ergebnis blieb.
 */
function ableiteArenaAusfall(warnings: string[], versuch: number): ArenaAusfall | null {
  if (warnings.length === 0) return null;
  const ligaFehlschlag = warnings.find((w) => w.startsWith("arena_matchday_league_failed:"));
  if (ligaFehlschlag) {
    const [, tier, ...rest] = ligaFehlschlag.split(":");
    const meldung = rest.join(":");
    return {
      grund: leiteGrundAusText(meldung),
      detail: meldung.slice(0, 200) || null,
      leagueTier: tier ?? null,
      zeitpunkt: new Date().toISOString(),
      versuch,
    };
  }
  const fehlendesErgebnis = warnings.find((w) => w.startsWith("arena_matchday_missing_result:"));
  if (fehlendesErgebnis) {
    const [, tier] = fehlendesErgebnis.split(":");
    return {
      grund: "ergebnis_unvollstaendig",
      detail: warnings.filter((w) => w.startsWith("arena_matchday_missing_result:")).join(", ").slice(0, 200),
      leagueTier: tier ?? null,
      zeitpunkt: new Date().toISOString(),
      versuch,
    };
  }
  return null;
}

type FuehreVorlaufAusInput = {
  persistence: PersistenceService;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  signature: string;
  arenaDisciplineIds: string[];
  mutatorTraitsByDisciplineId: Map<string, string[]>;
  versuch: number;
  startedAt: string;
  runArenaFixturesImpl?: typeof runArenaFixtures;
  runArenaFixturesOptions?: RunArenaFixturesOptions;
  /** MINI-DM-FFA (PR 5), s. `determineArenaDisciplineContexts()`. */
  miniDmPresent: boolean;
  runMiniDmFfaPodFixturesImpl?: typeof runMiniDmFfaPodFixtures;
  runMiniDmFfaPodFixturesOptions?: Omit<RunMiniDmFfaPodFixturesOptions, "k" | "mutatoren">;
};

/**
 * OPUS-REVIEW B1 (kritisch), NACHTRAG 18.10. (Design-Fix "Wiederholung gehoert in den Vorlauf
 * selbst"): GENAU EINE automatische Wiederholung je Disziplin (Plan Abschnitt 3.4) -- Versuch 1
 * scheitert, Versuch 2 (die automatische Wiederholung) darf SOFORT, noch INNERHALB desselben
 * `fuehreVorlaufAus()`-Laufs anlaufen. Scheitert AUCH die, ist diese Disziplin (und damit die
 * ganze Signatur) ENDGUELTIG `"failed"`, bevor ueberhaupt etwas geschrieben wird -- kein
 * dritter automatischer Versuch mehr, egal wie oft `kickoffArenaVorlauf()`/
 * `stelleArenaVorlaufSicher()` DANACH noch gerufen werden (Buehne pollt, Lineup-Routen,
 * Auto-Run): `duerfeNeuenVersuchStarten()` sieht ab dem Schreiben nur noch ein bereits
 * endgueltiges `"failed"`. OHNE diese Schranke startete jeder Aufruf bei kaputtem/fehlendem
 * Chromium einen neuen Versuch -- CPU-Sturm, UND der Auto-Run sah nie etwas anderes als
 * "in_progress"/"arena_vorlauf_laeuft" und buchte NIE, selbst die PPS-Duell-Bruecke nicht. Das war
 * schlimmer als die K1-Luecke selbst (die legte nur die Arena lahm, nicht den ganzen Spieltag).
 */
const MAX_AUTOMATISCHE_VERSUCHE = 2;

/**
 * NUR DIESE drei Gruende sind technische/Infrastruktur-Flackern, das ein sofortiger zweiter
 * Versuch plausibel beheben kann (kaputter Start, zu langsam, abgestuerzt). `ergebnis_unvollstaendig`
 * (ein Team ohne Duell-Ergebnis trotz erfolgreichem Lauf) ist dagegen ein DATENPROBLEM -- dieselbe
 * Eingabe wuerde beim Wiederholen deterministisch wieder dasselbe fehlende Ergebnis liefern, eine
 * Wiederholung waere verschwendete Zeit (und ein zweiter, unnoetiger Chromium-Lauf).
 */
const RETRYBARE_AUSFALL_GRUENDE: ReadonlySet<ArenaAusfallGrund> = new Set(["absturz", "timeout", "chromium_start"]);

async function fuehreVorlaufAus(input: FuehreVorlaufAusInput): Promise<ArenaVorlaufRecord | null> {
  const scope: MatchdayResolveScope = { saveId: input.saveId, seasonId: input.seasonId, matchdayId: input.matchdayId };
  const current = input.persistence.getSaveById(input.saveId);
  if (!current) {
    console.error(`[arena-vorlauf] Save ${input.saveId} nicht mehr gefunden.`);
    return null;
  }

  const disziplinen: Record<string, ArenaVorlaufDisziplinEintrag> = {};
  const arenaTeamPointsByDisciplineId = new Map<string, Map<string, ArenaTeamPointsOverride>>();
  const arenaIndividualBoxscorePpsByDisciplineId = new Map<string, Map<string, number>>();
  const arenaAusfallByDisciplineId = new Map<string, ArenaAusfall>();
  // MINI-DM-FFA (PR 5), s. Kommentar weiter unten an der eigentlichen Verwendung.
  const miniDmFfaPodRohdatenByDisciplineId = new Map<string, Map<string, MiniDmFfaPodRohdaten>>();
  let gesamtStatus: "ready" | "failed" = "ready";

  // SEQUENZIELL, NICHT PARALLEL (Plan 2.7/4.4) — D1 und D2 derselben Signatur laufen eins nach dem
  // anderen, und der globale Semaphor serialisiert zusaetzlich gegen JEDEN anderen Vorlauf im
  // Prozess (anderer Save, anderer Spieltag). Das gilt UNVERAENDERT nur fuer die DISZIPLINEN
  // selbst (D1 vs. D2) -- seit dem Latenz-Fix 18.10. laufen innerhalb EINER Disziplin (hier, unter
  // demselben gehaltenen Semaphor-Griff) ihre ZWEI Liga-Stufen gleichzeitig, nicht mehr
  // nacheinander (s. `runBattleModeArenaMatchday()`s Dateikopf-Kommentar in
  // `battle-mode-arena-team-points.ts`). D1/D2 bewusst weiter seriell gehalten: zwei Disziplinen
  // gleichzeitig waeren zusaetzlich zu den zwei parallelen Liga-Stufen bis zu VIER gleichzeitige
  // Chromium-Prozesse (~4 GB RSS, gemessen ~1 GB je Prozess lokal) -- auf dem CX23 (4 GB RAM) ein
  // reales OOM-Risiko, das die ZWEI-Browser-Parallelitaet (gemessen ~2 GB) nicht hat.
  for (const disziplinId of input.arenaDisciplineIds) {
    const gesamtStart = Date.now();
    // OPUS-REVIEW (Nachtrag 18.10., Design-Fix): die automatische Wiederholung bei einem
    // RETRYBAREN technischen Ausfall (`absturz`/`timeout`/`chromium_start` -- NICHT
    // `ergebnis_unvollstaendig`, das ist ein Datenproblem, kein Chromium-Flackern, und wuerde beim
    // Wiederholen deterministisch genauso wieder scheitern) passiert jetzt HIER, SOFORT, noch
    // UNTER DEMSELBEN Semaphor-Griff -- nicht mehr erst beim naechsten, externen Aufruf
    // (Buchung/Buehnen-Poll/Lineup-Speichern). Vorher persistierte ein erster Fehlschlag sofort
    // als `"failed"`, und irgendein SPAeTERER Aufrufer loeste den zweiten Versuch aus -- das liess
    // den Zustand fuer den Spieler flackern ("ausgefallen" -> kurz danach wieder "laeuft") UND
    // machte "failed" zweideutig (endgueltig ODER "gleich kommt noch ein Versuch", je nachdem WER
    // als naechstes fragt). Jetzt wird NUR NOCH das ENDGUELTIGE Ergebnis geschrieben -- "failed"
    // ist ab dem Schreiben immer terminal, kein Leser muss das Zwei-Zustaende-Raetsel mehr loesen.
    await mitChromiumSemaphor(async () => {
      let erfolg: { overridesByTeamId: Map<string, ArenaTeamPointsOverride>; individualBoxscorePpsByPlayerId: Map<string, number> } | null = null;
      let letzterAusfall: ArenaAusfall | null = null;
      let versucheIntern = 0;
      for (let lokalerVersuch = 1; lokalerVersuch <= MAX_AUTOMATISCHE_VERSUCHE; lokalerVersuch += 1) {
        versucheIntern = lokalerVersuch;
        try {
          const { overridesByTeamId, individualBoxscorePpsByPlayerId, warnings } = await runBattleModeArenaMatchday({
            gameState: current.gameState,
            saveId: input.saveId,
            seasonId: input.seasonId,
            matchdayId: input.matchdayId,
            disciplineId: disziplinId,
            runArenaFixturesImpl: input.runArenaFixturesImpl,
            matchdayMutatorTraits: input.mutatorTraitsByDisciplineId.get(disziplinId),
            // OPUS-REVIEW PR #1290: die automatische Wiederholung faehrt die Liga-Stufen SERIELL (ein
            // Browser zur Zeit). War Versuch 1 mit zwei gleichzeitigen Browsern zu schwer fuer den
            // Server (Absturz/Timeout unter Speicher- oder CPU-Druck), wuerde ein zweiter paralleler
            // Versuch genau daran wieder scheitern -- seriell ist der bewaehrte Pfad von vor dem
            // Latenz-Fix. Versuch 1 entscheidet `entscheideArenaTierParallel()` (ENV + RAM-Guard).
            tierParallel: lokalerVersuch === 1 ? undefined : false,
            // JEDER Versuch bekommt dasselbe volle Gesamt-Budget (Opus: "demselben Gesamt-Budget
            // je Versuch") -- keine Aufteilung eines gemeinsamen Budgets ueber beide Versuche.
            runArenaFixturesOptions: {
              seitenTimeoutMs: resolveArenaSeitenTimeoutMs(),
              ...input.runArenaFixturesOptions,
            },
          });
          const ausfall = ableiteArenaAusfall(warnings, lokalerVersuch);
          if (!ausfall) {
            erfolg = { overridesByTeamId, individualBoxscorePpsByPlayerId };
            letzterAusfall = null;
            break;
          }
          letzterAusfall = ausfall;
          if (!RETRYBARE_AUSFALL_GRUENDE.has(ausfall.grund) || lokalerVersuch >= MAX_AUTOMATISCHE_VERSUCHE) break;
          console.warn(
            `[arena-vorlauf] ${disziplinId} an ${input.matchdayId} (${input.saveId}) Versuch ${lokalerVersuch} ausgefallen (${ausfall.grund}) -- sofortige Wiederholung, noch nicht persistiert.`,
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const ausfall: ArenaAusfall = {
            grund: leiteGrundAusText(detail),
            detail: detail.slice(0, 200),
            zeitpunkt: new Date().toISOString(),
            versuch: lokalerVersuch,
          };
          letzterAusfall = ausfall;
          if (!RETRYBARE_AUSFALL_GRUENDE.has(ausfall.grund) || lokalerVersuch >= MAX_AUTOMATISCHE_VERSUCHE) {
            console.error(`[arena-vorlauf] ${disziplinId} an ${input.matchdayId} (${input.saveId}) endgueltig ausgefallen: ${detail}`);
            break;
          }
          console.warn(
            `[arena-vorlauf] ${disziplinId} an ${input.matchdayId} (${input.saveId}) Versuch ${lokalerVersuch} ausgefallen (${ausfall.grund}: ${detail}) -- sofortige Wiederholung, noch nicht persistiert.`,
          );
        }
      }

      if (erfolg) {
        arenaTeamPointsByDisciplineId.set(disziplinId, erfolg.overridesByTeamId);
        arenaIndividualBoxscorePpsByDisciplineId.set(disziplinId, erfolg.individualBoxscorePpsByPlayerId);
        const eingabeHash = berechneArenaEingabeHash({
          gameState: current.gameState,
          saveId: input.saveId,
          seasonId: input.seasonId,
          matchdayId: input.matchdayId,
          disciplineId: disziplinId,
          mutatoren: input.mutatorTraitsByDisciplineId.get(disziplinId) ?? [],
        });
        disziplinen[disziplinId] = { status: "arena", dauerMs: Date.now() - gesamtStart, eingabeHash, versucheIntern };
      } else {
        arenaAusfallByDisciplineId.set(disziplinId, letzterAusfall!);
        gesamtStatus = "failed";
        disziplinen[disziplinId] = { status: "ausgefallen", ausfall: letzterAusfall!, dauerMs: Date.now() - gesamtStart, versucheIntern };
      }
    });
  }

  // MINI-DM-FFA (PR 5 des 6-PR-Opus-Plans 21.10., "Vorlauf-Verdrahtung"). EIGENER Zweig statt eines
  // weiteren Eintrags in `input.arenaDisciplineIds` oben -- Mini-DM ist absichtlich NICHT in
  // `ARENA_RESOLVED_DISCIPLINE_IDS` (eigener Pod-Resolve-Pfad, vier Teams statt eines Zweier-Duells,
  // s. `MINI_DM_FFA_VORLAUF_AKTIV`-Kommentar, arena-resolved-disciplines.ts) und darf deshalb NIE den
  // generischen `runBattleModeArenaMatchday()`-Dispatch oben durchlaufen (der erwartet Fixtures).
  // GLEICHE Semaphor-/Wiederholungs-Disziplin wie oben (derselbe Chromium-Druck), aber ein eigener,
  // kleinerer Retry-Block, weil `runMiniDmFfaMatchday()` eine andere Rueckgabeform hat.
  //
  // FALLBACK (Opus-Plan Punkt 5, "PPS-Duell-Bruecke bleibt der Rueckfall"): ein Ausfall HIER setzt
  // `gesamtStatus = "failed"`, GENAU wie ein Ausfall im Loop oben -- das klingt dramatischer, als es
  // ist: `matchday-auto-run-service.ts` bucht einen `"failed"`-Vorlauf trotzdem (nur als `"warning"`
  // statt `"ready"`, s. dortiger `vorlaufErgebnis.status === "failed" ? "warning" : "ready"`), und
  // OHNE einen Eintrag in `miniDmFfaPodRohdatenByDisciplineId` faellt `berechneMiniDmPodOverrides()`
  // (PR 4, mini-dm-pod-resolve.ts) fuer JEDEN Mini-DM-Pod automatisch auf den unveraenderten
  // PPS-Pod-Pfad zurueck -- kein Spieltag bleibt wegen eines Mini-DM-FFA-Ausfalls ungebucht.
  if (input.miniDmPresent) {
    const gesamtStart = Date.now();
    await mitChromiumSemaphor(async () => {
      let erfolg: Awaited<ReturnType<typeof runMiniDmFfaMatchday>> | null = null;
      let letzterAusfall: ArenaAusfall | null = null;
      let versucheIntern = 0;
      for (let lokalerVersuch = 1; lokalerVersuch <= MAX_AUTOMATISCHE_VERSUCHE; lokalerVersuch += 1) {
        versucheIntern = lokalerVersuch;
        try {
          const ergebnis = await runMiniDmFfaMatchday({
            gameState: current.gameState,
            saveId: input.saveId,
            seasonId: input.seasonId,
            matchdayId: input.matchdayId,
            mutatorTraits: input.mutatorTraitsByDisciplineId.get(MINI_DM_DISCIPLINE_ID),
            runMiniDmFfaPodFixturesImpl: input.runMiniDmFfaPodFixturesImpl,
            runMiniDmFfaPodFixturesOptions: {
              seitenTimeoutMs: resolveArenaSeitenTimeoutMs(),
              ...input.runMiniDmFfaPodFixturesOptions,
            },
          });
          // `null`: kein Mini-DM-Pod (mehr) an diesem Spieltag ODER kein gueltiges k -- ein
          // DATENPROBLEM (derselbe Zustand liefert beim Wiederholen deterministisch wieder `null`),
          // kein Infrastruktur-Flackern. `rohdatenByPodId.size === 0` bei NICHT-leeren Pods ist
          // derselbe Fall wie `arena_matchday_missing_result` oben (jeder Pod ohne einsatzfaehigen
          // Kader) -- ebenfalls kein Retry.
          if (!ergebnis || ergebnis.rohdatenByPodId.size === 0) {
            letzterAusfall = {
              grund: "ergebnis_unvollstaendig",
              detail: ergebnis ? ergebnis.warnings.join(", ").slice(0, 200) || null : "kein Mini-DM-Pod oder ungueltiges k an diesem Spieltag",
              zeitpunkt: new Date().toISOString(),
              versuch: lokalerVersuch,
            };
            break;
          }
          erfolg = ergebnis;
          letzterAusfall = null;
          break;
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const ausfall: ArenaAusfall = {
            grund: leiteGrundAusText(detail),
            detail: detail.slice(0, 200),
            zeitpunkt: new Date().toISOString(),
            versuch: lokalerVersuch,
          };
          letzterAusfall = ausfall;
          if (!RETRYBARE_AUSFALL_GRUENDE.has(ausfall.grund) || lokalerVersuch >= MAX_AUTOMATISCHE_VERSUCHE) {
            console.error(`[arena-vorlauf] mini-dm-ffa an ${input.matchdayId} (${input.saveId}) endgueltig ausgefallen: ${detail}`);
            break;
          }
          console.warn(
            `[arena-vorlauf] mini-dm-ffa an ${input.matchdayId} (${input.saveId}) Versuch ${lokalerVersuch} ausgefallen (${ausfall.grund}: ${detail}) -- sofortige Wiederholung, noch nicht persistiert.`,
          );
        }
      }

      if (erfolg) {
        miniDmFfaPodRohdatenByDisciplineId.set(MINI_DM_DISCIPLINE_ID, erfolg.rohdatenByPodId);
        if (erfolg.playerPpsByPlayerId.size > 0) {
          arenaIndividualBoxscorePpsByDisciplineId.set(MINI_DM_DISCIPLINE_ID, erfolg.playerPpsByPlayerId);
        }
        const eingabeHash = berechneMiniDmFfaEingabeHash({
          gameState: current.gameState,
          saveId: input.saveId,
          seasonId: input.seasonId,
          matchdayId: input.matchdayId,
          playerCount: resolveMiniDmFfaPlayerCountForMatchday(current.gameState, input.matchdayId, { saveId: input.saveId }),
          mutatoren: input.mutatorTraitsByDisciplineId.get(MINI_DM_DISCIPLINE_ID) ?? [],
        });
        // OPUS-REVIEW, Pflicht-Fix 4: ein GESAMTERFOLG (mindestens ein Pod lieferte ein gueltiges
        // Ergebnis) hat trotzdem Teilwarnungen, wenn EINZELNE Pods wegen eines unvollstaendigen
        // Boxscores verworfen wurden (`pruefeMotorErgebnisVollstaendigkeit()`,
        // mini-dm-ffa-matchday.ts) -- die fielen vorher komplett unter den Tisch: nicht geloggt,
        // nicht persistiert, der betroffene Pod faellt nur still auf den PPS-Pfad zurueck.
        // Jetzt BEIDES: console.error (sofort sichtbar in den Server-Logs) UND persistiert in
        // `ArenaVorlaufDisziplinEintrag.teilwarnungen` (spaeter abfragbar, nicht nur ein Log-Zeitpunkt).
        if (erfolg.warnings.length > 0) {
          console.error(
            `[arena-vorlauf] mini-dm-ffa an ${input.matchdayId} (${input.saveId}) Gesamterfolg mit ${erfolg.warnings.length} Teilwarnung(en): ${erfolg.warnings.join(", ")}`,
          );
        }
        disziplinen[MINI_DM_DISCIPLINE_ID] = {
          status: "arena",
          dauerMs: Date.now() - gesamtStart,
          eingabeHash,
          versucheIntern,
          ...(erfolg.warnings.length > 0 ? { teilwarnungen: erfolg.warnings } : {}),
        };
      } else {
        arenaAusfallByDisciplineId.set(MINI_DM_DISCIPLINE_ID, letzterAusfall!);
        gesamtStatus = "failed";
        disziplinen[MINI_DM_DISCIPLINE_ID] = { status: "ausgefallen", ausfall: letzterAusfall!, dauerMs: Date.now() - gesamtStart, versucheIntern };
      }
    });
  }

  const { record } = finishArenaVorlauf(
    scope,
    {
      signature: input.signature,
      status: gesamtStatus,
      versuch: input.versuch,
      startedAt: input.startedAt,
      disziplinen,
      resolveOptionsForPreview: {
        arenaTeamPointsByDisciplineId,
        arenaIndividualBoxscorePpsByDisciplineId,
        arenaAusfallByDisciplineId,
        ...(miniDmFfaPodRohdatenByDisciplineId.size > 0 ? { miniDmFfaPodRohdatenByDisciplineId } : {}),
      },
    },
    input.persistence,
  );
  return record;
}

/** Schluessel fuer die In-Prozess-Entdopplung (Plan 2.7): ein Lauf je Spieltag+Signatur. */
function laufSchluessel(scope: MatchdayResolveScope, signature: string) {
  return `${scope.saveId}|${scope.seasonId}|${scope.matchdayId}|${signature}`;
}

/**
 * Entscheidet, ob ein NEUER Versuch anlaufen darf. `vorhandenerRecord` ist `null` bei der allerersten
 * Anfrage zu dieser Signatur (immer ja). Bei `"in_progress"` nie (ein Lauf laeuft schon -- der
 * Aufrufer haengt sich stattdessen an `laufendeVorlaeufe`/liest den Record).
 *
 * OPUS-REVIEW (Nachtrag 18.10., Design-Fix): `"ready"` UND `"failed"` sind jetzt BEIDE OHNE
 * AUSNAHME terminal (ausser `erzwingeNeuenVersuch`) -- die automatische Wiederholung bei
 * `absturz`/`timeout`/`chromium_start` passiert seit diesem Fix INNERHALB von
 * `fuehreVorlaufAus()`, BEVOR irgendetwas geschrieben wird (s. `RETRYBARE_AUSFALL_GRUENDE`/
 * `MAX_AUTOMATISCHE_VERSUCHE` dort). Ein persistiertes `"failed"` hat diese Wiederholung also
 * bereits hinter sich -- ein weiterer automatischer Versuch hier wuerde nur den vorher behobenen
 * K1-CPU-Sturm (jeder Aufruf startet einen neuen Versuch, nie wird gebucht) wieder einfuehren.
 * VORHER liess genau diese Zeile (`vorhandenerRecord.versuch < MAX_AUTOMATISCHE_VERSUCHE`) ein
 * bereits als `"failed"` persistiertes Ergebnis durch EINEN SPAeTEREN, externen Aufruf (Buchung,
 * Buehnen-Poll, Lineup-Speichern) erneut anlaufen -- das liess den Zustand fuer den Spieler
 * flackern (kurz "ausgefallen", dann wieder "laeuft") und machte `"failed"` zweideutig.
 */
function duerfeNeuenVersuchStarten(
  vorhandenerRecord: ArenaVorlaufRecord | null,
  signature: string,
  erzwingeNeuenVersuch: boolean,
): boolean {
  if (!vorhandenerRecord || vorhandenerRecord.signature !== signature) return true;
  // "in_progress" nie uebersteuerbar -- ein zweiter Lauf zur selben Signatur waere eine Rennbedingung.
  if (vorhandenerRecord.status === "in_progress") return false;
  // OPUS-REVIEW B3: `erzwingeNeuenVersuch` uebersteuert auch ein "ready" -- der Aufrufer
  // (`resolveMatchdayPreviewToBook()`s arenaEingabeDivergenz-Signal) hat festgestellt, dass der
  // ALS "ready" gespeicherte Vorlauf trotzdem nicht mehr zu den echten Arena-Eingaben passt (ein
  // feinerer Fingerabdruck als die Signatur selbst, s. `arena-eingabe-hash.ts`) -- ein "ready" ist
  // in diesem Fall KEIN Grund mehr, nichts zu tun.
  if (erzwingeNeuenVersuch) return true;
  // "ready" UND "failed" sind sonst beide terminal.
  return false;
}

const laufendeVorlaeufe = new Map<string, Promise<ArenaVorlaufRecord | null>>();

function starteOderTeileVorlauf(input: {
  persistence: PersistenceService;
  scope: MatchdayResolveScope;
  signature: string;
  arenaDisciplineIds: string[];
  mutatorTraitsByDisciplineId: Map<string, string[]>;
  versuch: number;
  runArenaFixturesImpl?: typeof runArenaFixtures;
  runArenaFixturesOptions?: RunArenaFixturesOptions;
  miniDmPresent: boolean;
  runMiniDmFfaPodFixturesImpl?: typeof runMiniDmFfaPodFixtures;
  runMiniDmFfaPodFixturesOptions?: Omit<RunMiniDmFfaPodFixturesOptions, "k" | "mutatoren">;
}): Promise<ArenaVorlaufRecord | null> {
  const schluessel = laufSchluessel(input.scope, input.signature);
  const bestehend = laufendeVorlaeufe.get(schluessel);
  if (bestehend) return bestehend;

  const begonnen = beginArenaVorlauf(
    input.scope,
    {
      signature: input.signature,
      // MINI-DM-FFA (PR 5): nur fuer die SICHTBARE "laeuft gerade"-Liste des Vorlauf-Records --
      // der eigentliche Mini-DM-Zweig in `fuehreVorlaufAus()` haengt NICHT an dieser Liste.
      disciplineIds: input.miniDmPresent ? [...input.arenaDisciplineIds, MINI_DM_DISCIPLINE_ID] : input.arenaDisciplineIds,
    },
    input.persistence,
  );
  if (!begonnen) return Promise.resolve(null);

  const promise = fuehreVorlaufAus({
    persistence: input.persistence,
    saveId: input.scope.saveId,
    seasonId: input.scope.seasonId,
    matchdayId: input.scope.matchdayId,
    signature: input.signature,
    arenaDisciplineIds: input.arenaDisciplineIds,
    mutatorTraitsByDisciplineId: input.mutatorTraitsByDisciplineId,
    versuch: begonnen.versuch,
    startedAt: begonnen.startedAt,
    runArenaFixturesImpl: input.runArenaFixturesImpl,
    runArenaFixturesOptions: input.runArenaFixturesOptions,
    miniDmPresent: input.miniDmPresent,
    runMiniDmFfaPodFixturesImpl: input.runMiniDmFfaPodFixturesImpl,
    runMiniDmFfaPodFixturesOptions: input.runMiniDmFfaPodFixturesOptions,
  }).finally(() => {
    laufendeVorlaeufe.delete(schluessel);
  });
  laufendeVorlaeufe.set(schluessel, promise);
  return promise;
}

export type ArenaVorlaufOptions = {
  runArenaFixturesImpl?: typeof runArenaFixtures;
  runArenaFixturesOptions?: RunArenaFixturesOptions;
  /** MINI-DM-FFA (PR 5) -- Testhebel, analog `runArenaFixturesImpl`/`runArenaFixturesOptions`. */
  runMiniDmFfaPodFixturesImpl?: typeof runMiniDmFfaPodFixtures;
  runMiniDmFfaPodFixturesOptions?: Omit<RunMiniDmFfaPodFixturesOptions, "k" | "mutatoren">;
  /**
   * NUR FUER DEN KICKOFF-MANTEL (`arena-matchday-resolve-service.ts`), NIE von den automatischen
   * Ausloesern (Lineup-Routen, Arena-Base-Route, Auto-Run-`"hintergrund"`/`"inline"`) gesetzt: ein
   * Admin kann ueber das Cockpit ("2. Result lokal anwenden", `allowIncompleteOverride`) einen
   * Spieltag auch mit UNVOLLSTAENDIGEM Feld forcieren -- das galt schon vor PR 3
   * (`determineArenaDisciplineContexts()` brauchte nie eine komplette Einsatzliste, s. Dateikopf-
   * Kommentar an `tests/arena-matchday-weg-b-beide-disziplinen.test.ts`). `true` erzwingt deshalb
   * einen Snapshot per `writeMatchdayResolveSnapshot()` auch ohne `isMatchdayFieldComplete()` --
   * NUR fuer diesen einen Aufruf, nicht als Dauerzustand. Ohne dieses Flag bleibt
   * `ensureMatchdayResolveSnapshot()`s Vollstaendigkeits-Gate in Kraft (Plan 2.1: der Vorlauf
   * rechnet erst, wenn das Feld steht) -- sonst wuerde JEDE einzelne Lineup-Teilspeicherung
   * (32 Teams, eine nach der anderen) verfrueht einen Arena-Lauf anstossen.
   */
  allowIncompleteField?: boolean;
  /**
   * OPUS-REVIEW B1: der geplante "Arena erneut versuchen"-Knopf (Plan 3.4) -- umgeht die
   * terminale `"ready"`/`"failed"`-Sperre in `duerfeNeuenVersuchStarten()` fuer EINEN weiteren,
   * von einem Menschen angestossenen Versuch zu DERSELBEN Signatur (der wiederum intern bis zu
   * `MAX_AUTOMATISCHE_VERSUCHE` automatische Wiederholungen bekommt, s. `fuehreVorlaufAus()`).
   * Kein automatischer Ausloeser setzt das.
   */
  erzwingeNeuenVersuch?: boolean;
};

/**
 * DETACHED: stoesst den Vorlauf an (falls noetig) und kehrt SOFORT zurueck, ohne auf Chromium zu
 * warten. Fuer den HTTP-Pfad (Plan 2.3/2.4) — der Aufrufer (Lineup-Routen, Arena-Base-Route,
 * Auto-Run im `"hintergrund"`-Modus) pollt danach ueber `readArenaVorlaufRecord()`.
 *
 * `{ applicable: false }`, wenn dieser Spieltag gar keinen Arena-Pfad braucht (Manager Mode oder
 * keine arena-aufgeloeste Disziplin an D1/D2) — der Aufrufer faellt dann auf sein bisheriges
 * Verhalten zurueck, UNVERAENDERT.
 */
export function kickoffArenaVorlauf(
  scope: MatchdayResolveScope,
  options: ArenaVorlaufOptions = {},
  persistence: PersistenceService = createPersistenceService(),
): ArenaVorlaufKickoffErgebnis {
  const anwendbarkeit = ermittleAnwendbarkeit(persistence, scope);
  if (!anwendbarkeit.applicable) {
    return { applicable: false, status: null, record: null };
  }

  // Ohne gueltigen Snapshot gibt es nichts, an das sich der Vorlauf haengen koennte — der
  // Aufrufer hat dafuer schon `ensureMatchdayResolveSnapshot()` gerufen (Lineup-Routen) bzw. tut
  // es hier noch einmal billig (Mehrfachaufruf, s. dortiger Kommentar). `allowIncompleteField`
  // (nur der Kickoff-Mantel, s. `ArenaVorlaufOptions`) erzwingt einen Snapshot notfalls auch ohne
  // vollstaendiges Feld.
  const snapshot = ensureMatchdayResolveSnapshot(scope, persistence) ?? (options.allowIncompleteField ? writeMatchdayResolveSnapshot(scope, persistence) : null);
  if (!snapshot) {
    return { applicable: true, status: null, record: null };
  }

  const vorhandenerRecord = readArenaVorlaufRecord(anwendbarkeit.gameState, scope);
  const signature = buildMatchdayResolveSignature(anwendbarkeit.gameState, scope);

  // REVIEW-FUND (Opus/CI #1273): der In-Prozess-Lauf (`laufendeVorlaeufe`) MUSS VOR dem
  // persistierten Record geprueft werden, nicht danach. Vorher las diese Funktion nur den
  // Record -- stand der schon auf "in_progress" (von genau diesem oder einem parallelen Aufruf
  // geschrieben), kam sie nie bis zum Map-Check. Fuer `kickoffArenaVorlauf()` selbst aendert das
  // am Ergebnis nichts (es wird ohnehin nie abgewartet) -- fuer die Konsistenz mit
  // `stelleArenaVorlaufSicher()` (die DASSELBE `laufendeVorlaeufe` nutzt) ist die Reihenfolge
  // trotzdem die maßgebliche Wahrheit: "laeuft gerade etwas HIER im Prozess" schlaegt eine
  // moeglicherweise schon ueberholte DB-Lesung.
  const schluessel = laufSchluessel(scope, signature);
  if (laufendeVorlaeufe.has(schluessel)) {
    return { applicable: true, status: "in_progress", record: vorhandenerRecord };
  }

  if (!duerfeNeuenVersuchStarten(vorhandenerRecord, signature, options.erzwingeNeuenVersuch ?? false)) {
    // "ready", noch echt "in_progress" (nicht der 5-Minuten-Verfall) ODER "failed" mit bereits
    // ausgeschoepfter automatischer Wiederholung (Opus-Review B1) -- nichts Neues anstossen.
    return { applicable: true, status: vorhandenerRecord!.status, record: vorhandenerRecord };
  }

  void starteOderTeileVorlauf({
    persistence,
    scope,
    signature,
    arenaDisciplineIds: anwendbarkeit.arenaDisciplineIds,
    mutatorTraitsByDisciplineId: anwendbarkeit.mutatorTraitsByDisciplineId,
    versuch: (vorhandenerRecord?.signature === signature ? vorhandenerRecord.versuch : 0) + 1,
    runArenaFixturesImpl: options.runArenaFixturesImpl,
    runArenaFixturesOptions: options.runArenaFixturesOptions,
    miniDmPresent: anwendbarkeit.miniDmPresent,
    runMiniDmFfaPodFixturesImpl: options.runMiniDmFfaPodFixturesImpl,
    runMiniDmFfaPodFixturesOptions: options.runMiniDmFfaPodFixturesOptions,
  }).catch((error) => {
    console.error(`[arena-vorlauf] unerwarteter Fehler ausserhalb des try/catch (${scope.saveId}/${scope.matchdayId}):`, error);
  });

  return { applicable: true, status: "in_progress", record: null };
}

/**
 * INLINE: wie `kickoffArenaVorlauf()`, aber WARTET auf das Ergebnis — fuer Skripte (Smoke-Tests,
 * Admin-Simulation, Bootstrap) und fuer `arenaModus: "inline"` im Auto-Run. Nie vom HTTP-Pfad
 * aufgerufen (Plan 2.3: "der HTTP-Pfad wartet nie auf Chromium").
 */
export async function stelleArenaVorlaufSicher(
  scope: MatchdayResolveScope,
  options: ArenaVorlaufOptions = {},
  persistence: PersistenceService = createPersistenceService(),
): Promise<ArenaVorlaufKickoffErgebnis> {
  const anwendbarkeit = ermittleAnwendbarkeit(persistence, scope);
  if (!anwendbarkeit.applicable) {
    return { applicable: false, status: null, record: null };
  }

  const snapshot = ensureMatchdayResolveSnapshot(scope, persistence) ?? (options.allowIncompleteField ? writeMatchdayResolveSnapshot(scope, persistence) : null);
  if (!snapshot) {
    return { applicable: true, status: null, record: null };
  }

  const vorhandenerRecord = readArenaVorlaufRecord(anwendbarkeit.gameState, scope);
  const signature = buildMatchdayResolveSignature(anwendbarkeit.gameState, scope);

  // REVIEW-FUND (Opus/CI #1273, "Koop/Doppellauf"-Test lieferte unterschiedliche Status fuer
  // zwei fast gleichzeitige Aufrufe): der In-Prozess-Lauf MUSS VOR dem persistierten Record
  // geprueft werden. Vorher konnte ein zweiter, nahezu gleichzeitiger Aufruf den von EINEM
  // ersten Aufruf gerade geschriebenen "in_progress"-Record lesen und SOFORT damit zurueckkehren
  // (`duerfeNeuenVersuchStarten` verweigert bei "in_progress" jeden neuen Versuch) -- OHNE je bei
  // `laufendeVorlaeufe` nachzusehen, ob genau dieser Lauf schon faehrt und abwartbar ist. Ergebnis:
  // zwei Aufrufer derselben Signatur bekamen verschiedene Antworten (einer wartete echt auf
  // "ready"/"failed", der andere kehrte mit einem veralteten "in_progress" sofort zurueck) --
  // genau das widerspricht dem Zweck von `stelleArenaVorlaufSicher()` ("wartet auf das Ergebnis").
  const schluessel = laufSchluessel(scope, signature);
  const bestehenderLauf = laufendeVorlaeufe.get(schluessel);
  if (bestehenderLauf) {
    const record = await bestehenderLauf;
    return { applicable: true, status: record?.status ?? null, record };
  }

  // VORHER (Opus-Review B1): dieser Zweig griff bei JEDEM "failed" sofort und gab den alten
  // Record OHNE jemals automatisch neu zu versuchen zurueck -- der Inline-Pfad (Skripte,
  // `arenaModus: "inline"`) retryte also NIE, selbst beim ersten Ausfall nicht. Jetzt dieselbe
  // Entscheidung wie im Hintergrund-Pfad: "ready"/"in_progress" nie neu, "failed" nur innerhalb des
  // Wiederholungs-Budgets (bzw. mit `erzwingeNeuenVersuch`). Greift erst HIER, NACH dem
  // `laufendeVorlaeufe`-Check oben (s. Review-Fund) -- ein echt "in_progress" aus einer ANDEREN
  // Prozess-Instanz (Container-Neustart, s. `readArenaVorlaufRecord()`s 5-Minuten-Verfall) landet
  // trotzdem hier, weil es dafuer keinen lokalen `laufendeVorlaeufe`-Eintrag gibt.
  if (!duerfeNeuenVersuchStarten(vorhandenerRecord, signature, options.erzwingeNeuenVersuch ?? false)) {
    return { applicable: true, status: vorhandenerRecord!.status, record: vorhandenerRecord };
  }

  const record = await starteOderTeileVorlauf({
    persistence,
    scope,
    signature,
    arenaDisciplineIds: anwendbarkeit.arenaDisciplineIds,
    mutatorTraitsByDisciplineId: anwendbarkeit.mutatorTraitsByDisciplineId,
    versuch: (vorhandenerRecord?.signature === signature ? vorhandenerRecord.versuch : 0) + 1,
    runArenaFixturesImpl: options.runArenaFixturesImpl,
    runArenaFixturesOptions: options.runArenaFixturesOptions,
    miniDmPresent: anwendbarkeit.miniDmPresent,
    runMiniDmFfaPodFixturesImpl: options.runMiniDmFfaPodFixturesImpl,
    runMiniDmFfaPodFixturesOptions: options.runMiniDmFfaPodFixturesOptions,
  });
  return { applicable: true, status: record?.status ?? null, record };
}

export { readArenaVorlaufRecord };
