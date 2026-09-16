# Climbing: erste eigene Kalibrierrunde (16.09.)

Auftrag: Climbing (Chassis „Bahn") war die einzige der fünf Bahn-Disziplinen, die nie eine
eigene Modellierungs-/Kalibrierrunde hatte — anders als Staffel, Spurt, Time-Trial und
Takeshi's Castle, deren Rezepte alle nach dem 02.09. mindestens einmal gezielt nachgezogen
wurden (`docs/design/bahn-disziplinen-recherche-fable.md`). Climbing lief seither mit einem
übernommenen, nie speziell gefitteten Rezept und stand kaderfest bei rho 0,782/Spiel — 0,018
unter der 0,80-Schranke aus CLAUDE.md, bei einem Kaderrauschen (Spannweite) von 0,191, also
rund dem Zehnfachen des Fehlbetrags.

## Recherche: warum rho bei 0,782 hing

`public/mockups/battle-mode.engine.js`, `BAHN_ART.climbing` (`:21321 ff.`). MATRIX: stamina 26,
determination 16, speed 12, dexterity 12, health 10, power 8, awareness 8, will 8. Das Rezept
verteilt diese acht Attribute auf sieben Sub-Skills (ANTRITT/ENDTEMPO/TECHNIK/WENDIGKEIT/
STEHEN/WUCHT/ROBUST), die über die generische Bahn-Bewegung (`tempoVon()`, die Griff-Schleife
bei den zehn `hindernisse`, den Reserve-Haushalt) den Rennausgang bestimmen.

**Zwei Werkzeuge, dieselbe Methode wie bei Football/Tennis:**

1. `scripts/sondiere-feldspiel-subskills.mjs climbing 24` (das generische Sondierungswerkzeug
   funktioniert unverändert für ein Bahn-Rezept, trotz des Namens — es liest jedes `rezept:{…}`
   in `battle-mode.engine.js`, gleich welches Chassis) zeigt das **mechanische Gewicht** jedes
   Sub-Skills, unabhängig vom Rezept: STEHEN 30 % · ENDTEMPO 26,3 % · TECHNIK 22,2 % · WUCHT
   14,8 % · ANTRITT 5,4 % · WENDIGKEIT 0,2 % · **ROBUST 0,0 %**.
2. `scripts/messe-arena-einfluss.mjs climbing 48` misst direkt am echten Rezept, wie viel jedes
   MATRIX-Attribut tatsächlich zum Ergebnis beiträgt, gegen sein Matrixgewicht:

   | Attribut | Anteil | Matrix | Differenz |
   |---|---:|---:|---:|
   | stamina | 31,1 % | 26 | +5,1 |
   | determination | 22,9 % | 16 | +6,9 |
   | speed | 17,0 % | 12 | +5,0 |
   | dexterity | 8,9 % | 12 | −3,1 |
   | power | 8,5 % | 8 | +0,5 |
   | health | 4,8 % | 10 | −5,2 |
   | awareness | 4,5 % | 8 | −3,5 |
   | **will** | **2,3 %** | 8 | **−5,7** |

   Abweichung zur Matrix insgesamt: **35 Pp**.

**Der Befund:** ROBUST ist ein mechanisch toter Sub-Skill. Sein einziger Kanal im Motor ist das
0,3-Gewicht in der Reserve-Obergrenze (`kraftBasis = 310 + (STEHEN·0,7 + ROBUST·0,3)·3,1`,
`:21804`) — gegen STEHENs 0,7 zu schwach, um in `einflussVon()` je über die Rundungsschwelle zu
kommen (bestätigt: Anhebung von +15 auf ROBUSTs Trägerattribut bewegt in der Sondierung exakt
0,0 % des Ergebnisses). Genau in diesem toten Sub-Skill saßen mit `health:32,will:24` die
beiden Attribute, die überall sonst im Rezept am schwächsten vertreten sind — dieselbe
Fehlerform, die CLAUDE.md für Staffel (WUCHT als „Zug an der Spitze" ohne Kanal) und für
Zeitfahren/Climbing (WENDIGKEIT ohne Kurve/Sog) bereits beschreibt: ein Attribut zahlt in eine
Rolle ein, die im Spiel nichts bewirkt.

Alle anderen sechs Sub-Skills sind live und ihre Zusammensetzung liegt nahe an der
Matrix-Proportion ihrer eigenen Trägerattribute — der Hebel liegt eindeutig bei ROBUST/STEHEN,
nicht bei einem verzerrten TECHNIK- oder WUCHT-Rezept.

## Die eine Hypothese

STEHEN ist mit 30 % der schwerste aller sieben Sub-Skills. Die beiden im toten ROBUST
gefangenen Attribute (WILL, HEALTH) ziehen dort ein, auf Kosten der in STEHEN bereits
überzeichneten Stamina/Determination. Kein zweiter Sub-Skill wird angefasst, kein neuer
Motor-Kanal — ein einzelner, isolierter Hebel, genau wie bei Tennis' `TECHNIK`-Korrektur
(PR #850).

```
STEHEN  vorher:  {stamina:44, determination:26, will:18, health:12}
STEHEN  nachher: {stamina:24, will:32,          health:34, determination:10}
```

(ROBUST bleibt unverändert stehen — seine Zusammensetzung ist mechanisch irrelevant, solange
sein einziger Kanal bei Gewicht 0,3 bleibt; sie zu ändern hätte keine Wirkung und wäre ein
zweiter, ununterscheidbarer Hebel gewesen.)

Drei Zwischenstände wurden gemessen, um das Optimum zu finden (`messe-arena-einfluss.mjs`
verschiebt die Anteils-Normierung, sobald ein Sub-Skill zu stark wird — mehr ist nicht immer
besser):

| STEHEN-Variante | Abweichung zur Matrix | rho/Spiel kaderfest |
|---|---:|---:|
| vorher (44/26/18/12) | 35,0 Pp | 0,782 |
| stamina30/will28/health26/det16 | 24,3 Pp | 0,818 |
| **stamina24/will32/health34/det10 (gewählt)** | **19,4 Pp** | **0,834** |
| stamina16/will36/health40/det8 (übersteuert) | 24,1 Pp | — (verworfen, Deviation stieg wieder) |

## Ergebnis

`node scripts/miss-alle-disziplinen.mjs 24 climbing`, kaderfest (5 echte Kader-Paarungen aus
`data/generated/kaderfamilie-live-save.json`):

| | vorher | nachher |
|---|---:|---:|
| rho je Spiel (Median) | 0,782 | **0,834** |
| Spannweite | 0,191 | 0,209 |
| rho Saison (Median) | 0,839 | 0,860 |
| Spannweite Saison | 0,287 | 0,308 |
| Abnahme | knapp | **bestanden** |

**Isolationsnachweis:** `node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig, ohne Filter)
vorher/nachher verglichen — alle neunzehn anderen Zeilen bit-identisch, nur Climbing bewegt
sich. Die Bahn teilt sich zwar generischen Bewegungs-/Reserve-Code mit den anderen vier Bahnen,
aber die Änderung sitzt ausschließlich in `BAHN_ART.climbing.rezept.STEHEN` — kein gemeinsamer
Code wurde angefasst.

0,834 liegt 0,034 über der 0,80-Schranke und damit näher am angestrebten 0,85 als am
Mindestmaß — ein vertretbarer Puffer gegen das eigene Kaderrauschen (Spannweite 0,209), auch
wenn er dünner ist als z. B. Zeitfahrens (0,825 bei Spannweite 0,082). Ein weiteres Verschärfen
von STEHEN wurde geprüft und verworfen (Tabelle oben): ab einem gewissen Punkt kannibalisiert
ein einzelner, sehr dominanter Sub-Skill die sichtbaren Anteile der anderen Attribute in der
Messung, ohne dass rho weiter steigt — awareness und dexterity bleiben (−3 bis −5 Pp)
unterrepräsentiert, weil sie an TECHNIK/ANTRITT hängen, die diese Runde bewusst nicht
angefasst hat (ein Hebel pro Runde, um Ursache und Wirkung sauber zuzuordnen). Das ist der
naheliegende nächste Schritt für eine Folgerunde, falls das Kaderrauschen den heutigen Puffer
je auffrisst.

## Produktionsanbindung

Climbing teilt sich mit Staffel/Spurt/Takeshi's Castle/Time-Trial dasselbe Bahn-Chassis
(`MOTOREN[bd]` wird für jede `BAHN_ART`-Disziplin in derselben Schleife registriert) — es
brauchte keinen neuen Motor-Dispatch, nur denselben Anschluss, den die anderen vier schon
haben:

- `ARENA_BAHN_DISCIPLINE_IDS` (`lib/battle/arena-headless-runner.ts`) um `"climbing"` erweitert.
- Eigene PPS-Referenz gezogen (`scripts/ziehe-buehne-pps-referenz.ts climbing`, `chassis:"bahn"`,
  `katalogStandardgroesse:6` aus `lib/data/dataAdapter.ts`, gegen das frische `live-save`-Abbild),
  `data/generated/climbing-pps-referenz.json`.
- `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`/`CLIMBING_INDIVIDUAL_PPS_MAX`/`CLIMBING_PPS_ANTEIL_MITTE`
  (`lib/resolve/battle-mode-arena-team-points.ts`) nach demselben Muster wie die anderen vier
  Bahn-Disziplinen ergänzt (5,5/0,25, unverändert von Basketballs Kurvenentscheidung
  übernommen).
- `"climbing"` in `ARENA_RESOLVED_DISCIPLINE_IDS` aufgenommen.

## Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — `BAHN_ART.climbing.rezept.STEHEN` neu gewichtet,
  Kommentar ergänzt.
- `lib/battle/arena-headless-runner.ts` — `ARENA_BAHN_DISCIPLINE_IDS` um `climbing` erweitert.
- `scripts/ziehe-buehne-pps-referenz.ts` — Climbing-Eintrag in der `DISZIPLINEN`-Tabelle.
- `data/generated/climbing-pps-referenz.json` (neu) — PPS-Referenz gegen das `live-save`-Abbild.
- `lib/resolve/battle-mode-arena-team-points.ts` — Import, Konstanten, Config-Eintrag,
  `ARENA_RESOLVED_DISCIPLINE_IDS`.
- `data/generated/rangtreue-basislinie.json` — neu gebaut (`baue-rangtreue-basislinie.mjs 24`).
