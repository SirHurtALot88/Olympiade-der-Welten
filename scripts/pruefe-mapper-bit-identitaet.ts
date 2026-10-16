// MAPPER-BIT-IDENTITAETS-SONDE (entstanden aus einem Opus-Review-Fund an PR 1 #1269,
// docs/design/battle-arena-auto-run-anbindung-plan-16-10.md): scripts/pruefe-resolve-bit-identitaet.ts
// hasht nur die PREVIEW (buildLegacyMatchdayResolvePreview), die Ledger-LESUNG
// (buildSeasonPointsLedger) und die Nachbuchung (zieheSaisonstandPunkteNach) -- NIE den
// tatsaechlich GESCHRIEBENEN Payload aus mapLegacyMatchdayResolvePreviewToResultPayload(). Genau
// durch diese Luecke rutschte der Fund: `arenaAusfall: teamResult.arenaAusfall ?? null` schrieb
// den Schluessel additiv-gedacht, aber UNBEDINGT auf jede Zeile (auch Manager-Mode), waehrend der
// Preview-Hash unveraendert blieb, weil der Bug erst EINEN SCHRITT SPAETER (im Mapper) sass.
//
// STANDARD-NACHWEIS AB JETZT (Projektaufsicht, nach diesem Fund): fuer jeden PR, der Resolve/
// Mapper/Ledger anfasst -- insbesondere PR 3 (Arena-Vorlauf) -- VOR und NACH der Aenderung laufen
// lassen, je gegen eine EIGENE Kopie desselben Abbilds, und die Ausgaben mit `cmp`/`diff`
// vergleichen. Ergaenzt scripts/pruefe-resolve-bit-identitaet.ts, ersetzt es nicht -- beide
// zusammen decken Lesepfad (Preview/Ledger/Nachbuchung) UND Schreibpfad (Mapper-Payload) ab.
//
// WAS GEHASHT WIRD: je Save/Spieltag der volle `LegacyMatchdayResultWriteBundle` OHNE
// `auditPayload` (das traegt `forceReplace`/`replacedExistingResultId`, die von AUSSERHALB dieses
// Aufrufs kommen -- kein Teil des Mapper-Outputs selbst, s. `mapAuditRecord()` in
// legacy-matchday-result-apply-service.ts).
//
// ZUSAETZLICH: eine generische Schluessel-Praesenz-Zaehlung je optionalem/additivem Feld auf
// `disciplineResultPayloads` -- nicht nur `arenaAusfall` (das war der eine Fund), sondern jedes
// additive Feld, das demselben "nur bei Duell-Zeilen"-Muster folgen soll. Ein kuenftiger Bug
// derselben Klasse (ein additives Feld, das unbedingt statt additiv gesetzt wird) zeigt sich damit
// sofort als ploetzlicher Sprung in `schluesselPraesenzJeFeld` fuer einen Manager-Save, ohne dass
// dafuer ein neues Skript geschrieben werden muss.
//
// Aufruf: OLY_APP_SQLITE_PATH=<kopie> npx tsx scripts/pruefe-mapper-bit-identitaet.ts <ausgabe.json>
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import {
  mapLegacyMatchdayResolvePreviewToResultPayload,
  type DisciplineResultWritePayload,
} from "@/lib/resolve/legacy-matchday-result-mapper";
import { resolveGameMode } from "@/lib/season/game-mode";

const OPTIONALE_DISZIPLIN_ZEILEN_FELDER: readonly (keyof DisciplineResultWritePayload)[] = [
  "resolutionSource",
  "arenaMatchSeed",
  "momente",
  "arenaAusfall",
  "opponentTeamId",
  "marge",
  "verhaeltnis",
  "margeM90",
  "duellSeiten",
];

const ausgabe = process.argv[2] ?? "/dev/stdout";
const persistence = createPersistenceService();
const saves = persistence.listSaves();
const bericht: Record<string, unknown> = {};
for (const summary of saves) {
  const save = persistence.getSaveById(summary.saveId);
  if (!save) continue;
  const gs = save.gameState;
  const seasonId = gs.season.id;
  const proSpieltag: Record<string, string> = {};
  let zeilenGesamt = 0;
  const schluesselPraesenzJeFeld: Record<string, number> = Object.fromEntries(
    OPTIONALE_DISZIPLIN_ZEILEN_FELDER.map((feld) => [feld, 0]),
  );
  for (const matchdayId of gs.season.matchdayIds ?? []) {
    const contexts = gs.teams
      .map((team) => loadLocalLegacyLineupContextFromGameState(gs, { saveId: save.saveId, seasonId, matchdayId, teamId: team.teamId }))
      .flatMap((r) => (r.ok ? [r.context] : []));
    if (contexts.length === 0) continue;
    try {
      const preview = buildLegacyMatchdayResolvePreview(contexts);
      const bundle = mapLegacyMatchdayResolvePreviewToResultPayload({ preview, sourceVersion: "bit-identitaet-mapper" });
      for (const zeile of bundle.disciplineResultPayloads) {
        zeilenGesamt += 1;
        for (const feld of OPTIONALE_DISZIPLIN_ZEILEN_FELDER) {
          if (Object.prototype.hasOwnProperty.call(zeile, feld)) schluesselPraesenzJeFeld[feld] += 1;
        }
      }
      // auditPayload bewusst ausgeschlossen, s. Kopfkommentar.
      const { auditPayload: _auditPayload, ...ohneAudit } = bundle;
      proSpieltag[matchdayId] = createHash("sha256").update(JSON.stringify(ohneAudit)).digest("hex").slice(0, 16);
    } catch (error) {
      proSpieltag[matchdayId] = `FEHLER:${error instanceof Error ? error.message : String(error)}`;
    }
  }
  bericht[save.saveId] = {
    gameMode: resolveGameMode(gs),
    spieltage: proSpieltag,
    zeilenGesamt,
    schluesselPraesenzJeFeld,
  };
  console.error(
    `[mapper-bit-identitaet] ${save.saveId} ${resolveGameMode(gs)} ${Object.keys(proSpieltag).length} Spieltage, ` +
      `${zeilenGesamt} Zeilen, Schluesselpraesenz: ${JSON.stringify(schluesselPraesenzJeFeld)}`,
  );
}
writeFileSync(ausgabe, JSON.stringify(bericht, null, 1));
