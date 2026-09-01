// BASKETBALL-RANGTREUE — ab jetzt ein duenner Vorsatz vor der generischen Sonde.
//
// Die eigentliche Auswertung steht seit dem Hockey-Plan PR 0 in
// scripts/miss-feldspiel-rangtreue.mjs und laeuft dort fuer JEDE Feldspiel-Disziplin
// (docs/design/hockey-rollout-plan.md, Teil H.8). Diese Datei bleibt bestehen, weil ihr
// Name in Plaenen, PR-Beschreibungen und Messhistorien steht: wer sie aufruft, soll
// dieselben Zahlen bekommen wie vorher, ohne dass jemand einen Aufrufparameter nachtraegt.
//
//   node scripts/miss-basketball-rangtreue.mjs 24 6
//   ist ab jetzt identisch mit
//   node scripts/miss-feldspiel-rangtreue.mjs basketball 24 6
//
// Umgesetzt als Vorsatz statt als Kopie: es laeuft buchstaeblich derselbe Code, damit
// die beiden nicht auseinanderlaufen koennen. Nachgemessen bei der Umstellung — beide
// Aufrufe liefern bei 24 Spielen und jeSeite 6 Ziffer fuer Ziffer dasselbe.
process.argv.splice(2, 0, "basketball");
await import("./miss-feldspiel-rangtreue.mjs");
