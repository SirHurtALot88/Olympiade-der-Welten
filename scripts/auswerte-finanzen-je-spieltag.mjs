/**
 * Auswertung des A/B-Laufs "Finanzen je Spieltag" (22.11.): alt (OLY_FINANZEN_JE_SPIELTAG=aus) gegen neu.
 * Eingabe: zwei Rohdateien aus `scripts/miss-teamfinanzen-saison.ts --seasons 2 --stop-after kaufphase`.
 *
 *   node scripts/auswerte-finanzen-je-spieltag.mjs alt.json neu.json
 *
 * Gemessen: Endkasse nach dem Saisonabschluss je Team (Abweichung), Tiefststand der Kasse ueber die Spieltage,
 * Teams mit negativer Kasse zwischendurch, und die KI-Kaufphase der Folgesaison (Kaeufe, Summe, Kaderstaerke).
 */
import fs from "node:fs";

const [altPfad, neuPfad] = process.argv.slice(2);
if (!altPfad || !neuPfad) throw new Error("Aufruf: node scripts/auswerte-finanzen-je-spieltag.mjs alt.json neu.json");
const alt = JSON.parse(fs.readFileSync(altPfad, "utf8"));
const neu = JSON.parse(fs.readFileSync(neuPfad, "utf8"));
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const mittel = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function snapCash(lauf, phase) {
  const s = lauf.phasen?.[phase]?.snap;
  if (!s) return null;
  return Object.fromEntries(Object.entries(s).map(([id, t]) => [id, t.cash]));
}

const teams = Object.keys(alt.phasen.s1_00_nach_anlage.snap);
const bericht = {};

// 1) Endkasse nach Saisonabschluss, nach der Kette, vor der Kaufphase von Saison 2.
for (const phase of ["s1_03_nach_spieltagen", "s1_04_nach_abschluss", "s1_06_ende_kette", "s2_00_vor_kaufphase"]) {
  const a = snapCash(alt, phase);
  const n = snapCash(neu, phase);
  if (!a || !n) continue;
  const d = teams.map((t) => n[t] - a[t]);
  bericht[phase] = {
    summeAlt: r1(teams.reduce((s, t) => s + a[t], 0)),
    summeNeu: r1(teams.reduce((s, t) => s + n[t], 0)),
    mittlereAbweichung: r2(mittel(d)),
    mittlereBetragsAbweichung: r2(mittel(d.map(Math.abs))),
    maxBetragsAbweichung: r2(Math.max(...d.map(Math.abs))),
    teamsMitAbweichungUeber0_5: d.filter((x) => Math.abs(x) > 0.5).length,
  };
}

// 2) Tiefststand der Kasse ueber die Spieltage (Start = Kasse nach dem Draft).
function tiefststand(lauf) {
  const start = snapCash(lauf, "s1_01_nach_draft");
  const reihen = lauf.phasen.s1_03_nach_spieltagen.kasseJeSpieltag;
  const out = {};
  for (const t of teams) {
    const werte = [start[t], ...(reihen[t] ?? [])];
    out[t] = { tief: Math.min(...werte), start: start[t], ende: werte[werte.length - 1], verlauf: werte };
  }
  return out;
}
const tA = tiefststand(alt);
const tN = tiefststand(neu);
const negAlt = teams.filter((t) => tA[t].tief < 0);
const negNeu = teams.filter((t) => tN[t].tief < 0);
bericht.tiefststand = {
  mittelTiefAlt: r1(mittel(teams.map((t) => tA[t].tief))),
  mittelTiefNeu: r1(mittel(teams.map((t) => tN[t].tief))),
  minTiefAlt: r1(Math.min(...teams.map((t) => tA[t].tief))),
  minTiefNeu: r1(Math.min(...teams.map((t) => tN[t].tief))),
  teamsNegativZwischendurchAlt: negAlt.length,
  teamsNegativZwischendurchNeu: negNeu.length,
  nurNeuNegativ: negNeu.filter((t) => !negAlt.includes(t)),
  nurNeuNegativTiefstWerte: Object.fromEntries(negNeu.filter((t) => !negAlt.includes(t)).map((t) => [t, r1(tN[t].tief)])),
  spieltageImMinusNeuSumme: teams.reduce((s, t) => s + tN[t].verlauf.filter((v) => v < 0).length, 0),
  spieltageImMinusAltSumme: teams.reduce((s, t) => s + tA[t].verlauf.filter((v) => v < 0).length, 0),
  // Endkasse vor dem Abschluss: im neuen Modus schon um Gehalt/Sponsor-Basis/Gebaeude verschoben.
  mittelKasseVorAbschlussAlt: r1(mittel(teams.map((t) => tA[t].ende))),
  mittelKasseVorAbschlussNeu: r1(mittel(teams.map((t) => tN[t].ende))),
};

// 3) KI-Kaufphase Saison 2 (Lauf-Zaehler des Preseason-Dienstes + Kaderveraenderung je Team aus den Schnappschuessen).
function kaufphase(lauf) {
  const vor = lauf.phasen.s2_00_vor_kaufphase.snap;
  const p = lauf.phasen.s2_01_nach_kaufphase;
  const kaderDelta = Object.fromEntries(teams.map((t) => [t, p.snap[t].kader - vor[t].kader]));
  const staerke = teams.map((t) => p.snap[t].staerke);
  return {
    kaeufeGesamt: p.lauf.transferBuysApplied,
    verkaeufeGesamt: p.lauf.transferSellsApplied,
    aktionenGesamt: p.lauf.managerActionsApplied,
    mittelStaerke: r2(mittel(staerke)),
    kasseVor: r1(teams.reduce((s, t) => s + vor[t].cash, 0)),
    kasseNachher: r1(teams.reduce((s, t) => s + p.snap[t].cash, 0)),
    kaderGroesseMittel: r2(mittel(teams.map((t) => p.snap[t].kader))),
    teamsNegativNachKauf: teams.filter((t) => p.snap[t].cash < 0).length,
    kaderDelta,
  };
}
const kA = kaufphase(alt);
const kN = kaufphase(neu);
const kaderDiff = teams.map((t) => kN.kaderDelta[t] - kA.kaderDelta[t]);
const staerkeDiff = teams.map((t) => neu.phasen.s2_01_nach_kaufphase.snap[t].staerke - alt.phasen.s2_01_nach_kaufphase.snap[t].staerke);
bericht.kaufphaseSaison2 = {
  alt: { ...kA, kaderDelta: undefined },
  neu: { ...kN, kaderDelta: undefined },
  teamsMitAndererKaderAenderung: kaderDiff.filter((d) => d !== 0).length,
  mittlereStaerkeAbweichungBetrag: r2(mittel(staerkeDiff.map(Math.abs))),
  maxStaerkeAbweichungBetrag: r2(Math.max(...staerkeDiff.map(Math.abs))),
};

// 4) Stichprobe: ein Team, Verlauf je Spieltag alt gegen neu.
const probe = teams.sort((a, b) => tN[a].tief - tN[b].tief)[0];
bericht.probeTeamTiefstNeu = { team: probe, alt: tA[probe].verlauf.map(r1), neu: tN[probe].verlauf.map(r1) };

// 5) Kontoauszug-Summen je Art (Saison 1) im neuen Lauf.
const ka = neu.phasen.s1_04_nach_abschluss.kontoauszug;
const arten = {};
for (const k of Object.values(ka)) for (const [a, v] of Object.entries(k.jeArt)) arten[a] = r1((arten[a] ?? 0) + v);
bericht.kontoauszugNeuSummeJeArt = arten;

// 6) Kassenabgleich: Kasse nach dem Abschluss = Kasse zur Anlage + Saldo des Kontoauszugs (alle Ledger der Saison).
function abgleich(lauf) {
  const start = snapCash(lauf, "s1_00_nach_anlage");
  const ende = snapCash(lauf, "s1_04_nach_abschluss");
  const konto = lauf.phasen.s1_04_nach_abschluss.kontoauszug;
  const rest = teams.map((t) => ende[t] - start[t] - konto[t].saldo);
  return { mittlerRestBetrag: r2(mittel(rest.map(Math.abs))), maxRestBetrag: r2(Math.max(...rest.map(Math.abs))), teamsMitRestUeber0_5: rest.filter((x) => Math.abs(x) > 0.5).length };
}
bericht.kassenabgleichKontoauszug = { alt: abgleich(alt), neu: abgleich(neu) };

console.log(JSON.stringify(bericht, null, 1));
