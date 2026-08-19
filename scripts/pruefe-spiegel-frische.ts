/* eslint-disable no-console */
/**
 * WIE ALT SIND DIE SPIEGEL VOM HETZNER-SERVER?
 *
 * GEMELDET VON CHRIS (19.08.): „moment heute haben wir den 19.08. und ich habe ingame reportet!
 * wenn das letzte vom 14.08. ist fehlt was!"
 *
 * NACHGEMESSEN — und es war groesser als die Bug-Meldungen:
 *
 *   live-save     letzter Push  14.08. 07:50
 *   bug-reports   letzter Push  14.08. 07:52
 *
 * Beide Crons stehen seit demselben Zyklus. Fuenf Tage lang hat das niemand bemerkt, weil nichts
 * fehlschlaegt — es passiert nur schlicht nichts. Genau diese Sorte Ausfall ist die teuerste:
 * Agenten arbeiten weiter am alten Abbild und halten es fuer den aktuellen Stand.
 *
 * WARUM DAS NICHT SCHON AUFFIEL: es gibt eine Frische-Pruefung (`pruefe-save-abbild-frische.ts`),
 * aber der SessionStart-Hook ruft sie nur, wenn er auch WIRKLICH importiert. Ist im Store schon
 * ein Spielstand, bricht er vorher ab — also ausgerechnet in dem Fall, in dem ein veraltetes
 * Abbild am gefaehrlichsten ist. Diese Pruefung haengt deshalb in BEIDEN Zweigen.
 *
 * Sie beantwortet eine andere Frage als das Schwesterskript: nicht „passt das Abbild zu seinem
 * Push-Zeitpunkt", sondern „wann hat der Server ueberhaupt zuletzt gesprochen".
 *
 *     npx tsx scripts/pruefe-spiegel-frische.ts
 *
 * Endet immer mit 0 — eine Warnung darf keine Sitzung und keinen Deploy umwerfen.
 */
import { execFileSync } from "node:child_process";

/** Beide Crons laufen im Minutentakt bis Viertelstundentakt. Ein Tag Stille ist bereits viel. */
const WARNSCHWELLE_STUNDEN = 24;

const SPIEGEL = [
  { branch: "live-save", was: "Spielstaende", skript: "deploy/hetzner/push-live-save.sh" },
  { branch: "bug-reports", was: "In-Game-Meldungen", skript: "deploy/hetzner/push-bug-reports.sh" },
] as const;

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function main() {
  const jetzt = Date.now();
  const veraltet: Array<{ branch: string; was: string; stunden: number; skript: string }> = [];
  const zeilen: string[] = [];

  for (const spiegel of SPIEGEL) {
    // Ohne Fetch misst man den lokalen Stand von irgendwann — also gar nichts.
    git(["fetch", "--quiet", "origin", spiegel.branch]);
    const gepusht = git(["log", "-1", "--format=%cI", `origin/${spiegel.branch}`]);
    if (!gepusht) {
      zeilen.push(`  ${spiegel.branch.padEnd(12)} kein Branch gefunden`);
      continue;
    }
    const stunden = (jetzt - new Date(gepusht).getTime()) / 3_600_000;
    const marke = stunden > WARNSCHWELLE_STUNDEN ? "VERALTET" : "frisch";
    zeilen.push(
      `  ${spiegel.branch.padEnd(12)} ${gepusht.slice(0, 16).replace("T", " ")}  vor ${stunden.toFixed(1)} h  ${marke}`,
    );
    if (stunden > WARNSCHWELLE_STUNDEN) {
      veraltet.push({ branch: spiegel.branch, was: spiegel.was, stunden, skript: spiegel.skript });
    }
  }

  console.log("Spiegel vom Hetzner-Server:");
  for (const zeile of zeilen) console.log(zeile);

  if (veraltet.length === 0) {
    return;
  }

  console.log("");
  console.log("!!! ACHTUNG — der Server spiegelt nicht mehr !!!");
  for (const eintrag of veraltet) {
    console.log(
      `  ${eintrag.was} (${eintrag.branch}) sind ${(eintrag.stunden / 24).toFixed(1)} Tage alt.`,
    );
  }
  console.log("");
  console.log("  Was das bedeutet:");
  console.log("   - Ein Abbild in dieser Umgebung ist NICHT der aktuelle Spielstand.");
  console.log("   - Neue In-Game-Meldungen erreichen GitHub nicht — sie liegen im Container fest.");
  console.log("   - Steht der Auto-Deploy still, laeuft auf dem Server auch ein alter Build.");
  console.log("");
  console.log("  Chris muss auf dem Server nachsehen (Agenten kommen dort nicht hin):");
  console.log("    ssh root@135.181.102.2");
  console.log("    crontab -l");
  console.log("    tail -30 /var/log/oly-deploy.log");
  console.log("    tail -30 /var/log/oly-bug-reports.log");
  console.log("    cd /root/Olympiade-der-Welten && git status");
  console.log("");
  console.log("  Haengt der Auto-Deploy an einem liegengebliebenen lokalen Commit, loest das:");
  console.log("    cd /root/Olympiade-der-Welten && git fetch origin main && git reset --hard origin/main");
  console.log("    bash deploy/hetzner/install-live-save-cron.sh");
}

main();
