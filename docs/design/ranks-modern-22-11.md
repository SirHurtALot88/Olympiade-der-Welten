# Ranks im neuen Stil (Mockup, 22.11.)

Schritt 1 des Ablaufs aus CLAUDE.md: Mockup und Erklärung. Gebaut wird erst nach „bau das“. Kein App-Code, kein PixelLab.

- Mockup: `public/mockups/ranks-modern-22-11.html`
- Schalter: `?sicht=teams|spieler`, `&mass=staerke|punkte`, `&zeige=rang|wert`, `&liga=eigene|andere|alle`,
  `&d=<disziplin-id>`, `&sel=<team>`, `&nebel=0`, `&kader=1`, `&still=1`

## 1. Kernidee

**Eine Rang-Matrix statt einer Liste.** Jedes Team steht in einer Zeile, jede Spalte ist ein Maß: Gesamt, die vier Bereiche
und alle zwanzig Disziplinen. Die Matrix lässt sich in zwei Lesarten umschalten: **Stärke** (was der Kader auf dem Papier
kann) und **Punkte** (was er daraus gemacht hat). Das Profil rechts stellt beide nebeneinander und zeigt, wo ein Team über
oder unter seiner Papierform spielt. Eine zweite Sicht ordnet die **Spieler** je Disziplin.

## 2. Was die Seite heute zeigt

`app/foundation/ranks-v2/FoundationRanksNewLook.tsx` (523 Zeilen, alter Stil) zeigt genau eine Sache: „PPs pro Bereich“ je
Team, also die Tabellenpunkte gesamt und nach POW, SPE, MEN, SOC, mit einem Umschalter für den Bereich, Kennzahlen
(Liga-Mittel, Median, Spannweite), einem aufklappbaren Radar und dem Podium der Vorsaison. Disziplinen kommen nicht vor,
Spieler auch nicht, die Kaderstärke ebenfalls nicht. Für die Frage „wo ist mein Team stark, wo schwach?“ muss man heute
zwischen Saisonstand, Teamprofil und Spielerliste springen.

## 3. Aufbau

### Sicht Teams

| Teil | Inhalt |
|---|---|
| Kopf | Reiter Teams und Spieler. Rechts die eigene Kaderstärke: Rang in der Liga, klein unter allen 32, darunter der Tabellenplatz. |
| Schalter | Stärke oder Punkte · Rang oder Wert · eigene Liga, andere Liga, alle 32 |
| Matrix | 16 Zeilen (oder 32), 25 Spalten. Kopf mit Disziplin-Icons, oben ein Strich in der Farbe des Bereichs. Zelle = Rang: Gold für Rang 1, grün für das beste Viertel, rot für das letzte. Jede Spalte ist per Klick sortierbar; die erste Spalte zeigt dann den Rang in dieser Spalte, klein den Rang unter allen 32. Eigenes Team hervorgehoben. |
| Profil (rechts) | Für die angeklickte Zeile: Gesamt und vier Bereiche mit Stärke-Rang → Punkte-Rang und der Differenz „Ertrag“. Darunter alle 20 Disziplinen, nach Stärke-Rang geordnet, mit Punkte-Rang und Ertrag. |

**Stärke** = Mittel der besten sechs Spieler des Kaders (Regel aus CLAUDE.md): gesamt aus dem Gesamtwert, je Bereich aus
dem Bereichswert, je Disziplin aus der Eignung. **Punkte** = Tabellenpunkte gesamt und je Bereich; je Disziplin die
Ergebnispunkte, also dieselbe Wertung wie die Disziplin-Medaillen (siehe `leaders-modern-22-11.md`).

Beispiel aus den echten Daten: Death Peaches sind in Basketball nach Stärke Rang 1, nach Punkten Rang 9 (Ertrag −8), in
Climbing nach Stärke Rang 3, nach Punkten Rang 1 (+2).

### Sicht Spieler

| Teil | Inhalt |
|---|---|
| Disziplin-Wahl | Leiste mit „Gesamt“ und den 20 Disziplin-Icons, nach Bereich gefärbt |
| Filter | Klassenfarbe (POW, SPE, MEN, SOC), alle oder mein Kader, Liga |
| Tabelle | Rang (Liga, klein unter allen), Spieler mit Porträt, **Klasse mit Icon in Klassenfarbe**, Rasse, Team, Gesamt, POW, SPE, MEN, SOC, Eignung in der gewählten Disziplin als Zahl und Balken, PP. Alle Spalten sortierbar. Verletzte tragen eine rote Marke. |
| Profil (rechts) | Porträt, Klasse, Rasse, Team; Bereiche mit Rang; alle 20 Disziplinen nach Eignung mit Rang und PP |

## 4. Scouting-Nebel

Regeln aus CLAUDE.md (Kader-&-Teams-Mockup Abschnitt 7a), hier angewandt:

- **Teams:** der Rang ist öffentlich (er mittelt nur die besten sechs), der Wert fremder Teams steht als feste 5er-Stufe
  („40–45“). Das eigene Team ist exakt.
- **Spieler:** fremde, ungescoutete Spieler zeigen feste 10er-Stufen („70–80“), nie „~Zahl“. Sortiert wird nach der Stufe,
  bei Gleichstand nach Name; der Rang ist der Rang der Stufe und wird geteilt. Der Balken zeigt die Stufe als schraffiertes
  Stück, nicht als Länge. Eigene Spieler sind exakt.
- **PP und Tabellenpunkte sind öffentlich**, dort gibt es keinen Nebel.
- Der Schalter „Nebel aus (Einstellung)“ in der Mockup-Leiste steht für die App-Einstellung, die den Fog of War ganz
  abschaltet.

Im Spielstand ist kein fremder Spieler gescoutet; die Stufe „beobachtet“ (5er) kommt im Mockup deshalb nicht vor, gilt aber
genauso.

## 5. Echte Daten

Live-Abbild, Spielstand `new-game-1795114260527-nzr0z9`, Saison 1, 11 gebuchte Spieltage: alle 32 Teams, 376 Kaderspieler
mit Klasse, Rasse, Gesamtwert, Bereichswerten und 20 Eignungen, PP je Spieler und Disziplin, Tabellenpunkte und
Ergebnispunkte je Team und Disziplin. Nichts ist erfunden. Die Stärke rechnet das Mockup selbst aus den Kaderwerten; die
App hat dafür eine eigene Funktion (`teamStrengthRankCaptures`), deren Zahlen leicht abweichen können.

## 6. Bilder

| Datei | Ansicht |
|---|---|
| `ranks-modern-22-11/ranks-teams-1920x1080.png`, `…-2560x1440.png`, `…-1710x1112.png` | Teams, Stärke, Rang |
| `ranks-modern-22-11/ranks-teams-punkte-2560x1440.png` | Teams, Punkte, Werte, Profil eines fremden Teams |
| `ranks-modern-22-11/ranks-spieler-1920x1080.png`, `…-2560x1440.png` | Spieler, Basketball, Nebel an |

Kein Seitenscroll. Die Matrix zeigt alle 16 Teams ohne Scrollen; bei „Alle 32“ und in der Spielerliste (195 Spieler in
Liga 2) rollt nur die Liste in ihrer Tafel.

## 7. Für den Bau

- Neue Komponente unter `app/foundation/ranks-v2/` mit eigenem CSS-Präfix; `FoundationRanksNewLook.tsx` und `.nl-ranks*`
  fliegen danach raus. Die Bausteine Tabelle, Zelle und Profil sind dieselben wie in Leaders.
- Eine Quelle für die Stärke: dieselbe Funktion wie Saisonstand, Startseite und Vorstandsziel („Kaderstärke erwartet Rang
  2/16“), sonst zeigen drei Seiten drei Ränge.
- Mehrspieler: eigenes Team aus `activeManagerTeamId`; der Nebel hängt am Scouting-Stand **dieses** Managers
  (`scoutIntelByTeamId`), nicht an einem festen Team.
- Sortieren und Filtern laufen über die sichtbaren Stufen, nie über die verdeckten Werte.

## 8. Offene Fragen

1. **Name der Seite.** „Ranks“ bleibt als Navigationspunkt? Inhaltlich ist es jetzt „Ränge: Stärke und Ertrag“.
2. **Stärke je Disziplin über die besten sechs oder über die Einsatzplätze der Disziplin** (Wettessen hat drei)? Das
   Mockup nimmt überall die besten sechs, wie die Regel sagt; das ist bewusst ungenau, damit es das Ergebnis nicht verrät.
3. **Podium der Vorsaison** (heute auf der Seite, wenn noch nichts gespielt ist): hierher oder auf die Historie-Seite?
   Empfehlung: Historie.
