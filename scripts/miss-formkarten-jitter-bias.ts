/* eslint-disable no-console */
/**
 * E9 — MESSUNG: ist der Formkarten-Jitter unverzerrt?
 *
 * Chris, 14.10. (docs/design/fable-konzept-chris-feedback-13-10.md, Abschnitt 9, E9):
 * "ok wenn das der jitter war ist das ok für mich - die form sollte aber absolut dort
 * stehen also +2,4 oder -1,2 etc. die formkarte ist ja für alle gleich und in Summe
 * muss es im schnitt dann ja auch wieder z.B. +4 ergeben wenn man eine +4 setzt. und
 * funktioniert das mit der form sauber? wirkt es sich spürbar aus? Konntest du das
 * schon messen?"
 *
 * Zwei Fragen:
 *  (1) Landet der realisierte Wert je Spieler als echte Kommazahl (z.B. +2,4), nicht
 *      irgendwo gerundet/gerastert?
 *  (2) Ist der Jitter UNVERZERRT — ist der Mittelwert ueber viele Spieler/Ziehungen
 *      wieder exakt die nominale Formkarte (z.B. +4,0), nicht systematisch daneben?
 *
 * Mechanismus unter Test: seededFormJitter()/distributePerPlayerFormShares() in
 * lib/lineups/legacy-lineup-modifiers.ts:860-919 — NICHT zieheFormkarten() im
 * battle-mode-Motor (das zieht nur die diskrete Kartenziehung [0,2,4,8] je Spieltag,
 * s. dortiger Kommentar zum LCG-Hochbit-Fix). Der hier gemessene Jitter ist ein
 * GETRENNTER, deterministischer FNV-1a-Hash (seededUnitInterval), kein LCG — die
 * historische Niedrig-Bit-Verzerrung aus zieheFormkarten() betrifft diesen Code nicht
 * direkt, wird hier aber trotzdem empirisch gegengeprueft statt angenommen.
 *
 * Nutzung: npx tsx scripts/miss-formkarten-jitter-bias.ts [n]
 */
import { distributePerPlayerFormShares, seededFormJitter } from "@/lib/lineups/legacy-lineup-modifiers";

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stddev(xs: number[], m: number): number {
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

function main() {
  const n = Number(process.argv[2]) || 2000;
  console.log(`n = ${n} Spieler/Ziehungen je nominalem Kartenwert\n`);

  // ---- Teil A: seededFormJitter direkt — Verteilung des Jitters selbst (sollte Mittel 0 sein) ----
  const jitterSeeds = Array.from({ length: n }, (_, i) => `jitterprobe|player-${i}|hockey|md-${i % 37}`);
  const jitters = jitterSeeds.map((s) => seededFormJitter(s, 4));
  const jMean = mean(jitters);
  const jSd = stddev(jitters, jMean);
  const jMin = Math.min(...jitters);
  const jMax = Math.max(...jitters);
  const fractional = jitters.filter((v) => Math.abs(v - Math.round(v)) > 1e-9).length;
  console.log("=== Teil A: seededFormJitter(seed, jitterMax=4) — Rohverteilung ===");
  console.log(`Mittelwert: ${jMean.toFixed(4)} (Erwartung 0,0000)`);
  console.log(`Streuung (sd): ${jSd.toFixed(3)} (Erwartung Uniform[-4,4]: sd=4/sqrt(3)=${(4 / Math.sqrt(3)).toFixed(3)})`);
  console.log(`Spannweite: [${jMin.toFixed(1)}, ${jMax.toFixed(1)}] (Erwartung ~[-4,4])`);
  console.log(`Davon mit Nachkommastelle (echte Kommazahl, nicht auf Ganzzahl gerastert): ${fractional}/${n}\n`);

  // ---- Teil B: distributePerPlayerFormShares — realistischer Pfad (flat + jitter), je nominaler Karte ----
  const nominale = [4, 8, -4, 0, 2];
  console.log("=== Teil B: distributePerPlayerFormShares({formPerPlayer, seeds}) je nominaler Karte ===");
  console.log("nominal | Mittelwert realisiert | Abweichung | sd | Beispiele (erste 5, echte Floats)");
  for (const nominal of nominale) {
    const seeds = Array.from({ length: n }, (_, i) => `formprobe|player-${i}|hockey|md-${(i * 7) % 41}|${nominal}`);
    const realized = distributePerPlayerFormShares({ formPerPlayer: nominal, seeds, jitterMax: 4 });
    const m = mean(realized);
    const sd = stddev(realized, m);
    const abweichung = m - nominal;
    const beispiele = realized.slice(0, 5).map((v) => (v > 0 ? `+${v}` : `${v}`)).join(", ");
    console.log(
      `${nominal >= 0 ? "+" + nominal : nominal}`.padEnd(8) +
        `| ${m.toFixed(4)}`.padEnd(24) +
        `| ${abweichung >= 0 ? "+" : ""}${abweichung.toFixed(4)}`.padEnd(12) +
        `| ${sd.toFixed(3)}`.padEnd(8) +
        `| ${beispiele}`,
    );
  }

  // ---- Teil C: 95%-Toleranzband fuer die Abweichung bei diesem n (reiner Stichprobenfehler) ----
  // sd(Jitter) ~ 4/sqrt(3) = 2.309; sd(Mittelwert) = sd/sqrt(n); 95%-Band = 1.96*sd(Mittelwert).
  const sdJitter = 4 / Math.sqrt(3);
  const band95 = 1.96 * (sdJitter / Math.sqrt(n));
  console.log(`\n95%-Toleranzband bei n=${n} (reines Stichprobenrauschen, KEIN Bias): ±${band95.toFixed(4)}`);
  console.log("Jede Abweichung in Teil B innerhalb dieses Bandes ist von null nicht zu unterscheiden.");

  // ---- Teil D: Konvergenz mit wachsendem n (zeigt, ob die Abweichung mit n schrumpft = Rauschen, oder stehen bleibt = Bias) ----
  console.log("\n=== Teil D: Konvergenz der Abweichung mit wachsendem n (nominal=+4) ===");
  for (const nn of [50, 200, 1000, 5000, 20000]) {
    const seeds = Array.from({ length: nn }, (_, i) => `konvergenz|player-${i}|hockey|md-${(i * 13) % 53}`);
    const realized = distributePerPlayerFormShares({ formPerPlayer: 4, seeds, jitterMax: 4 });
    const m = mean(realized);
    console.log(`n=${String(nn).padEnd(6)} Mittelwert=${m.toFixed(4)}  Abweichung=${(m - 4).toFixed(4)}`);
  }
}

main();
