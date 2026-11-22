# Budget-Gespräch mit dem Vorstand — zwei Töpfe ab Saison 1 (22.11.)

Konzept und Mockup, kein App-Code. Mockup: `public/mockups/budget-gespraech-22-11.html`, Bilder: `docs/design/budget-gespraech-22-11/`.

Chris, 22.11., wörtlich: „würde es ggf. helfen wenn wir das budget von gehalt und transfers schon in S1 einführen? dann ist es
direkt korrekt limitiert — dann könnte man wenn man in den draft geht oder bevor es ans einkaufen geht ein screen kommen wo man
als menschlicher spieler erstmal die budgets mit dem vorstand verhandelt“.

## 0. Entscheidung von Chris (22.11.) — nicht mehr offen

Wörtlich: **„ja S1 auch mit Vertrauen aus Identität, nicht 100 %“.**

* **Ab Saison 1 gelten beide Töpfe** (Transfer-/Investitionstopf und Gehaltstopf) **und die Vorstands-Quote nach Vertrauen**:
  ab 7,5 → 100 %, ab 5 → 90 %, unter 5 → 80 %, unter 3 → 70 %, unter 1,5 → 50 % (`VORSTAND_STUFEN`,
  `lib/finance/vorstand-budgetfreigabe.ts:53-60`, unverändert).
* **Das Startvertrauen in Saison 1 ist das Vertrauen aus der Team-Identität:** `TeamIdentity.boardConfidence`
  (`lib/data/olyDataTypes.ts:758`), normiert auf 1 bis 10 wie in `normalizeBoardConfidence`
  (`lib/board/team-season-objectives-service.ts:182-186`). Das ist genau der Wert, den die Quote-Vorausschau der KI heute schon
  als „Blatt-Vertrauen“ einsetzt: `schaetzeFreigabeNaechsteSaison(..., { vertrauen: input.identity?.boardConfidence })`
  (Branch `claude/review-fixes-wirtschaft-ki-22-11`, `lib/ai/organic-squad/draft-adapter.ts:645-655`, Funktion in
  `lib/finance/vorstand-budgetfreigabe.ts:367`). Keine neue Formel, kein Würfel.
* Damit ersetzt diese Entscheidung zwei frühere: „Quote in Saison 1 = 100 % für alle“ (Finanzkonzept Budgets, Abschnitt 12,
  Punkt 1) und den einheitlichen neutralen Start 5,0 in Saison 1 (`team-season-objectives-service.ts:2489-2492`, Kommentar
  „S1-for-all: uniform neutral start“).

So verteilen sich die 32 Teams mit ihrem Identitäts-Vertrauen (`data/generated/ki-kaufverhalten-stammdaten-18-11.json`):

| Freigabe | Teams | Beispiele (Vertrauen) |
|---|---:|---|
| 100 % | 5 | C-S 9,0 · D-L 8,5 · M-S 8,5 · V-W 8,3 · U-A 8,0 |
| 90 % | 12 | B-P 7,4 · G-G 7,3 · **D-P 5,7** · H-R 5,5 |
| 80 % | 11 | L-R 4,7 · W-L 4,6 · C-C 3,8 · M-M 3,0 |
| 70 % | 4 | N-N 2,9 · T-T 2,4 · Z-H 2,3 · A-A 1,7 |
| 50 % | 0 | — |

## 1. Bewertung

### Was „zwei Töpfe ab Saison 1“ löst

1. **Eine Regel von Anfang an.** Heute ist Saison 1 ein Sonderfall an drei Stellen (`resolveVorstandFreigabe` gibt für Saison 1
   pauschal 100 % zurück, `vorstand-budgetfreigabe.ts:96-98`; `gedeckelt` gilt erst ab Saison 2, `:391`; das Gespräch gibt es
   erst „ab Saison 2“, `vorstand-gespraech.ts:11`). Fallen diese Zweige weg, rechnen Planer, Sperre und Anzeige in jeder Saison
   gleich.
2. **Kein Sprung von Saison 1 auf Saison 2.** Gemessen (Review-Fixes Runde 2): Σ Kasse zum Saisonstart ist mit echter Quote
   doppelt so hoch (1158 gegen 587 C), die Kader fallen von Median 13 (S1) auf 11 (S2). Der Bruch entsteht, weil die Teams in
   Saison 1 ohne Grenze einkaufen und in Saison 2 plötzlich mit. Mit Töpfen ab Saison 1 ist der Kader von Anfang an so groß,
   wie ihn die Regel trägt.
3. **`spielraumS1` entfällt.** Der Notbehelf lässt die KI im Draft `(1 − erwartete Quote) × 0,5 × Kasse` liegen, damit sie auf
   Saison 2 vorbereitet ist. Er kostet in Saison 1 Stärke (Bottom-4 37,4 gegen 39,8) und drei Teams mit 9 bis 10 Spielern, ohne
   dass eine Regel das verlangt. Steht die Quote schon in Saison 1 im Topf, braucht niemand eine Vorausschau: was der Topf
   freigibt, darf ausgegeben werden, der Rest ist gesperrt.
4. **Gehalt ist korrekt limitiert.** In Saison 1 gibt es heute keinen Gehaltstopf; ein Team kann sich im Draft Verträge holen,
   die der Topf in Saison 2 nicht mehr trägt (7 von 32 Teams hatten in der Messung vom 18.11. den Gehaltstopf als Engpass).
   Mit Gehaltstopf ab dem ersten Pick passiert das nicht.
5. **Der Mensch versteht die Grenze, bevor er kauft.** Das Gespräch zeigt die Zahlen, die danach hart gelten.

### Was es kostet

Hochrechnung, keine Messung: dieselbe Topfformel wie `berechneVorstandBudgetStand`, auf die Stammdaten aller 32 Teams
angewendet, Zielgehalt 13 × 6,5 C, Sponsor = Anker aus den Stammdaten.

| Größe | heute (Saison 1) | Töpfe ab S1, Rücklage halb | Töpfe ab S1, Rücklage voll |
|---|---:|---:|---:|
| In Saison 1 gesperrt, Summe aller Teams | rund 7 % der Budgets (Kasse nach Draft, Median 18,2 C) | **1690 C = 21 %** | 2228 C = 28 % |
| Freier Anteil der Kasse, Median | 93 % | 80 % | 73 % |
| Teams, deren Transfertopf für 8 Spieler zu 20,8 C nicht reicht | 0 | 10 | 14 |

* **In Saison 1 bleibt etwa dreimal so viel Geld liegen wie heute.** Das ist gewollt (dafür ist die Quote da), aber es heißt:
  die Kader der Saison 1 werden schmaler oder billiger als heute. Am härtesten trifft es Teams mit **niedrigem Vertrauen und
  hohem Finanzwert** (C-C: 215 C, 80 %, Finanzwert 9,7 → 151 C frei = 70 %; T-T: 260 C, 70 %, Finanzwert 8,9 → 162 C = 62 %)
  und die kleinen Budgets (A-A: 175 C, 70 % → 112 C).
* Der **Pflichtkader 8 bleibt quotenfrei** (`VORSTAND_PFLICHT_KADER`, Kaderpflicht-Freigabe): kein Team bleibt unter 8. Die
  zehn Teams der letzten Zeile kommen auf 8, aber nur mit billigeren Spielern oder über die Kaderpflicht, nicht mit acht
  Durchschnittspicks.
* Die Zahl 20,8 C ist der gemessene Draft-Durchschnitt; billigere Ergänzungsspieler gibt es. Wie stark die Kaderstärke
  wirklich sinkt, zeigt nur ein Messlauf (Abschnitt 6).

### Die Regel „Draft-Rücklage in Saison 1 halb so hoch“ — Empfehlung: bleibt, wandert aber in den Topf

Die Regel wurde am 18.11. eingeführt, damit der Draft mehr Spielraum hat, solange in Saison 1 nichts sonst zurückhält. Mit
der Quote hält jetzt zusätzlich die Quote zurück. Die Halbierung ist damit **nötiger als vorher**, nicht überflüssig: ohne sie
wären 28 % statt 21 % der Budgets gesperrt und 14 statt 10 Teams am Pflichtkader-Preis.

Empfehlung:

1. **Halbierung bleibt in Saison 1**, für Rücklage **und** Gehaltspuffer (wie in Abschnitt 13 des Budget-Konzepts schon
   festgelegt). Wichtig: Rücklage + Puffer ergeben zusammen `max(Rücklage, 0,35 × Gehaltstopf)`; nur die Rücklage zu halbieren
   bewirkt bei den meisten Teams nichts.
2. **Sie wirkt im Topf, nicht mehr als eigener KI-Puffer.** Heute zieht der Draft-Adapter die halbe Rücklage als eigenen
   Kassenpuffer ab (`SAISON_EINS_RUECKLAGE_FAKTOR`, `lib/ai/organic-squad/draft-adapter.ts:547`). Ab jetzt steckt sie im
   Transfertopf (`Kasse − Rücklage − Gehaltspuffer`, dann × Quote), und die KI hält sie nicht ein zweites Mal — dieselbe Lehre
   wie am 18.11. für Saison 2 („doppelt gezählt kostete −6 % Kaderstärke“).
3. Im Gespräch ist die halbe Rücklage die Stufe **„normal“**; „vorsichtig“ hält die volle, „mutig“ zapft sie an (Abschnitt 3).

### Klare Empfehlung

**Ja, bauen.** Zwei Töpfe und Quote ab Saison 1 mit Vertrauen aus der Identität (entschieden), das Budget-Gespräch als
Einstieg vor dem Draft, `spielraumS1` und die drei Saison-1-Sonderzweige raus, halbe Rücklage in Saison 1 bleibt und zieht in
den Topf. Vor dem Scharfschalten ein Messlauf mit Abbruchkriterium (Abschnitt 6), weil Saison 1 spürbar knapper wird.

## 2. Das Gespräch

### Wann

* **Saison 1: vor dem Draft**, als Pflichttermin. Der Draft beginnt, sobald alle Menschen unterschrieben haben.
* **Ab Saison 2: jedes Jahr vor dem Transferfenster**, nach der Saisonabrechnung (dann steht das neue Vertrauen fest).
* Später im Jahr gibt es weiter die zwei Gespräche des Office (`GESPRAECHE_JE_SAISON = 2`) zum Nachverhandeln.

### Wer

* **Nur Menschen sehen den Bildschirm, jeder Manager für sein Team** (bis zu drei: Chris, Franky, Ramona). Aktives Team aus
  `activeManagerTeamId`, Besitz über `canOwnerManageTeam`; geschrieben wird hinter `authorizeServerRoomWrite`. Jeder sieht nur
  die eigene Vereinbarung; von den anderen nur den Status (verhandelt / unterschrieben), keine Zahlen.
* **Delegierbar:** neuer Bereich „Vorstand“ in `TeamControlSettings.delegation` (oder am Bereich Transfers mitgeführt, siehe
  Frage 3). Ist er delegiert (Ramona, Halbautomatik) oder das Team Voll KI, führt die KI das Gespräch nach der Regel aus
  Abschnitt 5 und es ist sofort unterschrieben. „Mensch überschreibt, KI respektiert“: solange noch nichts gekauft ist, kann
  der Mensch die KI-Vereinbarung öffnen und neu verhandeln.
* **Niemand wartet auf einen Abwesenden.** Unterschreibt ein Mensch nicht, gilt der Vorschlag des Vorstands (das ist die
  Vereinbarung ohne jede Bitte). Wann das greift: Frage 2.

### Ablauf in drei Schritten

| Schritt | Was der Mensch sieht | Was er tut |
|---|---|---|
| 1 Lage | Vertrauen → Freigabe-Stufe, Herleitung beider Töpfe, Saisonziel, Charakter des Vorstands | „Vorschlag annehmen“ (springt zu 3) oder „Verhandeln“ |
| 2 Verhandeln | drei Hebel und ein Sonderantrag, die Antwort des Vorstands links ändert sich bei jedem Klick | Hebel stellen, gegebenenfalls Gegenangebot annehmen |
| 3 Vereinbarung | beide Töpfe groß, Klauseln, Folgen fürs Vertrauen | unterschreiben → gestempelt → zum Draft |

Wer nichts ändern will, braucht zwei Klicks. Es gibt keine Runden, kein Feilschen um Einzelbeträge und keinen Zufall.

### Die Hebel

| Hebel | Stufen | Wirkung | Rechnet als |
|---|---|---|---|
| **Ambition** | Bescheiden (Ziel 2 Plätze tiefer) · Ziel des Vorstands · Ehrgeizig (1 Platz besser) | Freigabe eine Stufe tiefer · wie vorgeschlagen · eine Stufe höher. Vertrauen bei Erfolg/Verfehlen: +0,3/−0,4 · +0,5/−0,4 · +0,5/−0,9 | Ehrgeizig = Zusage „Höheres Saisonziel“ + Bitte „Freigabe anheben“ (beides gibt es schon). Bescheiden = neue Bitte „Ziel senken“ |
| **Rücklage** | Vorsichtig (volle Rücklage) · Normal (Regel: in S1 halb, ab S2 voll) · Mutig (zur Hälfte anzapfen) | +0,2 Vertrauen · nichts · −0,5 Vertrauen (0,25 je angefangenem Viertel) | Vorsichtig = neue Zusage; Mutig = Bitte „Notrücklage anzapfen“ (gibt es schon, höchstens 50 %) |
| **Aufteilung** | Schieber Transfer ↔ Gehalt | 1 C Transfer = 1 C Jahresgehalt, Grenze 25/20/17,5/15/10 % des Gehaltstopfs je Quote; Richtung Transfer höchstens die halbe Rücklage + Puffer | `umschichtung` (gibt es schon), kostet nichts |
| **Sonderantrag** | „Alles auf eine Karte“ | beide Töpfe 100 %, nur 5 % Puffer, Ziel zwei Plätze besser, +0,75/−1,0; erst ab Vertrauen 4 | Bitte „alles“ (gibt es schon); ersetzt Ambition und Rücklage |

Die Rücklage bleibt **weich** (sie bestimmt, wie viel der Topf zurückhält; Unterschreiten kostet Vertrauen), die Freigabe
bleibt **hart**. Es gibt **keine Geldstrafe** und **keinen Gehaltsdeckel als Regel** — der „Gehaltsdeckel“ ist nur eine
freiwillige Zusage des Menschen für diese Saison (kein Umschichten ins Gehalt), wie im Office-Gespräch.

### Wie der Vorstand antwortet

Dieselbe Regel wie im Office-Gespräch (`beurteileGespraech`, `lib/finance/vorstand-gespraech.ts:257`), nur geführt:

```
Gewicht = Vertrauen × 2 + Wert der Zusagen (je Charakter)
Preis   = Summe der Bitten
Gewicht ≥ Preis                → Zusage
Lücke ≤ 10 und Zusagen decken  → Gegenangebot („ich stimme zu mit: …“)
sonst                          → Ablehnung (mit der fehlenden Punktzahl)
```

* **Charakter aus der Identität:** Sparneigung = Finanzwert − max(0, Ambition − 5); unter 3,5 Antreiber, unter 7 Kaufmann,
  sonst Kassenwart (`gespraechCharakter`, `vorstand-gespraech.ts:114`).
* **Vorhandene Zahlen:** Zusage „Höheres Ziel“ 8/5/2 (Antreiber/Kaufmann/Kassenwart), „Gehaltsdeckel“ 2/4/6, „Vertrauen
  einsetzen“ 3; Bitte „Freigabe anheben“ 14, „Anzapfen“ 5 je Viertel × 0,8/1/1,6, „Alles auf eine Karte“ 20.
* **Neu, Startwerte zum Messen:** Zusage „Rücklage voll halten“ 1/3/5, Bitte „Ziel senken“ 16/10/6 (dafür zählt die tiefere
  Freigabe als Zusage 4).
* Die Rechnung steht offen neben dem Vorstand (Balken Gewicht gegen Preis, jede Zeile mit Punkten). Die Miene des Vorstands
  folgt dem Urteil.

Beispiele aus dem Mockup:

| Team (Vertrauen, Charakter, Basis) | Antrag | Antwort |
|---|---|---|
| Death Peaches (5,7 · Antreiber · 90 %) | Ehrgeizig | Zusage: 19,4 gegen 14 → 100 %, Transfertopf 203 → 225 C |
| Death Peaches | Ehrgeizig + Mutig | Gegenangebot: es fehlen 2,6 → mit „Vertrauen einsetzen“ |
| Death Peaches | Alles auf eine Karte | Ablehnung: es fehlen 8,6, Zusagen decken das nicht |
| Cash Creators (3,8 · Kassenwart · 80 %) | Ehrgeizig | Gegenangebot: es fehlen 4,5 → mit Gehaltsdeckel → 90 % |
| Cold Steel (9,0 · Kaufmann · 100 %) | Alles auf eine Karte | Gegenangebot: es fehlen 2 → mit Gehaltsdeckel |

## 3. Die Vereinbarung im Spielstand

Je Team und Saison ein Stempel, gesetzt beim Unterschreiben (Mensch), sofort (KI/delegiert) oder beim Fristablauf (Vorschlag):

```ts
seasonState.budgetVereinbarung[teamId] = {
  seasonId, gefuehrtVon: "mensch" | "ki" | "vorschlag", ownerId, zeit,
  vertrauenStart, quoteBasis, quote,            // z. B. 5,7 / 0,9 / 1,0
  ambition: "tief" | "ziel" | "hoch" | "alles", zielRang,
  ruecklageStufe: "vorsichtig" | "normal" | "mutig",
  umschichtung, zusagen: [...],
  transferTopf, gehaltsTopf,                     // die gezeigten Zahlen, zum Nachprüfen
}
```

* **Keine zweite Wahrheit:** Die Wirkung läuft über die vorhandenen Felder in `seasonState.vorstandBudget[teamId]`
  (`stufenAnhebung`, `umschichtung`, `ruecklageAngezapft`, `alleAufEineKarte`) und die Zielliste. `berechneVorstandBudgetStand`
  und damit `kaufRahmen` liefern danach genau die Zahlen des Blatts — **gezeigt = gebucht**, für Planer, Draft, Kaufsperre,
  Gebäude und Verlängerungen, für Mensch und KI gleich. Neu im Zustand sind nur „Freigabe eine Stufe tiefer“ und „Rücklage voll“.
* Der Stempel selbst ist das Protokoll: die Finanzseite (Reiter Budgets) und das Office zeigen „vereinbart am …, geführt von …“.
* Die Regel „Töpfe ab Saison 1“ steht als Stempel in `seasonState.wirtschaftsRegeln` (Muster `lib/resolve/wirtschafts-regeln.ts`):
  neue Spiele ab Saison 1, laufende Spielstände rechnen wie gestempelt. Kein Wechsel mitten in der Saison.

## 4. Auswirkung auf die KI

Die KI führt dasselbe Gespräch ohne Bildschirm, mit denselben Funktionen und derselben Antwortregel. Ihr Antrag kommt aus dem
Charakter, den `entscheideKiVorstandMassnahmen` schon nutzt (Risikobereitschaft unter 4 vorsichtig, über 7 aggressiv):

| KI-Charakter | Ambition | Rücklage | Aufteilung |
|---|---|---|---|
| vorsichtig | Ziel des Vorstands | vorsichtig | 0 |
| normal | Ziel des Vorstands | normal | halbe Grenze in den Topf, der zuerst bindet |
| aggressiv, Ambition ≥ 7 | ehrgeizig | normal; mutig nur unter Soll-Kader | volle Grenze in den Topf, der zuerst bindet |

* „Alles auf eine Karte“ wie bisher: aggressiv, Ambition ≥ 7, Vertrauen ≥ 5, Erwartungsrang ≤ 4, oder wenn der Vorstand es fordert.
* Kommt ein Gegenangebot, nimmt die KI es an, wenn es nur „Vertrauen einsetzen“ kostet; sonst fällt sie auf den Vorschlag zurück.
  Eine Ablehnung heißt immer: Vorschlag gilt.
* **`spielraumS1` entfällt ersatzlos**, ebenso der eigene Saison-1-Kassenpuffer des Draft-Adapters. Der Planer liest
  `kaufRahmen` wie ab Saison 2: `feeCap = investition.frei`, `salaryCap = gehalt.frei`, Budget je Platz aus der Quote.
* `schaetzeFreigabeNaechsteSaison` bleibt als Vorausschau für die Anzeige („voraussichtliche Freigabe nächste Saison“).
* Messläufe bleiben bei 32 KI-Teams von Anfang an.

## 5. Was der Bau anfassen muss (für den späteren Auftrag)

| Stelle | Änderung |
|---|---|
| `vorstand-budgetfreigabe.ts:96-98`, `:391`, `:394` | Saison-1-Zweig weg; `gedeckelt` ab Saison 1; Saison-1-Faktor 0,5 für Rücklage und Gehaltspuffer im Topf |
| `team-season-objectives-service.ts:2489-2492` | Start in Saison 1 = Identitäts-Vertrauen statt neutral 5 |
| `vorstand-gespraech.ts` | „ab Saison 2“ weg; Budget-Gespräch als geführter Antrag (mehrere Bitten/Zusagen in einem Urteil); neue Bitte „Ziel senken“, neue Zusage „Rücklage voll“ |
| `organic-squad/draft-adapter.ts` | `spielraumS1` und `SAISON_EINS_RUECKLAGE_FAKTOR` als eigener Puffer raus |
| Draft-Seite, Phasenablauf | Tor „Vereinbarung fehlt“ vor dem Draft (S1) bzw. vor dem Fenster (ab S2), Status der Mitspieler |
| Delegation | Bereich „Vorstand“ |
| Stempel | `budgetVereinbarung`, Regel in `wirtschaftsRegeln` |

## 6. Messung vor dem Scharfschalten

`scripts/miss-teamfinanzen-saison.ts`, 32 KI-Teams, 3 Saisons, gegen den Stand mit `spielraumS1`. **Abbruchkriterium:**
Kader zum Start von Saison 1 Median unter 12 oder ein Team unter 10, oder Bottom-4-Stärke in Saison 1 unter 37,4 (heutiger
Wert mit `spielraumS1`). Erwartet wird im Gegenzug: Kader S2/S3 nicht mehr unter S1, Σ Kasse zum Saisonstart flacher,
keine Teams über dem Topf. Reißt das Kriterium, ist der erste Hebel Frage 1.

## 7. Offene Fragen an Chris

1. **Untergrenze der Quote nur in Saison 1?** Die Hochrechnung sperrt in Saison 1 rund 21 % aller Budgets, vier Teams starten
   mit 70 %. *Empfehlung:* erst messen; nur wenn das Abbruchkriterium reißt, in Saison 1 mindestens 80 % (die Stufe 70 % gäbe
   es dann erst ab Saison 2). Die Halbierung der Rücklage bleibt in jedem Fall.
2. **Wartet der Draft auf alle Menschen?** *Empfehlung:* in Saison 1 ja (einmaliger Termin, der Draft braucht ohnehin alle);
   ab Saison 2 nein — beim Fensterstart gilt für Abwesende der Vorschlag des Vorstands, nachverhandelbar bis zum ersten Kauf.
3. **Eigener Delegations-Bereich „Vorstand“ oder Teil von „Käufe/Verkäufe/Verträge“?** *Empfehlung:* eigener Bereich. Ramona
   kauft selbst, soll aber nicht verhandeln müssen; bei „Halbautomatik“ steht er auf KI.
4. **Zählt das Budget-Gespräch als eines der zwei Gespräche je Saison?** *Empfehlung:* nein, es ist der Pflichttermin; die
   zwei Gespräche bleiben zum Nachverhandeln im Lauf der Saison.

## 8. Mockup und Bilder

`public/mockups/budget-gespraech-22-11.html` — reines HTML/CSS/JS, Vorstand als SVG (0 PixelLab-Generationen), Stil und
Tokens wie `finanzen-modern-18-11.html` (`--haus`, `--zahl`, Schiene, Hero-Kopf, Karten). Die Seite hängt an `rem` und skaliert
mit Breite und Höhe: 16:9 füllt exakt, 16:10 bekommt Luft in der Höhe. Klickbar: Schritte, Ambition, Rücklage, Sonderantrag,
Schieber, Gegenangebot annehmen, Unterschreiben; oben in der Mockup-Leiste drei Beispielteams (90 %, 80 %, 100 %).

**Echt:** Teamnamen, Wappen, Startbudget, Vertrauen, Finanzwert und Ambition der drei Teams, Sponsor-Anker (gerundet), alle
Regeln und Konstanten. **Beispiel:** Gehalt 6,5 C je Spieler, Ablösen (8 Stammplätze je 20,8 C, Ergänzung je 10 C),
Erwartungsrang, die Mitspieler am Tisch, die neuen Punktwerte aus Abschnitt 2.

Geprüft mit Playwright bei 1920×1080, 2560×1440 und 1710×1112: keine JS-Fehler, kein Seitenscroll, kein Überlauf in Karten
(automatische Prüfung je Aufnahme), alle Bilder angesehen. Korrigiert in der Schleife: abgeschnittene Reitertitel, leere
Flächen in den Karten (Zeilen füllen jetzt die Höhe), „−0,0 C“, Zeilenumbruch in „Vorsichtig“, Hinweis auf den Pflichtkader,
wenn der Ausblick unter 8 liegt.

| Datei (je `-1920`, `-2560`, `-1710`) | Zeigt |
|---|---|
| `1-lage` | Schritt 1, Death Peaches, 90 % |
| `2-verhandeln` | Schritt 2, Vorschlag unverändert (Zusage) |
| `2-gegenangebot` | Ehrgeizig + Mutig, Gegenangebot |
| `2-ablehnung` | Alles auf eine Karte, abgelehnt |
| `2-kassenwart-80` | Cash Creators, 80 %, Kassenwart, Gegenangebot Gehaltsdeckel |
| `3-vereinbarung` | Ehrgeizig, 5 C in den Transfer verschoben, gestempelt |
| `3-kaufmann-alles` | Cold Steel, Alles auf eine Karte mit Gehaltsdeckel, vor der Unterschrift |
