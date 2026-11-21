# Office: Vorstand, Ziele, Gespräch, Prämien (Fable, 21.11., Welle 5)

Entwurf: Mockup und Erklärung. `app/`, `components/`, `lib/` und der Motor sind nicht angefasst, bei PixelLab ist
nichts bestellt; der Vorstand ist weiter das Teamwappen im Kreis. Baut auf zwei freigegebenen Entwürfen auf:
`office-modern-18-11.html` (Reiter Vorstand und Ziele) und `vorstandsgespraech-18-11.html`
(`docs/design/vorstandsgespraech-18-11.md`). Neu aus der Arbeitsliste Welle 5: **Vorstandsziele ohne Widersprüche,
Laufzeit-Quote, Lieblingsspieler** und **Prämien für Spieler und Mannschaft**.

## Ansehen

| Was | Datei |
|---|---|
| Mockup, klickbar, läuft per Doppelklick | `public/mockups/office-vorstand-21-11.html` |
| Bilder, je 1920×1080 und 2560×1440, einfache Dichte | `docs/design/mockups-21-11/office-01` bis `office-08` |

Zustände per Adresse: `?ansicht=vorstand|gespraech|praemien`, `?lage=ruhig|druck|wind`,
`?thema=stufe|sonder|anzapf|alles|ziel|liebling|praemie`, `?biete=zielhoch,rueck,deckel,vertrauen,binden`,
`?antwort=1`, `?annehmen=1`, `?still=1`.

| Bild | Zustand |
|---|---|
| `office-01-vorstand` | Vertrauen 6,2 → 90 %, vier Ziele, Freigabe und Töpfe |
| `office-02-vorstand-unter-druck` | Vertrauen 2,6 → 70 %, Gehaltstopf bleibt bei 75 %, „Alles auf eine Karte“ gesperrt |
| `office-03-gespraech-bitte` | Gespräch, Schritt 1: sieben Bitten |
| `office-04-gespraech-entwurf` | Schritt 2: Zusagen wählen, Waage zeigt die Einschätzung vor dem Antrag |
| `office-05-gespraech-gegenangebot` | Vorstand verlangt eine weitere Zusage |
| `office-06-gespraech-zustimmung` | vereinbart, Folgen und Protokoll |
| `office-07-praemien` | Prämien (Idee): Mannschaft, Spieler, Kosten und Wirkung |
| `office-08-praemien-gesperrt-mit-leiste` | Prämien über dem freien Gehaltstopf: harte Sperre, Weg über den Vorstand |

Der Schauplatz ist **Saison 2, Transferfenster vor Spieltag 1**, weil die Freigabe in Saison 1 für alle 100 % ist
und „Alles auf eine Karte“ nur im Fenster ab Saison 2 geht.

## 1. Zweck

Das Office beantwortet eine Frage: **Wie steht der Vorstand zu mir, und was folgt daraus?** Bisher steht die Antwort
verteilt: Vertrauen im Office, Freigabe und Sonderwege auf der Finanzseite, das Gespräch als eigener Entwurf. Hier
steht alles an einem Ort, in drei Reitern.

## 2. Aufbau

### Reiter „Vorstand und Ziele“

| Spalte | Inhalt |
|---|---|
| Vertrauen | Bogen 0 bis 10 mit den fünf Stufen als Segmente, Leiter „Vertrauen → Freigabe für Ablösen/Gebäude → Freigabe für Gehälter“, die letzten fünf Bewegungen, Ränge in der Liga (Rang 1 = bester, bei Gehaltskosten das günstigste Team) |
| Vorstandsziele | Widerspruchs-Prüfung, vier Zielkarten, „So vergibt der Vorstand“ in vier Schritten, das bei der Vergabe verworfene Ziel, Abrechnung am Saisonende |
| Freigabe und Budgets | Quote groß, Kasse als Balken (frei, Vorbehalt, Gehaltspuffer, Notrücklage), zwei Töpfe, Sonderwege, „Was gegen welchen Topf zählt“, Knopf „Mit dem Vorstand sprechen“ |

**Die drei Wünsche aus Welle 5, so umgesetzt:**

* **Keine Widersprüche.** Der Vorstand vergibt die Ziele als Satz: höchstens ein Ziel je Bereich (Sport, Finanzen,
  Kader, Kabine), dann wird jedes Paar geprüft. Verlangt ein Ziel, was ein anderes verbietet, fliegt es raus und wird
  ersetzt. Das Mockup zeigt das Ergebnis („Widerspruchs-Prüfung bestanden“, vier geprüfte Paare) und ein Beispiel:
  „Netto-Transferausgaben: Ligarang 1 bis 4“ wurde verworfen, weil es „Top 6 erreichen“ widerspricht, solange der
  Kader unter Soll-Größe ist. Dieselbe Regel gilt im Gespräch: eine Zusage, die der eigenen Bitte widerspricht
  (Gehaltsdeckel bei einer Bitte um mehr Gehaltsbudget), ist nicht wählbar.
* **Laufzeit-Quote.** Zwei Lesarten, beide im Mockup: (a) jedes Ziel trägt seine **Laufzeit** als Marke („diese
  Saison“, „bis Ende Saison 3“); (b) ein eigenes Ziel **„Vertragslaufzeiten: höchstens 3 von 10 enden zugleich“** mit
  einem Balken je Saisonende. Hintergrund: Draft-Verträge laufen fest ein Jahr, am Ende von Saison 1 läuft fast alles
  auf einmal aus. Welche Lesart gemeint war, ist Frage 2.
* **Lieblingsspieler.** Der Vorstand hat einen Liebling (im Mockup der Beste der letzten Saison). Ein Verkauf kostet
  Vertrauen, eine Verlängerung bringt welches, dazu ein kleines Einsatz-Ziel. Der Spieler ist im Kader und in der
  Prämientabelle markiert. Im Gespräch gibt es die Bitte „Lieblingsspieler freigeben“ und die Zusage „Karthogg
  verlängern“.

### Reiter „Gespräch“

Drei Schritte, oben als Leiste: **Bitte → Zusagen → Antwort**. Links der Vorstand (Charakter aus der Sparneigung,
was ihm wie viel wert ist, wann gesprochen werden kann, was nie zur Debatte steht), in der Mitte der Verlauf als
Wechselrede, rechts die Folgen als „vorher → nachher“ mit Kassenbalken, Bindungen und Protokoll.

| Bitte | Wirkung | Stand |
|---|---|---|
| Freigabe anheben | eine Stufe mehr für die Saison | Konzept 18.11. |
| Sonderbudget Gehalt | einmalig aus dem Vorbehalt in den Gehaltstopf | Konzept 18.11. |
| Notrücklage anzapfen | ein Viertel des Ziels, −0,25 Vertrauen, keine Zusage nötig | gebaut (Finanzseite) |
| Alles auf eine Karte | 100 %, 5 % Puffer, Ziel zwei Plätze besser, +0,75 / −1,0 | gebaut (Finanzseite) |
| Ziel tauschen | ein Ziel gegen ein anderes desselben Bereichs | **neu** |
| Lieblingsspieler freigeben | Verkauf ohne Vertrauensverlust | **neu** |
| Prämientopf | Betrag aus dem Vorbehalt, zweckgebunden für Prämien | **neu** |

Die Antwort ist fest, ohne Würfel: Zusagen haben Punkte, die Bitte hat einen Bedarf, die Einschätzung steht vor dem
Antrag da („er stimmt zu / macht ein Gegenangebot / lehnt ab“). Höchstens zwei Gespräche je Saison, jeder gestellte
Antrag verbraucht eines, Fragen kostet nie Vertrauen (alles wie am 18.11. entschieden).

### Reiter „Prämien“ (Konzeptidee)

| Spalte | Inhalt |
|---|---|
| Mannschaftsprämien | Siegprämie je Sieg und Einsatz, Prämie fürs Saisonziel (nur bei Erfolg), Sonderprämie für einen Spieltag; je drei Stufen mit Kosten und Wirkung; Regeln |
| Spielerprämien | sortierbare Tabelle: Gesamt, Klasse in Klassenfarbe, Moral als Gesicht mit Zahl, Gehalt groß je Saison und klein je Spieltag, Vertrag bis, Klausel (keine / Einsatz / Leistung ab 4 PP / Treue bei Verlängerung), erwartete Kosten, Wirkung |
| Kosten und Wirkung | Balken „zahlt aus dem Gehaltstopf“, Summe, Moral vorher → nachher, harte Sperre über dem freien Topf |

Leitsatz: **Prämien bewegen die Moral, nie direkt die Leistung.** Die Moral wirkt wie heute über Form und Moral auf
die Eignung. Damit bleibt die Rangtreue der Disziplinen unberührt, und die Matrix wird nicht angefasst.

## 3. Feste Vorgaben, die das Mockup einhält

* Der Vorstand verhängt **keine Geldstrafen** und nimmt nichts weg. Jede Zielkarte zeigt „Verfehlt: −x Vertrauen ·
  kein Geldabzug“; ein erfülltes Ziel bringt Vertrauen und Geld (Entscheidung 18.11.).
* Stufen 100 / 90 / 80 / 70 / 50 % ab Vertrauen 7,5 / 5 / 3 / 1,5; Saison 1 für alle 100 %.
* Gehaltstopf nie unter **75 %**; Pflichtkader 8 nie gesperrt; Verkaufserlöse zu 100 % frei; frei werdendes Gehalt
  zu 100 % zurück in den Gehaltstopf; Gebäude aus dem Transfer-/Investitionstopf.
* „Rücklage anzapfen“ und „Alles auf eine Karte“ mit den Zahlen aus `lib/finance/vorstand-budgetfreigabe.ts`.
* Die Sperre ist hart und für Mensch und KI gleich; Gehälter groß je Saison, klein je Spieltag; Kaderstärke über
  die besten 6; Rang 1 ist der beste; neben keiner Zahl steht eine Notenstufe (das „Rating B“ aus dem Entwurf vom
  18.11. ist raus).
* Mehrspieler: je Team eigene Ziele, eigene Gespräche, eigene Prämien; delegierbar über den Bereich „Käufe,
  Verkäufe, Verträge“.

## 4. Was es im Spiel schon gibt und was neu wäre

| | Echt | Neu oder erfunden |
|---|---|---|
| Vertrauen, Stufen, Quote | `stufeFuerVertrauen`, `resolveVorstandFreigabe`, `VORSTAND_STUFEN`, `GEHALTS_QUOTE_UNTERGRENZE` | die Stände 6,2 / 2,6 / 8,1 und die Ereignisliste (ein Verlauf „was das Vertrauen bewegt hat“ wird heute nicht gespeichert) |
| Töpfe | `berechneVorstandBudgetStand` (Rücklage, Gehaltspuffer 7 Spieltage, Vorbehalt) | alle Beträge; das Mockup rechnet vereinfacht |
| Sonderwege | Anzapfen bis 50 % des Ziels, −0,25 je Viertel; „Alles auf eine Karte“ ab Vertrauen 4, 5 % Puffer | der Notfall-Antrag (Konzept 18.11., nicht gebaut) |
| Ziele | Zielarten und Titel aus `team-season-objectives-service.ts` („Top 6 erreichen“, „Cash-Reserve von …“), `actionHint` als „Hinweis des Vorstands“, nur ein verbindliches Rang-Ziel (`optional`) | Widerspruchs-Prüfung als Regel, Ziel „Vertragslaufzeiten“, Ziel „Lieblingsspieler“, die Laufzeit-Marke, die Beträge für Vertrauen und Prämie |
| Gespräch | Regeln aus dem Konzept vom 18.11. (zwei je Saison, feste Antwort) | **nichts davon ist gebaut.** Die Punkte der Waage sind Startwerte; drei Bitten und eine Zusage sind neu |
| Prämien | Moral, Form/Moral-Wirkung auf die Eignung, PP-Skala (Leistungsprämie ab 4 PP) | **die ganze Seite.** Es gibt heute keine Prämien; alle Beträge und Moralwerte sind erfunden und müssten gemessen werden |
| Liga-Ränge | Kaderstärke über die besten 6 | Ränge für Vertrauen und Gehaltskosten |

**Stolperstein im Bestand:** `TeamSeasonObjectiveRecord` trägt noch ein Feld `penaltyCash`. Nach der festen Vorgabe
„keine Geldstrafen“ darf es beim Bau nicht mehr gebucht oder gezeigt werden.

## 5. Offene Entscheidungen für Chris

1. **Ein Office mit drei Reitern (Vorstand und Ziele, Gespräch, Prämien)?** Sponsor und Kabine aus dem Entwurf vom
   18.11. bleiben als weitere Reiter. Empfehlung: ja.
2. **„Laufzeit-Quoten“: was war gemeint?** (a) Ziele mit eigener Laufzeit über mehrere Saisons, (b) ein Ziel zu den
   Vertragslaufzeiten des Kaders, (c) beides wie im Mockup. Empfehlung: (c).
3. **Lieblingsspieler: wer ist es?** Der Beste der letzten Saison nach PP (Mockup), der mit dem höchsten Charisma,
   oder der Dienstälteste? Und: darf er wechseln, wenn ein anderer ihn überholt? Empfehlung: nach PP, fest für eine
   Saison.
4. **Was kostet der Verkauf des Lieblings?** Mockup: −1,0 Vertrauen, Verlängerung +0,3. Zu hart, zu weich?
5. **Widersprüche: nur bei der Vergabe prüfen, oder darf der Mensch ein Ziel im Gespräch tauschen?** Empfehlung:
   beides, der Tausch verbraucht ein Gespräch.
6. **Prämien grundsätzlich ja?** Wenn ja: zahlen sie aus dem **Gehaltstopf** (Mockup, die Freigabe gilt dann auch
   hier) oder aus einem eigenen kleinen Topf? Empfehlung: Gehaltstopf, kein dritter Topf.
7. **Welche Prämien zuerst?** Vorschlag: Siegprämie und Treueprämie bei Verlängerung; Leistungs- und Einsatzklausel
   in einem zweiten Schritt.
8. **Nutzt die KI Prämien von Anfang an,** oder erst nach einer Messung (32 KI-Teams, Moral, Kasse, Kaderstärke)?
   Empfehlung: erst messen.
9. **Ersetzt das Gespräch die Knöpfe „Rücklage anzapfen“ und „Alles auf eine Karte“ auf der Finanzseite,** oder
   bleiben sie dort zusätzlich? Empfehlung vom 18.11. gilt weiter: das Gespräch ersetzt sie, Umschichten bleibt als
   Schieber.

## 6. Prüfung

Alle acht Zustände in beiden Größen angesehen: kein Seitenscroll, keine Überlappung, kein abgeschnittener Text, drei
Spalten über die volle Breite. Unterwegs behoben: Text über dem Vertrauens-Bogen, zerschossene Prämientabelle
(Klassenname kollidierte mit dem Taktgeber), Überlauf der Budget-Spalte im Zustand „unter Druck“. Die Seite läuft
ohne JavaScript-Fehler. Nicht geprüft: 1710×1112 (MacBook) und Phone.
