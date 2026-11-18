/* eslint-disable no-console */
/**
 * Geldmengen-Bilanz zum Finanzkonzept V2 (docs/design/finanzkonzept-v2-18-11.md).
 *
 * REINE RECHNUNG auf den Messdaten vom 18.11. (Laeufe A/B/C, Saison 1, 32 KI-Teams) — keine Spiellogik,
 * kein Spielstand. Liest:
 *   data/generated/finanzen-ist-messung-18-11-roh.json   (Gehalt, Kasse, Sponsor, Rang je Team und Lauf)
 *   data/generated/ki-kaufverhalten-stammdaten-18-11.json (Budget, Finanz-/Ambitionswert, GM, Sponsor-Anker, Startrang)
 * Schreibt: data/generated/finanzkonzept-v2-bilanz-18-11.json
 *
 *   node scripts/rechne-finanzkonzept-v2-18-11.mjs
 *
 * Was HOCHRECHNUNG ist (und deshalb im A/B-Lauf je Baustufe nachgemessen werden muss):
 *  - Gehalt waechst proportional zur Draft-Ausgabe (gemessen Gehalt/Marktwert 0,277).
 *  - Der Endrang bleibt der gemessene, obwohl Ruecklage und Deckel die Kaderstaerke verschieben.
 *  - Sponsor = Sockel(Startrang) + Wertungsteil; der Wertungsteil ist "gemessener Sponsor - Sockel" und
 *    skaliert linear mit dem Saison-Faktor (so steht es in lib/sponsor/sponsor-liga-leiter.ts).
 *  - M-M hat in der Messung keinen Sponsor (Messartefakt, Analyse Abschnitt 5): ersetzt durch 0,92 x Anker.
 *  - Stimmung, Auslastung und Duell-Siege sind hier eine Funktion des Endrangs (Startwerte des Konzepts).
 */
import fs from "node:fs";

const roh = JSON.parse(fs.readFileSync("data/generated/finanzen-ist-messung-18-11-roh.json", "utf8"));
const stamm = JSON.parse(fs.readFileSync("data/generated/ki-kaufverhalten-stammdaten-18-11.json", "utf8")).teams;

/* ------------------------------------------------------------------ Startwerte des Konzepts */
export const K = {
  spieltage: 20,
  heimspiele: 10,
  faktoren: [0.82, 1.0, 1.24],
  // KI-Kauf
  ruecklageMin: 0.05, ruecklageMax: 0.25,          // Anteil am Budget, linear im Finanzwert 1..10
  ruecklageGehalt: 0.35,                           // x Zielgehalt (vorhandene Konstante RESERVE_SALARY_FACTOR)
  deckel: { vorsichtig: 1.0, normal: 1.1, aggressiv: 1.25 },
  deckelKassenHorizont: 3,                         // freie Kasse darf ueber so viele Saisons ein Defizit tragen
  realisation: 0.92,                               // gemessene Auszahlung / Anker
  // Einnahmen neu (C). Liga 1 / Liga 2 im Verhaeltnis 60/40 wie der Sponsor-Topf
  vollesHaus: { liga1: 1.7, liga2: 1.15 },          // Ticket-Einnahme eines ausverkauften Heimspiels zum Richtpreis
  merchBasis: { liga1: 4.4, liga2: 3.0 },          // je Saison bei Stimmung 50
  siegpraemie: { liga1: 0.2, liga2: 0.12 },       // je gewonnenem Disziplin-Duell
  // Ausgaben neu (C)
  arenaBetrieb: { liga1: 0.45, liga2: 0.3 },       // je Heimspiel
  reise: { liga1: 0.15, liga2: 0.1 },              // je Auswaertsspiel
  kaderpraemieAnteil: 0.4,                         // Anteil der Siegpraemie, der an den Kader geht (Stufe "normal")
  // Apron-Varianten
  apronIst: { l1: 1.2, l2: 1.4, s1: 0.8, s2: 1.6 },
  apronNeu: { l1: 1.15, l2: 1.35, s1: 0.8, s2: 1.6 },   // nur die Linien ruecken, Saetze bleiben
  apronDeckelAnteil: 0.5,                          // hoechstens 50 % des eigenen Rangbonus (wie heute)
};

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const sum = (a) => a.reduce((s, x) => s + x, 0);
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const sockelAlt = (startRank) => 19.8 + (52.8 - 19.8) * (startRank - 1) / 15;
const stimmungVonRang = (rang) => clamp(50 + (8.5 - rang) * 3.5, 0, 100);
const auslastung = (stimmung) => clamp(0.3 + 0.85 * stimmung / 100, 0.25, 1);   // Nachfrage, bei 100 % gedeckelt (Richtpreis)
const siegeVonRang = (rang) => 20 + (8.5 - rang) * 1.6;   // von 40 Duellen; Summe je Liga 320

function archetyp(t) {
  // Risikoneigung = Ambition - Finanzwert (beide 1..10, aus identity). Schwellen so, dass je rund ein Viertel
  // der Liga vorsichtig bzw. aggressiv ist (9 / 15 / 8 Teams im Stammdatensatz).
  const neigung = t.identity.ambition - t.identity.finances;
  if (neigung >= 3) return "aggressiv";
  if (neigung <= -2) return "vorsichtig";
  return "normal";
}
const ruecklagenQuote = (fin) => clamp(K.ruecklageMin + (K.ruecklageMax - K.ruecklageMin) * (fin - 1) / 9, K.ruecklageMin, K.ruecklageMax);

/* ------------------------------------------------------------------ Teams je Lauf aufbauen */
function ladeLauf(label) {
  const l = roh.laeufe[label];
  const ph = l.roh.phasen;
  const draft = ph.s1_01_nach_draft.snap, ende = ph.s1_04_nach_abschluss.snap, guv = ph.s1_04_nach_abschluss.guv;
  // Faktor der Saison 1 steht am Apron-Teil der GuV
  const fLauf = Object.values(guv)[0].parts.apronSalaryFactor;
  const teams = Object.keys(draft).map((id) => {
    const s = stamm[id], d = draft[id], p = guv[id].parts;
    const anker = s.sponsor ? s.sponsor.anchor : Math.max(...s.offers.map((o) => o.anchor)); // M-M: bestes Angebot
    const sockel = sockelAlt(s.startRank);
    const sponsorIst = p.sponsorCash > 0 ? p.sponsorCash : K.realisation * anker; // M-M ersetzt
    return {
      id, liga: d.liga, budget: d.budget, vertrauen: s.identity.boardConfidence, fin: s.identity.finances, amb: s.identity.ambition, gm: s.gm,
      typ: archetyp(s), anker, startRang: s.startRank, endRang: ende[id].rank,
      cashIst: d.cash, gehaltIst: d.gehaltIst, gehaltVerhandelt: d.gehaltVerhandelt,
      sockel, wertungJeFaktor: Math.max(0, sponsorIst - sockel) / fLauf,
      vorstand: p.objectiveCashDelta, ereignisse: p.sponsorEventCash, sponsorErsetzt: !(p.sponsorCash > 0),
    };
  });
  return { label, fLauf, teams };
}

/* ------------------------------------------------------------------ Einnahmen/Ausgaben neu je Team */
function spieltagsEinnahmen(t) {
  const st = stimmungVonRang(t.endRang), a = auslastung(st), siege = siegeVonRang(t.endRang);
  const ticket = K.heimspiele * K.vollesHaus[t.liga] * a;
  const merch = K.merchBasis[t.liga] * st / 50;
  const praemie = siege * K.siegpraemie[t.liga];
  const betrieb = K.heimspiele * K.arenaBetrieb[t.liga] + (K.spieltage - K.heimspiele) * K.reise[t.liga];
  const kaderpraemie = praemie * K.kaderpraemieAnteil;
  return { st, a, siege, ticket, merch, praemie, betrieb, kaderpraemie };
}
const sponsorNeu = (t, sigma, f) => sigma * (t.sockel + t.wertungJeFaktor * f);

/** Planeinnahmen zum Zeitpunkt des Drafts: Sponsor-Erwartung + Spieltagseinnahmen bei mittlerer Stimmung (50), Faktor 1,0. */
function planeinnahmen(t, sigma) {
  const a = auslastung(50);
  const sponsor = sigma * K.realisation * t.anker;
  const ticket = K.heimspiele * K.vollesHaus[t.liga] * a;
  const merch = K.merchBasis[t.liga];
  const praemie = 20 * K.siegpraemie[t.liga];
  const fix = K.heimspiele * K.arenaBetrieb[t.liga] + (K.spieltage - K.heimspiele) * K.reise[t.liga] + praemie * K.kaderpraemieAnteil;
  return { sponsor, ticket, merch, praemie, fix, tragbar: sponsor + ticket + merch + praemie - fix };
}

/** KI-Kaufregeln: Ruecklage (Finanzwert, mindestens 0,35 x Zielgehalt), danach Gehaltsdeckel k x tragbares Gehalt. */
function kiKauf(t, sigma) {
  const rho = t.gehaltIst / (t.budget - t.cashIst);            // Gehalt je ausgegebenem C
  const q = ruecklagenQuote(t.fin);
  // R = max(q*B, 0,35*g), g = rho*(B-R)  ->  bei Gehaltsbindung: R = 0,35*rho*B / (1 + 0,35*rho)
  const rGehalt = K.ruecklageGehalt * rho * t.budget / (1 + K.ruecklageGehalt * rho);
  let ruecklage = Math.max(q * t.budget, rGehalt);
  let gehalt = rho * (t.budget - ruecklage);
  const plan = planeinnahmen(t, sigma);
  // Deckel = k x tragbares Gehalt + (freie Kasse ueber der Mindestruecklage) / Horizont. Freie Kasse haengt selbst
  // am Gehalt (weniger Gehalt = weniger gekauft = mehr Kasse), deshalb geschlossen geloest.
  const k = K.deckel[t.typ], H = K.deckelKassenHorizont, rMin = ruecklage;
  const deckelBei = (g) => k * plan.tragbar + Math.max(0, t.budget - g / rho - rMin) / H;
  let deckel = deckelBei(gehalt);
  const gekappt = gehalt > deckel + 1e-9;
  if (gekappt) { gehalt = (k * plan.tragbar + (t.budget - rMin) / H) / (1 + 1 / (H * rho)); ruecklage = t.budget - gehalt / rho; deckel = gehalt; }
  return { q, ruecklage, gehalt, k, deckel, gekappt, plan };
}

function saison(lauf, sigma, f, mitKiRegeln) {
  const zeilen = lauf.teams.map((t) => {
    const e = spieltagsEinnahmen(t);
    const ki = mitKiRegeln ? kiKauf(t, sigma) : { ruecklage: t.cashIst, gehalt: t.gehaltIst, gekappt: false, k: 0, deckel: 0, q: 0, plan: { tragbar: 0, sponsor: 0 } };
    const sockel = sigma * t.sockel, rangbonus = sigma * t.wertungJeFaktor * f;
    const ein = sockel + rangbonus + e.ticket + e.merch + e.praemie + t.vorstand;
    const aus = ki.gehalt + e.betrieb + e.kaderpraemie;
    const laufend = sockel + e.ticket + e.merch + e.praemie - aus;   // alles, was je Spieltag fliesst
    return {
      id: t.id, liga: t.liga, typ: t.typ, endRang: t.endRang, startRang: t.startRang, fin: t.fin, amb: t.amb, vertrauen: t.vertrauen, budget: t.budget, anker: t.anker,
      gehaltIst: t.gehaltIst, cashIst: t.cashIst, quote: ki.q * 100, k: ki.k, tragbar: ki.plan.tragbar, planSponsor: ki.plan.sponsor, deckel: ki.deckel,
      stimmung: e.st, auslastung: e.a * 100, siege: e.siege,
      start: ki.ruecklage, gehalt: ki.gehalt, gekappt: ki.gekappt, sockel, rangbonus, ticket: e.ticket, merch: e.merch,
      praemie: e.praemie, vorstand: t.vorstand, betrieb: e.betrieb, kaderpraemie: e.kaderpraemie,
      einnahmen: ein, ausgaben: aus, guv: ein - aus,
      kasseSt20: ki.ruecklage + laufend, kasseEnde: ki.ruecklage + ein - aus,
      sponsorAnteil: (sockel + rangbonus) / ein,
    };
  });
  const S = (k) => sum(zeilen.map((z) => z[k]));
  return {
    zeilen,
    summe: {
      gehalt: S("gehalt"), sockel: S("sockel"), rangbonus: S("rangbonus"), sponsor: S("sockel") + S("rangbonus"),
      ticket: S("ticket"), merch: S("merch"), praemie: S("praemie"), vorstand: S("vorstand"),
      betrieb: S("betrieb"), kaderpraemie: S("kaderpraemie"), einnahmen: S("einnahmen"), ausgaben: S("ausgaben"),
      guv: S("guv"), kasseStart: S("start"), kasseSt20: S("kasseSt20"), kasseEnde: S("kasseEnde"),
    },
    imMinusSt20: zeilen.filter((z) => z.kasseSt20 < 0).length,
    imMinusEnde: zeilen.filter((z) => z.kasseEnde < 0).length,
    tiefsteKasseSt20: Math.min(...zeilen.map((z) => z.kasseSt20)),
    medianKasseSt20: median(zeilen.map((z) => z.kasseSt20)),
    gekappt: zeilen.filter((z) => z.gekappt).length,
  };
}

/** Sigma so bestimmen, dass Summe GuV bei Faktor 1,0 = 0 ist (Bisektion; Deckel haengt selbst an sigma). */
function eicheSigma(laeufe) {
  let lo = 0.4, hi = 1.4;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    const g = sum(laeufe.map((l) => saison(l, m, 1.0, true).summe.guv));
    if (g > 0) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}

function apron(teams, gehaltVon, regel, sig) {
  let abgabe = 0, zahler = 0, maxAbgabe = 0;
  for (const liga of ["liga1", "liga2"]) {
    const ts = teams.filter((t) => t.liga === liga), med = median(ts.map(gehaltVon));
    const l1 = med * regel.l1, l2 = med * regel.l2;
    for (const t of ts) {
      const g = gehaltVon(t);
      const roh = Math.max(0, Math.min(g, l2) - l1) * regel.s1 + Math.max(0, g - l2) * regel.s2;
      const a = Math.min(roh, K.apronDeckelAnteil * sig * t.wertungJeFaktor);
      if (a > 0) { zahler++; abgabe += a; maxAbgabe = Math.max(maxAbgabe, a); }
    }
  }
  return { abgabe: r1(abgabe), zahler, maxAbgabe: r1(maxAbgabe) };
}

/* ------------------------------------------------------------------ Lauf */
const laeufe = ["A", "B", "C"].map(ladeLauf);
const sigma = eicheSigma(laeufe);
const aus = { erzeugt: new Date().toISOString(), konstanten: K, sigma: r2(sigma * 1000) / 1000, sponsorAusschuettungNeu: r2(1.1 * sigma), laeufe: {}, mittel: {} };

console.log(`\nSponsor-Skalierung sigma = ${sigma.toFixed(3)}  ->  SPONSOR_AUSSCHUETTUNG ${(1.1 * sigma).toFixed(2)} statt 1,10\n`);

// IST-Vergleich (altes System, gemessene Gehaelter) je Faktor
const tab = [];
for (const f of K.faktoren) {
  const ist = laeufe.map((l) => {
    const sp = sum(l.teams.map((t) => t.sockel + t.wertungJeFaktor * f));
    const g = sum(l.teams.map((t) => t.gehaltIst)), v = sum(l.teams.map((t) => t.vorstand));
    return { sp, g, guv: sp + v - g };
  });
  const neu = laeufe.map((l) => saison(l, sigma, f, true));
  const m = (a, k) => sum(a.map((x) => (typeof k === "function" ? k(x) : x[k]))) / a.length;
  const z = {
    faktor: f,
    istSponsor: r1(m(ist, "sp")), istGehalt: r1(m(ist, "g")), istGuv: r1(m(ist, "guv")),
    gehalt: r1(m(neu, (x) => x.summe.gehalt)), sponsor: r1(m(neu, (x) => x.summe.sponsor)), sockel: r1(m(neu, (x) => x.summe.sockel)),
    rangbonus: r1(m(neu, (x) => x.summe.rangbonus)), ticket: r1(m(neu, (x) => x.summe.ticket)), merch: r1(m(neu, (x) => x.summe.merch)),
    praemie: r1(m(neu, (x) => x.summe.praemie)), vorstand: r1(m(neu, (x) => x.summe.vorstand)), betrieb: r1(m(neu, (x) => x.summe.betrieb)),
    kaderpraemie: r1(m(neu, (x) => x.summe.kaderpraemie)), einnahmen: r1(m(neu, (x) => x.summe.einnahmen)), ausgaben: r1(m(neu, (x) => x.summe.ausgaben)),
    guv: r1(m(neu, (x) => x.summe.guv)), kasseStart: r1(m(neu, (x) => x.summe.kasseStart)), kasseSt20: r1(m(neu, (x) => x.summe.kasseSt20)),
    kasseEnde: r1(m(neu, (x) => x.summe.kasseEnde)), imMinusSt20: r1(m(neu, "imMinusSt20")), imMinusEnde: r1(m(neu, "imMinusEnde")),
    tiefsteKasseSt20: r1(Math.min(...neu.map((x) => x.tiefsteKasseSt20))), medianKasseSt20: r1(m(neu, "medianKasseSt20")),
  };
  z.guvInProzentGehalt = r1(100 * z.guv / z.gehalt);
  z.sponsorAnteil = r1(100 * z.sponsor / z.einnahmen);
  tab.push(z);
  aus.mittel[String(f)] = z;
}
console.log("Liga-Summen je Saison (Mittel der Laeufe A/B/C, 32 Teams)");
console.table(tab.map((z) => ({ Faktor: z.faktor, "IST Sponsor": z.istSponsor, "IST Gehalt": z.istGehalt, "IST GuV": z.istGuv, "NEU Gehalt": z.gehalt, Sponsor: z.sponsor, Ticket: z.ticket, Merch: z.merch, Praemie: z.praemie, Vorstand: z.vorstand, Betrieb: z.betrieb, Kaderpr: z.kaderpraemie, GuV: z.guv, "GuV % Gehalt": z.guvInProzentGehalt })));
console.table(tab.map((z) => ({ Faktor: z.faktor, "Kasse Start": z.kasseStart, "Kasse ST20 vor Bonus": z.kasseSt20, "Kasse Saisonende": z.kasseEnde, "Median ST20": z.medianKasseSt20, "tiefste ST20": z.tiefsteKasseSt20, "im Minus ST20": z.imMinusSt20, "im Minus Ende": z.imMinusEnde, "Sponsor-Anteil %": z.sponsorAnteil })));

// Je Lauf: Ruecklage, Deckel, Gehaltsviertel, Apron
for (const l of laeufe) {
  const n = saison(l, sigma, 1.0, true);
  const ki = l.teams.map((t) => ({ t, ...kiKauf(t, sigma) }));
  const nachTyp = {};
  for (const typ of ["vorsichtig", "normal", "aggressiv"]) {
    const x = ki.filter((k) => k.t.typ === typ);
    nachTyp[typ] = { n: x.length, ruecklagePct: r1(100 * median(x.map((k) => k.ruecklage / k.t.budget))), ruecklageC: r1(median(x.map((k) => k.ruecklage))), gehaltIst: r1(median(x.map((k) => k.t.gehaltIst))), gehaltNeu: r1(median(x.map((k) => k.gehalt))), gekappt: x.filter((k) => k.gekappt).length };
  }
  const finKlassen = [["Finanzwert bis 3", (f) => f <= 3], ["3 bis 7", (f) => f > 3 && f < 7], ["ab 7", (f) => f >= 7]].map(([name, fn]) => {
    const x = ki.filter((k) => fn(k.t.fin));
    return { klasse: name, n: x.length, ruecklagePctMin: r1(100 * Math.min(...x.map((k) => k.ruecklage / k.t.budget))), ruecklagePctMed: r1(100 * median(x.map((k) => k.ruecklage / k.t.budget))), ruecklagePctMax: r1(100 * Math.max(...x.map((k) => k.ruecklage / k.t.budget))) };
  });
  const sort = [...n.zeilen].sort((a, b) => b.gehalt - a.gehalt);
  const viertel = [0, 1, 2, 3].map((i) => {
    const x = sort.slice(i * 8, i * 8 + 8);
    return { viertel: i + 1, gehalt: r1(sum(x.map((z) => z.gehalt)) / 8), einnahmen: r1(sum(x.map((z) => z.einnahmen)) / 8), guv: r1(sum(x.map((z) => z.guv)) / 8), kasseSt20: r1(sum(x.map((z) => z.kasseSt20)) / 8), kasseEnde: r1(sum(x.map((z) => z.kasseEnde)) / 8), imMinusEnde: x.filter((z) => z.kasseEnde < 0).length };
  });
  const gNeu = Object.fromEntries(ki.map((k) => [k.t.id, k.gehalt]));
  aus.laeufe[l.label] = {
    faktorGemessen: l.fLauf, gekappt: n.gekappt, nachTyp, finKlassen, viertel,
    apron: { istRegelIstGehalt: apron(l.teams, (t) => t.gehaltVerhandelt, K.apronIst, 1), neuRegelIstGehalt: apron(l.teams, (t) => t.gehaltVerhandelt, K.apronNeu, 1), neuRegelNeuGehalt: apron(l.teams, (t) => gNeu[t.id], K.apronNeu, sigma), gehaltSummeNeu: r1(sum(Object.values(gNeu))) },
    teams: n.zeilen.map((z) => Object.fromEntries(Object.entries(z).map(([k, v]) => [k, typeof v === "number" ? r1(v) : v]))),
  };
  console.log(`\nLauf ${l.label} (gemessener Faktor ${l.fLauf}) bei Faktor 1,0: ${n.gekappt} Teams vom Deckel gekappt`);
  console.table(nachTyp); console.table(finKlassen); console.table(viertel); console.table(aus.laeufe[l.label].apron);
}

fs.writeFileSync("data/generated/finanzkonzept-v2-bilanz-18-11.json", JSON.stringify(aus, null, 1));
console.log("\ngeschrieben: data/generated/finanzkonzept-v2-bilanz-18-11.json");
