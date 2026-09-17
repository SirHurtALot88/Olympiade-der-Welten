# Fechten: Aufwertungsplan — rho über 0,85 und K4 geschlossen (17.09.)

Auftrag Chris: „Fechten soll Fable ran nehmen für nen Plan der es deutlich nach oben bringt."
Kein Kalibrier-Nachschlag, sondern ein Plan, der den Gesamtwert (heute 91 %: Konzept 75 /
Assets 100 / Gameplay 90 / Movement 100) substanziell hebt. Die zwei offenen Punkte aus
`docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md` (zwölfter Nachtrag):

- **K4** (kalibriert, Designfragen entschieden) — offen, weil der Kopfkommentar über
  `BUEHNE_ART.fechten.rezept` weiterhin „ERSTER, AUSDRUeCKLICH NICHT FINALER Sieben-Rollen-Entwurf"
  heißt, der Puffer zur 0,80-Schranke (0,026) kleiner ist als das Kaderrauschen (0,203) und die
  im Code selbst angekündigte Werkzeug-Kalibrierung („kein `baue-feldspiel-rezept.mjs`-Äquivalent
  für dieses Chassis") nie stattfand.
- **G1** — rho 0,826 liegt in der 0,80–0,85-Stufe (35 Punkte), nicht in der ≥0,85-Stufe (40).

**Ergebnis vorab:** beides ist erreichbar, und zwar nicht knapp. Mit dem hier gebauten
Werkzeug (`scripts/kalibriere-buehne-rezept.mjs`, neu) gefundenes Rezept plus `rundenN` 9→18:
**rho je Spiel 0,910** (kaderfest, echter Motor, `disziplinProbe` mit denselben fünf Kadern und
Saaten wie `miss-alle-disziplinen.mjs 24 fechten`), Spannweite 0,103, Saison 0,972 — schwächster
der fünf Kader 0,866. Auf Saaten und Kadern, die die Suche nie gesehen hat: 0,896 bzw. 0,943.
Das Rezept allein reicht dafür NICHT (0,846–0,863 offiziell, 0,836 auf fremden Saaten), die
Rundenzahl allein auch nicht (0,846) — es braucht beide Hebel, und der Abschnitt 2 erklärt, warum.

Alle Zahlen in diesem Dokument tragen eine Kennzeichnung: **[Motor]** = im echten
`battle-mode.engine.js` gemessen (`disziplinProbe`, Playwright), **[Nachbildung]** = mit der
bit-genauen Offline-Nachbildung des Durchgangs-Rechners im neuen Werkzeug (Abschnitt 3). Wo beide
vorliegen, sind sie identisch — die Nachbildung ist gegen den Motor über 1440 Teilnehmer mit
Summe der Abweichungen 0,000 geprüft (`--vergleich`), für Fechten wie für Speed-Schach,
Eiskunstlauf (duett) und Showcase.

---

## 1) Frisch nachgemessen: der Ist-Stand, und was der Median verdeckt

`node scripts/miss-alle-disziplinen.mjs 24 fechten` auf `main` @ `91b17c3a` **[Motor]**:

```
fechten   buehne   12   0.826   0.203   0.888   0.161   bestanden
```

Bit-identisch zum zwölften Nachtrag. Die Zahl je Kader-Variante (dieselbe Messung, nur nicht
zum Median zusammengefasst):

| Kader-Paarung | Eignungs-Streuung der 12 (SD) | rho je Spiel, n=24 [Motor] | rho je Spiel, n=200 frische Saaten [Nachbildung] |
|---|---:|---:|---:|
| vigilante-armageddon | 18,4 | 0,826 | 0,827 |
| coldsteel-direlegion | 21,4 | 0,933 | 0,939 |
| goldengladiators-silversoldiers | **10,9** | **0,751** | **0,738** |
| mortalsin-natureswrath | **12,4** | **0,730** | **0,762** |
| piratecrew-raginglunatics | 22,8 | 0,912 | 0,912 |

**Zwei der fünf echten Kader liegen unter 0,80, und zwar nicht wegen Saat-Pech (n=200 bestätigt
es).** Es sind genau die beiden mit gestauchter Eignungsstreuung — dort liegen viele Paare
eng beieinander, und dort muss ein Rezept das Richtige belohnen, sonst ordnet der Würfel. Der
Median 0,826 „besteht", weil drei weite Kader ihn tragen. Das ist der Grund, warum der Puffer
(0,026) so viel kleiner ist als das Rauschen (0,203): das Rauschen ist gar kein Rauschen, es ist
ein systematischer Unterschied zwischen weiten und engen Kadern.

Nebenbefund zur Messung selbst: die offizielle n=24-Zahl mit festen Saaten hat eine Unschärfe von
etwa ±0,02. Ein Rezept „Matrix in jeder Rolle" misst bei n=24 **0,818**, bei n=200 mit frischen
Saaten **0,838** [beides Nachbildung]; das in Abschnitt 4 gefundene Rezept-9 misst offiziell 0,863
[Motor], auf fremden Saaten 0,836 [Nachbildung]. Wer über Bewegungen unter 0,03 berichtet,
berichtet Saaten. Das Werkzeug gibt deshalb jede Zahl dreifach aus (offiziell / fremde Saaten /
fremde Kader), s. Abschnitt 3.

---

## 2) Strukturanalyse: warum Fechten bei 0,826 hängt

### 2.1 Die zwei Größen, und sie ziehen gegeneinander

CLAUDE.md zerlegt die Einzelspiel-Rangtreue in Validität × √Verlässlichkeit. Für das Bühnen-
Chassis lässt sich die Validität direkt ausrechnen, ohne Würfel: rho zwischen Eignung und dem
**Erwartungswert** der Punktsumme je Spiel (Erfolgswahrscheinlichkeit statt Wurf). Das Werkzeug
tut genau das (`Zerlegung`):

| Rezept | Validität (ohne Würfel) | Signal-SD (Streuung des Erwartungswerts) | Rausch-SD (binomial) | rho je Spiel n=24 |
|---|---:|---:|---:|---:|
| Ist (16.09.) | 0,894 | 153 | 55 | 0,826 |
| Matrix in jeder Rolle | **0,969** | 150 | 54 | **0,818** |
| Rezept-18 (Abschnitt 4) | 0,959 | 163 | 54 | 0,846 (bei rundenN 9) |

Die zweite Zeile ist der Schlüsselbefund. Ein Rezept, in dem jede der sieben Rollen exakt die
Matrix trägt, hat eine Validität von 0,969 — die Decke dieses Chassis, weil die Eignung
(`p.d.fechten`) im Spiel eine streng monotone Funktion des Matrix-Schnitts ist (Spearman 1,000
über die 110 Spieler der Kaderfamilie, nachgerechnet gegen `calculateRawDisciplineScore`). Und
trotzdem misst es je Spiel **schlechter** als das Ist-Rezept. Grund: ein gewichteter Schnitt über
acht Attribute streut weniger als eine scharfe Drei-Attribut-Mischung — die Sub-Skill-Werte
rücken zusammen, das Signal gegen dasselbe Würfelrauschen wird kleiner. Genau das ist der
„Kannibalisierungs-Effekt", den `fechten-rezeptkalibrierung-16-09.md` bei jedem breiteren
PUBLIKUM-Tausch beobachtet, aber nicht erklären konnte: **breiter = valider, aber leiser.**

Das heißt für die Kalibrierung: es gibt kein Sinkhorn-Optimum. Matrix-Treue je Rolle maximiert
nur die Validität; die Einzelspielzahl braucht scharfe Rollen, deren **Summe** die Matrix trifft.
Das ist ein Suchproblem über die Einzelspiel-Rangtreue selbst, kein Transportproblem — und
deshalb ist das Werkzeug in Abschnitt 3 anders gebaut als `baue-feldspiel-rezept.mjs`.

### 2.2 Wo die Validität des Ist-Rezepts verloren geht

Attribut-Einfluss gegen Matrix (Verfahren von `messe-arena-einfluss.mjs`: je ein Attribut um +10
angehoben, Gewinn an der Punktsumme, positiv normiert; hier in der Nachbildung gerechnet, das
Ergebnis für das Ist-Rezept deckt sich mit der Browser-Messung vom 16.09. — 44,7 gegen 43,1 Pp):

| Attribut | Matrix | Ist-Rezept | Rezept-18 |
|---|---:|---:|---:|
| torment | 25 | 27,6 % | 27,7 % |
| dexterity | 20 | 26,0 % | 21,6 % |
| **speed** | **16** | **6,4 %** | **18,9 %** |
| awareness | 15 | 24,5 % | 15,3 % |
| **power** | **10** | **1,5 %** | **8,0 %** |
| determination | 6 | 1,7 % | 4,9 % |
| health | 4 | 8,2 % | 2,8 % |
| intelligence | 4 | 4,0 % | 0,9 % |
| **Abweichung** | | **44,7 Pp** | **14,9 Pp** |

Speed (drittschwerstes Matrixattribut) und Power (fünftschwerstes) zusammen 26 Matrixpunkte,
mechanisch 8 %. Awareness dagegen 15 Matrixpunkte, mechanisch 24,5 %. Auf einem weiten Kader
fällt das nicht auf — wer viel Torment und Dexterity hat, hat meist auch die höhere Eignung. Auf
einem engen Kader entscheidet genau der Rest: zwei Fechter mit ähnlichem Torment/Dexterity, einer
mit 80 Speed, einer mit 30 — die Matrix sagt, der erste ist deutlich besser, das Ist-Rezept
sieht keinen Unterschied. Das ist der 0,74/0,76-Befund aus Abschnitt 1, mechanisch erklärt.

Die 16.09.-Runde hatte das richtig diagnostiziert (Speed −8,7, Power −8,4) und den Tausch trotzdem
verworfen, weil PUBLIKUM mit speed/power auf 0,798 fiel. Der Fehler war nicht die Diagnose,
sondern der Ort: PUBLIKUM ist der rauschärmste, aber mit 9 % auch ein leichter Kanal; Speed gehört
in TECHNIK/SPITZENMOMENT (Erfolgs- und Ausfallkanäle), Power in SPITZENMOMENT/WAGNIS. Von Hand
findet man das nicht, weil jede Rolle mit jeder anderen wechselwirkt — deshalb das Werkzeug.

### 2.3 Sind drei Sub-Skills die richtige Struktur? Braucht es einen vierten?

Nein — der Blick auf die Rollen führt in die Irre. Die Frage „NERVEN/GRUNDLAGE/TECHNIK richtig
zusammengesetzt?" nimmt die drei schwersten Rollen (mechanisch 44,6 / 16,4 / 10,3 %, Werkzeug-
Sondierung) und lässt SPITZENMOMENT (11,6 %), PUBLIKUM (9,1 %), WAGNIS (5,6 %) und AUSDAUER
(2,3 %) als Restposten stehen. Zusammen tragen diese vier 28,6 % — mehr als TECHNIK. Sie sind
kein Rest, sie sind der Platz, an dem Speed und Power sitzen müssen, damit die Summe stimmt.
Eine vierte Erfolgsrolle oder eine andere Formel würde am Chassis rühren (alle neun Bühnen-
Disziplinen teilen die Formel) und ist nicht nötig: die Validitätsdecke (0,969) ist mit den
sieben vorhandenen Rollen erreichbar, und die gefundenen Rezepte kommen ihr auf 0,953–0,959 nahe.

Vergleich mit den Bühnen-Disziplinen über 0,85 (aus `data/generated/rangtreue-basislinie.json`):

| Disziplin | rho je Spiel | Saison | Spannweite | rundenN | Was anders ist |
|---|---:|---:|---:|---:|---|
| Speed-Schach | 0,908 | 0,972 | 0,066 | 10 | Matrix mit 7 Attributen, davon zwei dominant (intelligence 28, awareness 21); GRUNDLAGE/TECHNIK/SPITZENMOMENT tragen alle drei intelligence+awareness — die Summe trifft die Matrix fast von selbst. Kader-Streuung gleichmäßig (SD 9–17). |
| Eiskunstlauf | 0,885 | 0,979 | 0,083 | **12** (verdoppelt 07.09.) | Verlässlichkeitsfix per Rundenzahl, Saison schon vorher 0,944. |
| Breaking | 0,869 | 0,951 | 0,114 | **8** (verdoppelt 07.09.) | dito. |
| **Fechten** | **0,826** | **0,888** | **0,203** | 9 | Saison **und** Einzelspiel niedrig — beide Spalten, nicht nur eine (CLAUDE.md „die zwei Spalten lesen"). |

Fechten ist die einzige dieser vier, bei der die Saisonzahl selbst unter 0,90 liegt. Nach der
CLAUDE.md-Regel ist das ein Rezeptproblem (Validität), nicht ein Uhrproblem. Aber die
Verdopplungen bei Eiskunstlauf/Breaking zeigen, dass die Bühne zugleich die dokumentierte
**Ausnahme** von „mehr Ereignisse helfen fast nie" ist: kein RNG-Kaskaden-Effekt wie im Hockey,
jeder Durchgang ein unabhängiger Wurf, Spearman-Brown greift sauber (Kommentar bei
`BUEHNE_ART.eiskunstlauf`). Für Fechten heißt das: beide Hebel stehen offen, und Abschnitt 4 zeigt,
dass erst beide zusammen über 0,85 tragen.

### 2.4 Zwei weitere Hebel, geprüft und bewusst nicht empfohlen [Nachbildung]

| Hebel | offiziell | fremde Saaten | fremde Kader | Urteil |
|---|---:|---:|---:|---|
| `failAbzug` 0,55 → 0,70 (Ist-Rezept) | 0,848 | 0,845 | 0,903 | wirkt, aber ein „kommt zu spät" kostet dann nur noch 30 % statt 45 % — die Erfolgsrollen (TECHNIK/NERVEN) verlieren mechanisches Gewicht, das Gefecht wird entschieden, bevor gefochten wird. Kein Rezept-, ein Designhebel; nur als Notnagel. |
| `failAbzug` 0,55 → 0,85 (Ist-Rezept) | 0,871 | 0,868 | 0,925 | dito, stärker; sportlich falsch herum (ein Fehlangriff bringt real null). |
| Erfolgskurve steiler (`erfT` 0,0055 → 0,007) | 0,828 | 0,822 | 0,892 | wirkungslos, und es wäre ein Eingriff in die geteilte Formel. |
| Basis steiler (`basisG` 0,7 → 1,0) | 0,826 | 0,822 | 0,882 | wirkungslos, dito. |

Der interaktive Paar-Rechner (Elo-Kurve, `tennis-fechten-rollout-plan.md` E.2 Phase 2) bleibt,
was er dort schon war: ein Spielgefühl-Ausbau, kein Abnahmehebel — die Rangtreue liest die
eigene Punktsumme, nicht das Duellergebnis (`MOTOREN[…].wert()`, „EIGENE PUNKTE, AUCH IM DUELL").

---

## 3) Das Werkzeug: `scripts/kalibriere-buehne-rezept.mjs` (neu, in diesem Zweig angelegt)

Das Bühnen-Gegenstück zu `baue-feldspiel-rezept.mjs`, aber aus dem Grund in 2.1 kein Sinkhorn,
sondern eine Suche über die Einzelspiel-Rangtreue selbst:

- **Bit-genaue Nachbildung** des generischen Durchgangs-Rechners (`bauBuehne()`/`setz()`,
  Slot-Aufschlag, Formkarten mit den oberen LCG-Bits, `mische()`, `rr()`, Duell- und Duett-Zweig),
  gespeist aus denselben Quellen wie der Motor: Matrix, Slots und `BUEHNE_ART`-Eintrag werden aus
  `battle-mode.engine.js` gelesen, Kader aus `data/generated/kaderfamilie-live-save.json`. Ein
  Rezept rechnet in Millisekunden statt in Sekunden; 3000 Suchschritte dauern zehn Sekunden.
- **`--vergleich`**: Selbsttest gegen den echten Motor (Playwright, `disziplinProbe`, dieselben
  Saaten). Ergebnis heute: 1440 Teilnehmer, Abweichung 0,000, bit-identisch — für `fechten`,
  `speed-schach`, `eiskunstlauf` (duett) und `showcase`. `gewichtheben` (`heben:true`, eigener
  Paar-Rechner) wird abgelehnt.
- **Ohne Schalter**: Ist-Stand je Kader, Zerlegung (Validität/Signal/Rauschen), Vergleich mit der
  Validitätsdecke, mechanisches Gewicht der Rollen, Ist-Rezept bei rundenN 9/12/18.
- **`--suche [schritte] [--rundenN n] [--frei] [--schreibe datei.json]`**: deterministischer
  Bergsteiger in 5-Punkt-Schritten mit drei Startpunkten (Ist-Rezept, Matrix-in-jeder-Rolle, Ist
  mit zweiter Saat), danach Glättung (Posten unter 10 % streichen, wenn es <0,002 kostet).
  **Semantik-Schranke** `ERLAUBT` je Rolle (die einzige Stelle mit Fechten-Wissen im Skript, nach
  dem Muster von `baue-feldspiel-rezept.mjs`; `--frei` schaltet sie ab). **Ziel ist das Mittel
  über 13 Kader**: die fünf offiziellen plus acht deterministische Mischkader aus denselben 110
  Spielern — gegen Überanpassung an fünf Paarungen. Berichtet wird jede Lösung dreifach:
  offiziell (die Abnahmemessung), **held-out Saaten** (dieselben fünf Kader, Saat 424242 statt
  1337, n=48) und **held-out Mischkader** (acht weitere Mischungen mit eigener Saat, n=48), die
  die Suche nie gesehen hat.
- **`--pruefe <rezept.json> [--rundenN n] [--failAbzug x]`**: Kandidat im ECHTEN Motor messen —
  Kopie von `battle-mode.*` im Temp-Verzeichnis, nur der `BUEHNE_ART`-Eintrag der Disziplin wird
  dort umgeschrieben (Kommentarzeilen ausgenommen), Arbeitsbaum bleibt unangetastet, dieselbe
  Zahl wie `miss-alle-disziplinen.mjs`. Keine Zahl aus der Nachbildung wandert ohne diesen
  Schritt in ein Dokument.

Das schließt genau die Lücke, die drei Kommentare im Motor benennen (`BUEHNE_ART.tennis`:
„fehlt für die Bühne weiterhin das Werkzeug"; `BUEHNE_ART.fechten`: „kein
`baue-feldspiel-rezept.mjs`-Äquivalent"; `fechten-rezeptkalibrierung-16-09.md`: „sobald ein
Bühnen-Äquivalent existiert") — und es ist nicht fechtenspezifisch: Tennis (0,825, Puffer 0,025,
gleiche Klage im Code) und Wettessen (0,845) sind dieselbe Aufgabe mit einem anderen Namen.

---

## 4) Die Suche: was sie gefunden hat, mit Zahlen

### 4.1 Zwei Läufe, ein Muster

`node scripts/kalibriere-buehne-rezept.mjs fechten --suche 3000` (bei rundenN 9) und
`… --suche 3000 --rundenN 18`. Beide Läufe, alle drei Startpunkte, konvergieren auf dasselbe
Muster — Speed in die Erfolgs-/Ausfallkanäle, Power in Ausfall/Wagnis, NERVEN auf
awareness+determination, GRUNDLAGE bleibt torment/dexterity-getragen:

```
Rezept-18 (Suche bei rundenN 18, EMPFOHLEN):
  GRUNDLAGE:    {torment:42,dexterity:38,awareness:15,speed:5}
  SPITZENMOMENT:{speed:45,dexterity:30,power:25}          // der Ausfall: Tempo, Klinge, Kraft
  TECHNIK:      {speed:53,torment:32,awareness:15}         // Beinarbeit trägt die Trefferchance
  NERVEN:       {awareness:50,determination:30,health:20}  // wie 16.09., nur ohne Übersteuerung
  PUBLIKUM:     {torment:45,determination:25,intelligence:15,health:15}
  AUSDAUER:     {speed:80,power:20}
  WAGNIS:       {power:80,torment:20}

Rezept-9 (Suche bei rundenN 9, Rückfall, falls rundenN bleibt):
  GRUNDLAGE:    {torment:42,dexterity:33,speed:15,awareness:10}
  SPITZENMOMENT:{torment:60,speed:40}
  TECHNIK:      {dexterity:48,awareness:35,torment:17}
  NERVEN:       {awareness:50,determination:50}
  PUBLIKUM:     {speed:50,health:25,torment:15,determination:10}
  AUSDAUER:     {power:75,speed:25}
  WAGNIS:       {power:90,speed:10}
```

Mechanisch sind beide gleichwertig (Validität 0,953 / 0,959, Abweichung zur Matrix 15 Pp). Rezept-18
ist das lesbarere: SPITZENMOMENT als Ausfall (speed/dexterity/power) und NERVEN mit derselben
Dreiergruppe wie die 16.09.-Fassung; Rezept-9 parkt Power fast vollständig in WAGNIS/AUSDAUER.

### 4.2 Die Zahlen — offiziell im Motor, held-out in der Nachbildung

| Konfiguration | offiziell, n=24 (Median / Mittel / Spannweite / schwächster Kader) | Saison | held-out Saaten | held-out Mischkader |
|---|---|---:|---:|---:|
| Ist-Rezept, rundenN 9 (heute) | **0,826** / 0,830 / 0,203 / 0,730 [Motor] | 0,888 | 0,820 | 0,879 |
| Ist-Rezept, rundenN 18 (nur Uhr) | 0,846 / 0,861 / 0,165 / 0,780 [Motor] | 0,881 | 0,852 | 0,925 |
| Rezept-9, rundenN 9 (nur Rezept) | 0,863 / 0,889 / 0,133 / 0,827 [Motor] | 0,951 | 0,836 | 0,904 |
| Rezept-18, rundenN 9 (nur Rezept) | 0,846 / 0,878 / 0,148 / 0,810 [Motor] | 0,965 | 0,837 | 0,910 |
| Rezept-18, rundenN 12 | 0,881 / 0,900 / 0,120 / 0,841 [Motor] | 0,986 | 0,865 | 0,922 |
| Rezept-9, rundenN 12 | 0,883 / 0,905 / 0,106 / 0,854 [Motor] | 0,930 | 0,863 | 0,919 |
| **Rezept-18, rundenN 18 (EMPFOHLEN)** | **0,910** / 0,921 / 0,103 / **0,866** [Motor] | 0,972 | **0,896** | **0,943** |
| Rezept-9, rundenN 18 | 0,911 / 0,915 / 0,111 / 0,860 [Motor] | 0,972 | 0,892 | 0,936 |

Lesart:

- **Nur das Rezept** hebt die Validität auf die Decke (Saison 0,888 → 0,951–0,965) und die beiden
  engen Kader von 0,73/0,75 auf 0,81–0,86 — aber auf fremden Saaten bleibt es bei 0,836/0,837.
  Die 0,85-Linie wird offiziell erreicht (0,863) und liegt zugleich innerhalb der Saat-Unschärfe.
  **Ehrlich: bei rundenN 9 ist 0,85 nicht robust.**
- **Nur die Uhr** (rundenN 18, Ist-Rezept) hebt auf 0,846 — die engen Kader bleiben bei 0,78/0,79,
  weil sie ein Validitätsproblem haben, das keine Rundenzahl löst. Genau die CLAUDE.md-Regel.
- **Beides** trägt: 0,910 offiziell, schwächster Kader 0,866, fremde Saaten 0,896, fremde Kader
  0,943. Bei n=200 frischen Saaten [Nachbildung]: Median 0,890, Mittel 0,912, schwächster 0,859.
  Das ist ein Puffer zur 0,85-Marke von 0,04–0,06 auf jeder Achse, und ein Puffer zur
  0,80-Schranke, der erstmals größer ist als die Spannweite (0,110 gegen 0,103).
- rundenN 12 (Eiskunstlauf-Tempo, 0,417 s je Enthüllung) ist die konservative Zwischenstufe:
  0,881 offiziell, 0,865 fremde Saaten — über 0,85, aber ohne die Reserve von 18.

### 4.3 Die ehrlichere Abnahme (CLAUDE.md: Star und Paartreue mit Abstand) [Nachbildung, n=200]

| | Star auf Rang 1 | Star in Top 2 | Star Letzter | Paare ≥15 Pkt richtig | Paare ≥5 Pkt | Paare ≥2 Pkt |
|---|---:|---:|---:|---:|---:|---:|
| Ist, rundenN 9 | 84 % | 94 % | 0 % | 97,2 % | 90,5 % | 87,5 % |
| Rezept-18, rundenN 9 | 84 % | 94 % | 0 % | 98,6 % | 93,7 % | 90,6 % |
| Ist, rundenN 18 | 87 % | 98 % | 0 % | 98,3 % | 92,2 % | 89,1 % |
| **Rezept-18, rundenN 18** | **89 %** | **98 %** | 0 % | **99,3 %** | **95,7 %** | **92,8 %** |

Der Star steht schon heute meist vorn (Fechten war nie das Problem des Hockey-Typs). Was sich
bewegt, sind die mittleren Paare: 5-Punkte-Paare von 90,5 auf 95,7 % — das ist der Effekt der
Validität auf den engen Kadern, in Paaren ausgedrückt.

---

## 5) Der Plan für die Umsetzungsrunde

### 5.1 Code (eine Datei, ein Eintrag)

`public/mockups/battle-mode.engine.js`, `BUEHNE_ART.fechten`:

1. `rezept` → Rezept-18 (Abschnitt 4.1).
2. `rundenN:9` → `rundenN:18`, `rundenDauer:60/(9*6*2)` → `60/(18*6*2)` (0,278 s; Gesamtdauer
   bleibt 60 s, wie bei Eiskunstlauf/Breaking). Der Perioden-Beat (`proPeriode=rundenN/3`,
   stepBuehne „PERIODE BEENDET") ergibt damit drei Perioden zu je sechs Gängen — nichts weiter
   anzufassen. `stepFechten()`: Ausfall 0,22 s + Erholung 0,24 s = 0,46 s je Aktion; ein Brett
   sieht bei 0,278 s Enthüllungstakt alle 0,56 s eine Aktion (zwei Fechter je Brett) — passt,
   knapp. Alternative, falls Chris den Feed (216 statt 108 Zeilen je Spiel) oder das Tempo zu
   dicht findet: `rundenDauer` 0,417 s wie Eiskunstlauf, Gesamtdauer 90 s — drei Perioden zu 30 s,
   was der FIE-Erzählung (3 × 3 Minuten) sogar näher kommt. Rho-neutral, reine Enthüllung.
3. Kopfkommentar: „ERSTER, AUSDRUeCKLICH NICHT FINALER Sieben-Rollen-Entwurf … Noch keine
   Sinkhorn-Kalibrierrunde" ersetzen durch einen **KALIBRIERSTAND**-Block: Datum, Werkzeug und
   Aufruf (`kalibriere-buehne-rezept.mjs fechten --suche 3000 --rundenN 18`), die Tabelle aus 4.2
   in Kurzform, und der Satz, dass ein künftiger Rezeptwechsel denselben Aufruf plus `--pruefe`
   durchläuft. Der Kommentar „PERIODEN + TREFFERSTAND" behauptet, die rundenN-Änderung sei
   „REINE Enthüllungs-Gruppierung … rho-neutral" — das war schon am 14.09. nicht ganz richtig
   (0,816 → 0,809) und ist mit 18 Runden ausdrücklich falsch; korrigieren.

### 5.2 Messen und nachziehen (Reihenfolge)

1. `node scripts/kalibriere-buehne-rezept.mjs fechten --vergleich` — Nachbildung und Motor
   müssen nach dem Einbau weiterhin bit-identisch sein (sonst wurde mehr geändert als der Eintrag).
2. `node scripts/miss-alle-disziplinen.mjs 24` — alle zwanzig; die neunzehn anderen Zeilen
   bit-identisch (Isolationsnachweis wie am 16.09.), Fechten `0.910 0.103 0.972 0.084`.
3. `node scripts/baue-rangtreue-basislinie.mjs 24` und `npm run ci:rangtreue-schranke`.
4. **PPS-Referenz neu ziehen:** `data/generated/fechten-pps-referenz.json` hält iMittel/iKrass
   des **rohen** Bühnenwerts (`u.summe`) je Feldgröße. 18 statt 9 Durchgänge verdoppeln diese
   Summe — die produktive PPS-Berechnung (`computeIndividualBoxscorePpsFromFixtureResults`,
   `lib/resolve/battle-mode-arena-team-points.ts:833`) wäre sonst um den Faktor 2 verstimmt.
   `npx tsx scripts/ziehe-buehne-pps-referenz.ts fechten` (und danach
   `npx tsx scripts/pruefe-pps-referenz-frische.ts`). Das ist der eine Schritt, den die
   Eiskunstlauf-/Breaking-Verdopplung vom 07.09. nicht brauchte (damals noch nicht produktiv).
5. `npx tsx scripts/pruefe-slot-invariante.ts`; `npx vitest run tests/battle-mode-arena-team-points.test.ts
   tests/arena-headless-runner.test.ts tests/battle-arena-ein-modell-ueberall.test.ts`.
6. Einmal im Mockup anschauen (`public/mockups/battle-mode.html`, Fechten): sechs Bahnen, Takt,
   Feed — die eine Entscheidung aus 5.1 Punkt 2 (60 s oder 90 s) fällt am Bild, nicht an der Zahl.

### 5.3 K4 schließen: die Designfragen, jetzt mit Entscheidungsvorschlag

`fechten-punkte-mehrrunden-konzept-14-09.md` hat sechs Fragen an Chris offen gelassen; K4 heißt
„Designfragen entschieden". Vorschlag, damit die Umsetzungsrunde sie mit erledigt:

| # | Frage (14.09.) | Vorschlag | Begründung |
|---|---|---|---|
| 1 | Rundenzahl je Periode, Gesamtdauer | **18 Gänge = 3 Perioden × 6**, 60 s (oder 90 s, s. 5.1) | der Verlässlichkeitshebel aus 4.2; 36 Aktionen je Gefecht liegen näher an einem 15-Treffer-Gefecht als 18 |
| 2 | Zielzahl für den Trefferstand | **reiner Zählstand, keine Zielzahl** | bei p≈0,63 je Gang fallen im Schnitt 11 Treffer je Fechter, 15 wird selten erreicht; eine Zielzahl, die fast nie fällt, ist ein leeres Versprechen |
| 3 | Option 3, echtes vorzeitiges Ende | **nein** | es würde Ereignisse wegnehmen — genau den Hebel, der hier trägt; und die Erzähl-Krücke „voll rechnen, früh aufhören zu zeigen" kauft Aufwand ohne Abnahmegewinn |
| 4 | hartes Zeitlimit | **Erzählrahmen** („Periode = 20 s" im Feed), keine Uhr | der Motor kennt keine Uhr im Duell, und die Rangtreue braucht keine |
| 5 | Waffenart | **Degen bleibt** | keine Vorfahrts-Zustandsmaschine; der Kopfkommentar begründet es bereits |
| 6 | interaktiver Paar-Rechner | **zurückgestellt, Ausbaustufe** | Spielgefühl-, kein Abnahmehebel (2.4); die Rangtreue liest die eigene Summe |

Mit diesen sechs Antworten im Kopfkommentar (drei Zeilen reichen) und dem KALIBRIERSTAND-Block
ist K4 nicht mehr „formal offen": das Rezept ist werkzeuggestützt kalibriert, gegen fremde
Saaten und Kader geprüft, der Puffer ist größer als das Rauschen, und die offenen Fragen sind
entschieden statt vertagt.

### 5.4 Was das für die Scorecard bedeutet

| Achse | heute | danach | Grund |
|---|---:|---:|---|
| Konzept | 75 | **100** | K4 erfüllt (5.3) |
| Assets | 100 | 100 | unberührt |
| Gameplay | 90 | **95** | G1 von der 0,80–0,85-Stufe (35) auf ≥0,85 (40); G2/G3/G4 unberührt |
| Movement | 100 | 100 | unberührt (stepFechten/zeichneFechten lesen nur `u.aktuell`/`runden[]`) |
| **Gesamt** | **91 %** | **99 %** | rechnerisch 98,75 |

### 5.5 Was danach mit demselben Werkzeug ansteht (nicht Teil dieser Runde)

- **Tennis** (0,825, Puffer 0,025, im Code dieselbe „fehlt das Werkzeug"-Klage) und
  **Wettessen** (0,845, knapp unter der 0,85-Kante): `kalibriere-buehne-rezept.mjs <d> --suche`
  mit einer eigenen `ERLAUBT`-Tabelle je Disziplin — derselbe Ablauf, derselbe Nachweis.
- **Kaderfamilie auf 8–10 Paarungen** erweitern (`messgrundlage-kaderfest.md` Abschnitt 4,
  `scripts/ziehe-kader-familie.ts`), damit der offizielle Median weniger an der mittleren
  Variante hängt. Bis dahin ersetzt das Werkzeug das durch die acht Mischkader — aber die sind
  aus denselben 110 Spielern gezogen, keine neuen Teams.
- **Abnahmezahl je Kader statt Median** in `pruefe-rangtreue-schranke.mjs` erwägen: Abschnitt 1
  zeigt, dass ein Median von 0,826 zwei Kader unter 0,80 verdecken kann. Eine Schranke „kein
  Kader unter 0,80" wäre die Zahl, die CLAUDE.md eigentlich meint („in EINEM Spiel").

---

## 6) Was in dieser Runde NICHT gemacht wurde

- Kein Eingriff in `battle-mode.engine.js`, keine Basislinie, keine PPS-Referenz, kein Commit —
  Recherche und Plan. Einzige neue Datei im Repo: `scripts/kalibriere-buehne-rezept.mjs` (und
  dieses Dokument).
- Die held-out-Zahlen, die Zerlegung, die n=200-Werte und die Einflusstabelle stammen aus der
  Nachbildung, nicht aus dem Motor — gekennzeichnet, und die Nachbildung ist an 1440 Teilnehmern
  bit-genau gegen den Motor geprüft. Die Abnahmezahlen der Kandidaten (Spalte „offiziell" in
  4.2) sind alle im echten Motor gemessen.
- Die `ERLAUBT`-Semantik im Werkzeug ist eine Setzung (Abschnitt 3), kein Messergebnis. Ein Lauf
  mit `--frei` findet Rezepte derselben Güte (0,860 offiziell, 0,828 fremde Saaten, 0,904 fremde
  Kader bei rundenN 9), aber mit schwerer erzählbaren Rollen (TECHNIK aus determination 35, NERVEN
  aus speed 35). Wer die Semantik enger fassen will, ändert eine Tabelle, nicht das Verfahren.

## Verifikation

- `node --check scripts/kalibriere-buehne-rezept.mjs` — OK.
- `node scripts/kalibriere-buehne-rezept.mjs fechten --vergleich` — 1440 Teilnehmer, Abweichung
  0,000, bit-identisch; ebenso `speed-schach`, `eiskunstlauf`, `showcase`.
- `node scripts/miss-alle-disziplinen.mjs 24 fechten` — 0,826 / 0,203 / 0,888 / 0,161, unverändert
  (Arbeitsbaum außer dem neuen Skript und diesem Dokument unangetastet, `git status`).
- Alle Kandidaten-Zahlen in 4.2 („offiziell") per `--pruefe` im echten Motor gemessen; Nachbildung
  und Motor stimmen in jeder Zeile überein.
