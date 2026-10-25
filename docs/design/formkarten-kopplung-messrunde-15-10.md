# Formkarten-Kopplung — Messrunde 15.10. (Punkt 30, chris-feedback-breite-runde-13-10.md)

**Reine Diagnose, keine Mechanik-Aenderung.** Dieses Dokument misst eine Frage, trifft aber keine
Entscheidung — die Entscheidung gehoert Chris, s. "Offene Frage" am Ende. `battle-mode.engine.js`
bekommt dafuer genau EINE neue, rein lesende Messsonde (`formAttrEigSonde`, s.u.); kein Rescaling,
kein `betroffeneAttribute()`, keine Spielwertung wurde angefasst.

## Auftrag

Punkt 30 aus `docs/design/chris-feedback-breite-runde-13-10.md` (Zeile ~315-358): Chris' Sorge
("was die Attribute angeht muessten die so gesteigert werden dass in der Eignung eine +4 raus
kommt wenn der Spieler +4 hat") ist fuer vier Chassis bereits geschlossen (Arena/TDM, Staffel,
Takeshi's Castle — alle rescalen die Kampf-/Laufwerte proportional zur Eignung), fuer vier ANDERE
nie gemessen: Feldspiel (alle Mannschaftssport-Disziplinen), Buehne (alle sieben
Buehne-Disziplinen), Zeitfahren und Climbing fliesst der Formbonus stattdessen ueber
`mitAufschlag()` direkt auf eine disziplinspezifische Teilmenge der Rohattribute
(`betroffeneAttribute()`), ohne Rescaling zur Eignung. Zusaetzlich zum Vergleich: Spurt, dessen
rho-Problem 2026-09 durch einen Mechanik-Umbau geloest wurde, aber nie isoliert auf den
Formkarten-Anteil gemessen wurde.

## Methodik — zwei Ebenen, zwei Sonden

**(A) Attribut-Kanal, rein rechnerisch (`window.__arena.formAttrEigSonde(dId, 4)`, NEU in dieser
PR).** Rechnet fuer jeden Spieler des Testkaders `gewichtet(p.a, BASIS_JE_DISC[d])` — dieselbe
Formel, mit der `p.d.tdm`/`p.d.spurt` ueberhaupt erst entstanden sind — einmal ohne und einmal MIT
genau der Attribut-Transformation, die eine Formkarte in den vier offenen Chassis tatsaechlich
durchlaeuft (`mitAufschlag(a, 4, betroffeneAttribute(null,d,false), d)`, der "breit"-Kanal, den
`breitPunkte=formVon(p.n)+stufenWert()` nimmt). Ruft NUR bestehende, reine Helferfunktionen auf,
schreibt nichts, simuliert kein Spiel — reine Algebra am Rezept.

**(B) Spielwertung, im echten Simulationslauf (`window.__arena.formEinflussVon(dId, n, 4)`, bereits
vorhanden seit der E9-Pruefung 13.10., "wirkt sich die Formkarte spuerbar aus?").** Ein einzelner,
benannter Spieler bekommt die Formkarte (0 vs. +4), alle anderen bleiben unveraendert; derselbe
Lauf-Index sieht in beiden Faellen denselben Mutatoren-/Gegnerwurf (gepaart), der Unterschied im
Ergebnis ist damit ausschliesslich der Karte zuzuschreiben. Gemessen wird `M.wert()` (dieselbe
Groesse, an der auch rho/Pp haengen) und der Rang des Spielers im Feld.

Beide Sonden sind reine Messfunktionen, bit-identisch zum Hauptspiel wirkungslos (kein `rr()`,
keine Mutation von `FORMKARTE`/`SQUAD`/`OPP` ausserhalb der Sonde selbst). Treiber-Skript:
`scripts/messe-formkarten-kopplung.mjs` (neu, Playwright/Headless-Chromium gegen
`public/mockups/battle-mode.html`, dasselbe Setup wie `messe-arena-einfluss.mjs`).

**n-Werte:** 48 Laeufe fuer Buehne/Bahn (Projekt-Standard, s. `einflussVon`-Kommentar), 24 fuer
Feldspiel (Basketball) — ein Feldspiel-Spiel braucht real mehrere Minuten Simulationszeit, 17
Spieler x 2 (neutral/stark) x n Laeufe machen n=48 fuer diese Runde unverhaeltnismaessig teuer;
n=12 und n=24 lieferten fuer Basketball nahezu identische Werte (Delta 2,67/2,71, Rangdelta
−0,79/−0,78), die Zahl ist also bereits bei n=24 stabil. Testkader: der im Mockup fest verdrahtete
Kader (Vigilante Wranglers gegen Armageddon Aftermath, 17 Spieler insgesamt) — derselbe, den auch
`einflussVon`/`formEinflussVon` ohnehin verwenden.

**TDM/Arena-Referenz, Ergebnis (B): in dieser Runde nicht erreicht — dokumentiert statt erzwungen.**
Dieselbe gepaarte Messung fuer TDM ist ungleich teurer als fuer Feldspiel/Buehne/Bahn: ein einzelner
Kampf braucht in diesem Setup real mehrere Sekunden Rechenzeit (gegenueber Zehntelsekunden fuer
einen Bahn-Lauf), selbst mit demselben `setTimeout`-Leckfix, den `messe-arena-einfluss.mjs` fuer
genau dieses Problem bereits einsetzt (s. Kommentar im Treiberskript). Ein Lauf mit n=12 (dieselbe
Anzahl, mit der Basketball oben gemessen wurde) ueberschritt in dieser Sitzung wiederholt zehn
Minuten, ohne durchzulaufen; ein verkuerzter Versuch mit n=4 wurde nach ueber vier Minuten ebenfalls
abgebrochen. Statt eine Zahl zu erzwingen (und sie damit auf einer zu kleinen, instabilen
Stichprobe zu meiden), bleibt die TDM-Zeile in Ergebnis (B) leer — ehrlicher als eine Zahl, die
`docs/design/stand-aller-disziplinen.md`s eigenem Massstab ("24-48 Laeufe, sonst ist das Ergebnis
systematisch zu guenstig/instabil") nicht genuegt hätte. Die Referenz steht deshalb unten rein
analytisch: Arena/TDM baut `eigWert` nachweislich (Code, `baueEinheit()`) als
`p.d[d]+engPunkte+breitPunkte+...` — die Formkarte geht dort 1:1, additiv, in genau die Zahl ein,
die `aufEignung()` anschliessend zur Skalierung der Kampfwerte verwendet. Das ist der Mechanismus,
der laut CLAUDE.md "extra dafuer gebaut" wurde, und Ergebnis (A) bestaetigt live, dass er fuer den
Attribut-Kanal exakt so funktioniert, wie der Code es verspricht. Eine kuenftige Runde mit mehr
Zeitbudget (oder einer kleineren/synthetischen TDM-Besetzung) kann `formEinflussVon("tdm", n, 4)`
jederzeit nachtragen — die Sonde existiert bereits und ist unveraendert.

## Ergebnis (A): der Attribut-Kanal ist exakt matrixtreu — in JEDER getesteten Disziplin

| Disziplin | formPlus | meanDelta | minDelta | maxDelta |
|---|---:|---:|---:|---:|
| Basketball (Feldspiel) | 4 | 4,00 | 4,00 | 4,00 |
| Tennis (Buehne) | 4 | 4,00 | 4,00 | 4,00 |
| Zeitfahren (time-trial) | 4 | 4,00 | 4,00 | 4,00 |
| Climbing | 4 | 4,00 | 4,00 | 4,00 |
| Spurt | 4 | 4,00 | 4,00 | 4,00 |
| TDM (Referenz, bereits proportional) | 4 | 4,00 | 4,00 | 4,00 |

**Fuer alle 17 Testspieler, in jeder der sechs gemessenen Disziplinen: exakt 4,00 — keine
Streuung.** Das ist kein Messfehler und kein Zufall der Stichprobe, sondern eine algebraische
Eigenschaft von `mitAufschlag()`: die Funktion skaliert die betroffenen Attribute genau so, dass
`gewichtet(attrs, BASIS_JE_DISC[d])` um exakt den uebergebenen Punktwert steigt — unabhaengig
davon, ob die betroffenen Attribute (`betroffeneAttribute(...,false)`="breit") zwei oder zehn
Attribute umfassen, und unabhaengig von der Disziplin, solange der Spieler ueberhaupt positives
Gewicht in mindestens einem der Matrix-Attribute hat (in der Praxis immer der Fall).

**Was das bedeutet:** die Haelfte von Chris' Sorge — "steigern die Attribute die Eignung um
genausoviel, wie die Karte sagt?" — ist fuer den reinen Attribut-/Matrix-Massstab in ALLEN VIER
offenen Chassis bereits erfuellt, by construction, nicht nur in den drei bereits rekonzilierten.
Eine +4-Formkarte hebt die matrixgewichtete Eignung (`gewichtet(a, BASIS_JE_DISC[d])`, dieselbe
Formel wie `p.d.tdm`) exakt um 4,00 Punkte — in Feldspiel, Buehne, Zeitfahren, Climbing UND Spurt,
genauso wie im bereits anerkannten TDM-Referenzfall.

## Ergebnis (B): was tatsaechlich im Spiel passiert, divergiert stark — selbst zwischen Disziplinen mit IDENTISCHEM Attribut-Kanal

| Disziplin | Chassis | Feldgroesse | Laeufe (n) | meanDelta (wert(), eigene Skala) | meanRangDelta | Rangbewegung je Lauf (von Feldgroesse) |
|---|---|---:|---:|---:|---:|---:|
| Basketball | Feldspiel | 12 | 24 | 2,71 (Boxscore-Punkte) | −0,78 | 6,5 % |
| Tennis | Buehne | 12 | 48 | 50,67 (Durchgangspunkte) | −0,73 | 6,1 % |
| Zeitfahren (time-trial) | Bahn | 6 | 48 | 0,51 (Rangpunkte) | −0,51 | 8,4 % |
| Climbing | Bahn | 6 | 48 | 1,41 (Rangpunkte) | −1,41 | 23,4 % |
| Spurt | Bahn | 6 | 48 | 0,83 (Rangpunkte) | −0,83 | 13,8 % |
| TDM (Referenz) | Arena | 12 | — | nicht gemessen (s.u.) | — | — |

(Negatives Vorzeichen bei `meanRangDelta` heisst Verbesserung: der Rang-WERT sinkt, Rang 1 ist der
beste. "Rangbewegung je Lauf" ist `|meanRangDelta| / Feldgroesse` — wie viel Prozent des Feldes der
Spieler sich im Schnitt nach vorn arbeitet.)

**Der auffaelligste Befund steht nicht zwischen "offenen" und "reconciled" Chassis, sondern
INNERHALB der drei Bahn-Disziplinen, die alle denselben Motor (`bauSpurt`/`BAHN_ART`) und — nach
Ergebnis (A) — exakt denselben, matrixtreuen Attribut-Kanal teilen:** Climbing bewegt einen
Laeufer im Schnitt um 23 % des Feldes, Spurt um 14 %, Zeitfahren nur um 8 % — fast der dreifache
Unterschied bei rechnerisch IDENTISCHEM Eingriff (+4,00 Eignungspunkte, exakt gemessen in (A)).
Der Unterschied kann deshalb nicht am Attribut-Kanal liegen (der ist in allen drei exakt gleich,
s. oben) — er muss an den disziplinspezifischen Sub-Skill-Rezepten (R2: `spurtWerte()`/
`grundTempo`/Balance-Rechner usw.) liegen, die dieselben, jetzt um 4 Punkte gehobenen Attribute
UNTERSCHIEDLICH gewichten, je nachdem, WELCHE Attribute die Formkarte in diesem Einzelfall
angehoben hat (abhaengig vom Spieler-Attributprofil, da `mitAufschlag` multiplikativ auf die
vorhandenen Werte wirkt).

## Einordnung je Disziplin

- **Climbing driftet am deutlichsten:** 23 % Feldbewegung aus einer nominell "nur" 4-Punkte-Karte
  ist der groesste gemessene Effekt dieser Runde — deutlich mehr, als die trivial-matrixtreue
  Attribut-Rechnung (A) vermuten liesse.
- **Spurt liegt in der Mitte** (14 %) — insofern beruhigend fuer die in CLAUDE.md offen gelassene
  Frage, ob Spurts 2026-09-Umbau den Formkarten-Anteil mitgezogen hat: er ist spuerbar, nicht
  verschwunden, aber auch nicht das staerkste gemessene Signal.
- **Zeitfahren bewegt am wenigsten** (8 %) der drei Bahn-Disziplinen trotz identischem Kanal.
- **Tennis (Buehne) und Basketball (Feldspiel)** liegen mit 6-6,5 % nah beieinander, aber auf
  einer GROESSEREN Feldgroesse (12 statt 6) — ein Rangplatz ist dort "billiger" zu gewinnen, die
  absolute Platzbewegung ist entsprechend kleiner zu lesen.
- **TDM (Referenz):** keine live gemessene Spielwertungs-Zahl in dieser Runde (Kostengrund s.
  Methodik). Analytisch bleibt die Referenz trotzdem tragfaehig: `eigWert` nimmt den Kartenwert
  dort additiv und exakt auf (identisch zu Ergebnis A), und genau diese Zahl — nicht die
  Rohattribute — bestimmt ueber `aufEignung()` die Kampfwerte. Die Streuung, die bei Climbing/
  Spurt/Zeitfahren auftritt (23 % / 14 % / 8 %, trotz identischem Attribut-Kanal), hat in der
  Konstruktion von TDM keine Entsprechung: dort kann keine andere Rezept-Gewichtung "dazwischen"
  liegen, weil die Formkarte den Durchgriff auf die Kampfwerte NICHT ueber ein Sub-Skill-Rezept
  nimmt, sondern direkt ueber den normierten Eignungswert.

Keine dieser Zahlen beantwortet fuer sich, ob die Mechanik "richtig" ist — das ist exakt die
Design-Frage, die Punkt 30 offen laesst (s.u.). Sie zeigen nur: der reine Attribut-/Matrix-Massstab
ist in ALLEN getesteten Disziplinen exakt, aber was am Ende auf der Bahn/im Feld/auf der Buehne
passiert, haengt sichtbar und unterschiedlich stark von jedem Rezept einzeln ab — selbst
zwischen Disziplinen, die sich Motor UND Attribut-Kanal teilen.

## Offene Frage an Chris (unveraendert aus Punkt 30, keine Empfehlung dieser Runde)

Der Code behandelt die fehlende Eignungs-Rescaling-Kopplung in Feldspiel/Buehne/Zeitfahren/
Climbing ausdruecklich NICHT als Fehler ("Das ist kein Fehler: die Eignung ist selbst eine
gewichtete Summe derselben Attribute. Wer sie [...] zusaetzlich anlegte, zaehlte sie doppelt."),
sondern als bewusste Alternative mit einer eigenen Konsequenz: auf der Bahn/im Feldspiel/auf der
Buehne entscheidet dann nicht der Disziplinrang (Eignung), sondern nur die Rohattribute, aus denen
er entsteht — zwei Spieler mit identischen Attributen performen dort gleich, selbst wenn einer in
der Diszi-Eignung auf Rang 6 und der andere auf Rang 20 steht.

**Chris muss entscheiden:**

- **Option A:** Feldspiel/Buehne/Zeitfahren/Climbing bekommen dieselbe proportionale
  Eignungs-Kopplung wie Arena/Staffel/Takeshi (`f=eigW/m`-Rescaling bzw. `aufEignung()`-Analogon),
  damit der gemessene Spielwertungs-Effekt (Ergebnis B) genauso gleichmaessig ausfaellt, wie er es
  in der Referenz tut — und die jetzt gemessene Streuung zwischen Climbing/Spurt/Zeitfahren
  verschwindet.
- **Option B:** die aktuelle Rohattribut-Kopplung bleibt bewusst bestehen — der Attribut-Kanal
  selbst IST matrixtreu (Ergebnis A), nur die Uebersetzung in Spielergebnis bleibt je Rezept
  unterschiedlich, so wie es echte Sportarten mit unterschiedlichen Techniken auch waeren.

Diese Runde trifft diese Entscheidung nicht und nimmt sie nicht vorweg — sie liefert nur die
Zahlen, die vorher fehlten.

## Gemessene/geaenderte Dateien dieser Runde

- `public/mockups/battle-mode.engine.js`: EINE neue, rein lesende Sonde `formAttrEigSonde` plus
  Eintrag in `window.__arena` — keine Aenderung an `mitAufschlag`, `betroffeneAttribute`,
  `aufEignung` oder einer Spielwertung.
- `scripts/messe-formkarten-kopplung.mjs`: neues Treiberskript fuer beide Sonden.
- Dieses Dokument und ein Nachtrag in `docs/design/stand-aller-disziplinen.md`.
