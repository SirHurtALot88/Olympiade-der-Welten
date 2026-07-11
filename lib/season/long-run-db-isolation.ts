import fs from "node:fs";
import path from "node:path";

/**
 * 2026-07-04 incident: a background balancing/long-run process was pointed at the app's
 * default shared SQLite file (data/persistence/oly-app.sqlite) — the exact same file the
 * dev server / live browser UI reads via getActiveSave(). The long-run pipeline needs its
 * working save to be app-status "active" (several apply-services hard-require
 * `save.status === "active"`, e.g. training-settings-service, facility-*-service,
 * season-end-xp-apply-service), so activating its save flips the shared "active" pointer
 * and silently hijacks the user's live game (they saw the run's "S3 MD1" instead of their
 * own save). Simply never activating breaks those apply-services (`save_not_active`
 * blockers) instead.
 *
 * The correct fix is DB-file isolation, not just avoiding activation: give every long-run
 * process its own private SQLite file (a one-time clone of the shared file, if the target
 * save doesn't already live in an isolated copy). Activating inside that private copy is
 * then completely harmless — it never touches the file the live app/dev-server has open.
 *
 * Call this once, as the very first thing in a long-run entrypoint's main(), before any
 * `createPersistenceService()`/DB access. It mutates `process.env.OLY_APP_SQLITE_PATH` for
 * the current process and returns the resolved path (also used to build child-process env).
 */
export function ensureIsolatedLongRunDatabase(input: { outputDir: string; projectRoot: string }): {
  sqlitePath: string;
  isolated: boolean;
  clonedFromShared: boolean;
} {
  const explicit = process.env.OLY_APP_SQLITE_PATH;
  if (explicit) {
    return { sqlitePath: explicit, isolated: true, clonedFromShared: false };
  }
  if (process.env.OLY_LONG_RUN_ISOLATED_DB === "0") {
    const sharedPath = path.join(input.projectRoot, "data", "persistence", "oly-app.sqlite");
    return { sqlitePath: sharedPath, isolated: false, clonedFromShared: false };
  }

  fs.mkdirSync(input.outputDir, { recursive: true });
  const isolatedPath = path.join(input.outputDir, "balancing-run.sqlite");
  let clonedFromShared = false;

  if (!fs.existsSync(isolatedPath)) {
    const sharedPath = path.join(input.projectRoot, "data", "persistence", "oly-app.sqlite");
    if (fs.existsSync(sharedPath)) {
      fs.copyFileSync(sharedPath, isolatedPath);
      for (const suffix of ["-wal", "-shm"]) {
        const sidecar = `${sharedPath}${suffix}`;
        if (fs.existsSync(sidecar)) {
          fs.copyFileSync(sidecar, `${isolatedPath}${suffix}`);
        }
      }
      clonedFromShared = true;
      console.error(
        `[long-run-db-isolation] cloned shared DB -> ${isolatedPath} (one-time bootstrap; all further reads/writes for this run stay isolated)`,
      );
    } else {
      console.error(`[long-run-db-isolation] no shared DB found at ${sharedPath} — starting fresh isolated DB at ${isolatedPath}`);
    }
  }

  process.env.OLY_APP_SQLITE_PATH = isolatedPath;
  return { sqlitePath: isolatedPath, isolated: true, clonedFromShared };
}
