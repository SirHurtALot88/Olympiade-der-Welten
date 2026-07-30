/**
 * BUG-MELDUNGEN MUESSEN DEN RECHNER VERLASSEN — OHNE ETWAS ANDERES KAPUTTZUMACHEN.
 *
 * `docs/BUGFIXING_AGENT.md` hatte fuer lokal gespielte Runden eine Handanweisung: "also: git
 * add data/bug-reports && git commit && git push. Sonst kennt der Agent die Meldung nicht."
 * Genau die wird vergessen — die erste Meldung ist daran verlorengegangen. Der Transport
 * laeuft jetzt automatisch, und dieser Test misst nach, dass dabei nichts verloren geht.
 *
 * Zwei Gefahren, beide hier festgenagelt:
 *  1. Der Server laeuft im Arbeits-Repo des Spielers. Ein beilaeufiges `git add`/`git commit`
 *     waere auf dessen ausgechecktem Branch gelandet, womoeglich mitten in halbfertiger
 *     Arbeit.
 *  2. `deploy/hetzner/push-bug-reports.sh` macht alle 15 Minuten einen FORCE-Push eines
 *     elternlosen Commits auf denselben Branch. Ohne Vereinigung waere alles lokal Gemeldete
 *     beim naechsten Cron-Lauf lautlos weg.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commitAndPushBugReport } from "@/lib/bug-report/bug-report-git";

let remote = "";
let work = "";
let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;

const git = (cwd: string, args: string[], env?: Record<string, string>) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  }).trim();

function reportsDir() {
  return path.join(work, "data", "bug-reports");
}

function writeReport(name: string) {
  const file = path.join(reportsDir(), `${name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `{"reportId":"${name}"}\n`, "utf8");
  return file;
}

function report(name: string) {
  return commitAndPushBugReport({
    absoluteFile: writeReport(name),
    reportId: name,
    reporterLabel: "Chris",
    summary: `Spieltag · Arena\nTestspiel · Spieltag 7\n${name}`,
  });
}

/** Was liegt auf dem Branch? */
function onBranch() {
  return git(remote, ["ls-tree", "-r", "--name-only", `refs/heads/bug-reports`]).split("\n").filter(Boolean);
}

/**
 * Stellt EINEN Cron-Lauf des Live-Servers nach: elternloser Commit aus der VEREINIGUNG von
 * Branch-Inhalt und Container-Dateien, Force-Push. Spiegelt `push-bug-reports.sh`.
 */
function simulateServerCron(containerReports: string[]) {
  const server = fs.mkdtempSync(path.join(os.tmpdir(), "bug-git-server-"));
  git(server, ["init", "-q", "-b", "main"]);
  git(server, ["config", "user.email", "s@s"]);
  git(server, ["config", "user.name", "S"]);
  git(server, ["remote", "add", "origin", remote]);
  const index = path.join(server, ".oly-index");
  const env = { GIT_INDEX_FILE: index };

  // Beim allerersten Lauf gibt es den Branch noch nicht — im Skript steht dafuer
  // `2>/dev/null || true`, hier der entsprechende Fang.
  const hasBranch = (() => {
    try {
      git(server, ["fetch", "-q", "origin", "bug-reports"], env);
      git(server, ["rev-parse", "--verify", "-q", "refs/remotes/origin/bug-reports"]);
      return true;
    } catch {
      return false;
    }
  })();
  git(server, ["read-tree", ...(hasBranch ? ["refs/remotes/origin/bug-reports"] : ["--empty"])], env);

  for (const name of containerReports) {
    const file = path.join(server, `${name}.json`);
    fs.writeFileSync(file, `{"reportId":"${name}"}\n`, "utf8");
    const blob = git(server, ["hash-object", "-w", file]);
    git(server, ["update-index", "--add", "--cacheinfo", `100644,${blob},data/bug-reports/${name}.json`], env);
  }
  const tree = git(server, ["write-tree"], env);
  const commit = git(server, ["commit-tree", tree, "-m", "chore(bug-reports): vom Live-Server"], {
    GIT_AUTHOR_NAME: "S",
    GIT_AUTHOR_EMAIL: "s@s",
    GIT_COMMITTER_NAME: "S",
    GIT_COMMITTER_EMAIL: "s@s",
  });
  git(server, ["push", "-f", "origin", `${commit}:refs/heads/bug-reports`]);
  fs.rmSync(server, { recursive: true, force: true });
}

beforeEach(() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bug-git-test-"));
  remote = path.join(root, "remote");
  work = path.join(root, "work");
  fs.mkdirSync(work, { recursive: true });
  git(root, ["init", "--bare", "-q", remote]);
  git(work, ["init", "-q", "-b", "main"]);
  git(work, ["config", "user.email", "t@t"]);
  git(work, ["config", "user.name", "T"]);
  fs.mkdirSync(reportsDir(), { recursive: true });
  fs.writeFileSync(path.join(reportsDir(), "README.md"), "x\n", "utf8");
  git(work, ["add", "-A"]);
  git(work, ["commit", "-qm", "init"]);
  git(work, ["remote", "add", "origin", remote]);
  git(work, ["push", "-q", "-u", "origin", "main"]);

  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(work);
  // Der Transport ist in Tests bewusst abgeschaltet, sonst wuerde jeder Testlauf im echten
  // Repo committen. Fuer DIESEN Test wird er gezielt eingeschaltet.
  vi.stubEnv("OLY_BUG_REPORT_GIT", "1");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VITEST", "");
});

afterEach(() => {
  cwdSpy?.mockRestore();
  vi.unstubAllEnvs();
  fs.rmSync(path.dirname(work), { recursive: true, force: true });
});

describe("Bug-Meldung nach Git", () => {
  it("committet und pusht die Meldung", () => {
    const result = report("bug-1");
    expect(result.committed).toBe(true);
    expect(result.pushed).toBe(true);
    expect(result.unpushed).toBe(0);
    expect(result.error).toBeNull();
    expect(onBranch()).toEqual(["data/bug-reports/bug-1.json"]);
  });

  /**
   * DER KERN GEGEN DEN SPIELER. Ohne eigenen Index wuerde `update-index` im Index des
   * Spielers landen und dort Eintraege stagen, die er nie angefasst hat.
   */
  it("laesst Arbeitsbaum, Index und HEAD des Spielers unberuehrt", () => {
    fs.writeFileSync(path.join(work, "offene-arbeit.txt"), "halbfertig\n", "utf8");
    const headBefore = git(work, ["rev-parse", "HEAD"]);
    const branchBefore = git(work, ["rev-parse", "--abbrev-ref", "HEAD"]);

    report("bug-1");

    expect(git(work, ["rev-parse", "HEAD"])).toBe(headBefore);
    expect(git(work, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(branchBefore);
    // Nichts gestaged: offene Arbeit UND Meldung sind weiterhin bloss untracked.
    expect(git(work, ["diff", "--cached", "--name-only"])).toBe("");
    const status = git(work, ["status", "--short"]);
    expect(status).toContain("?? offene-arbeit.txt");
    expect(status).toContain("?? data/bug-reports/bug-1.json");
  });

  /**
   * DER KERN GEGEN DEN CRON. Das Server-Skript force-pusht einen elternlosen Commit — ohne
   * Vereinigung waere die lokale Meldung nach 15 Minuten weg, lautlos.
   */
  it("ueberlebt einen Force-Push des Live-Servers", () => {
    report("bug-lokal");
    simulateServerCron(["bug-server"]);
    expect(onBranch()).toEqual(["data/bug-reports/bug-lokal.json", "data/bug-reports/bug-server.json"]);
  });

  /** Und andersherum: die lokale Meldung darf die des Servers nicht loeschen. */
  it("loescht die Meldungen des Live-Servers nicht", () => {
    simulateServerCron(["bug-server"]);
    report("bug-lokal");
    expect(onBranch()).toEqual(["data/bug-reports/bug-lokal.json", "data/bug-reports/bug-server.json"]);
  });

  it("legt weitere Meldungen dazu, statt sie zu ersetzen", () => {
    report("bug-1");
    report("bug-2");
    expect(onBranch()).toEqual(["data/bug-reports/bug-1.json", "data/bug-reports/bug-2.json"]);
  });

  /** Der Branch bleibt EIN Commit gross — sonst waechst er bei jeder Meldung. */
  it("haelt den Branch bei einem einzigen elternlosen Commit", () => {
    report("bug-1");
    report("bug-2");
    expect(git(remote, ["rev-list", "--count", "refs/heads/bug-reports"])).toBe("1");
  });

  it("stellt Melder und Kontext in die Commit-Nachricht", () => {
    report("bug-1");
    const message = git(remote, ["log", "-1", "--format=%an|%s|%b", "refs/heads/bug-reports"]);
    expect(message).toContain("Chris");
    expect(message).toContain("bug-1");
    expect(message).toContain("Spieltag · Arena");
  });

  /**
   * Kein Netz, keine Rechte, kein Remote — die Meldung ist zu diesem Zeitpunkt schon
   * geschrieben und darf nicht an Git scheitern.
   */
  it("verschluckt die Meldung nicht, wenn der Push scheitert", () => {
    git(work, ["remote", "set-url", "origin", "/nirgendwo/kaputt.git"]);
    const result = report("bug-1");
    expect(result.committed).toBe(true);
    expect(result.pushed).toBe(false);
    expect(result.unpushed).toBe(1);
    expect(result.error).toContain("nächsten Mal");
  });

  /** Selbstheilend: der Baum wird aus ALLEN lokalen Meldungen gebildet, nicht nur der neuen. */
  it("holt liegen gebliebene Meldungen beim naechsten erfolgreichen Push nach", () => {
    git(work, ["remote", "set-url", "origin", "/nirgendwo/kaputt.git"]);
    expect(report("bug-1").pushed).toBe(false);

    git(work, ["remote", "set-url", "origin", remote]);
    const second = report("bug-2");
    expect(second.pushed).toBe(true);
    expect(second.unpushed).toBe(0);
    // BEIDE sind drueben — auch die, deren eigener Push gescheitert war.
    expect(onBranch()).toEqual(["data/bug-reports/bug-1.json", "data/bug-reports/bug-2.json"]);
  });

  it("meldet sauber zurueck, wenn gar kein Git-Repo da ist", () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "bug-git-norepo-"));
    cwdSpy?.mockReturnValue(bare);
    const result = commitAndPushBugReport({
      absoluteFile: path.join(bare, "x.json"),
      reportId: "bug-1",
      reporterLabel: "Chris",
      summary: "x",
    });
    expect(result.committed).toBe(false);
    expect(result.error).toContain("kein Git-Repo");
    fs.rmSync(bare, { recursive: true, force: true });
  });
});
