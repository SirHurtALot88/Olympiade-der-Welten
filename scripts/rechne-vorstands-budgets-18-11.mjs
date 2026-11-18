/* eslint-disable no-console */
/**
 * Zwei-Budget-Modell des Vorstands (docs/design/finanzkonzept-v2-budgets-18-11.md).
 *
 * REINE RECHNUNG auf den Messdaten vom 18.11. (Laeufe A/B/C, 32 KI-Teams) — keine Spiellogik, kein Spielstand.
 * Stellt je Team die zwei Toepfe (Transfer-/Investitionsbudget, Gehaltsbudget) neben das, was die KI in der
 * Messung tatsaechlich ausgegeben hat: Wer haette ueberzogen? Wer hat Luft?
 *
 * Liest:
 *   data/generated/finanzkonzept-v2-bilanz-18-11.json    (je Team: Sockel, Rangbonus, tragbares Gehalt, Stammwerte;
 *                                                        aus scripts/rechne-finanzkonzept-v2-18-11.mjs)
 *   data/generated/finanzen-ist-messung-18-11-roh.json   (Kasse, Kader, Gehalt je Phase; Kaeufe der Saison 2)
 * Schreibt: data/generated/finanzkonzept-v2-budgets-18-11.json
 *
 *   node scripts/rechne-vorstands-budgets-18-11.mjs            alle Tabellen
 *   node scripts/rechne-vorstands-budgets-18-11.mjs --kurz     nur Summen und Beispiele
 *
 * Teil 1  Saison 1 (Draft), Laeufe A/B/C: Toepfe aus dem Startbudget gegen Draft-Ausgabe und Gehalt der Messung.
 * Teil 2  Transferfenster Saison 2, Laeufe B/C (A ist dort unsauber): Toepfe aus der echten Kasse nach dem
 *         Vertragsablauf, Verkaeufe der KI als Zufluss (mit Lockerungsregel), gegen Kaeufe, Gebaeude und Gehalt.
 * Teil 3  Wirkung auf die Geldmengen-Bilanz: die KI plant mit beiden Toepfen (Umschichten nach Charakter).
 *
 * Was HOCHRECHNUNG ist: alles aus rechne-finanzkonzept-v2-18-11.mjs (Gehalt proportional zur Ausgabe, Endrang
 * bleibt der gemessene), dazu in Teil 2 der Sponsor der Saison 2 (Sockel und Rangbonus am Endrang der Saison 1,
 * weil der neue Vertrag nicht in den Messdaten steht) und das Vorstandsvertrauen nach Saison 1 (Formel 5.7 des
 * Konzepts auf den gemessenen Raengen; im Spiel gibt es diese Fortschreibung noch nicht).
 */
import fs from "node:fs";

const bilanz = JSON.parse(fs.readFileSync("data/generated/finanzkonzept-v2-bilanz-18-11.json", "utf8"));
const roh = JSON.parse(fs.readFileSync("data/generated/finanzen-ist-messung-18-11-roh.json", "utf8"));
const kurz = process.argv.includes("--kurz");

/* ------------------------------------------------------------------ Startwerte des Budget-Modells */
export const B = {
  // Vertrauens-Quote (Chris, 18.11.): ab 6 -> 100 %, 4 bis unter 6 -> 85 %, 2,5 bis unter 4 -> 70 %, darunter 50 %
  stufen: [{ ab: 6, quote: 1.0 }, { ab: 4, quote: 0.85 }, { ab: 2.5, quote: 0.7 }, { ab: -Infinity, quote: 0.5 }],
  ruecklageMin: 0.05, ruecklageMax: 0.25,   // Ruecklage-Ziel: Anteil am Budget, linear im Finanzwert 1..10
  pufferSpieltage: 7,                       // Gehaltspuffer: Ruecklage + Puffer decken mindestens 7 Spieltage Gehaltsbudget (0,35 x Jahr)
  // Umschichten: 1 C Transfer <-> 1 C Jahresgehalt (10 C <-> 0,5 C je Spieltag). Der Gehaltstopf darf dadurch
  // hoechstens um diesen Anteil wachsen oder schrumpfen (je Vertrauensstufe).
  umschichtGrenze: { 1: 0.25, 0.85: 0.2, 0.7: 0.15, 0.5: 0.1 },
  kiUmschichtAnteil: { vorsichtig: 0, normal: 0.5, aggressiv: 1 },   // wie viel der Grenze die KI nutzt
  // Lockerung nach Verkaeufen: Puffer X = Anteil x tragbares Gehalt, je strenger die Stufe, desto groesser
  lockerPuffer: { 0.5: 0.3, 0.7: 0.2, 0.85: 0.1 },
  // Annahmen fuer Saison 2 (Kader wieder auffuellen)
  abloeseJeSpieler: 20.8,                   // gemessen: Durchschnitt je Kauf im Draft (7687 C / 369)
  gebaeudeStufe1: { training_center: 8, recovery_center: 7, scouting_office: 6, analytics_room: 5, fan_shop: 10, arena_upgrade: 13, academy: 7, specialist_wing: 6 },
  // Einnahmen-Startwerte des Konzepts (wie rechne-finanzkonzept-v2-18-11.mjs)
  realisation: 0.92, vollesHaus: { liga1: 1.7, liga2: 1.15 }, merchBasis: { liga1: 4.4, liga2: 3.0 }, siegpraemie: { liga1: 0.2, liga2: 0.12 },
  arenaBetrieb: { liga1: 0.45, liga2: 0.3 }, reise: { liga1: 0.15, liga2: 0.1 }, kaderpraemieAnteil: 0.4,
  wertungstopf: 1133, ligafaktor: { liga1: 0.6, liga2: 0.4 }, wertungKurve: 1.35,
};
const SIGMA = bilanz.sigma;   // 0,667: SPONSOR_AUSSCHUETTUNG 0,73 statt 1,10

const r1 = (x) => Math.round(x * 10) / 10;
const sum = (a) => a.reduce((s, x) => s + x, 0);
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const quoteVon = (vertrauen) => B.stufen.find((s) => vertrauen >= s.ab).quote;
const naechsteStufe = (q) => (q >= 1 ? 1 : q >= 0.85 ? 1 : q >= 0.7 ? 0.85 : 0.7);
const ruecklageQuote = (fin) => clamp(B.ruecklageMin + (B.ruecklageMax - B.ruecklageMin) * (fin - 1) / 9, B.ruecklageMin, B.ruecklageMax);

/**
 * Die zwei Toepfe zu Beginn des Transferfensters.
 *   kasse      Kontostand zu Fensterbeginn (Saison 1: Startbudget)
 *   basis      Bemessung der Ruecklage (Saison 1: Startbudget, danach Kasse + Marktwert des Kaders)
 *   tragbar    erwartete Saisoneinnahmen - Fixkosten (bei Quote 100 % ist das der Gehaltstopf)
 */
export function toepfe({ kasse, basis, fin, tragbar, quote }) {
  const ruecklage = ruecklageQuote(fin) * basis;
  const gehalt = Math.max(0, tragbar) * quote;                                    // Jahreswert
  const puffer = Math.max(0, (B.pufferSpieltage / 20) * gehalt - ruecklage);      // was der Ruecklage zu 7 Spieltagen fehlt
  const transferBasis = Math.max(0, kasse - ruecklage - puffer);
  return { quote, ruecklage, puffer, gehalt, transferBasis, transfer: transferBasis * quote, gesperrt: transferBasis * (1 - quote) };
}

/** Lockerung: genug Verkaufserloes -> Quote eine Stufe hoeher, mit Boden und Obergrenze. */
export function lockerung({ topf, tragbar, verkauf }) {
  const q = topf.quote;
  if (q >= 1) return { moeglich: false, puffer: 0, schwelle: 0, fehlt: 0, quoteNeu: 1, transfer: topf.transfer + verkauf, mehr: 0 };
  const puffer = B.lockerPuffer[q] * Math.max(0, tragbar);
  const schwelle = puffer / (1 - q);                       // noetiger Verkaufserloes: einbehaltener Anteil (1-q) x V >= X
  const ohne = topf.transfer + q * verkauf;                // Verkaufserloese fliessen zur selben Quote ein
  if (verkauf + 1e-9 < schwelle) return { moeglich: true, erreicht: false, puffer, schwelle, fehlt: schwelle - verkauf, quoteNeu: q, transfer: ohne, mehr: 0 };
  const qNeu = naechsteStufe(q), basis = topf.transferBasis + verkauf;
  const mit = Math.min(qNeu * basis, ohne + verkauf, basis - puffer);   // neue Quote | Obergrenze: Mehrfreigabe <= Verkaufserloes | Boden
  return { moeglich: true, erreicht: true, puffer, schwelle, fehlt: 0, quoteNeu: qNeu, transfer: Math.max(ohne, mit), mehr: Math.max(0, mit - ohne) };
}

/** Umschichten nach KI-Charakter. Liefert die Toepfe nach dem Umschichten, wenn das Team `gehaltJeC` Jahresgehalt je C Abloese kauft. */
export function kiUmschichten({ topf, transfer, typ, gehaltJeC }) {
  const grenze = B.umschichtGrenze[topf.quote] * B.kiUmschichtAnteil[typ] * topf.gehalt;
  const gehaltBindet = gehaltJeC * transfer > topf.gehalt;
  let x = 0;
  if (gehaltBindet) x = Math.min((gehaltJeC * transfer - topf.gehalt) / (1 + gehaltJeC), grenze, transfer);      // Transfer -> Gehalt
  else x = -Math.min((topf.gehalt - gehaltJeC * transfer) / (1 + gehaltJeC), grenze, 0.5 * (topf.ruecklage + topf.puffer));  // Gehalt -> Transfer
  return { verschoben: x, transfer: transfer - x, gehalt: topf.gehalt + x, gehaltBindet };
}

/* ------------------------------------------------------------------ Teil 1: Saison 1 (Draft) */
function klassen(teams) {
  // wie in der Analyse: je Liga nach Startbudget, oberste 5 reich, naechste 6 mittel, unterste 5 arm
  const k = {};
  for (const liga of ["liga1", "liga2"]) {
    teams.filter((t) => t.liga === liga).sort((a, b) => b.budget - a.budget).forEach((t, i) => { k[t.id] = i < 5 ? "reich" : i < 11 ? "mittel" : "arm"; });
  }
  return k;
}

function saison1(label, quoteModus) {
  const teams = bilanz.laeufe[label].teams, kl = klassen(teams);
  return teams.map((t) => {
    const quote = quoteModus === "vertrauen" ? quoteVon(t.vertrauen) : 1;
    const topf = toepfe({ kasse: t.budget, basis: t.budget, fin: t.fin, tragbar: t.tragbar, quote });
    const abloeseIst = t.budget - t.cashIst;
    return {
      id: t.id, liga: t.liga, klasse: kl[t.id], typ: t.typ, fin: t.fin, vertrauen: t.vertrauen, quote, budget: t.budget,
      ruecklage: topf.ruecklage, puffer: topf.puffer, transfer: topf.transfer, gesperrt: topf.gesperrt, abloeseIst, transferLuft: topf.transfer - abloeseIst,
      tragbar: t.tragbar, gehaltTopf: topf.gehalt, gehaltIst: t.gehaltIst, gehaltLuft: topf.gehalt - t.gehaltIst,
      messartefakt: t.id === "M-M",
    };
  });
}

/* ------------------------------------------------------------------ Teil 2: Transferfenster Saison 2 */
function gewicht(rang) {
  const w = (r) => Math.pow((16 - r) / 15, B.wertungKurve);
  let s = 0; for (let r = 1; r <= 16; r++) s += w(r);
  return w(rang) / s;
}
function tragbarSaison2(liga, rang, faktor) {
  // Sockel und Rangbonus am Endrang der Saison 1 (Hochrechnung: der neue Sponsorvertrag steht nicht in den Messdaten)
  const sockel = SIGMA * (19.8 + (52.8 - 19.8) * (rang - 1) / 15);
  const rangbonus = SIGMA * B.wertungstopf * B.ligafaktor[liga] * gewicht(rang) * faktor;
  const ticket = 10 * B.vollesHaus[liga] * (0.3 + 0.85 * 0.5), merch = B.merchBasis[liga], praemie = 20 * B.siegpraemie[liga];
  const fix = 10 * B.arenaBetrieb[liga] + 10 * B.reise[liga] + praemie * B.kaderpraemieAnteil;
  return { sockel, rangbonus, sonst: ticket + merch + praemie, fix, tragbar: B.realisation * (sockel + rangbonus) + ticket + merch + praemie - fix };
}

/**
 * modus "gemessen":      Kasse der Messung (die KI hat in Saison 1 keine Ruecklage gehalten) -> Einfuehrungsjahr der Regel.
 * modus "eingeschwungen": Hochrechnung. Die Teams haben schon Saison 1 mit beiden Toepfen geplant (Teil 3): Kasse nach der
 *                         Abrechnung aus dieser Rechnung, Abloesen/Verkaeufe/Marktwerte im Verhaeltnis der billigeren Kader,
 *                         dazu der Liga-Topf (Annahme LIGA_TOPF, halb gleich, halb nach Vertrauen).
 */
const LIGA_TOPF = 475;   // Mitte der Schaetzung 390 bis 560 C aus dem Konzept, Abschnitt 3.3
function saison2(label, modus = "gemessen") {
  const ph = roh.laeufe[label].roh.phasen, s1 = bilanz.laeufe[label].teams, kl = klassen(s1);
  const ein = modus === "eingeschwungen", plan1 = Object.fromEntries(bilanzSaison1(label, 1, 1.0, "voll").zeilen.map((z) => [z.id, z]));
  const vorab = {};
  const ende = ph.s1_04_nach_abschluss, vorVerkauf = ph.s1_05_kette_4_season_end_management.snap, nachVerkauf = ph.s1_05_kette_5_transfer_sell_phase.snap;
  const nachKauf = ph.s2_01_nach_kaufphase.snap, draft = ph.s1_01_nach_draft.snap;
  const kaeufe = roh.laeufe[label].nebendaten.transfersJeTeamSaison2 || {};
  for (const t of s1) {
    // Vorstandsvertrauen nach Saison 1 (Konzept 5.7)
    const id = t.id, g1 = (x) => (ein ? plan1[x.id].gehalt : x.gehaltIst);
    const gehaltsRang = 1 + s1.filter((x) => x.liga === t.liga && g1(x) > g1(t)).length;
    const endRang = ende.snap[id].rank, kasseEnde = ein ? plan1[id].kasseEnde : ende.snap[id].cash, guv = ein ? plan1[id].guv : ende.guv[id].guv.guv;
    const dV = clamp((gehaltsRang - endRang) * 0.25, -2, 2) + (kasseEnde >= 0 ? 0.25 : -0.5) + (guv < -0.1 * g1(t) && endRang > gehaltsRang ? -0.5 : 0);
    vorab[id] = { gehaltsRang, endRang, kasseEnde, vertrauen: clamp(t.vertrauen + dV, 0, 10) };
  }
  const vSumme = sum(Object.values(vorab).map((v) => v.vertrauen));
  return s1.map((t) => {
    const id = t.id, liga = t.liga, { gehaltsRang, endRang, vertrauen } = vorab[id], quote = quoteVon(vertrauen);
    const ratio = ein ? plan1[id].gehalt / t.gehaltIst : 1;
    const ablauf = Math.max(0, vorVerkauf[id].cash - ende.snap[id].cash);
    const topfAnteil = ein ? LIGA_TOPF / 2 / s1.length + (LIGA_TOPF / 2) * vertrauen / vSumme : 0;
    const kasse0 = ein ? vorab[id].kasseEnde + ablauf * ratio + topfAnteil : vorVerkauf[id].cash;
    // Steht die Kasse im Minus, gleichen Verkaufserloese zuerst das Minus aus; nur der Rest fliesst in den Topf.
    const marktwert = vorVerkauf[id].marktwert * ratio, verkaufBrutto = Math.max(0, nachVerkauf[id].cash - vorVerkauf[id].cash) * ratio;
    const verkauf = Math.max(0, verkaufBrutto + Math.min(0, kasse0));
    const plan = tragbarSaison2(liga, endRang, 1.0);
    const topf = toepfe({ kasse: kasse0, basis: Math.max(0, kasse0) + marktwert, fin: t.fin, tragbar: plan.tragbar, quote });
    const lock = lockerung({ topf, tragbar: plan.tragbar, verkauf });
    const kaufIst = ein ? 0 : (kaeufe[id] && kaeufe[id].kaufSumme) || 0;
    const bauIst = ein ? 0 : sum(nachKauf[id].gebaeude.map((g) => B.gebaeudeStufe1[g.id] || 0));
    const kaderJetzt = ein ? nachVerkauf[id].kader : nachKauf[id].kader, gehaltJetzt = (ein ? nachVerkauf[id].gehaltIst : nachKauf[id].gehaltIst) * ratio;
    const sollKader = draft[id].kader, fehlt = Math.max(0, sollKader - kaderJetzt);
    const gehaltJeSpieler = (draft[id].gehaltIst / draft[id].kader) * ratio;
    const voll = kaufIst + bauIst + fehlt * B.abloeseJeSpieler * ratio, gehaltVoll = gehaltJetzt + fehlt * gehaltJeSpieler;
    return {
      id, liga, klasse: kl[id], typ: t.typ, fin: t.fin, vertrauenStart: t.vertrauen, vertrauen, quote, endRang, gehaltsRang,
      kasse0, marktwert, ruecklage: topf.ruecklage, puffer: topf.puffer, transferStart: topf.transfer, gesperrt: topf.gesperrt, verkauf,
      lockerPuffer: lock.puffer, lockerSchwelle: lock.schwelle, lockerFehlt: lock.fehlt, gelockert: !!lock.erreicht, quoteNeu: lock.quoteNeu, lockerMehr: lock.mehr,
      transfer: lock.transfer, kaufIst, bauIst, ausgabeIst: kaufIst + bauIst, transferLuft: lock.transfer - kaufIst - bauIst,
      kader: kaderJetzt, sollKader, ausgabeVoll: voll, transferLuftVoll: lock.transfer - voll,
      tragbar: plan.tragbar, gehaltTopf: topf.gehalt, gehaltVorFenster: nachVerkauf[id].gehaltIst * ratio, gehaltIst: gehaltJetzt, gehaltLuft: topf.gehalt - gehaltJetzt,
      gehaltVoll, gehaltLuftVoll: topf.gehalt - gehaltVoll, schuld: nachKauf[id].schuld, ligaTopf: topfAnteil,
      messartefakt: id === "M-M",
    };
  });
}

/* ------------------------------------------------------------------ Teil 3: Geldmengen-Bilanz, KI plant mit beiden Toepfen */
function bilanzSaison1(label, s, faktor, quoteModus) {
  // s = Skalierung des Sponsors gegenueber SIGMA (1 = SPONSOR_AUSSCHUETTUNG 0,73)
  const zeilen = bilanz.laeufe[label].teams.map((t) => {
    const quote = quoteModus === "vertrauen" ? quoteVon(t.vertrauen) : 1;
    const tragbar = t.tragbar + (s - 1) * t.planSponsor;
    const topf = toepfe({ kasse: t.budget, basis: t.budget, fin: t.fin, tragbar, quote });
    const gehaltJeC = t.gehaltIst / (t.budget - t.cashIst);
    const um = kiUmschichten({ topf, transfer: topf.transfer, typ: t.typ, gehaltJeC });
    const ausgabe = Math.min(t.budget - t.cashIst, um.transfer, um.gehalt / gehaltJeC);
    const gehalt = gehaltJeC * ausgabe;
    const ein = s * (t.sockel + t.rangbonus * faktor) + t.ticket + t.merch + t.praemie + t.vorstand;
    const aus = gehalt + t.betrieb + t.kaderpraemie;
    return { id: t.id, typ: t.typ, quote, verschoben: um.verschoben, bindet: ausgabe >= t.budget - t.cashIst - 1e-6 ? "nichts" : um.transfer <= um.gehalt / gehaltJeC ? "Transfer" : "Gehalt", ausgabe, gehalt, kasseStart: t.budget - ausgabe, guv: ein - aus, kasseEnde: t.budget - ausgabe + ein - aus, kasseSt20: t.budget - ausgabe + s * t.sockel + t.ticket + t.merch + t.praemie - aus };
  });
  const S = (k) => sum(zeilen.map((z) => z[k]));
  return { zeilen, gehalt: S("gehalt"), kasseStart: S("kasseStart"), guv: S("guv"), imMinusSt20: zeilen.filter((z) => z.kasseSt20 < 0).length, imMinusEnde: zeilen.filter((z) => z.kasseEnde < 0).length,
    bindetTransfer: zeilen.filter((z) => z.bindet === "Transfer").length, bindetGehalt: zeilen.filter((z) => z.bindet === "Gehalt").length };
}
function eiche(quoteModus) {
  let lo = 0.6, hi = 1.6;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; const g = sum(["A", "B", "C"].map((l) => bilanzSaison1(l, m, 1.0, quoteModus).guv)); if (g > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

/* ------------------------------------------------------------------ Ausgabe */
const QUOTENFELDER = new Set(["quote", "quoteNeu"]);
const runde = (x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === "number" && !QUOTENFELDER.has(k) ? r1(v) : v]));
const aus = { erzeugt: new Date().toISOString(), konstanten: B, sigma: SIGMA, saison1: {}, saison2: {}, bilanz: {} };

function zusammenfassung(zeilen, tKey, gKey) {
  const z = zeilen.filter((x) => !x.messartefakt);
  const tU = z.filter((x) => x[tKey] < -0.05), gU = z.filter((x) => x[gKey] < -0.05);
  return { teams: z.length, transferUeberzogen: tU.length, transferUeberzugMedian: tU.length ? r1(median(tU.map((x) => -x[tKey]))) : 0, transferUeberzugSumme: r1(sum(tU.map((x) => -x[tKey]))),
    gehaltUeberzogen: gU.length, gehaltUeberzugMedian: gU.length ? r1(median(gU.map((x) => -x[gKey]))) : 0, gehaltUeberzugSumme: r1(sum(gU.map((x) => -x[gKey]))),
    beideLuft: z.filter((x) => x[tKey] >= -0.05 && x[gKey] >= -0.05).length };
}

console.log(`\n=== Teil 1: Saison 1 (Draft). Toepfe aus dem Startbudget gegen die gemessene Draft-Ausgabe (SPONSOR_AUSSCHUETTUNG ${bilanz.sponsorAusschuettungNeu}) ===`);
for (const modus of ["voll", "vertrauen"]) {
  aus.saison1[modus] = {};
  for (const l of ["A", "B", "C"]) {
    const z = saison1(l, modus);
    aus.saison1[modus][l] = { summe: zusammenfassung(z, "transferLuft", "gehaltLuft"), teams: z.map(runde) };
  }
  console.log(`\nQuote in Saison 1: ${modus === "voll" ? "100 % fuer alle (Empfehlung)" : "nach dem Startvertrauen der Team-Identitaet"}`);
  console.table(Object.fromEntries(["A", "B", "C"].map((l) => [l, aus.saison1[modus][l].summe])));
}
if (!kurz) {
  console.log("\nLauf C, Quote 100 %: je Team (Luft < 0 = ueberzogen)");
  console.table(aus.saison1.voll.C.teams.map((x) => ({ Team: x.id, Liga: x.liga.slice(-1), Klasse: x.klasse, Typ: x.typ, Fin: x.fin, Budget: x.budget, Ruecklage: x.ruecklage, Puffer: x.puffer, "Transfer-Topf": x.transfer, "Draft Ist": x.abloeseIst, "T-Luft": x.transferLuft, "Gehalt-Topf": x.gehaltTopf, "Gehalt Ist": x.gehaltIst, "G-Luft": x.gehaltLuft })));
  console.log("\nLauf C, Quote nach Startvertrauen: nur Teams unter 100 %");
  console.table(aus.saison1.vertrauen.C.teams.filter((x) => x.quote < 1).map((x) => ({ Team: x.id, Vertrauen: x.vertrauen, "Quote %": Math.round(x.quote * 100), Budget: x.budget, "Transfer-Topf": x.transfer, gesperrt: x.gesperrt, "Draft Ist": x.abloeseIst, "Gehalt-Topf": x.gehaltTopf, "Gehalt Ist": x.gehaltIst })));
}

console.log("\n=== Teil 2: Transferfenster Saison 2 (Laeufe B und C). Kasse nach dem Vertragsablauf, Verkaeufe der KI als Zufluss ===");
for (const modus of ["gemessen", "eingeschwungen"]) {
  aus.saison2[modus] = {};
  console.log(modus === "gemessen" ? "\n--- gemessene Kasse (Einfuehrungsjahr: in Saison 1 wurde keine Ruecklage gehalten) ---" : `\n--- eingeschwungen (Hochrechnung: Saison 1 schon mit beiden Toepfen geplant, Liga-Topf ${LIGA_TOPF} C) ---`);
  for (const l of ["B", "C"]) {
    const z = saison2(l, modus), o = z.filter((x) => !x.messartefakt), S = (k, liste = z) => r1(sum(liste.map((x) => x[k])));
    const summe = {
      ist: zusammenfassung(z, "transferLuft", "gehaltLuft"), aufgefuellt: zusammenfassung(z, "transferLuftVoll", "gehaltLuftVoll"),
      quoten: Object.fromEntries([1, 0.85, 0.7, 0.5].map((q) => [`${q * 100} %`, z.filter((x) => x.quote === q).length])),
      kasse0: S("kasse0"), ruecklage: r1(sum(z.map((x) => x.ruecklage + x.puffer))), gesperrt: S("gesperrt"), verkauf: S("verkauf"),
      transfer: S("transfer"), ausgabeIst: S("ausgabeIst"), ausgabeVoll: S("ausgabeVoll"),
      tragbar: S("tragbar", o), gehaltTopf: S("gehaltTopf", o), gehaltIst: S("gehaltIst", o), gehaltVoll: S("gehaltVoll", o),
      lockerungMoeglich: z.filter((x) => x.quote < 1).length, gelockert: z.filter((x) => x.gelockert).length, lockerMehr: S("lockerMehr"),
    };
    aus.saison2[modus][l] = { summe, teams: z.map(runde) };
    console.log(`\nLauf ${l}: Quoten ${JSON.stringify(summe.quoten)}`);
    console.table(modus === "gemessen" ? { "gegen Ist-Ausgaben (Kader 7,8 bis 9)": summe.ist, "gegen volles Auffuellen auf Kader S1": summe.aufgefuellt } : { "gegen volles Auffuellen auf Kader S1": summe.aufgefuellt });
    console.log(`  Summe Kasse ${summe.kasse0} | Ruecklage+Puffer ${summe.ruecklage} | wegen Quote gesperrt ${summe.gesperrt} | Verkaeufe ${summe.verkauf} | Transfer-Topf ${summe.transfer} | Ist ${summe.ausgabeIst} | Bedarf volles Auffuellen ${summe.ausgabeVoll}`);
    console.log(`  Gehalt (ohne M-M): tragbar ${summe.tragbar} | Topf ${summe.gehaltTopf} | laufend ${summe.gehaltIst} | aufgefuellt ${summe.gehaltVoll} || Lockerung: ${summe.gelockert} von ${summe.lockerungMoeglich} Teams unter 100 % erreichen die Schwelle, +${summe.lockerMehr} C`);
    if (!kurz || l === "C") {
      console.table(aus.saison2[modus][l].teams.map((x) => ({ Team: x.id, L: x.liga.slice(-1), Kl: x.klasse, Vertr: `${x.vertrauenStart}>${x.vertrauen}`, "Q%": Math.round(x.quote * 100), Kasse: x.kasse0, "Rueckl+Puf": r1(x.ruecklage + x.puffer), Verkauf: x.verkauf, "Lock fehlt": x.quote < 1 ? x.lockerFehlt : "-", "Q neu": Math.round(x.quoteNeu * 100), "T-Topf": x.transfer, Ist: x.ausgabeIst, "T-Luft": x.transferLuft, "T-Luft voll": x.transferLuftVoll, "G-Topf": x.gehaltTopf, "G laufend": x.gehaltIst, "G-Luft": x.gehaltLuft, "G-Luft voll": x.gehaltLuftVoll })));
    }
  }
}

console.log("\n=== Teil 3: Geldmengen-Bilanz Saison 1, KI plant mit beiden Toepfen (Mittel A/B/C) ===");
const m3 = (fn) => r1(sum(["A", "B", "C"].map(fn)) / 3);
for (const modus of ["voll", "vertrauen"]) {
  const sNeu = eiche(modus);
  const zeile = (s, fk) => ({ gehalt: m3((l) => bilanzSaison1(l, s, fk, modus).gehalt), kasseStart: m3((l) => bilanzSaison1(l, s, fk, modus).kasseStart), guv: m3((l) => bilanzSaison1(l, s, fk, modus).guv),
    imMinusSt20: m3((l) => bilanzSaison1(l, s, fk, modus).imMinusSt20), imMinusEnde: m3((l) => bilanzSaison1(l, s, fk, modus).imMinusEnde),
    bindetTransfer: m3((l) => bilanzSaison1(l, s, fk, modus).bindetTransfer), bindetGehalt: m3((l) => bilanzSaison1(l, s, fk, modus).bindetGehalt) });
  aus.bilanz[modus] = {
    beiAusschuettung073: zeile(1, 1.0),
    neuGeeicht: { sponsorAusschuettung: Math.round(1.1 * SIGMA * sNeu * 1000) / 1000, faktor082: zeile(sNeu, 0.82), faktor100: zeile(sNeu, 1.0), faktor124: zeile(sNeu, 1.24) },
    jeTyp: Object.fromEntries(["vorsichtig", "normal", "aggressiv"].map((typ) => {
      const z = bilanzSaison1("C", sNeu, 1.0, modus).zeilen.filter((x) => x.typ === typ);
      return [typ, { n: z.length, gehaltMedian: r1(median(z.map((x) => x.gehalt))), kasseStartMedian: r1(median(z.map((x) => x.kasseStart))), verschobenMedian: r1(median(z.map((x) => x.verschoben))), bindetGehalt: z.filter((x) => x.bindet === "Gehalt").length, bindetTransfer: z.filter((x) => x.bindet === "Transfer").length }];
    })),
  };
  console.log(`\nQuote Saison 1: ${modus}. Konzept V2 (Deckel k): Gehalt ${bilanz.mittel["1"].gehalt}, Kasse nach Draft ${bilanz.mittel["1"].kasseStart}, GuV 0`);
  console.table({ "Ausschuettung 0,73": aus.bilanz[modus].beiAusschuettung073, [`neu geeicht ${aus.bilanz[modus].neuGeeicht.sponsorAusschuettung} | Faktor 0,82`]: aus.bilanz[modus].neuGeeicht.faktor082, "Faktor 1,00": aus.bilanz[modus].neuGeeicht.faktor100, "Faktor 1,24": aus.bilanz[modus].neuGeeicht.faktor124 });
  console.table(aus.bilanz[modus].jeTyp);
}

/* Beispiele fuer die Doku: je Liga ein reiches, ein mittleres, ein armes Team (Lauf C) */
const BEISPIELE = ["G-G", "H-R", "T-T", "M-S", "R-C", "A-A"];
aus.beispiele = BEISPIELE.map((id) => ({ id, saison1: aus.saison1.voll.C.teams.find((x) => x.id === id), saison1Vertrauen: aus.saison1.vertrauen.C.teams.find((x) => x.id === id), saison2: aus.saison2.gemessen.C.teams.find((x) => x.id === id), saison2Eingeschwungen: aus.saison2.eingeschwungen.C.teams.find((x) => x.id === id) }));
for (const [titel, feld] of [["gemessene Kasse", "saison2"], ["eingeschwungen", "saison2Eingeschwungen"]]) {
console.log(`\n=== Beispiele (Lauf C): Fenster Saison 2, ${titel} ===`);
console.table(aus.beispiele.map((b) => { const x = b[feld]; return { Team: x.id, Liga: x.liga.slice(-1), Klasse: x.klasse, Typ: x.typ, Fin: x.fin, Vertrauen: x.vertrauen, "Quote %": Math.round(x.quote * 100), Kasse: x.kasse0, Marktwert: x.marktwert, Ruecklage: x.ruecklage, Puffer: x.puffer, gesperrt: x.gesperrt, Verkauf: x.verkauf, "Lock-Puffer": x.lockerPuffer, Schwelle: x.lockerSchwelle, "fehlt": x.lockerFehlt, "T-Topf": x.transfer, "Ist": x.ausgabeIst, "voll": x.ausgabeVoll, tragbar: x.tragbar, "G-Topf": x.gehaltTopf, "G vor": x.gehaltVorFenster, "G Ist": x.gehaltIst, "G voll": x.gehaltVoll }; }));
}

fs.writeFileSync("data/generated/finanzkonzept-v2-budgets-18-11.json", JSON.stringify(aus, null, 1));
console.log("\ngeschrieben: data/generated/finanzkonzept-v2-budgets-18-11.json");
