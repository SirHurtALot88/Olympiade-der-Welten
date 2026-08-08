/* eslint-disable no-console */
/**
 * Automatischer Online-Save-Export: hält `data/online-saves/` im Hintergrund aktuell, während
 * der Server läuft (kein Extra-Klick, keine Save-Latenz im Hot-Path, keine LLM-Kosten).
 *
 * Zwei Stufen, per Env geschaltet:
 *   OLY_AUTO_EXPORT_SAVES   (Default "1")  – Saves periodisch nach data/online-saves/ spiegeln (nur Dateien).
 *   OLY_AUTO_EXPORT_PUSH    (Default "1")  – geänderte Saves zusätzlich nach GitHub committen + pushen.
 *                                            Stand vorher auf "0"; damit landeten gespielte Saves zwar
 *                                            im Ordner, aber nie im Repo — sie waren in keiner Session
 *                                            und keinem Clone verfügbar, obwohl der Ordner sie zeigte.
 *                                            Zum Abschalten: OLY_AUTO_EXPORT_PUSH=0.
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

import { computeBugReportSignature } from "@/lib/bug-report/bug-report-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { exportOnlineSaves, ONLINE_SAVES_DIR } from "@/lib/persistence/online-save-export";

const exec = promisify(execCb);

const ONLINE_SAVES_PATHSPEC = "data/online-saves";

/**
 * Bug-Meldungen fahren auf demselben Weg mit.
 *
 * Auf dem Hetzner-Server holt `deploy/hetzner/push-bug-reports.sh` sie per Cron aus dem Container.
 * Fuer einen LOKAL gestarteten Server gab es diesen Weg nicht: die Meldung landete in
 * `data/bug-reports/` auf der eigenen Platte und blieb dort liegen — niemand ausser dem Rechner
 * selbst hat sie je gesehen. Genau derselbe Defekt wie bei den Saves vor dem Auto-Push.
 *
 * Bewusst nach `main` und nicht auf den Branch `bug-reports`: das Server-Skript spiegelt dorthin
 * mit einem elternlosen Force-Push seines kompletten Volume-Inhalts. Wuerde der lokale Rechner auf
 * denselben Branch pushen, ueberschrieben sich beide Seiten gegenseitig. Zwei Quellen, zwei
 * Ablagen — dafuer geht keine Meldung verloren.
 */
const BUG_REPORTS_PATHSPEC = "data/bug-reports";

const DATA_PATHSPECS = [ONLINE_SAVES_PATHSPEC, BUG_REPORTS_PATHSPEC];

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
 * Prüft, ob ALLE Commits zwischen origin/<branch> und HEAD ausschließlich Datenordner
 * (data/online-saves/, data/bug-reports/) berühren. Nur dann darf der Timer pushen (sonst lägen
 * unfertige Code-Commits vor → nicht anfassen).
 */
async function pendingCommitsAreOnlyData(branch: string) {
  const range = `origin/${branch}..HEAD`;
  const commits = await git(`rev-list ${range}`, { allowFail: true });
  if (commits == null) return false; // origin/<branch> unbekannt → lieber nicht pushen
  if (commits.length === 0) return true;
  for (const sha of commits.split("\n").filter(Boolean)) {
    const files = (await git(`diff-tree --no-commit-id --name-only -r ${sha}`, { allowFail: true })) ?? "";
    const nonData = files
      .split("\n")
      .filter((f) => f.trim() && !DATA_PATHSPECS.some((pathspec) => f.startsWith(`${pathspec}/`)));
    if (nonData.length > 0) return false;
  }
  return true;
}

async function publishToGitHub(branch: string) {
  // Nur die Datenordner stagen → der Timer-Commit enthält niemals Code.
  const pathspecs = DATA_PATHSPECS.join(" ");
  await git(`add -- ${pathspecs}`);
  const staged = await git(`diff --cached --name-only -- ${pathspecs}`, { allowFail: true });
  if (!staged) return { pushed: false, reason: "nichts-zu-committen" };

  // Die Nachricht nennt, was wirklich drin ist: eine Meldung, die als "auto-export online saves"
  // durchläuft, findet später niemand wieder.
  const stagedFiles = staged.split("\n").filter(Boolean);
  const reportCount = stagedFiles.filter((f) => f.startsWith(`${BUG_REPORTS_PATHSPEC}/`)).length;
  const saveCount = stagedFiles.length - reportCount;
  const parts = [
    saveCount > 0 ? `${saveCount} Save(s)` : null,
    reportCount > 0 ? `${reportCount} Bug-Meldung(en)` : null,
  ].filter(Boolean);
  await git(`commit -m "chore(daten): auto-export ${parts.join(" + ")} [skip ci]" -- ${pathspecs}`);

  if (!(await pendingCommitsAreOnlyData(branch))) {
    await git(`reset --mixed HEAD~1`, { allowFail: true });
    return { pushed: false, reason: "offene-code-commits-vorhanden-push-uebersprungen" };
  }

  // VOR dem Push den Remote-Stand einholen.
  //
  // GEMELDET: „FIX DAS ENDLICH DASS DER SAVE IM GIT LANDET". Hier war die Ursache: der Push ging
  // direkt auf `HEAD:<branch>`. Sobald der Branch weitergelaufen ist — bei aktiver Entwicklung
  // staendig — lehnt GitHub ihn als non-fast-forward ab. `allowFail` schluckte das, der lokale
  // Commit blieb liegen, und der naechste Zyklus lief in exakt denselben Fehler. Dauerhafter
  // Stillstand, sichtbar nur als eine Logzeile.
  //
  // Schlimmer noch die Nebenwirkung: `deploy/hetzner/auto-deploy.sh` aktualisiert mit
  // `git merge --ff-only origin/<branch>`. Ein liegengebliebener lokaler Commit macht das
  // unmoeglich — mit dem Export standen also auch die Deployments still.
  await git(`fetch origin ${branch}`, { allowFail: true });
  const rebased = await git(`rebase origin/${branch}`, { allowFail: true });
  if (rebased == null) {
    // Rebase gescheitert (z. B. Konflikt in einer generierten Datei): sauber zuruecktreten statt
    // einen halben Zustand stehen zu lassen.
    await git(`rebase --abort`, { allowFail: true });
    await git(`reset --mixed HEAD~1`, { allowFail: true });
    return { pushed: false, reason: "rebase-fehlgeschlagen" };
  }

  const pushed = await git(`push origin HEAD:${branch}`, { allowFail: true });
  if (pushed == null) {
    // Auch nach dem Rebase abgelehnt (Rennen mit einem anderen Push). Den eigenen Commit wieder
    // aufloesen, damit HEAD gleich `origin/<branch>` bleibt und der Auto-Deploy weiter
    // fast-forwarden kann. Die Dateien bleiben auf der Platte — der naechste Zyklus committet
    // und versucht es erneut. So kann sich NICHTS dauerhaft festfahren.
    await git(`reset --mixed HEAD~1`, { allowFail: true });
    return { pushed: false, reason: "push-abgelehnt-commit-zurueckgenommen" };
  }
  return { pushed: true, reason: "ok" };
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


/**
 * Erkennt Fehler, die bedeuten: in DIESER Umgebung kann der Push nie gelingen.
 *
 * Abgegrenzt gegen die voruebergehenden Faelle (Netz weg, Remote weitergelaufen, Sperrdatei) — die
 * sollen weiterhin im naechsten Zyklus erneut versucht werden. Nur „kein Repository" und „kein git"
 * sind endgueltig: daran aendert kein Wiederholen etwas.
 *
 * Die Texte stammen wortwoertlich aus dem Server-Log (siehe Kommentar bei `pushEnabled`).
 */
export function istPushInDieserUmgebungAussichtslos(fehlertext: string): boolean {
  return /not a git repository|git: not found|command not found/i.test(fehlertext);
}

let started = false;

export function startOnlineSaveAutoExport() {
  if (started) return;
  if (!envFlag("OLY_AUTO_EXPORT_SAVES", true)) return;
  started = true;

  const intervalMs = Math.max(30_000, Number(process.env.OLY_AUTO_EXPORT_INTERVAL_MS ?? 180_000));
  /**
   * VERAENDERLICH, weil der Push sich selbst stilllegen koennen muss.
   *
   * GEMELDET: „fix den auto export endlich mal". Im Server-Log stand seit Wochen alle 180 Sekunden:
   *
   *     [online-saves] exportiert: 15 Save(s) → /app/data/online-saves
   *     [online-saves] Auto-Export-Fehler: Command failed: git add -- data/online-saves data/bug-reports
   *     fatal: not a git repository (or any of the parent directories): .git
   *
   * `git` ist inzwischen im Image (die frueher hier gepruefte Ursache), aber `/app` ist ein
   * BUILD-ERGEBNIS und kein Checkout — kein Repository, keine Zugangsdaten. Der Push aus dem
   * Container heraus kann prinzipiell nicht gelingen, egal wie oft man es versucht.
   *
   * Ein Fehler im Minutentakt ist nach dem dritten Mal keine Meldung mehr, sondern Tapete: er stand
   * wochenlang daneben und wurde nicht mehr gelesen. Deshalb legt der Push sich beim ersten
   * belegten Fehlschlag selbst still und sagt EINMAL, was stattdessen greift —
   * `deploy/hetzner/push-live-save.sh` auf dem HOST, laut Projektdoku ohnehin der vorgesehene Weg.
   *
   * Der Export in den Ordner laeuft weiter: die Dateien sind auch ohne Push nuetzlich.
   */
  let pushEnabled = envFlag("OLY_AUTO_EXPORT_PUSH", true);
  const branch = process.env.OLY_AUTO_EXPORT_BRANCH ?? "main";

  let lastSignature: string | null = null;
  let lastBugReportSignature: string | null = null;
  let running = false;

  const tick = async () => {
    if (running) return; // Overlap vermeiden (langsamer Push nicht doppeln)
    running = true;
    try {
      const signature = computeSignature();
      const bugReportSignature = computeBugReportSignature();
      // Nichts geändert → nichts tun (Idle-Kosten ~0). Beide Quellen zählen: eine neue Meldung
      // allein muss reichen, sonst bliebe sie bis zum nächsten Spielzug liegen.
      if (signature === lastSignature && bugReportSignature === lastBugReportSignature) return;

      let publish = false;
      if (signature !== lastSignature) {
        // `prune: false`: der Timer laeuft unbeaufsichtigt in JEDER Umgebung, die den Server
        // startet — auch in Containern, deren Store nur Smoke-Saves enthaelt. Mit Loeschabgleich
        // raeumt so eine Umgebung fremde Spielstaende aus `data/online-saves/` und pusht das nach
        // `main`. Aufraeumen bleibt dem ausdruecklichen CLI-Export vorbehalten.
        const result = exportOnlineSaves({ prune: false });
        lastSignature = signature;
        if (result.changed) {
          console.log(`[online-saves] exportiert: ${result.saves.length} Save(s) → ${ONLINE_SAVES_DIR}`);
          publish = true;
        }
      }
      if (bugReportSignature !== lastBugReportSignature) {
        // Beim ersten Zyklus ist der Vergleichswert null — dann steht hier nur, was ohnehin schon
        // im Repo liegt, und `publishToGitHub` findet nichts zu committen. Kostet einen Leerlauf,
        // spart eine Sonderbehandlung.
        lastBugReportSignature = bugReportSignature;
        publish = true;
      }
      if (!publish) return;

      if (pushEnabled) {
        const outcome = await publishToGitHub(branch);
        console.log(`[online-saves] GitHub-Push: ${outcome.pushed ? "OK" : `übersprungen (${outcome.reason})`}`);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (istPushInDieserUmgebungAussichtslos(text)) {
        pushEnabled = false;
        console.warn(
          "[online-saves] PUSH ABGESCHALTET — diese Umgebung hat kein Git-Repository unter dem App-Verzeichnis.\n" +
            `[online-saves] Grund: ${text.split("\n").filter(Boolean).pop()}\n` +
            `[online-saves] Exportiert wird weiter nach ${ONLINE_SAVES_DIR}; nur das Hochladen entfaellt.\n` +
            "[online-saves] Auf dem Server uebernimmt `deploy/hetzner/push-live-save.sh` (Cron, Branch live-save).\n" +
            "[online-saves] Diese Meldung erscheint genau einmal pro Start.",
        );
        return;
      }
      console.error("[online-saves] Auto-Export-Fehler (wird nächsten Zyklus erneut versucht):", text);
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

  /**
   * EINMAL BEIM START PRUEFEN, OB DER PUSH UEBERHAUPT KANN.
   *
   * GEFUNDEN IM SERVER-LOG, alle 180 Sekunden, seit dem ersten Tag:
   *     [online-saves] exportiert: 8 Save(s) → /app/data/online-saves
   *     [online-saves] Auto-Export-Fehler: Command failed: git add -- ...
   *     /bin/sh: 1: git: not found
   *
   * Das Laufzeit-Image hatte kein git. Der Export meldete Erfolg, der Push-Fehler stand eine Zeile
   * darunter — und weil er sich alle drei Minuten wiederholte, sah er aus wie Rauschen. Ueber Wochen
   * kam so kein einziger echter Spielstand ins Repo, und niemand hat es bemerkt.
   *
   * Eine Meldung beim Start ist etwas anderes als dieselbe Meldung im Minutentakt: sie steht einmal
   * da, ganz oben, und sagt was zu tun ist. Der Zyklus laeuft trotzdem weiter — die Dateien im
   * Ordner sind auch ohne Push nuetzlich (`push-live-save.sh` auf dem Host nimmt sie mit).
   */
  if (pushEnabled) {
    void git("--version", { allowFail: true }).then((version) => {
      if (version) return;
      console.warn(
        "[online-saves] ACHTUNG: `git` ist in dieser Umgebung nicht aufrufbar — der Auto-PUSH kann nicht laufen.\n" +
          "[online-saves] Exportiert wird weiter in den Ordner, aber nichts landet im Repo.\n" +
          "[online-saves] Im Docker-Image gehoert `git` in die Paketliste des runner-Stage (siehe Dockerfile).\n" +
          "[online-saves] Zum Abschalten dieser Meldung: OLY_AUTO_EXPORT_PUSH=0.",
      );
    });
  }
}
