import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  runChunkedRedraftTopup,
  type ChunkedRedraftTarget,
} from "@/lib/ai/chunked-redraft-topup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const WRITE_ENABLED = process.argv.includes("--write");
const RESUME_ENABLED = process.argv.includes("--resume");
const TARGET_ARG = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] as ChunkedRedraftTarget | undefined;
const ROUND_LIMIT = Number(process.argv.find((arg) => arg.startsWith("--round-limit="))?.split("=")[1] ?? 16);
const TEAM_TIME_LIMIT_MS = Number(process.argv.find((arg) => arg.startsWith("--team-time-limit-ms="))?.split("=")[1] ?? 10_000);
const OUTPUT_DIR = process.env.OLY_TOPUP_OUTPUT_DIR ?? process.env.OLY_EXPORT_DIR ?? "outputs";
const TARGET_SAVE_ID = process.env.OLY_TARGET_SAVE_ID ?? null;
const TARGET_SEASON_ID = process.env.OLY_TARGET_SEASON_ID ?? "season-1";

// Die Warnung geht bewusst auf stderr, nicht stdout: stdout bleibt reines JSON, das
// nachgelagerte Skripte/CI weiterverarbeiten. Wer stdout in eine Datei umleitet, soll
// die Warnung trotzdem auf dem Terminal sehen -- genau dafuer ist stderr da. Sie steht
// am Anfang UND am Ende, weil lange Laeufe die erste Zeile im Terminal-Scrollback
// begraben, bevor jemand die Ausgabe liest.
const DRY_RUN_BANNER =
  "TROCKENLAUF -- es wurde nichts geschrieben. Mit --write ausfuehren.";

function main() {
  const persistence = createPersistenceService();
  const save = (TARGET_SAVE_ID ? persistence.getSaveById(TARGET_SAVE_ID) : null) ?? persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  if (!save) throw new Error("No active local save available.");

  if (!WRITE_ENABLED) console.error(DRY_RUN_BANNER);

  const result = runChunkedRedraftTopup({
    persistence,
    saveId: save.saveId,
    seasonId: TARGET_SEASON_ID,
    dryRun: !WRITE_ENABLED,
    confirmToken: WRITE_ENABLED ? CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN : null,
    mode: "season1_initial_topup",
    resume: RESUME_ENABLED,
    target: TARGET_ARG === "playerMax" ? "playerMax" : TARGET_ARG === "playerOpt" ? "playerOpt" : "playerMin",
    roundLimit: Number.isFinite(ROUND_LIMIT) ? ROUND_LIMIT : 16,
    teamTimeLimitMs: Number.isFinite(TEAM_TIME_LIMIT_MS) ? TEAM_TIME_LIMIT_MS : 10_000,
    outputDir: OUTPUT_DIR,
  });

  // `result.dryRun` kommt aus dem Service und ist dort schon der oberste Key der
  // JSON-Ausgabe (siehe runChunkedRedraftTopup) -- hier kommt nur noch die zweite,
  // unuebersehbare Warnung auf stderr dazu, damit ein Trockenlauf niemals wie ein
  // durchgefuehrter Lauf aussieht.
  console.log(JSON.stringify(result, null, 2));
  if (!WRITE_ENABLED) console.error(DRY_RUN_BANNER);
  if (result.summary.teamsBelowMin.length > 0) {
    process.exitCode = 1;
  }
}

main();
