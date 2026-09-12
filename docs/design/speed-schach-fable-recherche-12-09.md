# Speed-Schach als eigene Sportart — Fable-Recherche (K3, 12.09.)

Auftrag: `docs/pm-briefings/opus-plan-zehn-disziplinen-alle-kategorien-09-10.md` Abschnitt 5.1
(„Platz 5 — Speed-Schach: Konzept 80 → 95"). Die K-Achse hängt an genau einem fehlenden
Kriterium: **K3, ein eigenes Fable-Recherche-Dokument.** Bisher steckt der Entwurf geteilt in
`takeshi-schach-optik-gameplay-plan-05-09.md` Teil A (Bühnenbild, Assets, Umsetzungsschritte)
und `arena-duell-recherche-fable.md` Abschnitt 4 (die Werteformel-Analyse) — beide mit anderen
Disziplinen geteilt, keins davon modelliert Speed-Schach **als Sportart**. Dieses Dokument holt
das nach: warum Blitzschach als Mannschaftsdisziplin überhaupt funktioniert, was ein
Brett-gegen-Brett-Vorteil bedeutet, und wie sich Zeitnot gegen Stellungsvorteil verrechnet.

**Reine Schreibarbeit. Es wird keine Zeile Produktionscode geändert** — K1 (eigenes Rezept ohne
Charisma-Schwerpunkt, `BUEHNE_ART["speed-schach"].rezept`), K2 (`duell:true`/`schach:true` als
echte, seit #818/#883 produktive Mechanik) und K4 (Gameplay/rho bereits bei 0,908, kein offener
Kalibrierbedarf laut Opus-Plan-Tabelle) stehen bereits; K3 ist die einzige Lücke, und sie ist
Dokumentation, kein Code. Vorlage im Aufbau: `docs/design/breaking-kalibrierung-10-09.md`
(Fragen → recherchierte Antwort → Beleg), hier auf drei konzeptionelle statt drei
Kalibrierfragen angewendet, weil bei Speed-Schach nichts zu kalibrieren, aber viel zu erklären
übrig ist.

## Kurzfassung

| Frage | Antwort |
|---|---|
| 1 — Warum funktioniert Blitzschach als Mannschaftsdisziplin? | Es ist keine Fable-Erfindung, sondern ein etabliertes reales Turnierformat — Schacholympiade, Bundesliga/4NCL, und ab 2026 sogar eine eigene FIDE-Weltmeisterschaft für Mannschafts-Blitz (World Team Rapid & Blitz Championships). Bretter laufen unabhängig, aber das Team gewinnt oder verliert gemeinsam über Mannschaftspunkte. |
| 2 — Was bedeutet ein Brett-gegen-Brett-Vorteil? | Zwei verschiedene Zahlen für zwei verschiedene Fragen: die **Brettpunkte** (wer hat mein Brett gewonnen — Mannschaftsergebnis, real 1/0,5/0 → Matchpunkte) und der **Spielerwert** (wie gut habe ich selbst gespielt, unabhängig davon, wen ich zufällig zugelost bekam). Das Motor-Rezept trennt beide bereits sauber (`u.summe` für die Eignung, `u.vorteil` fürs Brettergebnis) — der einzige Fund dieser Recherche ist eine Konvention, die der Motor NICHT abbildet: reale Mannschaften setzen ihre Bretter in Stärkereihenfolge, unsere Paarung ist Listenzufall. |
| 3 — Wie verrechnet sich Zeitnot gegen Stellungsvorteil? | Nicht linear, sondern mit einer Schwelle: Auswertungen von Online-Blitzpartien zeigen einen scharfen Knick bei rund 10–30 Sekunden Restzeit — darüber zählt die Stellung, darunter zunehmend nur noch die Uhr. Das Motor-Rezept bildet genau diese Idee schon strukturell ab (ein starker Zug spart Zeit, ein schwacher frisst sie), ohne dass ein Schachmotor nötig wäre. |

---

## 1. Warum Blitzschach eine Mannschaftsdisziplin sein kann

### 1.1 Es ist kein Fable-Kunstgriff — es ist ein reales, laufendes Turnierformat

Der naheliegende erste Einwand gegen „Speed-Schach als Olympiade-Disziplin" wäre: Schach ist ein
Einzelsport, ein Duell zweier Köpfe an einem Brett — wie soll daraus ein Sechs-gegen-sechs werden,
wie bei Basketball oder Hockey? Die Antwort: **das ist längst Realität**, nicht erfunden für dieses
Spiel.

- Die **Schacholympiade** (FIDE, alle zwei Jahre, 2026 in Titelverteidigung ausgetragen) ist das
  älteste und größte Mannschaftsturnier des Sports — vier bis fünf Bretter je Team, Nationen
  gegeneinander, ausgetragen über klassische Bedenkzeit, aber nach exakt derselben
  Mannschaftslogik wie ihre schnelleren Geschwister.
- Für **schnelle** Bedenkzeiten gibt es seit 2026 eine eigene FIDE-Veranstaltung, die
  **World Team Rapid & Blitz Chess Championships** — Blitz dort mit 3 Minuten Grundbedenkzeit
  plus 2 Sekunden Zuwachs je Zug, exakt das Tempo, das auch unser Motor mit einer 3:00-Uhr und
  Zug-Zeitkosten simuliert (s. Abschnitt 3).
- Nationale Ligen (Deutschland: Schach-Bundesliga; England: 4NCL; unzählige weitere) laufen
  ganzjährig nach demselben Mannschaftsprinzip, oft explizit mit Schnellschach- oder
  Blitz-Wochenenden.

Das Prinzip, das alle drei teilen und das unser Motor übernimmt: **die Bretter spielen
unabhängig, aber das Ergebnis wird gemeinsam gezählt.** Ein Turnierleitfaden für
Mannschaftsschach fasst die Mechanik so zusammen: jede einzelne Partie zählt zunächst als eigener
„Brettpunkt" (1 für Sieg, ½ für Remis, 0 für Niederlage), und daraus wird erst in einem zweiten
Schritt der **Mannschaftspunkt** — bei mehr als der Hälfte der Brettpunkte gewinnt das Team,
Standard-Konvention 2 Mannschaftspunkte für den Sieg, 1 für jedes Team bei Gleichstand
[chesspairings.org](https://chesspairings.org/en/guide/team-tournaments/). Genau diese
Zwei-Ebenen-Zählung — Brettpunkte, DANN Mannschaftspunkte — ist exakt das Verhältnis von
`u.vorteil` (Brettergebnis) zu den Team-Matchpunkten, die die Arena aus `spieleBuehneDuell()`
zieht (2/1/0, dieselbe Konvention wie überall sonst in der Olympiade).

### 1.2 Eine echte Lücke gegen die reale Konvention — nicht behoben, aber benannt

Ein Unterschied bleibt, und diese Recherche verschweigt ihn nicht: **reale Mannschaften melden
ihre Bretter in absteigender Spielstärke** — Brett 1 der stärkste Spieler, Brett 2 der zweitstärkste,
und so weiter, für beide Seiten, meist über die gesamte Saison fixiert, gerade damit ein Team seine
Reihenfolge nicht taktisch verbiegen kann
([chesspairings.org](https://chesspairings.org/en/guide/team-tournaments/)). `arena-duell-recherche-fable.md`
Abschnitt 4.1 hat das für unseren Motor bereits vermessen: `mine` ist nach Disziplinwert sortiert,
`OPP` steht in Listenreihenfolge — die Paarung ist „weder nach Stärke noch zufällig, sondern
Listenzufall" (rho Eignung↔Gegner-Eignung nur 0,31). Das ist der Grund, warum ein einzelnes Brett
(„Ralazar, Eignung 72,4, spielt das zweitbeste Ergebnis von zwölf, steht aber mit −17 da, weil sein
zufälliger Gegner besser würfelte") wie eine Ungerechtigkeit aussehen kann, obwohl die Mechanik
selbst rangtreu ist — genau die Verwechslung, die Abschnitt 2 dieses Dokuments auflöst. **Diese
Recherche behebt die Bettreihenfolge nicht** (das wäre eine Code-Änderung, K3 ist Dokumentation) —
sie hält fest, dass eine stärkebasierte Brett-Zuordnung der nächste naheliegende Schritt wäre, WENN
Chris die Paarung realistischer haben will, unabhängig von der Rangtreue-Frage.

---

## 2. Was ein Brett-gegen-Brett-Vorteil bedeutet

### 2.1 Zwei Zahlen, zwei Fragen — bereits im Motor getrennt

Die wichtigste konzeptionelle Klärung für Speed-Schach ist, dass **„wie gut habe ich gespielt"**
und **„habe ich mein Brett gewonnen"** zwei verschiedene Fragen mit zwei verschiedenen Antworten
sind — und dass eine Rangtreue-Abnahme nur die erste stellen darf, weil nur sie etwas über die
EIGNUNG des Spielers aussagt. `arena-duell-recherche-fable.md` Abschnitt 4.2 hat das gemessen:
gegen den **Vorteil** (Brettergebnis, eigene minus gegnerische Punkte) liest die Eignung nur
rho 0,54 — nicht weil die Mechanik unfair wäre, sondern weil der Vorteil **konstruktionsbedingt**
von zwei fast unabhängigen Zufallsgrößen abhängt (der eigenen Leistung UND der des zufällig
zugelosten Gegners). Gegen die **eigenen Punkte** (`u.summe`) liest dieselbe Eignung rho 0,95 —
dieselbe Partie, derselbe Würfel, nur die richtige Frage gestellt. Das ist bereits umgesetzt
(`MOTOREN["speed-schach"].wert` liest `summe`, nicht `vorteil`) und der Grund, warum Speed-Schachs
Gameplay-Rangtreue heute bei 0,908 steht, einer der höchsten Werte des ganzen Feldes.

**Für die Vorstellung, die dieses Dokument liefern soll, heißt das:** ein „Brett-gegen-Brett-Vorteil"
ist NICHT das Maß für Spielstärke — er ist das Maß für das **Turnierergebnis dieses einen Duells**,
genauso wie ein 3:1-Satzgewinn im Tennis nichts darüber sagt, wer die härteren Ballwechsel spielte.
Beide Zahlen sind ehrlich, beide werden im Bild gezeigt (Duellstand groß, `u.summe` als
„Weiß · 231 Pkt." neben dem Spieler, s. `zeichneSchach()`), aber nur eine davon darf über
Kaderentscheidungen (Eignung, Aufstellung, Kauf) mitentscheiden.

### 2.2 Die reale Referenzformel, zur Einordnung — bewusst NICHT eingebaut

Schach selbst hat für „Leistung gegen einen Gegner bereinigt um dessen Stärke" eine über
hundert Jahre alte Antwort: die Elo-Erwartung `E = 1 / (1 + 10^((R_Gegner − R_eigen)/400))` und
die daraus abgeleitete Turnierperformance (grob: Gegnerdurchschnitt plus/minus 400 Punkte je
Sieg/Niederlage gegenüber der erwarteten Score). `arena-duell-recherche-fable.md` Abschnitt 4.3
nennt das explizit als **zweite Wahl** — „Leistung gegen Erwartung", `wert = summe − erwartet(gegner)`
— und begründet, warum die **erste Wahl** (rohe `summe`) für die Rangtreue-Abnahme trotzdem
richtiger ist: „die Rangtreue soll die Mechanik prüfen, nicht die Paarung." Ein Elo-artiger
Bonus/Malus würde einen schwachen Spieler gegen einen noch schwächeren Gegner künstlich aufwerten
— genau das Gegenteil von dem, was eine Eignungsmessung will. Diese Recherche übernimmt diese
Entscheidung unverändert; sie wird hier nur erklärt, nicht neu verhandelt.

---

## 3. Wie sich Zeitnot gegen Stellungsvorteil verrechnet

### 3.1 Der reale Befund: eine Schwelle, kein gleichmäßiges Verrechnen

Die naive Erwartung wäre, dass Zeitnot einen Stellungsvorteil GLEICHMÄSSIG auffrisst — je weniger
Zeit, desto mehr zählt der Zufall, in stetiger Linie. Eine Auswertung großer Mengen echter
Online-Blitzpartien (Bewertung von Stellung und Uhrzeit gegeneinander aufgetragen) zeigt stattdessen
einen **scharfen Knick**: „a big drop off around 10 to 30 seconds left, depending on the rating
level" — oberhalb dieser Schwelle zählt überwiegend die Stellung (2–3 Minuten Restzeit liefern
fast dieselben Ergebnisse wie 3+ Minuten), unterhalb davon kollabiert der Zusammenhang zwischen
Bewertung und Ergebnis fast vollständig: bei starken Spielern (Elo 2200) macht es „hardly any
difference between an objectively winning or losing position" mehr, sobald weniger als 5 Sekunden
auf der Uhr stehen
([jk_182, Lichess-Blog](https://lichess.org/@/jk_182/blog/how-the-evaluation-and-clock-impact-results-of-blitz-games/I2kRp2sk)).
Mit anderen Worten: **die Uhr ist kein zweiter, gleichmäßig mitzählender Gegner — sie ist ein
Schwellenwert-Ereignis.** Bis dahin gewinnt die bessere Stellung, danach übernimmt sie eine ganz
andere Mechanik (Reflexe, Vorbereitung, schiere Zugzahl pro Sekunde).

Dazu passt eine zweite, oft zitierte Beobachtung aus der Blitz-Praxis: die Uhr wird selbst zu
einer Art drittem Akteur am Brett — sobald ein Gegner in Zeitnot gerät, lohnen sich Züge, die die
Stellung verkomplizieren, selbst wenn sie objektiv nicht die stärksten sind, weil ein Gegner mit
zehn Sekunden auf der Uhr keine Zeit mehr hat, die beste Antwort zu finden
([ChessMind AI, Blitz Chess Guide](https://chessmind.ai/chess-terms/blitz-chess)). Das ist der reale
Kern von „Zeitnot verrechnet sich gegen Stellungsvorteil": nicht als stetiger Abzug, sondern als
zunehmende **Unsicherheit**, die irgendwann so groß wird, dass sie die Stellung dominiert.

### 3.2 Was das für unser Rezept bedeutet — schon eingebaut, hier nur erklärt

`zeichneSchach()` bildet genau dieses Prinzip bereits strukturell ab, ohne dass es je als
„Zeitnot-Mechanik" benannt wurde: die angezeigte Schachuhr startet bei 3:00 (derselbe Wert wie die
reale Blitz-Grundbedenkzeit oben), ein **starker** Zug (`ereignis === art.erfolgWort`) kostet nur
8 Sekunden, ein **verpatzter** (`art.failWort`) kostet 20 — ein Spieler, der viele schwache Züge
enthüllt bekommt, nähert sich damit schneller der Null als einer, der stark spielt. Das ist exakt
die reale Beobachtung aus 3.1 in Miniatur: **eine schwächere Leistung frisst nicht nur Punkte
(`u.summe`), sie frisst zusätzlich Zeit** — der Spieler, der ohnehin schlechter dasteht, gerät auch
eher in die Zone, in der die Schwelle aus 3.1 kippt. Das Spielergebnis selbst
(`u.summe`/`u.vorteil`) bleibt davon unberührt — die Uhr ist reine Präsentation, kein zweiter
Würfel (`sfx()`/`tonLoopStart()`/die Uhr-Anzeige selbst lesen nur bereits vorhandene Felder,
schreiben nichts zurück) — aber sie ERZÄHLT sichtbar dieselbe Geschichte, die die Zahlen ohnehin
schon sagen. Genau das ist der Auftrag von Movement (M2/M4, Abschnitt 5.1 des Opus-Plans): eine
sichtbar heruntertickende Uhr statt einer, die nur bei jedem Zug in Acht-oder-Zwanzig-Sekunden-
Sprüngen umspringt, und eine Hand, die den Uhrenknopf tatsächlich drückt — die Illustration einer
Mechanik, die schon da ist, nicht eine neue.

### 3.3 Warum trotzdem kein Schachmotor nötig ist

Der Motorkommentar bei `BUEHNE_ART["speed-schach"]` sagt es selbst: das Brett zeigt „nur eine
plausible Zugfolge", keine echte Schachlogik — sechs historische Eröffnungen
(`SCHACH_PARTIEN`, s. `takeshi-schach-optik-gameplay-plan-05-09.md` A.4) laufen deterministisch
durch, während der Durchgangs-Rechner unabhängig davon Punkte und Ereignisse würfelt. Das ist
dieselbe Ehrlichkeit, die `takeshi-schach-optik-gameplay-plan-05-09.md` für die Hantel beim
Gewichtheben reklamiert: „die Kilos sind echt, die Pose ist Sprite." Übertragen auf Speed-Schach:
**die Uhr-Sekunden und die `!`/`?!`-Annotation sind wahr** (sie zeigen das tatsächlich gewürfelte
Ereignis dieses Zuges), **die Stellung ist plausibel** (eine echte Eröffnung, aber nicht deshalb
stark oder schwach, weil der Rechner das sagt). Ein echter Schachmotor wäre der falsche Aufwand
für eine Disziplin, deren Gameplay-Rangtreue bereits bei 0,908 steht — das Ziel von Movement ist
sichtbare Bewegung (Figuren gleiten, Uhr tickt, Hand schlägt), nicht Spielstärke.

---

## 4. Ehrliche Einordnung — was diese Recherche ändert und was nicht

- **Ändert:** nichts am Code. K3 verlangt ein Dokument, das Speed-Schach als eigene Sportart
  modelliert — das ist dieses Dokument.
- **Bestätigt, ohne neu zu verhandeln:** die Wert-Entscheidung aus `arena-duell-recherche-fable.md`
  (eigene Punkte statt Brettvorteil als Eignungsmaß) und das Rezept aus `BUEHNE_ART["speed-schach"]`
  (K1/K2, bereits produktiv seit #818/#883).
  bleiben unverändert.
- **Benennt eine echte, nicht behobene Lücke** (Abschnitt 1.2): unsere Brettpaarung ist
  Listenzufall, reale Mannschaftsturniere paaren nach Stärke. Das ist eine Konzeptfrage für eine
  spätere Runde (Spielgefühl, nicht Rangtreue — `arena-duell-recherche-fable.md` zeigt, dass die
  heutige Paarung die Eignungsmessung nicht verzerrt), keine, die diese K3-Recherche selbst lösen
  muss.
- **Liefert die Begründung für die Movement-Achse (M2/M4) derselben Platz-5-Aufgabe:** die
  tickende Uhr und der Uhrenknopf-Schlag sind keine beliebige Kosmetik, sondern die sichtbare
  Übersetzung einer real belegten Mechanik (Zeitnot als Schwellenwert-Ereignis, Abschnitt 3.1/3.2).

## Quellen

- [chesspairings.org — Team Chess Tournaments: Rules, Formats & Tiebreaks](https://chesspairings.org/en/guide/team-tournaments/) — Board-Reihenfolge nach Stärke, Brettpunkte vs. Mannschaftspunkte, 2/1/0-Konvention
- [FIDE Handbook — Regulations for the FIDE World Team Rapid & Blitz Chess Championships 2026](https://handbook.fide.com/files/handbook/WRTC2026Regulations.pdf) — Blitz-Bedenkzeit 3 Minuten + 2 Sekunden/Zug, Mannschaftspunkte-Konvention
- [Wikipedia — World Rapid and Blitz Team Chess Championships 2024](https://en.wikipedia.org/wiki/World_Rapid_and_Blitz_Team_Chess_Championships_2024) — Vorläufer-Ausgabe des Formats
- [jk_182, Lichess-Blog — How the Evaluation and Clock impact Results of Blitz Games](https://lichess.org/@/jk_182/blog/how-the-evaluation-and-clock-impact-results-of-blitz-games/I2kRp2sk) — Schwellenwert bei 10–30s Restzeit, Kollaps des Bewertungs-Ergebnis-Zusammenhangs unter 5s
- [ChessMind AI — Blitz Chess: Time Controls, Skills & GM Tips](https://chessmind.ai/chess-terms/blitz-chess) — „die Uhr als dritter Spieler", Zeitnot-Technik
- Repo: `docs/design/takeshi-schach-optik-gameplay-plan-05-09.md` Teil A (Bühnenbild/Assets),
  `docs/design/arena-duell-recherche-fable.md` Abschnitt 4 (Werteformel-Analyse),
  `docs/design/breaking-kalibrierung-10-09.md` (Vorlage für Aufbau/Stil),
  `docs/pm-briefings/opus-plan-zehn-disziplinen-alle-kategorien-09-10.md` Abschnitt 5.1 (Auftrag),
  `public/mockups/battle-mode.engine.js` (`BUEHNE_ART["speed-schach"]`, `zeichneSchach()`)
