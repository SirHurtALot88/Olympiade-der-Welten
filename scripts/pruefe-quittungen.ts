/* eslint-disable no-console */
/**
 * PRUEFT DIE QUITTUNGEN — reicht die Existenz einer Datei als Beleg? Nein.
 *
 * DER ANLASS ist Chris' Frage vom 23.08.: „hast du die anderen bugs auch alle auditiert und
 * geprueft ob sie WIRKLICH gefixt sind?" Die Antwort war nein. Der Bugfixing-Lauf, der alle vier
 * Stunden feuert, verglich zwei Listen — Meldungen gegen Quittungen. Existiert zu `bug-<id>.json`
 * eine Datei `triage/bug-<id>.md`, galt die Meldung als erledigt. Das ist Buchhaltung.
 *
 * Das Audit fand daraufhin dreierlei, und jedes davon prueft dieses Skript ab jetzt:
 *
 *  1. Eine Quittung nannte einen Test, den es unter dem Namen nicht mehr gibt (`fm2opo`, umbenannt).
 *     So etwas faellt sonst NIE auf — die Quittung liest sich weiter tadellos.
 *  2. 25 von 70 gebauten Quittungen nannten ueberhaupt keinen Test. Die Reparatur steht im Code,
 *     aber nichts haelt sie fest; ein Umbau koennte sie still entfernen.
 *  3. Ein Fix war nur zur Haelfte gebaut (`33c172`) — das faengt kein Skript, das faengt nur
 *     Nachlesen. Deshalb steht es hier auch nicht als Pruefung, sondern als Mahnung im Kopf.
 *
 * ZWEI TEILE, WEIL ZWEI UMGEBUNGEN. Der Ratchet und die Test-Existenz brauchen nur das Repo und
 * laufen deshalb in der CI mit. Der Abgleich gegen `origin/bug-reports` braucht den Spiegel-Branch,
 * den die CI nicht auscheckt — er laeuft nur, wenn der Branch da ist, und schweigt sonst, statt
 * eine Luecke zu behaupten, die nur an der Umgebung liegt.
 *
 * DER RATCHET ist dieselbe Idee wie bei `tests/nl-accent-text-regel.test.ts`: die Altlast wird als
 * Obergrenze eingefroren und kann nur noch sinken. Wer einen der testlosen Fixes nachtraeglich
 * absichert, senkt die Zahl unten mit. Wer einen NEUEN Fix ohne Test abliefert, faellt auf.
 *
 * Aufrufe:
 *   npx tsx scripts/pruefe-quittungen.ts             — voller Lauf
 *   npx tsx scripts/pruefe-quittungen.ts --nur-repo  — ohne den Spiegel-Abgleich (CI)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WURZEL = process.cwd();
const TRIAGE = join(WURZEL, "data/bug-reports/triage");

/**
 * OBERGRENZE FUER BEHOBENE MELDUNGEN OHNE BENANNTEN TEST — gemessener Stand am 23.08.2026: 25.
 *
 * Der Auditbericht nennt 24, und beide Zahlen stimmen: er zaehlte von den MELDUNGEN her (90 im
 * Spiegel), dieses Skript zaehlt von den QUITTUNGEN her (94). Der Unterschied sind Notizen ohne
 * Rohmeldung — Zuruf im Gespraech statt Flagge im Spiel. Fuer einen Riegel ist die Quittungsseite
 * die richtige: sie ist die Menge, die hier ueberhaupt pruefbar ist.
 *
 * Diese Zahl darf nur SINKEN. Wer einen der testlosen Fixes nachtraeglich absichert, zieht sie hier
 * mit herunter; wer einen neuen Fix ohne Test abliefert, laesst den Lauf umfallen. Faellt sie unter
 * die Grenze, meldet der Lauf das ebenfalls als Fehler — sonst bleibt eine geschenkte Verbesserung
 * unbemerkt stehen und der Riegel verwaessert.
 */
const OHNE_TEST_OBERGRENZE = 25;

type Quittung = {
  datei: string;
  istFix: boolean;
  genannteTests: string[];
};

function leseQuittungen(): Quittung[] {
  if (!existsSync(TRIAGE)) return [];
  return readdirSync(TRIAGE)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const text = readFileSync(join(TRIAGE, name), "utf8");
      return {
        datei: name,
        // Eine `changelog:`-Zeile heisst: hier wurde etwas gebaut und ausgeliefert. Notizen ohne
        // sie sind Befunde oder Rueckfragen — die brauchen keinen Test.
        istFix: /^changelog:\s*\S/m.test(text),
        genannteTests: [...new Set(text.match(/tests\/[\w\-.]+\.test\.tsx?/g) ?? [])].sort(),
      };
    });
}

const quittungen = leseQuittungen();
const fixe = quittungen.filter((q) => q.istFix);
const ohneTest = fixe.filter((q) => q.genannteTests.length === 0);
/**
 * ZWEI STUFEN, WEIL EINE QUITTUNG AUCH GESCHICHTE ERZAEHLEN DARF. Eine Notiz, die eine Umbenennung
 * dokumentiert, nennt zwangslaeufig auch den alten Dateinamen — das ist richtig so und darf keinen
 * Lauf umwerfen. Ein FEHLER ist es erst, wenn KEINER der genannten Tests mehr existiert: dann
 * traegt den Fix nichts mehr. Einzelne tote Nennungen daneben werden nur gemeldet.
 */
const ohneJedenTest: Array<{ datei: string; tests: string[] }> = [];
const toteNennungen: Array<{ datei: string; test: string }> = [];
for (const quittung of fixe) {
  if (quittung.genannteTests.length === 0) continue;
  const vorhandene = quittung.genannteTests.filter((test) => existsSync(join(WURZEL, test)));
  const fehlende = quittung.genannteTests.filter((test) => !existsSync(join(WURZEL, test)));
  if (vorhandene.length === 0) ohneJedenTest.push({ datei: quittung.datei, tests: quittung.genannteTests });
  else for (const test of fehlende) toteNennungen.push({ datei: quittung.datei, test });
}

let fehler = 0;

console.log(`Quittungen: ${quittungen.length} · davon mit changelog-Zeile (also gebaut): ${fixe.length}`);

/* --- 1. Nennt eine Quittung einen Test, den es nicht gibt? Das ist ein Fehler. --- */
if (ohneJedenTest.length > 0) {
  fehler += 1;
  console.log("");
  console.log("FEHLER — Quittung nennt Tests, aber KEINER davon existiert noch:");
  for (const treffer of ohneJedenTest) {
    console.log(`  ${treffer.datei}  ->  ${treffer.tests.join(", ")}`);
  }
  console.log("  Umbenannt? Dann den neuen Namen in die Quittung schreiben. Geloescht? Dann traegt");
  console.log("  den Fix nichts mehr — entweder Test wiederherstellen oder die Quittung berichtigen.");
} else {
  console.log("Jede gebaute Quittung mit Testnennung hat mindestens einen vorhandenen Test.");
}
if (toteNennungen.length > 0) {
  console.log("");
  console.log("Hinweis — einzelne tote Testnennungen (die Quittung traegt daneben einen echten Test):");
  for (const treffer of toteNennungen) console.log(`  ${treffer.datei}  ->  ${treffer.test}`);
}

/* --- 2. Ratchet: behobene Meldungen ohne benannten Test. --- */
console.log("");
console.log(`Behobene Meldungen ohne benannten Test: ${ohneTest.length} (Obergrenze ${OHNE_TEST_OBERGRENZE})`);
if (ohneTest.length > OHNE_TEST_OBERGRENZE) {
  fehler += 1;
  console.log("FEHLER — die Zahl ist gestiegen. Ein neuer Fix ohne Test, oder eine Quittung, die");
  console.log("  ihren Test nicht nennt. Die Quittung nennt den Test mit vollem Pfad, z. B.");
  console.log("  `tests/meine-suite.test.ts` — dann findet dieser Lauf ihn.");
  for (const quittung of ohneTest) console.log(`    ${quittung.datei}`);
} else if (ohneTest.length < OHNE_TEST_OBERGRENZE) {
  console.log(`Gut — ${OHNE_TEST_OBERGRENZE - ohneTest.length} weniger als die Obergrenze.`);
  console.log(`  Bitte OHNE_TEST_OBERGRENZE in diesem Skript auf ${ohneTest.length} senken.`);
  fehler += 1;
}

/* --- 3. Abgleich gegen den Spiegel — nur wenn der Branch da ist. --- */
if (!process.argv.includes("--nur-repo")) {
  let spiegel: string[] | null = null;
  try {
    spiegel = execFileSync("git", ["ls-tree", "origin/bug-reports", "--name-only", "data/bug-reports/"], {
      cwd: WURZEL,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .filter((zeile) => zeile.endsWith(".json"));
  } catch {
    spiegel = null;
  }
  console.log("");
  if (spiegel == null) {
    // KEIN FEHLER: in der CI ist der Spiegel-Branch nicht ausgecheckt. Eine Umgebungsgrenze als
    // Befund auszugeben waere genau der Fehler, den die Routine ausdruecklich verbietet.
    console.log("Spiegel `origin/bug-reports` nicht verfuegbar — Abgleich uebersprungen.");
  } else {
    const alleQuittungstexte = quittungen.map((q) => q.datei).join("\n");
    const offen = spiegel
      .map((pfad) => pfad.replace(/\.json$/, "").split("-").pop() ?? "")
      .filter((id) => id && !alleQuittungstexte.includes(id));
    console.log(`Meldungen im Spiegel: ${spiegel.length} · unbearbeitet: ${offen.length}`);
    // Offene Meldungen sind ARBEIT, kein Fehlschlag — der Lauf bearbeitet sie danach.
    for (const id of offen) console.log(`  offen: ${id}`);
  }
}

if (fehler > 0) {
  console.log("");
  console.log("Quittungspruefung fehlgeschlagen.");
  process.exitCode = 1;
} else {
  console.log("");
  console.log("Quittungspruefung ok.");
}
