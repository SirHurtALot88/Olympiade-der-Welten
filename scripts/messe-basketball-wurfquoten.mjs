// ===================================================================================
// TRIFFT DAS SPIEL SO OFT WIE ECHTER BASKETBALL? — die zweite Abnahmemessung fuer
// Basketball, neben messe-arena-einfluss.mjs.
//
// Chris (26.08.): "bitte auch einzeln pruefen also wie viel % trifft ein spieler der
// frei wirft oder wie viel trifft er wenn er gegenspieler hat die ihn verteidigen ...
// und dann am besten so balancen dass es realistisch wird da kannst du dich ja an AVGs
// der echten NBA orientieren".
//
// WAS DIESES SKRIPT MISST UND WAS NICHT. messe-arena-einfluss.mjs prueft, ob die
// Mechanik die DISZIPLINMATRIX einloest (Pp-Abweichung). Das ist eine andere Frage als
// "faellt ein Dreier so oft wie in der NBA". Beide muessen stimmen; keine der beiden
// Zahlen ersetzt die andere. Wer nur eine davon nachzieht, verschiebt die andere
// unbemerkt — deshalb bei jeder Aenderung BEIDE Skripte fahren.
//
// NBA-VERGLEICHSWERTE (recherchiert 26.08., Quellen im Bericht). Die Engine kennt vier
// Wurfstufen; die Zuordnung zur NBA-Zone steht in ZIEL unten.
//
// BEDRAENGNIS-STUFEN. Die NBA teilt nach Abstand des naechsten Verteidigers in
// 0-2 ft (very tight), 2-4 ft (tight), 4-6 ft (open), 6+ ft (wide open). Der Court der
// Engine ist ueber DREIER_RADIUS geeicht: 112,8 px sind die 23,75 ft der NBA-Dreierlinie,
// also 4,75 px je Fuss. Damit fallen die vier NBA-Stufen auf 9,5 / 19 / 28,5 px — und
// BEDRAENGT_RADIUS (30 px) liegt damit fast exakt auf der NBA-Grenze "wide open".
// Das ist kein Zufall, sondern die Rechtfertigung dafuer, dass die Engine-Grenze und
// die Messgrenze dieselbe Sprache sprechen.
//
//   node scripts/messe-basketball-wurfquoten.mjs                 → echte Kader, 24 Spiele
//   node scripts/messe-basketball-wurfquoten.mjs echt 60         → echte Kader, 60 Spiele
//   node scripts/messe-basketball-wurfquoten.mjs ueberlegen 40   → Szenario "klar staerker"
//   node scripts/messe-basketball-wurfquoten.mjs gleich 40       → Szenario "gleichwertig"
//   node scripts/messe-basketball-wurfquoten.mjs stil 40         → Tempo-Kader gegen Riesen-Kader
//   node scripts/messe-basketball-wurfquoten.mjs wucht 120      → Einzelpruefung "powert er sich durch"
//   node scripts/messe-basketball-wurfquoten.mjs agil 120       → Einzelpruefung "dribbelt er vorbei"
//   node scripts/messe-basketball-wurfquoten.mjs alle 40         → alle sechs nacheinander
//
// WIE VIELE SPIELE ES BRAUCHT. Anders als bei der Pp-Messung ist hier JEDE Kategorie
// eine Teilmenge: ein Spiel produziert ~11-14 Feldwuerfe, davon vielleicht 3 Dreier,
// davon vielleicht 1 bedraengter. Bei n=12 haengt eine "bedraengte Dreierquote" also an
// einer Handvoll Wuerfen — Rauschen, keine Aussage. Faustregel hier: eine Kategorie
// wird nur ausgewiesen, wenn sie mindestens 40 Versuche hat (sonst steht "zu duenn"),
// und die Standardgroesse ist 24 Spiele fuer eine schnelle Runde bzw. 60-120 fuer eine
// Aussage, auf die man eine Aenderung stuetzt. Das Skript druckt zu jeder Quote die
// Fallzahl UND das 95-%-Intervall (Wald), damit niemand eine 8-von-20-Quote fuer eine
// gemessene Groesse haelt.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const szenarioArg = process.argv[2] || "echt";
const spiele = Number(process.argv[3] || 24);
// Aus dem Skript-Ort abgeleitet statt fest verdrahtet — messe-arena-einfluss.mjs traegt
// noch einen absoluten Pfad, der in einem git-worktree still auf das FALSCHE Repo zeigt
// (dort haengt der Aufruf dann in waitForFunction, weil die alte Datei den neuen Hook
// nicht kennt). Hier gleich richtig; vierter Aufrufwert ueberschreibt weiterhin.
const HIER = path.dirname(fileURLToPath(import.meta.url));
const pfad = process.argv[4] || path.join(HIER, "..", "public", "mockups", "battle-mode.html");

const PX_JE_FUSS = 112.8 / 23.75;

// NBA-ZIELWERTE. Quellen und Herleitung im Bericht; hier nur die Zahl, gegen die
// gemessen wird, und in Klammern die NBA-Zone, der die Engine-Stufe entspricht.
const ZIEL = {
  dunk: { pct: 66, was: "Restricted Area / Dunk-Naehe" },
  nah: { pct: 45, was: "Paint ausserhalb Restricted Area" },
  mit: { pct: 42, was: "Mid-Range" },
  fern: { pct: 36, was: "Dreier" },
  freiwurf: { pct: 78, was: "Freiwurf" },
};
// Dreier nach Bedraengnis (NBA-Tracking): wide open 38,4 %, tight (2-4 ft) 30,1 %.
const ZIEL_FERN_FREI = 38;
const ZIEL_FERN_ENG = 30;

// ---------------------------------------------------------------------------------
// SZENARIO-KADER. Konstruiert, nicht aus dem Spielstand: fuer die Frage "welche Stats
// sind zu stark" braucht es Kader, die sich in GENAU EINER Achse unterscheiden — das
// gibt kein echter Kader her. Zwoelf Attribute, dieselbe Form wie SQUAD/OPP.
// ---------------------------------------------------------------------------------
const A = (o) => ({
  power: 50, health: 50, stamina: 50, intelligence: 50, awareness: 50, determination: 50,
  speed: 50, dexterity: 50, charisma: 50, will: 50, spirit: 50, torment: 50, ...o,
});
const kader = (praefix, attr, n = 6) =>
  Array.from({ length: n }, (_, i) => ({
    n: `${praefix}-${i + 1}`, c: "Hero", r: "Human", sub: [], tp: [], tn: [], d: {}, a: attr(i),
  }));

// Basketball-Matrix: spirit 22, intelligence 16, awareness 14, charisma 11, speed 10,
// dexterity 8, power 7, stamina 6, torment 6. "Stark" heisst hier: hoch in genau diesen
// Attributen — nicht pauschal in allen zwoelf, sonst misst man auch health/will, die
// Basketball gar nicht bepreist.
const HOCH = { spirit: 85, intelligence: 85, awareness: 85, charisma: 85, speed: 80, dexterity: 80, power: 75, stamina: 75, torment: 70 };
const MITTEL = { spirit: 55, intelligence: 55, awareness: 55, charisma: 55, speed: 55, dexterity: 55, power: 55, stamina: 55, torment: 55 };
const NIEDRIG = { spirit: 30, intelligence: 30, awareness: 30, charisma: 30, speed: 30, dexterity: 30, power: 32, stamina: 32, torment: 32 };

// Stil-Kader (Chris' Feature-Wunsch: Teams sollen am Stil erkennbar sein). Gleicher
// GESAMTwert, andere Verteilung — sonst misst man Staerke statt Stil.
//
// "GLEICHER GESAMTWERT" WAR EINE BEHAUPTUNG, KEINE RECHNUNG (Fund 26.08. abends). Rechnet
// man die beiden ersten Entwuerfe gegen die Basketball-Matrix durch, kommt heraus:
//   TEMPO  = 59,3    RIESEN = 54,2
// Der Riesenkader war also von vornherein fuenf Punkte schwaecher, und ein Teil der
// gemessenen Stil-Ueberlegenheit des Tempokaders (108:12 Siege) war schlicht das. Ein
// Stiltest, dessen zwei Seiten unterschiedlich stark sind, kann die Frage "ist ein Stil
// zu stark" gar nicht beantworten. matrixWert() unten rechnet den Wert deshalb aus und
// druckt ihn mit, und RIESEN ist so nachgezogen, dass beide Seiten auf 59,3 liegen —
// dieselbe Staerke, andere Verteilung. Erhoeht wurden nur Attribute, die zum Stil passen
// (spirit/intelligence/awareness — ein grosser Mann darf klug und aufmerksam sein), nicht
// speed oder dexterity, sonst waere es kein Riesenkader mehr.
const TEMPO = { speed: 92, dexterity: 85, stamina: 82, awareness: 62, intelligence: 55, spirit: 55, charisma: 50, power: 22, torment: 30 };
const RIESEN = { power: 92, health: 88, torment: 82, stamina: 62, spirit: 74, awareness: 66, intelligence: 62, charisma: 58, speed: 20, dexterity: 25 };

// Die Gewichtsmatrix des Basketballs, wie sie in der Engine steht (BASIS_JE_DISC). Nur
// zum Nachrechnen der Kaderstaerke, nicht fuer die Simulation.
const MATRIX = { spirit: 22, intelligence: 16, awareness: 14, charisma: 11, speed: 10, dexterity: 8, power: 7, stamina: 6, torment: 6 };
const matrixWert = (attr) =>
  Object.entries(MATRIX).reduce((s, [k, g]) => s + (attr[k] ?? 50) * g, 0) / 100;

// ---------------------------------------------------------------------------------
// EINZELPRUEFUNG DER BEIDEN VON CHRIS BENANNTEN MECHANIKEN.
//
// Chris: "ob ein sehr powerful spieler sich durch die verteidiger durchpowert" und "ob
// ein sehr agiler spieler die gegner ausdribbelt". Dass die Mechanik EXISTIERT, sieht man
// im Code; dass sie WIRKT, sieht man nur an einer Messung, in der genau ein Attribut
// verschoben ist und alles andere gleich bleibt. Beide Kader unten sind deshalb Kopien
// des MITTEL-Kaders mit genau einer geaenderten Achse:
//   wucht    — power/torment/stamina hoch gegen dieselben Werte niedrig
//   agil     — dexterity/intelligence/spirit/speed hoch gegen dieselben niedrig
// Die Auswertung dazu steht in auswerten() unter "MECHANIK-EINZELPRUEFUNG".
const WUCHT_HOCH = { ...MITTEL, power: 95, torment: 90, stamina: 85 };
const WUCHT_NIEDRIG = { ...MITTEL, power: 12, torment: 15, stamina: 30 };
const AGIL_HOCH = { ...MITTEL, dexterity: 92, intelligence: 90, spirit: 88, speed: 88 };
const AGIL_NIEDRIG = { ...MITTEL, dexterity: 15, intelligence: 15, spirit: 15, speed: 20 };

const SZENARIEN = {
  echt: null,
  ueberlegen: {
    titel: "klar ueberlegen (stark gegen schwach)",
    links: kader("Stark", () => A(HOCH), 8),
    rechts: kader("Schwach", () => A(NIEDRIG), 8),
  },
  gleich: {
    titel: "gleichwertig (Mittelmass gegen Mittelmass)",
    links: kader("MittelL", () => A(MITTEL), 8),
    rechts: kader("MittelR", () => A(MITTEL), 8),
  },
  stil: {
    titel: "Stil: Tempo-Kader gegen Riesen-Kader (gleich stark, andere Verteilung)",
    links: kader("Tempo", () => A(TEMPO), 8),
    rechts: kader("Riese", () => A(RIESEN), 8),
  },
  wucht: {
    titel: "Einzelpruefung: powert sich ein starker Spieler durch? (WUCHT hoch gegen niedrig)",
    links: kader("Stark", () => A(WUCHT_HOCH), 8),
    rechts: kader("Duenn", () => A(WUCHT_NIEDRIG), 8),
  },
  agil: {
    titel: "Einzelpruefung: dribbelt ein agiler Spieler vorbei? (AUFBAU/LAUFTEMPO hoch gegen niedrig)",
    links: kader("Agil", () => A(AGIL_HOCH), 8),
    rechts: kader("Traege", () => A(AGIL_NIEDRIG), 8),
  },
};

// ---------------------------------------------------------------------------------
// KLASSIFIZIERT NACH DEM NAECHSTEN VERTEIDIGER, nicht nach dem zugeteilten Mann — genau
// wie die NBA-Trackingdaten, gegen die geeicht wird ("closest defender"). Die erste
// Fassung dieses Skripts nahm den zugeteilten Decker und las dadurch "Dunk eng 64 %, frei
// 63 %", also scheinbar wirkungslose Verteidigung: bei einem Drive ist der eigene Mann
// abgehaengt, gestoert wird vom Helfer. Der Kontest wirkte, die Messung sah ihn nur nicht.
const bedraengnisStufe = (abstandPx) => {
  const px = abstandPx == null ? 999 : abstandPx;
  const ft = px / PX_JE_FUSS;
  if (ft < 2) return "eng";      // very tight
  if (ft < 4) return "dicht";    // tight
  if (ft < 6) return "offen";    // open
  return "frei";                 // wide open
};

const quote = (treffer, versuche) => (versuche ? (treffer / versuche) * 100 : 0);
const intervall = (treffer, versuche) => {
  if (!versuche) return 0;
  const p = treffer / versuche;
  return 1.96 * Math.sqrt((p * (1 - p)) / versuche) * 100;
};
const MINDEST = 40; // unter dieser Fallzahl wird eine Quote nicht als Aussage gedruckt

function zeile(label, treffer, versuche, ziel) {
  const q = quote(treffer, versuche);
  const ci = intervall(treffer, versuche);
  const zahl = versuche
    ? `${q.toFixed(1)} % ±${ci.toFixed(1)}  (${treffer}/${versuche})`
    : "— (0 Versuche)";
  const duenn = versuche && versuche < MINDEST ? "  [zu duenn]" : "";
  const abw = ziel != null && versuche >= MINDEST ? `   Ziel ${ziel} %  Δ ${(q - ziel > 0 ? "+" : "") + (q - ziel).toFixed(1)}` : "";
  return `  ${label.padEnd(30)} ${zahl.padEnd(30)}${abw}${duenn}`;
}

async function auswerten(seite, name, def) {
  const roh = await seite.evaluate(
    ([n, k]) => window.__arena.wurfSerie(n, k),
    [spiele, def ? { links: def.links, rechts: def.rechts } : null],
  );

  const wuerfe = roh.spiele.flatMap((s) => s.wuerfe);
  const feld = wuerfe.filter((w) => w.aus !== "freiwurf");
  const ft = wuerfe.filter((w) => w.aus === "freiwurf");

  // Ein Feldwurf zaehlt als getroffen, wenn er drin war. Foul ohne Treffer und Block
  // sind Fehlversuche — genau wie im echten Boxscore (ein Wurffoul ohne Korb zaehlt in
  // der NBA zwar NICHT als FGA, hier aber schon, s. fsBisher(); die Menge ist klein und
  // wird unten separat ausgewiesen, damit die Zahl vergleichbar bleibt).
  const istTreffer = (w) => w.aus === "treffer";
  const nachTier = {};
  for (const w of feld) {
    const t = w.tier || "?";
    (nachTier[t] ||= { a: 0, m: 0, stufen: {} });
    nachTier[t].a++;
    if (istTreffer(w)) nachTier[t].m++;
    const s = bedraengnisStufe(w.naechster);
    (nachTier[t].stufen[s] ||= { a: 0, m: 0 });
    nachTier[t].stufen[s].a++;
    if (istTreffer(w)) nachTier[t].stufen[s].m++;
  }

  const zweier = feld.filter((w) => w.tier !== "fern");
  const dreier = feld.filter((w) => w.tier === "fern");
  const fouls = feld.filter((w) => w.aus === "foul");
  const bloecke = feld.filter((w) => w.aus === "block");

  const punkte = roh.spiele.map((s) => s.punkte);
  const margen = punkte.map(([l, r]) => l - r);
  const siegeL = margen.filter((m) => m > 0).length;
  const siegeR = margen.filter((m) => m < 0).length;
  const mittel = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  console.log(`\n${"=".repeat(78)}`);
  console.log(`SZENARIO ${name}${def ? " — " + def.titel : " — echte Kader (Wranglers gegen Aftermath)"}`);
  // Kaderstaerke nach der Basketball-Matrix mitdrucken: bei jedem Szenario, das "gleich
  // stark" behauptet, muss man diese Zahl sehen koennen, sonst misst man Staerke und
  // nennt es Stil (s. Kommentar bei RIESEN).
  if (def) {
    console.log(
      `Kaderstaerke nach Matrix: links ${matrixWert(def.links[0].a).toFixed(1)} — ` +
        `rechts ${matrixWert(def.rechts[0].a).toFixed(1)}`,
    );
  }
  console.log(`${spiele} Spiele, ${feld.length} Feldwuerfe (${(feld.length / spiele / 2).toFixed(1)} je Team und Spiel), ${ft.length} Freiwuerfe`);
  console.log(`${"=".repeat(78)}`);

  console.log("\nWURFQUOTEN NACH STUFE (Engine-Stufe → NBA-Zone)");
  for (const t of ["dunk", "nah", "mit", "fern"]) {
    const e = nachTier[t];
    console.log(zeile(`${t} (${ZIEL[t].was})`, e ? e.m : 0, e ? e.a : 0, ZIEL[t].pct));
  }
  console.log(zeile("Freiwurf", ft.filter((w) => w.treffer).length, ft.length, ZIEL.freiwurf.pct));
  console.log(zeile("2P gesamt", zweier.filter(istTreffer).length, zweier.length, 54));
  console.log(zeile("3P gesamt", dreier.filter(istTreffer).length, dreier.length, ZIEL.fern.pct));
  console.log(zeile("FG gesamt", feld.filter(istTreffer).length, feld.length, 46));

  console.log("\nWIRKT VERTEIDIGUNG? — Quote nach Abstand des Deckers im Abwurfmoment");
  console.log("  (NBA: 0-2 ft very tight, 2-4 ft tight, 4-6 ft open, 6+ ft wide open)");
  for (const t of ["dunk", "nah", "mit", "fern"]) {
    const e = nachTier[t];
    if (!e) continue;
    const teile = ["eng", "dicht", "offen", "frei"].map((s) => {
      const x = e.stufen[s];
      if (!x) return `${s} —`;
      return `${s} ${quote(x.m, x.a).toFixed(0)}%(${x.a})`;
    });
    console.log(`  ${t.padEnd(6)} ${teile.join("  ")}`);
  }
  const fernFrei = nachTier.fern?.stufen.frei;
  const fernEng = ["eng", "dicht"].reduce(
    (acc, s) => {
      const x = nachTier.fern?.stufen[s];
      return x ? { a: acc.a + x.a, m: acc.m + x.m } : acc;
    },
    { a: 0, m: 0 },
  );
  console.log(zeile("  3P frei (6+ ft)", fernFrei?.m || 0, fernFrei?.a || 0, ZIEL_FERN_FREI));
  console.log(zeile("  3P bedraengt (<4 ft)", fernEng.m, fernEng.a, ZIEL_FERN_ENG));
  const spreizung =
    fernFrei && fernFrei.a >= MINDEST && fernEng.a >= MINDEST
      ? (quote(fernFrei.m, fernFrei.a) - quote(fernEng.m, fernEng.a)).toFixed(1)
      : "zu duenn";
  console.log(`  Spreizung frei-minus-bedraengt: ${spreizung} Pp   (NBA rund 8 Pp)`);

  // ZWEITE, RAUSCHAERMERE LESUNG DERSELBEN FRAGE. Die Abstandsstufen oben sind der
  // NBA-Vergleich, aber sie sind duenn (ein "eng" geworfener Dreier kommt ein paar Mal je
  // hundert Spielen vor) und sie lesen den ABSTAND, waehrend die Engine mit der
  // BEDRAENGNIS rechnet — beides faellt auseinander, sobald ein naher Verteidiger aus
  // gutem Grund wenig stoert (Fastbreak, gerade ausgedribbelt). Deshalb hier dieselbe
  // Frage noch einmal an der Zahl, mit der die Engine tatsaechlich gerechnet hat
  // (bedraengnisBeiWurf, 0 = voellig frei, 1 = ein Verteidiger klebt, bis 1,6 bei mehreren).
  // DAS ist die Zahl, die Chris' Frage beantwortet ("wie viel trifft er frei, wie viel
  // wenn er verteidigt wird") — die Stufen darueber sagen, ob sie NBA-realistisch ist.
  console.log("\n  dieselbe Frage an der ENGINE-Bedraengnis (rauschaermer, gleiche Aussage)");
  for (const t of ["dunk", "nah", "mit", "fern"]) {
    const mitB = feld.filter((w) => w.tier === t && w.bedraengnis != null);
    if (mitB.length < 2 * MINDEST) continue;
    const frei = mitB.filter((w) => w.bedraengnis < 0.15);
    const eng = mitB.filter((w) => w.bedraengnis >= 0.45);
    if (frei.length < MINDEST || eng.length < MINDEST) {
      console.log(`  ${t.padEnd(6)} zu duenn (frei ${frei.length}, bedraengt ${eng.length})`);
      continue;
    }
    const qf = quote(frei.filter(istTreffer).length, frei.length);
    const qe = quote(eng.filter(istTreffer).length, eng.length);
    console.log(
      `  ${t.padEnd(6)} frei ${qf.toFixed(1)} % (${frei.length})  ->  bedraengt ${qe.toFixed(1)} % (${eng.length})` +
        `   = ${(qf - qe).toFixed(1)} Pp Wirkung`,
    );
  }

  // JE STUFE GETRENNT. Ueber alle Wuerfe gemischt ist die Frage nicht beantwortbar: gute
  // Schuetzen nehmen mehr Dreier (niedrigere Grundquote), schlechte mehr Korbleger — der
  // Mix hebt den Unterschied auf. Die erste Fassung dieses Skripts las deshalb "unteres
  // Drittel 52,0 %, oberes 50,4 %" und haette fast zu dem falschen Schluss gefuehrt, die
  // Schuetzenguete wirke gar nicht.
  console.log("\nSCHUETZENGUETE — trennt die Engine gute von schlechten Schuetzen? (je Stufe)");
  for (const [feldName, label] of [["tech", "TECHNIK"], ["abschluss", "ABSCHLUSS"]]) {
    const zeilen = [];
    for (const t of ["dunk", "nah", "mit", "fern"]) {
      const mitWert = feld.filter((w) => w.tier === t && w[feldName] != null);
      if (mitWert.length < 3 * MINDEST) continue;
      const sortiert = [...mitWert].sort((a, b) => a[feldName] - b[feldName]);
      const drittel = Math.floor(sortiert.length / 3);
      const unten = sortiert.slice(0, drittel);
      const oben = sortiert.slice(sortiert.length - drittel);
      const qu = quote(unten.filter(istTreffer).length, unten.length);
      const qo = quote(oben.filter(istTreffer).length, oben.length);
      zeilen.push(
        `${t} ${qu.toFixed(0)}%(~${Math.round(mittel(unten.map((w) => w[feldName])))}) ` +
          `-> ${qo.toFixed(0)}%(~${Math.round(mittel(oben.map((w) => w[feldName])))}) ` +
          `= ${(qo - qu > 0 ? "+" : "") + (qo - qu).toFixed(0)} Pp`,
      );
    }
    console.log(`  ${label}: ${zeilen.length ? zeilen.join("   ") : "zu duenn"}`);
  }
  const ftSort = [...ft].filter((w) => w.abschluss != null).sort((a, b) => a.abschluss - b.abschluss);
  if (ftSort.length > 30) {
    const d = Math.floor(ftSort.length / 3);
    const u = ftSort.slice(0, d), o = ftSort.slice(ftSort.length - d);
    console.log(
      `  Freiwurf nach ABSCHLUSS: unten ${quote(u.filter((w) => w.treffer).length, u.length).toFixed(1)} %, ` +
        `oben ${quote(o.filter((w) => w.treffer).length, o.length).toFixed(1)} %`,
    );
  }

  console.log("\nWURFVERTEILUNG (Anteil der Versuche je Stufe)");
  const anteile = ["dunk", "nah", "mit", "fern"]
    .map((t) => `${t} ${(((nachTier[t]?.a || 0) / Math.max(1, feld.length)) * 100).toFixed(0)} %`)
    .join("   ");
  console.log(`  ${anteile}`);
  console.log(
    `  NBA-Referenz: rund 33 % am Ring, 12 % Paint, 12 % Mid-Range, 43 % Dreier ` +
      `(Anteil der Dreierversuche zuletzt rund 42-43 %)`,
  );

  console.log("\nEREIGNISSE JE SPIEL");
  const proSpiel = (x) => (x / spiele).toFixed(1);
  console.log(
    `  Punkte ${mittel(punkte.map((p) => p[0])).toFixed(1)} : ${mittel(punkte.map((p) => p[1])).toFixed(1)}   ` +
      `Siege ${siegeL}:${siegeR}   mittlere Marge ${mittel(margen).toFixed(1)} ` +
      `(Betrag ${mittel(margen.map(Math.abs)).toFixed(1)})`,
  );
  const summe = (k) => roh.spiele.reduce((s, x) => s + (x[k] || 0), 0);
  console.log(
    `  Steals ${proSpiel(summe("steals"))}   Abfaenge ${proSpiel(summe("abfaenge"))}   ` +
      `Fehlpaesse ${proSpiel(summe("turnovers"))}   Rebounds ${proSpiel(summe("rebounds"))}   ` +
      `Bloecke ${proSpiel(bloecke.length)}   Wurffouls ${proSpiel(fouls.length)}`,
  );
  // BALLBESITZE und TURNOVER-QUOTE — die Zahl, an der sich "spielt sich das wie Basketball
  // an" am ehesten entscheidet. NBA: rund 13 % der Ballbesitze enden im Turnover.
  const turnover = summe("steals") + summe("abfaenge") + summe("turnovers");
  const besitze = feld.length + turnover + fouls.length;
  console.log(
    `  Ballbesitze ${(besitze / spiele).toFixed(1)} je Spiel, davon ${((turnover / Math.max(1, besitze)) * 100).toFixed(0)} % Turnover ` +
      `(NBA rund 13 %)`,
  );
  console.log(
    `  Doppelungen ${proSpiel(summe("doppelTeams"))}   Durchbrueche ${proSpiel(summe("durchbrueche"))}   ` +
      `Teamstil L/R ${(roh.spiele[0].stil || [0, 0]).map((x) => x.toFixed(2)).join(" / ")}`,
  );
  const gedoppelt = feld.filter((w) => w.doppel);
  if (gedoppelt.length) {
    console.log(
      zeile("  Wurf bei Doppelung", gedoppelt.filter(istTreffer).length, gedoppelt.length, null),
    );
  }

  // ---------------------------------------------------------------------------------
  // MECHANIK-EINZELPRUEFUNG — die beiden Fragen, die Chris woertlich gestellt hat.
  // Beide werden hier NICHT am Endstand beantwortet (ein starkes Team gewinnt auch aus
  // hundert anderen Gruenden), sondern an der Stelle, an der die Mechanik ansetzt.
  // ---------------------------------------------------------------------------------
  // ---------------------------------------------------------------------------------
  // ERKENNT MAN DEN STIL? — Chris' Feature-Wunsch, gemessen statt behauptet.
  //
  // "Ein Team wie N-N mit vielen schnellen Spielern wuerde ja versuchen anders zu
  // gewinnen — im Vergleich zu einem Team wie T-G, die mit Giants ankommen."
  // Die Frage ist nicht, ob im Code ein Stilwert steht, sondern ob die BEIDEN SEITEN
  // DESSELBEN SPIELS unterschiedlich spielen. Deshalb wird hier alles je Seite getrennt
  // ausgewiesen — dieselben Zahlen, mit denen man auch ein echtes Team beschreiben wuerde:
  // wo wird geworfen, wie schnell wird gespielt, wer holt die Baelle.
  // ---------------------------------------------------------------------------------
  console.log("\nERKENNT MAN DEN STIL? — dieselben Kennzahlen, je Seite getrennt");
  {
    const stil = roh.spiele[0].stil || [0, 0];
    for (const s of [0, 1]) {
      const meine = feld.filter((w) => w.seite === s);
      if (!meine.length) continue;
      const ant = (t) => ((meine.filter((w) => w.tier === t).length / meine.length) * 100).toFixed(0);
      const db = roh.spiele.flatMap((x) => x.durchbruchListe || []).filter((x) => x.seite === s);
      const pkt = mittel(roh.spiele.map((x) => x.punkte[s]));
      console.log(
        `  Seite ${s} (Stil ${stil[s] >= 0 ? "+" : ""}${stil[s].toFixed(2)}): ` +
          `Wuerfe ${(meine.length / spiele).toFixed(1)}/Spiel   ` +
          `Ring ${ant("dunk")} % / Zone ${ant("nah")} % / Mid ${ant("mit")} % / Dreier ${ant("fern")} %   ` +
          `Durchbrueche ${(db.length / spiele).toFixed(1)}   Punkte ${pkt.toFixed(1)}`,
      );
    }
    console.log(
      "  (Stil +1 = reiner Tempokader, -1 = reiner Riesenkader; aus LAUFTEMPO gegen WUCHT" +
        " des Kaders abgeleitet, nicht gesetzt)",
    );
  }

  console.log("\nPOWERT SICH EIN STARKER SPIELER DURCH? — Wuerfe am Ring (dunk/nah) gegen einen Verteidiger");
  {
    // Nur BEDRAENGTE Ringwuerfe: frei am Korb soll WUCHT ausdruecklich nichts bringen.
    // Gemessen wird die WUCHT-DIFFERENZ Schuetze minus naechster Verteidiger — genau die
    // Groesse, mit der wuchtEntlastungVon() rechnet.
    //
    // NUR IM SZENARIO "wucht" IST DIESE ZAHL SAUBER. In jedem Kader, in dem die Attribute
    // zusammenhaengen, teilt ein Drittelschnitt nach WUCHT gleichzeitig nach etwas
    // anderem mit: bei den ECHTEN Kadern sind die wuchtstarken Spieler (Lava Golem, Gram)
    // genau die mit der schlechtesten TECHNIK — die Messung liest dort -3,7 Pp, obwohl die
    // Mechanik unveraendert wirkt, weil das obere WUCHT-Drittel zugleich das untere
    // Schuetzendrittel ist. Deshalb gibt es das Szenario "wucht": dort ist alles ausser
    // power/torment/stamina gleich, und nur dort beantwortet die Zahl die Frage.
    const ring = feld.filter(
      (w) => (w.tier === "dunk" || w.tier === "nah") && w.bedraengnis >= 0.3 && w.wucht != null && w.deckerWucht != null,
    );
    if (ring.length < 2 * MINDEST) console.log(`  zu duenn (${ring.length} bedraengte Ringwuerfe)`);
    else {
      const sortiert = [...ring].sort((a, b) => a.wucht - a.deckerWucht - (b.wucht - b.deckerWucht));
      const d = Math.floor(sortiert.length / 3);
      const u = sortiert.slice(0, d), o = sortiert.slice(sortiert.length - d);
      const qu = quote(u.filter(istTreffer).length, u.length);
      const qo = quote(o.filter(istTreffer).length, o.length);
      const dif = (xs) => mittel(xs.map((w) => w.wucht - w.deckerWucht)).toFixed(0);
      console.log(
        `  unterlegen (WUCHT-Differenz ~${dif(u)}) ${qu.toFixed(1)} %  ->  ` +
          `ueberlegen (~${dif(o)}) ${qo.toFixed(1)} %   = ${(qo - qu > 0 ? "+" : "") + (qo - qu).toFixed(1)} Pp`,
      );
    }
    const frei = feld.filter(
      (w) => (w.tier === "dunk" || w.tier === "nah") && w.bedraengnis < 0.1 && w.wucht != null,
    );
    if (frei.length >= 2 * MINDEST) {
      const s2 = [...frei].sort((a, b) => a.wucht - b.wucht);
      const d = Math.floor(s2.length / 3);
      const qu = quote(s2.slice(0, d).filter(istTreffer).length, d);
      const qo = quote(s2.slice(s2.length - d).filter(istTreffer).length, d);
      console.log(
        `  Gegenprobe FREI am Ring (soll NICHT wirken): schwach ${qu.toFixed(1)} % -> stark ${qo.toFixed(1)} % ` +
          `= ${(qo - qu > 0 ? "+" : "") + (qo - qu).toFixed(1)} Pp`,
      );
    }
  }

  console.log("\nDRIBBELT EIN AGILER SPIELER VORBEI? — gelungene Durchbrueche je Team und Spiel");
  {
    const db = roh.spiele.flatMap((s) => s.durchbruchListe || []);
    if (!db.length) console.log("  (Engine liefert keine Durchbruch-Liste)");
    else {
      for (const s of [0, 1]) {
        const meine = db.filter((x) => x.seite === s);
        if (!meine.length) { console.log(`  Seite ${s}: 0`); continue; }
        console.log(
          `  Seite ${s}: ${(meine.length / spiele).toFixed(1)} je Spiel   ` +
            `AUFBAU des Durchbrechers ~${mittel(meine.map((x) => x.aufbau)).toFixed(0)} ` +
            `gegen ABWEHR ~${mittel(meine.map((x) => x.abwehr)).toFixed(0)}   ` +
            `LAUFTEMPO ~${mittel(meine.map((x) => x.tempo)).toFixed(0)} gegen ~${mittel(meine.map((x) => x.deckerTempo)).toFixed(0)}`,
        );
      }
      const versuche = roh.spiele.reduce((a, s) => a + (s.durchbruchVersuche || 0), 0);
      if (versuche) {
        console.log(
          `  Erfolgsquote der Versuche: ${((db.length / versuche) * 100).toFixed(0)} % ` +
            `(${db.length} von ${versuche})`,
        );
      }
    }
  }

  return { name, feld, ft, nachTier, margen, siegeL, siegeR, punkte, spiele: roh.spiele };
}

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto("file://" + pfad, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.wurfSerie, null, { timeout: 30000 });

const liste = szenarioArg === "alle" ? ["echt", "ueberlegen", "gleich", "stil", "wucht", "agil"] : [szenarioArg];
for (const s of liste) {
  if (!(s in SZENARIEN)) {
    console.error(`Unbekanntes Szenario "${s}". Bekannt: ${Object.keys(SZENARIEN).join(", ")}, alle`);
    process.exit(1);
  }
  const start = Date.now();
  await auswerten(seite, s, SZENARIEN[s]);
  console.log(`\n  (${((Date.now() - start) / 1000).toFixed(0)} s)`);
}

console.log("\nSeitenfehler:", fehler.length ? fehler.slice(0, 5) : "keine");
await browser.close();
