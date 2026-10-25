// ===================================================================================
// ABNAHME DER PPS-DUELL-BRUECKE SELBST (lib/resolve/battle-mode-pps-duell.ts) — v2, Projektaufsicht-
// Korrektur 17.10. gegenueber der ersten Fassung dieses Skripts (die TEAM-vs-TEAM mass und Teil B
// mit NEUTRALEN Modifikatoren rechnete -- beide Vereinfachungen beantworteten nicht genau die
// CLAUDE.md-Frage und wurden hier ersetzt, nicht nur ergaenzt).
//
// WAS DIESE MESSUNG IST UND WARUM SIE SO AUFGEBAUT IST.
//
// Die Bruecke selbst hat keine eigene Attribut-Logik — sie vergleicht zwei fertige Team-Scores
// (outcomeAusPunkten) und verteilt sie als 2/1/0. Der Score, den sie konsumiert, kommt aus dem
// alten, Arena-unabhaengigen "legacy PPS"-Pfad (scoreLegacyLineupDisciplineSide(), gefuettert aus
// calculateRawDisciplineScore() -- derselbe Kanal, ueber den VOR der Arena schon die Rangtabelle
// lief und der dauerhaft fuer mindestens fuenf Disziplinen (Football, I-Spy, Battlefield, TDM,
// Mini-DM -- nie arena-angeschlossen) der tatsaechlich auszahlende Kanal ist).
//
// TEIL A (rho) — JETZT AUF SPIELER-EBENE, wie CLAUDE.md es fuer jede Disziplin verlangt ("Stat 80
// -> einer der Top-Leute", miss-alle-disziplinen.mjs-Methodik: Spieler-Rang nach Eignung gegen
// Spieler-Rang nach dem, was er im Spiel bewirkt, JE SPIEL, Median ueber die Kader-Familie). Die
// erste Fassung mass stattdessen Team-Eignung gegen den binaeren Duell-Ausgang -- eine andere
// Grundgesamtheit. Jetzt: je Team-Seite einer Disziplin an einem Spieltag (= "ein Spiel", analog
// einem Boxscore) wird Spearman-rho zwischen `entries[].baseValue` (p.d, matrixgewichtete
// Eignung) und `entries[].pointsAwarded` (die tatsaechlich im Battle-Save vergebene individuelle
// PP, aus distributeRankPointsToPlayers() -- UNVERAENDERT durch die Bruecke, s. Projektakte: die
// Bruecke tauscht nur den TEAM-Wert, die individuelle Verteilung lief schon vorher ueber denselben
// Pfad) berechnet. Median + Spannweite ueber alle gemessenen Team-Seiten, zwei Saatstroeme.
//
// Die TEAM-vs-TEAM-Sicht der ersten Fassung bleibt als ZWEITE, aber umformulierte Kennzahl:
// Paartreue nach Eignungsabstand (<2 / 2..15 / >=15 Punkte Team-Eignungs-Differenz), NICHT mehr
// als Korrelation mit einem ternaeren Ergebnis -- CLAUDE.md-Stil ("Paare ab 15 Punkten zu
// praktisch 100% richtig geordnet").
//
// TEIL B (Pp-Analogon) — JETZT UNTER ECHTEN BEDINGUNGEN, nicht mehr mit neutralen Modifikatoren.
// Die erste Fassung bewies nur, dass der Kanal MATHEMATISCH linear ist (das bleibt als
// deterministischer Formel-Waechter in tests/pps-duell-bruecke-score-kanal.test.ts stehen, ist
// aber NICHT die Abnahmezahl). Die eigentliche CLAUDE.md-Frage ist, ob ein ANDERER Kanal (Slot-
// Rolle, Trait/Mutator, Formkarte, Spieltags-Captain, Verletzungsleistung, Team-Power-Debuff) die
// Matrixgewichte im echten Spiel UEBERDECKT. Dafuer wird hier EXAKT derselbe, bereits vom echten
// Spieltag gezogene Kontext wiederverwendet (reale KI-Aufstellung, reale Formkarten, reale
// Mutator-Slots, reale Team-Power, realer Kapitaen, reale Fatigue/Verletzung/Moral) -- nur DIE
// `disciplineScores`-Zahl EINES bereits gefelderten Spielers wird fuer EIN Attribut um +15 (dieselbe
// Anhebung wie messe-arena-einfluss.mjs) angehoben, UEBER DIE ECHTE LIGA-RANGABBILDUNG
// (buildCompetitionRanks + mapRankToDisciplineStat -- derselbe Mechanismus, der p.d ueberhaupt
// erst erzeugt), und NUR DIESE EINE Zahl im Kontext ausgetauscht. Lineup-Auswahl, Formkarten,
// Mutatoren, Team-Power, Kapitaen bleiben UNVERAENDERT (sie wurden schon vorher, mit dem
// Original-Score, gezogen) -- es gibt also keine Verwechslungsgefahr durch eine andere Aufstellung.
// Gemessen wird die resultierende Aenderung von `pointsAwarded` (die tatsaechlich vergebene
// individuelle PP, nach ALLEN echten Modifikatoren) je Attribut, ueber viele (Spieler, Spieltag)-
// Ziehungen, normiert und gegen die Matrix (bzw. resolveDisciplineWeightProfile -- s. FOOTBALL
// unten) verglichen. Zwei Saatstroeme, Ziel <= 25 Pp.
//
// FOOTBALL-KLAERUNG (Projektaufsicht-Frage 17.10.): calculateRawDisciplineScore() ruft
// resolveDisciplineWeightProfile(dId), die bei vorhandenem Override (spiel-eignung-overrides.ts)
// GENAU DIESEN statt der offiziellen Matrix liefert. Football hat einen solchen Override
// (begruendet mit Chris' Bestaetigung, E3). Der legacy-PPS-Kanal -- und damit die Bruecke --
// liest fuer Football also den OVERRIDE, NICHT die rohe Matrix. Gemessen wird hier deshalb korrekt
// GEGEN resolveDisciplineWeightProfile("football") (den Override), nicht gegen
// officialDisciplineWeightTable.football.
//
// AUFRUF (s. CLAUDE.md "An die Spielstaende kommen"):
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/miss-pps-duell-bruecke-abnahme.ts \
//     [--disziplinen=a,b,...] [--spieltage=10] [--pp-trials-je-seite=6]
// ===================================================================================
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  loadLocalLegacyLineupContextFromGameState,
  resetSharedLineupContextBaseCacheForTests,
} from "@/lib/lineups/legacy-lineup-local-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { buildAiLegacyLineupPreviewWithModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { buildInitialLeagueAssignment, isLeagueSplitActive, type LeagueTier } from "@/lib/season/league-split";
import { MINI_DM_DISCIPLINE_ID } from "@/lib/season/season-discipline-schedule";
import { calculateRawDisciplineScore, buildCompetitionRanks, mapRankToDisciplineStat } from "@/lib/player-formulas/discipline-rating-engine";
import { resolveDisciplineWeightProfile } from "@/lib/player-generator/spiel-eignung-overrides";
import { playerGeneratorAttributeKeys, type OfficialDisciplineWeightId } from "@/lib/player-generator/official-discipline-weights";
import type { Discipline, GameState, Player, SeasonDisciplineScheduleSlot } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FELDGROESSE = 6;
const PAARUNGEN_JE_SPIELTAG = 2;
const ALLE_SAATSTROEME = [0, 10_000_000] as const;

const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=", 2);
    return [k!, v ?? "1"] as const;
  }),
);
// Container-Haertung (19.10.): der Vier-Kern-Host braucht fuer EINEN Saatstrom bereits ~50 Minuten
// (buildLegacyMatchdayResolvePreview je Spieltag dominiert) -- beide Stroeme in einem Prozess
// liefen damit ins Hintergrund-Zeitlimit und der Prozess wurde OHNE geschriebene Ausgabe
// abgeschossen (writeFileSync passiert erst ganz am Ende von main()), jeder Lauf war komplett
// verloren. `--stroeme=0` bzw. `--stroeme=10000000` laesst genau EINEN Saatstrom laufen (mit
// `--ausgabe=<pfad>` getrennt geschrieben), ohne das Verhalten ohne diesen Schalter zu aendern.
const SAATSTROEME = args.get("stroeme")
  ? ALLE_SAATSTROEME.filter((s) => args.get("stroeme")!.split(",").map(Number).includes(s))
  : ALLE_SAATSTROEME;
// Ueberschreibbar (--ausgabe=<pfad>), damit zwei parallele Teilmessungen (z.B. ein reiner Teil-A-
// Feldgroessen-Sweep mit --skip-teil-b neben einer Teil-B-Nachmessung) sich nicht gegenseitig die
// Ausgabedatei ueberschreiben.
const AUSGABE = args.get("ausgabe") ? path.resolve(args.get("ausgabe")!) : path.join(WURZEL, "data/generated/pps-duell-bruecke-abnahme.json");

// OPUS-PRAEZISIERUNG 17.10. (Nachtrag zu PR #1277): Spearman auf einer Teamseite mit n=2 ist
// mathematisch IMMER ±1 (zwei Punkte liegen zwangslaeufig perfekt monoton) -- ohne Erkenntniswert
// und wird ueber den n>=3-Filter in spearman() bereits ausgeschlossen. Um das nicht nur zu
// behaupten, sondern zu zeigen, misst Teil A jetzt ZUSAETZLICH ueber mehrere Feldgroessen
// (3/4/5/6, dieselbe Konvention wie scripts/ziehe-verhaeltnis-referenz.ts) statt nur bei der einen
// gewaehlten Groesse 6 -- Feldgroesse 2 wird bewusst NICHT simuliert (das Ergebnis ist analytisch
// vorhersagbar: immer |rho|=1, kein Lauf noetig) und im Bericht nur als Hinweis gefuehrt.
const FELDGROESSEN_TEIL_A = (args.get("feldgroessen")?.split(",").map(Number) ?? [3, 4, 5, 6]).filter((n) => Number.isInteger(n) && n >= 3);
// Teil B (Pp unter echten Bedingungen) bleibt bei EINER Feldgroesse (6) -- er fragt nicht "haengt
// rho von der Feldgroesse ab", sondern "verzerrt ein anderer Kanal die Matrix", und das macht man
// nicht guenstiger, indem man es bei mehreren Feldgroessen wiederholt.
const PP_FELDGROESSE = 6;
// Fuer einen reinen Feldgroessen-Sweep (Teil A) kann Teil B ganz ausgelassen werden (teuer, siehe
// Kopfkommentar) -- additiv, ohne den Schalter unveraendertes Verhalten.
const TEIL_B_UEBERSPRINGEN = args.has("skip-teil-b");

const STANDARD_DISZIPLINEN = ["football", "i-spy", "battlefield", "tdm", "mini-dm", "basketball", "hockey", "fechten"];
const DISZIPLINEN = (args.get("disziplinen")?.split(",") ?? STANDARD_DISZIPLINEN).filter(Boolean);
const SPIELTAGE_LIMIT = Number(args.get("spieltage") ?? 6);
// ABSOLUTE Zahl Team-Seiten-Ziehungen je Disziplin UND Saatstrom (nicht mit Paaren/Spieltagen
// multipliziert -- das war ein Bug in der ersten Fassung, der das Budget ungewollt auf 240 statt
// der gewollten Groessenordnung aufblies). Pro Ziehung werden ALLE 12 Attribute einzeln getestet --
// das ist der teure Teil (je Attribut EIN zusaetzlicher buildLegacyMatchdayResolvePreview()-Lauf,
// gemessen ~3.5s, aber OHNE erneute KI-Aufstellung, da Kontext/Entwurf wiederverwendet werden; die
// KI-Aufstellung selbst, ~27s je 32-Team-Spieltag, ist der dominante Fixkostenanteil von Teil A und
// wird fuer Teil B mitgenutzt, nicht neu gezahlt).
const PP_TRIALS_JE_SEITE = Number(args.get("pp-trials-je-seite") ?? 8);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gemischt<T>(liste: readonly T[], seed: number): T[] {
  const kopie = [...liste];
  const zufall = mulberry32(seed);
  for (let i = kopie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(zufall() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j]!, kopie[i]!];
  }
  return kopie;
}

function rang(werte: readonly number[]): number[] {
  const indiziert = werte.map((wert, index) => ({ wert, index }));
  indiziert.sort((a, b) => a.wert - b.wert);
  const raenge = new Array<number>(werte.length);
  let i = 0;
  while (i < indiziert.length) {
    let j = i;
    while (j + 1 < indiziert.length && indiziert[j + 1]!.wert === indiziert[i]!.wert) j += 1;
    const mittlererRang = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) raenge[indiziert[k]!.index] = mittlererRang;
    i = j + 1;
  }
  return raenge;
}

function spearman(a: readonly number[], b: readonly number[]): number | null {
  if (a.length !== b.length || a.length < 3) return null;
  const ra = rang(a);
  const rb = rang(b);
  const n = a.length;
  const meanA = ra.reduce((s, v) => s + v, 0) / n;
  const meanB = rb.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = ra[i]! - meanA;
    const db = rb[i]! - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA === 0 || denB === 0) return null;
  return num / Math.sqrt(denA * denB);
}

function median(werte: readonly number[]): number | null {
  if (werte.length === 0) return null;
  const sortiert = [...werte].sort((a, b) => a - b);
  const mid = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 ? sortiert[mid]! : (sortiert[mid - 1]! + sortiert[mid]!) / 2;
}

function mean(werte: readonly number[]): number | null {
  return werte.length ? werte.reduce((s, v) => s + v, 0) / werte.length : null;
}

function slotFuer(discipline: Discipline, n: number): SeasonDisciplineScheduleSlot {
  const istMiniDm = discipline.id === MINI_DM_DISCIPLINE_ID;
  return {
    disciplineId: discipline.id,
    displayName: discipline.name,
    order: discipline.displayOrder ?? discipline.originalOrder ?? null,
    playerCount: istMiniDm ? 1 : n,
    category: discipline.category,
    legacyScorePlayerCount: n,
  };
}

/** Dieselben 12 Felder wie die (nicht exportierte) readPlayerAttributes() in discipline-rating-engine.ts. */
function attrsOf(player: Player | undefined): Record<string, number> | null {
  const stats = player?.attributeSheetStats;
  if (!stats) return null;
  const attrs: Record<string, number> = {};
  for (const key of playerGeneratorAttributeKeys) {
    const value = (stats as unknown as Record<string, number>)[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    attrs[key] = value;
  }
  return attrs;
}

type FixtureRow = { eignungDiff: number; korrektGeordnet: boolean | null; absEignungDiff: number };

function main() {
  const persistence = createPersistenceService();
  const saveId = args.get("save") ?? "new-game-1787123325719-swnjlk";
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save ${saveId} nicht im Abbild.`);
  const basis = save.gameState;
  const seasonId = basis.season.id;
  // ZWEI UNABHAENGIGE SAATSTROEME, AUCH FUER TEIL A (Projektaufsicht-Fund 17.10., gegenueber der
  // ersten Fassung dieses Abschnitts): ein Team-Seiten-"Spiel" (baseValue/pointsAwarded fuer Teil
  // A) haengt nicht von der Zufalls-PAARUNG ab, sondern NUR von (Team, Disziplin, Spieltag) -- mit
  // DEMSELBEN Spieltags-Pool fuer beide Stroeme waere der Spieler-rho-Median also fuer beide
  // Stroeme bit-identisch (nur die Paarungs-abhaengige Team-Paartreue und Teil Bs Perturbations-
  // Ziehung haetten echte Streuung gehabt) -- keine echte zweite, unabhaengige Messung. Die
  // Spieltage werden deshalb in zwei DISJUNKTE Fenster geteilt, je ein Fenster pro Saatstrom:
  // echte, nicht ueberlappende reale Spieltage statt zweimal derselben Stichprobe.
  const matchdayPool = basis.season.matchdayIds ?? [];
  // Immer gegen ALLE_SAATSTROEME.length bemessen/indiziert (nicht das ggf. per `--stroeme`
  // gefilterte SAATSTROEME) -- sonst bekaeme ein einzeln nachgefahrener Strom ein anderes
  // (breiteres) Spieltags-Fenster als beim gemeinsamen Lauf und waere mit dessen bereits
  // gemessenem Partner-Strom nicht mehr disjunkt/vergleichbar.
  const fensterGroesse = Math.max(1, Math.min(SPIELTAGE_LIMIT, Math.floor(matchdayPool.length / ALLE_SAATSTROEME.length)));
  const spieltageJeStrom = new Map(
    SAATSTROEME.map((strom) => {
      const i = ALLE_SAATSTROEME.indexOf(strom);
      return [strom, matchdayPool.slice(i * fensterGroesse, i * fensterGroesse + fensterGroesse)] as const;
    }),
  );
  const alleDisziplinen = basis.disciplines;
  const gewaehlt = DISZIPLINEN.map((id) => alleDisziplinen.find((d) => d.id === id)).filter((d): d is Discipline => Boolean(d));
  const fehlend = DISZIPLINEN.filter((id) => !alleDisziplinen.find((d) => d.id === id));
  if (fehlend.length) console.error(`[warnung] unbekannte Disziplin-IDs im Save: ${fehlend.join(", ")}`);
  const haelfte = Math.ceil(gewaehlt.length / 2);

  const ligaJeTeam: Record<string, LeagueTier> = isLeagueSplitActive(basis)
    ? (basis.seasonState.leagueByTeamId as Record<string, LeagueTier>)
    : buildInitialLeagueAssignment(basis.teams);
  const ligen = (["liga1", "liga2"] as const).map((tier) => basis.teams.filter((t) => ligaJeTeam[t.teamId] === tier).map((t) => t.teamId));

  const paare = Array.from({ length: haelfte }, (_, i) => {
    const a = gewaehlt[i]!;
    const b = gewaehlt[i + haelfte] ?? gewaehlt.find((d) => d.id !== a.id) ?? a;
    return [a, b] as const;
  }).filter(([a, b]) => a.id !== b.id || gewaehlt.length === 1);

  // Spieler-Attribute einmal nachschlagen (basis.players aendert sich ueber die ganze Messung nicht).
  const playerById = new Map(basis.players.map((p) => [p.id, p] as const));

  // Je Disziplin EINMAL: Roh-Score ALLER Spieler der Liga (fuer die echte Rang-/p.d-Abbildung in
  // Teil B) -- teuer genug, um es nicht je Trial neu zu rechnen, aber unabhaengig vom Spieltag.
  const rohScoreJeDisziplin = new Map<string, { playerId: string; score: number | null }[]>();
  for (const d of gewaehlt) {
    rohScoreJeDisziplin.set(
      d.id,
      basis.players.map((p) => {
        const attrs = attrsOf(p);
        return { playerId: p.id, score: attrs ? calculateRawDisciplineScore(attrs as never, d.id as OfficialDisciplineWeightId) : null };
      }),
    );
  }

  const gameRhosJeDisziplinUndStrom = new Map<string, number[]>();
  const fixturesJeDisziplinUndStrom = new Map<string, FixtureRow[]>();
  const fixtureRhoJeDisziplinUndStrom = new Map<string, number[]>();
  // OPUS-AUFLAGE 17.10. (dritte Runde, Task #175 ausgelagert -- hier nur die billige
  // Zusatzgroesse fuer #1277 selbst): CLAUDE.md-Hockey-Methodik auf FIXTURE-Ebene (2n Spieler) --
  // Star auf Rang 1 / unter den ersten zwei (nach vergebener PP, Eignungs-Spitzenreiter ohne
  // Bindung), und Paartreue bei Eignungsabstand >= 15 unter ALLEN 2n Spielern eines Fixtures.
  const starJeDisziplinUndStrom = new Map<string, { n: number; rang1: number; top2: number }>();
  const paar15JeDisziplinUndStrom = new Map<string, { n: number; korrekt: number }>();
  // Teil B: Einfluss je (Disziplin, Strom, Attribut) -- Summe der positiven pointsAwarded-Deltas.
  const einflussJeDisziplinUndStrom = new Map<string, Record<string, number>>();
  const einflussLaeufeJeDisziplinUndStrom = new Map<string, number>();

  for (const strom of SAATSTROEME) {
    const ppRnd = mulberry32(strom + 777);
    const spieltage = spieltageJeStrom.get(strom)!;
    // Teil-B-Feldgroesse IMMER mitlaufen lassen (sonst gaebe es nie eine Pp-Messung), zusaetzlich
    // jede angefragte Teil-A-Feldgroesse -- ohne Dopplung, falls 6 schon in der Liste steht.
    const feldgroessenDieserLauf = Array.from(new Set([...FELDGROESSEN_TEIL_A, PP_FELDGROESSE]));
    for (const n of feldgroessenDieserLauf) {
    for (const [a, b] of paare) {
      for (const [mi, matchdayId] of spieltage.entries()) {
        const gs: GameState = {
          ...basis,
          // BATTLE-GATE-KORREKTUR (25.10., Opus-Audit Task #191, Fund bereits in PR #1284 18.10.
          // dokumentiert, dort aber nie gemergt): OHNE diesen Override bleibt `scenarioMeta.gameMode`
          // beim Wert des zugrundeliegenden Saves ("manager", da `new-game-1787123325719-swnjlk` ein
          // Manager-Mode-Save ist) -- `isBattleModeSave()`/`isBattleModeArenaEligible`
          // (legacy-matchday-resolve-engine.ts) blieben dadurch IMMER `false`, und jede Zeile lief als
          // `resolutionSource: "pps"` (der alte Rangpfad) statt `"pps_duell"` (die eigentlich zu
          // messende Bruecke aus `ppAusSpielerScore()`, PR #1296). Diese Messung testete bisher also
          // nie den Pfad, den sie zu testen vorgab. S. docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md
          // Abschnitt 8.6/8.2 fuer die volle Herleitung und die dadurch ungueltigen Alt-Zahlen.
          scenarioMeta: { ...basis.scenarioMeta, gameMode: "battle" } as GameState["scenarioMeta"],
          seasonState: {
            ...basis.seasonState,
            disciplineSchedule: (basis.seasonState.disciplineSchedule ?? []).map((zeile) =>
              zeile.matchdayId === matchdayId ? { ...zeile, discipline1: slotFuer(a, n), discipline2: slotFuer(b, n) } : zeile,
            ),
            lineupDrafts: (basis.seasonState.lineupDrafts ?? []).filter((draft) => draft.matchdayId !== matchdayId),
          },
        };
        resetSharedLineupContextBaseCacheForTests();
        const contexts = basis.teams
          .map((team) => loadLocalLegacyLineupContextFromGameState(gs, { saveId, seasonId, matchdayId, teamId: team.teamId }))
          .flatMap((r) => (r.ok ? [r.context] : []));
        const contextByTeamId = new Map(contexts.map((c) => [c.team.id, c] as const));
        for (const context of contexts) {
          context.existingDraft = null;
          const { preview, modifiers } = buildAiLegacyLineupPreviewWithModifiers(context);
          context.existingDraft = {
            lineupId: `pps-duell-abnahme-${context.team.id}`,
            saveId, seasonId, matchdayId, teamId: context.team.id,
            status: "locked" as const,
            entries: preview.entries,
            modifiers,
            createdAt: "2026-10-16T00:00:00.000Z",
            updatedAt: "2026-10-16T00:00:00.000Z",
          };
        }
        const preview = buildLegacyMatchdayResolvePreview(contexts);

        for (const dp of preview.disciplinePreviews) {
          // --- TEIL A, Spieler-Ebene: je Team-Seite EIN "Spiel" (Boxscore), JE FELDGROESSE. ---
          const gameRhoKey = `${dp.disciplineId}::${strom}::${n}`;
          const fixtureKey = `${dp.disciplineId}::${strom}`;
          const gameRhos = gameRhosJeDisziplinUndStrom.get(gameRhoKey) ?? [];
          for (const teamResult of dp.teamResults) {
            const eignungen: number[] = [];
            const pps: number[] = [];
            for (const entry of teamResult.entries) {
              if (entry.baseValue == null || entry.pointsAwarded == null) continue;
              eignungen.push(entry.baseValue);
              pps.push(entry.pointsAwarded);
            }
            const rho = spearman(eignungen, pps);
            if (rho != null) gameRhos.push(rho);
          }
          gameRhosJeDisziplinUndStrom.set(gameRhoKey, gameRhos);

          // --- TEIL A, Team-Ebene (Paartreue nach Eignungsabstand): wie zuvor, Fixture-basiert. ---
          const eignungByTeam = new Map<string, number>();
          const entriesByTeam = new Map<string, { eig: number[]; pp: number[] }>();
          for (const teamResult of dp.teamResults) {
            const summe = teamResult.entries.reduce((s, e) => s + (e.baseValue ?? 0), 0);
            eignungByTeam.set(teamResult.teamId, summe);
            const eig: number[] = [], pp: number[] = [];
            for (const entry of teamResult.entries) {
              if (entry.baseValue == null || entry.pointsAwarded == null) continue;
              eig.push(entry.baseValue);
              pp.push(entry.pointsAwarded);
            }
            entriesByTeam.set(teamResult.teamId, { eig, pp });
          }
          const scoreByTeam = new Map(dp.teamResults.map((tr) => [tr.teamId, tr.score] as const));
          const fixListe = fixturesJeDisziplinUndStrom.get(fixtureKey) ?? [];
          // OPUS-PRAEZISIERUNG 17.10. (zweite Runde): rho JE TEAM-SEITE ist bei kleiner Feldgroesse
          // (3/4) zu grob -- Spearman kennt dort nur die diskreten Werte 1,0/0,5/-0,5/-1,0 (n=3) bzw.
          // 1,0/0,8/0,6/... (n=4), und ein einziger Rang-Tausch landet exakt auf der Schranke selbst
          // (0,8 bei n=4) statt "darueber". Zusaetzliche, feinere Groesse: rho auf FIXTURE-EBENE
          // ueber BEIDE Seiten (2n Spieler, also 6 bzw. 8 bei n=3/4) -- entspricht genau Chris' Frage
          // ("wer am eignungsstaerksten ist, holt auch uebers Duell hinweg die meisten Punkte") und
          // der miss-alle-disziplinen.mjs-Methodik (ALLE Teilnehmer eines Spiels, nicht nur eine
          // Seite). Dieselbe Paarung/derselbe Seed wie die Paartreue direkt unten -- kein zweiter,
          // unabhaengiger Zufallszug noetig.
          const fixtureRhoKey = `${dp.disciplineId}::${strom}::${n}`;
          const fixtureRhos = fixtureRhoJeDisziplinUndStrom.get(fixtureRhoKey) ?? [];
          for (let p = 0; p < PAARUNGEN_JE_SPIELTAG; p += 1) {
            for (const [li, liga] of ligen.entries()) {
              const seed = strom + n * 1_000_003 + mi * 7919 + p * 104_729 + li * 13 + dp.disciplineId.length;
              const reihe = gemischt(liga, seed);
              for (let i = 0; i + 1 < reihe.length; i += 2) {
                const heimId = reihe[i]!, gastId = reihe[i + 1]!;
                const heimScore = scoreByTeam.get(heimId), gastScore = scoreByTeam.get(gastId);
                const heimEignung = eignungByTeam.get(heimId), gastEignung = eignungByTeam.get(gastId);
                if (heimScore == null || gastScore == null || heimEignung == null || gastEignung == null) continue;
                const eignungDiff = heimEignung - gastEignung;
                const absDiff = Math.abs(eignungDiff);
                const sieger = heimScore === gastScore ? null : heimScore > gastScore;
                const korrektGeordnet = sieger == null || absDiff < 1e-9 ? null : (eignungDiff > 0 && sieger) || (eignungDiff < 0 && !sieger);
                fixListe.push({ eignungDiff, korrektGeordnet, absEignungDiff: absDiff });

                const heimEntries = entriesByTeam.get(heimId), gastEntries = entriesByTeam.get(gastId);
                if (heimEntries && gastEntries) {
                  const fixtureRho = spearman([...heimEntries.eig, ...gastEntries.eig], [...heimEntries.pp, ...gastEntries.pp]);
                  if (fixtureRho != null) fixtureRhos.push(fixtureRho);

                  const kombiniert = [
                    ...heimEntries.eig.map((eig, i) => ({ eig, pp: heimEntries.pp[i]!, seite: "heim" as const })),
                    ...gastEntries.eig.map((eig, i) => ({ eig, pp: gastEntries.pp[i]!, seite: "gast" as const })),
                  ];
                  if (kombiniert.length >= 2) {
                    const maxEig = Math.max(...kombiniert.map((k) => k.eig));
                    const starKandidaten = kombiniert.filter((k) => k.eig === maxEig);
                    const star = starJeDisziplinUndStrom.get(fixtureRhoKey) ?? { n: 0, rang1: 0, top2: 0 };
                    // Nur ein EINDEUTIGER Star (keine Eignungs-Bindung an der Spitze) zaehlt --
                    // sonst waere "Rang 1" unter mehreren Gleichauf-Fuehrenden nicht sinnvoll definiert.
                    if (starKandidaten.length === 1) {
                      const ppRang = 1 + kombiniert.filter((k) => k.pp > starKandidaten[0]!.pp).length; // Competition-Ranking
                      star.n += 1;
                      if (ppRang === 1) star.rang1 += 1;
                      if (ppRang <= 2) star.top2 += 1;
                    }
                    starJeDisziplinUndStrom.set(fixtureRhoKey, star);

                    // OPUS-AUFLAGE 17.10. (vierte Runde): nach SEITE aufgeschluesselt -- Paare
                    // DERSELBEN Seite (beide heim ODER beide gast) vs. Paare UEBER BEIDE Seiten.
                    // Verdacht: haengt pointsAwarded (ueber den Teamrang) staerker an einem
                    // schlechten Duell-Ausgang, faellt die Fehlordnung ueberwiegend bei
                    // Seiten-uebergreifenden Paaren auf -- waere dann KEIN Messartefakt, sondern ein
                    // Verstoss gegen Chris' 30.08.-Entscheidung (PP vollstaendig von Team-Punkten
                    // entkoppelt, battle-mode-spielmodus-plan.md 5.1).
                    const key = `${fixtureRhoKey}::selbeSeite`;
                    const keyUeber = `${fixtureRhoKey}::ueberSeiten`;
                    const paar15 = paar15JeDisziplinUndStrom.get(fixtureRhoKey) ?? { n: 0, korrekt: 0 };
                    const paar15SelbeSeite = paar15JeDisziplinUndStrom.get(key) ?? { n: 0, korrekt: 0 };
                    const paar15UeberSeiten = paar15JeDisziplinUndStrom.get(keyUeber) ?? { n: 0, korrekt: 0 };
                    for (let a = 0; a < kombiniert.length; a += 1) {
                      for (let b = a + 1; b < kombiniert.length; b += 1) {
                        const diff = Math.abs(kombiniert[a]!.eig - kombiniert[b]!.eig);
                        if (diff < 15 || kombiniert[a]!.pp === kombiniert[b]!.pp) continue; // PP-Gleichstand ist inschluessig
                        const korrekt = (kombiniert[a]!.eig > kombiniert[b]!.eig) === (kombiniert[a]!.pp > kombiniert[b]!.pp);
                        paar15.n += 1;
                        if (korrekt) paar15.korrekt += 1;
                        const bucket = kombiniert[a]!.seite === kombiniert[b]!.seite ? paar15SelbeSeite : paar15UeberSeiten;
                        bucket.n += 1;
                        if (korrekt) bucket.korrekt += 1;
                      }
                    }
                    paar15JeDisziplinUndStrom.set(fixtureRhoKey, paar15);
                    paar15JeDisziplinUndStrom.set(key, paar15SelbeSeite);
                    paar15JeDisziplinUndStrom.set(keyUeber, paar15UeberSeiten);
                  }
                }
              }
            }
          }
          fixturesJeDisziplinUndStrom.set(fixtureKey, fixListe);
          fixtureRhoJeDisziplinUndStrom.set(fixtureRhoKey, fixtureRhos);

          // --- TEIL B, echte Bedingungen: NUR bei der einen gewaehlten Feldgroesse (s. Kopfkommentar). ---
          if (n !== PP_FELDGROESSE || TEIL_B_UEBERSPRINGEN) continue;
          const profil = resolveDisciplineWeightProfile(dp.disciplineId);
          const matrixSumme = Object.values(profil).reduce((s, w) => s + Math.max(0, w ?? 0), 0);
          if (matrixSumme <= 0) continue;
          const alleRaw = rohScoreJeDisziplin.get(dp.disciplineId)!;
          const einflussKey = `${dp.disciplineId}::${strom}`;
          const einfluss = einflussJeDisziplinUndStrom.get(einflussKey) ?? Object.fromEntries(playerGeneratorAttributeKeys.map((k) => [k, 0]));
          let laeufe = einflussLaeufeJeDisziplinUndStrom.get(einflussKey) ?? 0;

          for (const teamResult of dp.teamResults) {
            if (laeufe >= PP_TRIALS_JE_SEITE) break; // absolutes Budget je Disziplin/Strom
            const gefeldet = teamResult.entries.filter((e) => e.baseValue != null);
            if (gefeldet.length === 0) continue;
            const ziel = gefeldet[Math.floor(ppRnd() * gefeldet.length)]!;
            const spieler = playerById.get(ziel.playerId);
            const attrsBasis = attrsOf(spieler);
            if (!attrsBasis) continue;
            const context = contextByTeamId.get(teamResult.teamId);
            if (!context) continue;
            const basisEntry = context.disciplineScores.find((s) => s.playerId === ziel.playerId && s.disciplineId === dp.disciplineId);
            if (!basisEntry) continue;

            for (const attr of playerGeneratorAttributeKeys) {
              // BASELINE-MISMATCH-FIX (Fund beim Nachrechnen des Football-Befunds, 17.10.): der
              // ECHTE Kontext liest disciplineScores aus der SQLite (historisch geschrieben, ggf.
              // mit anderer Tabellen-/Trainingsversion), waehrend diese Messung p.d selbst ueber
              // calculateRawDisciplineScore + buildCompetitionRanks + mapRankToDisciplineStat NEU
              // herleitet. Wird der ABSOLUTE neu hergeleitete Wert eingesetzt (wie in der ersten
              // Fassung), erzeugt schon die blosse Differenz zwischen "historisch" und "neu
              // hergeleitet" einen MESSBAREN Sprung -- und zwar fuer JEDES Attribut gleich, auch
              // fuer ein mit Gewicht 0 angehobenes (per Konstruktion exakt wirkungslos). Genau das
              // erklaert den auffaelligen naeherungsweise FLACHEN ~7-11%-Einfluss ueber alle zwoelf
              // Attribute hinweg (inkl. Football-Override-Nullen charisma/intelligence) in der
              // ersten Fassung dieser Messung -- ein Mess-Artefakt, kein Befund am Spiel. Fix: BEIDE
              // Seiten (Basislinie UND Anhebung) ueber DIESELBE Neuherleitung rechnen und nur das
              // DELTA additiv auf den echten, historischen Basiswert legen. Ein Attribut mit Gewicht
              // 0 liefert dann exakt Delta = 0, nicht mehr den Mismatch-Sprung.
              const basisRoh = calculateRawDisciplineScore(attrsBasis as never, dp.disciplineId as OfficialDisciplineWeightId);
              const angehoben = { ...attrsBasis, [attr]: Math.min(99, attrsBasis[attr]! + 15) };
              const liftRoh = calculateRawDisciplineScore(angehoben as never, dp.disciplineId as OfficialDisciplineWeightId);
              if (basisRoh == null || liftRoh == null) continue;
              const rangVon = (roh: number) => {
                const rawMit = alleRaw.map((e) => (e.playerId === ziel.playerId ? { ...e, score: roh } : e));
                return buildCompetitionRanks(rawMit).get(ziel.playerId);
              };
              const rangBasislinie = rangVon(basisRoh);
              const rangLift = rangVon(liftRoh);
              const statBasislinie = rangBasislinie != null ? mapRankToDisciplineStat(rangBasislinie) : null;
              const statLift = rangLift != null ? mapRankToDisciplineStat(rangLift) : null;
              if (statBasislinie == null || statLift == null) continue;
              const deltaStat = statLift - statBasislinie;

              // PLAUSIBILITAETS-SELBSTTEST, DAUERHAFT EINGEBAUT (Opus-Auflage 17.10., Folgerung 1
              // zum Baseline-Mismatch-Fix oben): ein Attribut mit Gewicht 0 im TATSAECHLICH
              // GENUTZTEN Profil (resolveDisciplineWeightProfile -- das ist Override ODER Matrix,
              // je nachdem was calculateRawDisciplineScore wirklich liest) MUSS Delta = 0 liefern,
              // weil die Formel das Attribut komplett ignoriert. Jede Abweichung zeigt denselben
              // Fehler wieder, den die erste Fassung dieser Messung hatte (Basiswert und Anhebung
              // ueber verschiedene Rechenwege) -- also Abbruch statt stiller Fehlmessung.
              const aktuellesGewicht = (profil as Record<string, number>)[attr] ?? 0;
              if (aktuellesGewicht <= 0 && Math.abs(deltaStat) > 1e-6) {
                throw new Error(
                  `PLAUSIBILITAETS-SELBSTTEST FEHLGESCHLAGEN: ${dp.disciplineId}/${attr} hat Gewicht ` +
                    `${aktuellesGewicht} im genutzten Profil, aber deltaStat=${deltaStat} (Strom ${strom}, ` +
                    `Team ${teamResult.teamId}, Spieler ${ziel.playerId}) -- das ist derselbe Baseline-` +
                    `Mismatch-Fehler, der am 17.10. den falschen Football-Pp-Befund erzeugt hat ` +
                    `(docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md Abschnitt 8.5). Basiswert ` +
                    `und Anhebung muessen ueber DENSELBEN Rechenweg im selben Lauf gehen.`,
                );
              }

              const neuerStat = (basisEntry.score ?? 0) + deltaStat;

              const perturbierterContext: LegacyLineupLoadedContext = {
                ...context,
                disciplineScores: context.disciplineScores.map((s) =>
                  s.playerId === ziel.playerId && s.disciplineId === dp.disciplineId ? { ...s, score: neuerStat } : s,
                ),
              };
              const contextsMitPerturbation = contexts.map((c) => (c.team.id === teamResult.teamId ? perturbierterContext : c));
              const perturbiertePreview = buildLegacyMatchdayResolvePreview(contextsMitPerturbation);
              const perturbierteDp = perturbiertePreview.disciplinePreviews.find((d) => d.disciplineId === dp.disciplineId)!;
              const perturbierteEntry = perturbierteDp.teamResults
                .find((tr) => tr.teamId === teamResult.teamId)!.entries.find((e) => e.playerId === ziel.playerId)!;
              const delta = (perturbierteEntry.pointsAwarded ?? 0) - (ziel.pointsAwarded ?? 0);
              einfluss[attr] = (einfluss[attr] ?? 0) + Math.max(0, delta);
            }
            laeufe += 1;
          }
          einflussJeDisziplinUndStrom.set(einflussKey, einfluss);
          einflussLaeufeJeDisziplinUndStrom.set(einflussKey, laeufe);
        }
      }
    }
    console.error(`[strom ${strom}] Feldgroesse ${n} fertig.`);
    }
  }

  // ---------------------------------------------------------------------------------
  // AUSWERTUNG
  // ---------------------------------------------------------------------------------
  const teilA: Record<string, unknown> = {};
  for (const d of gewaehlt) {
    const proStrom = SAATSTROEME.map((strom) => {
      const fixKey = `${d.id}::${strom}`;
      const fix = fixturesJeDisziplinUndStrom.get(fixKey) ?? [];
      const bucket = (lo: number, hi: number) => fix.filter((f) => f.absEignungDiff >= lo && f.absEignungDiff < hi && f.korrektGeordnet != null);
      const paartreue = (zeilen: FixtureRow[]) => (zeilen.length ? zeilen.filter((z) => z.korrektGeordnet).length / zeilen.length : null);
      const klein = bucket(0, 2), mittel = bucket(2, 15), gross = fix.filter((f) => f.absEignungDiff >= 15 && f.korrektGeordnet != null);

      // OPUS-PRAEZISIERUNG 17.10.: rho JE FELDGROESSE (3/4/5/6, n>=3 durch spearman() bereits
      // erzwungen) UND gepoolt ueber alle simulierten Feldgroessen -- damit sichtbar ist, ob der
      // Median von einer einzelnen Groesse getragen wird oder ueber alle stabil bleibt.
      const jeFeldgroesse: Record<string, {
        median: number | null; spannweite: number | null; n: number;
        fixtureRhoMittel: number | null; fixtureRhoAnteilAb08: number | null; fixtureRhoN: number;
        starRang1Pct: number | null; starTop2Pct: number | null; starN: number;
        paartreueAb15Pct: number | null; paartreueAb15N: number;
        paartreueAb15SelbeSeitePct: number | null; paartreueAb15SelbeSeiteN: number;
        paartreueAb15UeberSeitenPct: number | null; paartreueAb15UeberSeitenN: number;
      }> = {};
      const alleRhos: number[] = [];
      for (const n of FELDGROESSEN_TEIL_A) {
        const rhos = gameRhosJeDisziplinUndStrom.get(`${d.id}::${strom}::${n}`) ?? [];
        alleRhos.push(...rhos);
        // OPUS-PRAEZISIERUNG 17.10. (zweite Runde): rho JE SEITE ist bei n=3/4 zu grob (nur die
        // diskreten Werte 1,0/0,5/-0,5/-1,0 bzw. 1,0/0,8/0,6/... moeglich, ein Rang-Tausch landet
        // bei n=4 exakt AUF der 0,80-Schranke statt darueber) -- die FIXTURE-Ebene (2n Spieler
        // beider Seiten) ist die aussagekraeftigere Groesse fuer kleine Feldgroessen, Mittelwert UND
        // Anteil ab 0,80 statt eines zu groben Medians.
        const key = `${d.id}::${strom}::${n}`;
        const fixtureRhos = fixtureRhoJeDisziplinUndStrom.get(key) ?? [];
        const star = starJeDisziplinUndStrom.get(key) ?? { n: 0, rang1: 0, top2: 0 };
        const paar15 = paar15JeDisziplinUndStrom.get(key) ?? { n: 0, korrekt: 0 };
        const paar15SelbeSeite = paar15JeDisziplinUndStrom.get(`${key}::selbeSeite`) ?? { n: 0, korrekt: 0 };
        const paar15UeberSeiten = paar15JeDisziplinUndStrom.get(`${key}::ueberSeiten`) ?? { n: 0, korrekt: 0 };
        jeFeldgroesse[String(n)] = {
          median: median(rhos),
          spannweite: rhos.length ? Math.max(...rhos) - Math.min(...rhos) : null,
          n: rhos.length,
          fixtureRhoMittel: mean(fixtureRhos),
          fixtureRhoAnteilAb08: fixtureRhos.length ? fixtureRhos.filter((r) => r >= 0.8).length / fixtureRhos.length : null,
          fixtureRhoN: fixtureRhos.length,
          // OPUS-AUFLAGE 17.10. (dritte Runde, Task #175 ausgelagert): CLAUDE.md-Hockey-Methodik auf
          // Fixture-Ebene (2n Spieler) -- Entscheidungsgrundlage fuer Chris, ob kuenftig diese
          // Kennzahlen statt nacktem rho fuer kleine Feldgroessen gelten sollen.
          starRang1Pct: star.n ? star.rang1 / star.n : null,
          starTop2Pct: star.n ? star.top2 / star.n : null,
          starN: star.n,
          paartreueAb15Pct: paar15.n ? paar15.korrekt / paar15.n : null,
          paartreueAb15N: paar15.n,
          // OPUS-AUFLAGE 17.10. (vierte Runde): dieselbe Paartreue, aufgeschluesselt nach Seite --
          // s. Kommentar an der Erhebung oben. Unterscheidet Messartefakt (beide Eimer aehnlich
          // niedrig) von einem echten Verstoss gegen die PP-Team-Entkopplung (nur "ueberSeiten"
          // niedrig).
          paartreueAb15SelbeSeitePct: paar15SelbeSeite.n ? paar15SelbeSeite.korrekt / paar15SelbeSeite.n : null,
          paartreueAb15SelbeSeiteN: paar15SelbeSeite.n,
          paartreueAb15UeberSeitenPct: paar15UeberSeiten.n ? paar15UeberSeiten.korrekt / paar15UeberSeiten.n : null,
          paartreueAb15UeberSeitenN: paar15UeberSeiten.n,
        };
      }

      return {
        strom,
        spielerRhoMedianGesamt: median(alleRhos),
        spielerRhoSpannweiteGesamt: alleRhos.length ? Math.max(...alleRhos) - Math.min(...alleRhos) : null,
        spielerRhoSpieleGesamt: alleRhos.length,
        spielerRhoJeFeldgroesse: jeFeldgroesse,
        feldgroesse2Hinweis: "Nicht simuliert: Spearman bei n=2 ist mathematisch immer |rho|=1 (zwei Punkte liegen zwangslaeufig perfekt monoton) -- kein Erkenntniswert, kein Lauf noetig.",
        paartreueNachEignungsabstand: {
          "<2": { pct: paartreue(klein), n: klein.length },
          "2..15": { pct: paartreue(mittel), n: mittel.length },
          ">=15": { pct: paartreue(gross), n: gross.length },
        },
      };
    });
    teilA[d.id] = proStrom;
  }

  console.log("\n=== TEIL A: Spieler-rho (Eignung vs. vergebene PP), Feldgroessen", FELDGROESSEN_TEIL_A.join("/"), "===");
  for (const d of gewaehlt) {
    const zeilen = teilA[d.id] as any[];
    for (const z of zeilen) {
      const jeN = Object.entries(z.spielerRhoJeFeldgroesse).map(([n, v]: [string, any]) =>
        `n=${n}: Seite=${v.median?.toFixed(3) ?? "–"}(${v.n}) Fixture=${v.fixtureRhoMittel?.toFixed(3) ?? "–"}/${v.fixtureRhoAnteilAb08 != null ? (v.fixtureRhoAnteilAb08*100).toFixed(0)+"%" : "–"}(${v.fixtureRhoN}) Star1=${v.starRang1Pct != null ? (v.starRang1Pct*100).toFixed(0)+"%" : "–"} StarTop2=${v.starTop2Pct != null ? (v.starTop2Pct*100).toFixed(0)+"%" : "–"}(${v.starN}) Paar15=${v.paartreueAb15Pct != null ? (v.paartreueAb15Pct*100).toFixed(0)+"%" : "–"}(${v.paartreueAb15N}) [selbeSeite=${v.paartreueAb15SelbeSeitePct != null ? (v.paartreueAb15SelbeSeitePct*100).toFixed(0)+"%" : "–"}(${v.paartreueAb15SelbeSeiteN}) ueberSeiten=${v.paartreueAb15UeberSeitenPct != null ? (v.paartreueAb15UeberSeitenPct*100).toFixed(0)+"%" : "–"}(${v.paartreueAb15UeberSeitenN})]`,
      ).join(" | ");
      console.log(
        d.id.padEnd(14),
        `Strom ${z.strom}: Median(gepoolt)=${z.spielerRhoMedianGesamt?.toFixed(3)} Spannweite=${z.spielerRhoSpannweiteGesamt?.toFixed(3)} (Spiele=${z.spielerRhoSpieleGesamt}) | je Feldgroesse: ${jeN} | Paartreue <2:${(z.paartreueNachEignungsabstand["<2"].pct*100).toFixed(0)}%(n${z.paartreueNachEignungsabstand["<2"].n}) 2-15:${(z.paartreueNachEignungsabstand["2..15"].pct*100).toFixed(0)}%(n${z.paartreueNachEignungsabstand["2..15"].n}) >=15:${(z.paartreueNachEignungsabstand[">=15"].pct*100).toFixed(0)}%(n${z.paartreueNachEignungsabstand[">=15"].n})`,
      );
    }
  }

  const teilB: Record<string, unknown> = {};
  for (const d of gewaehlt) {
    const profil = resolveDisciplineWeightProfile(d.id);
    const matrixSumme = Object.values(profil).reduce((s, w) => s + Math.max(0, w ?? 0), 0);
    if (matrixSumme <= 0) { teilB[d.id] = { hinweis: "keine Gewichte" }; continue; }
    const proStrom = SAATSTROEME.map((strom) => {
      const key = `${d.id}::${strom}`;
      const einfluss = einflussJeDisziplinUndStrom.get(key) ?? {};
      const laeufe = einflussLaeufeJeDisziplinUndStrom.get(key) ?? 0;
      const einflussSumme = Object.values(einfluss).reduce((s, v) => s + v, 0);
      let ppAbweichung = 0;
      const anteile: Record<string, { matrixPct: number; gemessenPct: number; deltaPp: number }> = {};
      for (const attr of playerGeneratorAttributeKeys) {
        const matrixPct = (Math.max(0, (profil as Record<string, number>)[attr] ?? 0) / matrixSumme) * 100;
        const gemessenPct = einflussSumme > 0 ? ((einfluss[attr] ?? 0) / einflussSumme) * 100 : 0;
        const delta = Math.abs(matrixPct - gemessenPct);
        ppAbweichung += delta;
        anteile[attr] = { matrixPct: Number(matrixPct.toFixed(1)), gemessenPct: Number(gemessenPct.toFixed(1)), deltaPp: Number(delta.toFixed(1)) };
      }
      return { strom, laeufe, ppAbweichung: Number(ppAbweichung.toFixed(1)), anteile };
    });
    teilB[d.id] = proStrom;
  }

  console.log("\n=== TEIL B: Pp-Abweichung unter ECHTEN Bedingungen (reale KI-Aufstellung/Formkarten/Mutatoren/Team-Power) ===");
  for (const d of gewaehlt) {
    const eintrag = teilB[d.id] as any;
    if (eintrag?.hinweis) { console.log(d.id.padEnd(14), eintrag.hinweis); continue; }
    console.log(d.id.padEnd(14), eintrag.map((e: any) => `Strom ${e.strom}: Pp=${e.ppAbweichung} (Laeufe=${e.laeufe})`).join("  |  "));
  }

  const commit = (() => {
    try { return execSync("git rev-parse HEAD", { cwd: WURZEL, encoding: "utf8" }).trim(); } catch { return "unbekannt"; }
  })();

  const ausgabe = {
    hinweis: "Abnahme der PPS-Duell-Bruecke selbst (v3, Opus-Praezisierung 17.10. zu PR #1277). Teil A: Spearman-rho zwischen Spieler-Eignung (p.d) und vergebener individueller PP, JE TEAM-SEITE EINER DISZIPLIN AN EINEM SPIELTAG (= ein Spiel/Boxscore), n>=3 erzwungen (spearman() verwirft kleinere Seiten), gemessen JE FELDGROESSE (3/4/5/6) UND gepoolt, am echten Live-Save-Kader mit echter KI-Aufstellung; Feldgroesse 2 analytisch (immer |rho|=1) statt simuliert. Zusaetzlich Paartreue nach Team-Eignungsabstand (sekundaere Teamgroesse, NICHT die Abnahmezahl). Teil B: Pp-Abweichung des von der Bruecke konsumierten Score-Kanals UNTER ECHTEN BEDINGUNGEN (reale Formkarten/Mutatoren/Team-Power/Kapitaen/Fatigue/Verletzung/Moral, nur EIN Attribut eines bereits gefelderten Spielers angehoben, ueber die echte Liga-Rangabbildung), NUR bei Feldgroesse 6. Zwei unabhaengige Saatstroeme je Teil, fuer Teil A zusaetzlich ueber DISJUNKTE Spieltags-Fenster (sonst waere der Spieler-rho-Median fuer beide Stroeme bit-identisch, da er nicht von der Zufallspaarung abhaengt).",
    commit,
    datum: new Date().toISOString(),
    feldgroessenTeilA: FELDGROESSEN_TEIL_A,
    ppFeldgroesse: PP_FELDGROESSE,
    spieltageFensterJeStrom: Object.fromEntries(SAATSTROEME.map((s) => [s, spieltageJeStrom.get(s) ?? []])),
    ppTrialsJeSeite: PP_TRIALS_JE_SEITE,
    saatStroeme: SAATSTROEME,
    teilA, teilB,
  };
  writeFileSync(AUSGABE, `${JSON.stringify(ausgabe, null, 1)}\n`);
  console.error(`\n[geschrieben] ${AUSGABE} (commit ${commit})`);
}

main();
