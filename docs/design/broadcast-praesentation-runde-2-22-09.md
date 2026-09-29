# Broadcast-Präsentation, Runde 2 — Live-Ränge, Score-Bug, Führung im Bild, Highlights (22.09.)

**Ein kleiner Bauteil, sonst Recherche und Konzept.** Gebaut ist nur Teil A (laufende Etappen-Ränge
in der Staffel, Abschnitt 1). Alles ab Abschnitt 2 ist Bestandsaufnahme, Vorbild-Recherche und
priorisierter Vorschlag — **kein Code**. Stand: `origin/main` `0f812538`; `engine.js` meint
`public/mockups/battle-mode.engine.js`, Zeilen nach dem Stand dieses Branches (Teil A eingebaut).

Baut auf zwei Runden auf und wiederholt sie nicht: die übergreifende Recherche vom 06.09.
(`docs/design/broadcast-praesentation-uebergreifend-recherche-06-09.md`, „Runde 1") und deren
Umsetzung (Score-Bug `#bbug`, Callout `#bbugcallout`, `HIGHLIGHTS[]`, Captions, Staffel-HUD
`#bahnHud`). Diese Runde fragt: **was fehlt jetzt noch, damit ein Spieltag wie eine Übertragung
liest — über mehrere der zwanzig Disziplinen, nicht nur bei einer.**

Chris' Aufträge, wörtlich (22.09.):

> „bei der staffel am besten noch die ranks anzeigen für alle die schon gelaufen sind oder direkt
> oben in der arena so live tv artige displays wie das bei rennen auch mal dargestellt wird bzw
> allgemein wie bei sport übertragungen, das bitte auch für alle diszis mal recherchieren bzw
> übernehmen da gibts bei NBA NFL Formel 1 usw ja sehr gute beispiele oder leichtathletik allgemein
> etc damit könntest du die gesamte anzeige des spieltags noch verbessern."

> „eiskunstlauf sieht lustig aus mit dem ganzen gespinne, aber da fehlt mir auf dem eis noch ein
> gefühl dafür für wen es gut läuft und für wen weniger gut da kann man eigentlich nur links auf
> die grafik gucken [...] das gilt vermutlich für viele disziplinen dass man optisches feedback auf
> dem feld benötigt damit man ohne stats direkt sehen würde wer hier wen besiegt aktuell."

> Sichergestellt sehen, „dass es machbar ist in diversen verschiedenen disziplinen highlights oder
> highlight plays für den zuschauer hervorzuheben."

---

## 0. Fazit vorweg

| # | Vorschlag | Disziplinen | Aufwand | Nutzen | rho-Risiko |
|---|---|---|---|---|---|
| A | **Gebaut:** laufende Etappen-Ränge in der Staffel (Wertungstabelle + Kaderkacheln) | 1 | klein | hoch für die Staffel | keins (nachgemessen: 0,899 / 0,951 vorher = nachher) |
| 1 | **Highlight-Erkennung schärfen** — gemessen: die fünf Bahnen haben je Rennen genau EIN Highlight (das Ergebnis), Speed-Schach 61 und Eiskunstlauf 52 je Spiel (jede zweite bzw. dritte Ticker-Zeile), Basketball 35; Hockey (14) zeigt, wie es richtig aussieht | alle 20; günstigste Nachzüge: 5 Bahn (fünf Flags + Führungswechsel), 8 Bühnen-Disziplinen über EINE Schwellenzeile, Basketball | klein (je Disziplin 1–6 Zeilen an bestehenden `feed()`-Aufrufen) | hoch: Callout, Ticker-Fett und Höhepunkte-Liste werden erst dadurch aussagekräftig | keins (nur das dritte Argument eines Anzeige-Aufrufs) |
| 2 | **Führung IM BILD**: Eiskunstlauf-Fallstudie (Eis-Halo + Bandenlicht + Vorsprungsbalken), dasselbe Muster für die anderen Bühnen-Auftritte und Feldspiel | Eiskunstlauf zuerst; Breaking, Showcase, Wettessen, I-Spy, Basketball, Hockey danach | klein–mittel je Disziplin (nur Zeichnen, liest `u.summe`/`fsPunkte`) | hoch: genau Chris' „ohne Stats sehen, wer wen besiegt" | keins |
| 3 | **Score-Bug-Vollausbau**: Kontextzeile (Viertel/Bein/Durchgang), Führende in Teamfarbe, Führungswechsel-Blitz | alle 20 | klein (eine Funktion, `aktualisiereBbug`, plus CSS) | mittel–hoch: die eine Anzeige, die nie aus dem Bild geht | keins |
| 4 | **Timing-Tower**: generische Live-Rangliste mit Delta zum Führenden als Overlay über der Leinwand, F1-Muster | 5 Bahn + 5 Bühnen-Auftritte (Eiskunstlauf hat sie schon in Canvas-Form) | mittel (ein HTML-Overlay wie `#bahnHud`, je Chassis ein Datenlieferant) | hoch für Bahn/Bühne, wo Rang und Rückstand heute nur in der Tabelle unter dem Bild stehen | keins |
| 5 | **Zwischenzeiten für alle fünf Bahnen** — Zeitfahren hat sie, die anderen vier nicht, obwohl der Code generisch ist | Spurt, Climbing, Takeshi, Staffel | trivial (eine Konfigurationszeile je `BAHN_ART`) | mittel: Leichtathletik-/Biathlon-Konvention „Rückstand am Split" statt nur am Ziel | keins (`u.zz` wird nur gelesen; **verifizieren**, s. 7) |

**Empfohlene Reihenfolge:** 1 → 3 → 2 (Eiskunstlauf) → 5 → 4 → 2 (Rest). Begründung in Abschnitt 8.

---

## 1. Teil A — gebaut: laufende Etappen-Ränge in der Staffel

### 1.1 Befund

Die Wertungstabelle der Staffel (`WERTUNG_STAFFEL`, `engine.js:25880`) zeigte für einen Läufer,
der seinen Abschnitt hinter sich hatte, in der Spalte **Stand** nur `übergeben` (und ganz am Ende
`Ziel`). Der Rang seiner Etappenleistung — die Größe, an der `MOTOREN.staffel.wert()` die
Rangtreue misst und die das Endstand-Overlay als Spalte „Rang" druckt — war während der zweieinhalb
Minuten Rennen **nirgends** sichtbar. Ebenso die Kaderkachel: sie zeigte einem fertigen Läufer
seinen Streckenanteil (`33 %`), einem wartenden seinen Startpunkt (`50 %`, ohne einen Meter
gelaufen zu sein) — für die Staffel eine bedeutungslose Zahl (`renderKader`, `engine.js:30308`).

### 1.2 Was gebaut ist

* **`staffelEtappenRaenge()`** (`engine.js:22983`, direkt unter `bahnLeistung`): liest
  `bahnRangliste().reihe` **einmal je Render** und gibt `{raenge: Map id→Rang, von}` zurück.
  `bahnRangliste` sortiert alle Läufer MIT Etappenleistung vor alle ohne — der Index eines
  gelaufenen Läufers ist damit sein Rang unter allen bisher gelaufenen beider Seiten, `von` die
  Zahl der bisher gelaufenen. Dieselbe Sortierung, die Endstand-Overlay und Rangtreue-Messung
  lesen: **keine zweite Rangformel.**
* **Spalte Stand** (`WERTUNG_STAFFEL`): `Rang 2/7` für Gelaufene (zweitschnellste von sieben
  beendeten Etappen), `läuft` für den Aktiven, `wartet` für den Rest. Rang 1 grün (vorher war
  `Ziel` grün). Spalten-Tooltip erklärt den Nenner; Fußzeile ergänzt.
* **Kaderkachel** (`renderKader`): für die Staffel `Rang N/M` statt Streckenanteil beim Gelaufenen,
  Streckenanteil nur noch beim Aktiven, `wartet` beim Wartenden. Andere Bahn-Disziplinen unverändert
  (Zweig ist auf `BA().staffel` gegated).

Warum nicht im Broadcast-HUD `#bahnHud`? Es sitzt bei `top:15 %` der Leinwand und endet mit zwei
Zeilen bei ≈ 24 %; die Gerade des Ovals beginnt bei `OVAL_CY−OVAL_R_AUSSEN·OVAL_STAUCH` ≈ 26,6 %
(`engine.js:26130 ff.`). Eine dritte Zeile je Seite läge auf der äußersten Bahn. Der richtige Ort
für eine Rangliste im Bild ist der Timing-Tower (Vorschlag 4), nicht eine dritte HUD-Zeile.

### 1.3 Abnahme

* `node scripts/miss-alle-disziplinen.mjs 24 staffel`: **0,899 je Spiel / 0,951 Saison, Spannweite
  0,100 / 0,100 — vorher wie nachher identisch.** Erwartbar: es wird nur gelesen.
* Sichtprüfung (Playwright, Standalone-Mockup, Saaten `sicht-1337`, `sicht-7`, `sicht-4242` über
  `window.__olyArenaKader.seedByDisciplineId`, Tempo 4×): bei 0:56–0:58 stehen nach drei Übergaben
  `Rang 1/3`, `2/3`, `3/3` lückenlos über beide Teams verteilt (z. B. Saat 1337: Draco 1/3,
  Greenkraut 2/3, Lava Golem 3/3), Kaderkacheln zeigen dieselben Werte; am Ende `Rang 1/12 …
  12/12`, und jeder Rang stimmt mit der Spalte „Rang" des Endstand-Overlays überein (Saat 1337:
  Draco 2, Tidesprinter 1, Lava Golem 12 in beiden). Keine Seitenfehler außer den bekannten
  Sprite-/Zertifikats-Meldungen des Standalone-Servers.
* Hinweis für die Verifikation: `/dev-arena` rendert `DisciplineStageNativeArena` (die
  React-Bühne), **nicht** den Mockup-Motor. Der Motor läuft im Spiel über
  `FoundationBattleArenaHost.tsx` und standalone unter `/mockups/battle-mode.html` — die
  Screenshot-Skripte in `scripts/screenshot-*.mjs` nehmen alle den zweiten Weg.

---

## 2. Was gute Sport-Grafiken lesbar macht — die Konventionen, auf die Chris zeigt

Keine Web-Recherche (die Umgebung erreicht nur GitHub/npm); die Vorbilder sind die, die jeder
kennt, und ihre Regeln lassen sich ohne Screenshot benennen. Wo Runde 1 schon eine Quelle zitiert
hat (ISU-Wertungsgrafik, Sports Illustrated 2018, s. `zeichneEisStand`), wird sie nicht wiederholt.

| Vorbild | Element | Was es leistet | Regel dahinter |
|---|---|---|---|
| NBA / NFL | **Score-Bug** (oben links, seit ~2015 fast überall oben oder unten als Leiste): Kürzel + Teamfarbe, Score, Uhr, Viertel, Shot Clock / Down & Distance, Ballbesitz-Punkt, Timeouts | verlässt das Bild nie; Position ist gelernt, man findet Score und Uhr blind | **Persistenz + fester Ort.** Die eine Zahl groß, Kontext klein daneben. Teamfarbe ist der einzige Farbcode. |
| NFL | **First-Down-Linie**, gelbe Linie im Spielfeld (1998, Sportvision) | der Zuschauer sieht das Spielziel, ohne Zahlen zu lesen | **Grafik im Spielraum, nicht daneben.** Das erfolgreichste Broadcast-Element der letzten 30 Jahre ist eines, das AUF dem Feld liegt. |
| NBA | **Lower Third** beim Freiwurf/Spielerwechsel: Name, Nummer, heutige Punkte | erklärt in zwei Sekunden, wer gerade dran ist und ob er einen guten Tag hat | **Kontext zum Akteur genau dann, wenn er in den Fokus kommt.** |
| Formel 1 | **Timing Tower** (links, alle Fahrer in Rennreihenfolge, Abstand zum Vordermann oder zum Führenden, Positionswechsel als grün/rote Bewegung, schnellste Runde lila) | zwanzig Autos auf einer 5-km-Strecke werden als EINE Liste lesbar; das Rennen ist die Liste | **Rangliste, die sich beim Ereignis füllt und bewegt** — nicht am Ende. Delta statt Rohzeit. Farbe für „besser als bisher" (lila/grün/gelb). |
| Formel 1 | **Battle-Grafik**: zwei Fahrer, der Abstand pendelt live | ein Zweikampf wird zur Zahl, die zittert | **Delta zwischen genau zwei Kontrahenten, live.** Genau das ist `staffelZeitDelta()`. |
| Formel 1 / Radsport | „Halo"/Pfeil über dem verfolgten Auto; Zeitabstand per Interpolation aus Streckenpositionen | der Blick findet den Akteur; Abstand ohne zweite Uhr | Marker **am Objekt**; Delta aus Fortschritt-Zeit-Puffern (schon gebaut: `fortschrittVerlauf`). |
| Leichtathletik (Diamond League, WM) | **Bahnen-Bug** vor dem Start (Bahn, Name, Bestzeit), **Zwischenzeit bei 100/200 m** mit Rückstand auf den Führenden, **Ergebnisliste füllt sich beim Zieleinlauf** Läufer für Läufer, Tags WL/SB/PB | Wer vorne liegt, ist ab dem ersten Split klar; die Liste ist fertig, wenn der Letzte durch ist | **Split + Delta; Rangliste als Fortschreibung.** Chris' Staffel-Wunsch ist exakt diese Konvention. |
| Schwimmen / Eisschnelllauf / Rudern | **Weltrekord-Linie** bzw. „Lead Line" im Wasser/auf dem Eis | man sieht ohne Zahl, ob der Athlet vor oder hinter der Referenz liegt | **Führung als Position im Bild**, nicht als Zahl — Chris' Eiskunstlauf-Wunsch. |
| Biathlon | Schießeinlage: fünf Scheiben als Punkte (voll/leer), daneben laufender Rückstand; „virtueller Führender" | Ereignis (Treffer/Fehler) und Folge (Rückstand) in einer Grafik | **Ereigniskasten je Akteur** — das Muster der Elementkästen in `zeichneEisStand`. |
| Zehnkampf | Punktetafel nach jeder Disziplin: Gesamt, Abstand zum Führenden, Hochrechnung | Ein Wettkampf aus zehn Teilen bleibt als ein Rennen lesbar | **Kumulativer Stand + Delta über mehrere Teilwettbewerbe** — das ist der Spieltag der Olympiade mit zwanzig Disziplinen (heute nur in der Foundation-Übersicht, nicht in der Arena). |
| Alle | Führungswechsel: kurzer Blitz/Wischer am Bug, Score-Ziffern des Führenden hervorgehoben; „Lead change" als Einblendung | Man merkt den Kipp-Punkt, auch wenn man gerade nicht hinsah | **Änderung wird signalisiert, nicht nur der Zustand.** |

Acht Regeln, die daraus folgen und die der Rest des Papiers gegen den Ist-Stand hält:

1. **Persistenz und fester Ort** für Score/Uhr/Phase.
2. **Teamfarbe als einziger Farbcode**, überall dieselbe.
3. **Delta statt Rohwert**: „+1,3 s", „−48 Pkt", nicht zwei Zahlen zum Vergleichen.
4. **Ranglisten füllen sich beim Ereignis** (Teil A) und bewegen sich sichtbar bei Wechsel.
5. **Grafik im Spielraum**: Führung, Ziel, Referenz liegen auf dem Feld, nicht daneben.
6. **Marker am Akteur**, wenn der Blick ihn finden soll.
7. **Änderung signalisieren** (Führungswechsel, Rekord, Positionswechsel).
8. **Highlights sind seltene Momente**, kein Protokoll — eine Übertragung zeigt fünf Wiederholungen pro Spiel, nicht hundert.

---

## 3. Ist-Stand in `engine.js` gegen diese Regeln

| Regel | Kampf (tdm, mini-dm, battlefield) | Feldspiel (basketball, hockey, football) | Bühne (9) | Bahn (5) |
|---|---|---|---|---|
| 1 Persistenz/Ort | `#bbug` (`aktualisiereBbug`, `:12100`): Team, Score, Uhr — ja | ja | ja | ja |
| 2 Teamfarbe | Randfarbe der Bug-Seiten; Score-Ziffern neutral | dito | dito | dito |
| 3 Delta | — (Leben nur als Balken in `.hpbars`) | Score ist selbst das Delta | Duell: „Vorteil +3" nur im Ticker/Tabelle; Auftritt: **kein Delta** | Staffel: `#bhDelta` (`:23241 ff.`), Zeitfahren: ZZ-Diff im Panel; **Spurt/Climbing/Takeshi: keins** |
| 4 Rangliste live | Kader-Kacheln nach Leben | — (Score reicht) | Eiskunstlauf: `zeichneEisStand` (`:18274`) auf der Leinwand; **Breaking/Showcase/Wettessen/I-Spy: nur Tabelle unter dem Bild** | Zeitfahren: `#ttroster`/`#ttstand` (`renderZeitfahrenPanel`, `:29896`); Staffel: Teil A in Tabelle/Kacheln; **Spurt/Climbing/Takeshi: nur Tabelle** |
| 5 Grafik im Spielraum | Lebensbalken unter den Figuren | Korb-/Torschuss-Effekte, Fokus-Ring | Eis: Punkte-Schweber, Kufenspur; **kein Führungsbild** | Puste-Balken unter den Füßen, Rennplan-Etikett; Ziellinie |
| 6 Marker am Akteur | Fokus-Ring (Zielansage) | Fokus-Ring (Doppeln) | Spotlight (Eis/Breaking/Showcase) | `bahnWahl`-Markierung |
| 7 Änderung signalisieren | Callout bei big | Callout bei big; Pausenbuzzer (`starteViertelpause`, `:9497`) | Callout bei big | Callout bei big — **aber siehe Abschnitt 4: es gibt keine** |
| 8 Highlights selten | halb: 14 je Kampf, aber jeder Skill mit Label ist big (`:21303`) — „· 4" Schaden als Höhepunkt | Basketball **nein**: jeder Korb big (`:11081`, `:12077`, 35 je Spiel); Hockey/Football ja | **nein**: Schwelle `r.punkte>=60` (`:14971`) macht Schach 61 und Eiskunstlauf 52 Höhepunkte je Spiel — Zahl statt Moment; Heben 28 | **nein**: ein Ereignis je Rennen (das Ergebnis) |

Kurz: Runde 1 hat Regel 1 und 7 (Infrastruktur) gebaut. Offen sind **Regel 3/4** in zwei Chassis
(Bahn außer Zeitfahren/Staffel, Bühne außer Eiskunstlauf), **Regel 5** in fast allen (Führung liegt
nirgends im Spielraum) und **Regel 8** in drei Chassis (Highlights zu viele oder gar keine).

---

## 4. Vorschlag 1 — Highlight-Erkennung schärfen (Audit über alle zwanzig)

### 4.1 Wie ein Highlight heute entsteht

`feed(side, txt, big, caption)` (`engine.js:28944`): ist `big` gesetzt, wird die Ticker-Zeile fett,
`callout()` (`:28888`) zeigt 2,6 s ein Banner, und `HIGHLIGHTS.push(...)` (`:28969`) sammelt für
die Höhepunkte-Liste im Endstand (`renderHighlights`, `:30490`). **Es gibt keine eigene
Highlight-Erkennung — das dritte Argument des Ticker-Aufrufs IST die Erkennung.** Das ist gut
(eine Stelle, rho-neutral per Konstruktion) und schlecht zugleich: wo der Aufruf das Flag nie
setzt, gibt es nichts; wo er es immer setzt, ist alles ein Highlight.

### 4.2 Audit: wer speist was ein

Gezählt am Code (alle `feed()`-Aufrufe mit drittem Argument, 99 Aufrufe insgesamt) und **gemessen**
im Standalone-Mockup (Saat 1337, Tempo 4×, ein Spiel je Disziplin, `tmp/zaehle-highlights.mjs`
dieser Runde — Zähler an einem MutationObserver auf `#feed .big`):

| Disziplin | Chassis | Was heute `big` ist | big je Spiel (gemessen) | Urteil |
|---|---|---|---|---|
| tdm | Kampf | jeder Treffer mit Skill-Label (`crit\|\|!!label`, `:21303`; `crit` ist seit dem Skill-Umbau konstant `false`), K.o. (`:21304`), Zielansage (`:30164`), Endergebnis | **14** von 661 Zeilen (7× „Trennschlag auf … · 4", 4× K.o., Zielansage, Ergebnis) | **zu generisch im Inhalt, nicht in der Menge** — „Trennschlag auf Greenkraut · 4" ist jeder Angriff, nicht ein Moment |
| mini-dm, battlefield | Kampf | dieselben Aufrufe (gemeinsamer Kampfmotor) | wie tdm | dito |
| basketball | Feldspiel | **jeder Korb** (`:11081`), jeder Spielzug-Treffer aus dem Protokoll (`:12077`), Viertelende (`:9502`), Schlusssirene | **35** von 354 (31 Körbe, 3 Viertelenden, Ergebnis) | **zu generisch** — die Liste ist das Spielprotokoll |
| hockey | Feldspiel | Tor (`:10933`, mit Caption), Drittelende, Sirene | **14** von 360 (11 Tore, 2 Drittelenden, Ergebnis) | **gut** — Tore sind selten |
| football | Feldspiel | Touchdown (Caption), Field Goal, Sack, Fumble, Interception, Viertelende (`:9050–9137`, `:9502`) | nicht gemessen (kein Live-Motor-Screenshot in dieser Runde) | **gut** — exakt die NFL-Highlight-Liste |
| gewichtheben | Bühne | gültiger 3. Versuch, kühner Versuch, Zweikampf-Ergebnis (`:14971`, `:15000–15008`) | **28** von 89 (12× Zweikampf-Ergebnis, 3. Versuche, kühne Versuche) | Momente statt Zahlen, aber am oberen Rand: das Zweikampf-Ergebnis JEDES Hebers (12×) ist Protokoll, nicht Höhepunkt — nur Duellsieg oder Bestwert des Tages sollte big sein |
| speed-schach, fechten, tennis | Bühne (Duell) | Zug mit `r.punkte>=60`, „Brett entschieden" (`:15046`), Fechten-Periode (`:15036`) | Schach: **61** von 134 (49× „findet den starken Zug", 12× Brett entschieden) | **schlimmster Überlauf**: fast jeder zweite Zug ist ein Höhepunkt — „Brett entschieden" trägt, die 60er-Schwelle ertränkt es |
| eiskunstlauf | Bühne (Auftritt) | Element mit `r.punkte>=60` (`:14971`) | **52** von 146 (alle „landet sauber (≥60 Punkte)") | **Zahl statt Moment**: ein Sturz (`failWort`) ist NIE big, ein 61-Punkte-Element immer |
| breaking, showcase, wettessen | Bühne (Auftritt) | dieselbe 60er-Schwelle | wie eiskunstlauf | dito |
| i-spy | Bühne (Auftritt) | dieselbe Schwelle — trifft zufällig den Tresor (60 Punkte) | **7** von 98 (7× Hinweis/Tresor) | zufällig richtig |
| spurt, time-trial, climbing, takeshis-castle, staffel | Bahn | **nur das Endergebnis** (`updateHudBahn`, `:23289`) | Staffel **1** von 15, Spurt **1** von 49, Takeshi **1** von 140 — jeweils nur das Ergebnis | **fehlt vollständig** während des Rennens |

Was auf der Bahn heute im Ticker steht, aber nie big ist — alles vorhandene Aufrufe, denen nur das
dritte Argument fehlt: Übergabe verpatzt (`:27682`), Staffel im Ziel (`:27699`), Einzelläufer im
Ziel (`:27714`/`:27717`), Puste-Einbruch (`:27188`), Takeshi-Ausscheiden (`:27466`), Rempler von der
Bahn (`:27592`), Hürde gerissen (`:27482`).

Die Messung ordnet die Disziplinen in drei Gruppen: **leer** (die fünf Bahnen: genau ein
Höhepunkt, das Ergebnis), **überlaufend** (Speed-Schach 46 % aller Zeilen, Eiskunstlauf 36 %,
Gewichtheben 31 %, Basketball 10 % aber absolut 35) und **richtig dosiert** (Hockey 14, I-Spy 7,
TDM 14 — bei TDM stimmt die Menge, nicht der Inhalt). Hockey ist der Beleg, dass das System
funktioniert, sobald das Flag an einem echten Moment hängt: elf Tore, zwei Drittelenden, fertig.

### 4.3 Die drei günstigsten Nachzüge

1. **Bahn (fünf Disziplinen auf einmal, von 1 auf 4–8).** `true` an fünf bestehende Aufrufe:
   Übergabe verpatzt, erster Zieleinlauf einer Seite (Staffel: „bringt die Staffel ins Ziel";
   Einzel: nur Platz 1–3, sonst wird es wieder ein Protokoll), Takeshi-Ausscheiden, Sturz durch
   Rempler, Puste-Einbruch des **Führenden** (nicht jedes Einbruchs). Dazu EIN neues Ereignis, das
   der Ticker heute gar nicht kennt und das jede Rennübertragung als erstes zeigt:
   **Führungswechsel** — `bahnRangliste().reihe[0].id` gegen den Wert des letzten Frames, gemeldet
   mit Delta (`bahnZeitText`). Reine Anzeige, eine Variable, ein Vergleich je Frame.
   Aufwand: unter einer Stunde. Nutzen: die Höhepunkte-Liste der Bahn ist heute leer.
2. **Bühne — eine Zeile für acht Disziplinen (Schach von 61 auf ~15, Eiskunstlauf von 52 auf
   ~8).** `const versuchBig = … : (r.punkte>=60)` (`:14971`) ist die einzige Schwelle für
   Speed-Schach, Fechten, Tennis, Eiskunstlauf, Breaking, Showcase, Wettessen und I-Spy — eine
   Zahl, kein Moment. Ersatz je Zweig, alles aus Feldern, die die Enthüllung schon hat:
   *Duell*: big nur, wenn der Zug das Vorzeichen des Vorteils kippt (`u.verlauf[u.aktuell]` gegen
   `u.verlauf[u.aktuell−1]`) — der Führungswechsel am Brett; „Brett entschieden" und die
   Fechten-Periode bleiben. *Auftritt*: big bei **Sturz** (`r.ereignis===art.failWort` — heute
   NIE ein Höhepunkt, obwohl es der einzige Moment ist, den jeder Zuschauer sofort sieht), beim
   Element, das den Läufer an die Spitze des Zwischenstands hebt (`Σ summe` gegen den bisherigen
   Führenden, dieselbe Sortierung wie `zeichneEisStand`), und beim letzten Element des Führenden.
   Die 60er-Schwelle entfällt; I-Spy behält seine Tresor-Zeile, weil `ispyTickerZeile` sie ohnehin
   getrennt baut. Aufwand: ~15 Zeilen an einer Stelle.
3. **Basketball (von 35 auf ~10).** big nur bei: Spielzug-Treffer (`szDef`), Dunk
   (`flug.tier==="dunk"`), Dreier (`flug.fern`), Und-eins (`:11097`), **Führungswechsel**
   (`fsPunkte` kippt) und in den letzten 60 s jeder Korb; sonst `false`. Viertelende bleibt.
   Aufwand: zwei Bedingungen an `:11081`/`:12077`.

Danach, nicht zuerst: **Kampf** — Schwelle statt Label: big, wenn `d >= 0.25*tg.max` (ein Viertel
des Lebens in einem Schlag) **oder** der Treffer das Ziel unter 20 % bringt **oder** eine Heilung
≥ 30 % rettet — plus K.o. wie bisher; eine Bedingung an `:21303` (und `:21853` für Geschosse). Die
Menge (14) ist heute nicht das Problem, der Inhalt („· 4" Schaden als Höhepunkt) ist es. Und
**Gewichtheben**: das Zweikampf-Ergebnis nur für den Duellsieger oder den Tagesbestwert big, nicht
für alle zwölf. Beides je eine Bedingung; beides nach `tmp/zaehle-highlights.mjs` vorher/nachher
messen, Ziel 4–10 je Spiel (Abschnitt 9, Frage 1).

### 4.4 Machbarkeit in „diversen Disziplinen" — die Antwort auf Chris' Frage

Ja, und zwar ohne neue Infrastruktur: **jede Disziplin hat bereits die Aufrufe, an denen der
Moment entsteht.** Highlight-Erkennung ist in diesem Motor die Frage „welches dritte Argument
bekommt dieser eine `feed()`-Aufruf" — und für die zehn Disziplinen mit Sammelmotor (Kampf ×3,
Bühnen-Auftritt ×5, Duell ×3 minus Heben) ist es sogar EINE Bedingung für alle. Das Risiko liegt
nicht in der Machbarkeit, sondern in der Dosis: Hockey (wenige Tore) beweist, dass ein seltenes
big richtig wirkt; Basketball beweist das Gegenteil.

---

## 5. Vorschlag 2 — Führung im Bild: Fallstudie Eiskunstlauf, Muster für andere

### 5.1 Befund, am Screenshot (Saat 1337, 50 s, `scripts/screenshot-disziplin.mjs eiskunstlauf`)

Auf dem Eis stehen zwei Läufer eines Duetts mit Punkte-Schwebern (`+53`, `+89`), Namensetikett mit
laufender Summe (`Draco 584 Pkt`, `King 653 Pkt`), Kufenspur, Kiss-and-Cry rechts unten mit der
Endpunktzahl des vorigen Paares (`1380`). Der Score-Bug oben zeigt für die Bühne **nur „4
aufgetreten"** — keine Punkte, kein Team vorn. Die einzige Führungsinformation ist die
Zwischenstand-Tafel links (`zeichneEisStand`): Rang, Namen, Punkte, ein 2,5 px breiter Farbstrich
je Zeile in Teamfarbe. Chris hat also wörtlich recht: **wer gerade gewinnt, steht nur links, als
Zahl.** Auf dem Eis selbst trägt nichts eine Führung — beide Läufer sind gleich hell, gleich groß,
gleich beleuchtet, und das Paar, das gerade läuft, ist immer NUR EIN Team (Spotlight-Rotation),
der Gegner ist gar nicht im Bild.

Das ist der Kern: bei einer **Reihen-Disziplin** (einer nach dem anderen — Eiskunstlauf, Breaking,
Showcase, Gewichtheben) gibt es im Bild keinen Gegner, gegen den man optisch führen könnte. Die
Führung existiert nur als Vergleich mit einem, der schon fertig ist. Deshalb reicht „Gegner
zurückdrängen" (das Tauzieh-Muster der Bühnen-Duelle, parallel in `buehne-duell-vorteil-vorruecken-
22-09` gebaut: `buehneTauziehVersatz()` verschiebt beide Duellanten in Richtung des Vorteils) für
den Auftritt nicht — es braucht eine **Referenz im Bild**, wie die Weltrekord-Linie im Schwimmen.

### 5.2 Vorschlag: drei Ebenen, alle nur `u.summe` lesend

**(a) Bandenlicht in Teamfarbe des Führenden.** Die Bande (`bodenEis`, `:16904`, heute ein
goldener Rahmen) leuchtet in der Farbe des Teams, dessen beste Gruppe den Zwischenstand anführt
(`zeichneEisStand`s `zeilen[0].side` — dieselbe Sortierung, kein neuer Vergleich). Wechselt der
Führende, blendet die Farbe in 0,6 s über (ein `vizBandeT`-Feld, rein zeichnerisch). Man sieht aus
zwei Metern Abstand, wer vorn liegt, ohne eine Zahl. Aufwand: ~20 Zeilen in `bodenEis`/`zeichneDuett`.

**(b) Referenz-Halo unter dem laufenden Läufer.** Ein weicher Lichtkreis am Kufenpunkt (dieselbe
Stelle wie `zeichneEisstaub`, `:18241`), dessen **Radius und Helligkeit** aus dem Verhältnis seiner
laufenden Summe zum Zwischenstand-Führenden **bei gleichem Elementstand** kommen: liegt Draco nach
8 von 12 Elementen über dem, was der Führende nach 8 Elementen hatte, ist der Halo groß und
teamfarben-hell („auf Rekordkurs" — die Lead-Line-Logik); liegt er darunter, ist er klein und
grau. Vergleichsbasis: `runden[0..aktuell]` des Führenden aufsummiert — gelesen wird nur, was schon
enthüllt ist (dieselbe Spoiler-Regel wie `zeichneEisStand`). Das ist die Schwimm-Rekordlinie in eine
Reihen-Disziplin übersetzt: die Referenz ist der Beste-bis-hier, nicht ein Gegner im Bild.
Aufwand: ~30 Zeilen, eine Hilfsfunktion `kuerReferenzBei(elementIdx)`.

**(c) Vorsprungsbalken an der Bande.** Ein waagerechter Balken entlang der oberen Bande, in der Mitte
geteilt, der sich nach links (Heim) oder rechts (Gast) füllt — Länge aus `Σ summe(Heim) −
Σ summe(Gast)` relativ zur bisher enthüllten Gesamtpunktzahl. Das ist Chris' „wer besiegt wen
aktuell" als Teamfrage, im Bild statt im Panel; zugleich das Tauzieh-Muster der Duelle, nur als
Balken statt als Figurversatz. Aufwand: ~15 Zeilen; derselbe Balken passt **unverändert** in
Breaking, Showcase, Wettessen und I-Spy (alle `TEILNEHMER[].summe`), und mit `fsPunkte` in
Basketball/Hockey/Football als Bandenbalken.

Was **nicht** empfohlen wird: Figuren skalieren oder dimmen nach Punkten (der Verlierer wird
unsichtbar — das Gegenteil dessen, was ein Spieler seines eigenen Teams sehen will), und ein
Zahlen-Delta auf dem Eis (dann liest er wieder Zahlen).

### 5.3 Übertragbarkeit

| Chassis / Disziplin | Ebene (a) Farbe der Umrandung | Ebene (b) Halo mit Referenz | Ebene (c) Vorsprungsbalken |
|---|---|---|---|
| Eiskunstlauf, Breaking, Showcase | Bande / Bühnenrand | ja (Referenz = Führender bei gleichem Elementstand) | ja |
| Wettessen, I-Spy | Tischkante / Raumrahmen | I-Spy: Referenz = Truhenpunkte des Führenden bei gleichem Zug | ja |
| Gewichtheben | Podest-Rand | Referenz = Sinclair des Duellgegners (im Bild ist der Duellgegner zu sehen — dort greift stattdessen das Tauzieh-Muster) | ja, je Duell |
| Duelle (Schach, Fechten, Tennis) | — (Tauzieh-Versatz parallel in Bau) | — | ja, als Summe aller Bretter |
| Basketball, Hockey, Football | Bandenlicht in Farbe des Führenden | — | ja (`fsPunkte`) |
| Bahn | — (Rangliste ist die Führung, Vorschlag 4) | Führender trägt den F1-Halo (Marker am Akteur) | — |
| Kampf | Arenarand in Farbe der Seite mit mehr Restleben | — | ja (Σ hp) |

---

## 6. Vorschlag 3 — Score-Bug-Vollausbau

`aktualisiereBbug()` (`:12100`) dupliziert heute drei Texte aus `.scoreline`: Teamname + `em`-Zusatz
je Seite, `score · clock` in der Mitte. Gegen die NBA/NFL-Konvention fehlen drei Dinge, alle als
reine Text-/Klassen-Ergänzung an derselben Funktion:

1. **Kontextzeile** unter der Mitte, je Chassis geliefert: Feldspiel „3. Viertel · Ballbesitz ●"
   (`fsLive.viertel`, Ballträger-Seite), Bahn „Bein 4/6" (Staffel), „Runde 2/3" (Spurt-Oval),
   „Zwischenzeit 2 in 40 %" (Zeitfahren), Bühne „Durchgang 8/12 · Paar 5/6", Kampf „Sudden Death
   in 12 s". Alles Werte, die die vier `updateHud*()`-Funktionen ohnehin berechnen.
2. **Führende in Teamfarbe**: die Score-Ziffer der führenden Seite in `var(--home)`/`var(--away)`,
   die andere neutral. Bei Bahn/Bühne, wo „Score" ein Rangpunktestand oder 1:0-Vorläufig ist, gilt
   dasselbe.
3. **Führungswechsel-Blitz**: `#bbugMitte` bekommt für 0,6 s die Klasse `wechsel` (CSS-Animation:
   heller Hintergrund, kurzer Scale), wenn sich das Vorzeichen von `seiten[0]−seiten[1]` ändert. Ein
   gespeicherter Vorwert, ein Vergleich. Dieselbe Stelle kann `feed(0,"Führungswechsel — …",true)`
   rufen und speist damit Vorschlag 1 mit.

Aufwand gesamt: klein (eine Funktion, ~40 Zeilen, ~10 Zeilen CSS). Nutzen: das Element, das nie aus
dem Bild geht, sagt endlich auch, **wo im Spiel** man ist und **wer vorn** liegt — heute sagt es
nur „wie viel".

---

## 7. Vorschlag 4 (Timing-Tower) und Vorschlag 5 (Zwischenzeiten)

### 7.1 Timing-Tower — eine Rangliste im Bild für Bahn und Bühnen-Auftritt

Das Zeitfahren hat sie schon als DOM-Panel neben der Leinwand (`#ttroster`/`#ttstand`), der
Eiskunstlauf als Canvas-Tafel (`zeichneEisStand`), die Staffel seit Teil A in Tabelle und Kacheln.
Spurt, Climbing, Takeshi, Breaking, Showcase, Wettessen und I-Spy haben **nichts im Bild** — Rang
und Rückstand stehen nur in der Wertungstabelle unter dem Bild.

Vorschlag: **ein** HTML-Overlay `#turm` im `.arenaraum` (Bauart wie `#bahnHud`: absolut, links,
`pointer-events:none`, `[hidden]`-gated), das je Frame eine Liste `{n, seite, rang, delta, trend}`
rendert. Datenlieferant je Chassis:

* Bahn: `bahnRangliste().reihe` — `delta` für Finisher `bahnZeit(u)−bahnZeit(reihe[0])`, für
  Laufende die Hochrechnung `bahnHochrechnung` (Zeitfahren) bzw. Streckendifferenz umgerechnet
  über das Tempo des Führenden (`fortschrittVerlauf`-Interpolation, s. `staffelZeitDelta`, `:27021`).
* Bühnen-Auftritt: `TEILNEHMER` nach `summe`, `delta = summe − max(summe)`, nur für bereits
  Aufgetretene (Spoiler-Regel).
* `trend`: Rang des letzten Frames gespeichert (Map id→Rang, wie `staffelEtappenRaenge`), Pfeil
  auf/ab für 1,5 s — das F1-Signal für Positionswechsel.

Beim Eiskunstlauf ersetzt der Turm die Canvas-Tafel **nicht** (sie trägt die Elementkästen, die
der Turm nicht hat); er wird dort nicht eingeblendet. Aufwand: mittel (Overlay + drei Lieferanten
+ CSS, ~150 Zeilen). Nutzen: sieben Disziplinen bekommen die Rangliste ins Bild, in der Bauart, die
Chris meint („so live tv artige displays wie das bei rennen").

### 7.2 Zwischenzeiten für alle Bahnen

`BAHN_ART["time-trial"].zwischenzeiten:[0.40,0.76]` (`:25205`) ist die einzige Instanz. Der Code
dahinter ist vollständig generisch: Aufzeichnung in `stepSpurt` (`if(BA().zwischenzeiten)`,
`:27119`), Tabellenspalten ZZ1/ZZ2 mit Diff zur Feldbestzeit (`WERTUNG_RENNEN`, `:25847`),
Markierungen auf der Strecke (`:28158`), Sonde (`:32768`). Für Spurt, Climbing, Takeshi und Staffel
fehlt nur die Konfigurationszeile — bei der Staffel sinnvoll als Bein-Grenzen (`[1/6, 2/6, …]`),
dann zeigt die ZZ-Spalte den Rückstand **beim Wechsel**, exakt die Staffel-Grafik der Leichtathletik.

Aufwand: trivial. Risiko: `u.zz` wird in `stepSpurt` nur geschrieben und sonst nur gelesen — vor
dem Einschalten trotzdem `miss-alle-disziplinen.mjs 24 spurt climbing takeshis-castle staffel`
vorher/nachher fahren, weil `stepSpurt` der Motor selbst ist (Erwartung: identisch; die
Aufzeichnung ruft kein `rr()`).

---

## 8. Priorisierung, Aufwand, Reihenfolge

| Reihe | Vorschlag | Warum an dieser Stelle |
|---|---|---|
| 1 | **1 Highlights schärfen** (Bahn, Kampf, Basketball) | kleinster Aufwand, größter Hebel: Callout, Ticker und Höhepunkte-Liste existieren und laufen für drei Chassis heute leer oder über |
| 2 | **3 Score-Bug-Vollausbau** | eine Funktion, alle zwanzig Disziplinen, liefert das Führungswechsel-Ereignis, das 1 braucht |
| 3 | **2 Eiskunstlauf** (a)+(c), dann (b) | Chris' konkreter Wunsch; (a) und (c) sind je ein Nachmittag, (b) braucht die Referenzfunktion |
| 4 | **5 Zwischenzeiten** | eine Zeile je Disziplin, nur Messung davor/danach |
| 5 | **4 Timing-Tower** | größter Einzelaufwand; profitiert von 5 (Delta am Split) und 3 (Führungswechsel) |
| 6 | **2 für die übrigen Bühnen/Feldspiele** | derselbe Balken, Disziplin für Disziplin |

Kein Punkt berührt `wert()`, `stepSim`/`stepSpurt`/`stepBuehne`/`stepFeldspiel` oder einen
`rr()`-Aufruf — mit einer Ausnahme, die zu prüfen ist: Vorschlag 5 schaltet in `stepSpurt` einen
Aufzeichnungszweig ein. Abnahme wie in Runde 1: `miss-alle-disziplinen.mjs` vorher/nachher je
betroffener Disziplin, Zahl muss auf drei Stellen identisch bleiben.

---

## 9. Offene Fragen an Chris — mit Voreinstellung

1. **Wie viele Highlights je Spiel sind richtig?** Voreinstellung: 4–10 (Hockey-Größenordnung).
   Weniger heißt „nur K.o./Tor/Zieleinlauf", mehr wird wieder ein Protokoll.
2. **Bandenlicht in Teamfarbe (5.2 a): permanent oder nur nach einem Führungswechsel für ein paar
   Sekunden?** Voreinstellung: permanent, aber dezent (30 % Sättigung), beim Wechsel kurz voll.
3. **Timing-Tower links oder rechts?** Voreinstellung: links (F1-Konvention, und der Zwischenstand
   des Eiskunstlaufs sitzt dort schon — gleicher Ort, gleiche Bedeutung).
4. **Zwischenzeiten in der Staffel an den Bein-Grenzen oder in festen Streckenanteilen?**
   Voreinstellung: Bein-Grenzen.

---

## Quellen im Repo

* `public/mockups/battle-mode.engine.js` — Zeilen wie oben angegeben (Stand dieses Branches).
* `public/mockups/battle-mode.html`, `battle-mode.css` — `#bbug`, `#bbugcallout`, `#bahnHud`, `.ttfokus`.
* `docs/design/broadcast-praesentation-uebergreifend-recherche-06-09.md` — Runde 1 (Bug, Callout, Highlights, Captions).
* `docs/design/staffel-oval-broadcast-hud-recherche-06-09.md` — Staffel-HUD, Delta-Interpolation.
* `docs/design/eiskunstlauf-startreihenfolge-spotlight-recherche-13-09.md` — Spotlight-Rotation, Zwischenstand-Tafel (ISU-Vorbild).
* `scripts/miss-alle-disziplinen.mjs`, `scripts/screenshot-disziplin.mjs` — Messung und Sichtprüfung.
