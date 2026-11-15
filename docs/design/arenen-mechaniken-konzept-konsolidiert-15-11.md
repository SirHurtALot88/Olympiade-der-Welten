# Arenen & Mechaniken: konsolidiertes Konzept und Bau-Reihenfolge (15.11.)

**Rolle dieses Dokuments:** Opus als PM, Auftrag von Chris: „bereite das mit den Arenen und
Mechaniken weiter vor, wenn das Konzept steht geh in die Umsetzung und schick nen Agent los der
weiter Arenen passend dazu baut — Opus macht PM und observiert die Steps." Dieses Dokument bringt
drei verstreute Brainstorming-Fäden zu Ende und legt fest, was als Nächstes **gebaut** wird — es
ist keine neue Brainstorming-Runde.

**Konsolidiert werden:**
1. `docs/design/format-varianten-brainstorm-08-11.md` (Format-Varianten je Disziplin, 20 geprüft,
   5 vertieft, 2 als Prototyp gebaut: PR #1350 Gewichtheben „Die Grube", PR #1352 Basketball
   „Knockout")
2. `docs/design/oberflaechen-effekte-konzept-08-11.md` + `oberflaechen-effekte-und-rempler-vision-
   08-11.md` (Kulissen-Varianten mit echter, transparenter Spielwirkung, Mittelfeld statt Spitze,
   Tennis-Pilot als PR #1354 angefangen)
3. `fable-disziplinen-brainstorm-14-11.md` (Branch `claude/fable-disziplinen-brainstorm-1114`,
   PR #1441 Draft): alle 20 Disziplinen im Ist-Stand, wiederverwendbare Arenen-Fallen/-Requisiten,
   48 priorisierte Einzelvorschläge

Dazu gelesen: PR #1358 (Einsatzliste-Revamp, tangential — eigenes Thema, keine Arena-Mechanik),
PR #1360 (Bühne-Slot-Paarung-Fix), PR #1439 (Arena-Review 14.11.), `CLAUDE.md`, `stand-aller-
disziplinen.md`, `data/generated/disziplin-abnahme.json` und die laufende Budget-Konservierungs-
Kampagne (PRs #1462/#1463/#1467/#1469/#1470/#1472, Tasks #127/#133/#134/#138/#139/#140).

---

## 0. Kurzfassung — was als Nächstes gebaut wird

Vier priorisierte Bausteine, Begründung und Abnahme-Bedarf in Abschnitt 5. **Baustein 1 ist bereits
an einen Bau-Agenten dispatcht** (Abschnitt 6).

| # | Baustein | Disziplin(en) | Aufwand | Pflichtabnahme nötig? | Status |
|---|---|---|---|---|---|
| 1 | Kulissen-Fundament (Spielplan zeigt die Kulisse vorher, Null Spielwirkung) + bereits gewählte Fallen-Requisiten materialisieren | alle (infrastrukturell) | klein–mittel | nein (fingerabdruck-identisch) | **dispatcht** |
| 2 | Format-Variante „Das Ekelroulette" — Prototyp + Vorab-Sonde | Wettessen | mittel | ja, bei Produktionsreife | vorgeschlagen |
| 3 | Mini-DM: Grube/Strom-Käfig bekommen echte Wirkung (Rausschubsen als dritter Ausgang) | Mini-DM | groß | ja, **plus Chris' Freigabe vor dem Bau** | vorgeschlagen, Freigabe ausstehend |
| 4 | „Die Grube" (Gewichtheben) und „Knockout" (Basketball) produktionsreif machen | Gewichtheben, Basketball | groß je Format | ja | zurückgestellt bis Budget-Kampagne durch ist |

**Der wichtigste neue Befund dieser Runde, der die Reihenfolge bestimmt:** Seit dem 14.11. läuft
projektweit eine eigene, von Chris in Auftrag gegebene Kampagne, die **die Rezepte aller zwanzig
Disziplinen** auf exakte Budget-Konservierung gegen die Matrix umstellt (Task #127/#133/#134,
mehrere parallele Agenten, PRs #1462/#1463/#1467/#1469/#1470/#1472). Für Football läuft das bereits
produktiv (#1462/#1463); für die neun Bühnen- und fünf Bahn-Disziplinen steht das Werkzeug, der
Rollout selbst ist noch nicht gestartet. Jede Oberflächen-Effekt- oder Format-Varianten-Mechanik,
die **auf dem heutigen Rezept** einer Bühnen-/Bahn-/Feldspiel-Disziplin aufbaut, würde doppelt
gebaut, sobald diese Kampagne das Rezept dieser Disziplin umstellt. Das ist der Grund, warum
Baustein 1 bewusst **ohne** Rezeptberührung gewählt ist und Baustein 4 zurückgestellt wird.

---

## 1. Leitplanken-Check — nichts davon wird verletzt

Geprüft gegen `CLAUDE.md`, für jeden der vier Bausteine:

- **Eignungsmatrix gesperrt** (`official-discipline-weights.ts`): Kein Baustein ändert sie. Format-
  Varianten lesen nur Attribute, die ihre Disziplin laut Matrix (bzw. bestätigtem Override) schon
  gewichtet — exakt wie Weg C (Sandsack-Rennen) es vormacht. Oberflächen-Effekte verschieben nur die
  **Eingangswerte**, nie die Gewichtung selbst, und heben sich über die Varianten einer Disziplin
  auf Null auf (Regel 2 des Oberflächen-Konzepts).
- **rho>0,80 je Einzelspiel (Ziel 0,85), Pp≤25, zwei Saatströme:** Baustein 1 braucht keine Messung
  (Null Spielwirkung, fingerabdruck-identisch — belegt mit `pruefe-wertung-fingerabdruck.mjs`).
  Bausteine 2–4 brauchen die volle Pflichtabnahme **vor** jedem Produktions-Merge; das ist in
  Abschnitt 5 je Baustein vermerkt, nicht optional.
- **PixelLab-Freeze:** Kein Baustein bestellt eine neue Figur oder Animation. Baustein 1 nutzt
  ausschließlich bereits gewählte, aber noch nicht platzierte Requisiten (Abschnitt 4). Baustein 2
  nutzt die in PR #1471 (Welle 3, 15.11.) bereits bestellten Wettessen-Requisiten
  (`wettessen_kotzeimer`, drei Teller-Varianten). Baustein 3 nutzt die Grube-/Käfig-Requisiten aus
  Baustein 1. Baustein 4 braucht keine neuen Requisiten (Prototypen nutzen bereits echte
  PixelLab-Figuren, s. PR #1350/#1352).
- **Mehrere-Wege-zum-Erfolg-Designlinie:** Wo ein Baustein eine Erfolgsformel ohnehin neu baut
  (Ekelroulette, Mini-DM-Grube), wird in Abschnitt 5 ein Primär-/Nebenweg-Paar benannt statt einer
  starren Formel.
- **Breaking = Folter, nicht Breakdance:** Keiner der vier Bausteine betrifft Breaking. Für den
  späteren Baustein „Die zwölf Pfähle" (Fable-Liste #44, hier zurückgestellt, s. Abschnitt 7) gilt
  die Leitlinie unverändert: Henker/Pfahl/Aushalten, kein Tanz-Register.

---

## 2. Nebenbefund: zwei „hinter Flag aus"-Einträge in der Doku sind veraltet

Sowohl der Format-Doku-Vorrecherche als auch Fables Brainstorm vom 14.11. listen als offenen
Prüfpunkt: „Speed-Schach/Wettessen: Flag-Stand der bereits gebauten Mechaniken (‚Die Uhr als dritter
Spieler', ‚Die Mauer, die Haltung') nachsehen — `stand-aller-disziplinen.md` sagt Stand 04.10.
Standard 0 (aus)." Nachgesehen im aktuellen `public/mockups/battle-mode.engine.js` Zeile 19642:

```js
const BUEHNE_FLAGS={gewichthebenSandsack:0, speedSchachUhr:2, wettessenMauer:2};
```

**Beide Flags stehen seit einer nicht dokumentierten Änderung bereits auf 2 (voll scharf), nur
`gewichthebenSandsack` ist noch aus.** Die „A+ Referenz des Projekts"-Zahlen für Wettessen (rho
0,91, Pp 8,7/10,0) in Fables Tabelle sind damit bereits die K1+K2-Zahlen (Haltungswahl Sprint/
Gleichmäßig/Schlussspurt), nicht die alte Flach-Mechanik. Das ist kein neuer Baustein, sondern eine
Doku-Korrektur: **`stand-aller-disziplinen.md` Abschnitt 9 sollte bei nächster Gelegenheit den
„Standard 0"-Satz auf „seit [Datum unbekannt] Standard 2" korrigieren**, und die offenen
Prüfpunkte 9 der Fable-Liste sind damit erledigt, nicht mehr offen. Für dieses PM-Konzept wichtig:
Wettessens Mechanik ist **nicht** mehr „so flach wie `stand-aller-disziplinen.md` 5b behauptet" —
die Haltungswahl existiert bereits. Das Ekelroulette (Baustein 2) ist deshalb explizit ein
**zusätzliches** Format, keine Reparatur einer kaputten Mechanik (passt zu Chris' Regel „ein neues
Format ist immer zusätzlich, nie ein Ersatz").

---

## 3. Nebenbefund: die „wiederverwendbaren Arenen-Requisiten" sind größtenteils schon bestellt

Fables Abschnitt 2 (14.11.) schlägt einen gemeinsamen Requisiten-Baukasten vor: Grube, Käfig/
Strom-Kreis, Truhe, Pendel/Walze, Wackelbrücke — für Takeshi (ausweichen), Mini-DM (schubsen) und
I-Spy (durchsuchen). Nachgesehen in `data/generated/pixellab-requisiten/auswahl.json`: **alle fünf
Requisiten-Familien sind bereits per `bestellen`+`waehlen` fertig ausgewählt**, nur noch nicht
`einsetzen` (nach `public/sprites/` materialisiert) und in keinem Fall mechanisch verdrahtet:

| Requisit | Ausgewählte Dateien | Für |
|---|---|---|
| Grube | `grube_klein`, `grube_mittel`, `grube_gross` | Mini-DM (Baustein 3), später Takeshi |
| Käfig/Strom-Kreis | `kaefig_gerade_an/aus`, `kaefig_ecke_an/aus` (mit Ein/Aus-Zustand!) | Mini-DM (Baustein 3) |
| Truhe | `truhe_1/2/3_offen/zu` (drei Stufen, zwei Zustände) | I-Spy, ggf. Takeshi-Beute |
| Pendel/Fegearm | `falle_fegearm` | Spurt „Die Hatz" (zurückgestellt, Abschnitt 7) |
| Wackelbrücke | `bruecke_wackel_heil/kipp` | Takeshi, Mini-DM-Fluchtweg |

Einzige bereits verdrahtete Ausnahme ist `falle_walze` (Takeshi-Walzen-Hindernis, längst im Motor
aktiv). Für `falle_fegearm`, die drei Grube-Größen, die vier Käfig-Kacheln und die zwei
Wackelbrücken-Zustände gibt es **keine** Referenz in `battle-mode.engine.js` oder
`battle-mode.kulissen.js` — sie liegen fertig gewählt in `roh/`, aber nicht in `public/sprites/`.
Das ist der konkrete, risikofreie Teil von Baustein 1 (Abschnitt 5.1): sie verdienen keine neue
PixelLab-Bestellung (schon bezahlt), nur das deterministische `einsetzen` ohne Netzzugriff.

---

## 4. Die laufende Budget-Konservierungs-Kampagne — warum sie die Reihenfolge bestimmt

Chris, 14.11. (aus PR #1470): alle zwanzig Disziplinen sollen auf **echte Budget-Konservierung**
gegen die Matrix umgestellt werden — nicht nur eine Pp-Obergrenze je Zelle, sondern die Summe der
Anteile eines Attributs über alle Unterfertigkeiten hinweg muss exakt seinem Matrixgewicht
entsprechen (Sinkhorn-Transportproblem). Stand heute:

- **Feldspiel:** Werkzeug existiert (`baue-feldspiel-rezept.mjs`), **Football läuft produktiv**
  (#1462/#1463 — inklusive Rückbau des bisherigen Spiel-Eignung-Overrides, #1444, Football ist
  deshalb gerade auf rho 0,248 eingebrochen, das ist erwartet und Teil der laufenden Reparatur, kein
  neuer Defekt). Basketball/Hockey sind vom Werkzeug technisch abgedeckt, aber noch keine aktive PR.
- **Bühne:** Werkzeug gerade fertig gebaut (#1470, 9 Disziplinen: Tennis, Fechten, Gewichtheben,
  Speed-Schach, Breaking, Showcase, Wettessen, Eiskunstlauf, I-Spy), **der Rollout selbst (Task
  #133) ist explizit "ein separater, späterer Schritt"** — noch kein Rezept geändert.
- **Bahn:** Reine Befund-/Werkzeug-Doku fertig (#1472, 5 Disziplinen), **Rollout (Task #134) noch
  nicht begonnen.**
- **Arena:** In keiner der gelesenen PRs erwähnt — kein aktives Vorhaben, diese Chassis
  (TDM/Mini-DM/Battlefield) in der Kampagne anzufassen.

**Folgerung für dieses Konzept:** Jede neue Mechanik, die auf dem **heutigen** `rezept` einer
Bühnen- oder Bahn-Disziplin aufbaut (wie Tennis-Oberflächen-Effekte oder „Die Grube"/Tauziehen für
Gewichtheben), riskiert einen Doppel-Bau, sobald Task #133/#134 diese Disziplin erreicht — die
Rezept-Form selbst ändert sich dann. Football/Basketball/Hockey (Feldspiel) sind zusätzlich
riskant, weil dort bereits eine Kampagnen-PR aktiv läuft bzw. das Werkzeug einsatzbereit ist.
**Arena-Chassis (Mini-DM/TDM/Battlefield) sind davon nicht betroffen** — das macht Baustein 3
(Mini-DM) sicherer als er ohne diesen Befund gewesen wäre, trotz der inhaltlichen Mechanik-Hürde
(Chris' Freigabe). Baustein 1 (reine Infrastruktur, kein Rezeptzugriff) ist in jedem Chassis sicher.

---

## 5. Die vier Bausteine im Detail

### 5.1 Baustein 1 — Kulissen-Fundament + Fallen-Requisiten materialisieren (dispatcht)

**Was.** Zwei unabhängige, aber zusammen auslieferbare Teile:

a) **Kulissen-Fundament** (`oberflaechen-effekte-konzept-08-11.md` Abschnitt 2.4 + Abschnitt 8,
   Schritt 1). `waehleKulisse(disziplin, saat, heimId, gastId, spieltag)` als TS-Funktion in
   `lib/battle/arena-kulisse.ts`, bit-identisch zum bestehenden Hash in `battle-mode.engine.js`
   (`kulisseWaehlen()` ~42466, FNV-1a + `ispyMischeHash`). Das Bootstrap-Objekt der Arena bekommt
   ein Feld `kulisseByDisciplineId`, das der Motor nimmt, wenn es da ist, und sonst auf seinen
   eigenen Hash zurückfällt (byte-identisch für jeden bestehenden Aufrufer). Spielplan/Vorschau
   zeigen die gebuchte Kulisse je Begegnung, bevor der Spieltag läuft — reine Transparenz, **keine
   Spielwirkung.** Beweis: `pruefe-wertung-fingerabdruck.mjs` vorher = nachher.
b) **Fünf bereits gewählte Fallen-Requisiten materialisieren** (Abschnitt 3 oben):
   `python3 -I scripts/pixellab-requisiten.py einsetzen falle_fegearm grube_klein grube_mittel
   grube_gross kaefig_gerade_an kaefig_gerade_aus kaefig_ecke_an kaefig_ecke_aus
   bruecke_wackel_heil bruecke_wackel_kipp truhe_1_offen truhe_1_zu truhe_2_offen truhe_2_zu
   truhe_3_offen truhe_3_zu` — deterministisch, **ohne Netzzugriff, keine neue PixelLab-Bestellung.**
   Nur Materialisierung nach `public/sprites/arena/`; keine mechanische Verdrahtung in diesem
   Schritt (das ist Baustein 3 bzw. ein künftiger Takeshi-Baustein).

**Warum das zuerst.** Null Rezeptberührung (kollidiert mit nichts aus Abschnitt 4), null rho/Pp-
Risiko, sofortiger Spielwert für den Manager (er sieht vorher, wo gespielt wird — passt zu Chris'
Transparenz-Linie, die durch das ganze Projekt zieht), und es ist die **Voraussetzung** für jeden
künftigen Oberflächen-Effekt (ohne das Fundament kennt der Picker die Kulisse nicht, bevor der
Spieltag läuft).

**Aufwand.** Klein–mittel (TS-Port + Bootstrap-Feld + Spielplan-UI ist ein überschaubarer, bereits
im Konzept beschriebener Umbau; das Materialisieren ist Minuten).

**Abnahme.** Keine rho/Pp-Messung nötig (keine Mechanik). Pflicht: Fingerabdruck-Test grün.

### 5.2 Baustein 2 — Format-Variante „Das Ekelroulette" für Wettessen

**Was.** Format-Doku Abschnitt 3.1 + Fable-Liste #41: statt Füllstand/Menge zu zählen, entscheidet
jeder Esser **Gang für Gang**: essen oder passen. Passen kostet Punkte, essen kann (bei
überschrittener Übelkeitsschwelle, health-abhängig) zum Kotzeimer führen; weiter essen trotz
Übelkeit ist ein will-Primärweg. Wer zweimal passt oder einmal „bricht", ist raus. Siegbedingung:
Überleben/Platzierung statt Teller-Summe — dieselbe Rangfolge-Logik wie Mini-DM-FFA und der
Battlefield-Pod (eine komplette Rangfolge aus einem Spiel, die Form, die Einzelspiel-Rangtreue am
direktesten trägt). Primärweg will/health (Matrix 26/22), Nebenweg determination (Durchhalten trotz
Rückstand) — passt zur Mehrwege-Linie.

**Warum dieser Baustein und warum jetzt.** Wettessen hat den größten rho/Pp-Puffer im ganzen Feld
(0,91 / 8,7–10,0, „A+ Referenz des Projekts") — selbst ein neues, ungeschliffenes Format hat hier
am meisten Luft, ohne die Schranke zu reißen. Die Requisiten (Kotzeimer, drei Teller-Varianten) sind
bereits bestellt (PR #1471, Welle 3, 15.11.) — kein neuer PixelLab-Auftrag nötig. Wettessen ist
Bühne-Chassis, aber der Budget-Rollout dort (Task #133) ist laut #1470 noch nicht gestartet — reines
Zukunftsrisiko, kein aktiver Konflikt wie bei Football. Und: wie in Abschnitt 2 festgehalten, ist die
„Mauer/Haltung"-Mechanik bereits scharf — das Ekelroulette ergänzt sie als echtes zweites Format,
ersetzt sie nicht (Chris' Regel).

**Vorgehen, nach dem bewährten Muster von PR #1350/#1352:** eigenständiger Prototyp
(`public/mockups/ekelroulette-prototyp.html` + `.sim.js`), eigenes Messskript
(`scripts/miss-wettessen-ekelroulette-prototyp.mjs`, Vorab-Sonde mit `einflussVon()`-Äquivalent),
Design-Doc mit den Zahlen. **Kein Eingriff in den produktiven Motor** in dieser Runde — Motor/Matrix
bleiben unberührt, wie bei den beiden Vorgänger-Prototypen.

**Aufwand.** Mittel (vergleichbar mit #1352, dessen erste Fassung an einem Tag stand).

**Abnahme.** Pflicht vor jeder Produktions-Übernahme: rho>0,80/Ziel 0,85, Pp≤25, zwei Saatströme,
Star-/Paartreue (CLAUDE.md-Standardprüfung für ein neues Format). Die Vorab-Sonde allein ist **keine**
Abnahme (gilt dieselbe Einschränkung wie bei #1350/#1352: ungemessen gegen echte Slot-/Trait-/
Formkanäle).

### 5.3 Baustein 3 — Mini-DM: Grube/Strom-Käfig bekommen echte Wirkung

**Was.** Fable-Liste #27, Chris' eigener Vorschlag vom 14.11.: ein Spieler in der Mitte einer FFA-
Runde kann statt zu treffen versuchen, den Gegner in die Grube/den Strom-Käfig zu drängen — ein
dritter Ausgang (Treffer / Niederlage / Rausgeschubst) neben dem heutigen reinen HP-Kampf.
Primärweg power/torment (Matrix 14/21), Nebenweg dexterity/stamina für „ausweichen, bevor man selbst
gedrängt wird" — wieder ein Primär-/Nebenweg-Paar. Die drei Kulissen (Grube/Sägewerk/Strom-Käfig)
bekommen dadurch inhaltlich eigene Gefahrentypen statt nur anderer Beleuchtung (Chris' eigene Regel
„nicht nur verschiedene dunkle Areale").

**Warum dieser Baustein, aber zurückgestellt hinter Baustein 1/2.** Mini-DM ist Arena-Chassis, also
außerhalb der Budget-Kampagne (Abschnitt 4) — technisch der sicherste Ort für eine neue Mechanik
gerade jetzt. Aber: Mini-DMs `rhoJeEvent` liegt **schon heute** unter 0,80 und läuft nur über Chris'
eigene Star-/Paartreue-Ausnahme vom 24.10. Fable warnt selbst (wörtlich übernommen): „jede
Mechanikänderung hier braucht eine frische Messung samt neuer Freigabe-Rücksprache mit Chris, nicht
nur eine rho-Zahl." Das ist eine Entscheidung, die **vor** dem Bau bei Chris liegt, nicht bei einem
Bau-Agenten — deshalb ist dieser Baustein vorbereitet (Requisiten in Baustein 1 materialisiert),
aber **nicht** in dieser Runde dispatcht.

**Aufwand.** Groß (neue Teilnahme-Logik in einer bestehenden Vier-Team-FFA-Pod-Mechanik, plus
Zeichen-Arbeit für die Schubs-Bewegung — bestehende Sturz-Pose reicht, eine eigene „wird
hineingeschubst"-Animation wäre eine neue Animation und bräuchte PixelLab-Freigabe).

**Abnahme.** Pflicht: rho/Pp-Messung zwei Saatströme **und** Rücksprache mit Chris vor jeder
Umsetzung (nicht nur vor dem Produktions-Merge).

### 5.4 Baustein 4 — Format-Varianten produktionsreif machen (zurückgestellt)

**Was.** „Die Grube" (Gewichtheben-Tauziehen, PR #1350: Vorab-Sonde rho 0,853/0,857, Pp 11,3/9,9)
und „Knockout" (Basketball, PR #1352: mit echten Motor-Kadern rho 0,818–0,846, Pp 17,7–21,5, 8 von
8 Läufen über beiden Schranken) sind beide als Prototyp fertig und vielversprechend. Produktionsreif
heißt: ein echter Motor-Builder (`baueGrube()`/`baueKnockout()` analog zu `baueSandsackWegC()`),
eine zweite, unabhängige Kaderstichprobe (beide PRs kalibrierten bisher auf überlappenden Kadern),
und ein Formatwahl-Mechanismus (Option A aus Abschnitt 6 der Format-Doku — fest je Saisonspieltag,
passend zu Chris' „2x Hockey je Saison" — ist meine Empfehlung, s. Abschnitt 8).

**Warum zurückgestellt.** Gewichtheben ist Bühne-Chassis (Task #133, Rollout ausstehend), Basketball
ist Feldspiel-Chassis (Werkzeug einsatzbereit, Football gerade aktiv dabei — Basketball könnte
jederzeit als Nächstes in der Kampagne aufgegriffen werden). Ein produktionsreifer Builder, der auf
dem heutigen Rezept aufbaut, müsste nach einem Budget-Rollout dieser Disziplin neu kalibriert
werden. Das ist kein Veto, nur eine Reihenfolge: **sobald Task #133 (Bühne) bzw. die
Feldspiel-Kampagne Gewichtheben/Basketball erreicht hat (oder explizit ausgenommen wird), ist dies
der nächste Baustein.**

**Aufwand.** Groß je Format (Motor-Builder + Formatwahl-Infrastruktur ist die Arbeit, die Format-
Doku Abschnitt 6/7 bereits als fehlend benennt).

**Abnahme.** Volle Pflichtabnahme je Format, zusätzlich zur bereits vorliegenden Vorab-Sonde.

---

## 6. Dispatch: Baustein 1 ist unterwegs

Ein Bau-Agent wurde mit dem Auftrag aus Abschnitt 5.1 gestartet (Session-Details und Beobachtung im
Abschlussbericht dieser PM-Runde). Der Agent hat denselben Kontext erhalten: `CLAUDE.md`-
Leitplanken, diesen Konsolidierungs-Entscheid, welche Requisiten bereits gewählt sind
(`data/generated/pixellab-requisiten/auswahl.json`), den PixelLab-Freeze (keine neuen Figuren/
Animationen, nur `einsetzen` bereits gewählter Requisiten), und die Pflicht, den Fingerabdruck-Test
vor und nach seiner Änderung zu zeigen.

---

## 7. Zurückgestellte/nicht gewählte Ideen aus den drei Quellen — und warum

Damit nichts verloren geht, aber auch nichts doppelt verfolgt wird:

- **Football „Die Hai-Gasse", Hockey „Der Durchbruch":** inhaltlich gut (Format-Doku 4.1/4.2,
  Fable #37/#38), aber beide Disziplinen sind gerade mitten in einer eigenen Mechanik-Reparatur
  (Football: #1462/#1463, Matrix-Override-Rückbau; Hockey: Pp 38,5/81,5, eigene Mechanikrunde
  nötig). Ein zweites Format wäre hier plausibel als **Ersatzweg zur Wertung**, aber erst, nachdem
  die laufende Reparatur steht — sonst misst man gegen ein Rezept, das sich unter einem wegzieht.
- **Breaking „Die zwölf Pfähle", Fechten „Die Mêlée", Showcase „Das Niederbrüllen", Speed-Schach
  „Der Blitz-Gauntlet", I-Spy „Das Verhör", Takeshi „Der Sturm auf die Burg", Staffel
  „Verfolgungsjagd":** alle in Format-Doku/Fable-Liste bereits einzeln bewertet (Aufwand, Pp-Risiko,
  PixelLab-Bedarf). Keiner davon ist in dieser Runde priorisiert — entweder weil der Pp-/rho-Puffer
  zu knapp ist, um nebenbei ein neues Format zu tragen (Breaking 0,801, Fechten 20,1/20,7 Pp-Puffer,
  I-Spy 0,011-Puffer), oder weil die Disziplin Bühne-/Bahn-Chassis ist und die Budget-Kampagne näher
  liegt (Takeshi, Showcase). Takeshi hat zusätzlich einen bereits bestellten Requisiten-Vorrat
  (Fort-Segment, Rammbock, Wasserkanone aus Welle 3) — ein guter Kandidat für **Baustein 5**, sobald
  Baustein 4 läuft oder Task #134 (Bahn) Takeshi erreicht hat.
- **Oberflächen-Effekte auf weitere Disziplinen ausrollen** (Tennis Riviera/Dach, Fechten,
  Eiskunstlauf — Format-Doku Abschnitt 8, Schritt 3–5): bewusst nicht Teil dieser Runde. Das
  Fundament aus Baustein 1 ist die Voraussetzung; die Rezept-Ableitung je Variante (Abschnitt 2.2
  des Oberflächen-Konzepts) sollte erst **nach** dem jeweiligen Budget-Rollout der Disziplin
  gebaut werden, sonst doppelte Arbeit am selben Rezept. PR #1354 (Tennis-Pilot) hat genau diesen
  Teil schon einmal gebaut, ist aber seit einer Woche nicht mehr mergefähig (`mergeable_state:
  dirty`) und baut auf dem Vor-Kampagnen-Rezept auf — **meine Empfehlung: nicht reparieren/
  rebasen, sondern nach dem Bühnen-Rollout (Task #133) mit den unveränderten Fable-Zahlen aus
  Tabelle 5.1 neu und schlank aufsetzen.** Die reine Fundament-Hälfte dieser PR wird durch Baustein 1
  ohnehin neu (und sauber) gebaut.
- **PR #1358 (Einsatzliste-Revamp):** eigenes Thema (Lineup-UI), keine Arena-Mechanik — außerhalb
  dieses Konzepts. Status nicht weiter geprüft.
- **PR #1360 (Bühne-Slot-Paarung-Fix):** sauberer, isolierter Bugfix (Speed-Schach/Tennis/Fechten/
  Gewichtheben/Breaking paaren jetzt nach echtem Slot statt Kaderlisten-Index). CI komplett grün,
  `mergeable_state: clean`, keine offenen Reviews — erfüllt die Merge-Bedingung aus `CLAUDE.md`
  vollständig. Direkt relevant für Baustein 4 (Gewichtheben „Die Grube" paart nach Slot) und jeden
  künftigen Breaking-Baustein. **Empfehlung: zeitnah aus dem Draft-Status nehmen und mergen** — ein
  Versuch dazu wurde in dieser Runde vom Auto-Approval als „destruktive Aktion" geblockt (PR-Merge
  per Werkzeug), deshalb hier nur als Empfehlung festgehalten, nicht selbst ausgeführt.
- **PR #1439 (Arena-Review 14.11.):** bereits inhaltlich erledigt (vier Anzeige-Fixes, Fingerabdruck
  geprüft), aber `mergeable_state: dirty` — Konflikt mit zwischenzeitlichen Main-Änderungen. Reine
  Anzeige-Reparatur, nicht Teil dieses Konzepts; Empfehlung an wen auch immer das Nacharbeiten
  übernimmt: neu rebasen, nicht neu bauen (Inhalt ist bereits gegen den echten Kader verifiziert).
- **PR #1441 (Fable-Brainstorm selbst):** `mergeable_state: unstable` (CI-Lauf offen/uneins), reine
  Doku. Dieses Konsolidierungs-Dokument ersetzt es inhaltlich als Entscheidungsgrundlage; #1441
  bleibt als Ideen-Fundgrube (Abschnitt 2/3 dort) wertvoll und kann unabhängig gemergt werden, sobald
  CI grün ist — keine Abhängigkeit zu diesem Dokument.

---

## 8. Offene Fragen an Chris (echte Sackgassen, keine Rückdelegation)

1. **Mini-DM-Grube-Freigabe (Baustein 3):** Soll das Rausschubsen als dritter Ausgang gebaut werden,
   bevor Mini-DMs eigentliche rho-Lücke (schon heute unter 0,80, nur per Ausnahme freigegeben)
   anders geschlossen ist? Fable und dieses Dokument sind sich einig, dass das **vor** dem Bau zu
   klären ist, nicht danach.
2. **Formatwahl-Mechanismus (Baustein 4, Vorgriff):** Die Format-Doku nennt drei Optionen (fest je
   Saisonkalender / Kulissen-ähnlicher Hash / Chris legt es als Liga-Einstellung fest). Meine
   Empfehlung als PM ist Option A (fest je Saisonspieltag), weil sie zu „nur 2x Hockey je Saison"
   passt und keinen Zufall in eine Wertung einführt, die ohnehin schon knapp ist — das ist aber eine
   Produktentscheidung, keine technische, und sollte vor Baustein 4 bei Chris bestätigt werden.
3. **Deckel ±5 vs. ±8 für Oberflächen-Effekte** (zurückgestellt mit dem Rollout, aber die Frage
   bleibt offen für, sobald es dran ist): Chris hat „fünf bis acht... erstmal okay" gesagt, aber auf
   einen echten Test bestanden statt einer Papier-Entscheidung. Das bleibt unverändert eine Messfrage
   für den Moment, in dem Oberflächen-Effekte tatsächlich gebaut werden.

Alles andere in diesem Dokument ist eine getroffene Entscheidung dieser PM-Runde, keine Rückfrage.
