# Breaking: Phasen + Peiniger (K4, Konzeptrunde 14.10.) — Messung statt Umsetzung

**Reine Konzept-/Messrunde. Kein Code an der echten `battle-mode.engine.js` geändert.**
Grundlage: `docs/design/fable-konzept-chris-feedback-13-10.md` Abschnitt 5.4 „K4 — Breaking:
Phasen, Peiniger, Verfall" sowie 3.7 „Q7 — Die Kontaktregel" und 3.8 „Q8 — Zustand am
Charakter" sowie Task #120 Punkt 19 (`docs/design/chris-feedback-breite-runde-13-10.md`),
Chris wörtlich: „dass Spieler 1 quasi erst 'angreift' und der andere es ertragen muss für
zb 15 Sekunden und dann der Wechsel kommt und da muss man auch sehen können welcher Spieler
eher offensiv stark ist wie Assassinen und wer defensiv gut einstecken kann etc. Kann man
das optisch irgendwie an den Charakteren zeigen? sowas wie Erschöpfung, Blut oder so?"

**K4 hat drei Teile. Teil 3 ist bereits gebaut, gemessen und gemerged:** „Verfall am
Körper" (Q8) — PR #1207, `app/foundation/discipline-stage/arena/disciplines/breaking.tsx`,
drei Stufen (Schweiß/Prellungen/Blut), rein dekorativ, liest `normOf(score)` (das schon
bestehende „wie nah am Brechen"-Signal dieser Datei, s. deren Zonen GEBROCHEN/
SCHMERZGRENZE/STONE FACE/MIND FORTRESS). `miss-alle-disziplinen.mjs 24 breaking` bleibt
bit-identisch (0,801/0,944) — erwartbar, die Primitive ist reine Präsentation in der
React-Arena, der Canvas-Motor, den dieses Skript misst, ist unberührt.

Dieses Dokument ist für die **beiden anderen Teile: „Phasen statt Ping-Pong" und „Der
Peiniger wirkt"**. Beide sind Messpflicht (CLAUDE.md: rho > 0,80 je Spiel, Pp ≤ 25 in zwei
Saatströmen), und Breaking steht laut Konzeptdokument bei einem „dünnen Puffer" (0,801).
Die Messung unten zeigt: **der Puffer ist dünner, als die zitierte Zahl nahelegt — und ein
Teil dessen, was hier als offene Frage behandelt wurde, ist in Wahrheit bereits
beantwortet, weil der Code weiter ist als das Konzeptdokument.**

---

## 0. Wichtigste Korrektur zuerst: B1/B2/B4/B5 sind nicht offen — sie sind bereits live

Das Konzeptdokument (5.4) schreibt: „Der Peiniger wirkt (B2 aus dem Fable-Papier 30.09.,
gedeckelt ±20 %). Erst damit ist 'offensiv stark wie Assassinen' eine Eigenschaft und nicht
nur ein Bild" — als wäre B2 noch ungebaut. Das ist **nicht mehr der Stand im Motor.**

`public/mockups/battle-mode.engine.js`, `gauntletRunde()`/`baueGauntlet()`/
`gauntletSchadenFaktor()` (Kommentare „Fable 30.09., Paket 3"):

| Baustein | Stand | Fundstelle |
|---|---|---|
| **B1 — drei Familien, drei Wege** (zehn Geräte, `FOLTER_GERAETE`, Familien zermuerbung/hieb/wucht → NERVEN/TECHNIK/SPITZENMOMENT) | **bereits live** | `GAUNTLET_FAMILIE_GEWICHT` (0,35), `gauntletRunde()` |
| **B2 — der Peiniger wirkt** (Schaden skaliert mit `SPITZENMOMENT` des Zufügenden) | **bereits live, aber bei ±5 %, nicht ±20 %** | `GAUNTLET_PEINIGER_DECKEL=0.05`, `gauntletSchadenFaktor()` |
| **B4 — Verschnaufen zwischen Bouts** | **bereits live** | `gauntletVerschnaufen()` |
| **B5 — Provokation** (hohes WAGNIS holt die nächste Gerätestufe früher, gegen Bonus) | **bereits live** | `GAUNTLET_PROVOKATION_SCHWELLE`/`_ERTRAG` |

Der Code-Kommentar bei `GAUNTLET_PEINIGER_DECKEL` dokumentiert bereits die Messreihe, die
dieses Papier für B2 nachliefern sollte: ±20 % (voller Stapel) maß **0,784** — unter der
Schranke. B2 mit Faktor 1 (de facto ausgeschaltet) isoliert gemessen: **0,802**. Danach
stufenweise gesenkt: ±10 % maß **0,792** (immer noch unter der Schranke), erst ±5 % maß
**0,801** und hält sie. **Das ist exakt die Messung, die dieses Papier als offene Aufgabe
auflistete — sie ist bereits erledigt, nur mit einem anderen Ergebnis (±5 %, nicht ±20 %)
als das Konzeptdokument zitiert.**

Damit ist auch die „Muss klären"-Frage aus 5.4 beantwortet: **„Gehört B1 in dieselbe
Runde?"** — ja, es ist längst in derselben Runde (30.09., Paket 3) gelandet, zusammen mit
B2/B4/B5. Es gibt hier nichts mehr zu entscheiden; **„Assassine bevorzugt einen Gerätetyp"
ist mechanisch bereits möglich** (ein Kämpfer mit hohem SPITZENMOMENT hält gegen die
Wucht-Familie besser stand als gegen Hieb/Zermürbung) — nur noch nicht **sichtbar** gemacht
(das wäre die Q1-Matchup-Karte, s. Abschnitt 4 unten).

**Was tatsächlich noch offen ist: nur „Phasen statt Ping-Pong".** Rollen wechseln heute
nach **jedem** Zug (`ertragenderIstX=!ertragenderIstX` in `baueGauntlet()`, es sei denn ein
K.o. fällt — dann eröffnet immer der frische Herausforderer). Das ist der einzige der drei
K4-Mechanik-Bausteine, der diese Runde tatsächlich neu baut und misst.

---

## 1. Befund zuerst: der heutige Puffer ist dünner als dokumentiert

Die im Konzeptdokument zitierte Zahl (0,801/0,944) kommt aus
`node scripts/miss-alle-disziplinen.mjs 24 breaking` — **n=24 Spiele je Kader-Variante.**
Dieselbe, komplett unveränderte Engine, nur mit **n=48** gemessen:

```
node scripts/miss-alle-disziplinen.mjs 48 breaking
→ rho je Spiel (Median) 0,795   Spannweite 0,294   Abnahme: knapp
```

**0,795 statt 0,801 — unter der Schranke, am UNVERÄNDERTEN Motor.** Das ist kein Fehler
dieses Papiers; es ist eine Eigenschaft der Kaderfamilie: die Spannweite über die fünf
Team-Paarungen liegt bei **~0,29–0,32** (n=24 wie n=48) — mehr als dreimal so groß wie der
Abstand zwischen 0,795 und der 0,80-Schranke selbst. **Die zitierte 0,801 ist eine einzelne
Ziehung aus einer Verteilung, die die Schranke an mehreren Stellen überlappt.** Jede
künftige Breaking-Änderung — nicht nur diese hier — braucht deshalb mehr als eine einzelne
n=24-Messung, um „bestanden"/„durchgefallen" verlässlich zu behaupten. Das ist ein
Befund für sich, unabhängig von Phasen/Peiniger, und gehört an Chris gemeldet: **der
Breaking-Puffer ist heute schon so dünn, dass die Standardmessung (n=24) ihn nicht
zuverlässig von „durchgefallen" unterscheidet.**

---

## 2. Methode: disposable Engine-Kopie, additiver Schalter

Gemessen wurde **nicht** an `public/mockups/battle-mode.engine.js` selbst, sondern an einer
Wegwerf-Kopie (`battle-mode-experiment.engine.js`, nur im Scratchpad dieser Session, nie
committet). Zwei Stellen bekamen einen zusätzlichen, rein additiven Schalter
(`window.__gauntletExperiment = {phase, deckel}`):

- **Phasenlänge:** `baueGauntlet()`s Rollenwechsel (`ertragenderIstX=!ertragenderIstX`)
  feuert erst nach `phase` Zügen am Stück statt nach jedem Zug. Ein K.o. wechselt die Rolle
  weiterhin sofort (neuer Herausforderer erträgt zuerst) und setzt den Phasenzähler zurück
  — Phasenlänge betrifft nur den Wechsel **innerhalb** eines laufenden Bouts.
- **Peiniger-Deckel:** `gauntletSchadenFaktor()` liest `deckel` statt der fest verdrahteten
  Konstante.

**Sanity-Check (muss den Produktionswert bit-identisch treffen):**
`{phase:1, deckel:0,05}` (= heutiges Verhalten) → **0,801/0,944 bei n=24**, **0,795/0,946 bei
n=48** — exakt die Werte der echten, unveränderten Engine (Abschnitt 1). Der Mess-Rahmen ist
damit vertrauenswürdig: Abweichungen unten kommen von den Kandidaten, nicht vom Werkzeug.

---

## 3. Messung: Phasenlänge × Peiniger-Deckel

### 3.1 Sweep n=24 (schnelle Übersicht, vier Phasenlängen × drei Deckel)

| Phase | Deckel | rho/Spiel | Spannweite | rho/Saison | Abnahme |
|---:|---:|---:|---:|---:|---|
| 1 | 0,05 (heute) | 0,801 | 0,289 | 0,944 | bestanden |
| 3 | 0,05 | 0,796 | 0,273 | 0,872 | **durchgefallen** |
| 3 | 0,10 | 0,801 | 0,276 | 0,879 | bestanden |
| 3 | 0,20 | 0,770 | 0,263 | 0,909 | **durchgefallen** |
| 4 | 0,05 | 0,830 | 0,230 | 0,916 | bestanden |
| 4 | 0,10 | 0,800 | 0,297 | 0,888 | bestanden (knapp) |
| 4 | 0,20 | 0,766 | 0,269 | 0,858 | **durchgefallen** |
| 5 | 0,05 | 0,805 | 0,267 | 0,928 | bestanden |
| 5 | 0,10 | 0,782 | 0,251 | 0,865 | **durchgefallen** |
| 5 | 0,20 | 0,773 | 0,271 | 0,902 | **durchgefallen** |

### 3.2 Nachmessung n=48, Deckel fest bei den heutigen ±5 % (robusterer Stichprobenumfang)

| Phase | rho/Spiel | Spannweite | rho/Saison | Abnahme |
|---:|---:|---:|---:|---|
| 1 (heute) | 0,795 | 0,294 | 0,946 | **durchgefallen** (= der Befund aus Abschnitt 1) |
| 3 | 0,794 | 0,270 | 0,928 | **durchgefallen** |
| 4 | 0,825 | 0,245 | 0,935 | bestanden |
| 5 | 0,809 | 0,264 | 0,935 | bestanden |

### 3.3 Pp-Abweichung für den auffälligsten Kandidaten (Phase 4, Deckel 0,05), zwei Saatströme

```
Saatstrom 1 (n=48): 13,5 Pp   (will 29,2/28, torment 22,5/22, health 13,3/18, …)
Saatstrom 2 (n=48, Versatz 10.000.000): 12,9 Pp
```

Beide klar unter der 25-Pp-Schranke, nahezu identisch zur heutigen Baseline (14,3/13,9) —
**erwartbar**: die Phasenlänge ändert nur, WANN welcher Teilnehmer würfelt, nicht WELCHE
Attribute in `gauntletRunde()`/`gauntletSchadenFaktor()` einfließen. Pp ist kein
unterscheidendes Kriterium zwischen den Kandidaten.

### 3.4 Die entscheidende Lesung: das Signal ist kleiner als das Rauschen

Die Kaderfamilie-Spannweite liegt **in jeder Zeile** zwischen 0,23 und 0,33. Der größte
Unterschied zwischen zwei Phasenlängen bei gleichem Deckel (0,05) ist **0,03** (0,795 vs.
0,825, Abschnitt 3.2). **0,03 ist nicht von null unterscheidbar, wenn das Kaderrauschen
selbst 0,25–0,33 beträgt** (dieselbe Regel, mit der `docs/design/messgrundlage-kaderfest.md`
schon jede andere Rezeptänderung misst). Weder „Phase 4 ist besser als Phase 1" noch „Phase
3 ist schlechter" lässt sich aus dieser Messung mit Zuversicht behaupten — beide liegen
innerhalb der Kader-zu-Kader-Schwankung derselben, unveränderten Mechanik.

**Was sich daraus trotzdem robust ablesen lässt:**

1. **Der Peiniger-Deckel bei ±10 % oder ±20 % fällt bei jeder getesteten Phasenlänge
   mindestens einmal durch** (3.1) — deckt sich mit der bereits im Code dokumentierten
   Messreihe (Abschnitt 0) und bestätigt sie an einem zweiten Mechanik-Zustand (mit
   Phasen). **Der heutige ±5-%-Deckel bleibt die einzige robust geprüfte Einstellung.**
2. **Keine getestete Phasenlänge verschlechtert rho klar erkennbar gegenüber der heutigen,
   selbst schon wackligen Baseline** — aber keine verbessert sie auch robust genug, um
   das Risiko einer Fehlmessung auszuschließen.
3. Die Pp-Abweichung bleibt in jedem Fall unauffällig — Phasenlänge ist kein
   Pp-Risiko.

---

## 4. Was mit der Phasenlänge in Sekunden passiert (Chris' „15 Sekunden")

`rundenDauer` für Breaking ist `0,35` s (`BUEHNE_ART.breaking`). Eine Phase von 4 Zügen
dauert bei der heutigen Taktrate `4 × 0,35 s = 1,4 s` — weit weg von Chris' Bild. Um eine
4-Zug-Phase im Broadcast wie ~15 s wirken zu lassen, bräuchte die **Anzeige-Pacing**
(Enthüllungstempo je Zug, nicht die Simulations-Taktrate) etwa `15 s / 4 ≈ 3,75 s` je
gezeigtem Zug während einer Phase — das ist eine reine Darstellungsfrage (wie heute schon
bei jeder Bühnen-Disziplin die Enthüllungs-Choreografie von der Simulationsschleife
getrennt ist) und berührt rho/Pp nicht, weil die Mechanik selbst unverändert bleibt.
**Phasenlänge in Zügen (3–5, s. oben) und Anzeigetempo sind zwei getrennte Zahlen, die die
Runde gemeinsam festlegen muss** — die eine ist eine Messfrage (dieses Papier), die andere
eine reine Regie-/Pacing-Frage (T, Chris' Zustimmung zum 15-Sekunden-Bild liegt vor).

---

## 5. Gauntlet-Kettenfolgen (Rest-HP-Streuung)

Der Sieger trägt sein HP in den nächsten Bout. `GAUNTLET_HP_MAX` wurde beim Gauntlet-Umbau
(22.09.) bereits bewusst von 100 auf 400 angehoben, um genau diese Art Varianz
(„Gambler's Ruin bei zu wenigen Schritten") abzufedern. Phasenlänge ändert die
**Verteilung** der Treffer innerhalb eines Bouts (mehrere Treffer am Stück statt
alternierend), nicht den **Gesamt-HP-Pool** oder die Zahl der Bouts — die gemessene
rho/Pp-Zahl (Abschnitt 3) schließt diesen Effekt bereits mit ein, da sie am vollständigen
Gauntlet (inklusive aller Ketten-/Bout-Übergänge) gemessen wurde, nicht an einem isolierten
Duell. Kein separater Zusatzbefund nötig.

---

## 6. Empfehlung

**Nicht ausliefern — mit zwei getrennten Begründungen:**

1. **Die Baseline selbst ist zu knapp, um eine Verbesserung zuverlässig zu belegen.** Bei
   einer Kaderfamilie-Spannweite von 0,25–0,33 und einem Signal von 0,03 zwischen den
   Kandidaten ist jede Entscheidung „Phase X ist besser" statistisch nicht tragfähig. Das
   ist in erster Linie ein Befund über die heutige Breaking-Mechanik (Abschnitt 1), nicht
   über Phasen — aber er verbietet es, Phasen auf Basis dieser Messung einzuführen.
2. **Der Peiniger-Deckel bleibt bei ±5 %.** Jede getestete Erhöhung (±10 %, ±20 %) fällt bei
   mindestens einer Phasenlänge durch rho < 0,80 — deckungsgleich mit der schon im Code
   dokumentierten Messreihe vom 30.09. Es gibt keinen neuen Grund, den Deckel anzuheben, nur
   weil Phasen dazukommen.

**Was sich trotzdem jetzt schon, risikofrei, umsetzen lässt — unabhängig von der
Phasen-Entscheidung:**

- **Die Q1-Matchup-Karte („fügt zu / hält aus") für Breaking.** B2 (der Peiniger-Effekt) ist
  **bereits produktiv**, bei ±5 % um `SPITZENMOMENT`. Eine Visualisierung müsste nichts an
  der Mechanik ändern — nur zwei vorhandene Kanäle lesbar machen:
  „fügt zu" ≈ `SPITZENMOMENT` (B2-Schadenskanal), „hält aus" ≈ der TECHNIK/NERVEN-Mix aus
  `gauntletRunde()` (`mixAlt` + `familienKanal`). Das ist reine Präsentation (wie Q8), kein
  Pp-/rho-Risiko, und würde Chris' „man muss sehen können, wer offensiv/defensiv stark ist"
  schon mit der **heutigen** Mechanik einlösen, ohne auf die Phasen-Entscheidung zu warten.
  Nicht Teil dieser Runde (nicht beauftragt), aber ein naheliegender nächster Schritt.

**Wenn Chris Phasen trotzdem will, bevor eine robustere Messung vorliegt:** das wäre eine
bewusste Entscheidung, das heute schon knappe Risiko einzugehen — keine, die dieses Papier
empfiehlt. Der sauberere Weg wäre, zuerst die Kaderfamilie-Spannweite für Breaking zu
verkleinern (mehr/andere Team-Paarungen, s. `docs/design/messgrundlage-kaderfest.md`) oder
bei größerem n erneut zu messen, bevor an der Mechanik selbst gedreht wird.

---

## 7. Woran das hängt (Dateien/Skripte dieser Messung)

- Disposable Engine-Kopie + additiver Schalter: nur im Session-Scratchpad, **nie**
  committet, nie an `public/mockups/battle-mode.engine.js` gesendet.
- Produktions-Sanity-Vergleich: `node scripts/miss-alle-disziplinen.mjs 24|48 breaking`
  (unverändert, Abschnitt 1).
- Q8 „Verfall am Körper": bereits gemerged, PR #1207,
  `app/foundation/discipline-stage/arena/disciplines/breaking.tsx`.
- Bereits bestehende B1/B2/B4/B5-Messreihe: Code-Kommentare bei
  `GAUNTLET_PEINIGER_DECKEL`/`GAUNTLET_FAMILIE_GEWICHT` in `battle-mode.engine.js`
  (Abschnitt 0).

---

## 8. Nachtrag 15.10. — Task #120: der Q1-Vorschlag aus Abschnitt 6 ist jetzt gebaut

**Auftrag:** Task #120 (`docs/design/chris-feedback-breite-runde-13-10.md`, „Breaking" Punkt
19) verlangte eine erneute Pruefung, was von Chris' Wunsch („Phasen statt Ping-Pong" +
„optisch zeigen wer offensiv/defensiv stark ist") schon existiert, bevor irgendetwas gebaut
wird. Befund nach vollstaendiger Pruefung aller vier Teilfragen des Auftrags:

1. **Alternierendes Rollensystem (einer greift an, der andere ertraegt)** — existiert bereits
   seit #875 (`cypherPaar()`/`buehneQueue`) und ist seit dem Gauntlet-Umbau (22.09.) die
   gesamte Breaking-Mechanik (`baueGauntlet()`). Nicht „hin und her springen ohne klare
   Phasen" — die Rollen SIND klar, nur der WECHSEL kommt nach jedem einzelnen Zug (s. Punkt 2).
2. **Phasenlaenge `rundenDauer`** — heute 0,35 s/Zug (`BUEHNE_ART.breaking`), Rollenwechsel
   nach JEDEM Zug (`ertragenderIstX=!ertragenderIstX`). Weit von Chris' „15 Sekunden" weg.
   **Dieser Befund bleibt unveraendert offen** (s. Abschnitt 6 oben): die Messung in diesem
   Dokument zeigt, dass eine Mehrzug-Phase bei der heutigen Kaderfamilie-Spannweite
   (0,25–0,33) nicht zuverlaessig von „neutral" unterscheidbar ist (Signal nur 0,03) — **nicht
   gebaut**, braucht entweder eine robustere Messgrundlage oder Chris' bewusste Entscheidung,
   das Risiko einzugehen (Abschnitt 6).
3. **Sichtbare Offensiv-/Defensivstaerke-Anzeige** — war die EINE echte Luecke: B1/B2/B4/B5
   machen „der Peiniger wirkt"/„drei Familien" seit dem 30.09. mechanisch bereits wahr, aber
   **nirgendwo sichtbar** — weder im Canvas-Motor (`zeichneBreaking()`) noch in der
   produktiven React-Buehne (`app/foundation/discipline-stage/arena/disciplines/
   breaking.tsx`), beide durchsucht, beide ohne jeden Treffer auf „offensiv"/„defensiv"/
   Statanzeige. **Jetzt gebaut**, s.u.
4. **Optische Erschoepfungs-/Blutindikatoren** — Q8, PR #1207 + Gore-Folge-PR, bereits
   gemerged (bestaetigt erneut: `verfallStufe()` in `breaking.tsx`, vier Stufen Schweiss bis
   Gore). Nur in der React-Buehne, nicht im Canvas-Motor — eine bestehende Asymmetrie zwischen
   beiden Renderern, aber kein Teil dieses Auftrags.

**Was gebaut wurde (Klasse A, rein dekorativ):** die in Abschnitt 6 vorgeschlagene
„Q1-Matchup-Karte" — auf der Seitentafel (`tafel()` in `zeichneBreaking()`) steht jetzt je
Kaempfer eine Zeile `ANGRIFF nn · HALT nn`, gelesen aus `u.SPITZENMOMENT` (derselbe Kanal, den
`gauntletSchadenFaktor()`/B2 bereits in echten Schaden uebersetzt) und dem Mittel aus
`u.TECHNIK`/`u.NERVEN` (dieselben Kanaele, aus denen `gauntletRunde()`s `mixAlt` die
Standhalte-Chance bildet). Eigenschaft des Kaempfers, nicht der laufenden Rolle — bleibt bei
Rollenwechsel gleich, genau wie ein „Assassine" in beiden Rollen ein Assassine bleibt. Kein
`rr()`, keine neue Formel, keine Aenderung an `gauntletRunde()`/`baueGauntlet()`/`wert()`.

**Bewusst NUR im Canvas-Motor gebaut, nicht in `breaking.tsx`.** Der React-Typ `RT`
(`DisciplineStageNativeArena.tsx`) fuehrt fuer keine der zwanzig Disziplinen ein Feld fuer
rohe Attribut-/Kanalwerte — nur `score`. `SPITZENMOMENT`/`TECHNIK`/`NERVEN` sind im Canvas-
Motor direkt am Teilnehmer-Objekt verfuegbar (gleicher Scope, keine neue Datenleitung), in der
produktiven Matchday-Buehne dagegen gar nicht vorhanden. Eine Anzeige dort haette einen neuen
Datenkanal durch `RT`/`NativeStagePlayer` gebraucht — ein Schnitt, der potenziell alle zwanzig
Disziplinen beruehrt, also eine groessere, eigene Runde und keine Klasse-A-Praesentationsrunde
mehr. **Offene Frage fuer eine naechste Runde:** falls Chris das auch auf der Matchday-Buehne
sehen will (dort, wo ein echtes Saisonspiel tatsaechlich laeuft), braucht das zuerst eine
Entscheidung ueber diese neue Datenleitung, nicht nur einen Zeichenaufruf.

**Verifikation:**

| Pruefung | Ergebnis |
|---|---|
| `node --check public/mockups/battle-mode.engine.js` | bestanden |
| `node scripts/miss-alle-disziplinen.mjs 24 breaking` | **bit-identisch zur Baseline**: 0,801/0,944 (Abschnitt 1), „bestanden" — erwartbar, `tafel()` ist ein reiner Zeichenaufruf in `zeichneBreaking()`, `disziplinProbe()` durchlaeuft Zeichenfunktionen nie |
| Playwright-Sichtprobe (`battle-mode.html`, Breaking, volle Buehne inkl. Zeichenpfad) | „Seitenfehler: keine" — kein JS-Fehler durch die neuen `fillText`-Aufrufe, auch im echten Browserlauf |
| Screenshot (Breaking-Buehne nach 1,8 s Laufzeit) | zeigt beide Seitentafeln mit `ANGRIFF nn · HALT nn`, lesbar, keine Ueberlappung mit der bestehenden Anschlag-/Standzeit-Zeile |

**Nicht angefasst:** `rezept`, `failAbzug`, `rundenN`, `rundenDauer`, `gauntletRunde()`,
`baueGauntlet()`, `gauntletSchadenFaktor()`, die Eignungsmatrix, `breaking.tsx`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01UYLNtXkprKr1XK4c3X2xQq
