# Leaders im neuen Stil (Mockup, 22.11.)

Schritt 1 des Ablaufs aus CLAUDE.md: Mockup und Erklärung. Gebaut wird erst nach „bau das“. Kein App-Code, kein PixelLab.

- Mockup: `public/mockups/leaders-modern-22-11.html`
- Schalter: `?sicht=spieler|teams|medaillen`, `&zeit=saison|<spieltag>`, `&liga=eigene|andere|alle`,
  `&ber=pow|spe|men|soc`, `&still=1`

## 1. Kernidee

**Drei Sichten, ein Zeitschalter.** Spieler, Teams und Medaillen liegen als Reiter im Kopf; rechts daneben stellt man
einmal ein, ob die ganze Saison oder ein einzelner Spieltag gilt und welche Liga. Links steht immer die sortierbare
Bestenliste, rechts immer dieselben zwanzig Disziplin-Karten mit den ersten drei. So findet man „wer ist der Beste?“ und
„wer ist der Beste in Hockey?“ auf demselben Bildschirm, ohne zu scrollen.

## 2. Was die Seite heute zeigt

`app/foundation/league-leaders-v2/LeagueLeadersNewLook.tsx` (2470 Zeilen, alter Stil) hat fünf Unterseiten: Liga-Leaders
(Top-5-Karten für PPS, vier Achsen, MVS, OVR, Trainings-Fortschritt, Most Improved), Rekorde (Medaillenspiegel aller
Zeiten, Trophäenschrank, Rekordbuch, Saison-Awards), Legendäre Spieler, All-Time nach Disziplin, Erfolge. Es gibt keinen
Spieltagsfilter, keine Disziplin-Besten der laufenden Saison, keine Team-Sicht und nichts zu den Disziplin-Medaillen.

**Vorschlag zum Schnitt:** Leaders zeigt die **laufende Saison**. Alles über mehrere Saisons (Rekorde, Legenden,
All-Time, Trophäenschrank, Erfolge) gehört auf die Historie-Seite, die ihr Mockup schon hat
(`historie-modern-18-11.html`). MVS, OVR und Trainings-Fortschritt sind Eigenschaften, keine Leistungen, und stehen in
Ranks bzw. Training.

## 3. Aufbau

### Sicht Spieler

| Teil | Inhalt |
|---|---|
| Podium | Die ersten drei mit Porträt, Klasse in Klassenfarbe, Team, PP und Einsätzen |
| Bestenliste | Rang (Liga, klein unter allen), Spieler, Klasse, Team, PP mit Balken, Einsätze, PP je Einsatz, PP nach POW, SPE, MEN, SOC, MVP, Top-10-Plätze, Bestwert mit Disziplin-Icon. Alle Spalten sortierbar. Filter „Alle PP“ oder ein Bereich. |
| Disziplin-Beste (Saison) | 20 Karten, nach Bereich gefärbt: die drei Spieler mit den meisten PP in dieser Disziplin, dazu „1/2 gespielt“. Karten mit eigenen Spielern sind umrandet. |
| Tagesbeste (Spieltag) | Statt der 20 Karten die zwei Disziplinen des Spieltags groß, je bis zu 16 Spieler mit einem Balken auf der Skala 0 bis 5 |

### Sicht Teams

| Teil | Inhalt |
|---|---|
| Bestenliste | Rang, Team, Tabellenpunkte, S-U-N, Verhältnis, Team-PP (Summe der Spieler-PP) mit Balken, PP je Einsatz, bester Spieler, Medaillen, Punkte nach Bereich. Der Rang gilt für die sortierte Spalte. |
| Disziplin-Beste Teams | 20 Karten mit den ersten drei nach Ergebnispunkten, das ist der Medaillenstand |
| Spieltag | Die zwei Disziplinen des Tages mit allen Ergebnissen („8 : 5 gegen T-C“, bei Pods der Abstand zum Mittel der Gegner) |

### Sicht Medaillen

| Teil | Inhalt |
|---|---|
| Medaillenspiegel | Rang (erst Gold, dann Silber, dann Bronze), Team, Gold, Silber, Bronze, Summe, Prämie in C, die Disziplinen als Icons mit Medaillenpunkt. Marke „Stand heute“. |
| Podium je Disziplin | 20 Karten mit Gold, Silber, Bronze und den Ergebnispunkten; „fertig“, wenn die Disziplin zweimal gespielt ist |

## 4. Regeln im Mockup

- **PP-Skala C2** (`pp-skala-18-11.md`): der Tagesbeste einer Disziplin liegt um 5 PP. Echte Zahlen aus dem Spielstand:
  höchste Einzelwertung 5,0; bester Spieler der Saison King Leoric mit 31,8 PP aus 9 Einsätzen.
- **Tagesanker** (`pp-tagesanker-live-22-11.md`): im Spielstand noch nicht aktiv (er gilt erst ab der nächsten Saison).
  Die Tagesansicht zeigt deshalb ehrlich den Klumpen: am Spieltag 11 stehen in Breaking drei Spieler der Liga 2 genau auf
  5,0. Ein Hinweis unter den Karten erklärt, dass der Tagesanker das ab der nächsten Saison auflöst (Tagesbester 4,8 bis
  5,0, allein vorn). Der Balken endet an einem Strich bei 5.
- **Disziplin-Medaillen** (`finanzen-posten-22-11.md` g.1): je Liga und Disziplin Gold, Silber, Bronze nach der Summe der
  Ergebnispunkte; Geld Liga 1 0,5 / 0,3 / 0,2 C, Liga 2 0,3 / 0,2 / 0,1 C; Moral +6 / +4 / +2 für Spieler mit
  Ehrgeiz-Traits. Vergeben wird am Saisonende. Das Mockup zeigt den **Stand, als wäre heute Schluss**, und sagt das
  dazu. Death Peaches hätten heute 5 Gold und 2 Bronze (+1,7 C).
- **Rang 1 ist der beste**; gleiche Werte teilen den Rang.
- **Kein Nebel:** PP, Ergebnisse und Medaillen sind öffentlich.

## 5. Echte Daten

Live-Abbild, Spielstand `new-game-1795114260527-nzr0z9`, Saison 1, 11 gebuchte Spieltage: 2766 PP-Buchungen, MVP- und
Top-10-Zähler, 704 Team-Ergebnisse, Tabellenpunkte. Nichts ist erfunden.

Zwei Näherungen, beide im Mockup benannt:

- **Gleichstand bei Medaillen.** Die Regel sagt: Ergebnispunkte, dann Summe der Rohwert-Abstände, dann PP-Summe, sonst
  teilen. Das Mockup nimmt als zweites Kriterium das gespeicherte Verhältnis und teilt nicht.
- **Pods haben keine Ergebnispunkte.** Mini-DM, Takeshi, Staffel und Battlefield werden im Vierer-Pod gewertet; im
  Spielstand steht dort kein 0-bis-10-Ergebnis, nur das Verhältnis (eigener Wert minus Mittel der Gegner). Das Mockup
  wertet diese vier Disziplinen danach und zeigt die Zahl mit Vorzeichen („+7“).

## 6. Bilder

| Datei | Ansicht |
|---|---|
| `leaders-modern-22-11/leaders-spieler-1920x1080.png`, `…-2560x1440.png`, `…-1710x1112.png` | Spieler, Saison |
| `leaders-modern-22-11/leaders-spieltag-1920x1080.png`, `…-2560x1440.png` | Spieler, Spieltag 11 mit Tagesbesten |
| `leaders-modern-22-11/leaders-teams-1920x1080.png`, `…-2560x1440.png` | Teams, Saison |
| `leaders-modern-22-11/leaders-medaillen-1920x1080.png`, `…-2560x1440.png` | Medaillenspiegel und Podien |

Kein Seitenscroll. Team- und Medaillentabelle zeigen alle 16 Teams ohne Scrollen; nur die Spieler-Bestenliste (195 Spieler in Liga 2)
rollt in ihrer Tafel.

## 7. Für den Bau

- Neue Komponente unter `app/foundation/league-leaders-v2/` mit eigenem CSS-Präfix; `LeagueLeadersNewLook.tsx` und
  `.nl-leaders*` fliegen danach raus. Die Mehrsaison-Teile ziehen vorher auf die Historie-Seite um, nichts fällt ersatzlos
  weg.
- Daten kommen aus dem vorhandenen Punkte-Ledger (`persistedSeasonDerivations.ledger`), je Spieltag gefiltert. Die
  PP-Anzeige fragt `ppSkalaModus(gameState)` und `ppTagesankerFuer(gameState, matchdayId)`, nie eine Variable.
- Die Medaillen-Sicht braucht die Medaillen-Mechanik (Finanzen Runde 3). Bis dahin kann die Sicht den Stand zeigen, ohne
  dass Geld oder Moral gebucht werden; die Rangfunktion muss dann dieselbe sein, die am Saisonende bucht.
- Mehrspieler: eigenes Team aus `activeManagerTeamId`, reine Leseseite ohne Schreibweg.

## 8. Offene Fragen

1. **Medaillen in Pod-Disziplinen.** Wonach wird in Mini-DM, Takeshi, Staffel und Battlefield gewertet? Empfehlung: nach
   dem Verhältnis, wie im Mockup; das muss in die Medaillen-Regel, sonst fehlt für 4 von 20 Disziplinen die Wertung.
2. **Mehrsaison-Inhalte auf die Historie-Seite verschieben?** Empfehlung: ja, Leaders bleibt die laufende Saison.
3. **MVP.** In der Saison-Sicht steht der MVP-Zähler des Spielstands, in der Spieltags-Sicht nur das Merkmal
   „MVP-Kandidat“ je Wertung. Soll es je Spieltag genau einen MVP geben, den beide Sichten zeigen?
