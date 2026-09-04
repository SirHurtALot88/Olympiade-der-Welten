# Hockey: HK_TW_BASIS/HK_TW_REF nachgezogen

Quelle des Funds: `docs/design/hockey-opus-review-nhl.md` (PR #766, Opus-Review mit
NHL-Recherche), Abschnitt 2 „Der Befund: zwei veraltete Torwart-Konstanten". Dieser Bericht
setzt den dort probeweise durchgerechneten, dann bewusst zurückgenommenen Fix tatsächlich um —
mit frisch gezogenen Zielwerten statt der im Review genannten Zahlen.

## Der Fund, kurz

`public/mockups/battle-mode.engine.js` bewertet einen Hockey-Torwart über

    HK_TW_BASIS + gsaa*HK_TW_GSAA_K + punkte*3 + assists1*2 + assists2*1.5
    gsaa = schuesse*(1-HK_TW_REF) - gegentore

`HK_TW_BASIS` (der gemessene Feldspieler-Mittelwert) und `HK_TW_REF` (die gemessene
Liga-Fangquote) sind laut eigenem Code-Kommentar PLATZHALTER, die „nach JEDER Änderung der
Wertformel nachgezogen werden" müssen. Das ist seit mehreren Runden — u. a. K3 (Tore halb als
xG gebucht) und die Passqualitäts-/Abpraller-Kette — nicht passiert:

| Konstante | im Code (vor diesem PR) | frisch gemessen (Kader-Familie) |
|---|---:|---:|
| `HK_TW_BASIS` | 7,16 | **9,13** |
| `HK_TW_REF` | 0,907 | **0,871** |

Jeder Torwart startete dadurch arithmetisch unter dem Feldspieler-Schnitt, bevor er einen Puck
gesehen hat — das Fehlerbild, vor dem der Kommentar selbst warnt.

## Frisch gezogene Zielwerte

Wie vom Review verlangt ("die genauen Zielwerte gehören vor einem Commit noch einmal frisch
gezogen") **nicht** die im Review genannten Zahlen übernommen, sondern neu gemessen — mit
`scripts/miss-hockey-torwart-konstanten.mjs` (neu, dieser PR), das für jede Kader-Variante
`window.__arena.feldspielProbe("hockey", …)` fährt und

- `HK_TW_BASIS` als Mittelwert von `feldspielWert(u,"hockey")` über alle NICHT-Torwart-Zeilen
  bildet (die Formel dort liest `HK_TW_*` gar nicht — unabhängig von den beiden Konstanten),
- `HK_TW_REF` als `saves / (saves+gegentore)` über alle Torwart-Zeilen bildet.

24 Spiele je Kader:

| | Einzelkader (SQUAD/OPP) | Kader-Familie (5 echte Paarungen, gepoolt) |
|---|---:|---:|
| `HK_TW_BASIS` | 7,85 | **9,13** |
| `HK_TW_REF` | 0,891 | **0,871** |

Die Kader-Familie-Werte sind die für die CI-Schranke maßgebliche Zahl (dieselbe Quelle,
`data/generated/kaderfamilie-live-save.json`, die `scripts/miss-alle-disziplinen.mjs` nutzt) —
`HK_TW_BASIS=9.13`/`HK_TW_REF=0.871` sind jetzt im Code gesetzt. `HK_TW_GSAA_K=2.0` blieb
unverändert; das Review hat ihn nicht als Problem benannt, und die Streuungsrechnung, die ihn
begründet, hängt nicht an REF/BASIS.

Die frisch gezogenen Werte bestätigen die im Review genannten fast auf die zweite Nachkomma-
stelle (Review: 9,13/0,871 Kader-Familie, 0,891 Einzelkader) — eine unabhängige Messung mit
eigenem Werkzeug, kein Copy-Paste der Review-Zahlen.

## Wirkung auf die Rangtreue

Gemessen mit `scripts/miss-alle-disziplinen.mjs` (kaderfest, 5 echte Paarungen):

| | n=24 vorher | n=24 nachher | n=48 vorher | n=48 nachher |
|---|---:|---:|---:|---:|
| rho je Spiel, alle 12 (Torwart inklusive) | 0,618 [0,247] | **0,669 [0,181]** | 0,613 [0,228]* | **0,655 [0,193]** |
| rho Saison, alle 12 | 0,748 [0,126] | 0,832 [0,259] | — | — |
| rho je Spiel, nur Feldspieler | 0,719 [0,182] | **0,719 [0,182]** (bit-identisch) | 0,714 [0,167] | **0,714 [0,167]** (bit-identisch) |
| rho Saison, nur Feldspieler | 0,818 [0,259] | 0,818 [0,259] (bit-identisch) | — | — |

\* n=48-„vorher"-Zeile aus dem Review übernommen (dort bereits unabhängig gemessen), nicht in
diesem PR erneut nachgezogen — die n=24-Messung dieses PRs bestätigt die Bewegung bereits
bit-genau gegen die Review-Zahlen.

**Der Isolationsnachweis:** die Feldspieler-only-Zahl ist bei n=24 UND n=48 bit-identisch vor
und nach der Änderung — die gesamte Bewegung sitzt nachweislich in den zwei Torwart-Zeilen.
Kein neuer `rr()`-Aufruf, keine Mechanikänderung, reine Konstanten-Nachziehung.

Gegengeprüft, bit-identisch (n=24, kaderfest): Basketball 0,757 [0,102], Football 0,460
[0,258], Gewichtheben 0,887 [0,224].

## Korridor-Kontrolle

`scripts/miss-hockey-korridor.mjs 24` nach der Änderung:

| Größe | gemessen | Ziel |
|---|---:|---|
| Tore je Team | 4,13 | 3,5 |
| Fangquote des Torwarts | 89,1 % | 86,5 % (NHL 90,2 %) |
| Tore je Schussversuch | 9,6 % | rund 6 % (NHL) |

Unverändert gegenüber dem Stand vor dieser Runde (`HK_TW_BASIS`/`HK_TW_REF` fließen nicht in
die Schuss-/Fangwahrscheinlichkeit ein, sondern ausschließlich in die nachgelagerte
Impact-Bewertung des Torwarts — die Korridorzahlen sind von dieser Änderung strukturell
unabhängig, die Kontrolle bestätigt das).

## Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — `HK_TW_REF`/`HK_TW_BASIS` nachgezogen, Kommentar
  ergänzt (Historie der vorigen Nachziehungen bleibt stehen).
- `scripts/miss-hockey-torwart-konstanten.mjs` (neu) — zieht beide Konstanten frisch, Einzel-
  kader und Kader-Familie, gepoolt und je Paarung.
- `data/generated/rangtreue-basislinie.json` — neu gebaut (`baue-rangtreue-basislinie.mjs 24`),
  sonst schlägt `pruefe-rangtreue-schranke.mjs`/das CI-Gate wegen der jetzt höheren
  Hockey-Zahl in die falsche Richtung an (eine Verbesserung ist immer erlaubt, aber die alte
  Basislinie hätte die neue, bessere Zahl fälschlich als Referenzpunkt für künftige
  Regressionen eingefroren, nicht als das, was sie ist: eine Korrektur).
- `docs/design/stand-aller-disziplinen.md` — Hockey-Zeile und -Prosa aktualisiert.
