# Organisch statt Brücke: I-Spy, TDM, Battlefield (Tasks #197/#198, 27.10.)

**Auslöser.** Chris am 27.10.: „Eigentlich darf es am Ende keine Disziplinen geben, die nicht
korrekt simuliert werden — alle müssen organisch durchlaufen. Die Brücke ist eigentlich nur
Notfall-Backup." Die PPS-Duell-Brücke (`docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md`)
ist damit kein zulässiger Dauerweg mehr für irgendeine Disziplin. Dieses Papier prüft die drei
Disziplinen, deren nächster Schritt bisher an einer offenen Chris-Frage hing.

**Ergebnis vorweg:**

| Disziplin | Stand vor dieser Runde | Stand danach | Offen |
|---|---|---|---|
| **I-Spy** | Brücke; rho 0,750, nicht angeschlossen; offene Frage „G1*-Toleranz oder dritter Anlauf" | **organisch, gewertet**: rho 0,817/0,811 (n=48, zwei Saatströme), Pp 14,6/15,0, angeschlossen über das Auftritt-Chassis | nichts, nur Beobachtungsliste (Abstand 0,011 auf Strom 2) |
| **TDM** | Brücke; nicht angeschlossen; rho 0,324, Saison 0,308 | unverändert (frisch bestätigt) | keine Chris-Frage, aber eine Mechanikrunde (Abschnitt 3) |
| **Battlefield** | Brücke; nicht angeschlossen; rho 0,399, Saison 0,310 | unverändert (frisch bestätigt) | **eine echte Formatfrage für Chris** (Abschnitt 4) |

Die gesperrte Eignungsmatrix ist nicht angefasst, es gibt keinen neuen Override und keine neue
Ausnahme in `ARENA_ABNAHME_AUSNAHMEN`.

---

## 1. Was die offenen Fragen waren

**I-Spy (Task #197).** `i-spy-fable-empfehlung-02-10.md` stellte Chris vor die Wahl: (a) I-Spy unter
der G1*-Star-/Paartreue-Alternative trotz rho 0,750 abnehmen, oder (b) eine Mechanik bauen. (b) wurde
zweimal versucht und verworfen („Kennerblick" I-2k, Abschnitt 10; Raumwahl I-1,
`i-spy-raumwahl-i1-15-10.md`). Übrig blieb (a), und G1* war auf n=48 selbst knapp verfehlt
(Saison 0,839, Star Rang 1 47,1 %, Paartreue 94,5 %). Chris' Leitlinie beantwortet das indirekt: eine
Ausnahme wäre wieder eine Sonderregel. Gesucht war deshalb eine reguläre Kalibrierung.

**TDM/Battlefield (Task #198, Vorgeschichte Task #117).** Chris am 13.10. (Punkt 16 in
`chris-feedback-breite-runde-13-10.md`): „battlefield läuft noch zu sehr ab wie Team Deathmatch",
gewünscht ist Domination mit drei Orten, Punkten je Sekunde und kurzem Respawn. Die Konzeptrunde K6
(`battlefield-domination-konzept-14-10.md`) hat Geometrie, Respawn und Spielerwert festgelegt,
aber nichts gebaut und sechs Fragen an Chris offen gelassen (Abschnitt 11 dort). Frage 1
(TMP/AUS-Chassisreparatur vorziehen?) ist seit dem 15.10. erledigt: die Normierung bleibt draußen
(`battlefield-tmp-aus-zweistrom-messung-15-10.md`, Blowout-Risiko an zwei von fünf echten
Paarungen), Battlefields Pp liegt ohne sie bei 30,1/37,1. Die anderen fünf haben Empfehlungen im
Papier und blockieren nicht. TDMs Format ist seit dem 26.09. entschieden (Respawn, kein Kill-Limit,
6 gegen 6). Für TDM gibt es keine offene Formatfrage.

---

## 2. I-Spy: Kalibrierrunde 3

### 2.1 Zwei Befunde, die die alte Diagnose korrigieren

1. **Mehr Ticks helfen, wenn man sie richtig misst.** Die Zahl „8 → 16 Ticks: +0,011" (Abschnitt 7
   von `stand-aller-disziplinen.md`) stammt von einem älteren Motorstand. Frisch gemessen hebt 16
   Ticks allein rho je Spiel 0,750 → 0,802 (Standard-Saatstrom) und 0,710 → 0,773 (zweiter Strom),
   in fünf von fünf Paarungen auf beiden Strömen. **Messfalle:** `MOTOREN[bd].lauf()` bricht nach
   120 s Bühnenzeit ab, und `wert()` liest nur enthüllte Runden. Wer `rundenN` erhöht, ohne
   `rundenDauer` mitzuskalieren, misst bei mehr als 16 Ticks abgeschnittene Spiele. Genau das ließ
   20/24/32 Ticks in der ersten Messreihe dieser Runde flach aussehen.
2. **Die verdiente Punktmasse je Rätselart weicht von der Matrix ab.** Gezählt über alle Spiele der
   Kader-Familie: Logik 42,0 %, Verhör 38,6 %, Mechanik 19,4 %, Ziel laut `ISPY_ZIEL_ANTEIL`
   37,6/36,5/25,9. Nur Logik und Verhör haben Tresore, und die 60-Punkte-Tresore ziehen die Masse
   dorthin. Der Saison-Rangfehler je Spieler (Rang Wert minus Rang Eignung, 60 Spieler) korreliert
   partiell mit LOGIK +0,41, mit FINGERFERTIGKEIT −0,24 und mit MENSCHENKENNTNIS −0,17. Spieler mit
   Logik-Profil werden überbezahlt, das ist ein Validitätsfehler.

### 2.2 Der Eingriff

- `BUEHNE_ART["i-spy"].rundenN` 8 → **32**, `rundenDauer` mitskaliert (60-s-Konvention aller Bühnen).
- `ISPY_PUNKTWERT[3]` 60 → **45**. Die Anteile liegen danach bei 39,8/35,4/24,7 %.

Keine Rezeptzeile, keine Sub-Skill-Formel, kein neuer `rr()`-Wurf, keine andere Disziplin berührt.

### 2.3 Messung (kaderfest, Kader-Familie live-save, n=48 je Paarung)

| | vorher S0 | nachher S0 | vorher S1 | nachher S1 |
|---|---:|---:|---:|---:|
| rho je Spiel (Median) | 0,749 | **0,817** | 0,710 | **0,811** |
| rho Saison | 0,839 | 0,888 | 0,839 | 0,895 |
| Star Rang 1 / erste zwei | 47,1 / 77,1 % | 54,2 / 84,2 % | 47,1 / 70,4 % | 52,1 / 81,7 % |
| Star letzter | 0 % | 0 % | 0 % | 0 % |
| Paartreue (≥ 15) | 94,5 % | 96,8 % | 93,0 % | 96,6 % |

S0 = Standard-Saatstrom (`miss-star-paartreue.mjs 48 i-spy`), S1 = `saat0` 5 000 000. Kontrolle mit
dem Abnahmebefehl `miss-alle-disziplinen.mjs 24 i-spy`: **0,816** (Spannweite 0,150, Saison 0,895).
G1* ist auf beiden Strömen erfüllt.

- **Pp** (`messe-arena-einfluss.mjs i-spy 48`, Saatversatz 0 / 10 000 000): **14,6 / 15,0**
  (vorher 16,6 / 12,8). Größte Einzelabweichung intelligence +5,2/+5,0, kein Matrixattribut bei 0 %.
- **Kadergrößen** (je Seite, n=24, vorher → nachher): 2: 0,692 → 0,854 · 3: 0,671 → 0,842 ·
  4: 0,770 → 0,877 · 5: 0,725 → 0,859.
- **Tick-Reihe** (Tresor 45, n=48, S0/S1): 8: 0,784/0,779 · 24: 0,807/0,802 · 32: 0,817/0,811 ·
  40: 0,828/0,813 · 48: 0,830/0,802. Ab 32 Ticks flach, deshalb 32.
- **Spiegeltest** `miss-arena-buehne-spiegel.mjs 480 i-spy`: 247:231 (51,7 %), Punkte 0,1 %
  auseinander. Ein erster Lauf mit 120 Spielen las 72:48; das war Rauschen (480 Läufe bestätigen).
- **Ticker** `verify-i-spy-ticker-paket-07-10.mjs`: 29,1 Zeilen/min (Schranke 30), alle vier
  Prüfungen bestanden.

**Geprüft und verworfen** (gleiche Sonden, flach oder schlechter): steilere Knack- und Sichtkurve,
ein breites Matrix-Sichttor (bestätigt den Kennerblick-Befund, dass breiterer Zugang Validität
kostet), Teilpunkte 0,4/0,7, NERVEN-Anteil 0,1, Nachfüllfolgen mit Mechanik-Tresor (Validität bis
0,916, aber Verlässlichkeit fällt) und Art-Punktfaktoren.

### 2.4 Angeschlossen und gewertet

`"i-spy"` steht jetzt in `ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS` (Chassis `spieleBuehneAuftritt()`,
Seitenstand = Summe der eigenen Fundpunkte), in `ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS` und in
`ARENA_RESOLVED_DISCIPLINE_IDS`. Dazu gibt es eine eigene PPS-Referenz
(`data/generated/i-spy-pps-referenz.json`, gezogen gegen das live-save-Abbild vom 27.10.) und einen
Eintrag in `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`. Die Abnahmetabelle trägt die frischen Zahlen,
`rangtreue-basislinie.json` die neue CI-Basislinie. Gewertet sind damit **15 von 20** Disziplinen.

**Für Chris sichtbar:** die Enthüllung auf der Bühne läuft viermal so schnell wie vorher, weil das
Spiel weiter 60 s dauert, jetzt aber 32 statt 8 Suchrunden je Spieler enthält. Wenn das zu hektisch
wirkt, ist eine längere Show (z. B. 90 s) ein reiner Anzeigewert (`rundenDauer`). Er darf 120 s
nicht überschreiten (Messdeckel) und ändert keine Zahl.

---

## 3. TDM: keine Formatfrage, sondern eine Mechanikrunde

Frisch gemessen (`miss-alle-disziplinen.mjs 24 tdm battlefield`, 27.10.): **TDM rho je Spiel
0,324, Saison 0,308**. Beide Spalten sind niedrig, also belohnt die Mechanik laut CLAUDE.md das
Falsche, und es fehlen nicht nur Ereignisse. Eine Rezeptrunde ist nach vier gescheiterten
Rezeptumbauten und einer zurückgenommenen Chassis-Normierung erschöpft
(`tdm-pp-rezeptrunde-diagnose-02-10.md`).

Nächste Schritte, ohne Rückfrage machbar:

1. **Headless-Einstieg für das Arena-Chassis.** Es gibt heute keinen `window.__arena.spieleArena()`
   mit `{seiten, boxscore}`, nur die Diagnose-Sonde `spieleArenaDomination()` für Battlefield.
   Gebraucht werden ein Einstieg nach dem Muster von `spieleFeldspiel()` (Seitenstand TDM =
   KO-Summe bei Zeitablauf, Boxscore = `MOTOREN.tdm.wert()`), eine Menge
   `ARENA_KAMPF_DISCIPLINE_IDS` im Runner und eine PPS-Referenz. Feldgröße: TDM spielt 6 je Seite.
   Kleinere Aufstellungen (2..5) spielt `bauArena()` bereits mit der gesetzten Zahl, größere gibt es
   nicht. Hier entsteht also kein F1-Problem wie bei Battlefield.
2. **Zielwahl nach Bedrohung/Eignung statt Geometrie.** Das ist der dokumentierte Hebel
   (`arena-zielwahl-opus-empfehlung-02-10.md`). V9 „Zusammenhalt als Handwerk" ist gebaut und hob
   rho auf 0,416/0,432 (`ARENA_ART.tdm.persHandwerk`, aus). Er wartet nur auf die Pflicht-Pp-Messung
   (Kriterium F), die am 07.10. an der Maschinenlast scheiterte. Auf einer freien Maschine dauert
   sie etwa 2 × 10 h bei n=48 oder 2 × 80 min bei n=6.
3. Erst danach eine Rezeptrunde auf dem neuen Kampf, nach demselben Muster wie I-Spy oben:
   zweistromig, n=48, mit Spiegeltest.

TDM bleibt bis dahin auf der Brücke. Laut Chris' Leitlinie ist das ein Rückstand, kein Zustand.

---

## 4. Battlefield: die verbleibende Formatfrage für Chris

Frisch gemessen: **rho je Spiel 0,399, Saison 0,310**. Der Motor ist heute ein 4-gegen-4-Deathmatch
mit einem Kontrollpunkt, der 0 von 120 Spielen entscheidet. Eine Kalibrierung dieses Motors wäre
Arbeit an einer Mechanik, die Chris am 13.10. ausdrücklich ersetzen will. Der Umbau zur
Drei-Punkte-Domination (K6) ist der richtige nächste Schritt. Beim Prüfen der Anbindung ist aber
eine Lücke aufgefallen, die K6 nicht behandelt und die Chris' Leitlinie nicht beantwortet:

**Die Feldgröße passt nicht.** Die Saison würfelt für Battlefield 2 bis 6 Spieler je Seite
(`buildSeasonPlayerCountByDiscipline()`, Katalog-Standard `playerCount: 2`). Die Aufstellung kennt
sechs Rollen (`lib/lineups/matchday-slot-roles.ts`: Commander, Spotter, Siege Core, Morale Anchor,
**Field Control, Disruptor**). Der Motor kennt nur vier (`ARENA_ART.battlefield.jeSeite: 4`) und
spielt `min(Aufstellung, 4)`. Bei 5 oder 6 gesetzten Spielern fallen Field Control und Disruptor
lautlos weg, das ist dieselbe Fehlerklasse wie Spurts F1 (14.09.). K6 ist vollständig auf vier
Rollen und acht Körper gebaut („acht Spieler auf drei Punkte heißt zwangsläufig …").

**Die Frage an Chris, knapp:**

> Battlefield wird zur Drei-Punkte-Domination umgebaut (deine Vorgabe vom 13.10.). Die Saison
> schickt aber 2 bis 6 Spieler je Seite, und die Aufstellung hat sechs Rollen. Der Motor kennt nur
> vier. Soll Battlefield
> **(A)** immer drei Punkte haben, egal ob 2 oder 6 je Seite (bei 2 gegen 2 muss man dann
> entscheiden, welchen Punkt man liegen lässt), und Field Control/Disruptor bekommen eine eigene
> Aufgabe (Vorschlag: Field Control erobert schneller, Disruptor bremst das gegnerische Erobern),
> oder
> **(B)** die Zahl der Punkte an die Feldgröße koppeln (2–3 je Seite: ein Punkt, 4–6: drei Punkte)?
>
> Und die fünf Detailfragen aus K6 (kein Eliminationssieg mehr, kein Sudden Death, Punktverteilung
> erst KI-only, Frontlinie B-4 gestrichen, Spielzeit kalibriert die Baurunde): soll ich die dort
> empfohlenen Antworten einfach so übernehmen?

Meine Empfehlung ist **(A)** und **ja**. (A) hält Chris' Wortlaut „3 Orte" in jeder Feldgröße und
macht aus den zwei bisher toten Rollen einen zweiten Weg zum Erfolg (Leitlinie 21.09.). Was danach
ohne weitere Rückfrage folgt: `jeSeite` 4 → 6 mit zwei Motor-Slots, Respawn nach dem TDM-Vorbild,
drei Punkte nach K6 Abschnitt 4, der Headless-Einstieg aus Abschnitt 3.1 mit Seitenstand =
Domination-Punkte, PPS-Referenz, dann die Abnahme (rho > 0,80, Pp ≤ 25, zwei Ströme, n=48).

---

## 5. Reproduktion

```sh
node scripts/miss-alle-disziplinen.mjs 24 i-spy
node scripts/miss-star-paartreue.mjs 48 i-spy
node scripts/messe-arena-einfluss.mjs i-spy 48
node scripts/messe-arena-einfluss.mjs i-spy 48 --saat-versatz=10000000
node scripts/miss-alle-disziplinen.mjs 24 i-spy --je-seite=2
node scripts/miss-arena-buehne-spiegel.mjs 480 i-spy
node scripts/verify-i-spy-ticker-paket-07-10.mjs
OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-buehne-pps-referenz.ts i-spy
node scripts/miss-alle-disziplinen.mjs 24 tdm battlefield
```

Den zweiten Saatstrom für rho (S1) gibt es nicht als Schalter der Messskripte: er ist
`window.__arena.disziplinProbe("i-spy", {n:48, kaderFamilie, saat0:5000000})`, ausgewertet mit
derselben `auswerten()`-Funktion aus `scripts/lib/rangtreue-messung.mjs`.
