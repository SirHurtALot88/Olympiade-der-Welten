# Wettessen — Opus-Gegencheck: 1 gegen 1 oder Team-Tafel? (23.09.)

**Anlass.** Chris zum Screenshot der Wettessen-Bühne: „findest du wettessen sieht nach ner modernen
coolen competition aus? machen wir hier nicht auch ein 1v1 wettessen also spieler vs spieler?" Die
Orchestrator-Session hat geantwortet, das Layout wirke wie ein generisches Boxscore-Raster, 1v1 sei
optisch authentischer, koste aber Ereignisdichte und damit Kalibrierung. Dieses Papier prüft das
**unabhängig** — die Recherche zu echten Wettbewerben, den Code, und die Folgen, gemessen statt
vermutet. Maßstab ist Chris' Satz von heute: „wir wollen die diszis möglichst realistisch gestalten".

**Stand.** `origin/main` = `b00135b5`; die zwei seither gemergten Commits (`2abf48f4` Breaking-Gauntlet, `7d84baaf` Climbing-Ticker) berühren Wettessen nicht. Gemessen in einem eigenen Worktree, kaderfest über die
Fünfer-Familie aus `data/generated/kaderfamilie-live-save.json` (live-save „Oly New Game Custom
19.8.2026"). Die Varianten liefen über zwei temporäre Mess-Skripte und einen Mess-Haken, der nur
`BUEHNE_ART` nach außen reicht. Nichts davon ist committet — dieses Dokument ist die einzige Datei,
die bleibt. `engine.js` meint `public/mockups/battle-mode.engine.js`.

---

## 0. Fazit vorweg

| # | Frage | Urteil |
|---|---|---|
| A | Ist 1 gegen 1 das realistischere Wettessen? | **Nein.** Das Standardformat im echten Sport ist ein **offenes Feld an einem langen Tisch**. Nathan's 2025 hatte **15 Männer und 13 Frauen** im Finale, sonst meist etwa 20 je Finale. Duelle gibt es als **Show-Sonderformat** (Netflix, Chestnut gegen Kobayashi, 2024) und beim **Stechen nach einem Gleichstand**. Unsere 2–6 Esser je Team, also 4–12 an einem Tisch, liegen mitten im echten Bereich. Im Corona-Jahr 2020 aß Nathan's mit fünf Leuten je Wettbewerb. |
| B | Was macht ein echtes Wettessen „modern und cool"? | **Die Präsentation, nicht die Kopfzahl.** Ein Tisch, der zum Publikum zeigt. Hinter jedem Esser ein eigener Zähler mit Wendetafel. Eine laufende 10-Minuten-Uhr. Die Einheit ist das gegessene Würstchen (auf ein Achtel genau), nicht „Punkte". Die Kamera bleibt beim Kopf-an-Kopf der zwei Führenden. Dazu Ansager, Gürtel und das Stechen. **Genau das fehlt uns heute**: zwei Reihen sitzen sich gegenüber, darunter stehen „Pkt" und „3/8". Das liest sich als Tabelle. |
| C | Sinkt die Rangtreue bei 1 gegen 1? | **Die Frage ist falsch gestellt, und das ist der wichtigste Messbefund.** Wettessen hat **keine Wechselwirkung** zwischen den Essern. Jeder würfelt seine Durchgänge für sich (`bauBuehne`, `setz()`). Wie verlässlich ein Esser abschneidet, hängt deshalb **nicht** an der Feldgröße. Gemessen: Die Paartreue je Abstandsklasse ist bei 6, 5, 4, 3 und 2 je Seite praktisch gleich (s. 3.1). Bei 1 gegen 1 ist „rho je Spiel" **gar nicht definiert** (zwei Teilnehmer; `rho()` liefert ab n<3 `NaN`). |
| D | Was ändert sich stattdessen bei 1 gegen 1? | Die Frage lautet dann: gewinnt der bessere Esser? **Über alle 45 Teampaarungen der Liga (jedes Team schickt seinen besten Esser): 88,1 %** der Duelle gehen an den Eignungsbesseren. Die Teamwertung bei 6 gegen 6 trifft **92,3 %**. Die Mechanik trägt ein Duell also. Pp-Abweichung **13,6 / 10,0** (1v1, n=12/48) gegen **13,8** (6v6, n=12). Das ändert sich nicht, beide Werte liegen weit unter 25. |
| E | Warum dann nicht 1 gegen 1 bauen? | Weil es **im Managerspiel** teuer ist und **im Sport** nicht realistischer. Die Feldgröße 2–6 wird je Saison gewürfelt, als Permutation innerhalb der Mental-Kategorie (`season-discipline-schedule.ts`). Die Aufstellung, die PPS-Referenz je Feldgröße (`wettessen-pps-referenz.json`, Größen 2–6) und die Einzel-PPs hängen daran. Eine feste 1 bräuchte einen Mini-DM-artigen Override. Mini-DM hat den bekommen, weil es **vom Konzept her** 1 Spieler je Team ist (Chris, 14.09.). Wettessen ist das nicht: ein bis fünf Spieler je Team und Spieltag verlören ihren Einsatz, die Kadertiefe wäre in dieser Disziplin egal, und die Leitlinie „mehrere Wege zum Erfolg" (Kapazitäts- gegen Tempo-Esser) schrumpfte auf einen Kopf. |
| F | Hilft „mehr Durchgänge"? | **Hier ausnahmsweise ja.** Wettessen ist der Spearman-Brown-Fall wie Eiskunstlauf und Breaking: unabhängige, vorab gewürfelte Durchgänge, keine RNG-Kaskade wie bei Hockey. Mit `rundenN` 8→10 steigt rho je Spiel in **beiden Saatstämmen** (6v6: 0,845→0,883 und 0,872→0,902; 4v4: 0,794→0,819 und 0,797→0,822). Zehn Durchgänge sind zugleich das **realistische** Maß: **zehn Minuten, ein Durchgang je Minute**. |

### Empfehlung

**Nicht 1 gegen 1 bauen. Stattdessen einen dritten Weg: die „Coney-Island-Tafel".** Das
Team-Format bleibt, mit 2–6 Essern je Team, so wie die Saison sie würfelt. Die Bühne wird nach dem
echten Nathan's-Bild umgebaut:

- ein langer Tisch zum Publikum
- ein Zähler je Esser
- die Einheit „Würstchen" statt „Pkt"
- eine 10-Minuten-Uhr
- ein Kopf-an-Kopf-Band mit Spotlight auf die zwei Führenden. Das liefert das 1-gegen-1-**Gefühl**, ohne das Format zu brechen.

Dazu als einzige Zahlenänderung `rundenN` 8→10 (je Durchgang eine Minute), bei gleicher
Gesamtdauer. Einzelheiten und Bauplan in Abschnitt 5.

---

## 1. Recherche: Wie echte Wettessen aufgebaut sind

### 1.1 Nathan's Famous Hot Dog Eating Contest, der Maßstab

- **Teilnehmerzahl.** Im Finale stehen etwa 20 Esser je Wettbewerb: frühere Sieger, Gewinner der
  Qualifikationsturniere, zwei Wildcards und Eingeladene von Major League Eating. **2025 waren es
  28 Teilnehmer, 15 Männer und 13 Frauen.** 2020 (Corona) aßen nur fünf je Wettbewerb.
- **Zeit.** Seit 2008 sind es **10 Minuten**, vorher 12.
- **Wertung.** Gezählt werden Würstchen samt Brötchen (HDB). **Angebrochene Würstchen zählen, auf
  ein Achtel der Länge genau.** Was bei Schluss noch im Mund ist, zählt, wenn es geschluckt wird.
- **Anzeige.** „A designated scorekeeper is paired with each contestant, flipping a number board."
  Hinter **jedem** Esser steht also eine eigene, gut sichtbare Zähltafel. Das ist das Bildmotiv
  des Wettbewerbs schlechthin.
- **Aufbau.** Alle Esser stehen **nebeneinander an einem langen Tisch, mit dem Gesicht zum
  Publikum**. Sie sitzen sich nicht gegenüber.
- **Gleichstand.** Ein **5-Hot-Dog-Stechen**: wer fünf Würstchen zuerst schafft, gewinnt. Das ist
  der einzige Duell-Moment im regulären Format.
- **Disqualifikation.** Beim Erbrechen („reversal of fortune") wird sofort disqualifiziert.
- **Show.** ESPN überträgt (Vertrag bis 2029), dazu Ansager und der Gürtel: senfgelb für die
  Männer, pink für die Frauen, diesen gibt es seit 2011. Die Übertragung **erzählt über die zwei,
  drei Favoriten**, etwa Chestnut gegen Kobayashi 2006–2009 oder die Titelserie von Miki Sudo.
  Die übrigen fünfzehn bilden die Kulisse.
- **2025:** Chestnut gewann mit 70,5 HDB, 24 vor Platz zwei (Bertoletti 46,5). Bei den Frauen
  gewann Sudo mit 33.

### 1.2 Wo es 1 gegen 1 wirklich gibt

- **„Chestnut vs. Kobayashi: Unfinished Beef"** (Netflix, live am 02.09.2024): ein reines Duell
  über 10 Minuten, 83 zu 66. Das war ein **Sonder-Event** auf einer 15 Jahre alten Rivalität,
  eine Show um zwei Namen. Kein Ligaformat.
- **Das Stechen** nach einem Gleichstand (s. oben).
- **The Glutton Bowl** (Fox, 2002) war ein Turnier mit **32 Essern**. Gegessen wurde in
  **Vorläufen mit mehreren Essern je Lauf**, danach kamen Wildcard und Finale. Auch das ist kein
  Duellformat, sondern Ausscheidung im offenen Feld.

### 1.3 Was daraus für uns folgt

Die Vermutung „1v1 ist realistischer" **hält der Recherche nicht stand**. Real ist: **viele
gleichzeitig an einem Tisch, erzählt über wenige.** Das Duell ist die Ausnahme für einen Showabend
oder ein Stechen. Die Orchestrator-Antwort hatte trotzdem in einem Punkt recht: **unser heutiges
Bild sieht nicht nach einem echten Wettessen aus.** Das liegt aber nicht an der Kopfzahl, sondern an
fünf konkreten Abweichungen vom echten Bild:

| Echt (Nathan's) | Bei uns heute (`zeichneWettessen`, `bodenWettessen`) |
|---|---|
| Ein Tisch, alle **nebeneinander**, Blick zum Publikum | Zwei Reihen **sitzen sich gegenüber** (Heim oben bei `H*0.32`, Gast unten bei `H*0.66`), geerbt aus der generischen Zwei-Reihen-Geometrie |
| Zähler **hinter jedem Esser**, groß, Einheit Würstchen | „`412 Pkt`" in 9-px-Monospace **unter** der Figur, dazu ein 30-px-Balken und „`3/8`" |
| **Eine** laufende Uhr, 10:00 → 0:00 | Kein Zeitbezug; „Durchgang 3/8" je Esser |
| Alle essen **gleichzeitig** | Die Enthüllungs-Warteschlange (`bauBuehne`, generischer Zweig) deckt **einen Esser nach dem anderen** auf, Durchgang für Durchgang, abwechselnd nach Seite |
| Kamera auf den **zwei Führenden** | Alle zwölf gleich groß; das Magen-Meter zeigt nur den Fortschritt des Führenden in Durchgängen |

---

## 2. Ist-Stand im Code

- **`BUEHNE_ART.wettessen`** (engine.js, ab Zeile ~13264): `jeSeite:6, rundenN:8,
  rundenDauer:0.65, failAbzug:0.65`, `failWort:"muss kurz pausieren"`, `erfolgWort:"schlingt
  durch"`, Flag `wettessen:true`. Das Rezept hat sieben Rollen: GRUNDLAGE
  stamina/health/will, SPITZENMOMENT torment/will/determination, TECHNIK
  intelligence/determination/health, PUBLIKUM will/determination, NERVEN
  will/health/determination, AUSDAUER stamina/health/will und WAGNIS
  torment/stamina/intelligence.
- **Matrix** (`official-discipline-weights.ts`, gesperrt): will 26, health 22, stamina 22,
  determination 16, intelligence 8, torment 6. Wird nicht angefasst.
- **Mechanik** (`bauBuehne` → `setz()`): Jeder Esser rechnet `rundenN` Durchgänge **für sich**.
  Die Erfolgschance kommt aus TECHNIK und NERVEN. Die Basis kommt aus GRUNDLAGE, gedämpft durch
  Ermüdung aus AUSDAUER. Bei Erfolg gibt es SPITZENMOMENT·WAGNIS dazu, bei Fehlschlag nur
  `basis·0,65`, dazu kommt PUBLIKUM. **Kein Esser liest den Stand eines anderen**, es gibt kein
  `duell`, kein `brett` und keinen gemeinsamen Zustand.
- **Teamergebnis** (`spieleBuehneAuftritt`): Seitenstand = Summe aller `u.summe` einer Seite.
- **Produktiv:** `wettessen` steht in `ARENA_RESOLVED_DISCIPLINE_IDS`
  (`lib/battle/arena-resolved-disciplines.ts`). Die Einzel-PPs kommen aus
  `data/generated/wettessen-pps-referenz.json`, das **je Feldgröße 2–6** eine eigene Referenz führt.
- **Feldgröße im echten Spiel:** Sie ist **nicht** 6. `jeSeite:6` gilt nur, wenn im Motor gar keine
  Aufstellung gesetzt ist. Real zieht `buildSeasonPlayerCountByDiscipline()`
  (`lib/season/season-discipline-schedule.ts`) je Kategorie eine Permutation von `[2,3,4,5,6]`.
  Wettessen spielt also je nach Saison 2, 3, 4, 5 oder 6 je Seite (Katalogwert 5,
  `dataAdapter.ts`). Die einzige feste Abweichung davon ist Mini-DM (`MINI_DM_FIXED_PLAYER_COUNT =
  1`, Chris' Entscheidung vom 14.09.).
- **Letzte Kalibrierung:** Die Tafel (PR vom 17.09., `wettessen-tafel-17-09.md`) war reine
  Präsentation, rho blieb bit-identisch bei 0,845.

---

## 3. Messungen

Alle mit 24 Spielen je Paarung, kaderfest über die Fünfer-Familie, Saatstamm 1337, sofern nicht
anders angegeben. „Paartreue" heißt: Anteil der Paare aus **verschiedenen Teams**, bei denen der
Eignungsbessere mehr Punkte holt, sortiert nach dem Eignungsabstand des Paars.

### 3.1 Ist-Mechanik bei allen echten Feldgrößen (6 bis 2 je Seite)

Die Grundlinie ist reproduziert: `node scripts/miss-alle-disziplinen.mjs 24 wettessen` →
**0,845** (Spannweite 0,139), Saison 0,930. Das ist bit-identisch zu `stand-aller-disziplinen.md`.

| je Seite | rho je Spiel (Median) | Spannweite | rho Saison | Star Rang 1 | Star Top 2 | Teamergebnis richtig |
|---:|---:|---:|---:|---:|---:|---:|
| 6 | **0,845** | 0,139 | 0,930 | 66,7 % | 82,5 % | 82,5 % |
| 5 | 0,798 | 0,180 | 0,915 | 60,8 % | 78,3 % | 80,8 % |
| 4 | 0,794 | 0,134 | 0,905 | 65,8 % | 80,8 % | 78,3 % |
| 3 | 0,714 | 0,246 | 0,943 | 60,8 % | 82,5 % | 87,4 % |
| 2 | 0,726 | 0,349 | 0,800 | 72,5 % | 94,2 % | 81,7 % |

**Paartreue nach Eignungsabstand, dieselben Läufe:**

| je Seite | < 2 | 2–5 | 5–10 | 10–15 | ≥ 15 |
|---:|---:|---:|---:|---:|---:|
| 6 | 52,3 % | 60,6 % | 78,3 % | 86,3 % | 98,2 % |
| 5 | 52,1 % | 59,3 % | 75,8 % | 84,0 % | 97,7 % |
| 4 | 49,1 % | 58,7 % | 76,3 % | 85,9 % | 97,1 % |
| 3 | 47,7 % | 58,8 % | 72,4 % | 85,1 % | 95,4 % |
| 2 | 47,8 % | 55,4 % | 72,3 % | 91,1 % | 96,7 % |

**So liest man das.** Die Spalten sind über alle Feldgrößen innerhalb weniger Punkte gleich, denn
die Mechanik ordnet ein Paar mit gegebenem Abstand gleich gut, egal wie viele sonst am Tisch sitzen.
Dass rho je Spiel bei kleinen Feldern fällt, ist eine **Eigenschaft der Statistik**, nicht des
Spiels. Bei vier Teilnehmern gibt es sechs Paare, und schon ein einziger Tausch zweier benachbarter
Ränge drückt rho von 1,0 auf 0,8. Bei zwölf Teilnehmern kostet derselbe Tausch 0,007. Die
Spannweite wächst entsprechend von 0,139 auf 0,349. Nebenbei: Das heißt
auch, dass Wettessen in Saisons mit 2–4 je Seite (drei von fünf) nach dieser nackten Zahl schon
**heute** „unter 0,80" liegt. Den Maßstab, der dort trägt, nennt CLAUDE.md selbst: Star und
Paartreue mit Abstand. Die Werte ≥ 15 mit 95–98 % und der Star in den Top 2 mit 78–94 % halten bei
jeder Feldgröße.

### 3.2 1 gegen 1: was gemessen werden kann

Bei 1 gegen 1 gibt es je Spiel zwei Teilnehmer. `rho()` in `scripts/lib/rangtreue-messung.mjs`
liefert ab `n < 3` `NaN`, und `miss-alle-disziplinen.mjs --je-seite=1` misst deshalb **nichts**.
Die ehrliche Ersatzfrage heißt: **gewinnt der Eignungsbessere das Duell?** Gemessen wurde sie auf
zwei Arten.

**(a) Alle Kreuzpaarungen der Familie** (jede Heimperson gegen jede Gastperson, 621 Paarungen × 12
Spiele = 7452 Duelle):

| gesamt | < 2 | 2–5 | 5–10 | 10–15 | ≥ 15 |
|---:|---:|---:|---:|---:|---:|
| **91,3 %** | 54,6 % | 68,3 % | 85,0 % | 96,4 % | 99,7 % |

Saison-Validität (mittlerer Rohwert je Person über alle ihre Duelle, 110 Personen): **rho 0,985**.

**(b) Realistisch: Liga-Duell der Besten.** Jedes der zehn Teams aus der Familie gegen jedes andere
(45 Paarungen × 24 Spiele), jedes Team schickt seine besten n (`ersatz`-Sortierung nach
`p.d.wettessen`, wie der Motor ohne Aufstellung):

| Format | Teamergebnis richtig (höhere Eignung gewinnt) |
|---|---:|
| 6 gegen 6 | **92,3 %** |
| 3 gegen 3 | 88,4 % |
| 2 gegen 2 | 85,0 % |
| **1 gegen 1** | **88,1 %** |

**Ergebnis.** Ein 1-gegen-1-Wettessen wäre **mechanisch tragfähig**. Die Sorge, weniger Teilnehmer
senkten die Verlässlichkeit, trifft auf Wettessen nicht zu, weil die Verlässlichkeit hier je Esser
entsteht (acht Durchgänge), nicht aus dem Zusammenspiel. Was sich ändert, ist **die Frage, die das
Spiel beantwortet**: nicht mehr „welches Team hat die bessere Esser-Riege", sondern „wer hat den
einen besten Esser". Das Teamergebnis wird dabei etwas zufälliger (92,3 → 88,1 %), weil sich das
Rauschen eines einzelnen Essers nicht mehr mit dem von fünf anderen ausmittelt.

### 3.3 Pp-Abweichung (Budget-Methode, Pflichtprüfung)

`einflussVon("wettessen", n)`; die 6v6-Zeile mit n=12 ist identisch mit `node
scripts/messe-arena-einfluss.mjs wettessen 12`.

| Variante | n=12 | n=48 |
|---|---:|---:|
| Ist (6 gegen 6, rundenN 8) | **13,8 Pp** | — (s. u.) |
| 1 gegen 1, rundenN 8 | 13,6 Pp | 10,0 Pp |
| 6 gegen 6, rundenN 10 | **7,8 Pp** | — (s. u.) |

Anteile im Ist-Stand (n=12): will 24,4 (Matrix 26) · stamina 24,0 (22) · health 21,8 (22) ·
determination 12,9 (16) · torment 10,9 (6) · intelligence 6,0 (8). Mit rundenN 10 (n=12)
rücken will/determination/torment näher an die Matrix: will 24,2 · health 22,2 · stamina 21,7 ·
determination 14,4 · torment 9,7 · intelligence 7,8.

**Messgrenze, offen benannt.** Die 6-gegen-6-Läufe mit n=24 und n=48 kamen in dieser Sandbox
nicht zurück. Der Headless-Renderer blieb bei 0 % CPU stehen, ohne Fehler, zweimal
reproduziert. Das ist dasselbe Hängen, das `i-spy-opus-gegencheck-2-22-09.md` für lange
`einflussVon`-Aufrufe beschreibt. Für die Abnahme von S4 gehört die zweite Ablesung (n=48) in
eine Umgebung, in der der lange Aufruf durchläuft. Eine frühere Ablesung desselben Motors mit
6 gegen 6 liegt bei 12,6 Pp (`battle-mode-gameplay-grundmodell.md`). Alle Varianten liegen **weit
unter der 25er-Schranke**. Das Format ändert daran nichts, denn die Anhebung wirkt auf den eigenen
Wert eines Essers, und der hängt nicht davon ab, wer sonst am Tisch sitzt.

### 3.4 Zehn statt acht Durchgänge („zehn Minuten")

Zwei unabhängige Saatstämme, dieselbe Kaderfamilie:

| Saatstamm | je Seite | rundenN 8 | rundenN 10 | Δ |
|---|---:|---:|---:|---:|
| 1337 | 6 | 0,845 | **0,883** | +0,038 |
| 1337 | 4 | 0,794 | **0,819** | +0,025 |
| 1337 | 2 | 0,726 | 0,767 | +0,041 |
| 4242 | 6 | 0,872 | **0,902** | +0,030 |
| 4242 | 4 | 0,797 | **0,822** | +0,025 |

Mit rundenN 10 bei 6v6 und Saat 1337 steigen auch die übrigen Kennzahlen: Star in den Top 2
82,5 → 86,7 %, Teamergebnis richtig 82,5 → 87,4 %, Paartreue ≥ 15 98,2 → 99,1 %.

**Einordnung.** Jede Einzeldifferenz liegt unter der Kader-Spannweite (~0,14). Die Richtung ist aber
in **allen fünf** gepaarten Vergleichen gleich, und der Mechanismus ist bekannt: Das ist der
Spearman-Brown-Fall, den Eiskunstlauf (6→12, 0,792→0,875) und Breaking (4→8, 0,804→0,869) schon
belegt haben. Die Hockey-Warnung aus CLAUDE.md („mehr Ereignisse helfen fast nie") greift nicht,
weil es keine RNG-Kaskade gibt. Die Durchgänge sind unabhängig und vorab gewürfelt. **Und 4 gegen 4
geht damit in beiden Stämmen über 0,80**, zuvor lag es knapp darunter.

---

## 4. Abwägung: Realismus gegen Rangtreue gegen Managerspiel

### 4.1 Was 1 gegen 1 brächte

- Ein klares Bild: zwei Esser, zwei Zähler, Kopf an Kopf. So sieht der Netflix-Abend aus.
- Mechanisch trägt es (88 % Duelltreue in der Liga, Pp unverändert).

### 4.2 Was 1 gegen 1 kostet

1. **Es ist nicht realistischer.** Das reguläre Format im echten Sport ist das offene Feld (1.1),
   das Duell ist die Show-Ausnahme (1.2). Wer nach Chris' Maßstab „möglichst realistisch" baut,
   landet beim Tisch, nicht beim Duell.
2. **Es bricht die Saisonmechanik.** Die Feldgröße 2–6 ist eine Grundregel des Spielplans und
   zieht die Permutation je Kategorie, die Aufstellung, die Kaderknappheit
   (`lineup-roster-shortfall.ts`) und die PPS-Referenz je Feldgröße mit. Eine feste 1 braucht einen
   Override wie `withMiniDmPlayerCountOverride`, dazu eine neue PPS-Referenz für n=1 (die heute nicht
   existiert) und eine neue Abnahmegröße (rho je Spiel ist undefiniert). Bei Mini-DM war das
   gerechtfertigt, weil das Konzept dort 1 je Team **ist**. Bei Wettessen wäre es eine
   Formatentscheidung gegen das Vorbild.
3. **Es kostet Spielerbeteiligung.** Je Wettessen-Spieltag würden 1–5 Spieler je Team weniger
   eingesetzt. Die Einzel-PPs konzentrieren sich auf einen Kopf, und die Kadertiefe spielt in dieser
   Disziplin keine Rolle mehr. Das widerspricht der Leitlinie „jeder Spieler hat eine gewisse
   Expertise und ist in irgendwas vielleicht gut". Beim Wettessen kann das heute der
   Kapazitäts-Esser (health/stamina) **und** der Tempo-Esser (Pace Control: stamina/intelligence)
   im selben Team sein.
4. **Das Teamergebnis wird etwas zufälliger** (92,3 → 88,1 %), weil ein Esser allein entscheidet.

### 4.3 Die Zwischenlösung „2–3 je Seite" (vom Auftrag erwogen)

Hier ist nichts zu gewinnen, das die Saison nicht ohnehin schon tut: 2 und 3 je Seite **kommen
bereits vor** (zwei von fünf Saisons). Eine feste 2–3 hätte dieselben Override-Kosten wie 1 gegen 1,
ohne dessen Bildwirkung.

### 4.4 Präsentation „sieht aus wie 1 gegen 1", Format bleibt: der tragfähige Weg

Das ist die Nathan's-Wahrheit selbst: **zwanzig am Tisch, erzählt über zwei.** Rho und Pp bleiben
**per Bauart** unberührt, wenn nur gezeichnet wird. Das haben die Tafel-PR (17.09.) und die
Eiskunstlauf-Startreihenfolge schon vorgemacht: `stepBuehne` addiert `u.summe += r.punkte` über
dieselbe Menge und zieht nie `rr()`.

---

## 5. Empfehlung: die „Coney-Island-Tafel"

**Entscheidung: 1 gegen 1 nicht bauen.** Stattdessen die Präsentation auf das echte Vorbild
umbauen und die Durchgänge an die echte Uhr koppeln. Vier Schritte, jeweils einzeln abnehmbar:

### S1 — Ein Tisch zum Publikum (rein zeichnerisch)
- `zeichneWettessen`: **Alle Esser stehen in einer Reihe hinter einem langen Tisch**, statt in zwei
  gegenüberliegenden Reihen. Die Teams erkennt man an Trikotfarbe und einem Fähnchen am Platz,
  sie stehen als zwei Blöcke links und rechts. Bei 2–6 je Seite sind das 4–12 Plätze; bei 12
  Plätzen braucht es eine leichte Staffelung (zweite, leicht versetzte Reihe) oder kleinere
  Figuren.
- `bodenWettessen`: Die karierte Bankettafel läuft quer statt längs zwischen zwei Reihen. Neon-Schild
  und Wimpelkette bleiben.

### S2 — Zähltafel und Einheit „Würstchen" (rein zeichnerisch)
- Hinter jedem Esser steht eine **Wendetafel mit der Zahl gegessener Würstchen**, das Bildmotiv von
  Nathan's. Die Umrechnung ist eine reine Anzeige-Skala aus `u.summe` (z. B. `u.summe / k`, in
  Halben gerundet). `k` wird so gewählt, dass der Median der Liga bei ~30–40 und Spitzen bei ~60–70
  landen, also im echten Bereich. **Die Wertung selbst bleibt `u.summe`**, PPs und Teamstand ändern
  sich nicht.
- Der Teamstand oben wird zu „Würstchen gesamt", mit derselben Skala.
- Die Wertungstabelle bekommt eine Spalte „Würstchen" neben „Pkt". Die Fußzeile nennt die Umrechnung.

### S3 — Die Uhr und das Kopf-an-Kopf-Band (rein zeichnerisch plus Warteschlange)
- Eine **10:00-Countdown-Uhr** groß über dem Tisch. Jeder Durchgang ist eine Minute.
- **Gleichzeitig essen:** Die Enthüllungs-Warteschlange deckt einen Durchgang für **alle** Esser
  zugleich auf (eine „Minute"), statt einen nach dem anderen. Das ist realistisch und
  rangtreue-neutral aus demselben Grund wie die Eiskunstlauf-Startreihenfolge: Die Reihenfolge
  bestimmt nur, wann ein bereits berechneter `runden[]`-Eintrag sichtbar wird.
  **Vor dem Bau prüfen:** Kann `stepBuehne` einen Stapel je Takt aufdecken, oder braucht es einen
  eigenen Wettessen-Takt? Das ist eine Frage des Taktgebers, nicht der Wertung.
- **Kopf-an-Kopf-Band** oben, im Stil einer Sportübertragung: die zwei Führenden über beide Teams,
  groß, mit Porträt, Zahl und Abstand. Dazu ein Spotlight auf ihre zwei Plätze am Tisch, die übrigen
  etwas abgedunkelt. **Das ist das 1-gegen-1-Gefühl, das Chris sucht**, ohne jemanden vom Tisch zu
  nehmen.
- Das Magen-Meter bleibt, zeigt aber die Minuten (Uhr) statt „Durchgänge des Führenden".

### S4 — rundenN 8 → 10 (die einzige Zahlenänderung)
- `BUEHNE_ART.wettessen.rundenN: 10`, `rundenDauer: 0.52`. Die Gesamtdauer bleibt gleich
  (12 × 10 × 0,52 ≈ 62 s, heute 12 × 8 × 0,65 ≈ 62 s). Mit S3 (gleichzeitig) verschiebt sich die
  Taktung. Dann ist eine Minute ein Takt, und die Dauer muss dort neu gesetzt werden.
- **Abnahme:** `miss-alle-disziplinen.mjs 24 wettessen` (erwartet ~0,88), zusätzlich
  `--je-seite=4` und `--je-seite=2`, dazu `messe-arena-einfluss.mjs wettessen 12` und 48 (≤ 25),
  `npm run ci:rangtreue-schranke` und die neu gezogene `wettessen-pps-referenz.json` (sie verschiebt
  den Rohwert, s. deren Hinweistext). Dazu der Spiegeltest
  `scripts/miss-arena-buehne-spiegel.mjs`.
- Die Wertungstabelle nennt in ihrer Fußzeile „8 Durchgänge"/„65 %" nur indirekt und muss sprachlich
  mitziehen („Minute" statt „Durchgang").

### Optional, nicht Teil der Empfehlung
- **Stechen:** Bei exakt gleichem Teamstand ein 5-Würstchen-Stechen der beiden Teambesten als echter
  1-gegen-1-Moment. Das kommt bei Summen über 12 Esser so gut wie nie vor. Die Bildwirkung ist
  deshalb gering, der Aufwand (eine neue Tiebreak-Regel im Arena-Pfad) nicht. **Nur**, wenn Chris
  das 1-gegen-1 als echtes Ereignis will, nicht nur als Bild.
- **Gürtel:** Der Tagesbeste des Spieltags bekommt einen „Senfgürtel" im Ticker bzw. in der
  Wertungstabelle, als reines Etikett nach dem Muster der „Punktesieg"-Auszeichnung beim Gewichtheben.

### Was ausdrücklich NICHT empfohlen wird
- **Feste Feldgröße 1 (oder 2–3)** für Wettessen: siehe 4.2 und 4.3.
- **Änderungen an der Matrix oder am Rezept**: nicht nötig (Pp 13,8), und die Matrix ist gesperrt.

---

## Quellen

**Gemessen** (Worktree an `b00135b5`, temporäre Skripte, nicht committet):
- `node scripts/miss-alle-disziplinen.mjs 24 wettessen` → 0,845 / Spannweite 0,139 / Saison 0,930.
- Feldgrößen-Sonde über `window.__arena.disziplinProbe("wettessen", {jeSeite, kaderFamilie, saat0})`,
  jeSeite 6/5/4/3/2, rundenN 8/10, Saatstämme 1337 und 4242 (3.1, 3.4).
- Duell-Sonde: jeSeite 1 über (a) 621 Kreuzpaarungen × 12, (b) 45 Liga-Teampaarungen × 24 (3.2).
- `einflussVon("wettessen", n)` über `messe-arena-einfluss.mjs` bzw. mit gesetzter
  `jeSeite`/`rundenN` (3.3).

**Gelesen:** engine.js (`BUEHNE_ART.wettessen`, `bauBuehne`, `zeichneWettessen`, `stepWettessen`,
`spieleBuehneAuftritt`, `disziplinProbe`, `einflussVon`), `scripts/lib/rangtreue-messung.mjs`,
`lib/season/season-discipline-schedule.ts`, `lib/battle/arena-resolved-disciplines.ts`,
`lib/resolve/battle-mode-arena-team-points.ts`, `data/generated/wettessen-pps-referenz.json`,
`lib/data/dataAdapter.ts`, `docs/design/wettessen-tafel-17-09.md`,
`docs/design/stand-aller-disziplinen.md`,
`docs/design/pruefung-2-6-spieler-tauglichkeit-alle-disziplinen-08-09.md`.

**Recherche (Web, 23.09.):**
- [Nathan's Hot Dog Eating Contest — Wikipedia](https://en.wikipedia.org/wiki/Nathan%27s_Hot_Dog_Eating_Contest): Feldgröße ~20, 10 Minuten seit 2008, Zähltafel je Esser, 5-HDB-Stechen, Achtel-Wertung, Gürtel, ESPN bis 2029.
- [Yahoo Sports, 2025 Nathan's Results](https://sports.yahoo.com/live/2025-nathans-hot-dog-eating-contest-joey-chestnut-140041332.html): 28 Teilnehmer (15 Männer, 13 Frauen), Chestnut 70,5, Bertoletti 46,5, Sudo 33.
- [Chestnut vs. Kobayashi: Unfinished Beef — Wikipedia](https://en.wikipedia.org/wiki/Chestnut_vs._Kobayashi:_Unfinished_Beef) und [Variety](https://variety.com/2024/tv/news/joey-chestnut-beats-takeru-kobayashi-netflix-hot-dog-eating-contest-unfinished-beef-1236127068/): Netflix-Duell 02.09.2024, 83 : 66.
- [The Glutton Bowl — Wikipedia](https://en.wikipedia.org/wiki/The_Glutton_Bowl): 32 Esser, Vorläufe, Wildcard, Finale.
- [Competitive eating — Wikipedia](https://en.wikipedia.org/wiki/Competitive_eating): übliche Zeitlimits 8/10/12/15 min, Chipmunking, Dunking, Schiedsrichter.
- [FanSided, Nathan's Regeln](https://fansided.com/rules-of-nathans-hot-dog-eating-contest-competitive-eating-whats-allowed-and-whats-not-tiebreaker): „reversal of fortune" = Disqualifikation, Stechen.
