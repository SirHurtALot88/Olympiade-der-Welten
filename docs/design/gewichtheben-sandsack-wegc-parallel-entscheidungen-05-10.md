# Gewichtheben Sandsack Weg C — parallel, mit Entscheidungen je Träger (05.10.)

**Status: reine Messvariante, kein Spielpfad, kein Bild.** Hinter
`BUEHNE_FLAGS.gewichthebenSandsack` 8, nur über die Messskripte erreichbar. Flag 0…7 sind
bit-identisch (Abschnitt 9). Grundlage ist das parallele Stationsformat (Flag 6,
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
| B3 | **Station 3 hat keine Entscheidung.** Zwischen Station 3 und dem Silo liegt keine Station. Station 3 trägt wie Flag 6 (eigene Spur, Erschöpfung 0,15). | Es gibt dort keinen Ort zum Ablegen. Eine erfundene Ablage auf 4 m wäre keine Station. | Ablage am Rampenfuß |
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
4. **Station 3 entscheidet nicht** (B3). Damit entscheiden vier von sechs Spielern je Team. Ob
   Chris dort eine Ablage am Rampenfuß will, ist offen.
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
