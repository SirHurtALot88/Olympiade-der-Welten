# Broadcast-Optik für die Bühnen-Auftritte: Eiskunstlauf, Showcase, Wettessen (27.09.)

**Reine Recherche und Konzept. Kein Code, keine Rezeptänderung.** Stand: `origin/main` @
`ebb3b99a`. `engine.js` meint `public/mockups/battle-mode.engine.js`; die Zeilennummern
beziehen sich auf diesen Stand.

Dieses Papier baut auf drei Vorarbeiten auf und wiederholt sie nicht:

* `broadcast-praesentation-runde-2-22-09.md` („Runde 2“) hat die acht Grafikregeln aufgestellt
  (Persistenz, Teamfarbe, Delta, Live-Rangliste, Grafik im Spielraum, Marker am Akteur, Wechsel
  signalisieren, Highlights selten). Daraus ist für Eiskunstlauf inzwischen gebaut: Bandenlicht und
  Vorsprungsbalken (Vorschlag 2a/2c). Die neue Highlight-Regel `buehneAuftrittBig()` gilt für alle
  drei Auftritte.
* `buehne-auftritt-opus-konzeptreview-26-09.md` (Branch `buehne-auftritt-konzeptreview-26-09`)
  stellt fest: Showcase und Eiskunstlauf haben weder Entscheidungen noch echtes Risiko. Die
  Wertungsumbauten E1–E5 und S1–S5 stehen dort. **Dieses Papier schlägt keinen davon vor.** Es
  zeigt nur, wo eine Anzeige später an einen solchen Umbau andocken würde.
* `ui-bewegungs-audit-26-09.md` (Branch `ui-bewegungs-audit-26-09`) stuft alle vier Auftritte als
  „solide“ ein: eigene Phasenmaschinen, sichtbare Ausschläge. **Die Bewegung ist also nicht die
  Lücke. Es fehlt die Übertragungsschicht darüber.**

Die Frage dieser Runde lautet: **Welche Grafik- und Regie-Elemente machen echte TV-Übertragungen
dieser drei Formate lesbar und spannend, und welche davon lassen sich im 2D-Motor bauen?**

---

## 0. Ergebnis vorweg

### 0.1 Klassen: was ein Vorschlag berührt

| Klasse | Bedeutung | rho-/Pp-Folge |
|---|---|---|
| **A: nur Anzeige** | liest nur Felder, die schon enthüllt sind (`u.summe`, `u.aktuell`, `u.runden[0..aktuell]`, `viz*`). Kein `rr()`, kein Schreiben auf Wertungsfelder, keine Änderung am Enthüllungstakt | **per Konstruktion bit-identisch**. Trotzdem einmal `miss-alle-disziplinen.mjs 24 eiskunstlauf showcase wettessen` vorher und nachher fahren |
| **A′: Anzeige mit neuem Anzeigefeld im Rechner** | wie A, legt aber ein zusätzliches Feld in `runden[]` ab, gerechnet aus Werten, die im Durchgangswurf ohnehin entstehen. Präzedenzfall ist `knapp` (`engine.js:14219–14239`). Gleiche Zahl an `rr()`-Aufrufen | bit-identisch, **nachzuweisen** (Messung vorher = nachher, auf drei Stellen) |
| **B: berührt den Ablauf** | verschiebt Takt oder Dauer (Pause vor dem Ergebnis, Endstand-Overlay später). Punkte und Reihenfolge bleiben unverändert | rho-neutral, weil in `bauBuehne()` alles vorab gerechnet wird. Es kostet aber Zuschauzeit gegen Chris' ~60-s-Ziel. Vorher prüfen, dass die Sonde nicht am Echtzeittakt hängt |
| **C: berührt die Wertungslogik** | neuer Bonus, Abzug, Abbruch oder Tiebreak | **Messpflicht**: rho über 0,80 und Pp ≤ 25 mit zwei Saatstämmen (CLAUDE.md). Hier nur benannt, s. Abschnitt 5 |

### 0.2 Die Vorschläge je Disziplin, priorisiert

| Prio | Nr. | Vorschlag | Klasse | Aufwand |
|---|---|---|---|---|
| **Eiskunstlauf** |||||
| 1 | E-B1 | Elementkästen mit ISU-Kürzeln und **drei** Farben (sauber / unterdreht „<“ / Sturz „F“) | A | klein |
| 1 | E-B2 | **„L/C“-Zeile** (Leader gegen Current bei gleichem Elementstand) in der Tafel, dazu der Eis-Halo aus Runde 2 (b) | A | klein–mittel |
| 1 | E-B3 | **Kiss-&-Cry-Enthüllung**: „Wertung folgt …“, danach die Aufschlüsselung, danach die Plakette „PLATZ n“, und die Zeile springt sichtbar in der Tafel | A | mittel |
| 2 | E-B4 | **Zeitlupen-Wiederholung** des Schlüsselelements als Bild-im-Bild, während das Paar im Kiss & Cry sitzt | A | mittel |
| 2 | E-B5 | Sturzmarke bleibt auf dem Eis liegen, bis das Programm vorbei ist | A | klein |
| 3 | E-B6 | Sprung-Analytics nach Omega-Vorbild (Höhe, Luftzeit, Weite) aus dem Bonusanteil | A′ | klein–mittel |
| **Showcase** |||||
| 1 | S-B1 | **X-Wand zählt mit**: jeder Fehlschlag lässt das nächste Jury-X dauerhaft leuchten, beim dritten wird die ganze Rückwand rot | A | klein |
| 1 | S-B2 | **Applaus-Meter** mit Marke für den Tagesbestwert | A | klein |
| 1 | S-B3 | **„Top 3 bisher“-Tafel** im Bild, dazu der Vorhangsaum in der Farbe des führenden Teams | A | klein–mittel |
| 2 | S-B4 | **Urteilsmoment**: Trommelwirbel, Licht aus, Spot, Jury-Stühle drehen sich (The-Voice-Muster), Plakette „PLATZ n“ | A (Überblend-Variante) / B (Pausen-Variante) | mittel |
| 2 | S-B5 | **Goldener Buzzer als reines Bildereignis**, höchstens einmal je Spiel | A | klein |
| 3 | S-B6 | Jury-Reaktionskacheln (drei Juroren-Figuren mit Mimik) als kurzer Schnitt bei Big-Momenten | A | mittel |
| **Wettessen** |||||
| 1 | W-B1 | **Wendetafeln zählen live hoch**, Würstchen für Würstchen, statt alle sechs Sekunden zu springen | A | klein |
| 1 | W-B2 | **Tempo je Esser** („6,5/min“ mit Pfeil gegen die Vorminute) | A | klein |
| 1 | W-B3 | **Schlussminute**: Countdown 10…1 groß, „braucht +X“ im Kopf-an-Kopf-Band, Schlusshupe, Hände hoch | A | klein–mittel |
| 2 | W-B4 | **Hochrechnung** „auf Kurs für N“ plus Tempo-Geist des Führenden im Magen-Meter | A | klein |
| 2 | W-B5 | **Minutenbilanz** als eine Tickerzeile je Minute statt zwölf Einzelzeilen | A | klein |
| 3 | W-B6 | Kopf-an-Kopf-Kamera (Split-Screen der zwei Führenden) | A | mittel |
| 3 | W-B7 | „Zählung wird geprüft“ und die Übergabe des Senfgürtels | B | klein–mittel |

**Empfohlene Reihenfolge:** zuerst die sechs Punkte mit Prio 1 und Aufwand „klein“ (E-B1, S-B1,
S-B2, W-B1, W-B2, W-B3). Jeder ist ein Nachmittag, keiner fasst Wertung oder Takt an. Danach die
drei „Enthüllungen“ (E-B3, S-B4, W-B3/W-B7). Sie sind der eigentliche Fernsehmoment jeder dieser
Sendungen und die größte Lücke im heutigen Bild. Die Zeitlupe (E-B4) kommt zuletzt: sie ist der
teuerste Einzelposten, aber auch der, den jeder Eiskunstlauf-Zuschauer sofort erkennt.

---

## 1. Was heute zu sehen ist (Ist-Stand im Code)

### 1.1 Eiskunstlauf

| Element | Wo | Befund |
|---|---|---|
| Spotlight-Rotation: ein Paar auf dem Eis, Startbereich und Kiss & Cry an der rechten Bande | `stepKuer()` `:16429`, `zeichneDuett()` `:19887` | gut, ISU-Format |
| Zwischenstand-Tafel links (Rang, Namen, Punkte, Elementkästen je Läufer) | `zeichneEisStand()` `:19804` | gut. **Die Kästen kennen aber nur grün/rot** (`:19877 f.`): der seit PR #1034 vorhandene Wackler (`r.knapp`) erscheint dort als Sturz |
| Elementnamen im Ticker (Doppelaxel … Kombinationspirouette) | `KUER_ELEMENTE` `:16278`, Feed-Zweig `BB().duett` (`:16076`) | gut. **Auf dem Eis selbst steht kein Elementname**, auch kein Kürzel |
| Sturz gegen Wackler: flache Kippung 0,4 statt 1,15, eigener Klang | `KUER_KNAPP_ANTEIL` `:16298`, `zeichneDuett()` `:19988` | gut, aber nur solange die Pose andauert |
| Bandenlicht in Führungsfarbe, Vorsprungsbalken an der oberen Bande | `bodenEis()` `:18093–18128` | gut (Runde 2, 2a/2c) |
| Eis-Halo mit Referenz „Führender bei gleichem Elementstand“ (Runde 2, 2b) | nicht vorhanden | **offen** |
| Kiss & Cry | Monitor 64 px mit der Summe, `:20062–20073` | **Das ist keine Enthüllung.** Die Summe stand zehn Sekunden lang live am Namensetikett und in der Tafel. Der Monitor wiederholt sie nur. Es gibt keinen Rang und keine Aufschlüsselung |
| Punkte-Schweber „+53“ | `:20075–20101` | vorhanden, gedeckelt auf `H*0.27` (wegen des Bugs) |
| Wiederholung, Zeitlupe | nirgends im Motor (`grep Zeitlupe/REPLAY`: kein Treffer im Bühnenteil) | **fehlt** |

### 1.2 Showcase

| Element | Wo | Befund |
|---|---|---|
| Vorhang, Rampenlicht, Backstage-Silhouetten, Vignette, Act-Posen und Requisiten | `bodenShowcase()` `:17652`, `zeichneShowcase()` `:19573` | stark (Bewegungs-Audit: solide) |
| Jury-Pult mit **drei** Buzzern | `showcaseBuzzerPos()` `:17648` | Bei einem Fehlschlag leuchtet **ein zufälliger** Knopf (`cypherHash`) 0,5 s rot auf und erlischt (`:19659–19672`). Das Licht zählt nicht mit, es bleibt kein X stehen |
| Applaus-Ring nach einem gelungenen Durchgang | `:19673–19681` | ein Ring für 0,5 s, **keine Stärke** (ein 40er und ein 95er Durchgang sehen gleich aus) |
| Name, Act-Schild, „412 Pkt“, Balken, „3/5“ | `:19624–19649` | vorhanden |
| Rangliste oder Führung im Bild | nicht vorhanden | **offen.** Wer führt, steht nur in der Wertungstabelle unter der Bühne und im Score-Bug |
| Moment vor dem Ergebnis, Jury-Urteil, goldener Buzzer | nicht vorhanden | **offen.** Der nächste Act gleitet sofort herein (`showcaseZielPos`, τ 0,45 s) |

### 1.3 Wettessen

| Element | Wo | Befund |
|---|---|---|
| Ein Tisch zum Publikum, Fähnchen, Latz, Tellerstapel, Kau-/Schling-Wipper | `zeichneWettessen()` `:18881`, `stepWettessen()` `:17448` | gut (Gegencheck S1) |
| Wendetafel in Würstchen je Esser | `zeichneWettessenTafel()` `:18871`, Skala `:18841` | Sie **springt einmal je Spielminute**, also alle 6 s um den ganzen Minutenwert. Dazwischen steht sie still |
| Kopf-an-Kopf-Band oben (die zwei Führenden, Abstand) | `zeichneWettessenBand()` `:19031` | gut, rein textlich |
| 10:00-Uhr, ab 1:00 rot | `zeichneWettessenUhr()` `:19064` | vorhanden. Die letzte Minute ist **nur rot**, sonst passiert nichts |
| Magen-Meter mit Gabel des Führenden | `:18991–19010` | zeigt Minutenfortschritt, **kein Tempo** |
| Spotlight auf die zwei Führenden | `:18896–18902` | gut |
| Ticker | generischer Zweig `:16097`: **eine Zeile je Esser und Minute** | bei 6 gegen 6 laufen **zwölf Zeilen im selben Frame** durch. Das ist Protokoll, keine Erzählung |

---

## 2. Eiskunstlauf: Olympia- und WM-Übertragung

### 2.1 Vorbild: was die Übertragung zeigt

* **Die Ecke oben links: „L“ und „C“.** Die Weltbild-Grafik (ISU/OBS, von NBC übernommen) zeigt
  oben links den **Leader (L)** und den **Current skater (C)** übereinander. Beim laufenden Läufer
  steht der laufende TES. Daneben liegen farbige Kästen je geplantem Element: grün sauber, rot
  gestürzt oder abgewertet. Diese Tafel ist schon gebaut (`zeichneEisStand`). **Es fehlt die
  direkte Gegenüberstellung** „liegt der Läufer gerade über oder unter dem Führenden?“, die NBC
  in genau dieser Ecke zeigt.
* **Elementkürzel und GOE.** Der technische Panel ruft jedes Element mit ISU-Kürzel aus: `3Lz`,
  `4T+3T`, `CCoSp4`, `StSq3`, `ChSq1`. Die Ausführungsnote (GOE, −5…+5) färbt das Element.
  Für abgewertete Sprünge gibt es eigene Zeichen: `<` unterdreht, `q` Viertel, `e` falsche Kante,
  `F` Sturz. Den Zuschauern ist dieses Alphabet vertraut.
* **Kiss & Cry.** Das ist die bekannteste Regie-Sequenz des Sports: Programmende, Verbeugung,
  Fahrt zur Bank. Die Wiederholungen laufen, **während** das Paar wartet. Dann kommt „The scores,
  please“. Die Tafel klappt auf: Element-Score, Komponenten-Score, Abzüge, Segment-Gesamt. Danach
  folgt **„Current place: 1“**, und die Kamera fängt die Reaktion ein. Die Punktzahl ist in dieser
  Sequenz **neue Information**. Die Komponenten (PCS) kennt vorher niemand.
* **Zeitlupe.** Jeder Sturz und jeder große Sprung wird in der Kiss-&-Cry-Wartezeit in Zeitlupe
  wiederholt, oft aus zwei Perspektiven. Seit Peking 2022 blendet Omega zu Sprüngen **Höhe, Weite
  und Luftzeit** ein, gemessen mit sechs Kameras und KI-Tracking (Axios, 17.02.2022).

### 2.2 Vorschläge

#### E-B1: Elementkästen mit Kürzel und drei Farben (Prio 1, A, klein)

* `KUER_ELEMENTE` bekommt je Eintrag ein Feld `kuerzel`: `2A, 3Lz, SSp, 3F, StSq, 3Lo, 3T, SSp, 3S,
  3Lz+2T, ChSq, CCoSp`. Die Namen bleiben für den Ticker.
* Die Elementkästen in `zeichneEisStand()` (`:19875–19880`) bekommen eine **dritte Farbe**:
  `r.knapp` wird bernsteinfarben mit einem kleinen `<`, ein echter Sturz bleibt rot mit `F`. Das
  Feld liegt seit #1034 vor und wird dort nur noch nicht gelesen. Pirouette, Schritte und Choreo
  im Fehlschlag zeigen ebenfalls bernstein, weil sie im Sport keine Stürze sind. Der Kommentar
  bei `:19862` fürchtete, eine dritte Farbe färbe „fast jeden Kasten bernstein“. Diese Sorge galt
  einer **Paar-Mischfarbe**. Hier bleibt es bei einer Reihe je Läufer, nur die Fehlschlagfarbe
  wird geteilt.
* Auf dem Eis steht das Kürzel des gerade laufenden Elements **klein über dem Punkte-Schweber**,
  z. B. `3Lz +71` oder `3Lz< +40`. Dafür verlängert sich nur der Text des Schwebers, keine neue
  Anzeige kommt dazu.

Nutzen: der Zuschauer liest „unterdreht“ und „gestürzt“ auseinander, ohne im Ticker zu suchen.
E0 aus dem Review ist damit erst im Bild angekommen und nicht mehr nur im Ticker.

#### E-B2: „L/C“-Vergleich und Eis-Halo (Prio 1, A, klein–mittel)

* **Gleiche Referenz für beides:** `kuerReferenzBei(k)` = Summe des Führenden (gleiche Sortierung
  wie `kuerZwischenstandZeilen()` `:19762`) über **seine ersten k+1 Elemente**. Gelesen wird nur
  `runden[0..k]` einer Gruppe, die ganz enthüllt ist, die Spoiler-Regel ist also eingehalten.
* **Tafel:** unter der Kopfzeile „ZWISCHENSTAND“ eine Zeile `L 812 · C 790 (−22)` bei
  gleichem Elementstand. Grün, sobald C vorn liegt. Das ist die NBC-Ecke.
* **Eis:** der Halo aus Runde 2 (b) am Kufenpunkt (`zeichneEisstaub`-Stelle). Er ist groß und
  teamfarben, solange das laufende Paar über der Referenz liegt, und klein und grau darunter.
  Beim Wechsel über die Referenzlinie blinkt er kurz auf, nach Regel 7 („Änderung signalisieren“).
* Vor der ersten fertigen Gruppe gibt es keine Referenz. Dann steht keine Zeile da und kein Halo
  ist zu sehen.

Das ist der Vorschlag mit dem besten Verhältnis von Nutzen zu Aufwand für Chris' Befund „für wen
läuft es gut“. Der Vorsprungsbalken beantwortet das je **Team**, E-B2 je **Paar im Moment**.

#### E-B3: Kiss-&-Cry-Enthüllung (Prio 1, A, mittel)

Heute ist die Kiss-&-Cry-Zahl längst bekannt. Vorschlag in drei Stufen, alle in der Rolle
`"kiss"` (`stepKuer` `:16457`). Das Paar sitzt dort ohnehin etwa eine volle Programmdauer
(12 × 2 × 0,425 s ≈ 10 s). **Der Takt wird nicht verändert.**

1. **0–1,2 s „WERTUNG FOLGT …“**: der Monitor pulsiert, das Paar ist klein im Bild.
2. **1,2–3 s Aufschlüsselung:** drei Zeilen erscheinen nacheinander, im Stil der ISU-Tafel.
   *Elemente* (Summe der Durchgangspunkte ohne Publikumsterm), *Ausstrahlung* (Summe der
   Publikumsterme `PUBLIKUM·0,12`) und *Gesamt*. Beide Teile entstehen im Durchgangswurf ohnehin
   (`:14231–14238`). Damit das eine Anzeige bleibt, legt man sie als `r.pub` ab. Das ist
   **A′**, der `knapp`-Präzedenzfall. Wer den Rechner nicht anfassen will, zeigt nur *Gesamt*
   und *Stürze n*, dann bleibt es A.
3. **ab 3 s Plakette „PLATZ 2“** in Teamfarbe, dazu Klang (`publikum` existiert im
   `TON_KATALOG.eiskunstlauf`). **Die Zeile rutscht in der Tafel sichtbar an ihren Platz**: eine
   0,4-s-Animation der Y-Position statt eines harten Sprungs. Das ist das F1-Signal „Position
   gewechselt“.

Offene Designfrage: echte Spannung entsteht nur, wenn die Zahl **vorher nicht sichtbar** war. Die
starke Fassung würde während des Programms nur „Elemente“ live zeigen und die Ausstrahlung erst
im Kiss & Cry zuschlagen, so wie der TES live läuft und der PCS erst in der Wertung kommt. Das ist
immer noch Anzeige. Es müssten aber **alle** Stellen, die `u.summe` zeigen, konsistent
zurückhalten: Etikett, Tafel, Balken, Bug `#score` (`updateHudBuehne` `:17552`) und
Wertungstabelle. Sonst verrät eine Stelle, was die andere verbirgt. **Empfehlung: erst die
schwache Fassung (Stufen 1–3 ohne Zurückhalten).** Die starke Fassung zusammen mit E1 aus dem
Review angehen, wenn die Komponenten ohnehin eine eigene Säule werden.

#### E-B4: Zeitlupen-Wiederholung als Bild-im-Bild (Prio 2, A, mittel)

* **Aufzeichnen:** `stepKuer()` schreibt für das Paar auf dem Eis je Frame (oder mit 30 Hz) einen
  Ringpuffer `vizReplay = [{t, x, y, phase, phaseT, sturz, wackler, versatz}]` je Partner. Das
  sind 10 s × 30 Hz × 2, also rund 600 kleine Einträge. Nach dem `viz*`-Vertrag (`:16109 ff.`)
  ist das erlaubt: nur neue Anzeigefelder, kein `rr()`.
* **Auswahl, deterministisch:** das Element, an dem `buehneAuftrittBig()` für dieses Paar gefeuert
  hat. Das ist die schon kalibrierte Regel: Führender stürzt, Führung übernommen, letztes Element
  des Führenden. Sonst der Sturz mit dem größten Punktverlust. Ohne Sturz das Element mit den
  meisten Punkten.
* **Abspielen:** während der Rolle `"kiss"` ein Kasten etwa 30 % × 22 % der Fläche rechts oben
  (Lage per Playwright-Bild gegen Startbereich, Bug und Schweber-Deckel `H*0.27` prüfen). Mit
  `ctx.save()/clip()/scale()` werden dieselben Zeichenschritte wie in `zeichneDuett()` für die
  gepufferten Frames wiederholt, mit **0,4-facher** Geschwindigkeit. Das 1,4-s-Element dauert
  dann 3,5 s und passt bequem in die etwa 10 s Kiss-&-Cry-Zeit. Dazu ein Wisch-Übergang und das
  Etikett „WIEDERHOLUNG · 3Lz“. **Kein Vollbild**, weil das nächste Paar schon läuft. Ein
  Vollbild-Replay mit angehaltenem Programm wäre Klasse B und kostete je Paar 3–4 s.
* Hinweis: die Sprite-Animation in `zeichneSprite()` richtet ihr Bild nach der globalen Uhr. Für
  eine echte Zeitlupe muss der Aufruf die Replay-Zeit als Animationszeit bekommen, sonst
  „zappelt“ die Figur in normalem Tempo durch eine langsame Bahn. Das ist vor dem Bau zu prüfen.

#### E-B5: Sturzmarke auf dem Eis (Prio 2, A, klein)

An der Stelle eines echten Sturzes (nicht bei einem Wackler) bleibt bis zum Programmende eine
kleine Kratzmarke (zwei gekreuzte graue Striche, 30 % Deckkraft) auf dem Eis liegen. Die Kufenspur
blendet aus, die Marken bleiben. Man sieht auf einen Blick, wie viele Stürze dieses Paar hatte,
ohne die Tafel zu lesen. So verstärkt E-B5 Regel 5 („Grafik im Spielraum“). Beim Programmwechsel
wird das Feld geleert.

#### E-B6: Sprung-Analytics nach Omega-Vorbild (Prio 3, A′, klein–mittel)

Bei sauber gelandeten Sprungelementen (`typ:"sprung"`) erscheint am Landepunkt 1,2 s lang
`Höhe 0,58 m · Luft 0,66 s · Weite 3,1 m`. **Wichtig: die Zahlen dürfen nicht erfunden sein.** Sie
werden monoton aus dem tatsächlichen Bonusanteil des Durchgangs abgebildet
(`SPITZENMOMENT·0,35·buehneWagnisFaktor`, `:14231`). Dafür wird er wie in E-B3 als `r.bonus`
abgelegt (A′). Wer mehr Bonus holt, springt höher, und so wird die Matrix sichtbar. Die Skala
wird an realen Werten ausgerichtet: Elite-Dreifach etwa 0,5–0,7 m hoch und 0,6–0,7 s in der Luft.
Prio 3, weil hübsch, aber nicht nötig. Ohne `r.bonus` die Zahl lieber weglassen, statt einen Hash
zu zeigen.

---

## 3. Showcase: America's Got Talent und The Voice

### 3.1 Vorbild: was die Übertragung zeigt

* **Das rote X.** Ein Juror drückt den Buzzer, und über der Bühne leuchtet **sein** großes rotes X
  auf, dauerhaft bis zum Ende der Nummer. Wenn alle drücken, ist die Nummer vorbei. Die Spannung
  entsteht aus dem **Zählen**: „zwei X, hält er durch?“.
* **Der goldene Buzzer.** Einmal je Juror und Staffel. Goldenes Licht, Konfettiregen, Fanfare,
  der Moderator läuft auf die Bühne. Seltenheit ist das ganze Konzept (NBC: „What is the Golden
  Buzzer“).
* **Reaktionsgesichter.** Die Regie schneidet laufend auf die Jury: Simon hebt die Augenbraue,
  Heidi springt auf. Die Reaktion *ist* die Bewertung, lange bevor eine Zahl fällt.
* **Publikum.** Stehende Ovationen, Schwenks über die Ränge. Früher gab es den „Clapometer“
  (Opportunity Knocks, Britain's Got Talent), einen Zeigerausschlag nach Lautstärke.
* **The Voice:** Die Coaches sitzen mit dem Rücken zur Bühne. Wer drückt, dreht sich um, und der
  Stuhlsockel leuchtet „I WANT YOU“. Die Zahl der gedrehten Stühle ist die Note, die jeder
  versteht (Wikipedia, *The Voice*).
* **Die Pause vor dem Ergebnis.** In den Entscheidungsshows stehen zwei Acts im Spot,
  Trommelwirbel, Licht aus, Lichtkegel schwenken. Erst dann landet ein Spot auf dem Weiterkommenden.

### 3.2 Vorschläge

#### S-B1: X-Wand zählt mit (Prio 1, A, klein)

* Heute leuchtet bei jedem Fehlschlag **ein zufälliger** der drei Knöpfe 0,5 s. Stattdessen: der
  n-te Fehlschlag **dieses Acts** zündet Buzzer n (links nach rechts) **dauerhaft**, bis der Act
  abtritt. Gezählt wird aus `aktiver.runden[0..aktuell]` gegen `failWort`, deterministisch und
  ohne `cypherHash`.
* Zusätzlich über jedem Knopf ein großes, dünnes rotes „X“ an der Rückwand (unter dem Vorhang,
  `H*0.16`). Das ist das AGT-Bild.
* Beim **dritten** X: die Rückwand wird 0,6 s rot geflutet, Klang `buzzer` doppelt. Die Nummer
  **läuft weiter**. Ein Abbruch wäre der Jury-Abbruch aus Review S4, also Klasse C. Bei fünf
  Durchgängen und der heutigen Fehlschlagquote kommt der dritte Fehlschlag selten genug vor, um
  ein Moment zu bleiben (nachzählen, Ziel unter etwa 15 % der Acts).

#### S-B2: Applaus-Meter (Prio 1, A, klein)

* Ein senkrechter Zeiger- oder Balkenmesser neben der Bühne (rechts, zwischen Vorhang und
  Backstage-Spalte). Sein Ausschlag nach jedem Durchgang entspricht `r.punkte` relativ zur
  Spanne aller **bisher enthüllten** Durchgänge des Spiels (min…max). Er schnellt hoch und
  klingt in 1,5 s ab.
* Eine **goldene Marke** hält den bisher höchsten Einzeldurchgang des Spiels fest
  („TAGESBESTWERT“). Wer sie überschreitet, bekommt einen Gold-Blitz am Meter.
* Der Applaus-Ring (`:19673`) bleibt, bekommt aber eine Stärke: Radius und Ringzahl aus
  demselben Ausschlag. Ein 95er Durchgang sieht dann anders aus als ein 40er.

#### S-B3: „Top 3 bisher“ und Führungsfarbe (Prio 1, A, klein–mittel)

* Eine kleine Canvas-Tafel oben links unter dem Vorhang, im Stil von `zeichneEisStand`: die drei
  bisher besten Acts (Name, Act-Kürzel, Punkte, Teamstrich). Dazu **eine** Zeile für den gerade
  Auftretenden mit „läuft · 212“ und seinem Rang, falls er jetzt aufhörte. Nur fertige Acts
  werden gewertet, das hält die Spoiler-Regel.
* Der goldene Zierstrich unter dem Vorhang (`:17681 f.`) übernimmt die Farbe des Teams mit der
  höheren enthüllten Summe. Das ist das Bandenlicht-Muster aus `bodenEis()`, mit derselben
  Überblendung beim Wechsel.
* Das ist Runde 2, Vorschlag 2, „dasselbe Muster für die anderen Bühnen-Auftritte“, und Chris'
  „ohne Stats sehen, wer führt“ für Showcase.

#### S-B4: Urteilsmoment mit Jury-Stühlen (Prio 2, A oder B, mittel)

Nach dem letzten Durchgang eines Acts:

1. Licht aus bis auf den Spot (die Vignette verstärkt sich), **Trommelwirbel** (neuer Eintrag
   `trommel` in `TON_KATALOG.showcase`).
2. **Drei Jury-Stühle** (am Pult, einfache Rückenlehnen-Silhouetten) drehen sich nacheinander um,
   einer je 0,25 s. **Wie viele**, kommt aus dem Rang des Acts unter allen fertigen: oberes
   Drittel drei, Mitte zwei, sonst einer oder keiner. Der Sockel leuchtet „JA“. Das ist ein
   Urteil, das jeder liest, ohne eine Zahl zu kennen. Es wiederholt nur den Rang (A).
3. Plakette „PLATZ n · 412 Pkt“ in Teamfarbe.

**Variante A (empfohlen):** die Sequenz läuft 1,5 s als Überblendung, **während** der nächste Act
hereingleitet. Den ersten Durchgang des nächsten Acts sieht man erst danach. Das ist rein
zeichnerisch, die Zeit liegt in der ohnehin laufenden Gleitphase. **Variante B:** eine echte
Pause von 1,5 s zwischen den Acts im Enthüllungstakt (`buehneAkt`). Das bringt mehr Dramaturgie,
aber 12 × 1,5 s = 18 s mehr gegen das ~60-s-Ziel, und der Takt wird angefasst. Nur mit Chris'
Zustimmung.

#### S-B5: Goldener Buzzer als Bildereignis (Prio 2, A, klein)

* **Regel, deterministisch und nur aus Enthülltem:** höchstens einmal je Spiel, für den ersten Act,
  der (a) alle fünf Durchgänge fehlerfrei steht **und** (b) mit seiner Endsumme alle bisherigen
  Acts übertrifft, frühestens ab dem vierten Act. Die Regel ist selten und nie vorab bekannt:
  ein späterer Act kann den Gold-Act noch überholen, genau wie im Original.
* Bild: der mittlere Pult-Knopf wird gold, goldenes Licht flutet die Bühne, Konfetti-Partikel
  (Canvas-Rechtecke, Farbhash aus `u.id`, **kein** `rr()`), Callout „GOLDENER BUZZER — Name“ über
  `feed(…,true)`.
* **Kein Punktbonus.** Die Fassung mit Bonus ist Review S4, also Klasse C.

#### S-B6: Jury-Reaktionskacheln (Prio 3, A, mittel)

Drei feste Juroren-Figuren (über `zeichneSprite()` aus drei festen Bauplänen, kein neues Asset)
sitzen am Pult. Bei einem Big-Moment (`buehneAuftrittBig`) schneidet die Regie 0,8 s lang auf
einen **Split-Screen-Streifen** am unteren Rand mit den drei Köpfen vergrößert. Die Pose kommt aus
dem Ergebnis: Erfolg heißt Arme hoch (`shoot`-Pose), Fehlschlag heißt Kopf gesenkt (`hurt`-Pose),
dazu Symbolblasen (Herz, Fragezeichen, X) als Vektorformen. Prio 3, weil S-B1/S-B4 den größten
Teil derselben Information schon tragen.

---

## 4. Wettessen: Nathan's Famous Hot Dog Eating Contest (ESPN)

### 4.1 Vorbild: was die Übertragung zeigt

* **Die Wendetafel.** Hinter jedem Esser hält ein eigener Zähler eine Klapptafel und blättert
  **bei jedem Würstchen** um. Das Bild ist ständig in Bewegung, der Zähler ist der Puls der
  Übertragung (Gegencheck 23.09., Abschnitt 1.1).
* **Tempo und Hochrechnung.** Kommentar und Grafik sprechen ständig über Tempo: 2021 hatte
  Chestnut nach drei Minuten 30 Würstchen, „on pace“ für seinen Rekord (76). 2026 hatte er nach
  fünf Minuten 42 (ESPN; CBS 2021). Der Rekordtakt 2021 liegt bei einem Würstchen alle
  7,9 Sekunden. **Die Übertragung erzählt über den Vergleich mit einer Referenz**: Vorjahr,
  Rekord oder der Rivale.
* **Die letzte Minute.** Die Uhr läuft groß, das Publikum zählt die letzten zehn Sekunden mit.
  Danach „Hände hoch“, und **was noch im Mund ist, zählt, wenn es geschluckt wird**
  („chipmunking“). Danach prüfen die Kampfrichter die Zählung, bevor das Ergebnis offiziell ist.
  2021 fiel ESPNs Bild genau in den letzten 15 Sekunden von Chestnuts Rekord aus, und der
  Proteststurm zeigt, **wie sehr die Schlussphase der Kern der Sendung ist** (SI, 04.07.2021).
* **Zwei Favoriten im Bild.** Die Übertragung erzählt über zwei, drei Namen, die übrigen sind
  Kulisse. Das Kopf-an-Kopf-Band ist gebaut.
* **Der Senfgürtel** für den Sieger (gelb, pink bei den Frauen) als Schlussbild.

### 4.2 Wichtiger Befund zum Takt

Der Motor enthüllt **eine ganze Spielminute auf einmal**: `buehneGruppenGroesse`, alle Esser im
selben Tick (`stepBuehne` `:15920 ff.`). `u.summe` springt also zu Beginn der Minute um den ganzen
Minutenwert. Danach stehen sechs Sekunden Bildschirmzeit zur Verfügung, in denen nur die Uhr und
die Kau-Phasen laufen. **Die Anzeige kann diese sechs Sekunden füllen, ohne die Wertung zu
berühren.** Das ist der Hebel für W-B1 bis W-B3.

### 4.3 Vorschläge

#### W-B1: Wendetafeln zählen live hoch (Prio 1, A, klein)

* Eine Hilfsfunktion `wettessenAnzeigeSumme(u)` = `vorher + r.punkte·f`, dabei ist
  `vorher = u.summe − u.runden[u.aktuell].punkte` und `f` der Fortschritt der laufenden Minute
  (genau der Wert, den `zeichneWettessenUhr()` `:19067 f.` schon rechnet). Umgerechnet über
  `wettessenWuerstchen()` klappt die Tafel **je halbes Würstchen einmal um**, als kurze
  Klapp-Animation am vorhandenen Falz (`:18875`) und mit leisem Klick.
* Eine „muss kurz pausieren“-Minute bringt nur `basis·0,65`. Die Tafel blättert dann sichtbar
  langsamer. **Das Kau-Tempo wird so zur Bewegung auf der Tafel, ohne dass eine Zahl nötig ist.**
* **Konsistenz:** dieselbe Hilfsfunktion speist Band, Magen-Meter und für Wettessen auch `#score`
  im Bug. Sonst zeigt der Bug schon den Minutenendstand, während die Tafeln noch zählen.
  Wertungstabelle und Endstand bleiben bei `u.summe`.
* Nach `done` gilt `f = 1`, danach zeigt alles den Endstand.

#### W-B2: Tempo je Esser (Prio 1, A, klein)

Unter der Wendetafel steht klein „6,5/min“: die Würstchen der zuletzt **abgeschlossenen** Minute,
dazu ein Pfeil ▲ oder ▼ gegen die Minute davor, grün oder rot. Im Kopf-an-Kopf-Band steht das
Tempo beider Führenden, daneben „holt auf“ oder „fällt zurück“, wenn sich der Abstand in der
letzten Minute um mindestens ein Würstchen verändert hat. Das ist die „Kau-Tempo-Anzeige“, aus
`runden[0..aktuell]` gelesen.

#### W-B3: Schlussminute (Prio 1, A, klein–mittel)

* Ab `restSek ≤ 60`: das Band wechselt auf „LETZTE MINUTE“. Der Zweite bekommt eine Zeile
  **„braucht +3,5“**, den Abstand zum Führenden in Würstchen. Die Zeile kommt aus dem Stand nach
  Minute 9, gerechnet vor der Enthüllung der letzten Minute, also ohne Spoiler.
* Ab `restSek ≤ 10`: große Countdown-Ziffern „10 … 1“ in der Bildmitte über dem Tisch, jede
  mit kurzem Puls. Die Uhr bekommt einen roten Ring. Die Publikumssilhouetten (falls
  `bodenWettessen` welche bekommt) wippen im Takt.
* Bei 0:00 **Schlusshupe** (neuer Eintrag `hupe`) und alle Esser in „Hände hoch“-Pose, 1 s
  lang die `shoot`-Pose, das Muster aus der Showcase-Zaubershow. Die Pose läuft nach `done`
  weiter, weil `buehnenBewegung()` nach dem Abschluss weiterläuft (`stepBuehne` `:15894`,
  N-Fix-Kommentar).

#### W-B4: Hochrechnung und Tempo-Geist (Prio 2, A, klein)

* Im Band unter dem Führenden „auf Kurs für 62“, gerechnet als `summe/min·10` in Würstchen.
  Das ist die „on pace“-Zeile der ESPN-Übertragung.
* Im Magen-Meter (`:18991`) ein zweiter, blasser Marker: der **Tempo-Geist**, also wo der
  Führende nach seinem aktuellen Tempo am Ende stünde. So wird die Gabel zur Referenzlinie.
* Die echte Weltrekordzahl (76) **nicht** einblenden. Unsere Skala liegt bei einem Median um 40
  und Spitzen um 59, eine Rekordlinie bei 76 wäre nie erreichbar und damit bedeutungslos. Als
  Referenz eignet sich der **Tagesbestwert der Liga** nur, wenn es eine persistente Quelle dafür
  gibt. Die gibt es im Motor heute nicht, das ist eine offene Frage (Abschnitt 6).

#### W-B5: Minutenbilanz statt zwölf Tickerzeilen (Prio 2, A, klein)

Der generische Feed-Zweig (`:16097`) schreibt je Esser und Minute eine Zeile, bei 6 gegen 6 also
zwölf im selben Frame. Vorschlag: für Wettessen **eine** Zeile je Minute, z. B. „Minute 4: Draco
führt mit 18,5 (+1,5 auf Greenkraut), Tempo 5,0/min“. Die Big-Zeilen aus `buehneAuftrittBig()`
(Führungswechsel, Führender pausiert, letzte Minute des Führenden) bleiben eigene Zeilen. Big
ändert sich also nicht, nur das Protokoll dazwischen wird gebündelt. HIGHLIGHTS und Callout
bleiben identisch, weil sie nur an den Big-Zeilen hängen.

#### W-B6: Kopf-an-Kopf-Kamera (Prio 3, A, mittel)

Zwei kleine Einsätze links und rechts im Band, jeweils ein vergrößerter Ausschnitt eines der zwei
Führenden mit Kau-Wipper und Tellerstapel (`ctx.clip()` und `scale()`, dieselben Zeichenschritte).
Das ist der Split-Screen, mit dem ESPN und Netflix das Duell zweier Favoriten zeigen. Prio 3, weil
Spotlight und Band den Inhalt schon tragen. Es ist nur die schönere Form.

#### W-B7: „Zählung wird geprüft“ und Senfgürtel (Prio 3, B, klein–mittel)

Nach der Hupe folgt 1,5 s „ZÄHLUNG WIRD GEPRÜFT“, erst danach das Endergebnis. Der Sieger bekommt
einen gelben Gürtel (Canvas-Band um die Hüfte des Sprites). Das ist **Klasse B**: das
Endstand-Overlay (`finish()`, `renderEndstand()`) müsste um diese Zeit später kommen.
Wertungsneutral, aber es verändert, wann der Spieler den Endstand sieht.

---

## 5. Was die Wertungslogik berührt (Klasse C): nur benannt, nicht empfohlen

Diese Vorbild-Elemente lassen sich **nicht** als reine Anzeige bauen. Sie gehören in die
Umbauten aus dem Konzeptreview vom 26.09. und unterliegen dort der rho- und Pp-Messpflicht.

| Element | Warum C | Andockpunkt |
|---|---|---|
| Eiskunstlauf: echter Sturzabzug („−1“) | ändert Punkte | Review E1 (PCS getrennt, Sturz kostet das Element plus einen festen Abzug) |
| Eiskunstlauf: Programm-Einblender „geplant: 2 × Vierfach“ | es gibt heute keine Sprungwahl | Review E2. Die Anzeige wäre dann ein Nebenprodukt |
| Eiskunstlauf: Ausstrahlung (PCS) erst im Kiss & Cry | als Anzeige machbar (E-B3, starke Fassung), aber echt erst mit einer eigenen PCS-Säule | Review E1 |
| Showcase: Abbruch nach drei X | beendet die Wertung vorzeitig | Review S4 (nur mit Messung, sonst weglassen) |
| Showcase: goldener Buzzer mit Punktbonus | Bonus | Review S4 |
| Showcase: „Money Moment“ (Höhepunkt-Durchgang zählt mehr) | Gewichtung der Durchgänge | Review S1. S-B2 würde ihn dann am Meter zeigen |
| Wettessen: 5-Würstchen-Stechen bei Gleichstand | neuer Tiebreak | eigene Frage, bei Teamsummen extrem selten |
| Wettessen: Disqualifikation („reversal“) | Wertung | nicht empfohlen, harte Kaskade |

---

## 6. Offene Fragen an Chris, mit Voreinstellung

1. **Kiss & Cry mit oder ohne Zurückhalten der Zahl (E-B3)?** Voreinstellung: ohne. Die Summe
   bleibt live, das Kiss & Cry liefert Rang und Aufschlüsselung. Zurückhalten erst mit Review E1.
2. **Showcase-Urteil als Überblendung oder als echte Pause (S-B4)?** Voreinstellung:
   Überblendung, weil das ~60-s-Ziel bleibt.
3. **Referenzlinie beim Wettessen:** gibt es eine Liga- oder Saisonbestmarke, die der Motor
   lesen dürfte? Voreinstellung: nein. Stattdessen der Tempo-Geist des Führenden (W-B4).
4. **Zeitlupe (E-B4) auch für Showcase-Akrobatik und Breaking?** Der Ringpuffer ist
   disziplinneutral baubar. Voreinstellung: erst Eiskunstlauf, dann entscheiden.

---

## 7. Abnahme für jeden Bauauftrag aus diesem Papier

* **A:** `node scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf showcase wettessen` vorher und
  nachher, Ergebnis auf drei Stellen identisch. Sichtprüfung über das Standalone-Mockup
  (`/mockups/battle-mode.html`, **nicht** `/dev-arena`, s. Runde 2 Abschnitt 1.3) mit drei Saaten.
* **A′:** zusätzlich im Diff belegen, dass die Zahl der `rr()`-Aufrufe im Durchgangswurf gleich
  bleibt. Das neue `runden[]`-Feld darf außerhalb der Anzeige nirgends gelesen werden (Muster
  `knapp`).
* **B:** zusätzlich prüfen, dass `disziplinProbe`/`miss-alle-disziplinen` den Takt nicht in
  Echtzeit abwarten, und die Gesamtdauer eines Spiels vorher und nachher messen.
* **Highlights:** keiner der Vorschläge setzt neue Big-Flags. Ausnahme ist S-B5 (höchstens eines
  je Spiel). Die Zählung aus Runde 2 (`tmp/zaehle-highlights.mjs`) bleibt im Zielband 4–10.
* **Überlappung:** alle neuen Canvas-Elemente gegen Bug (`#bbug`), Schweber-Deckel (`H*0.27`),
  Zwischenstand-Tafel (`W*0.085–0.29`) und die Warte- und Kiss-Plätze (`kuerWarte`/`kuerKiss`)
  im Playwright-Bild prüfen, bei 600 px und bei voller Fensterhöhe.

---

## Quellen

**Code (gelesen, Stand `ebb3b99a`):** `public/mockups/battle-mode.engine.js`:
`BUEHNE_ART.showcase`/`.eiskunstlauf`/`.wettessen` (`:13348`, `:13371`, `:13551`), Durchgangswurf
mit `knapp` (`:14214–14240`), `buehneAuftrittBig()` (`:15882`), `stepBuehne()` (`:15894`),
Feed-Zweige (`:16045–16103`), `KUER_ELEMENTE`/`KUER_KNAPP_ANTEIL` (`:16278`/`:16298`),
`stepKuer()` (`:16429`), `stepWettessen()` (`:17448`), `updateHudBuehne()` (`:17487`),
`bodenShowcase()` (`:17652`), `bodenWettessen()` (`:17750`), `bodenEis()` inkl. Bandenlicht und
Vorsprungsbalken (`:18058–18157`), `zeichneWettessen()`/`-Band()`/`-Uhr()` (`:18881`, `:19031`,
`:19064`), `stepShowcase()`/`zeichneShowcase()` (`:19475`, `:19573`),
`kuerZwischenstandZeilen()`/`kuerEisFuehrung()`/`zeichneEisStand()` (`:19762`, `:19776`,
`:19804`), `zeichneDuett()` inkl. Kiss-&-Cry-Monitor (`:19887`, `:20062`), `callout()`/`feed()`
(`:31606`, `:31662`).

**Dokumente:** `broadcast-praesentation-runde-2-22-09.md`,
`buehne-auftritt-opus-konzeptreview-26-09.md` (Branch `buehne-auftritt-konzeptreview-26-09`),
`ui-bewegungs-audit-26-09.md` (Branch `ui-bewegungs-audit-26-09`),
`wettessen-format-opus-gegencheck-23-09.md`, `showcase-talentshow-konzept-17-09.md`,
`eiskunstlauf-startreihenfolge-spotlight-recherche-13-09.md`.

**Sport und Fernsehen (Web, 27.09.):**

* ISU: [How do you score points in Figure Skating?](https://isu-skating.com/en/figure-skating/news/how-do-you-score-points-in-figure-skating/). TES/PCS, GOE −5…+5.
* [ISU Judging System (Wikipedia)](https://en.wikipedia.org/wiki/ISU_Judging_System). Elementkürzel, Abwertungszeichen.
* [Golden Skate: Please explain the scoring system](https://www.goldenskate.com/forum/threads/please-explain-the-scoring-system.66605/). NBC-Grafik oben links mit Leader (L) und Current (C).
* [Axios, 17.02.2022: AI helps measure the jumps in Beijing's Olympics](https://www.axios.com/2022/02/17/measuring-jumps-beijing-olympics-omega) und [Time and Watches: Omega's technologies and the Winter Games](https://www.timeandwatches.com/2022/02/omegas-technologies-and-winter-games.html?m=0). Sechs Kameras, Höhe, Weite und Luftzeit je Sprung, Heatmaps.
* [NBC Insider: AGT's Golden Buzzer, What It Is](https://www.nbc.com/nbc-insider/what-is-the-golden-buzzer-on-agt) und [Billboard: Light Wire earns Simon Cowell Golden Buzzer](https://www.billboard.com/culture/tv-film/light-wire-agt-audition-simon-cowell-golden-buzzer-1235982345/). Goldenes Licht, Konfetti, rotes X.
* [The Voice (American TV series), Wikipedia](https://en.wikipedia.org/wiki/The_Voice_(American_TV_series)). Stuhldrehung, „I Want You“-Sockel.
* [ESPN: Nathan's Hot Dog Eating Contest 2026, winners and stats](https://www.espn.com/espn/story/_/id/49238604/winners-more-stats). Tempo-Erzählung (42 nach fünf Minuten).
* [CBS News: Joey Chestnut beats own record, 76 in 10 minutes](https://www.cbsnews.com/amp/news/joey-chestnut-hot-dog-eating-contest-winner). 30 nach drei Minuten, „on pace“.
* [Sports Illustrated, 04.07.2021: ESPN broadcast cuts out as Chestnut breaks record](https://www.si.com/extra-mustard/2021/07/04/joey-chestnut-espn-broadcast-cuts-out-nathans-hot-dog-contest). Bildausfall in den letzten 15 s.
* [ESPN: Joey Chestnut eating records](https://www.espn.com/olympics/story/_/id/45631936/joey-chestnut-eating-records). Rekordtakt, ein Würstchen je ~7,9 s.

Werte, die nicht aus einer der verlinkten Quellen stammen, sind aus allgemeiner
Übertragungskenntnis beschrieben. Das gilt für den Ablauf im Kiss & Cry, den Clapometer, das
Chipmunking und die Prüfung der Zählung. Sie dienen als Bildvorlage, nicht als Kalibrierwert.
