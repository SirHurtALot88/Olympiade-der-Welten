# Wettessen — Nachtkonzept „Die Mauer, die Haltung und das Tunken" (03.10.)

**Reine Konzeptrunde. Kein Code geändert, kein Verhaltens-PR.** Auftrag aus Chris' Erweiterung vom
03.10. abends („bei den anderen event poors bitte heute über die nacht auch konzepte ausarbeiten …
denk gern um die ecke, hol infos aus dem internet und probier dich aus") auf Grundlage seiner Frage
vom 02.10. („mehr risiko führt dazu dass jemand sich evtl übertrifft oder unter dem druck oder
gewicht einbricht"). Wettessen ist Nummer 8 der neun ereignisarmen Disziplinen in
`docs/design/manager-risiko-interaktivitaet-konzept-02-10.md`: „laut Fable erzählt die Mechanik
nichts: zehn Minuten gleich gewürfelt, ohne Verlaufskurve, ohne ‚Mauer' (voller Magen), ohne
Strategie."

`engine.js` meint `public/mockups/battle-mode.engine.js` (Stand `main` = `68563962`, 03.10.).

---

## 0. Fazit vorweg

| | |
|---|---|
| **Kernidee** | Die **Mauer** als **Füllstand** statt als feste Minute: jeder Bissen füllt ein Magen-Budget aus AUSDAUER (health/stamina); ist es voll, isst der Esser nur noch mit WILLE (NERVEN). Wer vorne sprintet, trifft die Mauer **früher** — das ist Chris' Satz „mehr Risiko → übertrifft sich oder bricht ein" als eine einzige Regel, ohne Zusatzwürfel. |
| **Zur vorgemerkten Aufgabe W-F1** | Bestätigt als **Klasse C**, Kern bleibt. Vorschlag: nicht die feste Mauer-Minute `m* = 3 + AUSDAUER/25` aus dem Fable-Papier, sondern der Füllstand — gleiche Attribute, gleiche Richtung, aber die Mauer wird dadurch zur Folge des eigenen Tempos und damit erst zum Hebel für Haltung (W-F3). |
| **Manager-Hebel** | **Haltung je Esser: Sprint / Gleichmäßig / Schlussspurt** (= W-F3 / Opus-Q2 / Konsultation 02.10. Zeile 2 „Sprint/Pacing"). In der Sonde wählt die KI nach Kalibrierung sinnvoll: NERVEN ≥ 60 → Schlussspurt (25 von 28), NERVEN < 45 → Gleichmäßig (32 von 51), Sprint als Außenseiter-Wette (20 von 110). Der erste Parametersatz war **falsch** (Sprint in 68 % immer am besten) — Designregel 3 muss gemessen, nicht angenommen werden. |
| **Nebenweg** | **Technik: Tunken (Solomon-Methode) oder pur** — sicherer Bissen, kleinerer Bissen; lohnt über TECHNIK (intelligence). Mit meinen Startwerten noch zu schwach (12 von 110 Essern), braucht ein eigenes Raster. Als erster Schritt auch rein erzählerisch (Klasse A) möglich. |
| **Sonde** | Eigenes Scratch-Modell außerhalb des Repos, kaderfest über die Fünfer-Familie, zwei Saatstämme, 24×5 Spiele. Alle Mauer-Varianten: rho **+0,01** gegenüber Ist (in der Sonde, nicht in der Engine — s. 5.0), Pp **10,5–13,5** (Ist 11,8), Will-Anteil rückt von 24,6 auf 26–27 (Matrix 26). |
| **Klasse** | Mauer **C**, Haltung **B + S** (braucht das Grundgerüst aus der Konsultation 02.10., Zeile 0), Tunken **B** (oder zuerst A), Druck-/Hochrechnungs-Ticker **A**. **Nichts davon ist Klasse T** — die 60 Sekunden Sendezeit und die zehn Durchgänge bleiben. Eine Verlängerung der Schlussminute im Bild wäre T und wird hier nur benannt, nicht vorgeschlagen. |
| **Größtes Risiko** | Nicht rho, sondern der Haltungs-Hebel selbst: ein Knopf, der im Schnitt immer besser ist, macht den Hebel zur Pflichtübung und den Pacing-Esser zum Verlierer. Das ist eine Kalibrierfrage mit Messpflicht (Sonde zeigt beides: falsch und richtig). |

---

## 1. Was heute da ist, was vorgemerkt ist

**Gebaut (Stand `main`):**
- `BUEHNE_ART.wettessen` läuft den **generischen Auftritt-Block** (`setz()` in `bauBuehne()`, engine.js
  ≈15726–15763): zehn Durchgänge = zehn Minuten, je Minute **genau ein `rr()`**, Basis
  `20 + GRUNDLAGE·0,7` gedämpft durch `ermued` (nur unter AUSDAUER 60, in Minute 10 höchstens ~10 %),
  Erfolg aus TECHNIK/NERVEN/WAGNIS (`buehneErfolgschance`, ≈15538), bei Erfolg
  `SPITZENMOMENT·0,35·buehneWagnisFaktor`, bei Fehlschlag `basis·0,65` („muss kurz pausieren"),
  PUBLIKUM·0,12 immer obendrauf. **Kein Esser liest den Stand eines anderen.**
- Rezept (≈14793): GRUNDLAGE stamina 40/health 35/will 25 · SPITZENMOMENT torment 45/will 30/det 25 ·
  TECHNIK int 45/det 30/health 25 · PUBLIKUM will 50/det 50 · NERVEN will 45/health 35/det 20 ·
  AUSDAUER stamina 50/health 30/will 20 · WAGNIS torment 50/stamina 30/int 20.
- Matrix (gesperrt): will 26, health 22, stamina 22, determination 16, intelligence 8, torment 6.
- Präsentation: Coney-Island-Tafel (S1–S4, 23.09.), `rundenN` 10, Wendetafeln, 10:00-Uhr,
  Kopf-an-Kopf-Band, **W-F2 Menü des Spieltags** (01.10., `570aad50`, Klasse A, gebaut).
- Stand der Abnahme (`stand-aller-disziplinen.md`): rho je Spiel **0,872** (Basislinie 01.10.: 0,866),
  Saison 0,916, Pp **13,6 / 14,7** (n=48, zwei Stämme), bestanden.
- Slots (`matchday-slot-roles.ts` 216–223): *Capacity, Pace Control, Iron Stomach, Table Focus,
  Second Wind, Final Bite* — alles Attributzuschläge mit Namen, mechanisch existiert keins davon
  (Fable 30.09., Abschnitt 4.1).

**Vorgemerkt, nicht gebaut:**
- **W-F1 „Die Mauer"** (`fable-ideen-buehne-auftritt-30-09.md` Abschnitt 4, Klasse C, mittel, 1,5–2
  Tage): drei Phasen Sprint → Mauer → Schlussminute, Mauer-Minute **deterministisch**
  `m* = 3 + AUSDAUER/25`, Mauerfaktor `0,45 + NERVEN·0,005`. Chris' Frage Nr. 1 aus dem Papier ist
  offen: „Soll Wettessen eine eigene Kurve bekommen … oder bleibt es bewusst der reine
  Wertungsrechner mit schöner Tafel?"
- **W-F3 Startstrategie als Managerwahl** (Klasse C, = Opus-Q2): „Nicht bauen, bevor W-F1 gemessen
  ist und Q2 entschieden."
- Konsultation 02.10., Zeile 2: Wettessen „Sprint/Pacing" als Haltungs-Beschriftung des Bühnen-
  Sammelhebels `h·Δ` an `buehneErfolgschance`/`buehneWagnisFaktor`, Rho-Puffer 0,872, Vermerk
  „**erst mit W-F1 ‚Mauer'**".

Die Reihenfolge ist also längst beschlossen: Mauer zuerst, Haltung danach. Dieses Papier ändert
daran nichts — es schärft die Mauer, legt die Haltung konkret aus und fügt den Nebenweg hinzu.

---

## 2. Recherche: Was beim echten Wettessen das Drama macht

Gelesen am 03.10. (WebSearch/WebFetch; wo die Seite nicht direkt abrufbar war, ist das vermerkt).

### 2.1 Die Kurve ist vorne steil, und die Mauer kommt um Minute 6

- Chestnut 2021 (Rekord 76): „In the first three minutes of the 2021 contest, Chestnut downed 30
  hot dogs" — und: „he started to slow down in the sixth minute of the contest but that their cheers
  pushed him forward." ([NESN](https://nesn.com/2021/07/joey-chestnut-nathans-hot-dog-eating-contest),
  [TheWrap](https://thewrap.com/joey-chestnut-nathans-hot-dog-contest-14th-win); Zitate aus den
  Suchauszügen, die NESN-Seite selbst liefert heute 404.)
- Tempo: Chestnut „averaged more than seven hot dogs per minute, but at the onset was around nine
  per minute" und „slowed down quite a bit" ([UPI 2017](https://www.upi.com/Odd_News/2017/07/04/Joey-Chestnut-downs-record-72-hot-dogs-in-Nathans-hot-dog-eating-event/8111499176294/)).
  Neun am Anfang, sieben im Schnitt: die zweite Hälfte läuft bei rund fünf.
- ESPN Page 2 (Hruby, 2003): „Quick starts are crucial — mostly because you've got six to eight
  minutes before the sensation of being stuffed kicks in."
  ([ESPN](https://www.espn.com/page2/s/hruby/030703.html), Zitat aus dem Suchauszug; Seite liefert
  leer.)
- „The Wall": „the point at which the full impact of competitors' full bellies weighs on their
  desire to continue … When competitors hit the wall, their eyes become cloudy and jaws hang open in
  defeat." Und: „By minute six, the competitive eaters start to vomit up hot dogs. Because vomiting
  begets disqualification, they have to hold back the vomit with more hot dogs."
  ([Phoenix New Times](https://www.phoenixnewtimes.com/?p=40498591), Suchauszug.)
- Physiologie (Univ. of Pennsylvania, 10-Minuten-Studie): der Profi aß 36 Hot Dogs gegen 7 beim
  Normalesser; sein Magen wurde zum „massively distended, food-filled sac occupying most of the upper
  abdomen". Erfolg „not because their stomachs emptied faster but because their stomachs were able
  to enlarge dramatically" — Training macht den Magen „so stretchy and limp that the competitors
  never get the ‚full' physiological signal."
  ([I Spy Physiology](https://ispyphysiology.com/2016/06/29/how-many-hot-dogs-can-you-eat-in-10-minutes/),
  [Gizmodo](https://gizmodo.com/how-champion-eater-joey-jaws-chestnut-scarfed-down-70-1783151823).)

**Übersetzung:** Kapazität (Magendehnung) entscheidet, *wann* die Mauer kommt. Wille entscheidet,
*was danach noch geht*. Das ist exakt die Zweiteilung health/stamina gegen will aus der Matrix —
Fable hat das am 30.09. richtig gesehen. Neu ist nur der Schluss daraus: **die Mauer ist keine
Uhrzeit, sondern ein Füllstand.** Wer in drei Minuten 30 isst, ist früher voll als wer 20 isst.

### 2.2 Die Rivalität: warum man zuschaut

- 2007: Kobayashi (Kieferverletzung) verliert 66:63 gegen Chestnut — erster Gürtel auf US-Boden seit
  2001. 2008: **59:59 nach zehn Minuten, Fünf-Hot-Dog-Stechen**, Chestnut in 50 s, Kobayashi 7 s
  später. ESPN: „The passion is raw but the hot dogs are cooked. That's the most competitive eating
  contest I have ever seen. And Kobayashi is absolutely crestfallen." 2009: 68 zu 64,5.
  ([Natchez Democrat](https://www.natchezdemocrat.com/2008/07/04/chestnut-wins-hot-dog-contest-after-eat-off/),
  [KAXE/NPR](https://www.kaxe.org/news/2024-06-13/the-biggest-rivals-in-hot-dog-eating-are-headed-for-a-rematch-15-years-in-the-making),
  [Wikipedia Nathan's](https://en.wikipedia.org/wiki/Nathan%27s_Hot_Dog_Eating_Contest).)
- 2024 Netflix „Unfinished Beef" 83:66 — Sonderformat, bereits im Gegencheck 23.09. eingeordnet.
- Frauen 2023: Sudo gegen Ebihara, „the unofficial real-time counter showed the two women tied
  throughout much of the competition", Sudo: „The first couple minutes, I found myself watching her,
  which I never want to do." ([KUNC/NPR](https://www.kunc.org/npr-news/2023-07-04/miki-sudo-defends-her-hot-dog-eating-title-stormy-weather-delays-mens-contest).)

**Übersetzung:** Das Drama ist der **Abstand zwischen zwei Zählern über die Zeit**, nicht die
Endsumme. Dazu das Stechen als einziger echter Duellmoment. Und: Auf den Gegner zu schauen kostet
die Esserin — „which I never want to do". Druck ist real, aber er wirkt **negativ** auf den, der
hinschaut, nicht als Turbo.

### 2.3 Technik: die Solomon-Methode und das Tunken

- Kobayashi, Nathan's 2001: 50 in 12 Minuten, vorheriger Rekord 25⅛. Seine Frage war nicht „wie esse
  ich mehr", sondern: „how can I make one hot dog easier to eat?" — „if you just look at it as a way
  of trying to put something in instead of, how much more can I eat than normal, then it really just
  takes a few questions and a little research." Lösung: Wurst vom Brötchen trennen, Wurst
  halbieren, Brötchen in Wasser tunken und als Kugel nachschieben — die **Solomon-Methode**. Dazu die
  **Kobayashi-Shake** („When you shake your belly, you will push the food faster into your gastric
  system"). Und die psychologische Mauer des alten Rekords: „people only see someone eating 25 is the
  limit then someone who can eat 20 might think wow, if I just eat five more I could actually do
  that." ([Freakonomics Radio](https://freakonomics.com/podcast/a-better-way-to-eat-a-new-freakonomics-radio-podcast/),
  [Wikipedia Kobayashi](https://en.wikipedia.org/wiki/Takeru_Kobayashi),
  [Food Republic](https://www.foodrepublic.com/1601554/kobayashi-shake-water-nathans-hot-dog-eating-contest).)
- Tunken: „softens the food and makes it wetter, so it's easier to chew and swallow" (Gizmodo).
  Sudo: Hot Dogs getrennt vom Brötchen, Brötchen in Crystal Light getunkt (KUNC).
- Chipmunking: „eaters are given a reasonable amount of time (typically less than two minutes) to
  swallow the food or risk a deduction" — was bei Schluss im Mund ist, zählt, wenn es geschluckt wird.
  „Reversal of fortune" = Disqualifikation; gelbe Karte für „messy eating", rote für den Rückschlag.
  Achtel-Wertung. ([Wikipedia Competitive eating](https://en.wikipedia.org/wiki/Competitive_eating),
  [Wikipedia Nathan's](https://en.wikipedia.org/wiki/Nathan%27s_Hot_Dog_Eating_Contest).)
- Gegenstimme zur Pacing-Idee: „There is no pacing yourself or long-term strategy with speed eating"
  ([Skillset Mag](https://skillsetmag.com/article/mastering-the-art-of-competitive-eating/)). Das
  gilt für den Amateur mit 8 Minuten Reserve; die Profis oben zeigen das Gegenteil (Chestnut 9 → 5
  je Minute, Sudo gleichmäßig). Für uns heißt das: **Sprint darf im Schnitt nicht die beste Haltung
  sein** — sonst hätte Skillset recht und der Hebel wäre keiner.

### 2.4 Was wir übertragen können (und was nicht)

| Echt | Übertragbar als | Nicht übertragbar |
|---|---|---|
| Blitzstart, 30 in 3 Minuten | Sprint-Phase mit höherer Basis, früherer Mauer | — |
| Mauer um Minute 6, danach „Wille" | Füllstand-Mauer, Mauerfaktor aus NERVEN | Erbrechen/DQ (Kaskade, s. Fable „nicht vorschlagen") |
| Kobayashi tunkt, Chestnut tunkt, Amateur nicht | Technik-Wahl Tunken/pur als Nebenweg über TECHNIK | Kobayashi-Shake als eigene Mechanik (Zierde; als Pause-Animation bei Fehlschlag reicht) |
| Zwei Zähler Kopf an Kopf, „on pace for" | Hochrechnungs-Band, Abstand in Würstchen, Mauer-Banner | Live-Eingriff des Managers (Klasse T, Konsultation Befund B) |
| 59:59 → Stechen | Optionales 5-Würstchen-Stechen bei Gleichstand (Gegencheck „optional") | — |
| Chipmunking in der Schlussminute | Schlussminute mit doppeltem WAGNIS-Trade-off (Fable W-F1, übernommen) | zwei Minuten Schluckzeit im Bild (wäre Klasse T) |

---

## 3. Die Konzepte

### K1 — Die Mauer als Füllstand (W-F1, verfeinert) — Klasse C

**Was Fable vorschlug (30.09.):** Mauer-Minute `m* = 3 + AUSDAUER/25`, fest aus den Werten;
danach Basis × Mauerfaktor `0,45 + NERVEN·0,005`; Schlussminute mit doppeltem WAGNIS-Trade-off und
vollem SPITZENMOMENT.

**Was ich ändere — eine Zeile:** statt `minute > m*` gilt `füllstand > K`, mit
`füllstand = Summe der bisherigen Minutenpunkte` und `K = 65 + AUSDAUER·5` (Startwert, s. 5.2).
Alles andere (Mauerfaktor, Schlussminute, ein `rr()` je Minute, kein Zustand zwischen Essern) bleibt
wie bei Fable.

**Warum das besser ist als die feste Minute:**
1. **Die Mauer wird zur Folge des eigenen Tempos.** Wer vorne mehr isst, ist früher voll. Das ist
   physiologisch richtig (2.1) und es ist genau die Kopplung, die Chris meint: Risiko *verursacht*
   den Einbruch, er wird nicht separat gewürfelt. Mit fester Minute wäre „Sprint" nur ein Bonus vorne
   und ein Malus hinten ohne inneren Zusammenhang.
2. **Sie macht die Haltung (K2) überhaupt erst sinnvoll.** Sprint = früher an die Mauer; Schlussspurt
   = sparsam, Mauer später, Reserve für Minute 8–10. Mit fester Minute müsste jede Haltung ihre eigene
   Mauer-Verschiebung als Zusatzparameter tragen.
3. **Sie bleibt deterministisch im Sinne von `lastFuer()`:** K kommt aus Werten, nur die Minutenpunkte
   werden gewürfelt — und die werden ohnehin gewürfelt. Kein zweiter Würfel.
4. **Sie erzeugt ein Ereignis mit Zeitstempel:** „Kael trifft die Mauer — Minute 5" ist ein Banner,
   das heute nirgends existiert, und es fällt bei jedem Esser in eine andere Minute (Sonde: Spanne
   4–10, Median 7). Zehn Esser, zehn verschiedene Mauer-Minuten: das ist die Verlaufskurve, die der
   Konsultationsbefund vermisst.

**Phasen (ergeben sich, werden nicht gesetzt):**

| Phase | Bedingung | Basis | Erfolgschance | Bonus |
|---|---|---|---|---|
| Vor der Mauer | `füllstand ≤ K` | `20 + GRUNDLAGE·0,7` (kein `ermued` mehr) | wie heute | SPITZENMOMENT·0,35·WagnisFaktor |
| Hinter der Mauer | `füllstand > K` | × Mauerfaktor `0,45 + NERVEN·0,005` (Deckel 0,4–0,95) | −0,05 | halb |
| Schlussminute | Minute 10 | wie Phase | WAGNIS-Trade-off doppelt | voll — *Final Bite* |

**Was `ermued` ersetzt:** heute wirkt AUSDAUER nur als lineare Dämpfung unter 60. Im Füllstand-Modell
trägt AUSDAUER die Kapazität K — ein stärkerer, aber matrixtreuer Kanal (AUSDAUER = stamina 50/health
30/will 20, also genau die beiden 22er). `ermued` entfällt für Wettessen; die anderen fünf Bühnen
bleiben unberührt (eigene Weiche `mauer:true`, Muster `heben`/`gauntlet`/`schatzsuche`).

**Mehrere Wege (Fable-Tabelle bleibt gültig, wird schärfer):**

| Weg | Attribute | Wie er gewinnt | Sichtbar als |
|---|---|---|---|
| Kapazitäts-Esser (Primärweg) | health, stamina | große Kapazität, Mauer in Minute 8–10, lange volle Basis | Tafel blättert bis zum Schluss gleichmäßig |
| Willens-Esser | will, determination | frühe Mauer, aber Mauerfaktor 0,9 — holt in Minute 6–10 auf | „Second Wind"-Banner, Tafel wird langsamer, bleibt aber in Bewegung |
| Sprinter | torment, determination (SPITZENMOMENT) | vorne weg, hinten leer, in der Schlussminute noch einmal | führt nach Minute 3, fällt zurück, *Final Bite* |
| Techniker (Nebenweg, K3) | intelligence (TECHNIK) | weniger Pausen, Tunken | wenige „Pause"-Einträge in der Wertungstabelle |

### K2 — Die Haltung: Sprint / Gleichmäßig / Schlussspurt (W-F3, konkret) — Klasse B + S

Der Managerhebel, den Chris am 02.10. beschrieben hat, in Wettessen-Sprache. Je Esser und
Wettessen-Aufstellung, vorab gesetzt (Konsultation Befund B: kein Live-Eingriff), KI-Vorgabe
deterministisch aus dem Kader (Muster `berechneFokusAuto`), Ticker-Zeile beim Greifen.

| Haltung | Minute 1–4 | Minute 5–7 | Minute 8–10 | Kapazität K |
|---|---|---|---|---|
| **Sprint** („Blitzstart") | Basis × 1,10, Erfolgschance −0,10 | — | — | × 0,92 (früher voll) |
| **Gleichmäßig** (Standard) | bit-identisch zur Mechanik ohne Hebel | | | |
| **Schlussspurt** („Second Wind") | Basis × 0,97 | Basis × 0,97 | Bonus × 1,5, WAGNIS-Trade-off doppelt; hinter der Mauer Mauerfaktor + `(NERVEN−50)·0,004` | — |

**Designregeln aus der Konsultation, geprüft:**
- *Normal ist bit-identisch* — Gleichmäßig = K1 ohne Zusatz. ✔
- *Kein Knopf darf immer besser sein* — **mein erster Parametersatz hat das verletzt** (Sprint: Basis
  × 1,12, Erfolg −0,06, K × 0,92 → KI wählt Sprint bei 75 von 110 Essern, Schlussspurt nie). Nach
  Verteuerung (Erfolg −0,10) und einem echten Second-Wind-Weg: Schlussspurt 42, Gleichmäßig 48,
  Sprint 20 — und zwar **nach NERVEN sortiert**: NERVEN ≥ 60 → Schlussspurt 25 von 28, NERVEN < 45 →
  Gleichmäßig 32 von 51, Sprint am ehesten bei NERVEN < 45 (12 von 51). Das ist die
  spieltheoretisch richtige Lage: der Willensstarke spart sich auf, der Schwache streut (Konsultation
  Regel 3, Außenseiter-Logik). ✔ — aber nur nach Messung, nicht aus dem Bauch.
- *Obergrenze im eigenen Korridor* — Sprint hebt die Basis um 10 % für vier Minuten; ein Esser mit 15
  Eignungspunkten weniger kommt damit nicht über den Besseren (Paartreue ≥ 15 bleibt 99,9 %). ✔
- *Zusatzbelohnung außerhalb der gewerteten Summe* — hier nicht nötig, die Haltung verschiebt nur die
  Form der Kurve, nicht den Erwartungswert über die Haltungen hinweg (Sonde: Kurvensumme Sprint
  ≈ Gleichmäßig ≈ Schlussspurt ± 2 %).
- *Messpflicht* — rho, Paartreue, Pp, zwei Stämme, KI-Vorgabe beidseitig, Extremfall „alle Sprint".
  In der Sonde für alle drei Extremfälle gefahren (5.1).

**Was die Haltung sichtbar macht:** die Minute, in der die Anweisung greift („Sprint: Kael geht mit
9 Würstchen/min raus"), das Mauer-Banner, und am Ende eine Anweisungsbilanz in der Wertungstabelle
(„Haltung: Schlussspurt, +6 Würstchen in Minute 8–10"). Braucht das Grundgerüst der Konsultation
(Haltungsfeld in der Einsatzliste, Übergabe `{d, slot, haltung}`, Zeile 0) — deshalb **B + S**, nicht
allein B.

### K3 — Technik: Tunken oder pur (Solomon-Methode) — Klasse B, Vorstufe A

**Was.** Jeder Esser isst entweder **pur** (Standard) oder **tunkt** (Solomon: trennen, halbieren,
Brötchen nass). Tunken: Erfolgschance `+0,03 + TECHNIK·0,0008`, Basis × 0,94 — sicherer, aber kleinere
Bissen. Das ist der Nebenweg der I-Spy-Leitlinie: dieselbe Aufgabe (zehn Minuten essen), zweiter
Lösungsweg über ein anderes Attribut (intelligence über TECHNIK), schlechter gestellt in der Basis,
besser gestellt in der Verlässlichkeit.

**Befund der Sonde:** mit diesen Startwerten wählt die KI Tunken nur bei 12 von 110 Essern (TECHNIK
≥ 60: 6 von 26). Der Nebenweg ist **zu schwach, um eine Wahl zu sein** — die 6 % weniger Basis
kosten mehr, als die höhere Erfolgschance bringt, weil `failAbzug 0,65` den Fehlschlag ohnehin mild
bestraft. Zwei Stellschrauben, beide noch nicht gemessen: Basis × 0,96 statt 0,94, oder Tunken
schiebt zusätzlich die Mauer hinaus (nasse Brötchen rutschen — K × 1,05). **Erst ein Raster, dann
eine Empfehlung.** Pp-Risiko: intelligence ist mit 8 das zweitleichteste Matrixattribut; ein Tunken-
Weg, der für alle besser wäre, würde es über 8 heben. Die Sonde zeigt mit „alle tunken" intelligence
bei 6,2 — also sogar Luft nach oben.

**Vorstufe, Klasse A, sofort baubar:** die Technik rein **erzählerisch** aus TECHNIK ableiten (≥ 55:
„tunkt", sonst „pur"), als Bauchbinde und als Animation bei `vizEssPhase` („schlingen" mit Wasserglas)
— kein Punkt, kein Würfel. Wie das Menü des Spieltags: Kulisse zuerst, Mechanik, wenn gemessen.

### K4 — Druck durch den Gegner: Hochrechnung und Abstand — Klasse A (als Mechanik verworfen)

**Als Mechanik getestet und verworfen.** Ich habe eine „Rivalen-Druck"-Variante gefahren: wer ab
Minute 4 mehr als 60 Punkte hinter dem Führenden liegt, „hetzt hinterher" (Basis × 1,08, Erfolg
−0,10 + NERVEN·0,001). rho in der Sonde unverändert (0,959 gegen 0,962), aber: das ist die erste
**Wechselwirkung zwischen Essern**, die Wettessen je hätte — und damit wäre die Feldgrößen-Robustheit
2–6 (Gegencheck Befund C: „Paartreue je Abstandsklasse bei 6, 5, 4, 3 und 2 je Seite praktisch
gleich") nicht mehr per Bauart gegeben, sondern müsste je Feldgröße nachgemessen werden. Sudos Satz
(„watching her, which I never want to do") sagt zudem, dass Druck real eher **bremst**. Ich schlage
die Mechanik nicht vor.

**Als Anzeige empfohlen (Klasse A, Fable W-B2/W-B4 konkretisiert):**
- **Hochrechnung** im Kopf-an-Kopf-Band: „auf Kurs für 58 Würstchen" — aus Summe und verbleibenden
  Minuten; `buehneMaxRestPunkte()` (≈15582) liefert bereits spoilerfrei die obere Schranke, die
  lineare Hochrechnung ist dieselbe Bauform.
- **Abstand in Würstchen** zwischen den zwei Führenden, mit Pfeil, wenn er sich in dieser Minute
  geschlossen oder geöffnet hat („+2 → +1").
- **Mauer-Banner** je Esser, einmalig (K1 liefert die Minute): „Mauer! Kael (Minute 5) — jetzt zählt
  nur noch der Wille." Mit Mauerfaktor als Vorschau: „hält 85 %".
- **Second-Wind-Banner**, wenn ein Esser hinter der Mauer in einer Minute mehr isst als in der Minute
  davor (Erfolg nach Fehlschlag).
- **Tempo-Spur** unter jeder Wendetafel: zehn kleine Balken, einer je Minute — die Kurve, die Fable
  als W-B2 skizziert hat, wird mit K1 erst lesbar (ein Sprinter sieht anders aus als ein Pacer).
- **Stechen bei Gleichstand** der Teamsummen: bleibt „optional" wie im Gegencheck; mit der Mauer gibt
  es ein natürliches Stechen-Kriterium (wer hinter der Mauer mehr geholt hat) — nur falls Chris den
  Duellmoment will.

### Was ich ausdrücklich nicht vorschlage

- **Keine Disqualifikation, keine Fehlschlag-Kette** (Fable, Gegencheck): verstärkende Kaskade trifft
  die Schwachen und senkt die Verlässlichkeit je Spiel.
- **Keine Kobayashi-Shake-Mechanik**: als Pause-Animation hübsch, als Regel Zierde.
- **Kein Gericht mit mechanischer Wirkung** (W-F2 bleibt Kulisse, Begründung bei Fable).
- **Keine Änderung an `rundenN`, `rundenDauer` oder der 60-Sekunden-Sendezeit** — das wäre Klasse T.
  Alle Banner oben passen in die sechs Sekunden je Minute, die S3 heute hat.
- **Kein Live-Eingriff** während der zehn Minuten (Klasse T, Konsultation Befund B).

---

## 4. Klasse-Einstufung

| Nr. | Idee | Klasse | Aufwand | Braucht Chris | Reihenfolge |
|---|---|---|---|---|---|
| K1 | Mauer als Füllstand (W-F1 verfeinert) | **C** (bestätigt) | mittel, 1,5–2 Tage inkl. Kalibrierraster K/Mauerfaktor, PPS-Referenz neu, Spiegeltest | ja — Fable-Frage Nr. 1 ist unverändert offen; dazu neu: feste Minute oder Füllstand? | 1 |
| K4 | Hochrechnung, Abstand, Mauer-/Second-Wind-Banner, Tempo-Spur | **A** | klein, ½–1 Tag | nein (Sichtprüfung) | 2, direkt nach K1 (Banner braucht die Mauer-Minute) |
| K3a | Technik als Erzählung (tunkt/pur aus TECHNIK) | **A** | klein, ½ Tag | nein | 2 |
| K2 | Haltung Sprint/Gleichmäßig/Schlussspurt | **B + S** | mittel; Grundgerüst (Konsultation Zeile 0) vorausgesetzt, dann klein | ja — ist W-F3/Opus-Q2 und die Haltungs-Grundsatzfrage der Konsultation („eigene Achse oder Intensität umdeuten?") | 3, nach K1-Messung |
| K3b | Technik als Mechanik (Nebenweg) | **B** | klein–mittel, eigenes Raster | ja | 4 |
| — | Stechen bei Gleichstand | C (winzig) | klein | nur wenn Duellmoment gewünscht | — |

**Klasse T: nichts.** Es gibt einen T-Kandidaten, den ich bewusst *nicht* vorschlage: die
Schlussminute im Bild zu dehnen (zwei Sekunden länger, Chipmunk-Countdown). Das wäre eine Änderung
der Sendezeit und braucht Chris' ausdrückliche Zustimmung; es steht hier nur, damit es nicht
stillschweigend in K4 rutscht.

**Zur bestehenden Einstufung von W-F1 (Klasse C):** bestätigt. Der Füllstand ändert nichts an der
Klasse — es bleibt eine Mechanik, die `wert()` verschiebt und eine Messrunde braucht. Er ändert die
Form (eine Zustandsvariable `füllstand` je Esser statt einer vorab berechneten Minute), nicht den
Aufwand.

---

## 5. Die Sonde: rho-/Pp-Verträglichkeit, grob

### 5.0 Was die Sonde ist und was nicht

Ein Scratch-Skript **außerhalb des Repos** (Scratchpad der Session, nicht committet), das die
generische Bühnenformel nachbaut und die Varianten daneben legt. Kaderfest über die Fünfer-Familie
`data/generated/kaderfamilie-live-save.json`, `eig` = `p.d.wettessen` wie die Engine, zwei
Saatstämme (1337, 4242), 24 Spiele je Paarung, Pp über die Budget-Methode (je Spieler und Attribut
+15, Gewinn mitteln, Anteile gegen die Matrix — Nachbau von `einflussVon()`, n=6).

**Ehrliche Grenze:** die Sonde kennt **keinen Slot-/Form-/Stufenaufschlag und keine Mutatoren**.
Deshalb liegt ihr Ist-rho bei **0,95**, die Engine bei **0,872** — die Sonde ist gegenüber der
Engine gesättigt. **Absolute Zahlen sind nicht vergleichbar; nur die Richtung und der Abstand
zwischen den Varianten zählen.** Die Pp-Zahlen sind näher an der Engine (Ist-Sonde 11,8 gegen
Engine 13,6/14,7), weil die Budget-Methode auf `wert()` arbeitet, nicht auf `eig`. Die echte Abnahme
läuft mit `miss-alle-disziplinen.mjs 24 wettessen` (plus `--je-seite=4` und `=2`) und
`messe-arena-einfluss.mjs wettessen 48`, zwei Stämme — wie im Gegencheck S4 beschrieben.

### 5.1 Ergebnis

| Variante | rho/Spiel Median (1337 / 4242) | Δ zu Ist | Star Top 2 | Paartreue 5–10 / ≥15 | Pp (1337, n=6) | Will / Health / Stamina / Det / Tor / Int |
|---|---|---|---|---|---|---|
| **Ist** (generischer Block) | 0,951 / 0,948 | — | 79 / 81 % | 86 / 99,8 % | **11,8** | 24,6 / 24,4 / 23,4 / 12,6 / 8,1 / 6,9 |
| **W-F1 Fable** (m* fest) | 0,964 / 0,962 | +0,013 / +0,014 | 79 / 88 % | 90 / 99,9 % | **10,5** | 27,1 / 25,6 / 21,2 / 13,7 / 6,5 / 5,8 |
| **K1 Füllstand**, alle gleichmäßig/pur | 0,962 / 0,959 | +0,011 / +0,011 | 81 / 88 % | 88 / 99,9 % | **12,8** | 26,1 / 25,8 / 24,3 / 12,2 / 6,2 / 5,4 |
| K1 + alle **Sprint** (Extremfall) | 0,959 / 0,957 | +0,008 / +0,009 | 82 / 89 % | 88 / 99,9 % | 13,5 | 26,8 / 26,0 / 23,4 / 12,5 / 5,6 / 5,7 |
| K1 + alle **Schlussspurt** (Extremfall) | 0,962 / 0,961 | +0,011 / +0,013 | 83 / 88 % | 89 / 99,9 % | 12,0 | 25,8 / 25,4 / 23,9 / 12,2 / 6,7 / 6,0 |
| K1 + **KI-Wahl** je Esser (Haltung + Technik) | 0,962 / 0,960 | +0,011 / +0,012 | 83 / 88 % | 88 / 99,9 % | 12,2 | 26,4 / 26,0 / 23,6 / 12,6 / 6,1 / 5,4 |
| K1 + alle **Tunken** | 0,963 / 0,961 | +0,012 / +0,013 | 88 / 89 % | 89 / 99,9 % | 11,3 | 25,5 / 24,9 / 23,5 / 12,6 / 7,2 / 6,2 |
| Rivalen-Druck (Gegentest, Wechselwirkung) | 0,959 / 0,959 | +0,008 / +0,011 | 79 / 87 % | 87 / 99,9 % | — | — |

Matrix zum Vergleich: will 26 / health 22 / stamina 22 / determination 16 / intelligence 8 / torment 6.

**Kurve je Minute (Mittel über alle Esser, Stamm 1337):**

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Ist | 56,8 | 56,8 | 56,6 | 56,1 | 55,6 | 55,5 | 55,4 | 55,2 | 54,9 | 55,0 |
| W-F1 Fable | 56,8 | 57,1 | 57,0 | 55,1 | 48,2 | 40,5 | 39,8 | 39,9 | 39,9 | 42,0 |
| K1 Füllstand | 56,8 | 57,1 | 57,0 | 56,6 | 55,1 | 50,1 | 44,0 | 40,8 | 40,0 | 42,0 |
| K1 Sprint | 58,7 | 58,9 | 58,6 | 57,7 | 53,1 | 46,0 | 41,7 | 40,1 | 39,9 | 42,0 |
| K1 Schlussspurt | 55,5 | 55,7 | 55,7 | 55,3 | 54,0 | 50,6 | 45,0 | 43,5 | 42,4 | 43,5 |

Mauer-Minute im Füllstand-Modell: Median **7** (Sprint: 6), Spanne 4–10. Die Ist-Kurve ist die
flache Linie, die der Konsultationsbefund beschreibt — „zehn Minuten gleich gewürfelt". Die
Chestnut-Kurve (9 → 7 → 5 je Minute) hat die Form der K1-Zeile.

### 5.2 Lesung

1. **Keine Mauer-Variante kostet rho** — alle liegen in beiden Stämmen über Ist, in derselben
   Richtung, mit demselben Mechanismus wie Fable erwartet hat: die Struktur verstärkt
   Eignungsunterschiede (mehr Kapazität = mehr volle Minuten, mehr Wille = mehr Mauer-Punkte), die
   Verlässlichkeit bleibt bei zehn unabhängigen Würfen. Dass es in der Engine dieselben +0,01 werden,
   ist **nicht** gesagt (Sättigung, 5.0) — aber ein Einbruch unter 0,80 ist nach dieser Sonde
   unwahrscheinlich. Puffer heute: 0,872 − 0,80 = 0,07.
2. **Pp bleibt überall unter 15, Ziel ≤ 25 mit Reserve.** Will rückt in allen Varianten an die 26
   der Matrix (heute 24,6 — Fable: „Will ist mit 26 das schwerste Matrixattribut und heute in fünf
   Rollen verstreut"). Torment fällt von 8,1 Richtung 6 (Matrix 6, heute übergewichtet). Das sind
   die beiden Verschiebungen, die Fable vorhergesagt hat, beide in Richtung Matrix.
3. **Der Preis des Füllstands gegenüber der festen Minute:** health/stamina gehen leicht **über** die
   Matrix (25,8 / 24,3 gegen 22 / 22), weil K aus AUSDAUER kommt und AUSDAUER stamina 50/health 30
   trägt. Fables feste Minute hat dieselbe Quelle, aber die Kapazität wirkt dort nur über die
   Minutenzahl, nicht zusätzlich über die Punkte, die vor der Mauer gegessen werden. **Stellschraube:**
   K-Steigung von 5 auf 4 je AUSDAUER-Punkt senken oder den will-Anteil in AUSDAUER (heute 20) in K
   stärker gewichten. Beides gehört ins Kalibrierraster der Bauphase, nicht in dieses Papier.
4. **Die Haltung verschiebt rho nicht, auch nicht in den Extremfällen** („alle Sprint" 0,959 /
   0,957 — das schwächste, aber über Ist). Pp beim Extremfall Sprint 13,5: health 26, weil Sprint die
   Basis (GRUNDLAGE: stamina/health) hebt. Mit KI-Wahl 12,2. Beides unauffällig.
5. **Der Haltungs-Hebel ist eine Kalibrierfrage mit Falle.** Erster Parametersatz: Sprint bei 75 von
   110 Essern beste Wahl, Schlussspurt nie — ein toter Knopf und ein Pflichtknopf. Zweiter Satz:
   48 / 42 / 20 nach NERVEN sortiert. Dritter Satz (Sprint-Erfolgschance −0,14 statt −0,10): Sprint
   nur noch bei 6 von 110 — wieder ein toter Knopf. **Das Band ist schmal** (zwischen −0,06
   „immer" und −0,14 „nie" liegen acht Prozentpunkte Erfolgschance). Das Raster muss in der
   Bauphase an der **Engine** gefahren werden (Slot-/Formaufschlag verschieben NERVEN je Spiel), mit dem Kriterium: jede Haltung ist für
   mindestens ein Fünftel der Esser die beste, und die beste Haltung korreliert mit NERVEN (nicht mit
   `eig` — sonst wäre der Hebel nur ein zweiter Eignungswert).
6. **Tunken ist noch kein Weg** (12 von 110). Siehe K3.
7. **Rivalen-Druck ist rho-neutral, aber bricht die Bauart** (Wechselwirkung). Verworfen.

### 5.3 Was die Sonde nicht geprüft hat

- Feldgrößen 2–6 je Seite (Sonde nur mit der Familie, 10–11 je Paarung). Da K1/K2/K3 je Esser
  rechnen, gilt das Gegencheck-Argument (keine Wechselwirkung → Paartreue je Abstandsklasse unabhängig
  von der Feldgröße) weiter; nachmessen trotzdem (`--je-seite=4`, `=2`).
- Mutatoren (`mutatorTreffer`), Slot-Aufschlag (*Capacity* etc. zahlen auf health/stamina ein und
  schieben K mit — gewollt, aber zu messen), Formkarten.
- Die PPS-Referenz (`wettessen-pps-referenz.json`) verschiebt sich mit jeder `wert()`-Änderung; neu
  ziehen wie bei S4.
- Pp mit n=48 statt n=6 (die Sonde ist dafür zu langsam gebaut; die Engine-Messung macht das).

---

## 6. Offene Fragen und Entscheidungen für Chris

1. **W-F1, unverändert die Hauptfrage:** Soll Wettessen eine eigene Kurve bekommen — oder bleibt es
   der Wertungsrechner mit schöner Tafel? Ohne Ja zu K1 gibt es weder Mauer-Banner noch Haltung.
2. **Feste Minute oder Füllstand?** Mein Vorschlag: Füllstand (Begründung K1). Fables feste Minute
   ist Pp-günstiger (10,5 gegen 12,8 in der Sonde), der Füllstand ist erzählerisch stärker und
   macht die Haltung erst sinnvoll. Beides ist Klasse C, gleicher Aufwand.
3. **Haltung als eigene Achse?** Das ist die Grundsatzfrage der Konsultation vom 02.10. („Haltung
   neben Intensität, oder Intensität umdeuten?"). Wettessen ist der Ort, an dem „Pacing" ein echter
   Fachbegriff ist — aber es sollte nicht die erste Disziplin sein, die das Grundgerüst erzwingt
   (Pilot bleibt Gewichtheben, laut Konsultation).
4. **Tunken als Mechanik oder nur als Bild?** Mein Vorschlag: zuerst Bild (K3a, Klasse A), Mechanik
   nach eigenem Raster.
5. **Stechen bei Gleichstand** — will Chris den einen echten Duellmoment (5 Würstchen, Teambeste
   gegeneinander), obwohl er bei 4–12 Essern fast nie vorkommt?
6. **Nichts Klasse T beantragt.** Falls Chris die Schlussminute im Bild gedehnt sehen will
   (Chipmunk-Countdown), ist das eine eigene Entscheidung und steht hier nur als Hinweis.

---

## 7. Empfohlene Reihenfolge, wenn Chris K1 abnickt

1. **K1 Füllstand-Mauer** als eigene, gemessene Runde: Weiche `mauer:true`, eigener `setz()`-Zweig
   (~40 Zeilen), Kalibrierraster K-Steigung {4, 4,5, 5} × Mauerfaktor-Steigung {0,004, 0,005, 0,006},
   zwei Stämme, `--je-seite` 6/4/2, Pp n=48, Spiegeltest, PPS-Referenz neu, CI-Schranke.
2. **K4 Banner und Tempo-Spur + K3a Technik-Bild** in derselben oder der folgenden PR (Klasse A, die
   Mauer-Minute liegt nach K1 auf dem Rundeneintrag).
3. **K2 Haltung**, sobald das Grundgerüst (Konsultation Zeile 0) steht — Wettessen wäre nach
   Gewichtheben die zweite Disziplin daran, mit dem Raster aus 5.2 Punkt 5.
4. **K3b Tunken-Mechanik** zuletzt, eigenes Raster.

---

## Anhang A — Parameter der Sonde (für Nachvollziehbarkeit)

Alle Zahlen sind **Startwerte**, keine Ergebnisse.

```
Basis         = 20 + GRUNDLAGE·0,7                 (kein ermued im Mauer-Modell)
Erfolg        = clamp(0,05..0,94, 0,15 + TECHNIK·0,0055 + NERVEN·0,0035 − (WAGNIS−50)·0,0015·wagMul + dErf)
WagnisFaktor  = max(0, 0,7 + (WAGNIS−50)·0,014·wagMul)
Erfolg:  Basis + SPITZENMOMENT·0,35·WagnisFaktor·bonusMul      Fehlschlag: Basis·0,65
Punkte        = max(0, round(… + PUBLIKUM·0,12));  füllstand += Punkte

K (Kapazität) = 65 + AUSDAUER·5      (Sprint: ·0,92)
Mauer         = füllstand > K  →  Basis·mf, dErf −0,05, bonusMul·0,5
mf            = clamp(0,4..0,95, 0,45 + NERVEN·0,005)
Schlussminute = Minute 10 → wagMul 2, bonusMul ≥ 1

Sprint        = Minute 1–4: Basis·1,10, dErf −0,10          (erster Satz: ·1,12 / −0,06 → verworfen)
Schlussspurt  = Minute 1–7: Basis·0,97; Minute 8–10: bonusMul 1,5, wagMul 2;
                hinter der Mauer mf += max(0, NERVEN−50)·0,004 (Deckel 0,98)
Tunken        = dErf += 0,03 + TECHNIK·0,0008, Basis·0,94
Rivalen-Druck = ab Minute 4, Rückstand > 60 auf den Führenden: Basis·1,08, dErf −(0,10 − NERVEN·0,001)

KI-Wahl       = Haltung × Technik mit höchstem Erwartungswert über 40 feste Saaten je Esser
Messung       = 5 Paarungen × 24 Spiele × 2 Stämme; Pp: +15 je Spieler und Attribut, n=6, Stamm 1337
```

## Anhang B — Quellen

**Repo (gelesen, nichts geändert):** `public/mockups/battle-mode.engine.js` — Chassis-Kommentar
≈6205–6245, `BUEHNE_WAGNIS_RISIKO/_ERTRAG`, `buehneErfolgschance()`, `buehneWagnisFaktor()`,
`buehneMaxRestPunkte()` (≈15536–15590), `bauBuehne()`/`setz()` (≈15592–15767), `BUEHNE_ART.wettessen`
(≈14760–14818), `stepWettessen()` (≈20591–20680), `einflussVon()` (≈44289–44334), `BASIS_JE_DISC`,
`gewichtet()`; `lib/lineups/matchday-slot-roles.ts` (216–223);
`lib/player-generator/official-discipline-weights.ts`; `scripts/lib/rangtreue-messung.mjs` (`rho()`
in der Sonde importiert); `data/generated/kaderfamilie-live-save.json`.
Dokumente: `manager-risiko-interaktivitaet-konzept-02-10.md`, `fable-ideen-buehne-auftritt-30-09.md`
(Abschnitt 4, W-F1/W-F2/W-F3), `wettessen-format-opus-gegencheck-23-09.md`,
`stand-aller-disziplinen.md` (Wettessen-Zeilen), `fable-ideen-bahn-30-09.md` 0.5 (Klassen).

**Web (03.10.):**
- https://nesn.com/2021/07/joey-chestnut-nathans-hot-dog-eating-contest — 30 in 3 Minuten, „slow down in the sixth minute" (Suchauszug; Seite 404)
- https://thewrap.com/joey-chestnut-nathans-hot-dog-contest-14th-win — 2021, 76
- https://www.upi.com/Odd_News/2017/07/04/Joey-Chestnut-downs-record-72-hot-dogs-in-Nathans-hot-dog-eating-event/8111499176294/ — neun je Minute am Anfang, sieben im Schnitt
- https://www.espn.com/page2/s/hruby/030703.html — „six to eight minutes before the sensation of being stuffed kicks in" (Suchauszug; Seite leer)
- https://www.phoenixnewtimes.com/?p=40498591 — „The Wall", Minute 6 (Suchauszug)
- https://ispyphysiology.com/2016/06/29/how-many-hot-dogs-can-you-eat-in-10-minutes/ — Penn-Studie, 36 gegen 7, „massively distended"
- https://gizmodo.com/how-champion-eater-joey-jaws-chestnut-scarfed-down-70-1783151823 — Tunken, Satiety-Reflex
- https://www.natchezdemocrat.com/2008/07/04/chestnut-wins-hot-dog-contest-after-eat-off/ — 59:59, Stechen, ESPN-Zitat
- https://www.kaxe.org/news/2024-06-13/the-biggest-rivals-in-hot-dog-eating-are-headed-for-a-rematch-15-years-in-the-making — Rivalität 2007–2009
- https://en.wikipedia.org/wiki/Nathan%27s_Hot_Dog_Eating_Contest — Regeln, Stechen, Karten, Achtel, 2024/2025
- https://www.kunc.org/npr-news/2023-07-04/miki-sudo-defends-her-hot-dog-eating-title-stormy-weather-delays-mens-contest — Sudo/Ebihara, „watching her"
- https://freakonomics.com/podcast/a-better-way-to-eat-a-new-freakonomics-radio-podcast/ — Kobayashi: Reframing, Solomon, Tunken, 25⅛, Shake
- https://en.wikipedia.org/wiki/Takeru_Kobayashi — Solomon-Methode, Shake
- https://www.foodrepublic.com/1601554/kobayashi-shake-water-nathans-hot-dog-eating-contest — Shake-Zitat
- https://en.wikipedia.org/wiki/Competitive_eating — Chipmunking, Reversal
- https://skillsetmag.com/article/mastering-the-art-of-competitive-eating/ — „no pacing yourself" (Gegenstimme)
