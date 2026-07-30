/**
 * BUG-MELDUNGEN NACH GIT — damit sie den Rechner verlassen, auf dem gemeldet wurde.
 *
 * `docs/BUGFIXING_AGENT.md` beschreibt zwei Quellen: der Live-Server spiegelt sein Volume per
 * Cron auf den Branch `bug-reports`, und fuer lokal gespielte Runden stand dort bisher die
 * Handanweisung "also: git add data/bug-reports && git commit && git push. Sonst kennt der
 * Agent die Meldung nicht". Genau diese Handanweisung wird vergessen — die erste Meldung ist
 * daran verlorengegangen. Dieses Modul erledigt sie automatisch.
 *
 * DREI DINGE, DIE HIER NICHT PASSIEREN DUERFEN:
 *
 * 1. DEN ARBEITSSTAND DES SPIELERS ANFASSEN. Der Server laeuft im Arbeits-Repo. Ein
 *    beilaeufiges `git add`/`git commit` waere auf dem gerade ausgecheckten Branch gelandet
 *    und haette im schlimmsten Fall halbfertige Aenderungen mitgenommen — waehrend jemand
 *    spielt und gar nicht mitbekommt, dass da committet wird. Deshalb ausschliesslich
 *    Plumbing mit EIGENEM Index (`GIT_INDEX_FILE`): weder Arbeitsbaum noch Index noch HEAD
 *    werden beruehrt. Dieselbe Mechanik wie `deploy/hetzner/push-bug-reports.sh`.
 *
 * 2. DIE MELDUNGEN DER ANDEREN QUELLE UEBERSCHREIBEN. Das Server-Skript baut einen
 *    ELTERNLOSEN Commit und macht einen FORCE-Push — der Branch bleibt so immer genau ein
 *    Commit gross, statt bei jedem Cron-Lauf zu wachsen. Wuerde hier normal committet, waere
 *    alles lokal Gemeldete beim naechsten Cron-Lauf (alle 15 Minuten) spurlos weg.
 *
 *    Deshalb dieselbe Form auf BEIDEN Seiten: Baum = VEREINIGUNG aus dem, was schon auf dem
 *    Branch liegt, und dem, was hier liegt. Dann ist jeder Push idempotent, keine Quelle
 *    loescht die andere, und der Branch bleibt ein Commit gross.
 *
 * 3. DIE MELDUNG VERSCHLUCKEN, WEIL GIT ZICKT. Kein Remote, kein Netz, kaputte
 *    Konfiguration — die Datei ist zu diesem Zeitpunkt bereits geschrieben. Jeder Fehler wird
 *    zu einem Ergebniswert, nicht zu einer Exception.
 *
 * Weil der Baum aus ALLEN lokalen Meldungen gebildet wird (nicht nur der neuen), heilt sich
 * das von selbst: was beim letzten Mal nicht rausging, geht beim naechsten Mal mit.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Branch, auf dem die Meldungen liegen — derselbe wie beim Live-Server-Cron. */
export const BUG_REPORT_BRANCH = "bug-reports";

export type BugReportGitResult = {
  /** Der Commit ist gebaut — die Meldung ist damit versioniert. */
  committed: boolean;
  /** Der Commit ist beim Remote angekommen — erst dann kommt jemand anderes dran. */
  pushed: boolean;
  commitSha: string | null;
  /** Lokale Meldungen, die (noch) nicht auf dem Branch liegen. 0 = alles drueben. */
  unpushed: number | null;
  /** Klartext, wenn etwas schiefging. Nie geworfen — nur berichtet. */
  error: string | null;
};

function git(args: string[], options?: { env?: Record<string, string>; timeoutMs?: number }): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: options?.timeoutMs ?? 15_000,
    env: { ...process.env, ...options?.env },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryGit(args: string[], options?: { env?: Record<string, string>; timeoutMs?: number }): string | null {
  try {
    return git(args, options);
  } catch {
    return null;
  }
}

/**
 * Laeuft hier ueberhaupt ein Git-Repo?
 *
 * In Tests und in einer entpackten Kopie ohne `.git` soll gar nichts versucht werden — sonst
 * kostet jede Meldung mehrere fehlschlagende Prozessaufrufe, und ein Testlauf wuerde im
 * echten Repo committen.
 */
export function isBugReportGitAvailable(): boolean {
  if (process.env.OLY_BUG_REPORT_GIT === "0") return false;
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return false;
  return tryGit(["rev-parse", "--git-dir"], { timeoutMs: 3_000 }) != null;
}

/** Dateinamen der Meldungen, die schon auf dem Branch liegen. */
function listRemoteReportNames(): Set<string> {
  const listing = tryGit(["ls-tree", "-r", "--name-only", `refs/remotes/origin/${BUG_REPORT_BRANCH}`]);
  if (!listing) return new Set();
  return new Set(listing.split("\n").map((entry) => path.posix.basename(entry.trim())).filter(Boolean));
}

/**
 * Baut den Vereinigungs-Commit und schiebt ihn.
 *
 * Elternlos und mit Force-Push — genau die Form, die `push-bug-reports.sh` erzeugt. Beide
 * Seiten schreiben damit denselben Branch, ohne sich gegenseitig zu ueberschreiben.
 */
function buildAndPush(reportsDir: string, message: string, authorName: string): { commit: string | null; pushed: boolean } {
  const indexFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "oly-bug-git-")), "index");
  try {
    const env = { GIT_INDEX_FILE: indexFile };

    // Erst den Stand des Branches holen — sonst wuerde der Force-Push die Meldungen des
    // Live-Servers loeschen.
    tryGit(["fetch", "-q", "origin", `${BUG_REPORT_BRANCH}:refs/remotes/origin/${BUG_REPORT_BRANCH}`], {
      timeoutMs: 30_000,
    });
    const base = tryGit(["rev-parse", "--verify", `refs/remotes/origin/${BUG_REPORT_BRANCH}`]);
    if (tryGit(base ? ["read-tree", base] : ["read-tree", "--empty"], { env }) == null) {
      return { commit: null, pushed: false };
    }

    // ALLE lokalen Meldungen, nicht nur die neue: was beim letzten Mal nicht rausging, geht
    // dadurch jetzt mit.
    const localFiles = fs
      .readdirSync(reportsDir)
      .filter((name) => name.startsWith("bug-") && name.endsWith(".json"))
      .sort();
    for (const name of localFiles) {
      const blob = tryGit(["hash-object", "-w", path.join(reportsDir, name)]);
      if (!blob) continue;
      tryGit(["update-index", "--add", "--cacheinfo", `100644,${blob},data/bug-reports/${name}`], { env });
    }

    const tree = tryGit(["write-tree"], { env });
    if (!tree) return { commit: null, pushed: false };

    // Identitaet ueber Umgebungsvariablen statt ueber die lokale Git-Konfiguration: sonst
    // scheitert der Commit auf einem Rechner ohne `user.email` — und ausgerechnet dort will
    // man die Meldung ja auch haben.
    const commit = tryGit(["commit-tree", tree, "-m", message], {
      env: {
        GIT_AUTHOR_NAME: authorName,
        GIT_AUTHOR_EMAIL: "bug-report@olympiade-der-welten.local",
        GIT_COMMITTER_NAME: "Oly Bug-Melder",
        GIT_COMMITTER_EMAIL: "bug-report@olympiade-der-welten.local",
      },
    });
    if (!commit) return { commit: null, pushed: false };

    const pushed =
      tryGit(["push", "-f", "origin", `${commit}:refs/heads/${BUG_REPORT_BRANCH}`], { timeoutMs: 30_000 }) != null;
    if (pushed) {
      // Remote-Ref nachziehen, damit der naechste Lauf ohne Fetch auf dem richtigen Stand ist.
      tryGit(["update-ref", `refs/remotes/origin/${BUG_REPORT_BRANCH}`, commit]);
    }
    return { commit, pushed };
  } finally {
    fs.rmSync(path.dirname(indexFile), { recursive: true, force: true });
  }
}

export function commitAndPushBugReport(input: {
  absoluteFile: string;
  reportId: string;
  reporterLabel: string;
  summary: string;
}): BugReportGitResult {
  const empty: BugReportGitResult = { committed: false, pushed: false, commitSha: null, unpushed: null, error: null };
  if (!isBugReportGitAvailable()) {
    return { ...empty, error: "kein Git-Repo (oder per OLY_BUG_REPORT_GIT=0 abgeschaltet)" };
  }

  try {
    const reportsDir = path.dirname(input.absoluteFile);
    const { commit, pushed } = buildAndPush(
      reportsDir,
      `chore(bug-reports): ${input.reportId}\n\n${input.summary}\n`,
      input.reporterLabel,
    );
    if (!commit) return { ...empty, error: "Commit fehlgeschlagen" };

    const onBranch = listRemoteReportNames();
    const unpushed = fs
      .readdirSync(reportsDir)
      .filter((name) => name.startsWith("bug-") && name.endsWith(".json") && !onBranch.has(name)).length;

    return {
      committed: true,
      pushed,
      commitSha: commit,
      unpushed,
      error: pushed ? null : "Push fehlgeschlagen — die Meldung liegt lokal und geht beim nächsten Mal mit",
    };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "git_failed" };
  }
}
