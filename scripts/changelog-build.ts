/**
 * DER CHANGELOG-GENERATOR — `npm run changelog:bauen`.
 *
 * Erzeugt `data/changelog/CHANGELOG.json` aus zwei Quellen: den `changelog:`-Zeilen der
 * Triage-Notizen (nur Status `gebaut`/`erledigt` — was nicht gemergt ist, hat im Changelog
 * nichts verloren) und den von Hand gepflegten Eintraegen in `data/changelog/eintraege/`
 * (Aenderungen ohne Bug-Meldung: neues Feature, umgebaute Ansicht — eine Datei pro Eintrag,
 * siehe die README.md dort). Die abgeloeste Sammeldatei `data/changelog/eintraege.json` wird
 * weiterhin gelesen und ihr Restbestand angemahnt.
 *
 * WARUM ABGELEITET UND NICHT GEPFLEGT — dieselbe Begruendung wie bei `npm run bugs:tabelle`:
 * einer abgeleiteten Datei sieht man die Luecke an (der Generator mahnt jeden gemergten Fix ohne
 * Changelog-Zeile an), eine von Hand gepflegte behauptet stattdessen etwas Plausibles und
 * Falsches. Der Reiter im Spiel liest ausschliesslich die generierte Datei.
 *
 * Aufrufe:
 *   npm run changelog:bauen            — schreibt CHANGELOG.json neu
 *   npm run changelog:bauen -- --check — schreibt nichts, Exit 1 bei Abweichung
 */
import fs from "node:fs";

import {
  CHANGELOG_DIR,
  CHANGELOG_GENERATED_FILE,
  sammleChangelog,
} from "@/lib/changelog/changelog-quellen";

function main() {
  const checkOnly = process.argv.slice(2).includes("--check");
  const sammlung = sammleChangelog();

  // Kein Zeitstempel in der Datei — sie aendert sich nur, wenn sich der Inhalt aendert. So
  // erzeugt ein Lauf ohne neue Eintraege keinen Leer-Commit, ganz ohne Vergleichs-Trick.
  const naechste = `${JSON.stringify(
    {
      hinweis:
        "GENERIERT — nicht von Hand editieren. Quellen: die changelog:-Zeilen in data/bug-reports/triage/*.md und die Eintragsdateien in data/changelog/eintraege/ (abgeloest, aber weiter gelesen: data/changelog/eintraege.json). Neu bauen: npm run changelog:bauen.",
      eintraege: sammlung.eintraege,
    },
    null,
    2,
  )}\n`;

  const vorhanden = fs.existsSync(CHANGELOG_GENERATED_FILE)
    ? fs.readFileSync(CHANGELOG_GENERATED_FILE, "utf8")
    : "";

  if (checkOnly) {
    if (vorhanden === naechste) {
      console.log("CHANGELOG.json ist auf Stand.");
    } else {
      console.log("CHANGELOG.json weicht ab — `npm run changelog:bauen` ausfuehren.");
      process.exitCode = 1;
    }
  } else if (vorhanden === naechste) {
    console.log("CHANGELOG.json unveraendert — nichts geschrieben.");
  } else {
    fs.mkdirSync(CHANGELOG_DIR, { recursive: true });
    fs.writeFileSync(CHANGELOG_GENERATED_FILE, naechste, "utf8");
    console.log(`CHANGELOG.json geschrieben — ${sammlung.eintraege.length} Eintraege.`);
  }

  // Die Luecken stehen IMMER im Ausgabetext, auch bei --check: ein gemergter Fix ohne
  // Changelog-Eintrag ist fuer den Spieler unsichtbar — genau das soll hier auffallen.
  if (sammlung.luecken.length > 0) {
    console.log("");
    console.log("Gemergte Fixes ohne Changelog-Eintrag:");
    for (const luecke of sammlung.luecken) {
      console.log(`  ${luecke.reportId}: ${luecke.grund}`);
    }
  }
  // Uneingestufte Eintraege erscheinen zwar (unter "Ohne Einstufung"), aber der Sinn der
  // Gewichtung ist ja gerade, dass Grosses oben steht — deshalb wird jede fehlende Stufe
  // angemahnt statt still hingenommen.
  if (sammlung.ohneGewicht.length > 0) {
    console.log("");
    console.log("Eintraege ohne Gewichtung (erscheinen unter \"Ohne Einstufung\"):");
    for (const eintrag of sammlung.ohneGewicht) {
      console.log(`  ${eintrag.kennung}: ${eintrag.grund}`);
    }
  }
  // Nicht als Fehler, sondern als Aufraeum-Hinweis: die Eintraege zaehlen normal mit. Solange dort
  // aber etwas liegt, kollidieren PRs wieder an derselben Zeile — und genau das war der Grund fuer
  // die Umstellung auf eine Datei pro Eintrag.
  if (sammlung.ausSammeldatei > 0) {
    console.log("");
    console.log(
      `Hinweis: ${sammlung.ausSammeldatei} Eintrag/Eintraege liegen noch in der alten Sammeldatei ` +
        "data/changelog/eintraege.json — bitte nach data/changelog/eintraege/ umziehen " +
        "(eine Datei pro Eintrag, siehe dortige README.md).",
    );
  }
  if (sammlung.verworfeneGepflegte > 0) {
    console.log(`Achtung: ${sammlung.verworfeneGepflegte} gepflegte(r) Eintrag/Eintraege unbrauchbar (Datum oder Text fehlt) — data/changelog/eintraege/ pruefen.`);
  }
}

main();
