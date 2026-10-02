# I-Spy — Fable-Empfehlung zu Task #54: G1* annehmen oder eine Mechanik bauen? (02.10.)

Chris muss entscheiden, ob I-Spy bei rho je Spiel 0,750 unter der G1*-Alternative abgenommen wird
(a) oder ob eine der vier Ideen aus `fable-ideen-arena-ispy-30-09.md` Abschnitt 6 gebaut wird (b).
Dieses Dokument ist eine Konsultation: **kein Code geändert, nichts gebaut, nichts am Motor
gemessen.** Es liefert eine Entscheidung mit Begründung, einen baureifen Entwurf für den
empfohlenen Weg und ein Abbruchkriterium nach dem Muster des P1-Anlaufs.

**Gelesen, vollständig:** `CLAUDE.md`, `i-spy-pp-rezeptrunde-diagnose-02-10.md` (PR #1128),
`fable-ideen-arena-ispy-30-09.md` (Abschnitt 6, I-1 bis I-6), `i-spy-p1-prototyp-befund-26-09.md`,
`i-spy-opus-konzeptreview-26-09.md`, `stand-aller-disziplinen.md` Abschnitt 7 (auf `origin/main`
`466e53fb`), `basketball-g1-stern-paartreue-10-09.md` Abschnitt 0 (G1*-Wortlaut), die
I-Spy-Stellen in `public/mockups/battle-mode.engine.js` (`rezept` `:14937-14945`, `fundorte`
`:14989-15002`, Konstanten `:16704-16798`, `ispyBesterWeg()` `:17023`, `ispySeiteTick()`
`:17083-17248`, Sichtschwellen `:17185-17186`, `setz()` `:15596-15626`) und die Kader-Familie
`data/generated/kaderfamilie-live-save.json`.

---

## Kurzfassung

- **Entscheidung: (b) — aber nicht I-2, wie es am 30.09. formuliert war, sondern eine
  korrigierte Fassung, die ich hier „Kennerblick" nenne (I-2k).** Von den vier Ideen ist I-2 die
  einzige, die am Sichttor ansetzt — dem Kanal, in dem laut Diagnose Signal und Rauschen zugleich
  sitzen. I-1 ist per Konstruktion rho-neutral (die Abnahme misst mit der KI-Standardwahl),
  I-3 fasst einen Kanal an, der in jeder Dosis neutral gemessen ist, I-4 fügt ein großes binäres
  geteiltes Ereignis hinzu und kostet damit eher Verlässlichkeit.
- **I-2 in der Fassung vom 30.09. (Nebenwege „Befragen" = charisma/torment/spirit und
  „Beschatten" = dexterity/speed/will, Faktor 0,8) würde den P1-Fehler durch eine andere Tür
  wiederholen.** Das habe ich nicht am Motor gemessen, sondern an den sechzig Spielern der
  Kader-Familie nachgerechnet (Abschnitt 4): auf den echten Kadern sind torment (r = 0,038) und
  spirit (r = 0,194) mit der I-Spy-Eignung praktisch unkorreliert — die Motor-Kommentare sagen das
  seit dem 21.09. Ein Nebenweg aus genau diesen Attributen gibt Tresor-Zugang an Spieler mit
  niedriger Eignung (Beispiel: eig 24, Sicht auf Stufe 3 von 14 % auf 78 %). Die Rangkorrelation
  zwischen Eignung und Tresor-Sicht fällt in zwei von fünf Paarungen von 0,74 auf 0,31 und von
  0,69 auf 0,10. Das ist die Validitätsfalle, nur über den Zugang statt über die Spur.
- **Die korrigierte Fassung nimmt die P1-Lehre wörtlich: Breite trägt Validität.** Der Nebenweg
  im Finden ist das **Mittel der drei Knack-Sub-Skills** (LOGIK, MENSCHENKENNTNIS,
  FINGERFERTIGKEIT — neun der zehn Matrixattribute), mit Faktor 0,85 gegen den Primärweg
  SPÜRSINN. Bild: wer Schlösser kennt, erkennt am Schloss, was dahinter liegt. Auf denselben
  sechzig Spielern steigt die Rangkorrelation Eignung↔Sicht im Median von 0,69 auf 0,72–0,78
  (je nach Dosis), kein Spieler läuft neu in den Sichtdeckel, und der Mehrwege-Anteil liegt bei
  30–47 % der Spieler statt 3,71 % der Züge beim heutigen Knack-Nebenweg.
- **Was ich ehrlich erwarte:** rho je Spiel +0,01 bis +0,04, also eher „nicht mehr knapp
  unter" als „sicher über" 0,80. Die wahrscheinlichste Verbesserung ist **Star auf Rang 1**
  (heute 43,3 %, die eigentliche G1*-Verfehlung) — weil die Mechanik heute dem eignungsbesten
  Spieler oft schlechteren Zugang gibt als drei Mitspielern mit niedrigerer Eignung (Abschnitt 1).
- **(a) ist der Rückfall, nicht die Entscheidung.** G1* ist **nicht** erfüllt (zwei von vier
  Bedingungen fehlen), und das Sichttor verletzt heute Chris' Durchreich-Prinzip für will (12)
  und spirit (13): ein Spieler, dessen Stärke dort liegt, hat keinen Weg zum Tresor. Das ist
  unabhängig von rho ein Grund, I-2k zu versuchen. Fällt PR 0 durch, empfehle ich (a) — mit einer
  n=48-Nachmessung von Star Rang 1, weil 43,3 % bei 120 Star-Ereignissen nur ~1,5 Standardfehler
  unter 50 % liegt.
- **Aufwand PR 0: ein Tag**, ~15 Zeilen auf einer Kopie der Engine, kein neuer rr()-Wurf, alle
  anderen neunzehn Disziplinen bit-identisch.

---

## 1. Die Frage richtig stellen: was fehlt I-Spy wirklich?

Die Diagnose vom 02.10. hat die Lücke in zwei Zahlen zerlegt: Validität 0,881, Verlässlichkeit
0,724, nötig 0,825 — „+0,10 Verlässlichkeit ohne Validitätsverlust". Alle Hebel, die nur die
Verlässlichkeit heben (Uhr, Teilpunkte, Entrauschen), sind gemessen und tauschen auf derselben
Kurve. Das ist richtig, und ich wiederhole es nicht.

Aber die G1*-Tabelle derselben Diagnose sagt etwas Genaueres darüber, **wo** die Lücke sitzt:

| Paarung | rho Spiel | rho Saison | Star Rang 1 | Star Top 2 | Paartreue ≥ 15 |
|---|---:|---:|---:|---:|---:|
| vigilante-armageddon | 0,858 | 0,979 | 41,7 % | 95,8 % | 99,7 % |
| coldsteel-direlegion | 0,750 | 0,888 | 45,8 % | 62,5 % | 92,3 % |
| goldengladiators-silversoldiers | 0,707 | 0,839 | 54,2 % | 70,8 % | 91,1 % |
| mortalsin-natureswrath | 0,799 | 0,881 | 58,3 % | 95,8 % | 97,1 % |
| **piratecrew-raginglunatics** | **0,681** | **0,769** | **16,7 %** | **45,8 %** | 95,4 % |

Die Paartreue (94,6 % gegen 95 %) und Top 2 (74,2 % gegen 75 %) fehlen um weniger als einen
Punkt — bei n = 3271 Paaren bzw. 120 Star-Ereignissen ist das nicht von null zu unterscheiden.
**Die eine echte Verfehlung ist Star Rang 1 mit 43,3 % gegen 50 %, und sie kommt fast vollständig
aus einer Paarung:** piratecrew-raginglunatics mit 16,7 %. Dort ist zugleich die Saison-Validität
mit 0,769 die niedrigste. Diese Paarung ist kein Rauschen, sondern ein Befund.

Ich habe nachgesehen, wer dort der Star ist und was er sieht. SPÜRSINN = 0,6·intelligence +
0,3·torment + 0,1·awareness; Sicht auf Stufe 3 je Tick = min(0,90; 0,013·SPÜRSINN)
(`engine.js:16787`):

| Rang nach eig | Spieler | eig | SPÜRSINN | sieht Tresor |
|---:|---|---:|---:|---:|
| 1 (Star) | Umbrafond | 45,7 | 50,2 | 65 % |
| 3 | Taryn | 42,3 | 58,2 | 76 % |
| 4 | Yukine | 42,0 | 59,1 | 77 % |
| 6 | Salvador Mare | 40,8 | 66,0 | 86 % |

**Der eignungsbeste Spieler der Paarung hat schlechteren Zugang zu Tresoren als drei Spieler
unter ihm.** Seine Eignung kommt aus Attributen, die das Sichttor nicht liest (will, spirit,
dexterity, speed — zusammen 41 der 100 Matrixpunkte). Der Konzeptreview hat gemessen, dass der
Zugang mehr wiegt als das Können am Schloss (0.2: 35 gegen 17 Punkte beim selben Spieler). Wer
den Zugang nicht bekommt, kann seinen Eignungsvorsprung im Knacken nicht mehr aufholen. Das ist
kein Rauschproblem, das mehr Ticks lösen würden — es ist ein **Validitätsproblem des Sichttors**,
das in vier Paarungen zufällig nicht auffällt, weil dort der Star auch der beste Spürer ist.

Dasselbe steht in `CLAUDE.md` als Pflicht: „jede Disziplin-Mechanik muss die Matrixgewichte
tatsächlich durchreichen. Ein Spieler, dessen stärkstes Attribut laut Matrix für eine Disziplin
schwer zählt, muss in dieser Disziplin nachweisbar zu den Besten gehören." Die Pp-Abweichung
(16,6/12,8) ist sauber — aber Pp misst die **Summe** über alle Kanäle. Sie sieht nicht, dass will
und spirit ihren Anteil ausschließlich im Knacken und in der Reihenfolge bekommen und am Tor, das
über den Zugang entscheidet, gar nicht vorkommen.

---

## 2. Warum (a) allein nicht reicht — und warum es trotzdem der Rückfall bleibt

**Gegen (a) als Entscheidung:**

1. **G1* ist nicht erfüllt.** Der Wortlaut (Fable-Entscheidung E1) verlangt **alle vier**
   Bedingungen. Zwei fehlen. Die Diagnose nennt I-Spy „starker Kandidat für eine bewusste
   Chris-Entscheidung" — aber eine Abnahme, die ihre eigene Schranke beim ersten Grenzfall
   aufweicht, ist beim zweiten keine Schranke mehr. Wenn Chris G1* mit Toleranz vergeben will,
   muss er das als Regel für alle zwanzig sagen, nicht als Ausnahme für eine.
2. **Die Verfehlung bei Star Rang 1 ist nicht knapp** (−6,7 Punkte) und hat eine benennbare
   mechanische Ursache (Abschnitt 1), die man beheben kann, ohne den Kern anzufassen.
3. **Das Durchreich-Prinzip ist am Sichttor verletzt**, unabhängig davon, wie man rho liest.
   Ein will-85/spirit-80-Spieler ist heute im I-Spy das, was Chris „Hülpe" nennt — nicht, weil
   das Rezept ihn nicht bezahlt, sondern weil er die Truhen nicht findet, an denen das Rezept ihn
   bezahlen würde.

**Für (a) als Rückfall:**

1. Saison-Validität 0,881 ist komfortabel, Star landet nie auf dem letzten Platz, Paartreue und
   Top 2 liegen innerhalb des Messrauschens an der Schranke.
2. Star Rang 1 wird aus 24 Spielen je Paarung gemessen, also 120 Star-Ereignissen. Der
   Standardfehler einer Quote um 45 % bei n = 120 ist ~4,5 Punkte; 43,3 % gegen 50 % ist
   ~1,5 Standardfehler. Eine n=48-Messung (240 Ereignisse) halbiert die Unschärfe und sollte
   **vor** einer G1*-Entscheidung laufen — ein Befehl, wenn Chromium ihn durchhält.
3. Ein zweiter gescheiterter Mechanik-Anlauf nach P1 wäre Lehrgeld. Deshalb muss der Versuch
   klein sein (ein Tag, eine Kopie, ein Abbruchkriterium) — und genau so ist PR 0 unten gebaut.

---

## 3. Die vier Ideen gegen den Befund aus Abschnitt 1

| Idee | Setzt an bei | Bewegt das Sichttor? | Bewegt Star Rang 1? | Urteil für Task #54 |
|---|---|---|---|---|
| **I-1 Raumwahl** | Verteilung der Art-Punktmasse (±8 Pp), Aufstellungsentscheidung für Chris | Nein | Nein — die Abnahme läuft mit der KI-Standardwahl, so wie die Bahn mit der Standardaufstellung; rho ist per Konstruktion unverändert | **Gute Gameplay-Idee, kein rho-Hebel.** Separat entscheiden, nicht in PR 0 mischen. |
| **I-2 Mehrwege im Finden** | Sichtschwelle = max(Primärweg, Nebenweg·f) | **Ja — der einzige der vier** | Ja, wenn der Nebenweg die Eignung des Stars trägt; **nein, wenn er sie unterläuft** (Abschnitt 4) | **Richtige Stelle, falsche Attributwahl.** Korrigiert als I-2k bauen. |
| **I-3 Lärm statt Abschlag** | Tresor-Nebenweg beim Knacken (zwei von zwölf Fundorten) | Nein (nur über den Hinweis der Gegenseite, +0,15 auf eine Truhe) | Kaum | Reaktionskanal in jeder Dosis neutral gemessen (0,757 gegen 0,756). Kein rho-Hebel; als Erzählung später. |
| **I-4 Kooperations-Truhe** | Ein Fundort je Raum, zwei Spieler im selben Tick | Nein | Eher negativ: ein weiteres binäres 60-Punkte-Ereignis, abhängig von fremder Hand im Team | Verlässlichkeit sinkt eher (dieselbe Fallhöhen-Logik wie bei den Teilpunkten). Nicht als rho-Hebel. |

Die Diagnose hat die Entscheidung so gerahmt: „Mechanik-Ergänzungen, die den geteilten Pool
NICHT ersetzen, sondern einen zusätzlichen, eigenständigen Kanal daneben stellen." Nur I-2 stellt
diesen Kanal **dort** auf, wo Umbrafond ihn braucht.

---

## 4. Die Kaderprobe: I-2 wie formuliert würde P1 wiederholen

Ich habe keine Engine-Messung gefahren (das ist PR 0). Stattdessen habe ich eine Frage gestellt,
die sich ohne Motor beantworten lässt und die den P1-Befund direkt betrifft: **Wie gut ordnet das
Sichttor die Spieler nach ihrer Eignung — heute, und unter jeder vorgeschlagenen Nebenweg-Form?**
Dazu habe ich für alle 60 Spieler der fünf Kader-Paarungen (`kaderfamilie-live-save.json`,
dieselbe Familie wie jede kaderfeste Messung) aus den Rohattributen SPÜRSINN, die drei Knack-
Sub-Skills und die beiden am 30.09. vorgeschlagenen Nebenweg-Mischungen gerechnet, daraus die
Tresor-Sicht je Tick (`min(0,90; 0,013·S)`), und je Paarung die Spearman-Rangkorrelation
zwischen `eig` (= `p.d["i-spy"]`, so wie `setz()` sie liest) und dieser Sicht. Das ist eine
**Validitäts-Näherung für das Sichttor allein** — ohne Würfel, ohne Knacken, ohne `belegt`.
Sie sagt nichts über die Verlässlichkeit, und sie ist nicht rho. Was sie sagt, ist die Richtung,
in die eine Nebenweg-Form den Zugang verschiebt.

Mischungen, wie am 30.09. vorgeschlagen: Befragen = {charisma 45, spirit 35, torment 20},
Beschatten = {speed 50, dexterity 30, will 20}. Kompetenz = Mittel aus LOGIK, MENSCHENKENNTNIS,
FINGERFERTIGKEIT, wie der Reihenfolge-Schlüssel sie heute schon mittelt (`engine.js:17159`).

| Variante der Sichtschwelle | rho(eig, Sicht) je Paarung (v-a · c-d · g-s · m-n · p-r) | Median | Spieler, die den Nebenweg nutzen | Star hat die beste Sicht |
|---|---|---:|---:|---:|
| **Ist-Stand** (SPÜRSINN allein) | 0,69 · 0,39 · 0,83 · 0,74 · 0,69 | **0,69** | 0 % | 2/5 |
| I-2: Befragen, Faktor 0,8 | 0,52 · 0,48 · 0,90 · 0,73 · 0,69 | 0,69 | 37 % | 2/5 |
| **I-2: Befragen + Beschatten, 0,8 (Fassung 30.09.)** | 0,58 · 0,48 · 0,86 · **0,31** · **0,10** | **0,48** | 58 % | 2/5 |
| I-2: Befragen + Beschatten, 0,6 | 0,69 · 0,38 · 0,88 · 0,78 · 0,69 | 0,69 | 27 % | 2/5 |
| **I-2k: Kompetenz-Nebenweg, 0,8** | 0,72 · 0,55 · 0,88 · 0,76 · 0,71 | **0,72** | 30 % | 2/5 |
| **I-2k: Kompetenz-Nebenweg, 0,9** | 0,76 · 0,78 · 0,94 · 0,82 · 0,73 | **0,78** | 47 % | 2/5 |
| Kontrolle: Mischung 0,5·SPÜRSINN + 0,5·Kompetenz (kein Nebenweg, Rezeptänderung) | 0,80 · 0,77 · 0,97 · 0,91 · 0,78 | 0,80 | — | 3/5 |

Dazu die Größen, die die Entrauschungsfalle anzeigen („alle sehen alles", Konzeptreview 3.3):

| Variante | Spieler am Sichtdeckel 0,90 | Streuung der Sicht (sd) | mittlere Sicht |
|---|---:|---:|---:|
| Ist-Stand | 1/60 | 0,160 | 0,56 |
| I-2 Befragen + Beschatten 0,8 | 1/60 | 0,137 | 0,67 |
| I-2k Kompetenz 0,8 | 1/60 | 0,136 | 0,59 |
| I-2k Kompetenz 0,9 | 1/60 | 0,127 | 0,61 |

**Drei Lesarten:**

1. **I-2 in der Fassung vom 30.09. schadet.** In den beiden Paarungen, in denen der Star heute
   schon nicht der beste Spürer ist (mortalsin, piratecrew), kippt die Ordnung des Zugangs
   (0,74 → 0,31, 0,69 → 0,10). Der Grund ist derselbe, den die Rezeptkalibrierung vom 21.09. am
   Motor gemessen hat (`engine.js:14907-14921`): torment korreliert auf diesen Kadern mit
   r = 0,038 mit der I-Spy-Eignung, spirit mit 0,194 — ein Kanal, der diese beiden voll bezahlt,
   „hängt ein Zehntel des Ergebnisses an ein Attribut, das mit der Gesamt-Eignung kaum etwas zu
   tun hat". Beschatten tut dasselbe mit speed/dexterity: die „Brutes" der Kader (Maru eig 33,6,
   Umbramantis eig 25,9) sähen Tresore in 79–80 % der Ticks, der Star Umbrafond weiter in 65 %.
   Auch eine niedrige Dosis (0,6) hilft nicht — sie ist nur neutral. **Diese Fassung sollte
   niemand bauen.** Sie ist der P1-Fehler („Attributverengung auf eine themengewählte
   Teilmischung") mit umgekehrtem Vorzeichen: dort verengte die Spur auf drei Attribute, hier
   erweitert der Nebenweg auf drei **falsche**.
2. **Breite trägt.** Der Kompetenz-Nebenweg ist das Mittel über neun Matrixattribute — die
   Lehre des P1-Befunds (argmax 0,671 → avg 0,776 Saison, die größte Einzelbewegung) auf das Tor
   übertragen. Er hebt die Ordnung in **allen fünf** Paarungen oder lässt sie gleich, und er hebt
   sie am stärksten dort, wo sie am schlechtesten ist (coldsteel 0,39 → 0,55/0,78). Will
   (r = 0,627, die zweitstärkste Einzelkorrelation) kommt damit zum ersten Mal ans Tor.
3. **Die Kompression ist das Risiko, das PR 0 messen muss.** Die Streuung der Sicht sinkt um
   15–20 %. Das ist die Richtung des „entrauschten Kerns" (Verlässlichkeit rauf, Validität
   runter, weil die Punkte an den Teamrang rutschen) — aber weit entfernt davon: niemand läuft
   neu in den Deckel, die mittlere Sicht steigt nur um 3–5 Punkte, und die **Ordnung** wird
   besser, nicht schlechter. Beim entrauschten Kern war es umgekehrt (Ordnung weg, Streuung
   null). Was am Ende überwiegt, kann nur der Motor sagen — deshalb Faktor 0,85 als Startwert
   und 0,8/0,9 als Dosisreihe, nicht ein fester Wert.

Die Kontrollzeile (Mischung statt Nebenweg) ist **keine** Empfehlung: sie ist eine
Rezeptänderung an SPÜRSINN, und Chris hat Zahlenrunden ohne Konzeptentscheidung untersagt. Ich
führe sie, weil sie in PR 0 kostenlos mitläuft und eine Frage beantwortet: Liegt der Gewinn an der
**Breite** (dann wirkt auch die Mischung) oder an der **Mehrwege-Struktur** (dann wirkt nur
max())? Beides ist gut zu wissen, bevor Chris über die Form entscheidet.

Reproduktion: Anhang A (reines Python über die JSON-Datei, kein Motor).

---

## 5. Der Entwurf: I-2k „Kennerblick"

### 5.1 Bild

Der Primärweg bleibt das **Beobachten**: die Lupe, die Details im Raum, SPÜRSINN. Der Nebenweg ist
der **Kennerblick**: wer Schlösser, Zeugen und Chiffren kennt, erkennt am Schloss, am Zeugen, an
der Chiffre, was dahinter liegt — ohne die Details des Raums lesen zu müssen. Er ist langsamer
als der Beobachter (braucht ~18 % mehr Können für dieselbe Sicht), aber er kommt an. Das ist
Chris' „jeder Spieler hat seine eigene Herangehensweise", und es ist **ein** Nebenweg, nicht zwei:
die Erzählung „befragt den Zeugen" / „liest die Spuren am Boden" kann der Ticker trotzdem bringen
— aus dem jeweils höchsten der drei Knack-Sub-Skills des Spielers, als Wort, nicht als Zahl.

### 5.2 Mechanik, exakt

Heute (`engine.js:17184-17190`):

```
x = rr()
sieht2 = min(0,95; 0,20 + SPÜRSINN·0,010)
sieht3 = min(0,90; 0,00 + SPÜRSINN·0,013)
sichtbar(t) = Stufe 1 | (Stufe 2 ∧ x < sieht2 + Hinweis) | (Stufe 3 ∧ x < sieht3 + Hinweis)
```

Vorschlag:

```
KENNERBLICK   = (LOGIK + MENSCHENKENNTNIS + FINGERFERTIGKEIT) / 3          je Teilnehmer, einmal in setz()
FINDEN        = max(SPÜRSINN, ISPY_KENNERBLICK_FAKTOR · KENNERBLICK)       ISPY_KENNERBLICK_FAKTOR = 0,85 (Start)
sieht2 = min(0,95; 0,20 + FINDEN·0,010)
sieht3 = min(0,90; 0,00 + FINDEN·0,013)
```

Alles andere bleibt Zeichen für Zeichen: ein `x = rr()` je Teilnehmer je Tick, zwei Knackwürfe,
ein Reaktionswurf je Seite, `belegt`, der Reihenfolge-Schlüssel, der Hinweis-Bonus (+0,15 auf
die gemeldete Truhe, additiv auf die Schwelle wie heute), F2, Teilpunkte, Nachfüllfolgen, der
Knack-Nebenweg an den beiden Tresoren. **rr()-Verbrauch unverändert** (Handbuch-Falle 17): die
Folge der Zufallszahlen ist bit-identisch zum Ist-Stand, nur die Schwellen, gegen die `x`
verglichen wird, sind für Kennerblick-Spieler höher. Für einen Spieler mit
SPÜRSINN ≥ 0,85·KENNERBLICK ist das Spiel byte-identisch zu heute. Die anderen neunzehn
Disziplinen lesen `BUEHNE_ART["i-spy"]` nicht — Isolationsnachweis wie bei jeder I-Spy-PR
(`miss-alle-disziplinen.mjs 24`, alle zwanzig, vor/nach).

Als Rezeptzeile statt als Inline-Mittel, damit die Mischung sichtbar und Pp-kalibrierbar bleibt
(das Mittel dreier gewichteter Mittel mit gleicher Gewichtssumme ist exakt das gewichtete Mittel
der gemittelten Gewichte; Rundung über `R2` wie bei jedem Sub-Skill):

```
KENNERBLICK: {will:16, dexterity:15, torment:14, charisma:13, spirit:13, speed:12, determination:10, intelligence:7}
```

Eine Konstante, eine Rezeptzeile, zwei geänderte Zeilen in `ispySeiteTick()`, ein additives
Anzeigefeld `r.weg="kennerblick"` für den Ticker (wie `r.hinweis`, fließt nie in `wert()`).
Bei `ISPY_KENNERBLICK_FAKTOR = 0` ist der Patch bit-identisch zum Ist-Stand — das ist die
Nullprobe, mit der PR 0 beginnt (wie beim Rotationsbonus am 02.10.).

### 5.3 Warum das die P1-Falle nicht wiederholt

| P1-Fehlerquelle (Befund 26.09., Abschnitt 3) | I-2k |
|---|---|
| Geteilte Ressource entfernt → inzidentelle Durchmischung über Rätselarten weg | Pool, `belegt`, Reihenfolge, Nachfüllen unverändert. Der Nebenweg ändert nur, **wer sieht**, nicht, **wer wählt**. |
| Art-Wahl nach `argmax` eines Sub-Skills → Spieler auf drei Attribute verengt | Der Nebenweg ist das **Mittel** der drei Sub-Skills — genau die Variante, die im P1-Prototyp +0,105 Validität brachte. |
| Weniger, größere Ereignisse → Verlässlichkeit nicht gewonnen | Ereigniszahl, Fallhöhe, Tickzahl unverändert. Die Verlässlichkeit gewinnt nur dort, wo ein Spieler von einer 50:50-Münze (SPÜRSINN ~40) zu einer 70:30-Münze wird — Varianz p(1−p) sinkt von 0,25 auf 0,21. Klein, aber in die richtige Richtung, ohne Tauschkurve. |
| Geschätzte Validität ohne Messung | Die Kaderprobe (Abschnitt 4) ist vorab gerechnet; PR 0 misst am Motor. |

### 5.4 Pp-Erwartung

Heute (Diagnose 02.10., Saat 1): intelligence 19,8 % (Matrix 18), will 13 (12), determination
10,2 (8), dexterity 9,8 (8) **über**; spirit 9,6 (13), torment 15,5 (17), speed 6,1 (8),
charisma 8,1 (9) **unter**. KENNERBLICK trägt intelligence mit 7 statt 60 ans Tor und spirit/
charisma/speed/torment mit 13/13/12/14 — die vier unterrepräsentierten Attribute gewinnen, das
überrepräsentierte verliert. will/determination/dexterity gewinnen ebenfalls (sie sind bereits
leicht über), deshalb ist die Richtung der Gesamtabweichung nicht sicher. Mit 16,6/12,8 Pp
Ausgangslage ist ein Riss der 25er-Schranke unwahrscheinlich, aber die Messung in zwei
Saatstämmen ist Pflicht (CLAUDE.md), nicht Kür. Falls will/determination zu stark steigen:
`determination` aus KENNERBLICK streichen und `will` auf 12 senken, zugunsten von spirit/speed —
das ist eine Kalibrierung **innerhalb** des Entwurfs, keine neue Mechanik.

### 5.5 Mehrere Wege zum Erfolg — hält I-2k das Prinzip?

CLAUDE.md: „eine Aufgabe hat einen Primärweg (ihr natives Attribut, volle Belohnung) und einen
oder mehrere Nebenwege über andere Attribute (dieselbe Aufgabe lösbar, aber schlechter gestellt —
weniger Punkte oder langsamer)."

- **Aufgabe:** eine Akte oder einen Tresor überhaupt sehen. ✓ dieselbe Aufgabe
- **Primärweg:** Beobachten (SPÜRSINN, intelligence/torment/awareness), voller Zuwachs. ✓
- **Nebenweg:** Kennerblick (die Knack-Kompetenz, neun andere Attributgewichte), Faktor 0,85 —
  ein Kennerblick-Spieler braucht ~18 % mehr Können für dieselbe Sichtchance; er findet
  **langsamer** (im Erwartungswert über acht Ticks seltener), bekommt aber beim Fund denselben
  Punktwert. ✓ „schlechter gestellt — langsamer"
- **Automatische Wahl per max():** wie `ispyBesterWeg()` am Knack-Nebenweg — der Primärweg
  gewinnt bei ähnlichen Fähigkeiten von selbst, ohne Zusatzregel. ✓ gleiche Bauweise wie der
  Präzedenzfall
- **Abgrenzung zum Knack-Nebenweg:** der sitzt an zwei von zwölf Fundorten und wird in 3,71 %
  der Züge genutzt, weil 0,65 das 1,54-fache Können verlangt. Der Kennerblick sitzt an **jedem
  Zug jedes Spielers** und verlangt das 1,18-fache — die Kaderprobe erwartet 30–47 % Nutzer.
  Das ist das, was die Leitlinie meint, wenn sie sagt, „dass jeder Spieler eine gewisse
  Expertise hat". ✓

Was I-2k **nicht** ist: zwei thematisch getrennte Nebenwege (Befragen/Beschatten). Die habe ich
bewusst zu einem gemittelten Weg zusammengelegt, weil die getrennten Wege gemessen (Abschnitt 4)
die Eignung unterlaufen. Die Erzählung bleibt getrennt (Ticker-Wort aus dem höchsten Sub-Skill),
die Mechanik ist eine. Sollte Chris die zwei getrennten Wege aus Prinzip wollen, muss ihr Faktor
unter 0,6 liegen — und dann sind sie so tot wie der Knack-Nebenweg heute.

### 5.6 Anzeige, später, bit-identisch

Ticker: „Umbrafond erkennt den Tresor am Schloss" (Kennerblick, Sub-Skill FINGERFERTIGKEIT) /
„… am Zeugen" (MENSCHENKENNTNIS) / „… an der Chiffre" (LOGIK) — nur, wenn `r.weg` gesetzt ist.
Lupe für Beobachter, ein kurzes Blitzen am Schloss für Kennerblick in `stepSchatzsuche()`.
Nicht Teil von PR 0.

---

## 6. PR 0: Messplan und Abbruchkriterium

**Vorgehen wie beim P1-Prototyp und beim Rotationsbonus:** gepatchte Kopie der Engine im
Worktree, nichts committet außer der Zahl im Befund-Dokument, danach `git checkout --`.
Aufwand: ein Tag.

**Schritte, in dieser Reihenfolge:**

1. Nullprobe: Faktor 0 → `miss-alle-disziplinen.mjs 24 i-spy` muss exakt 0,750/0,177/0,881/0,210
   lesen (CI-Basislinie `rangtreue-basislinie.json` Zeile „i-spy").
2. Dosisreihe Faktor 0,80 / 0,85 / 0,90, je `miss-alle-disziplinen.mjs 24 i-spy` **mit
   Einzelwerten je Paarung** und `miss-star-paartreue.mjs 24 i-spy`.
3. Kontrolle: Faktor 1,0 (Nebenweg ohne Abschlag) und die Mischung 0,5/0,5 aus Abschnitt 4 —
   nur Diagnose, nie Kandidat.
4. Beste Dosis: `messe-arena-einfluss.mjs i-spy 48` und `…-zweiter-saatstamm.mjs i-spy 48
   10000000` (n=24, falls Chromium bei 48 fällt — dann im Befund sagen).
5. `miss-arena-buehne-spiegel.mjs` für I-Spy (Korridor 45–55).
6. Neue Korridor-Kennzahl im Befund, aus einer kleinen Sonde wie `ispyNachfuellSonde`: Anteil
   der Züge, in denen `FINDEN > SPÜRSINN` (Kennerblick hat die Schwelle gehoben), je Spieler und
   gesamt. Zielkorridor **15–45 %** der Züge (die Kaderprobe erwartet 30–47 % der Spieler bei
   0,8–0,9). Unter 10 % ist der Weg tot wie der Knack-Nebenweg, über 60 % ist er der Primärweg.
7. Isolationsnachweis: `miss-alle-disziplinen.mjs 24` alle zwanzig — nur die I-Spy-Zeile bewegt
   sich.

**Abbruchkriterium PR 0 (Median über die fünf Kader-Paarungen, n = 24 je Paarung, dieselbe
Familie wie die Basislinie, beste Dosis):**

| Bedingung | Schwelle | Warum diese Zahl |
|---|---|---|
| Paarweise rho je Spiel gegen Ist-Stand (gleiche Saaten) | besser oder gleich in **≥ 4 von 5** Paarungen, **piratecrew-raginglunatics muss darunter sein** | Das P1-Kriterium; piratecrew ist die Paarung, deren Befund die Idee trägt — hilft sie dort nicht, ist die Diagnose aus Abschnitt 1 falsch. |
| rho je Spiel, Median | **≥ 0,77** | Ist 0,750 + mehr als Kaderrauschen. Nicht 0,80: PR 0 prüft die Richtung, PR 1 kalibriert. |
| rho Saison, Median | **≥ 0,87** | Validität darf nicht fallen (Ist 0,881 minus Rauschen). Fällt sie unter 0,85, ist es die Kompression aus 4.3 — dann Abbruch, auch wenn rho je Spiel steigt. |
| Star Rang 1 / Top 2 / Letzter | **≥ 47,5 % / ≥ 75 % / 0 %** | Rang 1: über dem Ist (43,3 %) und mindestens das P1-Kriterium; Top 2 auf der G1*-Schranke; Letzter hart. |
| Paartreue ≥ 15 | **≥ 95 %** | G1*-Schranke; heute 94,6 %. |
| Pp, zwei Saatstämme | **≤ 25** beide | CLAUDE.md-Pflicht. |
| Kennerblick-Anteil der Züge | **15–45 %** | s. Schritt 6. |
| Spiegeltest | 45–55 | Strukturell symmetrisch, muss aber gezeigt werden. |

**Alle Zeilen müssen halten.** Wird eine verfehlt, fällt I-2k, der Befund wird dokumentiert,
und die Empfehlung wechselt auf (a) — mit der n=48-Star-Nachmessung aus Abschnitt 2. Damit sind
dann beide Formen von „Mehrwege im Finden" geprüft (die themengewählte in der Kaderprobe, die
breite am Motor), und die Idee I-2 ist für I-Spy abgeschlossen; eine dritte Form gäbe es nicht.

**Abnahme PR 1 (falls PR 0 hält):** Dosis feinkalibriert (±0,025 um die beste), n = 48, dann
gilt I-Spy als abgenommen, wenn **entweder** rho je Spiel ≥ 0,80 **oder** alle vier
G1*-Bedingungen halten. Trifft nach der Kalibrierung keins von beiden zu, PR 0 hat aber gehalten,
dann ist I-2k trotzdem ein Gewinn (paarweise besser, Star besser, Durchreich-Prinzip am Tor
erfüllt) und wird gemergt — und Chris entscheidet (a) auf den **neuen** Zahlen, nicht auf den
heutigen.

---

## 7. Was ich erwarte, in Zahlen und ehrlich

| Größe | heute | Erwartung I-2k (0,85) | Grundlage |
|---|---:|---:|---|
| rho Saison (Validität) | 0,881 | 0,88–0,91 | Kaderprobe: Ordnung am Tor +0,03…+0,09; Kompression −15…−20 % Streuung zieht dagegen |
| Verlässlichkeit | 0,724 | 0,73–0,76 | nur die 50:50-Spieler werden leiser; keine neue Fallhöhe |
| rho je Spiel | 0,750 | **0,76–0,79** | Produkt; 0,80 ist das obere Ende, nicht der Erwartungswert |
| Star Rang 1 | 43,3 % | **48–55 %** | piratecrew ist der Hebel: Star sieht von 65 % auf ~71 %, Salvador Mare bleibt bei 86 % — der Abstand halbiert sich, verschwindet nicht |
| Paartreue ≥ 15 | 94,6 % | 95–96 % | Paare mit großem Abstand sind genau die, bei denen der Zugang heute falsch herum liegt |
| Pp | 16,6 / 12,8 | 12–22 | Richtung unsicher (5.4) |

Das reicht, um den Prototyp zu rechtfertigen. Es reicht nicht, um ohne ihn zu bauen. Und es ist
weniger, als der Konzeptreview für P1 versprochen hat (0,78–0,84) — absichtlich: die Kaderprobe
ist ein Validitäts-Proxy für ein Tor, nicht für ein Spiel, und P1 hat gezeigt, was eine
ungemessene Schätzung wert ist.

---

## 8. I-1 Raumwahl: separat, nicht in dieser Entscheidung

I-1 bleibt die beste Gameplay-Idee für I-Spy, die ich habe — sie gibt Chris die
Aufstellungsentscheidung, die die Slots nicht liefern, spiegelfrei, weil die Räume ohnehin
getrennt sind. Aber sie gehört nicht zu Task #54: sie bewegt per Konstruktion keine Abnahmezahl,
und sie in PR 0 zu mischen würde die Messung unlesbar machen. Nach I-2k, als eigene Chris-Frage.

---

## 9. Fragen an Chris, je eine Zeile

1. **I-2k bauen?** Ein Tag Prototyp auf einer Kopie, Abbruchkriterium wie in Abschnitt 6,
   nichts am Motor, bis die Zahlen stehen. Ja oder nein.
2. **Ein Nebenweg (Kennerblick, gemittelt) statt zwei (Befragen/Beschatten)?** Die zwei
   getrennten unterlaufen laut Kaderprobe die Eignung; die Erzählung bleibt trotzdem getrennt.
3. **Falls PR 0 fällt: G1* mit Toleranz?** Dann bitte als Regel für alle zwanzig, nicht als
   I-Spy-Ausnahme — und erst nach der n=48-Star-Nachmessung.

---

## Anhang A — Kaderprobe, reproduzierbar ohne Motor

```python
import json
d = json.load(open("data/generated/kaderfamilie-live-save.json"))
M  = {'intelligence':18,'torment':17,'spirit':13,'will':12,'charisma':9,'determination':8,'speed':8,'dexterity':8,'awareness':5,'health':2}
SP = {'intelligence':60,'torment':30,'awareness':10}
LOG= {'intelligence':22,'will':48,'determination':30}
MEN= {'torment':22,'charisma':40,'spirit':38}
FIN= {'dexterity':45,'speed':35,'torment':20}
BEF= {'charisma':45,'spirit':35,'torment':20}       # Fassung 30.09.
BES= {'speed':50,'dexterity':30,'will':20}          # Fassung 30.09.
g = lambda a,p: sum(p[k]*a[k] for k in p)/sum(p.values())
sieht3 = lambda S: min(0.90, 0.013*S)
def rank(xs):
    o=sorted(range(len(xs)), key=lambda i:-xs[i]); r=[0]*len(xs)
    for k,i in enumerate(o): r[i]=k+1
    return r
def spearman(x,y):
    rx,ry=rank(x),rank(y); n=len(x); return 1-6*sum((a-b)**2 for a,b in zip(rx,ry))/(n*(n*n-1))
varianten = {
  'Ist':                 lambda s: s['SP'],
  'I-2 Bef+Besch 0,8':   lambda s: max(s['SP'],0.8*s['BEF'],0.8*s['BES']),
  'I-2k Kompetenz 0,85': lambda s: max(s['SP'],0.85*s['KOMP']),
}
for v in d['varianten']:
    ps=[]
    for side in ('heim','gast'):
        for p in v[side][:6]:
            a=p['a']; ps.append({'eig':p['d']['i-spy'],'SP':g(a,SP),'BEF':g(a,BEF),'BES':g(a,BES),
                                 'KOMP':(g(a,LOG)+g(a,MEN)+g(a,FIN))/3})
    eig=[s['eig'] for s in ps]
    print(v['label'], {k: round(spearman(eig,[sieht3(f(s)) for s in ps]),2) for k,f in varianten.items()})
```

Die Tabellen in Abschnitt 4 sind die Ausgabe dieses Skripts (plus die dort genannten Zusatz-
Varianten und die Streuungs-/Deckel-Zeilen, die sich auf dieselbe Weise ergeben). `p.d["i-spy"]`
ist derselbe Wert, den `setz()` (`engine.js:15624`) als `eig`-Basis liest; Slot- und Formzuschlag
fehlen, sie sind klein und spielweise, ändern die Ordnung über 60 Spieler aber nicht wesentlich.

## Quellen im Repo

`CLAUDE.md` · `docs/design/i-spy-pp-rezeptrunde-diagnose-02-10.md` ·
`docs/design/fable-ideen-arena-ispy-30-09.md` · `docs/design/i-spy-p1-prototyp-befund-26-09.md` ·
`docs/design/i-spy-opus-konzeptreview-26-09.md` · `docs/design/i-spy-opus-gegencheck-2-22-09.md`
(Nebenweg 3,71 %) · `docs/design/stand-aller-disziplinen.md` Abschnitt 7 ·
`docs/design/basketball-g1-stern-paartreue-10-09.md` (G1*-Wortlaut) ·
`docs/design/messgrundlage-kaderfest.md` · `data/generated/kaderfamilie-live-save.json` ·
`data/generated/rangtreue-basislinie.json` (Zeile „i-spy") · `public/mockups/battle-mode.engine.js`
(`main` `466e53fb`, Stellen wie im Kopf angegeben) · `scripts/miss-alle-disziplinen.mjs`,
`scripts/miss-star-paartreue.mjs`, `scripts/messe-arena-einfluss.mjs`,
`scripts/messe-arena-einfluss-zweiter-saatstamm.mjs`, `scripts/miss-arena-buehne-spiegel.mjs`.
