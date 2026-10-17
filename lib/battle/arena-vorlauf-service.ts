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
import type { runArenaFixtures, RunArenaFixturesOptions } from "@/lib/battle/arena-headless-runner";
import { berechneArenaEingabeHash } from "@/lib/battle/arena-eingabe-hash";
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
} {
  const contexts = contextResults.flatMap((result) => (result.ok ? [result.context] : []));
  const kandidaten = new Set<string>();
  for (const context of contexts) {
    const d1 = context.contextMeta.d1DisciplineId;
    const d2 = context.contextMeta.d2DisciplineId;
    if (d1 && ARENA_RESOLVED_DISCIPLINE_IDS.has(d1)) kandidaten.add(d1);
    if (d2 && ARENA_RESOLVED_DISCIPLINE_IDS.has(d2)) kandidaten.add(d2);
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
  }
  return { contexts, arenaDisciplineIds: [...kandidaten], mutatorTraitsByDisciplineId };
}

function ermittleAnwendbarkeit(persistence: PersistenceService, scope: MatchdayResolveScope) {
  const { save } = requireLocalPersistedSave(persistence, scope.saveId);
  if (!isBattleModeSave(save.gameState)) {
    return { applicable: false as const, gameState: save.gameState };
  }
  const contextResults = loadAllLocalLegacyLineupContexts(scope, persistence);
  const { arenaDisciplineIds, mutatorTraitsByDisciplineId } = determineArenaDisciplineContexts(contextResults);
  if (arenaDisciplineIds.length === 0) {
    return { applicable: false as const, gameState: save.gameState };
  }
  return { applicable: true as const, gameState: save.gameState, arenaDisciplineIds, mutatorTraitsByDisciplineId };
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
};

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
  let gesamtStatus: "ready" | "failed" = "ready";

  // SEQUENZIELL, NICHT PARALLEL (Plan 2.7/4.4) — D1 und D2 derselben Signatur laufen eins nach dem
  // anderen, und der globale Semaphor serialisiert zusaetzlich gegen JEDEN anderen Vorlauf im
  // Prozess (anderer Save, anderer Spieltag).
  for (const disziplinId of input.arenaDisciplineIds) {
    const start = Date.now();
    await mitChromiumSemaphor(async () => {
      try {
        const { overridesByTeamId, individualBoxscorePpsByPlayerId, warnings } = await runBattleModeArenaMatchday({
          gameState: current.gameState,
          saveId: input.saveId,
          seasonId: input.seasonId,
          matchdayId: input.matchdayId,
          disciplineId: disziplinId,
          runArenaFixturesImpl: input.runArenaFixturesImpl,
          matchdayMutatorTraits: input.mutatorTraitsByDisciplineId.get(disziplinId),
          runArenaFixturesOptions: {
            seitenTimeoutMs: resolveArenaSeitenTimeoutMs(),
            ...input.runArenaFixturesOptions,
          },
        });
        arenaTeamPointsByDisciplineId.set(disziplinId, overridesByTeamId);
        arenaIndividualBoxscorePpsByDisciplineId.set(disziplinId, individualBoxscorePpsByPlayerId);
        const ausfall = ableiteArenaAusfall(warnings, input.versuch);
        if (ausfall) {
          arenaAusfallByDisciplineId.set(disziplinId, ausfall);
          gesamtStatus = "failed";
          disziplinen[disziplinId] = { status: "ausgefallen", ausfall, dauerMs: Date.now() - start };
        } else {
          const eingabeHash = berechneArenaEingabeHash({
            gameState: current.gameState,
            saveId: input.saveId,
            seasonId: input.seasonId,
            matchdayId: input.matchdayId,
            disciplineId: disziplinId,
            mutatoren: input.mutatorTraitsByDisciplineId.get(disziplinId) ?? [],
          });
          disziplinen[disziplinId] = { status: "arena", dauerMs: Date.now() - start, eingabeHash };
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const ausfall: ArenaAusfall = {
          grund: leiteGrundAusText(detail),
          detail: detail.slice(0, 200),
          zeitpunkt: new Date().toISOString(),
          versuch: input.versuch,
        };
        arenaAusfallByDisciplineId.set(disziplinId, ausfall);
        gesamtStatus = "failed";
        disziplinen[disziplinId] = { status: "ausgefallen", ausfall, dauerMs: Date.now() - start };
        console.error(`[arena-vorlauf] ${disziplinId} an ${input.matchdayId} (${input.saveId}) ausgefallen: ${detail}`);
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
 * OPUS-REVIEW B1 (kritisch): GENAU EINE automatische Wiederholung (Plan Abschnitt 3.4) --
 * `versuch 1` scheitert, `versuch 2` (die automatische Wiederholung) darf noch anlaufen. Scheitert
 * AUCH die, ist diese Signatur ENDGUELTIG `"failed"`: kein dritter automatischer Versuch mehr, egal
 * wie oft `kickoffArenaVorlauf()`/`stelleArenaVorlaufSicher()` noch gerufen werden (Buehne pollt,
 * Lineup-Routen, Auto-Run). OHNE diese Schranke startete jeder Aufruf bei kaputtem/fehlendem
 * Chromium einen neuen Versuch -- CPU-Sturm, UND der Auto-Run sah nie etwas anderes als
 * "in_progress"/"arena_vorlauf_laeuft" und buchte NIE, selbst die PPS-Duell-Bruecke nicht. Das war
 * schlimmer als die K1-Luecke selbst (die legte nur die Arena lahm, nicht den ganzen Spieltag).
 */
const MAX_AUTOMATISCHE_VERSUCHE = 2;

/**
 * Entscheidet, ob ein NEUER Versuch anlaufen darf. `vorhandenerRecord` ist `null` bei der allerersten
 * Anfrage zu dieser Signatur (immer ja). Bei `"in_progress"` nie (ein Lauf laeuft schon -- der
 * Aufrufer haengt sich stattdessen an `laufendeVorlaeufe`/liest den Record). Bei `"ready"` nie
 * (fertig, nichts zu tun). Bei `"failed"` nur, wenn `versuch < MAX_AUTOMATISCHE_VERSUCHE` ODER der
 * Aufrufer explizit `erzwingeNeuenVersuch` setzt (der geplante "Arena erneut versuchen"-Knopf, Plan
 * Abschnitt 3.4).
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
  if (vorhandenerRecord.status === "ready") return false;
  // status === "failed"
  return vorhandenerRecord.versuch < MAX_AUTOMATISCHE_VERSUCHE;
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
}): Promise<ArenaVorlaufRecord | null> {
  const schluessel = laufSchluessel(input.scope, input.signature);
  const bestehend = laufendeVorlaeufe.get(schluessel);
  if (bestehend) return bestehend;

  const begonnen = beginArenaVorlauf(
    input.scope,
    { signature: input.signature, disciplineIds: input.arenaDisciplineIds },
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
  }).finally(() => {
    laufendeVorlaeufe.delete(schluessel);
  });
  laufendeVorlaeufe.set(schluessel, promise);
  return promise;
}

export type ArenaVorlaufOptions = {
  runArenaFixturesImpl?: typeof runArenaFixtures;
  runArenaFixturesOptions?: RunArenaFixturesOptions;
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
   * `MAX_AUTOMATISCHE_VERSUCHE`-Schranke fuer EINEN weiteren, von einem Menschen angestossenen
   * Versuch zu DERSELBEN Signatur. Kein automatischer Ausloeser setzt das.
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
  });
  return { applicable: true, status: record?.status ?? null, record };
}

export { readArenaVorlaufRecord };
