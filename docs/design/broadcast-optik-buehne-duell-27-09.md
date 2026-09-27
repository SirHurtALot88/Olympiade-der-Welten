# Broadcast-Optik Bühnen-Duell — Speed-Schach, Fechten, Tennis wie im Fernsehen (27.09.)

**Reine Recherche und Konzept, kein Code.** Stand: `origin/main` `ebb3b99a`. `engine.js` meint
`public/mockups/battle-mode.engine.js`, Zeilen nach diesem Stand.

Baut auf und wiederholt nicht:
`docs/design/broadcast-praesentation-runde-2-22-09.md` (Regeln 1–8 guter Sportgrafik, Score-Bug,
Highlight-Dosis), `docs/design/ui-bewegungs-audit-26-09.md` (Befund „sechs Duelle als
Miniaturübersicht“, daraus PR #1025 mit `duellFokusWaehlen()`) und
`docs/design/buehne-duell-opus-konzeptreview-26-09.md` (Branch `buehne-duell-konzeptreview-26-09`:
Mechanik-Gegencheck, Vorschläge S1–S6, F1–F4, T1–T5). Die Frage hier ist eine andere als im
Konzeptreview: **nicht „rechnet die Mechanik echte Taktik?“, sondern „sieht das, was schon
gerechnet wird, aus wie eine echte Übertragung?“** — und wo die Antwort nur mit einem Eingriff in
die Wertung zu haben ist, steht das ausdrücklich dabei.

---

## 0. Fazit vorweg

Jeder Vorschlag trägt eine von zwei Marken:

* **[Anzeige]** — liest nur, was bereits enthüllt ist (`u.aktuell`, `u.runden[0..aktuell]`,
  `u.verlauf[aktuell]`, `u.treffer`), schreibt nur `viz*`-Felder oder Modulzustand der Regie, ruft
  nie `rr()`. `miss-alle-disziplinen.mjs` muss per Konstruktion bit-identisch bleiben (trotzdem
  vorher/nachher fahren, wie bei jeder Präsentationsrunde).
* **[Wertung]** — nur sinnvoll, wenn die Mechanik sich ändert (Konzeptreview-Vorschläge); braucht
  rho-über-0,80 **und** Pp ≤ 25 neu.

| Disziplin | Top-Vorschlag | Marke | Aufwand | Warum zuerst |
|---|---|---|---|---|
| Speed-Schach | **Zeitnot-Warnfarbe an den Uhren + Regie springt zur Zeitnot** | Anzeige | klein | die Uhr ist schon da und tickt; sie erzählt nur nie „Achtung“ |
| Speed-Schach | **Bewertungskurve unter dem Brett** (Eval-Graph aus `u.verlauf`) | Anzeige | klein | macht aus dem Balken (Zustand) eine Geschichte (Verlauf) |
| Speed-Schach | **Mannschafts-Leiste** (sechs Bretter, Olympiade-Stil `1 · ½ · 0 · …`) | Anzeige | klein | das Teamergebnis ist heute nur „2 : 1“ ohne Brettbezug |
| Fechten | **Trefferlampen rot/grün + Doppeltreffer** | Anzeige | klein | das bekannteste Fechtbild überhaupt; passt zufällig exakt auf die Degen-Regel, die der Motor schon rechnet |
| Fechten | **FIE-Anzeigetafel statt „Treffer · Vorteil · Gang“** (Periode, Gefechtsuhr, Prioritäts-Lampe) | Anzeige | klein | seit F1 konkurrieren zwei Zahlen um die Führung; die Tafel zeigt nur noch die eine, die entscheidet |
| Fechten | **Klingenspur** (Fencing-Visualized-Muster) | Anzeige | mittel | macht den halbsekündigen Ausfall erst lesbar |
| Fechten | Zeitlupen-Wiederholung als Bild-im-Bild | Anzeige | mittel–groß | echte Konvention, aber erst nach 1–3 |
| Tennis | **Platz zeichnen** (Hartplatz, Netz, Linien) | Anzeige | klein | heute schlagen zwei Figuren auf der generischen Bühne Bälle — ohne Platz liest sich nichts als Tennis |
| Tennis | **Hawk-Eye-Ballspur + Aufsprungmarke, Fehlschlag als „Netz“ oder „Aus“** | Anzeige | klein–mittel | das Signaturbild jeder Grand-Slam-Übertragung |
| Tennis | **Aufschlaggeschwindigkeit** (km/h-Einblendung) | Anzeige | klein | die eine Zahl, die jeder Tennis-Zuschauer nach dem Aufschlag erwartet |
| Tennis | Ballwechsel-Leiste statt Spielstand-Baum | Anzeige | klein | ehrlicher Ersatz, solange es keinen Nullsummen-Punkt gibt |
| Tennis | **Spielstand-Baum (Sätze/Spiele/Punkte), Breakball-/Matchball-Banner** | **Wertung** | groß | nur mit T1+T2 aus dem Konzeptreview — als reine Anzeige würde er dem Brettsieger widersprechen (Abschnitt 6.5) |

Querschnitt für alle drei (Abschnitt 3): **eine** Verlaufskurven-Hilfsfunktion, **eine**
Mannschafts-Leiste, **eine** Spielerkachel mit Porträt als „Spieler-Kamera“. Empfohlene
Reihenfolge in Abschnitt 8.

---

## 1. Was heute zu sehen ist (Code gelesen, nicht vermutet)

Gemeinsam: alle drei laufen über `spieleBuehneDuell()`; die Reihenfolge der Enthüllung ist
Durchgang für Durchgang, innerhalb eines Durchgangs Brett für Brett, **Heim i direkt vor Gast i**
(`buehneQueue`, `engine.js:14478 ff.`). Ein Brett bekommt also alle ~6 s (12 Enthüllungen × 0,5 s)
einen Doppelschlag aus zwei direkt aufeinanderfolgenden Enthüllungen — das ist der Takt, in dem
jede Grafik unten „Ereignisse“ hat. `rundenDauer` = 0,5 s (Schach, Tennis), 0,556 s (Fechten).

| Element | Speed-Schach (`zeichneSchach`, `:20644`) | Fechten (`zeichneFechten`, `:18514`) | Tennis (`zeichneTennis`, `:18373`) |
|---|---|---|---|
| Nahansicht | Fokus-Brett, 3-s-Regie auf den knappsten Vorteil, Pin per Klick | seit #1025: `duellFokusWaehlen()` (`:18344`), springt sofort auf ein Brett mit laufender Aktion | dito |
| Spielfeld | Tisch + Brett (Primitiven), Figurensprites, Gleitanimation, Zugpfeil | FIE-Bahn: Mittellinie, En-garde-Linien, rote Endlinien — nur am Fokus | **keins** — generischer `bodenBuehne()` (`:17582`, Podest + Scheinwerfer) |
| Stand im Bild | großes „2 : 1“ (gewonnene Bretter) oben | Kopfzeile „Treffer 5:4 · Vorteil +38 · Gang 4/9“ | „+38 Vorteil“ unter jedem Spieler |
| Uhr | zwei Schachuhren über dem Brett, aktive hell, tickt weich (`vizUhrAnzeige`, `:17040`) | — | — |
| Führung | Bewertungsbalken links (lichess-Art), Tauzieh-Versatz der Spieler | Tauzieh-Versatz auf der Bahn | — |
| Aktion | Zugpfeil, `!`/`?!` am Zielfeld, Zugliste (8 Halbzüge) | Ausfall/Erholung/Parade (`stepFechten`, `:17085`), Klingenfunke bei Treffer | Ausholen → Ballflug (Bogen) → Treffer/„bleibt auf halber Strecke liegen“ (`stepTennis`, `:17201`) |
| Ende | Siegerrahmen + Königs-Glow, „SIEG — …“ | Ticker „gewonnen (Priorität nach Treffergleichstand)“ | — |
| Übrige Bretter | Mini-Bretter mit `+v · Zug n/10` und Vorteilsstrich | Mini-Bahnen „Bahn 3 · 4:2“ | Mini-Figuren ohne Stand |
| Score-Bug `#bbug` | „2 : 1 · 0:41“ — Teamnamen, gewonnene Bretter, Uhr (`aktualisiereBbug`, `:12368`) | dito, Fechten zählt `gefechtSieg` (`:17539`) | dito |

Zwei Befunde, die jede neue Grafik kennen muss:

1. **`u.vorteil` ist der Endwert, nicht der laufende.** Er steht nach `bauBuehne()` fest. Für
   eine Anzeige gilt ausschließlich `u.verlauf[u.aktuell]` (so macht es der Bewertungsbalken
   richtig, `:20795`). Bestehende Skalierungen lesen `vorteil` bereits als Maximum
   (`maxV` in `zeichneSchach` `:20796`, `maxVorteil` in `zeichneTennis` `:18378`) — ein kleines
   Spoiler-Leck (die Balkenskala verrät, wie deutlich irgendein Brett am Ende ausgeht), nicht
   dramatisch, aber neue Grafiken sollen es nicht kopieren.
2. **`gefechtSieg`/`prioritaet`/`gefechtGleichstand` stehen ebenfalls ab dem Bau fest**
   (`:14326 ff.`, Los vorab je Gefecht). Eine Prioritäts-Anzeige darf sie erst zeigen, wenn beide
   Fechter ihren letzten Gang enthüllt haben.

---

## 2. Recherche: was echte Übertragungen zeigen

Diese Runde hatte Websuche (Runde 2 am 22.09. nicht); Quellen am Ende. Wo eine Konvention
allgemein bekannt ist und keine Quelle gefunden wurde, steht „Konvention“.

### 2.1 Schach (Blitz/Bullet: Champions Chess Tour, Titled Tuesday, PogChamps, Freestyle Chess)

| Element | Was es leistet | Quelle |
|---|---|---|
| **Bewertungsbalken** neben dem Brett | Wer steht besser, ohne Zahl — der Standard seit chess24/Chess.com; Chess.com liefert für Streams eine „kompakte Ansicht“ aus Brett, Spielerboxen, Uhren und Eval-Balken zum Zuschneiden | Chess.com Events-Broadcast-Guide |
| **Bewertungsgraph** über die Partie | „grafische Darstellung der Engine-Bewertungen über die Partie“ — die Geschichte, nicht nur der Zustand | Chess.com Events (Funktion „Feedback“) |
| **Uhr mit Zeitnot-Warnung** | Lichess färbt die Uhr bei knapper Zeit **rot** und lässt sie blinken; die Schwelle skaliert mit der Bedenkzeit (5 min → 40 s, 10 min → 60 s) | Lichess-Forum |
| **Zeitnot ist das Drama des Blitz** | unter wenigen Sekunden entscheidet die Uhr, nicht die Stellung | jk_182, Lichess-Blog (im Konzeptreview zitiert) |
| **Spieler-Kamera** neben der Uhr | Gesicht zur Zahl; bei Blitz das Gesicht in Zeitnot | Konvention (Chess.com/chess24-Streams) |
| **Puls der Spieler** | World Chess (FIDE Grand Prix 2022) und Freestyle Chess (Weissenhaus 2024) blendeten Herzfrequenz ein — „was der Großmeister fühlt, hinter dem Pokerface“ | ChessBase, Gulf News |
| **Kommentator-Bild-im-Bild** | zwei Stimmen, die erklären; Bild klein in der Ecke | Konvention |
| **Zug-Annotation** `!`, `?`, `??` | Moment statt Protokoll | Konvention (Chess.com „Brilliant/Blunder“-Icons) |
| **Mannschaftskampf-Übersicht** | Olympiade/Bundesliga: je Brett `1`, `½`, `0`, Summe | Konvention |

### 2.2 Fechten (Olympia-Übertragung, FIE, World Fencing League 2026)

| Element | Was es leistet | Quelle |
|---|---|---|
| **Trefferlampen** | gültiger Treffer: **rot für den Fechter links, grün für den rechts**; weiß = ungültige Fläche (nur Florett/Säbel); **im Degen gibt es kein Weiß** | fencing.net, Academy of Fencing Masters, NBC Olympics |
| **Doppeltreffer im Degen** | leuchten rot **und** grün, bekommen beide einen Punkt | Academy of Fencing Masters, NBC Olympics |
| **LED-Anzeigetafel** über/neben der Bahn | Stand, Zeit, Strafkarten, Namen, Gefechtsnummer | Swiss Timing |
| **Videobeweis** | ab der 32er/64er-Runde; der Kampfrichter sieht die letzten ~10 s wieder, **in 10–100 % der Echtzeit** | fencing.net (Olympia-Leitfaden) |
| **Klingenspur (AR)** | „Fencing Visualized“ (Rhizomatiks/Dentsu Lab): die Klingenspitze wird erkannt und als leuchtende Spur über das Bild gelegt — Finten, Paraden, Handgelenk-Bewegungen werden erstmals sichtbar; Tokyo 2020 vor Ort, April 2026 live bei der World Fencing League | Rhizomatiks, happymag |
| **Zeitlupe nach dem Treffer** | die Phrase dauert weniger als eine Sekunde — die Wiederholung ist, wo der Zuschauer sie erst sieht | Konvention |
| **Priorität** | im Degen nur bei Gleichstand nach Ablauf: Zusatzminute, Priorität per Los, Anzeige am Gerät | FIE-Regel (Konzeptreview 3.2.5); der Motor rechnet sie seit F1 |

### 2.3 Tennis (Wimbledon, US Open)

| Element | Was es leistet | Quelle |
|---|---|---|
| **Score-Bug** | Sätze, Spiele im laufenden Satz, Punkte, **Aufschlagpunkt** (Punkt/Dreieck am Aufschläger, wandert bei jedem Spiel), Breakball-Flag, Matchdauer; im Tiebreak schaltet die Punktanzeige um | KeepTheScore, SVG „Designing the Modern Scorebug“ |
| **Hawk-Eye** | 6–10 (Wimbledon 2025: 18) Kameras, 3D-Bahn des Balls; Grafik: Flugbahn + Aufsprung-Abdruck an der Linie, „IN“/„OUT“; seit 2025 ohne Linienrichter, 2026 mit sichtbaren „out“/„fault“-Anzeigen auf den Platz-Scoreboards | topendsports, CNN, JudgeMate |
| **Aufschlaggeschwindigkeit** | km/h bzw. mph direkt nach jedem Aufschlag | Hawk-Eye/SVG Europe („serve speeds“) |
| **Momentum/Siegwahrscheinlichkeit** | IBM „Live Likelihood to Win“ als Linie, die die Momentum-Wechsel eines Matches zeigt; „dominance graphs“ im BBC-Begleitlayer | IBM Newsroom, SVG Europe |
| **Breakball / Satzball / Matchball** | Banner im Bug im Moment, wo es zählt | Konvention |
| **Ballplatzierung / Mini-Court** | Draufsicht mit Aufsprungpunkten, Heatmap | Hawk-Eye-Datenprodukte |

### 2.4 Die Regel, die alle drei teilen

Die Übertragung **übersetzt ein zu schnelles Ereignis in ein stehendes Bild**: die Uhr wird rot,
bevor die Zeit fällt; die Lampe bleibt an, obwohl der Stoß 40 ms dauerte; der Ballabdruck bleibt
liegen, nachdem der Ball weg ist. Unser Motor hat dasselbe Problem mit anderem Maßstab — ein Zug,
ein Ausfall, ein Ballwechsel dauert 0,5 s und kommt je Brett nur alle ~6 s. **Jeder Vorschlag unten
ist deshalb ein „Nachleuchten“: ein Ereignis, das 0,5 s dauert, hinterlässt eine Spur, die 2–4 s
stehen bleibt.**

---

## 3. Querschnitt — drei Bausteine für alle drei Disziplinen

### Q1 — Verlaufskurve (Eval-Graph / Momentum-Linie) [Anzeige, klein]

`u.verlauf` existiert für jedes Duell-Brett und ist genau die Zahlenreihe, die Chess.com als
Bewertungsgraph und IBM als Momentum-Linie zeichnen. Eine Hilfsfunktion
`zeichneVerlaufKurve(a, x, y, w, h)`, liest `a.verlauf[0..a.aktuell]`, zeichnet eine Linie um eine
Nulllinie, oberhalb Heim-, unterhalb Gastfarbe gefüllt, Skalierung mit festem Boden (wie `maxV`
mit Boden 60), **nicht** aus `vorteil`. Punkte, an denen das Vorzeichen kippt, bekommen einen
kleinen Marker — das ist dieselbe Bedingung, die seit 26.09. den Highlight-Flag setzt
(`vorteilKipptBig`, `:15997`), Bild und Ticker zeigen damit denselben Moment.

* Schach: unter dem Brett, Breite des Bretts (`bw`), 24 px hoch.
* Tennis: am rechten Rand der Nahansicht, senkrecht oder waagerecht unter dem unteren Spieler.
* Fechten: als **Treffer-Treppe** statt Linie (zwei Stufenkurven `treffer` je Seite), weil seit F1
  der Trefferstand das Ergebnis ist, nicht der Vorteil.

### Q2 — Mannschafts-Leiste [Anzeige, klein]

Oben in der Nahansicht (unter dem Score-Bug), sechs Kästchen, eines je Brett/Platz/Bahn: laufend
= kleiner Stand (`+12`, `4:3`), fertig = `1` / `0` / `½` (Schach) bzw. Häkchen in Teamfarbe
(Fechten, Tennis); Fokus-Brett umrandet. Olympiade-Schach und Davis-Cup-Tie-Tafel zeigen genau
das. Es ersetzt die heutige Lücke zwischen „2 : 1“ (Score-Bug) und den Mini-Figuren am unteren
Rand, die keinen Stand tragen (Tennis) oder nur als Kleintext (Fechten). Fertig heißt
`fertig(x)&&fertig(y)` — erst dann ist das Brettergebnis kein Spoiler mehr (bei Fechten
`gefechtSieg`, sonst `verlauf[rundenN-1]`).

### Q3 — Spielerkachel mit Porträt als „Spieler-Kamera“ [Anzeige, klein–mittel]

Die Arena kennt Porträts schon (`portraet()`, `:21531`, `/portraits/<kennung>.jpg`, Rückfall auf
das Kürzel). Neben Uhr (Schach), Lampe (Fechten) bzw. Name (Tennis) eine 36×36-Kachel — das ist die
Player-Cam der Schach-Streams und das Gesicht, das NBA/F1 beim Fokuswechsel einblenden (Regel 6
aus Runde 2: „Kontext zum Akteur, wenn er in den Fokus kommt“). Beim Fokuswechsel einmal 2 s eine
**Bauchbinde**: Name, Slot-Rolle (`Serve`, `Clock Pressure`, `Counter Tempo` …), Bilanz bis hier
(„7 von 9 Zügen stark“). Canvas-Zeichnung des Bildes: einmal laden, `drawImage` — kein DOM nötig.

Die Slot-Rolle in der Bauchbinde ist ehrlich, solange sie nur **zeigt, was eingesetzt ist**; sie
verspricht keinen Spielstil (Konzeptreview 1.4: Rollen sind heute nur Zuschläge). Deshalb kein
Text wie „geht ans Netz“, nur der Rollenname.

### Q4 — Farbregel

Runde 2 setzt **Teamfarbe als einzigen Farbcode**. Diese Runde bringt zwei echte Konventionen, die
dagegen laufen — Fechtlampen (rot/grün nach Seite) und Hawk-Eye (IN grün / OUT rot). Vorschlag:
die Lampen und Hawk-Eye-Worte **dürfen** ihre echten Farben tragen, weil sie an einem fest
benannten Gegenstand hängen (Lampe, Abdruck) und nie an einer Figur; alles, was einen Spieler
markiert (Name, Kurve, Kachel, Leiste), bleibt Teamfarbe. `--ok`/`--crit` (grün/rot) für
„Vorteil positiv/negativ“ fällt in Fechten und Tennis weg, sobald Lampe bzw. Hawk-Eye da sind —
sonst meint Grün an drei Stellen drei Dinge. Offene Frage 1.

---

## 4. Speed-Schach

Die am weitesten gebaute der drei Ansichten: Brett, Uhren, Balken, Zugliste, Annotation, Pin. Was
fehlt, ist durchweg **Dramaturgie**, nicht Information.

### S-B1 — Zeitnot-Warnfarbe [Anzeige, klein] — Priorität 1

Die Uhren ticken (`vizUhrAnzeige`), färben sich aber nie. Nach Lichess-Muster:

| Restzeit (`vizUhrAnzeige`) | Uhrfeld | Wie oft (Größenordnung) |
|---|---|---|
| ≥ 60 s | wie heute | Normalfall |
| < 60 s | Gelb-Rand | bei ~4 von 10 Spielern bis zum Partieende |
| < 30 s | **Rot**, Ziffern weiß | bei ~6 % |
| < 10 s | rot blinkend (2 Hz), Ton `uhr` lauter | praktisch nie — und genau so selten ist es richtig |

Größenordnung aus der Uhrformel (`schachUhrWert`, `:17012`: 180 s, −8 s stark, −20 s schwach) mit
der Erfolgsquote 68,7 % aus der Nachbildung des Konzeptreviews: im Mittel bleiben ~62 s; unter
60 s braucht vier schwache Züge (P ≈ 39 %), unter 30 s sechs (P ≈ 6 %). Die Schwellen sind so
gesetzt, dass Rot ein seltener Moment bleibt (Regel 8 aus Runde 2).

**Ehrlichkeit:** die Uhr ist Kulisse, sie folgt dem Würfel (Konzeptreview 2.1). Die Warnfarbe ändert
daran nichts — sie erzählt nur deutlicher, was die Uhr schon erzählt: wer oft schwach zieht, gerät
in Zeitnot. Dass Zeitnot auch **Ursache** schwacher Züge wird, ist S1 aus dem Konzeptreview und
damit **[Wertung]**.

### S-B2 — Regie springt zur Zeitnot [Anzeige, klein]

Jede Blitz-Regie schneidet auf das Brett mit der knappsten Uhr. `zeichneSchach()` hat eine eigene
Regie (`:20651 ff.`), nicht `duellFokusWaehlen()`. Ergänzung: vor der 3-s-Wahl „knappster
Vorteil“ zuerst „ein Brett, auf dem eine Uhr < 30 s steht und das noch läuft“. Pin hat weiter
Vorrang. Nutzt S-B1s Schwelle, damit Rot fast immer im Bild ist, wenn es passiert.

### S-B3 — Bewertungskurve unter dem Brett [Anzeige, klein]

Q1, Breite des Bretts, direkt unter dem Tisch (Tischbeine enden bei `by+bw+38`, darunter ist
Platz bis zu den Mini-Brettern bei `H*0.80`). Der Balken links zeigt „jetzt“, die Kurve zeigt, dass
Weiß nach Zug 6 gekippt ist.

### S-B4 — `??` beim Kipp-Zug statt `?!` [Anzeige, klein]

Heute bekommt jeder schwache Zug `?!` (`:20778`) — die Hälfte aller Züge. Konvention: `??` ist der
Patzer, der die Partie dreht. Wenn der Zug das Vorzeichen von `verlauf` kippt (dieselbe Bedingung
wie `vorteilKipptBig`): `??` groß in `--crit`, Bewertungsbalken blitzt 0,4 s weiß. Umgekehrt ein
starker Kipp-Zug `!!`. Alle anderen behalten `!`/`?!`. Die Zugliste übernimmt dieselben Zeichen.

### S-B5 — Mannschafts-Leiste mit `1 · ½ · 0` [Anzeige, klein]

Q2. Beim Schach zusätzlich die Farbe je Brett (heute Heim immer Weiß). Das große „2 : 1“ oben
(`:20685`) wird dann zur Summe dieser Leiste — gleiche Zahl, jetzt mit Herkunft. Remis ist mit
0,24 % selten, aber die Leiste muss `½` können (`vorteil===0`).

### S-B6 — Spieler-Kamera und Puls [Anzeige, mittel] — niedrig

Q3 neben jeder Uhr. **Puls** optional und nur als Stimmung: aus Restzeit und laufendem Vorteil
abgeleitet (`70 + Zeitnot-Anteil·60 + Rückstand·20`, geglättet), nie aus einem Attribut, das der
Zuschauer sonst nicht sieht (sonst verrät die Anzeige die Nerven-Eignung vor dem Ergebnis).
Niedrige Priorität: World Chess hat es gemacht, aber es ist die am wenigsten gelernte Grafik
der Liste.

### S-B7 — Kommentator-Bauchbinde [Anzeige, klein] — niedrig

Wir haben keine Kommentatoren, aber einen Ticker. Die **big**-Zeilen des Fokus-Bretts (seit dem
26.09. nur noch Führungswechsel und „Brett entschieden“) zusätzlich 2,5 s als Bauchbinde unter dem
Brett mit einem neutralen Mikrofon-Symbol — ein „PIP“ ohne Gesicht. Überschneidet sich mit
`callout()`; nur bauen, wenn der Callout bei Schach nicht ohnehin schon genau das zeigt (prüfen).

### Nicht als Anzeige machbar

* **Zeitüberschreitung als Brettverlust**, Zeitnot als Patzerursache → S1, **[Wertung]**.
* **Eval in Bauern** (`+1,4` statt `+38`): nur eine Umrechnung, aber eine erfundene Einheit auf
  einer Punktsumme; erst mit S2 (Bewertung als Zustand) ehrlich. Bis dahin Punkte lassen.
* **Farben wechseln brettweise** → S5, verändert Kulisse und (optional) Anzugsvorteil, **[Wertung]**
  sobald Weiß einen Vorteil bekommt; ohne Vorteil reine Anzeige (dann aber auch `schachKoenigsfeld`
  und die „Weiß/Schwarz“-Beschriftung anpassen).

---

## 5. Fechten

Seit F1 (`gefechtSieg`, `:14315 ff.`) entscheidet der Trefferstand. Die Kopfzeile zeigt trotzdem
noch „Treffer 5:4 · **Vorteil +38** · Gang 4/9“ (`:18614`) und der Tauzieh-Versatz folgt dem
Vorteil, nicht den Treffern. Die Übertragungsoptik ist deshalb zugleich ein Konsistenzfix.

### F-B1 — Trefferlampen und Doppeltreffer [Anzeige, klein] — Priorität 1

Zwei Lampen am oberen Rand der Fokus-Bahn (oder an den Bahnenden), links **rot** (Heim steht immer
links), rechts **grün**. Eine Lampe geht an, wenn der Fechter dieser Seite im gerade enthüllten Gang
`erfolgWort` hat, und bleibt 2,5 s an (das „Nachleuchten“ aus 2.4).

**Der glückliche Befund:** die Motor-Reihenfolge enthüllt Gang *i* von Heim und Gang *i* von Gast
direkt nacheinander (Abschnitt 1), und `u.treffer` zählt **jeden** eigenen Erfolg — auch wenn der
Gegner im selben Gang ebenfalls trifft. Das ist wortwörtlich die Degen-Regel „Doppeltreffer: beide
Lampen, beide bekommen einen Punkt“. Die Anzeige erfindet also nichts:

| Gang *i* Heim | Gang *i* Gast | Lampen | Einblendung |
|---|---|---|---|
| Treffer | kein Treffer | rot | — |
| kein Treffer | Treffer | grün | — |
| Treffer | Treffer | rot + grün | **DOPPELTREFFER** (klein, 1,5 s) |
| kein Treffer | kein Treffer | keine | — (im Degen ohne Weiß: ehrlich dunkel) |

Die Heim-Lampe geht beim Heim-Enthüllen an, die Gast-Lampe ~0,55 s später; das Doppeltreffer-Wort
erscheint mit der zweiten. Umsetzung: `stepFechten()` hat die Erkennung „frisch enthüllt“ schon
(`:17095`); dort `u.vizLampeT` setzen, `zeichneFechten()` zeichnet. Mini-Bahnen: je ein 4-px-Punkt
in Lampenfarbe neben „Bahn 3 · 4:2“ — das „wo passiert gerade was“ der sechs Bahnen auf einen Blick.

Farbfrage siehe Q4 / offene Frage 1. Ein Punkt spricht klar für Rot/Grün: es ist das einzige
Fechtbild, das auch Nicht-Fechter kennen.

### F-B2 — FIE-Anzeigetafel statt der Kopfzeile [Anzeige, klein] — Priorität 2

Ersetzt `"Treffer … · Vorteil … · Gang …"` durch die Tafel, die über jeder echten Bahn hängt:

```
 [P]  ROT  5  │ 2. PERIODE  1:47 │  4  GRÜN
      Draco        Gang 5/9        Greenkraut
```

* **Trefferzahlen groß**, in Lampenfarbe (bzw. Teamfarbe, offene Frage 1). Das ist der Stand.
* **Periode** (`rundenN/3` Gänge je Periode, dieselbe Teilung wie der Ticker-Beat, `:16020`).
* **Gefechtsuhr** als Kulisse: 3:00 je Periode, läuft über die drei Gänge der Periode herunter
  (aus dem Enthüllungsfortschritt dieses Bretts, nicht aus einer eigenen Zeit). Wie die Schachuhr
  eine erzählende, keine entscheidende Uhr — in der Tafel ohne Zehntel, damit sie niemand für
  eine Wertung hält.
* **Prioritäts-Lampe „P“** — nur wenn `gefechtGleichstand` und **erst nach dem letzten Gang
  beider Fechter** (Spoiler, Abschnitt 1): die Lampe leuchtet an der Seite mit `prioritaet`,
  Einblendung „PRIORITÄT — Zusatzminute ohne Treffer“. Das zeigt eine Regel, die der Motor schon
  rechnet, aber heute nur im Ticker erwähnt.
* **„Vorteil“ verschwindet aus der Kopfzeile.** Er bleibt Messwert (rho) und darf klein als
  „Aktionsqualität“ in der Wertungstabelle stehen; im Bild konkurriert er nicht mehr mit dem
  Trefferstand. Dasselbe gilt für den Tauzieh-Versatz: für Fechten auf die Trefferdifferenz
  umstellen (`buehneTauziehVersatz(treffer_a − treffer_b, 5, …)`), sonst rückt der Fechter mit
  weniger Treffern vor — derselbe Widerspruch, den F1 im Ergebnis behoben hat, jetzt im Bild.

### F-B3 — Klingenspur [Anzeige, mittel] — Priorität 3

Das „Fencing Visualized“-Bild in 2D: während `ausfall`/`erholung`/`parade` die letzten ~10
Positionen der Klingenspitze als verblassende Linie in Teamfarbe, bei Treffer endet die Spur im
Funken. `zeichneDegen()` liefert die Spitze bereits als Rückgabewert `{kx,ky}` (`:2728`); zu prüfen
ist nur, ob `zeichneSprite()` sie bis `zeichneFechten()` durchreicht und in welchem Koordinatenraum
(die Fechter werden unter `ctx.scale(sk)` gezeichnet, `:18591`) — die Spur muss in
Bildschirmkoordinaten gepuffert werden. Ringpuffer als `viz*`-Feld je Fechter. Nur am Fokus-Gefecht.

Das ist der eine Vorschlag, der den halbsekündigen Ausfall **lesbar** macht statt nur hübscher: der
Zuschauer sieht, dass die Spitze des einen durchkam und die des anderen abgelenkt wurde.

### F-B4 — Zeitlupen-Wiederholung als Bild-im-Bild [Anzeige, mittel–groß] — Priorität 4

Nach seltenen Momenten (≤ 2 je Spiel): Gefecht entschieden durch den letzten Treffer,
Doppeltreffer beim Stand 4:4 oder später, Prioritätsentscheid. Ein Inset (rechts oben, ~30 %
Breite) spielt die letzten ~1,2 s der Fokus-Bahn mit 25 % Tempo, Badge „WIEDERHOLUNG“. FIE-Vorbild:
Videobeweis mit 10–100 % Tempo.

Umsetzung: `stepFechten()` schreibt je Frame einen Schnappschuss der Fokus-Bahn (beide
`vizFechtPhase`/`vizFechtT`/Spur/Funke) in einen Ringpuffer; das Inset zeichnet aus dem Puffer.
**Der Motor läuft weiter** — kein Anhalten von `stepBuehne()`, sonst verschiebt sich die Uhr. Das
ist der Grund für Bild-im-Bild statt Vollbild-Wiederholung.

### F-B5 — Videobeweis-Einblendung [Anzeige, klein] — niedrig, eher nicht

Als Badge „VIDEOBEWEIS — Treffer bestätigt“ technisch trivial. Aber: unsere Mechanik kennt keinen
strittigen Treffer, ein Videobeweis könnte nur bestätigen, nie ändern — dieselbe „Kulisse ohne
Folge“, die das Konzeptreview an der Schachuhr bemängelt. Empfehlung: nicht bauen, F-B4 trägt
denselben Wiederholungsreiz ohne vorgetäuschte Entscheidung.

### Nicht als Anzeige machbar

* **Aktionsrad** (Angriff/Finte/Parade/Gegenangriff sichtbar als Aktion) → F2, **[Wertung]**.
  Die heutige Parade ist nur das Spiegelbild eines Fehlschlags; eine Grafik „PARADE-RIPOSTE“ würde
  eine Entscheidung behaupten, die nicht fiel.
* **Strafkarten** (gelb/rot/schwarz) — es gibt keine Regelverstöße im Modell.

---

## 6. Tennis

Die schwächste Ansicht der drei — nicht wegen der Animation (Ausholen/Flug/Erholen ist sauber),
sondern weil **nichts im Bild „Tennisplatz“ sagt** und kein Tennis-Zählwerk existiert.

### T-B1 — Platz zeichnen [Anzeige, klein] — Priorität 1

Die Nahansicht stellt die Spieler oben/unten (`fyOben=H*0.23`, `fyUnten=H*0.56`, `:18423`) — genau
die Hauptkamera-Perspektive jeder Übertragung (hinter der Grundlinie, leicht erhöht). Ein Platz in
Trapez-Perspektive dazwischen: Hartplatz blau mit grünem Auslauf (US Open) oder Rasen grün mit
gemähten Streifen (Wimbledon), weiße Grund-, Seiten-, Aufschlaglinien, Netz als dunkles Band mit
weißer Kante auf halber Höhe. Die Spieler stehen an den Grundlinien. Eigene `bodenTennis()` statt
`bodenBuehne()` — das Muster, das Showcase/Wettessen/Heben/Eis schon haben. Belag nach Saat oder
fest (offene Frage 3).

Ohne diesen Schritt lesen sich alle anderen Tennis-Vorschläge nicht: ein Hawk-Eye-Abdruck braucht
eine Linie, an der er liegt.

### T-B2 — Hawk-Eye-Ballspur, Aufsprungmarke, Netz oder Aus [Anzeige, klein–mittel] — Priorität 2

Heute: Ball fliegt im Bogen, bei Fehlschlag bleibt er „auf halber Strecke“ stehen (`:18463`).

* **Spur**: die letzten ~8 Ballpositionen als verblassende gelbe Punkte (Hawk-Eye-Bahn in 2D).
* **Aufsprungmarke**: beim Treffer eine kleine Ellipse im Feld des Gegners (kurz vor seiner
  Grundlinie), bleibt 2,5 s liegen und verblasst.
* **Fehlschlag differenziert**: statt immer „halbe Strecke“ entweder **Netz** (Ball endet an der
  Netzkante, fällt zurück) oder **Aus** (Abdruck knapp hinter Grund- oder Seitenlinie, Wort „AUS“).
  Die Wahl über einen Hash aus `u.id` und Durchgang — **nicht** `rr()`, sonst verschiebt sich der
  Zufallsstrom der Messung.
* **Hawk-Eye-Inset** bei knappem Aus: Ausschnitt 3× vergrößert, Linie + Abdruck, „OUT“. Nur bei
  Fehlschlägen, die das Vorzeichen des Vorteils kippen (derselbe seltene Moment wie
  `vorteilKipptBig`) — sonst wird es wieder ein Protokoll.

Das „IN/OUT“-Rot/Grün ist die zweite Ausnahme von der Teamfarben-Regel (Q4).

### T-B3 — Aufschlaggeschwindigkeit [Anzeige, klein] — Priorität 3

Nach jedem Schlag 1,5 s neben dem Schläger: „**198 km/h**“. Wert monoton aus der enthüllten
Leistung (`r.punkte`) plus Hash-Streuung ±6, abgebildet auf 150–215 km/h (Frauen/Männer egal —
Fantasy-Figuren), Fehlschlag ohne Zahl. Bestwert des Spiels bekommt „Schnellster Aufschlag“ in der
Endstand-Tafel. Reine Kulisse, aber eine, die in die richtige Richtung erzählt (wer besser spielt,
schlägt härter) — dieselbe Klasse wie die Schachuhr.

**Vorbehalt aus dem Konzeptreview:** jeder Ballwechsel wird heute als Aufschlag gespielt (Ton
„aufschlag“ bei jeder Enthüllung). Die km/h-Zahl verstärkt diese Lesart. Solange T1 (Aufschläger
wechselt) nicht gebaut ist, ist das in Ordnung; mit T1 zeigt nur der Aufschläger km/h.

### T-B4 — Ballwechsel-Leiste statt Spielstand [Anzeige, klein] — Priorität 4

Solange es keinen Nullsummen-Punkt gibt, ist das ehrlichste Zählwerk das Biathlon-Muster aus
Runde 2: unter jedem Spieler zehn kleine Kreise, gefüllt = gewonnener Ballwechsel, leer =
verlorener, grau = noch offen; daneben der Vorteil. Plus Q1 als Momentum-Linie (das IBM-Bild).
Die Leiste widerspricht dem Brettsieger nie, weil sie nichts zählt, was der Motor nicht zählt.

### T-B5 — Spielstand-Baum, Breakball, Matchball [**Wertung**, groß]

Der Tennis-Score-Bug (Sätze | Spiele | Punkte, Aufschlagpunkt, „BREAKBALL“) ist das, was Chris
vermutlich zuerst erwartet. **Er ist als reine Anzeige nicht zu haben**, und zwar aus dem Grund,
den das Fechten schon einmal teuer gelernt hat:

* Heute „gewinnen“ an 46,7 % der Ballwechsel-Indizes **beide** den Ballwechsel, an 9,8 % keiner
  (Nachbildung, Konzeptreview 1.3). Ein Punktestand braucht genau einen Gewinner je Punkt.
* Leitet man den Punkt anzeigeseitig ab (z. B. „mehr `r.punkte` gewinnt“), gewinnt ein Spieler
  sechs knappe Punkte, der andere vier deutliche — und der mit „6:4“ **verliert** das Brett, weil
  `vorteil` die Summe liest. Genau dieser Widerspruch (11,4 % beim Fechten) war der Anlass für F1.
* Ein Satz-/Spiele-Baum verstärkt ihn noch: Zählhierarchien machen aus knappen Punktvorteilen
  klare Spielstände.

Richtig ist: **erst T1 + T2 aus dem Konzeptreview** (Nullsummen-Punkt mit Aufschläger, Format
Match-Tiebreak bis 10 — passt fast exakt in die 20 Durchgänge je Brett), **dann** die Grafik, und
zwar die Match-Tiebreak-Tafel (`7 : 5`, Aufschlagpunkt, „MINI-BREAK“, „MATCHBALL“). Dann ist sie
reine Anzeige auf einer ehrlichen Zählung. Bis dahin T-B4.

Eine Zwischenform, die ohne Wertungseingriff ehrlich ist: **„Entscheidungsball“** — wenn beide
Spieler eines Platzes beim letzten Ballwechsel sind und der laufende Vorteil kleiner ist als die
größte mögliche Punktzahl eines Durchgangs (aus den bekannten Konstanten, nicht aus dem
Ergebnis), steht „ENTSCHEIDUNGSBALL“ im Bild. Das kann tatsächlich kippen, ist also kein leeres
Banner. Nicht „Matchball“ nennen — das Wort gehört der echten Zählung.

---

## 7. Die Grenze „nur Anzeige“ — Checkliste für die Umsetzung

Für jeden [Anzeige]-Vorschlag, wie für `stepFechten`/`stepTennis`/`stepSchach` schon vertraglich
festgehalten (`:17057 ff.`, `:17164 ff.`):

1. Nie `rr()`. Zufallsartige Varianz (Netz/Aus, km/h-Streuung) über Hash aus `u.id` + Durchgang.
2. Nur `viz*`-Felder auf `u` oder Modulzustand der Regie schreiben; nie `summe/runden/aktuell/
   vorteil/verlauf/treffer/gefechtSieg/lunge/buehneAkt/buehneZeiger/done`.
3. Spoiler-Regel: gelesen wird `runden[0..aktuell]`, `verlauf[aktuell]`, `treffer`. **Nicht**
   `vorteil` (Endwert), **nicht** `gefechtSieg/prioritaet/gefechtGleichstand` vor dem letzten
   Gang beider Fechter.
4. `sfx()` nur aus `step*`-Erkennungsschleifen (einmal je Enthüllung), nie aus `zeichne*`.
5. Dosis: jede neue Einblendung, die „big“ aussieht (Banner, Inset, Wiederholung), hängt an einem
   Moment, der ≤ 4–10 Mal je Spiel vorkommt (Runde 2, Frage 1).
6. Abnahme: `node scripts/miss-alle-disziplinen.mjs 24 speed-schach fechten tennis` vorher/nachher,
   drei Stellen identisch; Sichtprüfung über `scripts/screenshot-disziplin.mjs` (Standalone-Mockup,
   nicht `/dev-arena`, s. Runde 2, 1.3).

Die [Wertung]-Punkte (T-B5, Zeitnot als Ursache, Aktionsrad, Farbwechsel mit Anzugsvorteil)
gehören in die Konzeptreview-Reihenfolge (F1 ✓ → Messvorstudie 5.3 → T1+T2 → F2+F3 → S1) und
brauchen rho **und** Pp.

---

## 8. Priorisierung

| Reihe | Vorschläge | Aufwand | Begründung |
|---|---|---|---|
| 1 | **T-B1** Platz, **F-B1** Lampen, **S-B1** Zeitnot-Farbe | je klein | je die eine Grafik, an der man die Sportart ohne Text erkennt |
| 2 | **F-B2** Anzeigetafel (inkl. Tauzieh auf Treffer) | klein | beseitigt den letzten sichtbaren Rest des Vorteil-/Treffer-Widerspruchs |
| 3 | **T-B2** Hawk-Eye, **S-B2** Zeitnot-Regie, **S-B4** `??` | klein–mittel | Momente statt Protokoll, knüpfen an `vorteilKipptBig` an |
| 4 | **Q1** Verlaufskurve (alle drei), **Q2** Mannschafts-Leiste (alle drei) | klein, einmal gebaut | eine Funktion, drei Disziplinen |
| 5 | **T-B3** km/h, **T-B4** Ballwechsel-Leiste, **S-B5** `1·½·0` | klein | Kontext, den die Übertragung immer hat |
| 6 | **F-B3** Klingenspur | mittel | größter „So habe ich Fechten noch nie gesehen“-Effekt |
| 7 | **Q3** Spielerkachel + Bauchbinde, **F-B4** Zeitlupe | mittel | brauchen Bildladen bzw. Ringpuffer |
| — | S-B6 Puls, S-B7 Kommentator-Bauchbinde, F-B5 Videobeweis | — | niedrig bzw. nicht empfohlen |
| — | **T-B5** Spielstand-Baum/Matchball | groß | **erst nach T1+T2** (Wertung) |

Reihe 1–3 zusammen ist eine Runde von überschaubarer Größe (sieben Zeichnungs-Ergänzungen, keine
neue Infrastruktur außer `bodenTennis()`), und nach ihr sieht jede der drei Disziplinen auf einem
Standbild aus wie ihre Sportart.

---

## 9. Offene Fragen an Chris — mit Voreinstellung

1. **Fechtlampen und Hawk-Eye in echten Farben (rot/grün) oder in Teamfarben?**
   Voreinstellung: echte Farben an Lampe und Abdruck (Heim steht immer links = rot), Teamfarben an
   allem, was einen Spieler markiert; `--ok/--crit` für „Vorteil“ entfällt in Fechten/Tennis.
2. **Soll der Tennis-Score-Bug warten, bis T1+T2 gebaut sind?** Voreinstellung: ja; bis dahin
   Ballwechsel-Leiste (T-B4) und „Entscheidungsball“.
3. **Tennis-Belag: fest (Hartplatz), je Spieltag wechselnd, oder nach Heimteam?**
   Voreinstellung: fest Hartplatz blau; Belag bleibt reine Optik, solange er nichts an der Wertung
   ändert (ein Belag-Effekt wäre [Wertung]).
4. **Zeitlupe (F-B4) als Bild-im-Bild oder gar nicht?** Voreinstellung: Bild-im-Bild, höchstens
   zwei je Spiel; der Motor hält nie an.

---

## Quellen

Im Repo gelesen: `public/mockups/battle-mode.engine.js` (Zeilen wie angegeben, Stand `ebb3b99a`),
`docs/design/broadcast-praesentation-runde-2-22-09.md`, `docs/design/ui-bewegungs-audit-26-09.md`
(Branch `ui-bewegungs-audit-26-09`), `docs/design/buehne-duell-opus-konzeptreview-26-09.md`
(Branch `buehne-duell-konzeptreview-26-09`).

Extern (27.09. abgerufen):

* Schach — [Chess.com, „How To Use Chess.com's Events Page To Livestream An Event“](https://www.chess.com/article/view/events-page-broadcast-guide), [Chess.com, „How To Broadcast Your Event's Games“](https://www.chess.com/article/view/how-to-broadcast-your-games-on-chesscom), [Lichess-Forum, „Time warning in bullet games“](https://lichess.org/forum/lichess-feedback/bug-time-warning-in-bullet-games), [Lichess-Forum, „68 million games … low time alarm“](https://lichess.org/forum/general-chess-discussion/i-analysed-68-million-lichess-games-to-prove-that-the-low-time-alarm-makes-people-play-worse), [ChessBase, „Players' heart rate in chess broadcasts“](https://en.chessbase.com/post/players-heart-rate-in-chess-broadcasts), [ChessBase, „A Heart-Racing Experience!“](https://en.chessbase.com/post/a-heart-racing-experience), [Gulf News, Herzfrequenz-Monitore](https://gulfnews.com/sport/more-sport/chess-will-get-pulses-racing-with-players-heart-monitors-1.2072454), [jk_182, Lichess-Blog, Bewertung und Uhr im Blitz](https://lichess.org/@/jk_182/blog/how-the-evaluation-and-clock-impact-results-of-blitz-games/I2kRp2sk)
* Fechten — [NBC Olympics, „Fencing 101“](https://www.nbcolympics.com/news/fencing-101-rules-and-scoring), [fencing.net, „Welcome to the Olympic Sport of Fencing“](https://fencing.net/olympic-fencing-sport/), [Academy of Fencing Masters, „Fencing Scoring Lights“](https://academyoffencingmasters.com/blog/fencing-scoring-lights/), [Swiss Timing, Fencing](https://www.swisstiming.com/sports/fencing/), [Rhizomatiks, „Fencing tracking and visualization system“](https://rhizomatiks.com/en/work/fencing-tracking-and-visualization-system/), [Rhizomatiks, „Fencing Visualized“ bei der World Fencing League (04/2026)](https://rhizomatiks.com/en/news/2026/04/17/world-fencing-league_fencing-visualized/), [happymag, „AI to make fencing watchable“](https://happymag.tv/fencing-visualised-project-ai-rhizomatiks/), [Sports Video Group, World Fencing League](https://www.sportsvideo.org/2025/11/20/a-new-era-the-world-fencing-league-makes-global-debut-in-april-2026/)
* Tennis — [SVG Europe, „Explaining the game: Wimbledon's data, graphics and accessibility push“](https://www.svgeurope.org/blog/headlines/explaining-the-game-wimbledons-data-graphics-and-accessibility-push/), [Sports Video Group, „Designing the Modern Scorebug“ (06/2026)](https://www.sportsvideo.org/2026/06/09/designing-the-modern-scorebug-how-broadcast-graphics-teams-are-rethinking-the-most-important-element-on-screen/), [KeepTheScore, Score-Bugs](https://keepthescore.com/blog/posts/score-bugs-in-live-sports-broadcasts/), [topendsports, Hawk-Eye](https://www.topendsports.com/sport/tennis/hawkeye.htm), [CNN, Wimbledon ohne Linienrichter (07/2025)](https://www.cnn.com/2025/07/03/sport/wimbledon-line-judges-electronic-calling-tennis-spt-intl), [JudgeMate, Wimbledon Electronic Line Calling & Video Review](https://www.judgemate.com/en/guides/wimbledon-electronic-line-calling-explained), [IBM Newsroom, Wimbledon 2025 AI-Funktionen](https://newsroom.ibm.com/2025-06-17-the-all-england-lawn-tennis-club-and-ibm-launch-new-ai-features-for-real-time-wimbledon-fan-engagement)
