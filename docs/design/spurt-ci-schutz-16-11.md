# Spurt-Formate in der CI schuetzen (16.11.)

Anlass: Opus-Review zu PR #1502. Seit #1502 waehlt das echte Spiel das Spurt-Format per Saat-Hash
(klassisch / Die Hatz / HYROX, je ein Drittel) -- aber nur mit eingehaengtem echtem Kader
(`window.__olyArenaKader.heim/gast`) und ohne ausdruecklich gesetztes Format
(`spurtFormatWaehlen()`). Alle kader-losen Werkzeuge (`pruefe-wertung-fingerabdruck.mjs`,
`miss-alle-disziplinen.mjs`, die Nacht-Schranke fuer `spurt`) laufen deshalb immer "klassisch":
Hatz und HYROX standen in der CI ungeschuetzt.

## Was jetzt schuetzt

| Schutz | Wo | Laufzeit |
|---|---|---|
| Bit-genauer Fingerabdruck der Zusatzformate (`spiele spurt/hatz\|hyrox <saat>`, Saaten 1/7/42, Format ausdruecklich gesetzt, danach wieder "klassisch") | `scripts/pruefe-wertung-fingerabdruck.mjs` (manuell, vorher/nachher) | unveraendert ~1 min 45 s |
| rho der Mischung und der drei Einzelformate, Kartenmodus "echt", Kader eingehaengt; relativ gegen `zusatzmessungen` der Basislinie und absolut > 0,80 | `scripts/pruefe-rangtreue-schranke.mjs` (Nacht-CI, `npm run ci:rangtreue-schranke`) | +~12 s |
| Pp der Mischung (zwei Saatstroeme) | `node scripts/miss-spurt-mischung.mjs 24 --pp[=48]` (manuell) | ~3 min bei n=48 |
| Hatz/HYROX einzeln, `OLY_FORM_MODUS` jetzt unterstuetzt | `miss-spurt-hatz-rangtreue.mjs`, `miss-spurt-hyrox-rangtreue.mjs`, `messe-spurt-hatz-einfluss.mjs`, `messe-spurt-hyrox-einfluss.mjs` | je Sekunden bis eine halbe Minute |

Pp laeuft bewusst nicht in der CI: mit echten Karten dauert die Mischungsmessung ueber zwei Stroeme
gut drei Minuten und schwankt bei n=48 um einige Pp -- das ist eine manuelle Abnahmesonde.

`haengeEchtenKaderEin()`, `oeffneSpurtMischungsSeite()`, `spurtFormatAnteile()` und
`messeSpurtMischungRho()` stehen in `scripts/lib/rangtreue-messung.mjs`. Die Sonde prueft nebenbei,
dass die Saaten 1..300 wirklich alle drei Formate liefern (sonst ist der Kader nicht eingehaengt und
die "Mischung" waere ein Einzelformat; die Nacht-CI wird dann rot).

Basislinie neu ziehen: `node scripts/baue-rangtreue-basislinie.mjs 24 spurt-mischung` ersetzt nur den
Block `zusatzmessungen` (die zwanzig Disziplinen bleiben); ohne Argument werden wie bisher alle
gemessen und der Block mit.

## Fingerabdruck

`GESAMT 0057e683fc3f (69 Eintraege)` -> `GESAMT e80babacb68c (75 Eintraege)`. Die ersten 69 Zeilen
sind unveraendert; zweimal gelaufen, identisch. Kein Test und keine CI-Stufe pinnt den Wert.

Einzel-Hashes der neuen Zeilen: Hatz 1/7/42 `9f029aa1b41a 6c0dd765489a e550ef44deb8`, HYROX
`7e454d5b8508 e45fd6c3f140 249ab52fcfef`.

## Messzahlen (24 Spiele, 5 Kader-Varianten, live-save 31.10.)

| Format | rho je Spiel, Ersatzkarte | rho je Spiel, `OLY_FORM_MODUS=echt` |
|---|---:|---:|
| klassisch | 0,899 | 0,876 |
| Hatz | 0,837 | 0,823 |
| HYROX | 0,893 | 0,895 |
| Mischung | -- | 0,873 (Spannweite 0,053) |

Pp der Mischung (echt, n=48): 16,5 / 21,5 (Opus-Review: 18,7 / 19,1).

## Hatz-Pp: nicht nur ein Ausreisser

`messe-spurt-hatz-einfluss.mjs 192 <versatz>`, Ersatzkarte, je ~20 s:

| Saatversatz | 0 | 10 000 000 | 20 000 000 | 30 000 000 | 40 000 000 |
|---|---:|---:|---:|---:|---:|
| Pp | 22,5 | 25,1 | 26,1 | 25,9 | 24,1 |

Drei von fuenf Stroemen liegen ueber 25 (Mittel 24,7). Die Abweichung ist stabil und strukturell:
power +4,9, will -4,8, health +4,3, stamina -3,4, dexterity +2,4 (Mittel der fuenf Stroeme). Will und
Stamina sitzen nur in ENDTEMPO (zaehlt nur in der letzten Welle), power in ANTRITT/WUCHT (jede Welle).

Kandidaten ueber `__arena.hatzGewichte` (Pp ueber Versatz 0 / 10M / 20M, rho Hatz 24 Spiele):

| Kandidat | Pp | Mittel | rho |
|---|---|---:|---:|
| Basis | 22,5 / 25,1 / 26,1 | 24,6 | 0,837 |
| `wucht 0.04` | 22,3 / 25,0 / 25,6 | 24,3 | 0,844 |
| `wucht 0.04, stehen 0.10` | 25,6 / 25,0 / 26,4 | 25,7 | 0,844 |
| `finale {haupt 0.60, stehen 0.20}` | 21,6 / 23,4 / 26,1 | 23,7 | 0,831 |
| `wucht 0.04` + `finale {haupt 0.60, stehen 0.20}` (D) | 22,5 / 23,5 / 25,0 | 23,7 | 0,838 |
| D ueber fuenf Stroeme | 22,5 / 23,5 / 25,0 / 25,1 / 24,1 | 24,0 | 0,838 |
| `wucht 0.04, finale {haupt 0.68, technik 0.08, robust 0.08, stehen 0.16}` ueber fuenf Stroeme | 23,4 / 24,0 / 24,6 / 25,4 / 25,6 | 24,6 | 0,831 |
| D + `haupt 0.32, technik 0.18` ueber fuenf Stroeme | 26,2 / 25,4 / 28,8 / 26,2 / 26,8 | 26,7 | 0,830 |

Befund: die sechs Gewichte allein bewegen Hatz um hoechstens ~0,7 Pp im Mittel. Kandidat D ist
der beste, laesst aber immer noch einen Strom bei 25,1. Wer Hatz sicher unter 25 will, braucht
Struktur (z. B. ENDTEMPO in jeder Welle statt nur in der letzten, oder ein Zeilenschritt der
Rollen wie die Budget-Konservierung vom 15.11.) -- das ist eine Rezeptaenderung und steht bei
Chris. Die Mischung, die im Spiel tatsaechlich gespielt wird, liegt mit 16,5-21,5 klar unter der
Schranke.
