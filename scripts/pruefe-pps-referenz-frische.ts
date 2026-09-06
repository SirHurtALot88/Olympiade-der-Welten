// ===================================================================================
// PPS-REFERENZ-FRISCHE — meldet, ob der Motor (public/mockups/battle-mode.engine.js) sich
// seit der letzten Ziehung EINER `data/generated/<disziplin>-pps-referenz.json` veraendert hat.
//
// AUSLOESER (Chris, 06.09.): eine unabhaengige Opus-Review (PR #818/#820) fand einen echten Bug
// in der gemeinsamen Buehnen-Chassis-Funktion `bauBuehne()`, der Gewichtheben betrifft (bereits
// produktiv) -- dessen alte PPS-Referenz war durch den Bug verzerrt, und niemand haette das
// automatisch bemerkt: `motorSha1`/`gezogenAm`/`repoCommit` stehen zwar in jeder Referenzdatei
// (genau fuer diesen Zweck geschrieben), wurden aber bislang NIRGENDS geprueft. Chris fragte
// direkt, ob das systematisch geprueft wird, und beauftragte dieses Skript.
//
// WAS "VERALTET" HIER HEISST: der `motorSha1` in einer Referenzdatei ist ein `sha1sum` ueber die
// GESAMTE Motor-Datei, gezogen von `ermittleMotorSha1()` in jedem `scripts/ziehe-*-pps-
// referenz.ts` (identischer Einzeiler in allen fuenf Skripten, s. dort). Dieses Skript berechnet
// exakt denselben Hash und vergleicht ihn -- andere Berechnung waere ein wertloser Vergleich.
//
// GRANULARITAET, EHRLICH BENANNT (keine erfundene Praezision): `battle-mode.engine.js` ist EINE
// 20.000-Zeilen-Datei fuer alle zwanzig Disziplinen. Der volle Datei-Hash kann nicht
// unterscheiden, ob eine Aenderung die geprüfte Disziplin ueberhaupt beruehrt hat oder nur eine
// andere (z. B. Takeshi's Castle) -- JEDE Motor-Aenderung laesst ALLE fuenf Referenzen als
// "veraltet" erscheinen, auch wenn nur eine oder gar keine der fuenf produktiven Disziplinen
// betroffen war. Eine feinere Pruefung (Hash nur ueber den BUEHNE_ART/FELDSPIEL_ART-Konfig-
// Block der jeweiligen Disziplin plus die von ihr genutzten gemeinsamen Chassis-Funktionen)
// waere praeziser, haette aber genau den Fall verpasst, der diesen Auftrag ausgeloest hat: der
// Gewichtheben-Bug sass in `bauBuehne()`, einer GEMEINSAMEN Chassis-Funktion, nicht im
// disziplin-eigenen Rezeptblock -- eine Pruefung, die nur den eigenen Block hasht, haette ihn
// nicht gefunden. Der volle Datei-Hash ist deshalb nicht nur der einfachere, sondern der
// SICHERERE erste Schritt; er tauscht Praezision (weniger Fehlalarme) gegen Vollstaendigkeit
// (kein blinder Fleck bei gemeinsamem Code). Er ist bewusst NICHT der CI-Pflicht-Check (s.
// .github/workflows/ci.yml, Job "pps-referenz-frische", `continue-on-error: true`) -- ein rotes
// Kreuz bei jeder unrelated Motor-Aenderung wuerde ignoriert, bevor es das eine Mal zaehlt, das
// wirklich zaehlt.
//
// Exit-Code 0: jede Referenz passt zum aktuellen Motor-Hash. Exit-Code 1: mindestens eine
// Referenz ist veraltet -- die Tabelle nennt welche und seit wann (Muster von
// scripts/pruefe-rangtreue-schranke.mjs).
//
// Aufruf: npx tsx scripts/pruefe-pps-referenz-frische.ts
// ===================================================================================
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "../lib/resolve/battle-mode-arena-team-points";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOTOR_PFAD = "public/mockups/battle-mode.engine.js";

// IDENTISCH zu `ermittleMotorSha1()` in jedem scripts/ziehe-*-pps-referenz.ts -- nicht
// umformulieren, ohne dort mitzuziehen, sonst vergleicht dieses Skript Aepfel mit Birnen.
function ermittleMotorSha1(): string {
  return execSync(`sha1sum ${MOTOR_PFAD}`, { cwd: WURZEL, encoding: "utf8" }).trim().split(/\s+/)[0]!;
}

interface PpsReferenzDatei {
  disziplin?: string;
  motorSha1?: string;
  gezogenAm?: string;
  repoCommit?: string;
}

interface Zeile {
  disziplin: string;
  datei: string;
  fehlt?: true;
  fehler?: string;
  aktuell?: boolean;
  gezogenAm?: string;
  tageAlt?: number;
  motorSha1Referenz?: string;
}

function formatTage(ms: number): string {
  const tage = ms / (1000 * 60 * 60 * 24);
  if (tage < 1) return "< 1 Tag";
  const ganzeTage = Math.floor(tage);
  return `${ganzeTage} Tag${ganzeTage === 1 ? "" : "e"}`;
}

function main() {
  const motorSha1Jetzt = ermittleMotorSha1();
  const disziplinen = [...ARENA_RESOLVED_DISCIPLINE_IDS].sort();

  const zeilen: Zeile[] = disziplinen.map((disziplin) => {
    const relPfad = `data/generated/${disziplin}-pps-referenz.json`;
    const absPfad = path.join(WURZEL, relPfad);
    if (!existsSync(absPfad)) {
      return { disziplin, datei: relPfad, fehlt: true };
    }
    let referenz: PpsReferenzDatei;
    try {
      referenz = JSON.parse(readFileSync(absPfad, "utf8"));
    } catch (e) {
      return { disziplin, datei: relPfad, fehler: `unlesbar (${(e as Error).message})` };
    }
    if (!referenz.motorSha1 || !referenz.gezogenAm) {
      return { disziplin, datei: relPfad, fehler: "kein motorSha1/gezogenAm-Feld in der Datei" };
    }
    const gezogenAmMs = Date.parse(referenz.gezogenAm);
    return {
      disziplin,
      datei: relPfad,
      aktuell: referenz.motorSha1 === motorSha1Jetzt,
      gezogenAm: referenz.gezogenAm,
      tageAlt: Number.isNaN(gezogenAmMs) ? undefined : Date.now() - gezogenAmMs,
      motorSha1Referenz: referenz.motorSha1,
    };
  });

  console.log(`PPS-Referenz-Frische — aktueller Motor-Hash von ${MOTOR_PFAD}:`);
  console.log(`  ${motorSha1Jetzt}\n`);
  console.log("Disziplin            Status      gezogen am              Alter        Referenz-Hash");

  let veraltet = false;
  for (const z of zeilen) {
    if (z.fehlt) {
      console.log(`${z.disziplin.padEnd(20)}FEHLT       ${z.datei} existiert nicht`);
      veraltet = true;
      continue;
    }
    if (z.fehler) {
      console.log(`${z.disziplin.padEnd(20)}FEHLER      ${z.fehler}`);
      veraltet = true;
      continue;
    }
    const status = z.aktuell ? "aktuell" : "VERALTET";
    if (!z.aktuell) veraltet = true;
    const alterText = z.tageAlt !== undefined ? formatTage(z.tageAlt) : "unbekannt";
    console.log(
      z.disziplin.padEnd(20)
        + status.padEnd(12)
        + (z.gezogenAm ?? "?").padEnd(25)
        + alterText.padEnd(13)
        + (z.motorSha1Referenz ?? "?").slice(0, 12) + "…",
    );
  }

  console.log(
    "\nHinweis: der Vergleich laeuft ueber den Hash der GESAMTEN Motor-Datei. Eine Aenderung an "
    + "einer anderen Disziplin (z. B. Takeshi's Castle) laesst JEDE Referenz hier als \"VERALTET\" "
    + "erscheinen, auch wenn die geprüfte Disziplin unberuehrt blieb -- s. Kopfkommentar dieses "
    + "Skripts. Ein rotes Ergebnis heisst \"pruefen, ob eine Neuziehung noetig ist\", nicht "
    + "automatisch \"neu ziehen\".",
  );

  if (veraltet) {
    console.log(
      "\nFEHLGESCHLAGEN: mindestens eine PPS-Referenz ist veraltet oder fehlt. Neu ziehen mit "
      + "scripts/ziehe-<disziplin>-pps-referenz.ts, wenn die Aenderung den rohen Boxscore-Wert "
      + "dieser Disziplin tatsaechlich verschiebt -- sonst reicht es, den Fund zu dokumentieren.",
    );
    process.exit(1);
  }
  console.log("\nBestanden: alle PPS-Referenzen passen zum aktuellen Motor-Hash.");
}

main();
