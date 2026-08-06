/**
 * GEMELDET: „boah du weißt doch was mein save ist, dann sag mir das nicht SONDERN FIX DAS ENDLICH
 * DASS DER SAVE IM GIT LANDET"
 *
 * BEFUND: `data/online-saves/` auf `main` stand seit dem 04.08. still, obwohl der Auto-Export-Timer
 * (`startOnlineSaveAutoExport`, alle 3 Minuten) lief.
 *
 * URSACHE: `publishToGitHub` committete lokal und pushte dann direkt `HEAD:<branch>` — mit
 * `allowFail: true`. Sobald der Branch weitergelaufen war (bei aktiver Entwicklung staendig),
 * lehnte GitHub den Push als non-fast-forward ab, der Fehler wurde geschluckt, und der lokale
 * Commit blieb liegen. Jeder weitere Zyklus lief in denselben Fehler: dauerhafter Stillstand.
 *
 * NEBENWIRKUNG, die es schlimmer macht: `deploy/hetzner/auto-deploy.sh` aktualisiert den Server mit
 * `git merge --ff-only origin/<branch>`. Ein liegengebliebener lokaler Commit macht Fast-Forward
 * unmoeglich — mit dem Export standen also auch die Deployments still.
 *
 * Diese Tests pruefen die Quelle statt eines echten Git-Ablaufs: der Ablauf braucht ein Remote,
 * einen zweiten Committer und ein Rennen zwischen beiden — das waere ein langsamer, wackliger
 * Test fuer eine Aussage, die sich an vier Zeilen ablesen laesst.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = () => readFileSync(join(process.cwd(), "lib/persistence/online-save-auto-export.ts"), "utf8");

/** Der Rumpf von `publishToGitHub`. */
function publishBlock(text: string) {
  const start = text.indexOf("async function publishToGitHub");
  expect(start, "publishToGitHub nicht gefunden — umbenannt?").toBeGreaterThan(-1);
  const ende = text.indexOf("function computeSignature", start);
  expect(ende).toBeGreaterThan(start);
  return text.slice(start, ende);
}

describe("Auto-Export: der Push kann sich nicht festfahren", () => {
  it("holt den Remote-Stand ein, BEVOR es pusht", () => {
    // Ohne das ist jeder Push nach dem ersten fremden Commit auf dem Branch chancenlos.
    const block = publishBlock(quelle());
    const rebaseAt = block.indexOf("rebase origin/");
    const pushAt = block.indexOf("push origin HEAD:");
    expect(rebaseAt, "kein Rebase auf den Remote-Stand").toBeGreaterThan(-1);
    expect(pushAt).toBeGreaterThan(-1);
    expect(rebaseAt, "der Rebase muss VOR dem Push laufen").toBeLessThan(pushAt);
  });

  it("nimmt den eigenen Commit zurueck, wenn der Push trotzdem abgelehnt wird", () => {
    // Der Kern: HEAD muss gleich origin/<branch> bleiben, sonst blockiert der liegengebliebene
    // Commit den `--ff-only`-Merge des Auto-Deploys. Die Dateien bleiben auf der Platte, der
    // naechste Zyklus versucht es erneut.
    const block = publishBlock(quelle());
    const pushAt = block.indexOf("push origin HEAD:");
    expect(block.slice(pushAt)).toContain("reset --mixed HEAD~1");
  });

  it("laesst auch bei gescheitertem Rebase nichts liegen", () => {
    const block = publishBlock(quelle());
    const rebaseFail = block.indexOf("rebase --abort");
    expect(rebaseFail, "kein Abbruchpfad fuer einen gescheiterten Rebase").toBeGreaterThan(-1);
    expect(block.slice(rebaseFail)).toContain("reset --mixed HEAD~1");
  });

  it("und auch dann nicht, wenn fremde Code-Commits den Push verbieten", () => {
    // Dieser Zweig existierte schon, liess den eigenen Commit aber ebenfalls stehen — mit exakt
    // derselben Blockade-Wirkung auf den Auto-Deploy.
    const block = publishBlock(quelle());
    const codeCommits = block.indexOf("offene-code-commits-vorhanden");
    expect(codeCommits).toBeGreaterThan(-1);
    const davor = block.slice(0, codeCommits);
    expect(davor.slice(davor.lastIndexOf("if (")), "kein Rueckbau vor dem Abbruch").toContain(
      "reset --mixed HEAD~1",
    );
  });
});
