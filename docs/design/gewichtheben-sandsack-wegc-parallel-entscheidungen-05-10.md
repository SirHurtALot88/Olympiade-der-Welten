# Gewichtheben Sandsack Weg C — parallel, mit Entscheidungen je Träger (05.10.)

**Status: reine Messvariante, kein Spielpfad, kein Bild.** Hinter
`BUEHNE_FLAGS.gewichthebenSandsack` 8, nur über die Messskripte erreichbar. Flag 0…7 sind
bit-identisch (Abschnitt 9). **Fortsetzung Flag 9** (Station 3 entscheidet mit, Übergabe am
Rampenfuß): Abschnitt 10. Flag 0…8 sind dabei bit-identisch geblieben. **Fortsetzung Flag 10**
(freie Stationswahl nach Auffassungsgabe): Abschnitt 11 und eigenes Dokument. Grundlage ist das parallele Stationsformat (Flag 6,
`gewichtheben-sandsack-wegc-parallel-stationen-05-10.md`): sechs je Team, je zwei an einer von
drei Stationen, 150 s Schicht, Silo-kg.

Chris' zwei Ergänzungen, wörtlich:

> „die Spieler können es an jeder Station am Start ablegen, oder komplett durchpowern wenn sie
> sich fit fühlen. man kann wenn ein verbündeter da ist auch direkt in die hand übergeben das ist
> schneller als wenn man es aufheben muss."

> „die Spieler sollen selber die entscheidung treffen, sie können auch ein paar schritte weiter
> gehen und ihrem ally das überreichen. dann können die aber nicht kurz durchatmen und bisschen
> ausdauer regenerieren, sonst müssen sie pause machen oder es rutscht ihnen aus der hand."

---

## 0. Ergebnis vorab

Kader-Familie `kaderfamilie-live-save.json` (5 Paarungen), dieselben Spiele, Saaten, Formkarten
und Mutatoren wie Flag 6. n = 24 Spiele je Paarung, in Klammern n = 48.

| Größe | **Flag 6** (parallel, ohne Rastpunkte) | **Flag 8** (parallel, mit Entscheidungen) |
|---|---:|---:|
| rho je Spiel, Median | 0,930 (0,922) | **0,883 (0,886)** |
| rho, schwächste Paarung | 0,810 (0,829) | **0,802 (0,813)** |
| rho Mortal Sin – Natures Wrath | 0,810 (0,829) | **0,802 (0,814)** |
| rho Golden Gladiators – Silver Soldiers | 0,835 (0,850) | 0,814 (0,813) |
| rho Saison, Median | 0,951 (0,944) | 0,944 (0,937) |
| 90-%-Bootstrap des Medians | [0,810; 0,952] | [0,802; 0,923] |
| Pp Strom 1 / 2, n = 24 (≤ 25) | 14,5 / 13,6 ✓ | **14,0 / 13,5** ✓ |
| Pp Strom 1 / 2, n = 48 | 14,4 / 14,2 ✓ | **9,8 / 13,3** ✓ |
| Synthetische Kader-Familie, rho Median | 0,950 | 0,941 |
| Sendezeit je Spiel (Fenster 2:30–4:00) | 2:47 fest | **2:47 fest** (unverändert, Schicht bleibt 150 s) |
| Spieler-Spiele ohne einen Sack | 0 % | 0 % |
| Pausen je Schicht (beide Seiten) | 4,83 | **4,55** |
| Rutscher je Schicht | 9,13 | **9,64** |
| Doppel-Gänge je Schicht | 3,55 | 5,07 |
| Säcke je Schicht | 120,8 | 118,9 |
| Silo-kg je Seite | 4814 | 4752 |
| Eignungsstärkeres Team gewinnt | 71,7 % (70,4 %) | 71,7 % (70,0 %) |
| Spiegeltest 1000 Läufe | 505 : 495 | 521 : 479 (z = 1,3, Rauschen) |

**KI-Vorgabe** (freie Wahlen, n = 24): **normal 39 %, durchpowern 41 %, direkt 20 %**.
Station 1 (35 kg, man ermüdet kaum): 31 / 51 / 19 %. Station 2 (80 kg): 48 / 31 / 21 %. Daneben
3,4 erzwungene „durch" je Träger und Schicht (kein Abholer hinter der Ablage oder die Ablage ist
belegt).

**Kurz:**

* **Beide Pflichtabnahmen halten.** Die schwächste Paarung bleibt auf Flag-6-Niveau (0,802 /
  n = 48 0,813). Pp bleibt bei 10–14. Der Median verliert 0,04 (0,930 → 0,883). Das kostet die
  Kopplung zweier Träger an Station 1 (rho innerhalb der Station 0,895 → 0,858).
* **Kein Knopf ist immer besser.** Mit festen Wahlen und denselben Würfen ist für 26 % der Träger
  „normal" die beste Wahl, für 49 % „durch" und für 26 % „direkt". Die KI-Vorgabe schlägt jede
  feste Wahl an beiden Stationen (Abschnitt 5).
* **Normal ist die sichere Option, durchpowern die schnelle.** „Alle durch" bringt dieselbe
  Silo-Menge wie die KI (4750 gegen 4752 kg), aber **doppelt so viele Zwangspausen** (9,9 gegen
  4,6). „Alle normal" hat die wenigsten Pausen (4,4) und 1,6 % weniger Silo.
* **Die Sendezeit bleibt fest bei 2:47.** Pausen und Rutscher fallen in die Schicht, nicht dahinter.
* **Drei Annahmen tragen das Ergebnis** und sind gemessen, nicht vorgegeben: (1) Die Ablage fasst
  einen Sack. (2) Die Rast atmet dreimal so schnell wie eine Zwangspause. (3) Der Spielerwert wird
  gegen einen Referenzträger **neben dem echten Partner** gerechnet (Abschnitte 3 und 4).

---

## 1. Was Chris' Satz offen lässt, und die Annahmen dieser Runde

Im Flag-6-Format hat jeder Spieler eine eigene Spur und einen eigenen Stapel. Niemand übergibt
etwas. Chris' Ergänzungen beschreiben eine **Staffel**: ablegen an einer Station, weitertragen
oder einem Verbündeten in die Hand geben. Wer wem übergibt und wo, sagt der Satz nicht. Alles
Folgende ist **Annahme dieser Runde**.

| # | Annahme | Begründung | Alternative, nicht gebaut |
|---|---|---|---|
| B1 | **Der Verbündete ist der Stationspartner** (gleicher Stapel, gleiche Sackklasse). Die beiden an Station 1 bzw. 2 bilden eine Zweier-Kette auf ihrer Strecke. | Eine Kette **über** die Stationen (Station 2 übernimmt den 35-kg-Sack von Station 1) widerspricht den Sackklassen und der kg-Wertung: Die Kraftpakete an Station 3 trügen dann leichte Säcke, und jedes Ablegen kostete die Mannschaft schwere kg. | Kette über alle drei Stationen |
| B2 | **Die Ablage (Zonengrenze) ist die nächste Station auf dem Weg zum Silo, 8 m nach dem Stapel.** Station 1 legt an Station 2 ab (danach 16 m bis zum Silo), Station 2 an Station 3 (danach 8 m). | Chris: „an jeder Station ablegen". Die nächste Station ist der natürliche Punkt. | Station 1 auch an Station 3 (zweite Ablage) |
| B3 | **Station 3 hat keine Entscheidung.** Zwischen Station 3 und dem Silo liegt keine Station. Station 3 trägt wie Flag 6 (eigene Spur, Erschöpfung 0,15). | Es gibt dort keinen Ort zum Ablegen. Eine erfundene Ablage auf 4 m wäre keine Station. | Ablage am Rampenfuß — **gebaut als Flag 9, Abschnitt 10** (die Mitte bei 4 m scheitert tatsächlich, 2 m vor dem Silo trägt es) |
| B4 | **Ablegen geht nur, wenn ein Abholer hinter der Ablage ist** (der Partner kommt vom Silo zurück, trägt gerade zum Silo oder wartet). | Sonst läge der Sack, bis keiner mehr vorbeikommt. Ohne Abholer bleibt nur „durch" (gezählt als „erzwungen"). | — |
| B5 | **Die Ablage fasst einen Sack.** Liegt dort schon einer, ist „normal" nicht möglich. | Man stapelt an einer Übergabe keine Säcke. Gemessen: Ohne diese Grenze lagen bei „alle normal" 9,7 Säcke je Seite an der Hupe nutzlos an der Ablage, die Rollen froren ein (einer nur vorn, einer nur hinten), rho fiel auf 0,774. | unbegrenzte Ablage |
| B6 | **Die Rast dauert 0,75 s** und senkt die Erschöpfung mit der **dreifachen Atem-Rate der Zwangspause** (`SANDSACK_PAUSE_RATE_*` × `rastRateFaktor` 3). | Chris: „kurz durchatmen". Erholung ist am Anfang am schnellsten. Eine freiwillige Rast **vor** der Erschöpfung bringt je Sekunde mehr als eine Zwangspause **an** der Schwelle. Gemessen: Mit Faktor 1 ist „nie rasten, bei Bedarf pausieren" immer billiger, und die KI verliert gegen „alle durch" (Abschnitt 4). | Faktor 1 oder 2, längere Rast |
| B7 | **Ablegen kostet 0,5 × Aufheben**, also 0,5 × (0,5 + 0,6 r) s. Der Partner hebt vom Boden auf wie am Stapel (0,5 + 0,6 r s). | Chris: „schneller als wenn man es aufheben muss". Das Aufheben ist der bestehende Summand aus `sandsackGang()`. | — |
| B8 | **Direktübergabe: Zeitfenster 1,5 s.** Möglich, wenn der Partner an der Ablage wartet oder spätestens 1,5 s nach dem Träger dort ankäme. Beide gehen aufeinander zu, der Träger „ein paar Schritte weiter" (bei 1,5 s höchstens ≈ 2,5 m). Hand zu Hand in `SANDSACK_WECHSEL_SEK` (0,3 s). Kein Ablegen, kein Aufheben, keine Rast. Ein Partner, der vom Silo zurückkommt und den Träger innerhalb von 1,5 s erwarten kann, wartet an der Ablage (Warten = Stehen = Ruhe mit Grundrate). | „ungefähr gleichzeitig" mit „ein paar Schritte": Bei Leertempo ≈ 3,7 m/s und Lasttempo ≈ 3 m/s schließen zwei sich nähernde Träger in 1,5 s etwa 5 m. Der Träger geht davon gut die Hälfte. Empfindlichkeit in Abschnitt 6. | 0,5 / 1,0 / 2,5 s (gemessen) |
| B9 | **Erschöpfung an Station 1/2: Faktor 0,2** statt 0,15. | Die 0,15 aus Flag 6 war die Dämpfung **ohne** Rastpunkte. Mit Rastpunkten darf Tragen wieder ermüden. Höhere Werte (0,3/0,4) kosten Rangtreue (Abschnitt 4). | 0,15 / 0,25 / 0,3 / 0,4 (gemessen) |
| B10 | **Rutscher je beladener Teilstrecke**, Wahrscheinlichkeit = Gang-Wahrscheinlichkeit aus `sandsackGang()` × Teilstrecke / Strecke. Die „paar Schritte" der Direktübergabe würfeln nicht. | So bleibt die Rutscherzahl je ganzem Weg vergleichbar mit Flag 6 (Falle 17: fester Wurfstrom je Spieler, ein Wurf je Teilstrecke). | — |
| B11 | **Spielerwert: Kontext-Inversion** (Abschnitt 3). | Ohne sie hängt die Note am Partner. | Arbeit bis zur Hupe, Arbeit je Sekunde |

**Der Lastenplan nach Persönlichkeit** (Paket 1) bleibt wie in Flag 6 entfallen. Die
Persönlichkeit wirkt hier stattdessen **in der Entscheidung je Träger** (Abschnitt 2.2).

---

## 2. Die Mechanik

Alles in `public/mockups/battle-mode.engine.js`, Block „WEG C KETTE" direkt nach
`baueSandsackParallel()`. Der Einstieg `baueSandsackParallelKette()` wird nur bei Flag 8
aufgerufen. Flag 6/7 laufen unverändert durch `baueSandsackParallel()`.

### 2.1 Ablauf je Stationsmannschaft

`sandsackKetteSchicht(crew, station, T)` ist eine kleine Ereignissimulation für zwei Träger auf
einer Strecke (Stapel bei 0 m, Ablage bei 8 m, Silo bei 24 bzw. 16 m). Jeder Träger durchläuft:

1. **Am Stapel:** Zwangspause, falls E ≥ Pausenschwelle (Paket-1b-Formel, unverändert), dann
   Doppeln (ANSAGE, unverändert), Aufheben, beladen bis zur Ablage.
2. **An der Ablage, beladen vom Stapel:** **Entscheidung** (2.2).
   * **normal:** ablegen, **Rast**, leer zurück zum Stapel. Der Partner hebt den Sack auf.
   * **durch:** Zwangspause, falls E an der Schwelle steht. Dann beladen bis zum Silo, wuchten, leer
     zurück. Keine Rast.
   * **direkt:** dem Partner entgegengehen, Hand zu Hand, leer zurück zum Stapel. Keine Rast. Der
     Partner trägt ab dem Treffpunkt zum Silo.
3. **Leer zurück vom Silo an der Ablage:** Liegt ein Sack dort, wird er aufgehoben und zum Silo
   getragen. Kommt der Partner innerhalb des Fensters beladen an, wird gewartet. Sonst geht es zum
   Stapel.

Die Rollen wechseln von selbst. Wer vorn ablegt, holt am Stapel. Wer vom Silo kommt, nimmt an der
Ablage. Wer durchpowert, ist danach selbst hinten.

**Wiederverwendet, unverändert:** Lasttempo, Leertempo und Biss aus `sandsackGang()` (in Teile
zerlegt), Erschöpfungsformel (r² · Strecke · ERHOLUNG), Zwangspause (Schwelle und Ziel nach
NERVEN, Rate nach ERHOLUNG), Rutscher (Wahrscheinlichkeit nach rf, E², TECHNIK; Zeitverlust und
E-Zuschlag), Doppeln, Wuchten am Silo, Wurfströme `sandsackParWuerfe()`.

**Die beiden Folgen des Verzichts** sind genau die bestehenden Mechaniken:

* **Zwangspause:** Wer nie rastet, erreicht die Pausenschwelle früher und muss stehen bleiben.
* **Rutscher:** Die Rutscher-Wahrscheinlichkeit wächst mit E² (`SANDSACK_RUTSCHER_E_K`).

Eine eigene Sturz-Animation gibt es in dieser Messvariante nicht (kein Bild). Jeder Rutscher steht
je Teilstrecke im Protokoll (`legs[].rutscher`) und kann in Stufe 3 die Stufe-1-Pantomime
auslösen.

### 2.2 Die KI-Vorgabe

Deterministisch und vorab festgelegt, kein Live-Eingriff. Dasselbe Muster wie die
Wettessen-Haltung: Die Messvorgabe (`entscheidModus`) schlägt die KI.
`sandsackKetteWahl()` liest zwei Größen:

* **Ausdauer-Reserve:** `reserve = (Pausenschwelle − E) / Pausenschwelle`, also „wie fit fühlt
  er sich". Dazu `reserveNach`, dieselbe Größe nach der zusätzlichen Strecke Ablage → Silo (E-Zuwachs
  exakt nach der Erschöpfungsformel). NERVEN (Schwelle) und ERHOLUNG (Erholung) stecken damit
  automatisch drin.
* **Persönlichkeit** aus denselben Kanälen wie `sandsackPersoenlichkeit()` (kein neues
  Trait-System):
  * **Wagemut** = 0,5 + 0,5 · (0,7 · Haltung-Ego + 0,3 · Zielneigung-Ego). Draufgänger 1,
    Duellant 0,58, Opportunist 0,5, Bollwerk 0,33, Schleicher 0,25, Beschützer 0.
  * **Teamsinn** = der Teamwert aus `sandsackPersoenlichkeit()` (Zusammenhalt, Bindung).

Regel, in dieser Reihenfolge:

1. Ist **weder Abholer noch Direktübergabe** möglich → **durch** (erzwungen).
2. **direkt**, wenn möglich und `reserve ≥ 0,35 − 0,3 · (Teamsinn − 0,5)`. Wer für die
   Mannschaft denkt, übergibt eher.
3. Ist kein Abholer da oder die Ablage belegt → **durch** (erzwungen).
4. **durch**, wenn `reserveNach ≥ 0,55 − 0,4 · (Wagemut − 0,5)`. Draufgänger powern früher durch,
   Beschützer erst mit viel Reserve.
5. Sonst **normal**.

Gemessen (n = 24, 960 Träger-Spiele an Station 1/2): Der Anteil „durch" je Träger korreliert mit
ERHOLUNG (rho 0,37) und Wagemut (0,25), kaum mit der Eignung (0,06). Der Anteil „direkt"
korreliert mit Teamsinn (0,18). Die KI folgt also zuerst der Fitness und dann der Persönlichkeit.
Golden Gladiators ist fast nur „Beschützer" und entscheidet entsprechend vorsichtig.

---

## 3. Der Spielerwert: warum eine neue Inversion nötig war

Flag 6 misst jeden Spieler mit der **Schicht-Inversion**: Bei welcher Stufe v hätte ein
Referenzträger an derselben Station seinen n-ten Sack im selben Moment im Silo? Das setzt voraus,
dass jeder Sack **einem** Spieler gehört. In der Kette gehört er zwei.

Gemessen wurde in dieser Reihenfolge (n = 24, Median / schwächste Paarung, sonst gleiche Werte):

| Spielerwert | rho | schwächste | rho innerhalb Station 1 |
|---|---:|---:|---:|
| W = kg × getragene Meter bis zur Hupe, gegen Referenzpaar (v, v) | 0,882 | 0,723 | 0,851 |
| W je aktiver Sekunde (ohne Rast und Warten) | 0,883 | 0,720 | 0,855 |
| W je **Bewegungs**sekunde (ohne Aufheben, Ablegen, Wuchten, Rast, Warten) | 0,884 | 0,740 | 0,865 |
| dasselbe Maß, **Kontext-Inversion** (Stand) | **0,895** | **0,799** | 0,843 |

(Werte bei Erschöpfung 0,2, Rast 1 s mit Pausenrate, vor der Endkalibrierung.)

* **W bis zur Hupe** belohnt Strecke statt Können. Wer durchpowert, sammelt 24 m je Sack. Wer
  ablegt, gibt die restlichen 16 m an den Partner ab.
* **Je Bewegungssekunde** nimmt den Handgriff-Aufwand heraus. Wer an der Ablage tauscht, zahlt
  Aufheben und Ablegen je 8 m. Wer durchpowert, zahlt das nur einmal je 24 m. Danach ordnet die
  Note innerhalb der Stationen richtig, über die Stationen hinweg aber noch nicht.
* **Der Rest hing am Partner.** Bei „alle normal" stiegen ausgerechnet die Schwächsten (Grizz
  +3,6, Crucible Warden +1,9). Welche Rolle einer bekommt (vorn mit Rast oder hinten mit der
  langen Strecke), entscheidet der Partner mit. Das Referenzpaar (v, v) teilt die Rollen
  symmetrisch.
* **Kontext-Inversion** (`sandsackKetteNoteKontext()`, `noteKetteModus 3`): Die Note ist die
  Stufe v, bei der ein Referenzträger **an dieser Stelle dieser Mannschaft** dieselbe Arbeitsrate
  hätte. Er steht also neben dem echten Partner, mit dessen Werten und Persönlichkeit, unter
  denselben Regeln, mit neutraler eigener Persönlichkeit und ohne Rutscher. Das ist der Gedanke
  der Schicht-Inversion („Referenz unter denselben Regeln"), erweitert um „im selben Team".
  Tabelle v = 0…100 in Viererschritten, monoton gemacht, linear interpoliert. Das sind 26 kleine
  Simulationen je Kettenträger und Spiel.

Station 3 behält die Schicht-Inversion aus Flag 6 unverändert.

**Nachweis, dass die Kette die Note nicht verbiegt:** Mit „alle durch" und Erschöpfung 0,15
verhält sich die Kette wie zwei getrennte Spuren. Flag 8 liefert dann:

* mit der Arbeits-Note W: rho 0,919, schwächste 0,806, 120,0 Säcke;
* mit der Kontext-Inversion (Stand): rho 0,911, schwächste 0,792, 120,2 Säcke.

Flag 6 liefert 0,930, 0,810 und 120,8.

---

## 4. Kalibrierverlauf

`miss-sandsack-wegc-parallel.mjs 24 --varianten=8 --kalib=…`, Median über die fünf Paarungen.

| Schritt | rho | schwächste | beste feste Wahl n / d / r | Auffälligkeit |
|---|---:|---:|---|---|
| Start: Erschöpfung 0,4, Rast 2 s mit Staffel-Ruherate, Ablage unbegrenzt, Note = W | 0,825 | 0,670 | 11 / 76 / 13 % | normal toter Knopf, 13,9 Pausen, 3,6 Säcke liegen |
| dasselbe, „alle normal" | 0,774 | 0,679 | — | 9,7 Säcke liegen, Rollen eingefroren |
| + Ablage 1 Platz, Rast mit Pausenrate | 0,876 | 0,686 | 25 / 49 / 26 % | kein toter Knopf mehr, KI schlechter als „alle durch" |
| Erschöpfung 0,15…0,3 (Rast 1 s) | 0,867…0,890 | 0,69…0,73 | 22–25 / 48–52 / 25–27 % | Erschöpfung ist nicht der Hebel |
| + Note je Bewegungssekunde | 0,884 | 0,740 | — | Station 1 innerhalb 0,865 |
| + Kontext-Inversion | 0,895 | 0,799 | 22 / 52 / 26 % | KI weiter unter „alle durch" |
| + Rast-Faktor 2…3, Rast 0,75…1,5 s (Raster, 12 Punkte) | 0,837…0,898 | 0,77…0,80 | 25–30 / 40–60 / 21–30 % | KI schlägt jede feste Wahl ab Faktor 3 |
| **Stand: Erschöpfung 0,2, Rast 0,75 s, Faktor 3** | **0,883** | **0,802** | **26 / 49 / 26 %** | n = 48: 0,886 / 0,813 |

Gewählt wurde nach drei Bedingungen gleichzeitig: schwächste Paarung ≥ 0,80, kein toter Knopf und
eine KI, die keine feste Wahl schlägt. Das rho-Rauschen zwischen benachbarten Rasterpunkten liegt
bei ±0,02 (n = 24, Median aus fünf Paarungen). Feinere Unterschiede sind nicht trennbar.

* **Rast-Faktor 1** (Stand sonst gleich): rho 0,889 / 0,800. Die KI verliert an Station 2 gegen
  „alle durch" (1196 gegen 1213 kg) und trifft nur in 68 % der Fälle die beste feste Wahl.
* **Erschöpfung 0,15** (Stand sonst gleich): rho 0,899 / 0,785, 3,2 Pausen. „durch" wird fast
  immer gewählt (51 %), und die Rast verliert ihren Sinn.

---

## 5. Die Entscheidungen: kein toter Knopf, normal ist sicher

### 5.1 Extremfälle gegen die KI (n = 24, Stand)

| Vorgabe für alle Kettenträger | Silo-kg je Seite | Pausen je Schicht | Rutscher je Schicht | rho | schwächste |
|---|---:|---:|---:|---:|---:|
| **KI-Vorgabe** | **4752** | **4,55** | 9,64 | 0,883 | 0,802 |
| alle **normal** | 4675 | 4,43 | 9,53 | 0,856 | 0,809 |
| alle **durch** | 4750 | **9,86** | 9,79 | 0,900 | 0,805 |
| **direkt** wo möglich, sonst normal | 4675 | 5,47 | 9,61 | 0,849 | 0,791 |
| zum Vergleich Flag 6 (keine Rastpunkte) | 4814 | 4,83 | 9,13 | 0,930 | 0,810 |

Silo-kg der Stationsmannschaft, wenn **ein** Träger fest wählt und der Partner KI bleibt
(gleiche Würfe, Mittel über alle Kettenträger):

| | normal | durch | direkt | KI |
|---|---:|---:|---:|---:|
| Station 1 | 662 | 668 | 661 | **672** |
| Station 2 | 1216 | 1250 | 1223 | **1254** |

* **Beste feste Wahl je Träger:** normal 25,5 %, durch 48,5 %, direkt 26,0 %. Jede Option ist
  für mindestens ein Viertel der Träger die beste.
* **Die KI trifft in 76 %** mindestens die beste feste Wahl. Der mittlere Abstand zur besten
  liegt bei 7 kg.
* **Durchpowern spart Zeit und kostet Pausen.** „Alle durch" holt dieselbe Silo-Menge wie die KI,
  aber mit doppelt so vielen Zwangspausen und den meisten Rutschern. „Alle normal" ist die
  ruhigste Fassung, 1,6 % weniger Silo.
* **Direktübergabe ist schneller als ablegen, nicht schneller als durchpowern.** Genau so hat
  Chris es gesagt („schneller als wenn man es aufheben muss"). Auf der Mannschaftsebene liegt
  „direkt wo möglich" gleichauf mit „alle normal": Es spart das Aufheben, aber nimmt die Rast.

### 5.2 Pausen und Rutscher je Station (n = 24, je Spieler und Spiel)

| | Pausen Flag 6 | Pausen Flag 8 | Rutscher Flag 6 | Rutscher Flag 8 |
|---|---:|---:|---:|---:|
| Station 1 | 0,06 | 0,04 | 0,23 | 0,28 |
| Station 2 | 0,56 | 0,51 | 0,60 | 0,68 |
| Station 3 (unverändert) | 0,58 | 0,58 | 1,45 | 1,45 |

Mit KI-Vorgabe bleiben Pausen und Rutscher auf Flag-6-Niveau, obwohl die Erschöpfung von 0,15
auf 0,2 steigt: Die Träger rasten, wenn sie müde werden. Erst wer **nie** rastet („alle durch"),
verdoppelt die Pausen.

---

## 6. Das Zeitfenster der Direktübergabe

| Fenster | Anteil direkt (KI) | rho | schwächste | Silo-kg je Seite |
|---:|---:|---:|---:|---:|
| 0,5 s | 6 % | 0,878 | 0,795 | 4758 |
| 1,0 s | 12 % | 0,885 | 0,791 | 4753 |
| **1,5 s (Stand)** | **20 %** | **0,883** | **0,802** | **4752** |
| 2,5 s | 30 % | 0,884 | 0,790 | 4745 |

Das Fenster steuert, **wie oft** die Direktübergabe vorkommt, nicht die Rangtreue. 1,5 s ist
gewählt, weil der Träger dabei höchstens ≈ 2,5 m „ein paar Schritte weiter" geht (Chris' Bild).
Bei 2,5 s wären es bis zu 4 m, und der Partner wartet länger.

---

## 7. Offen und unsicher

1. **Der Median verliert 0,04** (n = 48: 0,922 → 0,886), fast ganz an Station 1 (rho innerhalb
   0,889 → 0,847). Zwei Träger teilen sich jeden Sack. Das ist der Preis der Kopplung. Die
   schwächste Paarung und Pp halten.
2. **Drei Annahmen tragen das Ergebnis:** Ablage mit einem Platz (B5), Rast-Faktor 3 (B6) und die
   Kontext-Inversion (B11). Ohne B5 friert die Kette ein, ohne B6 ist „normal" ein toter Knopf,
   ohne B11 hängt die Note am Partner. Alle drei sind gemessen begründet, aber nicht von Chris
   vorgegeben.
3. **Auf der Mannschaftsebene ist „alle durch" so gut wie die KI** (4750 gegen 4752 kg). Der
   Unterschied zeigt sich in den Pausen (9,9 gegen 4,6), nicht im Silo. Soll „normal" im Silo
   sichtbar mehr wert sein, wäre der Hebel eine höhere Erschöpfung. Ab 0,25 sinkt aber die
   Rangtreue (Abschnitt 4).
4. **Station 3 entscheidet nicht** (B3). Damit entscheiden vier von sechs Spielern je Team.
   In Flag 9 gelöst (Abschnitt 10): Übergabe am Rampenfuß, alle sechs entscheiden.
5. **Die Kette über die Stationen** (Chris' Satz wörtlich genommen: „an jeder Station") ist nicht
   gebaut. Begründung in B1. Ebenso fehlt die zweite Ablage für Station 1 (an Station 3).
6. **Die Kontext-Inversion ist eine Modellrechnung:** „was hätte ein Referenzträger an deiner
   Stelle geschafft". Das ist dasselbe Prinzip wie die Schicht-Inversion, aber eine Stufe
   indirekter.
7. **Doppeln steigt** von 3,6 auf 5,1 je Schicht. Wer vorn ablegt, holt öfter am Stapel und
   doppelt dort. ANSAGE bekommt damit mehr Gelegenheit. Pp charisma bleibt bei −1 bis +1.
8. **Spiegeltest 521 : 479** (Flag 6: 505 : 495). Bei 1000 Läufen ist das z = 1,3 (p ≈ 0,18). Im
   Code hängt nichts an der Seite außer der Saat-Konstante der Würfe, wie in Flag 6.
9. **Kein Bild.** Die Entscheidungen, Rasten, Übergaben und Rutscher stehen je Träger im
   Protokoll (`protokoll`, `legs`, `entsch`) und im Boxscore (`parEntsch`, `parHaltung`,
   `parRolle`, `parOptionKg`). Die Szene ist Stufe 3.
10. Abschnitt 5 der Sonde („Woran misst jede Station?") zeigt auch bei Flag 8 die Spur-Noten aus
    Flag 6 (`parSoloNoten`). Die Kettennoten gehen dort nicht ein. Das ist reine Diagnose.

---

## 8. Vergleich mit Flag 6 in einem Satz

Flag 8 fügt die drei Entscheidungen ein, ohne die Pflichtabnahmen zu verlieren. Die schwächste
Paarung (0,80 / 0,81) und Pp (10–14) bleiben, die Sendezeit bleibt fest. Pausen und Rutscher
bleiben mit KI-Vorgabe auf altem Niveau. Bezahlt wird mit 0,04 im Median.

---

## 9. Isolation, Befehle, Dateien

**Isolation:** SHA-256 über `spieleBuehneHeben`, `spieleSandsackFinale` und `spieleSandsackWegC`,
5 Paarungen × 4 Saaten, je Flag 0–7, vor und nach allen Änderungen: identisch.
`SANDSACK_PAR_KONF` hat neue Schlüssel, die nur Flag 8 liest.

**Befehle:**

```
node scripts/miss-sandsack-wegc-parallel.mjs 24 --varianten=6,8 [--kalib=schluessel:wert,...]
node scripts/miss-sandsack-wegc-parallel.mjs 24 --varianten=8 --kalib=entscheidModus:2
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --flags=gewichthebenSandsack:8 --bootstrap-unsicherheit
node scripts/messe-arena-einfluss.mjs gewichtheben 24 --flags=gewichthebenSandsack:8 [--saat-versatz=10000000]
OLY_KADER_FAMILIE=/nicht-vorhanden node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --flags=gewichthebenSandsack:8
node scripts/miss-arena-buehne-spiegel.mjs 1000 gewichtheben --flags=gewichthebenSandsack:8
```

`entscheidModus`: 0 KI, 1 alle normal, 2 alle durch, 3 direkt wo möglich, sonst normal.

**Hebel** (`SANDSACK_PAR_KONF`, nur Flag 8): `ketteMarke` 8 (Ablage, m nach dem Stapel),
`ketteFenster` 1,5 (s), `rastSek` 0,75, `rastRateModus` 1 (Pausenrate; 0 Staffel-Ruherate),
`rastRateFaktor` 3, `ablegenK` 0,5, `ablagePlaetze` 1 (0 unbegrenzt), `ermuedungFaktorKette`
0,2, `noteKetteModus` 3 (0 W, 1 W/aktiv, 2 W/bewegt gegen Paar, 3 Kontext), `kiDirektReserve`
0,35, `kiDirektTeamK` 0,3, `kiDurchReserve` 0,55, `kiDurchMutK` 0,4.

**Dateien:**

* `public/mockups/battle-mode.engine.js`:
  * Block „WEG C KETTE" nach `baueSandsackParallel()`: `sandsackKetteKap/VLeer/VLast/DE/…`,
    `sandsackKetteHaltung`, `sandsackKetteWahl`, `sandsackKetteSchicht`, `sandsackKetteW`,
    `sandsackKetteMass`, `sandsackKetteRefTabelle`, `sandsackKetteNote`,
    `sandsackKetteNoteKontext`, `baueSandsackParallelKette`;
  * eine Zeile am Anfang von `baueSandsackParallel()` (Sprung bei Flag 8);
  * die neuen Schlüssel in `SANDSACK_PAR_KONF`;
  * die Boxscore-Felder `parRolle/parEntsch/parHaltung/parOptionKg` in `spieleSandsackWegC()`;
  * die Flag-Liste im Kommentar zu `BUEHNE_FLAGS`.
* `scripts/miss-sandsack-wegc-parallel.mjs`: Variante 8 und Abschnitt 3b (Verteilung der
  Entscheidungen, Zusammenhang mit Persönlichkeit, beste feste Wahl je Träger und Station, KI
  gegen feste Wahl, liegengebliebene Säcke).
* Dieses Dokument. Dazu ein Verweis im Dokument zum parallelen Format, Abschnitt 9.

---

## 10. Fortsetzung: Station 3 entscheidet mit (Flag 9, 05.10.)

Chris will alle sechs Spieler einbeziehen, Station 3 eingeschlossen. Der Grund für B3 bleibt
gültig: Eine Kette **über** die Stationen ließe Station 3 leichte Säcke tragen und verwässerte die
Sackklassen. Flag 9 gibt Station 3 deshalb eine **eigene** Zweier-Kette auf ihrem eigenen kurzen
Stück. Flag 8 bleibt unverändert erreichbar und bit-identisch.

### 10.1 Die Konstruktion: Übergabe am Rampenfuß

| # | Annahme | Begründung |
|---|---|---|
| C1 | **Die beiden an Station 3 bilden eine eigene Kette.** Sie tauschen nur ihre 115-kg-Säcke, mit eigenem Stapel, eigener Ablage und eigenem Simulationsaufruf. Station 1/2 laufen genau wie Flag 8. | Die Sackklassen bleiben strukturell getrennt. Eine Kette über die Stationen (B1) bleibt ungebaut. |
| C2 | **Der Übergabepunkt ist der Rampenfuß, 6 m nach dem Stapel, 2 m vor dem Silo** (`ketteMarke3` 6). Die ersten 6 m sind eben, die letzten 2 m sind die Rampe zur Silokante. | „Rampe & Silo“ ist schon der Fable-Name von Station 3. Der Rampenfuß ist damit ein sichtbarer Ort und keine erfundene Station. Die Lage ist gemessen (10.3), die Mitte (4 m) scheitert. |
| C3 | **Sonst gilt alles wie an Station 1/2:** dieselbe KI-Vorgabe (`sandsackKetteWahl`, Ausdauer-Reserve, Wagemut, Teamsinn), dieselbe Erschöpfung 0,2, dieselbe Rast, dasselbe Fenster, dieselbe Kontext-Inversion. | Kein Sonderhebel für Station 3 außer dem Ort der Übergabe. `ermuedungFaktorKette3` und `noteKetteMass3` stehen auf −1 (= wie Station 1/2). |
| C4 | **Kein Doppeln an Station 3**, wie bisher. | unverändert (A6) |

Dramaturgisch ergeben sich zwei Rollen, die von selbst wechseln. Der eine trägt die 6 m eben und
darf am Rampenfuß ablegen und durchatmen. Der andere nimmt den Sack die Rampe hoch und wuchtet ihn
über die Kante. Bei der Direktübergabe kommt der Rampenmann die zwei Schritte herunter und nimmt den
Sack aus der Hand.

### 10.2 Ergebnis: Vergleich Flag 6, 8 und 9

Dieselben Spiele, Saaten, Formkarten und Mutatoren. n = 24, in Klammern n = 48.

| Größe | Flag 6 (keine Entscheidung) | Flag 8 (Station 1/2) | **Flag 9 (alle drei Stationen)** |
|---|---:|---:|---:|
| rho je Spiel, Median | 0,930 (0,922) | 0,883 (0,886) | **0,869 (0,874)** |
| rho, schwächste Paarung | 0,810 (0,829) | 0,802 (0,813) | **0,805 (0,802)** |
| rho Mortal Sin – Natures Wrath | 0,810 (0,829) | 0,802 (0,814) | **0,823 (0,830)** |
| rho Golden Gladiators – Silver Soldiers | 0,835 (0,850) | 0,814 (0,813) | 0,805 (0,802) |
| rho Pirate Crew – Raging Lunatics | 0,931 (0,925) | 0,883 (0,886) | 0,869 (0,874) |
| rho Saison, Median | 0,951 (0,944) | 0,944 (0,937) | 0,965 (0,965) |
| 90-%-Bootstrap des Medians | [0,810; 0,952] | [0,802; 0,923] | [0,806; 0,940] |
| Pp Strom 1 / 2, n = 24 (≤ 25) | 14,5 / 13,6 | 14,0 / 13,5 | **10,8 / 12,0** ✓ |
| Pp Strom 1 / 2, n = 48 | 14,4 / 14,2 | 9,8 / 13,3 | **8,4 / 13,1** ✓ |
| Synthetische Kader-Familie, rho Median | 0,950 | 0,941 | 0,940 |
| Sendezeit je Spiel | 2:47 fest | 2:47 fest | **2:47 fest** |
| Spieler-Spiele ohne einen Sack | 0 % | 0 % | 0 % |
| Spieler, die entscheiden | 0 von 6 | 4 von 6 | **6 von 6** |
| Pausen je Schicht (beide Seiten) | 4,83 | 4,55 | **3,63** |
| Rutscher je Schicht | 9,13 | 9,64 | 9,59 |
| Pausen / Rutscher je Spieler an Station 3 | 0,58 / 1,45 | 0,58 / 1,45 | **0,35 / 1,44** |
| Säcke je Schicht | 120,8 | 118,9 | 117,6 |
| Silo-kg je Seite | 4814 | 4752 | 4679 |
| Anteil Station 3 am Silo | 58 % | 58 % | 58 % |
| Eignungsstärkeres Team gewinnt | 71,7 % (70,4 %) | 71,7 % (70,0 %) | 70,0 % (69,6 %) |
| Spiegeltest 1000 Läufe | 505 : 495 | 521 : 479 | 495 : 505 |
| rho innerhalb Station 3 | 0,945 | 0,945 | 0,946 |

* **Beide Pflichtabnahmen halten.** Die schwächste Paarung liegt bei 0,805 (n = 48: 0,802), auf
  Flag-8-Niveau. Pp liegt bei 8–13. Der Median verliert gegenüber Flag 8 noch einmal gut 0,01. Das liegt
  innerhalb des Rauschens benachbarter Rasterpunkte (±0,02).
* **Mortal Sin – Natures Wrath steigt** auf 0,823 (n = 48: 0,830). Das ist die Grimflora-Lücke aus
  dem Dokument zum parallelen Format (Abschnitt 5, offener Punkt 7). Grimflora (LAST 79, Eignung 40,7) bekam in Flag 8 die
  Note 49,5 und bekommt jetzt 42,0, also fast seine Eignung. Die Kontext-Inversion misst ihn neben
  Buttercup, statt allein gegen eine Referenzspur. Das ist ein Nebeneffekt und nicht gezielt
  kalibriert.
* **Golden Gladiators ist jetzt die schwächste Paarung** (0,805 / 0,802), knapp über der Schranke.

### 10.3 Warum der Rampenfuß 2 m vor dem Silo liegt und nicht in der Mitte

Station 3 ist kurz (8 m), und ihre Säcke sind schwer. Ablegen und wieder Aufheben eines 115-kg-Sacks
kostet etwa 1,5 s (Aufheben 0,5 + 0,6 r s bei r ≈ 0,85…1, Ablegen die Hälfte). Auf einem 4-m-Stück
ist das mehr, als die Rast einbringt. Gemessen, Median über fünf Paarungen, n = 48 (Zeilen mit * bei
n = 24):

| Rampenfuß | Mass / Erschöpfung | rho | schwächste | beste feste Wahl n / d / r | Silo Station 3: normal / durch / KI |
|---|---|---:|---:|---|---|
| 4 m (Mitte) | Bewegung / 0,15 | 0,814 | **0,687** | 10 / 75 / 16 % | 2556 / 2774 / 2781 |
| 4 m | Arbeit bis Hupe / 0,15 | 0,860 | 0,788 | 10 / 75 / 16 % | 2556 / 2774 / 2781 |
| 4 m | Bewegung / 0,2 | 0,801 | **0,697** | 11 / 72 / 18 % | 2532 / 2719 / 2726 |
| 5 m | Bewegung / 0,2 | 0,843 | 0,793 | 16 / 56 / 28 % | 2555 / 2727 / 2731 |
| **6 m (Stand)** | **Bewegung / 0,2** | **0,874** | **0,802** | **21 / 47 / 32 %** | **2691 / 2744 / 2747** |
| 6 m | Bewegung / 0,25 | 0,880 | 0,804 | 26 / 44 / 31 % | 2655 / 2688 / 2693 |
| 6 m | Arbeit bis Hupe / 0,15 | 0,873 | 0,806 | 18 / 52 / 30 % | 2729 / 2806 / 2802 |
| 7 m | Bewegung / 0,2 | 0,854 | 0,809 | 30 / 42 / 28 % | 2723 / 2741 / **2731** |
| Station 3 auf 12 m verlängert, Übergabe 4 m* | Arbeit bis Hupe / 0,15 | 0,856 | 0,791 | 21 / 59 / 20 % | 1936 / 1997 / 1996 |
| Station 3 auf 12 m verlängert, Übergabe 6 m* | Arbeit bis Hupe / 0,15 | 0,819 | 0,703 | 17 / 65 / 18 % | 1895 / 1985 / 1989 |

* **Die Mitte (4 m) scheitert ehrlich.** „Normal“ kostet die Station 8 % Silo. Es ist nur für 10 %
  der Träger die beste Wahl, also fast ein toter Knopf. Die KI wählt es trotzdem in 20–27 % der
  Fälle, vor allem bei vorsichtigen Persönlichkeiten. Weil das Ergebnis von der Persönlichkeit
  abhängt und nicht von der Eignung, verliert die schwächste Paarung bis zu 0,13 (n = 48: 0,687 gegen 0,813 in Flag 8).
* **Ab 6 m kostet „normal“ an Station 3 so viel wie an Station 2** (−2 %, Station 2: −3 %). Jede
  Option ist wieder für mindestens ein Fünftel der Träger die beste. Bei 7 m verliert die KI knapp
  gegen „alle durch“ (2731 gegen 2741 kg). 6 m ist der einzige Punkt, an dem alle drei Bedingungen
  aus Abschnitt 4 gleichzeitig halten.
* **Station 3 zu verlängern löst das Problem nicht.** Bei 12 m sinkt die Rangtreue (0,70–0,79).
  Außerdem verschiebt sich die ganze Kalibrierung: Station 3 liefert fast ein Drittel weniger (1996 statt 2747 kg), und die
  Sackklassen 35/80/115 bei 24/16/8 m sind auf die kurze Station abgestimmt (Dokument zum parallelen
  Format, Abschnitt 4). Chris' Bild „die schweren von Station 3 nur bis zur Endstation“ bleibt so
  wörtlich erhalten.
* Mit dem Mass der Station-1/2-Kette (Arbeit je Bewegungssekunde) und Erschöpfung 0,15 lag der
  Median nur bei 0,834. Mit „Arbeit bis zur Hupe“ waren es 0,873. Gewählt ist trotzdem die
  Station-1/2-Regel bei 0,2: Sie liefert dasselbe Ergebnis (0,874 / 0,802), braucht aber keinen
  Sonderhebel. Erschöpfung 0,25 hebt die Pausen wieder auf Flag-8-Niveau (4,47 je Schicht) bei
  gleicher Rangtreue (0,880 / 0,804). Das ist ein möglicher Regler, falls Station 3 sichtbar mehr
  pausieren soll.

### 10.4 Isolationsnachweis: die Sackklassen mischen sich nicht

Jeder Spieler bekommt in Flag 9 das Feld `parSackKlassen`: alle kg-je-Sack-Werte, die er in der
Schicht je in der Hand hatte, auch nach Ablage oder Übergabe (Sonde, Abschnitt 3c).

| | Spieler-Spiele n = 24 / n = 48 | getragene Klassen | mit fremder Klasse |
|---|---:|---|---:|
| Station 1 (Soll 35 kg) | 480 / 960 | {35} | 0 |
| Station 2 (Soll 80 kg) | 480 / 960 | {80} | 0 |
| Station 3 (Soll 115 kg) | 480 / 960 | {115} | 0 |

**0 von 2880 Spieler-Spielen** haben eine fremde Sackklasse getragen. Der Anteil von Station 3 am
Silo bleibt bei 58 %. Strukturell ist das ohnehin garantiert: Jede Station läuft in einem eigenen
Aufruf von `sandsackKetteSchicht()` mit eigener Ablage (`haufen`). Ein Sack kann die Station gar
nicht verlassen.

### 10.5 KI-Verteilung je Station (n = 24; n = 48 innerhalb ±1 Pp)

| | normal | durch | direkt | erzwungen „durch“ je Träger | freie Wahlen je Träger |
|---|---:|---:|---:|---:|---:|
| Station 1 (35 kg, 24 m, Ablage 8 m) | 31 % | 51 % | 19 % | 3,8 | 5,2 |
| Station 2 (80 kg, 16 m, Ablage 8 m) | 48 % | 31 % | 21 % | 2,9 | 5,4 |
| **Station 3** (115 kg, 8 m, Rampenfuß 6 m) | **30 %** | **26 %** | **45 %** | **6,7** | 5,6 |
| alle freien Wahlen | 36 % | 36 % | 28 % | | |

* An Station 3 wird am häufigsten **direkt** übergeben. Der Rampenmann hat nur 2 m Rückweg und
  steht deshalb fast immer im Fenster.
* **Schwachstelle:** An Station 3 sind 6,7 von 12,3 Ankünften am Rampenfuß erzwungenes „durch“,
  also mehr als die Hälfte. Der Grund: Findet der Rampenmann keinen Sack vor und kommt keiner in
  1,5 s, geht er die 6 m zum Stapel zurück. Dann stehen beide vorn, und der Nächste am Rampenfuß hat
  keinen Abholer. Zwei mögliche Hebel, beide nicht gebaut: Der Rampenmann wartet länger am
  Rampenfuß (eigenes Wartefenster). Oder die Rolle bleibt fest (einer nur eben, einer nur Rampe).
  Beides verändert die Rollenverteilung und müsste neu abgenommen werden.

### 10.6 Kein Knopf ist immer besser, auch an Station 3

Feste Wahl **nur an Station 3** (`entscheidModus3`), Station 1/2 bleiben KI. n = 24, Silo-kg der
beiden Station-3-Träger je Seite:

| Vorgabe an Station 3 | Silo Station 3 | Pausen je Spieler St. 3 | Rutscher je Spieler St. 3 | Pausen je Schicht | rho | schwächste |
|---|---:|---:|---:|---:|---:|---:|
| **KI-Vorgabe** | **2753** | **0,35** | 1,44 | 3,63 | 0,869 | 0,805 |
| alle **normal** | 2645 (−3,9 %) | 0,29 | 1,34 | 3,36 | 0,867 | 0,798 |
| alle **durch** | 2741 (−0,4 %) | **1,26** | 1,53 | 7,27 | 0,879 | 0,803 |
| **direkt** wo möglich, sonst normal | 2704 (−1,8 %) | 0,64 | 1,47 | 4,78 | 0,868 | 0,780 |

Und für **alle** Kettenträger (`entscheidModus`, Station 1, 2 und 3):

| Vorgabe | Silo-kg je Seite | Pausen je Schicht | Rutscher je Schicht | rho | schwächste |
|---|---:|---:|---:|---:|---:|
| **KI-Vorgabe** | **4679** | 3,63 | 9,59 | 0,869 | 0,805 |
| alle normal | 4494 | 3,24 | 9,07 | 0,874 | 0,795 |
| alle durch | 4666 | **12,57** | 10,10 | 0,892 | 0,799 |
| direkt wo möglich, sonst normal | 4553 | 5,70 | 9,67 | 0,858 | 0,766 |

* **Beste feste Wahl je Station-3-Träger** (gleiche Würfe, Partner KI): normal 21 %, durch 47 %,
  direkt 32 % (n = 48). Jede Option ist für mindestens ein Fünftel die beste.
* **Die KI schlägt an Station 3 jede feste Wahl** (2753 gegen 2741 / 2704 / 2645 kg). Sie trifft in
  76 % mindestens die beste feste Wahl. Der mittlere Abstand zur besten liegt bei 19 kg (0,7 %).
* **Dasselbe Muster wie an Station 1/2:** „Alle durch“ holt fast dieselbe Menge, aber mit 3,6-mal so
  vielen Zwangspausen. „Alle normal“ ist die ruhigste Fassung und kostet 4 %.

### 10.7 Offen und unsicher

1. **Die Lage des Rampenfußes (6 m) ist kalibriert, nicht vorgegeben.** Das Plateau ist schmal:
   5 m liegt mit 0,793 knapp unter der Schranke, 7 m lässt die KI gegen „alle durch“ verlieren.
   Chris müsste bestätigen, dass „die letzten zwei Meter sind die Rampe“ zu seinem Bild passt.
2. **Mehr als die Hälfte der Ankünfte an Station 3 ist erzwungen** (10.5). Die Entscheidung findet
   statt, aber seltener frei als an Station 1/2.
3. **Die Rampe hat keine eigene Physik.** `steig` ist 1 wie überall, der Rampenfuß ist nur ein
   benannter Ort. Bekommt die Rampe später eine Steigung, muss die Lage neu gemessen werden.
4. **Weniger Pausen** (3,63 statt 4,55 je Schicht), weil sich zwei die schwere Strecke teilen. Wer
   mehr sichtbare Erschöpfung an Station 3 will: `ermuedungFaktorKette3` 0,25 (10.3).
5. **Der Median sinkt um weitere gut 0,01** gegenüber Flag 8, insgesamt 0,06 gegenüber Flag 6. Die
   schwächste Paarung hält, Golden Gladiators liegt mit 0,80 aber knapp an der Schranke.
6. **Kein Bild**, wie Flag 8. Die Rollen „Ebene“ und „Rampe“ stehen nur im Protokoll.

### 10.8 Isolation, Befehle, Dateien

**Isolation:** SHA-256 über `spieleBuehneHeben`, `spieleSandsackFinale` und `spieleSandsackWegC`,
5 Paarungen × 4 Saaten, je Flag 0–8, vor und nach allen Änderungen: identisch. Alle neuen
Schlüssel liest nur Flag 9. `parSackKlassen` erscheint nur bei Flag 9 im Boxscore.

**Befehle:**

```
node scripts/miss-sandsack-wegc-parallel.mjs 24 --varianten=6,8,9
node scripts/miss-sandsack-wegc-parallel.mjs 24 --varianten=9 --kalib=entscheidModus3:2
node scripts/miss-sandsack-wegc-parallel.mjs 48 --varianten=9 --kalib=ketteMarke3:4
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --flags=gewichthebenSandsack:9 --bootstrap-unsicherheit
node scripts/messe-arena-einfluss.mjs gewichtheben 24 --flags=gewichthebenSandsack:9 [--saat-versatz=10000000]
OLY_KADER_FAMILIE=/nicht-vorhanden node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --flags=gewichthebenSandsack:9
node scripts/miss-arena-buehne-spiegel.mjs 1000 gewichtheben --flags=gewichthebenSandsack:9
```

**Hebel** (`SANDSACK_PAR_KONF`, nur Flag 9): `ketteMarke3` 6 (Rampenfuß, m nach dem
Station-3-Stapel; 0 = keine Kette), `ermuedungFaktorKette3` −1 (= `ermuedungFaktorKette`),
`noteKetteMass3` −1 (= `noteKetteModus`; 0 Arbeit bis Hupe, 1 je aktiver Sekunde),
`entscheidModus3` −1 (= `entscheidModus`; 0…3 feste Wahl nur an Station 3).

**Dateien:**

* `public/mockups/battle-mode.engine.js`:
  * `baueSandsackParallel()`: Sprung auch bei Flag 9;
  * `baueSandsackParallelKette()`: Station-3-Kopie mit `ketteMarke`/`ermFaktor`/`noteMass`, Kette
    an Station 3 nur bei Flag 9, `entscheidModus3`, Feld `parSackKlassen`;
  * `sandsackKetteSchicht()`, `sandsackKetteDE()`, `sandsackKetteMass()`: lesen die
    Station-3-Felder, wenn gesetzt (Flag 8 setzt sie nie);
  * `sandsackKetteNoteKontext()`: reicht eine feste Wahl an Partner und Referenz durch (Flag 8:
    keine);
  * die neuen Schlüssel in `SANDSACK_PAR_KONF`, Boxscore-Feld `parSackKlassen`, Flag-Liste bei
    `BUEHNE_FLAGS`.
* `scripts/miss-sandsack-wegc-parallel.mjs`: Variante 9, Abschnitt 3b über alle Kettenstationen
  (mit freien Wahlen und KI gegen feste Wahl je Station), neuer Abschnitt 3c (Isolationsnachweis
  der Sackklassen).

---

## 11. Fortsetzung: freie Stationswahl nach Auffassungsgabe (Flag 10, 05.10.)

Chris: „JEDER SPIELER kann JEDE station betreten! das muss KI basiert sein und auf der
auffassungsgabe vom spieler basieren". Gebaut und gemessen als Flag 10 in
`gewichtheben-sandsack-wegc-freie-stationswahl-05-10.md`. Kurz:

* Auffassungsgabe = **awareness** („Gespür"), Matrixgewicht im Gewichtheben 0. Sie steuert die
  Entscheidung (Vorschau des eigenen Grenzbeitrags, Rauschen und Sturheit nach awareness), nicht die
  eigene Note (die Referenz der Kontext-Inversion folgt dem Stationsverlauf des Spielers).
* Bei Silo-kg läuft fast die ganze Mannschaft zu Station 3 (+30 % Silo-kg). Flag 10 wertet deshalb
  nach **Arbeitswert** (Chris' Entscheidung offen).
* rho 0,849 (n = 48 0,842), schwächste Paarung 0,825 (0,828), Sendezeit 2:47 fest, Sackklassen
  getrennt, Flag 0…9 bit-identisch; ohne Wechsel ist Flag 10 Spieler für Spieler Flag 9.
* KI +3,2 % Arbeitswert gegen feste Stationen, awareness 0 / 100 für alle +2,2 / +3,8 %, Zufall bei
  gleicher Wechselrate −3,4 %.
* Das erzwungene „durch" (10.5) bleibt bei 45 %. Es kostet die Mannschaft kaum etwas, deshalb wählt
  auch eine KI mit Warte-Option fast nie das Warten.
