# Der Stand aller zwanzig Disziplinen

Stand 02.09.2026. Gemessen mit `scripts/miss-alle-disziplinen.mjs 24`, also 24 Spiele je
Disziplin, auf der **korrigierten Messbasis** (s. Abschnitt „Warum die alten Zahlen nicht
mehr gelten").

Chris' Frage war: *„welche sind quasi spielreif?"* — und dann, praeziser: *„dass die diszis
INSGESAMT soweit fertig werden also was gameplay angeht, visuals, bewegungen, scoring usw"*.
Dieses Dokument beantwortet beides, getrennt nach vier Achsen.

---

## 1. Rangtreue — die Abnahmezahl

Die Schranke steht in CLAUDE.md und gilt fuer alle: **rho ueber 0,80 in EINEM Spiel**. Pro
Saison kommt jede Disziplin nur ein paar Mal dran; eine Rangtreue, die sich erst ueber zwanzig
Spiele einstellt, ist fuer den Spieler nicht vorhanden.

Die zweite Spalte (rho ueber die Saison) sagt daneben, ob die Mechanik ueberhaupt das Richtige
belohnt. Der Zusammenhang ist gemessen und traegt auf ±0,01:

    rho(ein Spiel) = rho(Saison) x Wurzel(Verlaesslichkeit)

| Disziplin | Chassis | rho je Spiel | rho Saison | |
|---|---|---:|---:|---|
| Speed-Schach | Buehne | 0,950 | 0,986 | bestanden |
| Wettessen | Buehne | 0,921 | 0,979 | bestanden |
| Time-Trial | Bahn | 0,902 | 0,998 | bestanden |
| Eiskunstlauf | Buehne | 0,892 | 0,958 | bestanden |
| Breaking | Buehne | 0,891 | 0,993 | bestanden |
| Climbing | Bahn | 0,846 | 0,900 | bestanden |
| Takeshi's Castle | Bahn | 0,842 | 0,958 | bestanden |
| Basketball | Feldspiel | 0,786 | 0,881 | knapp |
| Showcase | Buehne | 0,784 | 0,825 | knapp |
| I-Spy | Buehne | 0,776 | 0,776 | knapp |
| Staffel | Bahn | 0,757 | 0,818 | knapp |
| Spurt | Bahn | 0,745 | 0,762 | knapp |
| Gewichtheben | Buehne | 0,745 | 0,839 | knapp |
| Hockey | Feldspiel | 0,670 | 0,874 | durchgefallen |
| Mini-DM | Arena | 0,658 | 0,786 | durchgefallen |
| Tennis | Feldspiel | 0,605 | 0,762 | durchgefallen |
| TDM | Arena | 0,506 | 0,587 | durchgefallen |
| Fechten | Arena | 0,495 | 0,559 | durchgefallen |
| Battlefield | Arena | 0,469 | 0,500 | durchgefallen |
| Football | Feldspiel | 0,307 | 0,776 | durchgefallen |

**Sieben bestehen, sechs sind knapp, sieben fallen durch.**

### Was die zwei Spalten zusammen sagen

Wo die Saisonzahl hoch und die Einzelspielzahl niedrig ist, belohnt die Mechanik das Richtige,
aber zu laut — das ist ein **Verlaesslichkeitsproblem**, und es loest sich ueber Ereignisdichte,
nicht ueber Rezepte. Football (0,307 gegen 0,776) und Hockey (0,670 gegen 0,874) stehen genau
so da.

Wo beide Zahlen niedrig sind, belohnt die Mechanik das Falsche — ein **Validitaetsproblem**.
Die ganze Arena steht so da (0,50 bis 0,59 in der Saison).

---

## 2. Warum die alten Zahlen nicht mehr gelten

`zieheFormkarten` nahm `z % n` von einem linearen Kongruenzgenerator, also die UNTERSTEN Bits.
Deren Periode ist bei vier Formwerten genau vier. Nachgerechnet ergaben **24 verschiedene
Saaten genau VIER verschiedene Kartensaetze**, 1000 Saaten ebenfalls vier.

Jede Rangtreue, jede Pp-Zahl und jeder Korridor dieses Projekts lief damit auf vier Spielen,
die sich sechsmal wiederholten. Seit dem Umstieg auf die oberen Bits sind es 24 aus 24.

**Die Basketball-Schranke lautet ab hier `0,786 / 0,881`** (Einzelspiel / Saison, n=24). Die
alten `0,836 / 0,804 / 87,3 / 101,8 / 82,3` sind auf einer Stichprobe von vier entstanden und
gelten nicht mehr.

---

## 3. Dieselbe Luecke, vier Mal

`p.d` haelt genau ZWEI Disziplinwerte vorberechnet: `tdm` und `spurt`. Alle vier Chassis lasen
die Eignung als `p.d[disziplin] || 0` — fuer die uebrigen achtzehn Disziplinen fiel der
Basiswert damit auf 0, und `eig` bestand nur aus Slot-, Trait- und Formzuschlag.

| Chassis | Funktion | behoben |
|---|---|---|
| Feldspiel | `bauFeldspiel` | 25.08. (Chris' Fund) |
| Buehne | `bauBuehne` | 02.09. |
| Bahn | `bauSpurt` | 02.09. |
| Arena | `baueEinheit` | 02.09. |

In der Arena wiegt sie am schwersten, weil `eigWert` dort ueber `aufEignung()` direkt in die
KAMPFWERTE geht und nicht nur in die Anzeige. Fechtens fruehere 0,769 waren deshalb ein
Zirkelschluss: die Messung verglich eine Zahl mit sich selbst.

---

## 4. Die anderen drei Achsen

### Visuals

Es gibt **vier Bilder fuer zwanzig Disziplinen**, eines je Chassis: `bodenFeldspiel`,
`bodenBuehne`, `bodenArena`, `bodenSpurt`. Eigene Arenen haben genau zwei Disziplinen —
Basketball (Court) und Eishockey (Eisflaeche mit Linien, Torraeumen, Toren). Die uebrigen
achtzehn teilen sich das Bild ihres Chassis, mit kleinen Abweichungen wie Bodenfarbe
(`BA().boden`), Hindernissen und Steigung.

### Bewegungen

Die Sprites koennen laufen, angreifen, stuerzen, taumeln und den Schlaeger fuehren. Ausser im
Eishockey (Bodycheck, Torwartbogen, Schussphasen, Bandenzweikampf) gibt es keine
disziplineigenen Bewegungen.

### Scoring und Produktion

Im echten Spielstand wird bislang **nur Basketball** ueber die Arena ausgespielt
(`ARENA_RESOLVED_DISCIPLINE_IDS`). Die anderen neunzehn laufen ausschliesslich im Mockup.

---

## 5. Was als naechstes den groessten Hebel hat

1. **Die Arena** — vier Disziplinen, alle unter 0,70, und die Ursache ist benannt: die Zielwahl
   ist Geometrie, nicht Bedrohung (264 von 288 Kaempfern zielen auf den Naechsten). Die Zahl der
   Gelegenheiten korreliert mit der Eignung nur zu 0,05 bis 0,25, der Schaden JE Gelegenheit
   dagegen zu 0,42 bis 0,47. Der Motor kann den Staerkeren unterscheiden — er laesst ihn nur
   nicht oefter ran.
2. **Football und Tennis auf den Live-Motor.** Beide rechnen ihr Ergebnis vorab durch, ohne
   Manndeckung, Zonen und Positionen. Footballs Saisonzahl (0,776) gegen die Einzelspielzahl
   (0,307) sagt genau das: zu wenige Ereignisse, um einen Spieler zu erkennen.
3. **Hockey.** Validitaet 0,874, Einzelspiel 0,670 — **KORRIGIERT** (widersprach CLAUDE.md und
   der eigenen Messung): hier fehlt RICHTIGKEIT, nicht Verlaesslichkeit. Bei doppelter
   Spielzeit stieg die Verlaesslichkeit von 0,755 auf 0,85, rho blieb bei 0,719/0,721/0,723
   flach (CLAUDE.md). Gewonnene Pucks haben Retest 0,997 — verlaesslicher wird nichts im
   ganzen Boxscore — aber Tore haengen an der Eignung nur mit rho 0,27, Vorlagen mit 0,09
   (`hockey-impact-verteilung-recherche-fable.md`, Abschnitt 0.1/4.4). Die Mechanik belohnt
   stabil das Falsche: wer im Netfront-Slot steht, nicht wer die Eignung dafuer hat.
4. **Die sechs Knappen** brauchen je eine Rezeptrunde nach Chris' Budget-Methode
   (`scripts/baue-feldspiel-rezept.mjs`), keine Mechanikaenderung.

---

## 5a. Die Arena im Einzelnen — was gepruef ist und was noch offen

Aus Fables Bericht (`arena-duell-recherche-fable.md`), Stand nach der Wertformel-Runde:

| Befund | Stand |
|---|---|
| Wertformel vergab 44 % fuer Getroffenwerden | **behoben** — `tank` gestrichen, `verh` auf 0,4 gesetzt, beides durchgemessen |
| Eignung war Slot plus Formkarte plus Trait | **behoben** — vierte Fundstelle derselben Luecke |
| Zielwahl ist Geometrie statt Bedrohung | offen |
| Battlefield stellt die Eignungsbesten nach hinten (rho -0,49) | **nachzumessen** — Fables Zahl entstand VOR der Eignungsreparatur und kann ein Artefakt davon sein |

### Die eine Entscheidung, die Chris gehoert

Der direkteste Weg, dem Staerkeren mehr Gelegenheiten zu geben, waere die **Schlagfrequenz**:
sie ist heute fuer alle identisch (`cdKuerzung` gibt konstant 0 zurueck, `abkling` teilt nur
durch die Ermuedung). Ein schneller, geschickter Kaempfer schlaegt also exakt so oft zu wie ein
langsamer, und genau deshalb korreliert die Zahl der Gelegenheiten nicht mit der Eignung
(gemessen 0,05 bis 0,25), waehrend der Schaden JE Gelegenheit es sehr wohl tut (0,42 bis 0,47).

Das ist aber KEINE Luecke, sondern eine getroffene Entscheidung: der Tooltip sagt woertlich
„TMP … px/s Marschtempo · beschleunigt den Angriff nicht". Sie umzudrehen ist ein Eingriff in
das Kampfgefuehl und gehoert Chris, nicht mir.

Die Alternative ohne diesen Eingriff ist Fables K1: Zielwahl nach Bedrohung statt nach Naehe,
mit Hysterese, damit niemand im Kreis laeuft. Dann bekommt der Starke nicht mehr Schlaege, aber
die Schlaege der anderen konzentrieren sich sinnvoller.

---

## 5b. Wie weit ist jede Disziplin? — die Prozentzahlen

Die Prozentzahlen sind meine Einschaetzung, keine Messung. Gewichtet ueber vier Achsen:
**Rangtreue 40 %** (die einzige gemessene), **eigene Mechanik 25 %**, **Bild und Bewegung
20 %**, **im echten Spielstand 15 %**. „Eigene Mechanik" heisst: hat die Disziplin Regeln, die
ueber das hinausgehen, was ihr Chassis fuer alle mitbringt.

| Disziplin | fertig | rho | Was steht |
|---|---:|---:|---|
| Basketball | 90 % | 0,786 | Live-Motor mit Zonen, Manndeckung und Spielzuegen · eigener Court · **einzige Disziplin im echten Spielstand** |
| Hockey | 70 % | 0,670 | Live-Motor mit Torwart, Bodychecks, Strafen und Ueberzahl · eigene Eisflaeche · Schussweiten aus dem realen Massstab |
| Time-Trial | 55 % | 0,902 | Kurvenmodell mit Linie und Risiko · Rangtreue bestanden · Bild vom Chassis |
| Climbing | 50 % | 0,846 | Steigung und Kraftbudget statt Antritt · Rangtreue bestanden · Bild vom Chassis |
| Takeshi's Castle | 50 % | 0,842 | Hindernisse und Nerven · Rangtreue bestanden · Bild vom Chassis |
| Spurt | 50 % | 0,745 | Huerden, Windschatten, Rempler, drei Rennplaene · Bild vom Chassis |
| Staffel | 45 % | 0,757 | Abschnittszeit, stufenlose Uebergabe, Kurve, Zug an der Spitze · von rho -0,04 auf 0,76 gehoben |
| Gewichtheben | 45 % | 0,745 | Reissen und Stossen mit je drei Versuchen, Duelle je Slot, Nullwertung · Buehnenbild fehlt noch |
| Speed-Schach | 45 % | 0,950 | Duell-Variante der Buehne, Brett gegen Brett · beste Rangtreue im Feld · Bild vom Chassis |
| Wettessen | 40 % | 0,921 | Nur Buehnen-Durchgaenge mit eigenem Rezept · keine eigene Mechanik |
| Eiskunstlauf | 40 % | 0,892 | Nur Buehnen-Durchgaenge mit eigenem Rezept · keine eigene Mechanik |
| Breaking | 40 % | 0,891 | Nur Buehnen-Durchgaenge mit eigenem Rezept · keine eigene Mechanik |
| I-Spy | 40 % | 0,776 | Duell-Variante der Buehne · Spielerwert auf eigene Punkte umgestellt |
| Showcase | 35 % | 0,784 | Nur Buehnen-Durchgaenge mit eigenem Rezept · keine eigene Mechanik |
| Mini-DM | 30 % | 0,658 | Gemeinsamer Arena-Motor mit eigenen Slots · Wertformel und Eignung repariert |
| TDM | 30 % | 0,506 | Aeltester Motor, am staerksten eingemessen · Zielwahl haengt an der Geometrie |
| Fechten | 25 % | 0,495 | Gemeinsamer Arena-Motor · gehoert laut Recherche als Paar-Duell auf die Buehne |
| Battlefield | 25 % | 0,470 | Aufstellung repariert (Siege Core stand hinten) · Validitaet von 0,50 auf 0,71 |
| Tennis | 25 % | 0,605 | Vorab-Pfad ohne Zonen und Deckung · eigene Zuege und Rezept |
| Football | 20 % | 0,307 | Vorab-Pfad · Ereignisdichte verdreifacht · gehoert auf den Live-Motor |

**Kein Durchschnitt ueber alles**, weil die Achsen ungleich schwer wiegen: die neunzehn
Disziplinen ausserhalb von Basketball koennen zusammen keine 15 % erreichen, solange sie nicht
im Spielstand laufen, und die achtzehn ohne eigenes Bild keine 20 %. Wer die Zahlen heben will,
hebt sie am billigsten ueber diese beiden Achsen, nicht ueber Rezepte.

---

## 6. Das Werkzeug

`window.__arena.disziplinProbe(dId, {n})` baut, laesst laufen und sammelt `wert()` und `eig` je
Teilnehmer ein — fuer alle vier Chassis ueber dieselbe `MOTOREN`-Schnittstelle. Vorher gab es
eine Sonde nur fuers Feldspiel, also fuer vier der zwanzig Disziplinen; ueber die anderen
sechzehn liess sich gar nichts sagen.

    node scripts/miss-alle-disziplinen.mjs [spiele] [disziplin ...]
