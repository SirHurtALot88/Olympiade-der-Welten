/* eslint-disable no-console */
/**
 * Automatischer Online-Save-Export: hält `data/online-saves/` im Hintergrund aktuell, während
 * der Server läuft (kein Extra-Klick, keine Save-Latenz im Hot-Path, keine LLM-Kosten).
 *
 * Zwei Stufen, per Env geschaltet:
 *   OLY_AUTO_EXPORT_SAVES   (Default "1")  – Saves periodisch nach data/online-saves/ spiegeln (nur Dateien).
 *   OLY_AUTO_EXPORT_PUSH    (Default "0")  – geänderte Saves zusätzlich nach GitHub committen + pushen.
 *   OLY_AUTO_EXPORT_BRANCH  (Default "main")
 *   OLY_AUTO_EXPORT_INTERVAL_MS (Default 180000 = 3 min)
 *
 * Idle-Kosten ~0: über die `updatedAt`-Signatur aller Saves wird erkannt, ob sich überhaupt etwas
 * geändert hat — nur dann wird (teuer) gezippt/geschrieben. Der Git-Push ist bewusst abgesichert:
 * er pusht NUR, wenn alle offenen Commits ausschließlich `data/online-saves/` betreffen — so kann
 * der Timer niemals versehentlich unfertige Code-Commits mitpushen.
 */
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { exportOnlineSaves, ONLINE_SAVES_DIR } from "@/lib/persistence/online-save-export";

const exec = promisify(execCb);

const ONLINE_SAVES_PATHSPEC = "data/online-saves";

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value == null) return fallback;
  return value !== "0" && value.toLowerCase() !== "false";
}

async function git(args: string, opts?: { allowFail?: boolean }) {
  try {
    const { stdout } = await exec(`git ${args}`, { cwd: process.cwd(), timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
    return stdout.trim();
  } catch (error) {
    if (opts?.allowFail) return null;
    throw error;
  }
}

/**
 * Prüft, ob ALLE Commits zwischen origin/<branch> und HEAD ausschließlich data/online-saves/
 * berühren. Nur dann darf der Timer pushen (sonst lägen unfertige Code-Commits vor → nicht anfassen).
 */
async function pendingCommitsAreOnlySaves(branch: string) {
  const range = `origin/${branch}..HEAD`;
  const commits = await git(`rev-list ${range}`, { allowFail: true });
  if (commits == null) return false; // origin/<branch> unbekannt → lieber nicht pushen
  if (commits.length === 0) return true;
  for (const sha of commits.split("\n").filter(Boolean)) {
    const files = (await git(`diff-tree --no-commit-id --name-only -r ${sha}`, { allowFail: true })) ?? "";
    const nonSave = files.split("\n").filter((f) => f.trim() && !f.startsWith(`${ONLINE_SAVES_PATHSPEC}/`));
    if (nonSave.length > 0) return false;
  }
  return true;
}

async function publishToGitHub(branch: string) {
  // Nur data/online-saves stagen → der Timer-Commit ist immer reine Save-Daten.
  await git(`add -- ${ONLINE_SAVES_PATHSPEC}`);
  const staged = await git(`diff --cached --name-only -- ${ONLINE_SAVES_PATHSPEC}`, { allowFail: true });
  if (!staged) return { pushed: false, reason: "nichts-zu-committen" };

  await git(`commit -m "chore(saves): auto-export online saves [skip ci]" -- ${ONLINE_SAVES_PATHSPEC}`);

  if (!(await pendingCommitsAreOnlySaves(branch))) {
    return { pushed: false, reason: "offene-code-commits-vorhanden-push-uebersprungen" };
  }
  const pushed = await git(`push origin HEAD:${branch}`, { allowFail: true });
  return { pushed: pushed != null, reason: pushed != null ? "ok" : "push-fehlgeschlagen" };
}

function computeSignature() {
  const persistence = createPersistenceService();
  // updatedAt bewegt sich bei jedem Save-Write → billige Änderungserkennung ohne gzip.
  return persistence
    .listSaves()
    .map((s) => `${s.saveId}:${s.status}:${s.updatedAt}`)
    .sort()
    .join("|");
}

let started = false;

export function startOnlineSaveAutoExport() {
  if (started) return;
  if (!envFlag("OLY_AUTO_EXPORT_SAVES", true)) return;
  started = true;

  const intervalMs = Math.max(30_000, Number(process.env.OLY_AUTO_EXPORT_INTERVAL_MS ?? 180_000));
  const pushEnabled = envFlag("OLY_AUTO_EXPORT_PUSH", false);
  const branch = process.env.OLY_AUTO_EXPORT_BRANCH ?? "main";

  let lastSignature: string | null = null;
  let running = false;

  const tick = async () => {
    if (running) return; // Overlap vermeiden (langsamer Push nicht doppeln)
    running = true;
    try {
      const signature = computeSignature();
      if (signature === lastSignature) return; // nichts geändert → nichts tun (Idle-Kosten ~0)
      const result = exportOnlineSaves();
      lastSignature = signature;
      if (!result.changed) return;
      console.log(`[online-saves] exportiert: ${result.saves.length} Save(s) → ${ONLINE_SAVES_DIR}`);
      if (pushEnabled) {
        const outcome = await publishToGitHub(branch);
        console.log(`[online-saves] GitHub-Push: ${outcome.pushed ? "OK" : `übersprungen (${outcome.reason})`}`);
      }
    } catch (error) {
      console.error("[online-saves] Auto-Export-Fehler (wird nächsten Zyklus erneut versucht):", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };

  // Erststart leicht verzögert, damit der Serverstart nicht blockiert.
  const timer = setTimeout(() => {
    void tick();
    setInterval(() => void tick(), intervalMs).unref();
  }, 15_000);
  timer.unref();

  console.log(
    `[online-saves] Auto-Export aktiv (alle ${Math.round(intervalMs / 1000)}s, Push=${pushEnabled ? `an → ${branch}` : "aus"}).`,
  );
}
