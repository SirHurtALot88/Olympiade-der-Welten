// RANGTREUE MINI-DM: 2-TEAM-CHASSIS (heute) GEGEN DAS NEUE 4-TEAM-FFA-FORMAT — dieselbe
// Formel (Spearman rho ueber {eig, wert}-Paare, scripts/lib/rangtreue-messung.mjs) auf beide
// Formate angewandt, damit die beiden Zahlen tatsaechlich vergleichbar sind. Beantwortet
// Auftragspunkt 4 aus der Mini-DM-4-Team-FFA-Umsetzung (docs/design/
// mini-dm-4-team-ffa-recherche-06-09.md Abschnitt 6, Punkt 2: "ob vier unabhaengige
// Solo-Runden Mini-DMs Rangtreue tatsaechlich heben — nachmessen, nicht annehmen").
//
// METHODE FUER DAS NEUE FORMAT (kaderfest, angelehnt an disziplinProbe/auswerten): der
// bestehende 17-koepfige Testkader (window.__arena.kader()+opp(), derselbe, den
// baueSynthetischeKaderFamilie() fuer die Kader-Familie mischt) liefert reale, unterschiedliche
// Eignungswerte je Rolle. Er wird deterministisch in mehrere feste Vierergruppen je Rolle
// aufgeteilt (dieselbe "mische(schritt)"-Rotation wie in rangtreue-messung.mjs, damit die
// Gruppen nicht willkuerlich sind) — jede Gruppe ist eine "Kader-Variante", genau wie eine
// Kader-Familie fuer die zwei-seitige Messung. Je Gruppe laufen SPIELE Runden (verschiedene
// Saaten = verschiedene Ecken-Lotterien, s. baueMiniDmFfaRunde), macht {eig, wert}-Paare je
// Runde ("Spiel") und, aggregiert, "Saison".
//
// Aufruf:
//   node scripts/miss-mini-dm-ffa-rangtreue.mjs             → 24 Runden je Gruppe, alle 4 Rollen
//   node scripts/miss-mini-dm-ffa-rangtreue.mjs 48           → 48 Runden je Gruppe
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";
import { rho, auswerten, median, spannweite } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SPIELE = Number(process.argv[2] || 24);

const browser = await chromium.launch(
  existsSync(fest)
    ? { executablePath: fest, args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] }
    : { args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] },
);
let ausgabe;
try {
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.miniDmFfaRunde, null, { timeout: 30000 });

  // ------------------------------------------------------------------------------
  // TEIL 1: das HEUTIGE 2-Team-4-gegen-4-Chassis, ueber dieselbe disziplinProbe-Sonde,
  // die auch miss-alle-disziplinen.mjs verwendet — der Vergleichsmassstab.
  // ------------------------------------------------------------------------------
  const heute = await seite.evaluate((n) => window.__arena.disziplinProbe("mini-dm", { n }), SPIELE);
  const heuteAusw = auswerten(heute.spiele);

  // ------------------------------------------------------------------------------
  // TEIL 2: das neue 4-Team-FFA-Format, gleiche Formel, gleicher Testkader.
  // ------------------------------------------------------------------------------
  const ffaErgebnis = await seite.evaluate(
    (n) => {
      const alle = [...window.__arena.kader(), ...window.__arena.opp()]
        .map(({ n, c, r, sub, tp, tn, d, a, groesse }) => ({ n, id: n, c, r, sub, tp, tn, d, a, groesse }));
      const rollen = window.__arena.miniDmFfaRollen();
      // Dieselbe Rotationsmischung wie baueSynthetischeKaderFamilie() in
      // rangtreue-messung.mjs (Schritte 3/5/6/7), hier auf Vierergruppen angewandt statt
      // auf 8-gegen-8-Aufteilungen.
      const mische = (schritt) => {
        const m = alle.length, out = [];
        let i = 0; const gesehen = new Set();
        while (out.length < m) { if (!gesehen.has(i)) { gesehen.add(i); out.push(alle[i]); } i = (i + schritt) % m; }
        return out;
      };
      const gruppenQuellen = [alle, mische(3), mische(5), mische(6), mische(7)];
      const ausgabeJeRolle = {};
      for (const slotId of rollen) {
        const varianten = [];
        for (const quelle of gruppenQuellen) {
          const vier = quelle.slice(0, 4);
          if (vier.length < 4) continue;
          const spiele = [];
          for (let i = 0; i < n; i++) {
            const runde = window.__arena.miniDmFfaRunde(vier, slotId, 700000 + i * 977);
            spiele.push({ teilnehmer: runde.teams.map((t) => ({ n: t.n, eig: t.eig, wert: t.beitrag })) });
          }
          varianten.push(spiele);
        }
        ausgabeJeRolle[slotId] = varianten;
      }
      return ausgabeJeRolle;
    },
    SPIELE,
  );

  ausgabe = { heuteAusw, heuteTeiln: heute.spiele[0]?.teilnehmer.length ?? 0, ffaErgebnis, fehler };
} finally {
  await browser.close();
}

if (ausgabe.fehler.length) console.error("Seitenfehler:", ausgabe.fehler.slice(0, 5));

console.log(`Mini-DM — heutiges 2-Team-4-gegen-4-Chassis (${ausgabe.heuteTeiln} Teilnehmer je Spiel, ${SPIELE} Spiele):`);
console.log(`  rho je Spiel: ${ausgabe.heuteAusw.spiel.toFixed(3)}   rho Saison: ${ausgabe.heuteAusw.saison.toFixed(3)}`);
console.log("");
console.log(`Mini-DM — neues 4-Team-FFA-Format (4 Teilnehmer je Runde, ${SPIELE} Runden je Gruppe, 5 Gruppen je Rolle):`);

const alleSpielRho = [], alleSaisonRho = [];
for (const [slotId, varianten] of Object.entries(ausgabe.ffaErgebnis)) {
  const ausw = varianten.map((spiele) => auswerten(spiele)).filter((v) => !Number.isNaN(v.spiel));
  const spielMed = median(ausw.map((v) => v.spiel)), spielSpan = spannweite(ausw.map((v) => v.spiel));
  const saisonMed = median(ausw.map((v) => v.saison)), saisonSpan = spannweite(ausw.map((v) => v.saison));
  alleSpielRho.push(...ausw.map((v) => v.spiel));
  alleSaisonRho.push(...ausw.map((v) => v.saison));
  console.log(`  ${slotId.padEnd(14)} rho je Runde (Median): ${spielMed.toFixed(3)} (Spannweite ${spielSpan.toFixed(3)})   rho ueber alle Runden (Median): ${saisonMed.toFixed(3)} (Spannweite ${saisonSpan.toFixed(3)})`);
}
console.log("");
console.log(`  UEBER ALLE VIER ROLLEN: rho je Runde (Median) ${median(alleSpielRho).toFixed(3)}, rho ueber alle Runden (Median) ${median(alleSaisonRho).toFixed(3)}`);
console.log("");
console.log("Vergleich (dieselbe Spearman-Formel, derselbe Testkader):");
console.log(`  heute (2-Team, n=8 je Spiel):   rho je Spiel ${ausgabe.heuteAusw.spiel.toFixed(3)}`);
console.log(`  FFA   (4-Team, n=4 je Runde):   rho je Runde ${median(alleSpielRho).toFixed(3)} (Median ueber 5 Gruppen x 4 Rollen)`);
console.log("");
console.log("Hinweis: n=4 je Runde ist eine kleinere Stichprobe als n=8 je heutigem Spiel (weniger Teilnehmer");
console.log("je Ereignis, s. CLAUDE.md 'mehr Ereignisse helfen fast nie' — hier ist es sogar WENIGER Ereignisse");
console.log("je Einzelmessung). Spearman rho ist bei n=4 grobstufig (nur 4! = 24 moegliche Rangfolgen); die");
console.log("Zahl oben ist deshalb eher ein Trend als eine belastbare Einzelzahl.");
