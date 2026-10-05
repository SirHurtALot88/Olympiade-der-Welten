# Gewichtheben Sandsack Weg C — Sechser-Bild (6 gegen 6) statt Paarstruktur: Vergleich (05.10.)

**Status: reine Messsonde, kein Spielpfad, kein Ersatz für Stufe 2.** Stufe 2
(`gewichtheben-sandsack-finale-wegc-format-05-10.md`, drei Läufe zwei gegen zwei) bleibt der
Stand, bis Chris anders entscheidet. Diese Runde beantwortet nur eine Frage: **Wie sähe Weg C aus,
wenn statt der Paare das Paket-1-Sechserbild läuft, also alle sechs eines Teams in einem Rennen
mit dem Lastenplan Staffel / Stationen / Anker aus der Persönlichkeit?** Und behebt das die
Schwachstelle von Stufe 2, die Paarung Mortal Sin – Natures Wrath bei rho 0,679?

---

## 0. Ergebnis vorab

Gleiche Kader-Familie (`kaderfamilie-live-save.json`, 5 Paarungen), gleiche Saaten, gleiche
Formkarten und Mutatoren je Spiel wie Stufe 2. n = 24 Spiele je Paarung, in Klammern n = 48.

| Größe | Heute (sechs Duelle) | **2v2** (Stufe 2) | **6v6 ×3** Lastenplan | 6v6 ×1 Lastenplan | 6v6 ×1, alle tragen¹ |
|---|---:|---:|---:|---:|---:|
| rho je Spiel, Median | 0,865 | **0,882** (0,864) | **0,596** (0,603) | 0,596 (0,603) | 0,860 (0,864) |
| rho, schwächste Paarung | 0,805 (Pirate Crew) | **0,679** (Mortal Sin) | **0,472** (Pirate Crew) | 0,472 | 0,776 (Cold Steel) |
| rho Mortal Sin – Natures Wrath | 0,813 | **0,679** | **0,544** (0,535) | 0,536 | 0,841 (0,851) |
| 90-%-Bootstrap des Medians | — | [0,679; 0,931] | [0,472; 0,876] | [0,472; 0,874] | [0,776; 0,937] |
| Pp-Abweichung Strom 1 / 2 (≤ 25) | 9,7 / 11,6 | **15,0 / 17,0** ✓ | **31,2 / 26,0** ✗ (29,7 / 24,6) | 31,2 / 25,9 ✗ | 28,2 / 26,6 ✗ (26,7 / 26,1) |
| Spiel: eignungsstärkeres Team gewinnt | 80,0 % | **75,8 %** | **60,0 %** (61,7 %) | 59,2 % (61,3 %) | 86,7 % (87,5 %) |
| Sendezeit je Spiel, Median (im Fenster 2:30–4:00) | 7:11 | **3:04** (96,7 %) | **8:22** (0 %) | 2:53 (100 %) | 2:52 (98,3 %) |
| Spieler-Spiele ohne einen Sack | — (jeder hebt) | **0 %** | **45,5 %** | 45,6 % | 0 % |

¹ Plan für jedes Team auf Staffel erzwungen, damit alle sechs tragen. Das ist eine Diagnose,
nicht Chris' Lastenplan (Abschnitt 3). Dieselbe Fassung mit drei Rennen: rho 0,864, schwächste
0,780, Mortal Sin 0,862, Pp 28,4 / 27,2, Team 86,7 %, Sendezeit 8:20.

**Ein Missverständnis zum Auftrag:** Die 45,6 % „ohne Sack“ gehören nicht zu Stufe 2. Dort trägt
jeder Spieler (0 %). Die 45,6 % hat der Stufe-2-Agent am **Paket-1-Sechserrennen** gemessen, also
genau an der Struktur, nach der hier gefragt ist (Stufe-2-Doku 2.2). Diese Messung bestätigt den
Wert: In der Gegenprobe ist Rennen 1 hier Zeichen für Zeichen das Paket-1-Finale (0 Abweichungen
in 1440 Spieler-Spielen).

**Kurz:**

* Das Sechser-Bild mit Chris' Lastenplan behebt die 0,679 **nicht**, sondern macht sie
  schlechter. Mortal Sin fällt auf 0,54, der Median auf 0,60. Die Pp-Abnahme fällt durch, und das
  eignungsstärkere Team gewinnt nur noch 60 %.
* Nur eine Sechser-Fassung, in der **alle** tragen, besteht rho (0,86) und hebt Mortal Sin auf
  0,84–0,86. Sie fällt aber ebenfalls bei Pp durch, gibt den Lastenplan auf, kennt keine Pausen
  mehr und holt ihre Rangtreue zum großen Teil aus einer Sortierung vor dem Rennen (Abschnitt 3).

---

## 1. Methode

**Gebaut** (alles hinter `BUEHNE_FLAGS.gewichthebenSandsack` ≥ 2, nur über die Messskripte
erreichbar, kein Bild):

| Flag | Variante |
|---:|---|
| 2 | drei volle 6-gegen-6-Rennen, Mannschaft = gewonnene Rennen (bestes aus drei) |
| 3 | ein 6-gegen-6-Rennen ersetzt die sechs Duelle (Rennen 1 = das Paket-1-Finale) |
| 4 | wie 2, Plan Staffel erzwungen (Diagnose) |
| 5 | wie 3, Plan Staffel erzwungen (Diagnose) |

**Wiederverwendet, unverändert:**

* `sandsackLastenplan()`: Plan aus der Persönlichkeit, Teammittel, Schwellen 0,60 / 0,40.
* `sandsackZuteilung()`: wer welche Station trägt.
* `sandsackWuerfe()`: Falle 17, feste Würfe je Sack-Index.
* `sandsackSeiteLauf()`: das Rennen selbst mit allen Paket-1b-Konstanten, volle Strecke,
  15 Säcke, Zeitlimit 190 s.
* `sandsackWegCMedley()`: Laufsieger.

Rennen 1 läuft mit der rohen Spielsaat, Rennen 2 und 3 mit eingemischter Rennnummer (wie in
Stufe 2). Die Erschöpfung beginnt in jedem Rennen bei 0.

**Neu ist nur der Spielerwert**, und er ist bewusst derselbe wie in Stufe 2: die Tragenote per
Inversion (Stufe-2-Doku 3.4), Wert = Note ×10. Gerechnet wird sie gegen die Paket-1-Stationen und
-Konstanten, über die eigenen Gänge aller Rennen. Wer keinen Sack trägt, bekommt 0, wie ein Heber
ohne gültigen Versuch. Dafür bekam das Protokoll von `sandsackSeiteLauf()` zusätzliche Felder:
Station, Säcke des Gangs, Gang- und Pausendauer, Start und Ende. Die Rechnung selbst ist dieselbe
geblieben.

**Gemessen** mit denselben Werkzeugen wie Stufe 2:

* `miss-alle-disziplinen.mjs 24|48 gewichtheben --flags=gewichthebenSandsack:N --bootstrap-unsicherheit`
  für rho und Bootstrap.
* `messe-arena-einfluss.mjs gewichtheben 24|48 --flags=… [--saat-versatz=10000000]` für Pp. Mit
  Flag 1 reproduziert das Werkzeug hier die Stufe-2-Werte 15 / 17.
* Die neue Sonde `scripts/miss-sandsack-wegc-6v6.mjs [24] [--varianten=2,3,4,5]` für rho je
  Paarung, Nullanteil, Sendezeit, Mannschaftsebene (dieselben Spiele zusätzlich als sechs
  Hantel-Duelle) und Stationsmix.

Die Sendezeit ist wie in Stufe 2 bei 1:1-Wiedergabe bis „Sieger im Ziel“ gerechnet, zuzüglich
8,7 s Überleitung je Rennen und 8 s je Spiel. Daneben stehen zwei weitere Lesarten:

* „beide im Ziel“, so zeigt es die Paket-2-Szene;
* mit dem Paket-2-Deckel von 150 s je Seite (`SANDSACK_VIZ_MAX_DAUER`).

---

## 2. Das Sechser-Bild mit Lastenplan (Flag 2 / 3)

| Paarung | Plan Heim / Gast | ohne Sack | rho Spiel | rho nur Träger | Heim gewinnt |
|---|---|---:|---:|---:|---:|
| vigilante – armageddon | Staffel / Stationen | 25 % | 0,872 | 0,847 | 24/24 |
| coldsteel – direlegion | Stationen / Stationen | 50 % | 0,596 | 0,400 | 12/24 |
| goldengladiators – silversoldiers | Staffel / Staffel | 0 % | 0,876 | 0,876 | 24/24 |
| **mortalsin – natureswrath** | Stationen / **Anker** | 69 % | **0,544** | 0,825 | 0/24 |
| piratecrew – raginglunatics | **Anker / Anker** | 83 % | **0,472** | — (2 Träger) | 0/24 |

(Flag 2, n = 24.) Vier Befunde:

1. **Die Nullen tragen das Ergebnis.** Beim Anker-Plan tragen fünf von sechs nichts, bei
   Stationen drei von sechs. rho vergleicht dann zur Hälfte Nullen mit Eignung. Bei Natures
   Wrath (Anker) haben Faith, Marin Solis, Grimflora, Frayja und Falcon Wert 0, und nur Buttercup
   trägt alle 45 Säcke der drei Rennen.
2. **Drei Rennen helfen nicht.** Plan und Zuteilung hängen nicht am Zufall, also tragen in
   Rennen 2 und 3 dieselben Leute wie in Rennen 1. rho mit drei Rennen ist 0,596, mit einem
   ebenfalls 0,596. Das Rennergebnis ist je Paarung fast fest. Endstände: 3:0 59-mal, 0:3 60-mal,
   2:1 einmal. In 119 von 120 Spielen steht es nach zwei Rennen 2:0, das dritte zeigt dasselbe
   noch einmal.
3. **Die Mannschaftsebene wird schlechter.** Das eignungsstärkere Team gewinnt in 60 % der
   Spiele (Hantel 80 %, 2v2 75,8 %). Mortal Sin verliert alle 24 Spiele gegen das schwächere
   Natures Wrath (Buttercup, LAST 99, trägt allein). Das ist dieselbe Umkehr wie in Paket 1/1b.
   Cold Steel ist mit Formkarten und Mutatoren ein Münzwurf.
4. **Pp fällt durch:** 31,2 / 26,0 (n = 48: 29,7 / 24,6). speed +7, dexterity +6, health −6,
   determination −4. Im Spielerwert kommen die Leertempo-Kanäle zurück, die Paket 1b auf
   Teamebene schon herauskalibriert hatte.

Dazu kommt die **Sendezeit**: Ein Paket-1-Rennen dauert bis zum Sieger im Median 156 s, bis
beide im Ziel sind 182 s. Drei davon ergeben 8:22 je Spiel, länger als die heutigen sechs Duelle
(7:11). Mit Abbruch bei 2:0 sind es 5:37, mit dem Paket-2-Deckel 8:04. **Keine Fassung mit drei
Rennen trifft das Fenster 2:30–4:00.** Nur ein einziges Rennen passt (2:53). Pausen kommen
reichlich vor (3,6 je Rennen), weil der Anker allein 15 Säcke trägt.

---

## 3. Die Frage nach der 0,679: Was hilft, und warum

| Mortal Sin – Natures Wrath | rho je Spiel |
|---|---:|
| heute (Hantel) | 0,813 |
| 2v2 (Stufe 2) | 0,679 |
| 6v6 ×3, Lastenplan | 0,544 |
| 6v6 ×1, alle tragen | 0,841 |
| 6v6 ×3, alle tragen | 0,862 |

Das Sechser-Bild **mit Lastenplan** macht die Paarung schlechter. Erst wenn alle tragen, steigt
sie über die Schranke. Der Grund steht in der Diagnose (Mittel über 24 Spiele):

| Spieler | Eig | LAST | Wert 2v2 | Wert 6v6 Lastenplan | Wert 6v6 alle tragen |
|---|---:|---:|---:|---:|---:|
| Buttercup | 59,7 | 99 | 695 | 556 | 756 |
| Faith | 51,5 | 39 | 511 | **0** | 541 |
| Marin Solis | 48,0 | 47 | 525 | **0** | 622 |
| Velza | 43,2 | 22 | **287** | 38 | 462 |
| Grimflora | 40,7 | 79 | 512 | **0** | 513 |
| Falcon | 26,1 | 20 | 217 | **0** | 264 |

In 2v2 trägt jeder an jeder Station, auch den 105er. Velza (LAST 22, Eignung 43) fällt dort ans
Ende, Grimflora (LAST 79, Eignung 41) steht über seiner Eignung. Das ist die
Validitätslücke aus Stufe 2, 7.2: Die schweren Säcke belohnen LAST stärker, als die Matrix power
gewichtet.

**Warum „alle tragen“ das scheinbar behebt.** Die Staffel-Zuteilung aus Paket 1
(`sandsackZuteilung`) vergibt die Stationen gierig nach geschätzter Solozeit. Das schnellste Paar
geht an den Hof, das nächste an die Rampe, der Rest an die Ladekante. Jeder trägt nur an
**einer** Station:

| Station (alle tragen, Flag 5) | Anteil | Eignung im Mittel | Wert im Mittel |
|---|---:|---:|---:|
| Hof | 33 % | 59,1 | 753 |
| Rampe | 33 % | 51,2 | 570 |
| Ladekante | 33 % | 38,3 | 452 |

Die Station ist damit selbst schon eine Rangfolge, und sie steht vor dem ersten Sack fest. Der
Hof hebt die Note zusätzlich, weil dort gedoppelt wird. Das ist dieselbe Stationsabhängigkeit, an
der Fassung D in Stufe 2 scheiterte (Stufe-2-Doku 2.2). Nachgemessen:

| rho je Spiel (Flag 5, Median) | alle Paarungen | Mortal Sin |
|---|---:|---:|
| Eignung gegen den **Stationsrang allein** (Hof 3, Rampe 2, Kante 1) | **0,718** | **0,766** |
| Eignung gegen den Spielerwert | 0,860 | 0,841 |

Rund 0,72 der 0,86 stehen also schon vor dem Rennen fest, das Rennen selbst legt etwa 0,14 dazu.
Bei Mortal Sin kommen 0,77 von 0,84 aus der Sortierung. Velza steigt, weil sie gar nicht mehr an
die schweren Säcke kommt. **Die Lücke wird umgangen, nicht behoben.** Die Mechanik misst LAST an
schweren Säcken genauso schief wie in 2v2, nur bekommt sie es bei den Schwachen nicht mehr zu
sehen. Diese Fassung hat außerdem keine Pausen mehr (0,00 je Rennen; jedes Paar trägt nur eine
Station, der Partner ruht). Pp fällt durch (26–28: speed/dexterity je +6, health −5, power −4).
Und sie gibt Chris' Lastenplan auf, also genau das, wofür man das Sechser-Bild wollen würde.

---

## 4. Einschätzung

**Die Paarstruktur von Stufe 2 bleibt die bessere Wahl.** Sie ist die einzige gemessene Fassung,
die beide Pflichtabnahmen besteht (rho 0,882 / 0,864, Pp 15–20) und im Zeitfenster liegt.
Außerdem behält sie den Lastenplan nach Persönlichkeit, nur im Maßstab zwei.

Das Sechser-Bild behebt die 0,679 nicht:

* **Mit Chris' Lastenplan** wird alles schlechter. Mortal Sin fällt auf 0,54, der Median auf 0,60,
  die schwächste Paarung auf 0,47. Pp fällt durch, die Team-Siegquote sinkt auf 60 %, und drei
  Rennen brauchen 8:22. Ein einziges Rennen passt zwar ins Fenster, ändert an rho aber nichts.
* **Mit Zwang, dass alle tragen,** steigt Mortal Sin auf 0,84–0,86. Der Gewinn kommt aber
  überwiegend aus einer Stationssortierung vor dem Rennen, Pp fällt durch, und der Lastenplan ist
  weg. Das wäre kein Sechser-Bild im Sinn von Paket 1, sondern eine dritte Mechanik mit eigener
  Kalibrierrunde.

Die 0,679 ist ein Validitätsproblem der Tragemechanik in einem engen Kader: LAST zählt an den
schweren Säcken mehr, als die Matrix power gewichtet. Die Struktur ist nicht die Ursache. Wer sie
schließen will, arbeitet an der Gewichtung der schweren Gänge in der Tragenote oder an der
LAST-Kurve. Wie sich das in 2v2 auswirkt, ist nicht gemessen, nur vermutet.

---

## 5. Isolation und Dateien

* Flag 0 (heute) und Flag 1 (Stufe 2) sind unverändert. Geprüft wurde ein SHA-256 über `spiele`,
  `spieleBuehneHeben` und `spieleSandsackFinale` (Gewichtheben, 7 Saaten 1337 … 104729, je Flag
  0 und 1), vor und nach allen Änderungen identisch. `miss-alle-disziplinen.mjs 24 gewichtheben`
  liefert unverändert 0,865 / 0,882, `messe-arena-einfluss.mjs` mit Flag 1 15 / 17.
* `public/mockups/battle-mode.engine.js`:
  * zusätzliche Protokollfelder in `sandsackSeiteLauf()`;
  * der Zweig für Flag ≥ 2 in `bauBuehne()`;
  * der Block `baueSandsack6v6()` / `sandsack6v6Note()` / `SANDSACK_6V6_VARIANTEN` nach
    `baueSandsackWegC()`;
  * `opt.flag` und `stationen6v6` in `__arena.spieleSandsackWegC()`.
* `scripts/miss-sandsack-wegc-6v6.mjs`: die Vergleichssonde.
* Dieses Dokument.
