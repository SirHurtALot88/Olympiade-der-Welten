# Battle Mode — Alternative zum Management Mode (Design-Notiz, geparkt)

> **Status:** Ideen-/Architektur-Notiz. NICHT in Umsetzung. Wir arbeiten aktuell am
> **Management Mode** weiter. Dieses Dokument hält die Battle-Mode-Alternative fest,
> damit sie nicht verloren geht.

## 1. Kernidee: zwei Modi bei Spielstart

Beim Start eines neuen Spiels wählt man den Modus:

- **Management Mode (Hauptmodus, aktueller Build):** Matchday = Auto-Battler-Reveal.
  Jede Disziplin ist eine Reveal-Szene mit gemeinsamer Grammatik **Position = Punkte**,
  32 Teams gleichzeitig, Werte akkumulieren (forward-only). Tiefe liegt im *Managen*.
- **Battle Mode (Alternative, v2-/Erweiterungs-Kaliber):** Disziplinen sind **voll
  ausgearbeitet** als echtes Match-Gameplay (nicht nur Skin) — K.-o.-Turnier bzw.
  Einzel-Duelle. Man sieht konkret, was in jedem Matchup passiert.

### Was der Moduswechsel betrifft — und was NICHT
Der Wechsel Management → Battle betrifft **NUR die Arena und die daraus resultierenden
Punkte + Ausdauer**. Alles andere ist in **beiden Modi identisch**:

- **Immer gleich (modusunabhängig):** der ganze Wirtschaftszweig — Draft, Pick, Kauf,
  Verkauf, Verträge, Transfers, Training, Facilities, Kader, Saisonstand-Rahmen,
  Spieler-Progression, Awards-Rahmen. Das gilt IMMER.
- **Modusabhängig (nur das):** die Matchday-Auflösung (Arena) und wie daraus
  **Punkte + Ausdauer** entstehen.

> Offen: ob sich das wirklich so sauber trennen lässt (nur Arena + Punkte/Ausdauer),
> oder ob Fable eine noch sauberere Trennung findet. Alternativ: statt zweitem Modus
> lieber die **Darstellung im Management Mode noch geiler** machen.

## 2. Battle-Mode-Struktur (aus dem alten Spiel)

Zwei Disziplin-Familien, je nach Disziplin unterschiedlich aufgesetzt:

### Team-Disziplinen → K.-o.-Bracket
- Ganzes Team gegen ganzes Team, N-gegen-N (z. B. 5 eingesetzt → 5v5).
- 32 Teams → Bracket: Runde 1 = 16 Matches, 16 Teams fliegen komplett raus → 16 → 8 → …
- Ein Team kommt als Ganzes weiter, das Verlierer-Team ist komplett draußen.

### Einzel-Disziplinen → Solo-Duelle
- Jedes Team setzt Spieler ein (z. B. 6er-Disziplin = 6 Spieler), aber die Spieler sind
  **solo** unterwegs.
- Sie kämpfen in **1v1 / 2v2 / 4er-Runden** gegeneinander.
- Zusammensetzung **gemischt**: mal 2 Spieler aus demselben Team in einer Runde, mal 4
  verschiedene Teams beteiligt.
- Beispiel Mini-DM: 4 Spieler in einer Runde, die **besten 2 kommen weiter**.
- Sonderfall Eiskunstlauf: lief immer im **Duett** → 2/4/6 Leute; bei 3/5 offen.

### Der Charme (warum es gut war)
Beides ist **von Natur aus fokussiert** — in der Solo-Disziplin schauen z. B. nur 4 Leute
aufeinander, in der Team-Disziplin 5v5. Man sieht immer **konkret, was abgeht**. Das ist
strukturell das Focus+Context-Muster (siehe Fables Geometrie-Konzept: Elimination = G8,
Duell/Bracket = G10, Layout L1).

## 3. Punkte + Ausdauer (der „Rattenschwanz")

- **Einmal sauber aufsetzen.** Das ist die kritische, einmalige Grundarbeit.
- **Progressiv:** je weiter man im Bracket/Turnier kommt, desto mehr „kostet" beides —
  tiefere Runden kosten mehr Ausdauer und bewegen mehr Punkte.
- **Platzierungs-/rundenbasiert:** wer in derselben Runde ausscheidet, bekommt dieselbe
  Punktzahl und verliert dieselbe Ausdauer; der Finalsieger bekommt etwas obendrauf.
- Das ist ein **anderes** Punkte-/Ausdauersystem als der aktuelle Management-Build
  (Wert-Akkumulation, forward-only). Das ist der „Rattenschwanz" — muss einmal sauber
  gebaut werden, ist dann aber die Grundlage.

## 4. Bekannte offene Probleme / Risiken

- **Peak-Player hebeln das Team-Gefühl aus:** In Einzel-Disziplinen werden Spieler, die
  in *einer* Disziplin sehr stark sind, schnell sehr stark (holen viele Punkte). Das
  untergräbt das Gefühl, ein *Team* zu managen. → Braucht ein Gegengewicht (Punkte-Cap
  pro Spieler? Team-Anteil-Gewichtung? Ausdauer-Kopplung?).
- **Battle Mode ≈ zweites Spiel:** eigenes Punkte-/Ausdauersystem, Bracket-/Duell-Engine,
  Match-Formate (1v1/2v2/4er/5v5, gemischte Team-Zugehörigkeit), 20 Disziplinen voll
  ausgearbeitet, eigenes Balancing + AI. Verdoppelt grob die Oberfläche → Pflege-Steuer.
- **Feasibility der Parallelität:** nur tragbar, wenn die Nicht-Arena-Systeme wirklich
  100 % geteilt bleiben.

## 5. Architektur-Empfehlung (falls es kommt)

1. **Management Mode zuerst sauber & spaßig** — er ist der Hauptmodus, der billigere,
   schon laufende Weg, und muss ohnehin funktionieren.
2. **Matchday-Resolver steckbar halten** + **gemeinsames Ergebnis-Format**, das BEIDES
   abbilden kann (Wert-Akkumulations-Punkte UND platzierungs-/rundenbasierte Punkte).
   Dann konsumieren Saisonstand, Awards, Progression beide Modi, ohne das Spiel zu forken.
3. **An EINER Disziplin durchprototypen, bevor die Parallel-Architektur committet wird** —
   Vorschlag Fechten als echtes Duell/Bracket (Focus+Context L1) mit Wegwerf-Punkte/
   Ausdauermodell. Zeigt ehrlich Spaß + wahre Kosten, bevor man 20× dafür zahlt.

## 6. Merksatz

Der Zwei-Modi-Split löst sogar den „alles ist nur ein Skin"-Frust auf:
- **Management Mode:** geteilte Grammatik + Skin pro Disziplin ist *legitim* — die Tiefe
  liegt im Managen, der Matchday ist ein sehenswerter Reveal.
- **Battle Mode:** hier *verdienen* die Disziplinen echtes eigenes Gameplay.

Battle Mode = **v2/Erweiterung**, nicht Near-Term. Erst Management Mode fertig, dann ein
Battle-Prototyp als Beweis.
