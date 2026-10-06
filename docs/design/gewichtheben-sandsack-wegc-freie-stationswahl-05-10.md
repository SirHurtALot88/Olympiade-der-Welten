# Gewichtheben Sandsack Weg C — freie Stationswahl nach Auffassungsgabe (Flag 10, 05.10.)

**Status: reine Messvariante, kein Spielpfad, kein Bild. Erste Fassung, nicht endkalibriert.**
Hinter `BUEHNE_FLAGS.gewichthebenSandsack` 10, nur über die Messskripte erreichbar. Flag 0…9
sind bit-identisch (Abschnitt 8). Grundlage ist Flag 9 (`gewichtheben-sandsack-wegc-parallel-
entscheidungen-05-10.md`, Abschnitt 10): sechs je Team, drei Zweier-Ketten, alle sechs entscheiden
normal / durchpowern / direkt.

Chris, wörtlich:

> „JEDER SPIELER kann JEDE station betreten! das muss KI basiert sein und auf der auffassungsgabe
> vom spieler basieren"

---

## 0. Ergebnis vorab

Kader-Familie `kaderfamilie-live-save.json` (5 Paarungen), dieselben Spiele, Saaten, Formkarten
und Mutatoren wie Flag 6/8/9. n = 24 Spiele je Paarung, in Klammern n = 48.

| Größe | **Flag 9** (feste Stationen, alle sechs entscheiden) | **Flag 10** (freie Stationswahl, Stand) |
|---|---:|---:|
| rho je Spiel, Median | 0,869 (0,874) | **0,849 (0,842)** |
| rho, schwächste Paarung | 0,805 (0,802) | **0,825 (0,828)** |
| rho Mortal Sin – Natures Wrath | 0,823 (0,830) | **0,827 (0,833)** |
| rho Golden Gladiators – Silver Soldiers | 0,805 (0,802) | **0,849 (0,842)** |
| rho Pirate Crew – Raging Lunatics | 0,869 (0,874) | 0,825 (0,828) |
| rho Saison, Median | 0,965 (0,965) | 0,965 (0,979) |
| 90-%-Bootstrap des Medians | [0,806; 0,940] | [0,825; 0,932] |
| Pp Strom 1 / 2, n = 24 (≤ 25) | 10,8 / 12,0 | **11,3 / 10,0** ✓ (awareness 0 %) |
| Synthetische Kader-Familie, rho Median | 0,940 | 0,938 |
| Sendezeit je Spiel (Fenster 2:30–4:00) | 2:47 fest | **2:47 fest** |
| Spieler-Spiele ohne einen Sack | 0 % | 0 % |
| Mannschaftswertung | Silo-kg | **Arbeitswert** (Abschnitt 3) |
| Arbeitswert je Seite (gleiche Spiele) | 1041 | **1074 (+3,2 %)** |
| Silo-kg je Seite | 4679 | 4818 |
| Stationswechsel je Spieler und Schicht | 0 | **0,30** (je Team 1,8) |
| Spieler-Spiele mit mindestens einem Wechsel | 0 % | 27 % |
| Pausen / Rutscher je Schicht | 3,63 / 9,59 | 4,18 / 9,66 |
| Säcke je Schicht | 117,6 | 122,1 |
| erzwungenes „durch" (alle Ankünfte am Übergabepunkt) | 45,2 % | 45,5 % |
| … davon Station 3 (Rampenfuß) | 54 % | 49 % |
| Eignungsstärkeres Team gewinnt | 70,0 % (69,6 %) | 75,8 % (77,1 %) |
| Spiegeltest 1000 Läufe | 495 : 505 | 474 : 526 (z = 1,6) |
| Sackklasse an fremder Station | 0 von 1440 | **0 von 1440** (Abschnitt 8) |

**Kurz:**

* **Auffassungsgabe = `awareness`** (im Spiel „Gespür"). Begründung in Abschnitt 1. In der
  Gewichtheben-Matrix hat awareness das Gewicht **0**. Deshalb steuert sie die Entscheidungen und
  damit das Mannschaftsergebnis, nicht die eigene Note.
* **Beide Pflichtabnahmen halten**, die schwächste Paarung sogar besser als in Flag 9 (0,825 statt
  0,805). Der Median verliert 0,02 (0,869 → 0,849).
* **Ohne Gegengewicht kippt das Format.** Bei Silo-kg-Wertung läuft fast die ganze Mannschaft zu
  Station 3 (5,2 von 6, +30 % Silo-kg), denn 115 kg auf 8 m bringen je Sekunde mehr kg als 35 kg auf
  24 m, für jeden Spieler. Freie Wahl braucht eine Wertung, in der jede Station zählt. Gewählt ist
  der **Arbeitswert** (Abschnitt 3). Das ist eine Format-Entscheidung, die Chris bestätigen muss.
* **Kein Knopf ist immer besser** (Abschnitt 5): gegen feste Stationen gewinnt die KI +3,2 %
  Arbeitswert, mit awareness 0 / 50 / 100 für alle +2,2 / +3,1 / +3,8 %. Zufälliges Wechseln mit
  derselben Rate verliert −3,4 %, gleichverteilt −13 %. **Hohe Auffassungsgabe hilft messbar, aber
  der Spielraum ist klein**: Die Startaufstellung nach LAST ist schon fast optimal.
* **Das erzwungene „durch" wird nicht gelindert** (Abschnitt 7). Es verschiebt sich von Station 3
  (54 → 49 %) zu Station 2 (35 → 43 %). Eine zweite Entscheidung (Warten am Übergabepunkt) wählt die
  KI fast nie, weil Warten dem Team nichts bringt: Erzwungenes „durch" kostet kaum etwas.

---

## 1. Welches Attribut ist die Auffassungsgabe?

**`awareness`**, verifiziert im Code:

* Die Anzeige der Engine nennt es **„Gespür"** (`ATTRNAME` in `renderLevelUp()`; intelligence heißt
  dort „Verstand").
* Wo das Projekt „Situation lesen" beschreibt, steht awareness: Battlefield-Rolle **Spotter**
  („Liest Lücken und Ziele über Awareness"), Staffel-Rolle **Baton Tech** („Sichert Wechsel über
  Awareness und Dexterity" — ausgerechnet die Übergabe), Tennis **Return** („Liest Aufschläge über
  Intelligence und Awareness"), Klettern **Route Reader**. Das Staffel-Nachtkonzept vom 03.10.
  nennt TECHNIK „Übersicht" mit awareness/dexterity/charisma.
* intelligence ist das Gegenstück für Planung und Muster (Schach, Tennis „Match IQ"), nicht für das
  schnelle Erfassen einer Lage.

**Der Haken:** Die gesperrte Gewichtheben-Matrix (`official-discipline-weights.ts`) gibt awareness
**0** (ebenso intelligence). Das Sub-Skill-Set des Gewichthebens (LAST, TECHNIK, NERVEN, ANSAGE,
ERHOLUNG) enthält awareness nirgends. Jeder Einfluss von awareness auf die **Spielernote** wäre
daher Pp-Abweichung gegen die Matrix. Die Konstruktion trennt deshalb (Abschnitt 6): awareness
entscheidet, **wohin** einer geht; die Note misst nur, **wie gut er dort trägt**. Die Auffassungsgabe
wirkt so auf das Mannschaftsergebnis, nicht auf die eigene Note. Gelesen wird `u.attr.awareness`,
also nach Messhebel, Mutator, Slot und Form (dieselbe Pipeline wie jedes Sub-Skill), damit die
Pp-Messung awareness tatsächlich anheben kann.

---

## 2. Annahmen dieser Runde

| # | Annahme | Begründung | gemessene Alternative |
|---|---|---|---|
| D1 | **Startaufstellung wie Flag 9** (nach LAST, 2/2/2, die Stärksten an Station 3). | Auftrag; sinnvolle Startaufstellung, keine Zwangsjacke. | — |
| D2 | **Entscheidungspunkt: leer zurück am Stapel nach einem Zyklus.** Beladen wechselt niemand. | Auftrag. Folge: Ein Sack verlässt seine Station nie (Abschnitt 8). | — |
| D3 | **Ein Wechsel kostet den Fußweg zwischen den Stapeln** (`\|d_s − d_s'\|`, 8 m je Stationsschritt) im Leertempo (`sandsackKetteVLeer`, mit Ermüdung). Unterwegs zählt er schon zur Zielstation. | „keine Teleportation". Die Stapel liegen auf derselben Bahn bei 0 / 8 / 16 m. | — |
| D4 | **Die KI rechnet den eigenen Grenzbeitrag vor** (Vorschau 45 s, ohne Würfel, ohne weitere Wechsel): Arbeit der Zielstation mit mir minus ohne mich, minus dasselbe an meiner Station. | Erfasst „wo bringe ich selbst am meisten" (Tempo bei dieser Last, eigene Ermüdung, Fußweg) **und** „wo werde ich gebraucht" (eine Kette ohne Abholer, eine Kette, die ich verlasse). | Vorschau 15 / 30 / 60 s (Abschnitt 9) |
| D5 | **Auffassungsgabe = Wahrnehmungsgenauigkeit und Beweglichkeit.** Wahrgenommener Vorteil = Vorteil + Rauschen 0,2·(1 − aw/100) − Schwelle (0,15 + 0,3·(1 − aw/100)), einheitenfrei als Anteil dessen, was ein 50er an der eigenen Station im Vorschaufenster schafft. Niedrige awareness verschätzt sich und bleibt eher stur. | Chris' „KI basiert … auf der Auffassungsgabe". Das Gewicht liegt bewusst mehr auf Sturheit als auf Rauschen (Abschnitt 6: falsche Wechsel kosten Rangtreue). | Rauschen 0,1–0,4, Sturheit 0,15–0,4 |
| D6 | **Mannschaftswertung Arbeitswert** (jeder Sack zählt die Sekunden, die ein Referenzträger der Stufe 50 an seiner Station je Sack braucht, `sandsackFreiSekJeKg`, dieselbe Größe wie `sekJeSack` in `baueSandsackParallel()`). Die KI optimiert dieselbe Größe. | Mit Silo-kg gibt es kein „wo werde ich gebraucht" (Abschnitt 3). Der Arbeitswert ist die Diagnose-Wertung aus dem Parallel-Dokument, Abschnitt 6. | Silo-kg (`freiWertung 0`) |
| D7 | **Formatregeln für Wechsel:** höchstens 3 an einer Station, der Letzte an einer Station geht nicht weg, niemand wechselt an einen Sack über dem 1,3-Fachen seiner Traglast K. | Stapel/Spur fasst zwei Stammträger und einen Aushelfer; jede Station bleibt besetzt (Chris: „die leichten Säcke **müssen** … getragen werden"); niemand meldet sich freiwillig für einen Sack, den er kaum heben kann. Die Startaufstellung ist von D7 nicht betroffen. | ohne Regeln (Abschnitt 3, 6) |
| D8 | **Spielerwert: Kontext-Inversion über die ganze Mannschaft, die Referenz folgt dem Stationsverlauf des Spielers**, Maß Arbeitswert je Bewegungssekunde. | Die Note misst das Tragen dort, wo er war; die Stationswahl (awareness, Matrixgewicht 0) wirkt nur aufs Team. | Referenz wählt selbst; Maß kg·m je Sekunde (Abschnitt 6) |
| D9 | **Kettenlogik wie Flag 9, verallgemeinert** auf beliebig viele an einer Station: „Partner" ist jeder andere dort; wer am Übergabepunkt wartet, merkt sich, auf wen. | Bei genau zwei je Station dieselbe Rechnung: **Flag 10 ohne Wechsel = Flag 9, Spieler für Spieler** (Abschnitt 8). | — |

---

## 3. Ohne Gegengewicht: der Ansturm auf Station 3

Die Tragephysik kennt keine harte Obergrenze. `SANDSACK_VLAST_MIN` 0,18 lässt auch r = 1,3 noch
langsam tragen. Ein Träger mit LAST 45 schafft an Station 3 rund 115 kg in 17 s (6,8 kg/s), an
Station 1 rund 35–70 kg in 16 s (2,2–4,5 kg/s). **Bei Silo-kg ist Station 3 für jeden die
ergiebigste Station.** Eine gute KI muss dann dorthin.

Gemessen mit Silo-kg-Wertung (erste Fassung der Entscheidung, n = 8, nur Orientierung):

| Silo-kg, Regeln | mittlere Besetzung St. 1 / 2 / 3 | Silo-kg je Seite | rho / schwächste |
|---|---|---:|---:|
| keine Regeln | 0,23 / 0,46 / **5,19** | **6100** (+30 %) | 0,893 / 0,824 |
| nur Mindestbesetzung 1 | 1,11 / 1,16 / 3,66 | 5429 | 0,869 / 0,735 |
| nur Platzgrenze 3 | 0,53 / 2,52 / 2,88 | 5273 | 0,880 / 0,805 |
| beide | 1,15 / 1,95 / 2,84 | 5171 | 0,871 / 0,743 |

Mit dem Stand der Entscheidung (Silo-kg, n = 24, gepaart gegen fest) holen **alle** KI-Varianten
+12,0 %, mit awareness 0 genauso viel wie mit 100: Die Wahl ist trivial (alle nach hinten), die
Auffassungsgabe spielt keine Rolle. 71 % des Silos kommen dann von Station 3, und wer allein an
Station 1 zurückbleibt, powert zu 86 % erzwungen durch.

**Folgerung:** Freie Stationswahl ist mit Silo-kg-Wertung nicht sinnvoll. Mit dem **Arbeitswert**
ist jede Station für einen 50er gleich viel wert, und die Wahl folgt Stärke (komparativer Vorteil:
Starke tragen relativ besser schwer) und Bedarf. Die Besetzung bleibt im Mittel 2,1 / 1,8 / 2,1.
Das ist **Chris' Entscheidung** (offene Frage 7.2 des Parallel-Dokuments). Der Hebel `freiWertung`
schaltet KI-Währung und Mannschaftswertung immer gemeinsam um.

---

## 4. Die Mechanik

Alles in `public/mockups/battle-mode.engine.js`, Block „WEG C FREI" nach
`baueSandsackParallelKette()`. Einstieg `baueSandsackParallelFrei()`, erste Zeile von
`baueSandsackParallel()` springt bei Flag 10 dorthin.

1. **Eine Ereignissimulation je Team** (`sandsackFreiLauf`) statt einer je Station. Jeder Träger
   trägt seine Station (`a.s`), jede Station ihre Ablage (`haufen[s]`). Die Schritte sind Zeichen für
   Zeichen die aus `sandsackKetteSchicht()`.
2. **Am Stapel nach einem Zyklus** (`a.bereit`): `sandsackFreiWahl()`.
   * Formatregeln (D7) bestimmen die offenen Ziele.
   * Für jedes Ziel x: `delta[x] = (A(x, mit mir) − A(x, ohne mich)) − (A(hier, mit mir) − A(hier, ohne mich))`,
     A = Arbeit in der Vorschau (`sandsackFreiVorschau`: Klon der Station, ohne Würfel, ohne Wechsel,
     Teilstrecken anteilig bis zum Horizont), geteilt durch die Arbeit eines 50ers an meiner Station.
   * KI: Ziel mit dem größten `delta + 0,2·(1 − aw)·z − (0,15 + 0,3·(1 − aw))`, wechseln, wenn > 0.
     `z` normalverteilt aus einem eigenen Entscheidungs-Strom je Seite und Platz
     (`sandsackFreiWuerfe`, Falle 17; die Rutscher-Ströme bleiben unberührt).
   * Wechsel: Fußweg (D3), dann Stapel der neuen Station. Wer auf ihn am Übergabepunkt wartete, geht
     zum Stapel.
3. **Warten am Übergabepunkt** (`freiWarten`, Stand **aus**): Wer leer vom Silo an den Übergabepunkt
   kommt und nichts vorfindet, wägt per Vorschau ab, ob er auf den nächsten Beladenen wartet.
   Abschnitt 7.
4. **Mannschaft:** mehr Arbeitswert gewinnt (dann Silo-kg, dann Los).
5. **Spielerwert:** Abschnitt 6.

Gemessene Dynamik (n = 24): 0,30 Wechsel je Spieler, 73 % der Spieler-Spiele ohne Wechsel. Am
häufigsten: Station 2 → 1 (1,17 je Schicht beider Seiten), dann Station 1 → 2 und Station 3 → 2
(je 0,63). Wer an Station 3 startet, bleibt 135 von 150 s dort. Wer an Station 2 startet, wechselt
am häufigsten (0,48).

---

## 5. Kein Knopf ist immer besser

`scripts/miss-sandsack-wegc-frei-knopf.mjs 24`: dieselben 120 Spiele × 2 Seiten, gleiche Würfe,
einmal je Modus, gepaart gegen „fest" (= Flag 9).

| Stationswahl | Arbeitswert je Seite | gegen fest (95 %) | Seiten besser als fest | Wechsel je Spieler | erzwungen „durch" |
|---|---:|---:|---:|---:|---:|
| **fest** (kein Wechsel, = Flag 9) | 1041 | — | — | 0 | 45,2 % |
| **KI, echte awareness (Stand)** | **1074** | **+3,18 % ± 0,45** | 76 % | 0,30 | 45,6 % |
| KI, alle awareness 100 (= Orakel) | 1080 | +3,77 % ± 0,48 | 82 % | 0,47 | 45,9 % |
| KI, alle awareness 50 | 1073 | +3,14 % ± 0,47 | 75 % | 0,30 | 45,6 % |
| KI, alle awareness 0 | 1064 | +2,23 % ± 0,41 | 62 % | 0,26 | 45,8 % |
| zufällig, **gleiche Wechselrate** wie die KI | 1006 | **−3,35 % ± 0,58** | 19 % | 0,40 | 46,4 % |
| zufällig gleichverteilt (schlechtester Fall) | 903 | −13,27 % ± 1,05 | 3 % | 3,85 | 48,1 % |

* **Nicht das Wechseln hilft, sondern das richtige Wechseln.** Bei gleicher Wechselzahl liegt die KI
  +3,2 % über fest, der Zufall −3,4 % darunter.
* **awareness wirkt monoton**: 0 → 50 → 100 bringt +2,2 → +3,1 → +3,8 %. Mit awareness 100 ist die
  KI genau das Orakel (Vorschau ohne Rauschen, nur Grundschwelle).
* **Je Entscheidung** (n = 48): Orakel-Treffer niedrige / mittlere / hohe awareness 93,9 / 94,0 /
  96,0 %, Bedauern 1,4 / 1,3 / 0,8 % einer 50er-Vorschau, rho(awareness, Bedauern) −0,14.
* **Der Spielraum ist klein.** Die Obergrenze (Orakel) liegt bei +3,8 %. Die Startaufstellung nach
  LAST ist schon fast optimal; freie Wahl verfeinert sie. Im direkten Duell dreht das kaum Spiele:
  KI gegen fest gewinnt die KI-Seite 124 von 240 (51,7 %), awareness 100 gegen 0 gewinnt 121 von 240
  (50,4 %), Zufall gegen fest 114 von 240 (47,5 %). Vier der fünf Paarungen sind zu einseitig, als
  dass 3 % sie drehen.

---

## 6. Der Spielerwert: warum die Referenz dem Spieler folgt

Kalibrierverlauf der Note (Arbeitswert-Wertung, n = 24, Median / schwächste Paarung):

| Schritt | rho | schwächste | Befund |
|---|---:|---:|---|
| Maß kg·m je Bewegungssekunde (wie Flag 9), Referenz wählt selbst | 0,839 | 0,793 | kg·m/s ist zwischen Stationen nicht vergleichbar |
| + Maß **Arbeitswert** je Bewegungssekunde | 0,874 | 0,760 | Median +0,035, aber Rauschen 0,4 kostet Mortal Sin |
| + Rauschen 0,2, Sturheit 0,3 | 0,863 | 0,808 | falsche Wechsel kosten Rangtreue, verpasste kaum |
| + Vorschau 45 s, Grundschwelle 0,15 | 0,860 (n = 48: 0,859) | 0,773 (0,782) | Grimflora-Lücke kehrt zurück (unten) |
| + **Referenz folgt dem Stationsverlauf** | 0,849 (0,842) | 0,794 (0,810) | Mortal Sin hält, Pirate Crew fällt |
| + **Wechselgrenze r ≤ 1,3 (Stand)** | **0,849 (0,842)** | **0,825 (0,828)** | alle fünf über 0,82 |
| Stand, aber Referenz wählt selbst | 0,860 | 0,791 | |
| fest (`freiModus 1`), zum Vergleich | 0,869 | 0,805 | = Flag 9 |

* **Grimflora** (LAST 79, Eignung 40,7) verbringt mit KI 40 s an Station 2, wo 80 kg für ihn leicht
  sind. Wählt die Referenz selbst, steigt seine Note von 42,0 auf 46,6. Das ist die LAST-Lücke aus
  dem Parallel-Dokument (offener Punkt 7), die Flag 9 nur über den Kontext neben Buttercup verdeckt
  hatte. Folgt die Referenz seinem Verlauf, misst die Note nur noch, wie er dort trägt.
* **Schwache Aushelfer an Station 3** (Pirate Crew: Wavepiercer LAST 39, 68 s an Station 3, Note
  37,4 → 42,3) tragen 115 kg bei r ≈ 1,4 am Tempo-Boden `SANDSACK_VLAST_MIN`. Dort trennt die
  Inversion schwache Stufen kaum. Die Wechselgrenze r ≤ 1,3 (D7) schließt das aus und ist ohnehin
  realistischer.
* **Mehr Sturheit statt Rauschen:** Ein falscher Wechsel verändert die Arbeitsbedingungen eines
  Spielers zufällig, ein verpasster lässt sie wie in Flag 9. Niedrige awareness äußert sich deshalb
  vor allem als Sturheit, aber auch als Fehlwahrnehmung (Chris: „zufällig/suboptimal oder stur").

---

## 7. Lindert freie Wahl das erzwungene „durch"?

**Nein.** Ankünfte am Übergabepunkt, Anteil erzwungenes „durch" (n = 24):

| | Flag 9 | Flag 10 (Stand) | Flag 10 + Warten am Übergabepunkt |
|---|---:|---:|---:|
| Station 1 | 42 % | 43 % | 43 % |
| Station 2 | 35 % | 43 % | 42 % |
| Station 3 (Rampenfuß) | 54 % | 49 % | 49 % |
| alle | 45,2 % | 45,5 % | 45,0 % |

* An Station 3 hilft ein gelegentlicher Dritter (−5 Punkte). Dafür fehlt er dann an Station 2.
* **Warten am Übergabepunkt** (`freiWarten 1`, dieselbe Vorschau, dieselbe awareness-Logik) wählt die
  KI nur 0,04-mal je Spieler und Schicht. Die Vorschau sieht keinen Vorteil. Gepaart gegen fest:
  +3,03 % statt +3,18 % (im Rauschen gleich), rho 0,853 / schwächste 0,800 (ohne Warten 0,849 /
  0,825). Deshalb bleibt es im Stand aus.
* **Erzwungenes „durch" ist kein teures Ereignis.** Der Träger trägt einfach weiter zum Silo. Eine
  Übergabe würde ihm eine Rast bringen, aber den Abholer vom Stapel fernhalten. Die KI mit voller
  Vorausschau wartet deshalb fast nie. Das Problem ist ein Etikett im Protokoll, kein Verlust auf
  der Mannschaftsebene. Wer es sichtbar seltener will, müsste die Rollen festschreiben (einer nur
  vorn, einer nur hinten) — das wäre eine eigene Messrunde.

---

## 8. Isolation

**Sackklassen** (`parFrei.klassen`: kg je Sack nach der Station, an der getragen wurde; dazu je
Teilstrecke die Prüfung „Sack gehört zu dieser Station und hat ihre Klasse" und je Lieferung
„Herkunftsstation = Lieferstation"), n = 24:

| | getragene Klassen | Spieler-Spiele mit fremder Klasse |
|---|---|---:|
| an Station 1 (Soll 35 kg) | {35} | 0 |
| an Station 2 (Soll 80 kg) | {80} | 0 |
| an Station 3 (Soll 115 kg) | {115} | 0 |

0 Teilstrecken mit einem Sack einer fremden Station, jede Lieferung an ihrer Herkunftsstation.
27 % der Spieler-Spiele haben mehr als eine Klasse getragen. Das ist gewollt: Wer wechselt, trägt die
Klasse der neuen Station. Strukturell garantiert, weil nur leer gewechselt wird.

**Flag 10 ohne Wechsel = Flag 9:** `freiModus 1` liefert in 30 Spielen (5 Paarungen × 6) für alle
390 verglichenen Zeilen (je Spieler Note, kg, Säcke, Rutscher, Pausen, Kettenwahlen; je Spiel
Silo-kg beider Seiten) dieselben Werte wie Flag 9, auch mit dem Arbeitswert-Maß der Note. Die
Verallgemeinerung der Kettenlogik ist exakt.

**Flag 0…9:** SHA-256 über `spieleBuehneHeben`, `spieleSandsackFinale` und `spieleSandsackWegC`,
5 Paarungen × 4 Saaten, je Flag 0–9, vor und nach allen Änderungen: identisch (Flag 9 `ef856f00e40b592d`, Flag 8 `03010d8dea7e7b41`, Flag 0 `aa8cd0769d8def14`). Alle neuen
Schlüssel in `SANDSACK_PAR_KONF` liest nur Flag 10; `parFrei` erscheint nur bei Flag 10 im Boxscore.

---

## 9. Pflichtabnahmen im Einzelnen

**rho** (`miss-alle-disziplinen.mjs 24 gewichtheben --flags=gewichthebenSandsack:10
--bootstrap-unsicherheit`): Median 0,849, Spannweite 0,106, Saison 0,965, 90-%-Bootstrap
[0,825; 0,932], bestanden. Synthetische Kader-Familie 0,938 (Flag 9 auf derselben Familie 0,940).

**Pp** (`messe-arena-einfluss.mjs gewichtheben 24`, zwei Saatströme, Schranke ≤ 25):

| Attribut | Strom 1 | Strom 2 | Matrix |
|---|---:|---:|---:|
| power | 30,6 % | 30,6 % | 28 |
| charisma | 25,3 % | 23,4 % | 23 |
| health | 16,7 % | 16,8 % | 16 |
| determination | 8,5 % | 8,7 % | 12 |
| will | 6,7 % | 7,5 % | 7 |
| speed | 5,4 % | 6,7 % | 6 |
| dexterity | 5,4 % | 5,7 % | 6 |
| stamina | 1,3 % | 0,6 % | 2 |
| **awareness** | **0 %** | **0 %** | **0** |
| **Abweichung** | **11,3 Pp** | **10,0 Pp** | |

awareness erreicht die Note nicht (gemessener Gewinn ≤ 0). Das bestätigt die Trennung aus
Abschnitt 6: Die Auffassungsgabe wirkt aufs Team, nicht auf die eigene Note. Das Profil sonst wie
Flag 6/9 (power leicht über, determination unter der Matrix, weil LAST power/health/determination
60/25/15 liest).

**Sendezeit:** 150 s Schicht + 8,7 s Überleitung + 8 s Rahmen = 2:47, jedes Spiel im Fenster. Ein
Wechsel fällt in die Schicht (0,8 s Fußweg je Spieler und Schicht im Mittel).

**Spiegeltest** (`miss-arena-buehne-spiegel.mjs 1000`): 474 : 526, z = 1,6 (p ≈ 0,10). Größer als bei
Flag 9 (495 : 505), aber im Rauschen. An der Seite hängen nur die Saat-Konstanten der Rutscher- und
Entscheidungsströme, wie in Flag 6–9.

---

## 10. Offen und unsicher

1. **Die Mannschaftswertung ändert sich** (Silo-kg → Arbeitswert). Ohne diesen Wechsel ist freie
   Wahl ein Ansturm auf Station 3 (Abschnitt 3). Das muss Chris entscheiden. Die Spielerwerte hängen
   nicht an der Wertung (gleiche Note bei `freiModus 1`), wohl aber, wohin die KI geht.
2. **Drei Formatregeln sind Annahmen** (D7: Platzgrenze 3, Mindestbesetzung 1, Wechselgrenze
   r ≤ 1,3). Die Wechselgrenze trägt die schwächste Paarung (0,794 → 0,825 bei n = 24).
3. **Der Spielraum der Auffassungsgabe ist klein** (+2,2 % bei awareness 0 bis +3,8 % bei 100 gegen
   fest). Mehr Wirkung hieße mehr Rauschen für niedrige awareness, und das kostet Rangtreue (0,760
   bei Rauschen 0,4). Je stärker die Auffassungsgabe das Team prägt, desto mehr hängt der Einzelrang
   an einem Attribut, das die Matrix nicht bepreist. Das ist ein echter Zielkonflikt.
4. **Der Median verliert 0,02** gegenüber Flag 9 (0,869 → 0,849; n = 48 0,874 → 0,842), die
   schwächste Paarung gewinnt 0,02. Das Rauschen benachbarter Rasterpunkte liegt bei ±0,02.
5. **Die Vorschau ist eine Modellrechnung** (45 s, ohne Würfel, alle anderen ohne Wechsel). Mit 15 s
   ist sogar das Orakel schlechter als niedrige awareness (+1,4 % gegen +1,7 %): Kurzsichtige
   Vorschau überwechselt, die Grundschwelle 0,15 ist die gemessene Gegenwehr.
6. **Das erzwungene „durch" bleibt bei 45 %** (Abschnitt 7). Es kostet aber kaum etwas.
7. **Kein Bild.** Wechsel, Pfade und Zeiten je Station stehen im Boxscore (`parFrei`). Für Stufe 3
   wäre der Gang zwischen den Stapeln eine eigene kleine Szene („Abyssalfin geht nach vorn").
   **Nachtrag 06.10.:** gebaut, siehe
   `gewichtheben-sandsack-wegc-parallel-stufe3-sichtbarkeit-06-10.md` (Bühnenbild, HUD, Boxscore,
   Ticker der Flag-10-Schicht im echten Spiel; Mechanik unverändert, Flag 0…10 bit-identisch).
8. Die Knopf-Diagnose aus Flag 8/9 (`parOptionKg`, eine feste Kettenwahl je Träger) misst bei Flag 10
   die Mannschaft statt der Station und vermischt sich mit den Wechseln. Sie ist dort nur grob
   lesbar (KI mindestens so gut wie die beste feste Wahl in 48 % statt 76 %).
9. `rho(awareness, Note − Eignung)` liegt bei +0,12, Pp misst für awareness aber 0 %: Die Korrelation
   kommt aus dem Kader (awareness hängt mit anderen Attributen zusammen), nicht aus der Mechanik.
10. **Spiegeltest 474 : 526** (z = 1,6). Noch Rauschen, aber die größte Seitenabweichung der Reihe
    (Flag 8 521 : 479, Flag 9 495 : 505). Bei 2000 Läufen nachmessen.

---

## 11. Befehle, Hebel, Dateien

**Befehle:**

```
node scripts/miss-sandsack-wegc-parallel.mjs 24 --varianten=9,10
node scripts/miss-sandsack-wegc-parallel.mjs 48 --varianten=10 --kurz
node scripts/miss-sandsack-wegc-parallel.mjs 24 --varianten=10 --kalib=freiWertung:0
node scripts/miss-sandsack-wegc-frei-knopf.mjs 24 [--basis=freiWarten:1]
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --flags=gewichthebenSandsack:10 --bootstrap-unsicherheit
node scripts/messe-arena-einfluss.mjs gewichtheben 24 --flags=gewichthebenSandsack:10 [--saat-versatz=10000000]
OLY_KADER_FAMILIE=/nicht-vorhanden node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --flags=gewichthebenSandsack:10
node scripts/miss-arena-buehne-spiegel.mjs 1000 gewichtheben --flags=gewichthebenSandsack:10
```

**Hebel** (`SANDSACK_PAR_KONF`, nur Flag 10; Stand in Klammern): `freiModus` (0 KI; 1 fest = Flag 9;
2 zufällig gleichverteilt; 3 zufällig mit `freiZufallRate` 0,05; 4 Orakel), `freiHorizont` (45 s),
`freiRauschen` (0,2), `freiSchwelle` (0,15), `freiStur` (0,3), `freiMinBesetzung` (1),
`freiPlaetze` (3), `freiRMax` (1,3), `freiWertung` (1 Arbeitswert; 0 Silo-kg), `freiWarten` (0),
`freiNoteAw` (0 Referenz mit der awareness des Spielers; 1 mit 50), `freiNoteMass` (1 Arbeitswert;
0 kg·m), `freiNoteRef` (1 Referenz folgt; 0 wählt selbst), `freiNoteSchritt` (4); nur Messung:
`freiAwFest`, `freiAwHeim`/`freiAwGast`, `freiModusHeim`/`freiModusGast`, `freiOhneNote`.

**Dateien:**

* `public/mockups/battle-mode.engine.js`: Block „WEG C FREI" (`sandsackFreiStationen`,
  `sandsackFreiSekJeKg`/`WertJeKg`, `sandsackFreiWeg`, `sandsackFreiWuerfe`, `sandsackFreiStart`,
  `sandsackFreiLauf`, `sandsackFreiSchicht`, `sandsackFreiVorschau`, `sandsackFreiWahl`,
  `sandsackFreiWarteWahl`, `sandsackFreiMass`, `sandsackFreiNoteKontext`, `sandsackFreiStationZeit`,
  `baueSandsackParallelFrei`); Sprung in `baueSandsackParallel()`; die neuen Schlüssel in
  `SANDSACK_PAR_KONF`; Boxscore-Feld `parFrei`; Flag-Liste bei `BUEHNE_FLAGS`.
* `scripts/miss-sandsack-wegc-parallel.mjs`: Variante 10 und Abschnitt 3d (Wechsel, Von-nach-Matrix,
  Zeit je Station, erzwungenes „durch" je Station, Entscheidungsgüte nach awareness,
  Sackklassen je Station).
* `scripts/miss-sandsack-wegc-frei-knopf.mjs` (neu): gepaarter Modusvergleich und Duelle.
* Dieses Dokument; Verweise im Entscheidungs-Dokument (Abschnitt 11) und im Parallel-Dokument
  (Abschnitt 9).
