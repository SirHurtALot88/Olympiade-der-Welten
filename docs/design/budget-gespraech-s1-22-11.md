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

### Nachtrag 22.11.: Rückmeldung zum Mockup

* **Konzept bestätigt.** Chris wörtlich: „Ansonsten mega gut vom Konzept, das gefällt mir!“
* **Kredite ab Saison 1 frei.** Wörtlich: „geben wir Kredite auch ab S1 frei“. Das Kreditfenster gilt damit schon vor dem
  ersten Draft; das Gespräch hängt ohnehin an derselben Phasenprüfung (`imFenster`, `lib/finance/vorstand-gespraech.ts:122`,
  Aktion `credit_borrow`). Für den Bau: Phasenregel für Saison 1 öffnen, Kredit in beiden Töpfen wie ab Saison 2 behandeln.
* **Mehr Puffer als Messvariante** (Chris' Vorschlag, noch keine Entscheidung): Sockel +20 für Budget-Platz 32, je Platz besser
  +2 (Platz 31 +22, Platz 30 +24 … Platz 1 +82; Chris' Lesart, 22.11. bestätigt). Wird neben der Untergrenze 80 % gemessen, siehe Abschnitt 6.
* **Porträts für den Vorstand.** Wörtlich: „ich find das nice, dass du n Bild im Mockup drin hast für die Trainer, könnten
  wir da auch welche generieren? Also so Portraits? Passend zum Trainertyp? Können auch andere Rassen sein, die wir in der
  Oly haben!“ Stilprobe bestellt, siehe Abschnitt 9.

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

**Vier Läufe nebeneinander** (gleiche Saaten, gleiches Abbruchkriterium), damit die Puffer-Frage mit Zahlen entschieden wird:

| Lauf | Quote in Saison 1 | Startbudgets |
|---|---|---|
| A · Entscheidung pur | nach Vertrauen, 70 % möglich | unverändert |
| B · Untergrenze 80 % | mindestens 80 % in Saison 1 (Frage 1) | unverändert |
| C · Mehr Startgeld (Chris, 22.11.) | nach Vertrauen | +20 C für Budget-Platz 32, je Platz besser +2 C (Platz 1 +82 C) |
| D · beides | mindestens 80 % | wie C |

Zu Lauf C (Chris, 22.11., bestätigt): Sockel +20 C für das Team auf Budget-Platz 32 (kleinstes Startbudget), je Platz
besser 2 C mehr, Platz 1 (größtes Startbudget) also +82 C (Formel `+20 + 2 × (32 − Platz)`). In der Summe 1 632 C mehr in der Liga
(640 C Sockel, 992 C Staffel); der Abstand zwischen reichstem und ärmstem Team **wächst** um 62 C — gewollt, die Messung zeigt,
ob die knappen Teams mit +20 C genug Luft haben. Mitzumessen bei C und D: Σ Kasse zum Start von Saison 2 und 3
(mehr Startgeld darf nicht einfach liegen bleiben), Ablösepreise im Draft und die Bottom-4-Stärke. Kredite sind in allen
vier Läufen ab Saison 1 offen.

## 7. Offene Fragen an Chris

1. **Untergrenze der Quote nur in Saison 1, oder mehr Startgeld?** (Chris, 22.11.: zusätzlich die Variante „Sockel +20, je
   Budget-Platz besser +2“ messen, Abschnitt 6, Läufe B bis D.) Die Hochrechnung sperrt in Saison 1 rund 21 % aller Budgets, vier Teams starten
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

## 9. Vorstands-Porträts: Stilprobe (22.11.)

**Charaktere im Code:** genau drei, `GespraechCharakter = "antreiber" | "kaufmann" | "kassenwart"`
(`lib/finance/vorstand-gespraech.ts:35`), abgeleitet aus Finanzwert und Ambition der Team-Identität (`gespraechCharakter`,
`vorstand-gespraech.ts:114-120`). **Rassen im Bestand** (`data/generated/oly-player-stats.json`, 2 984 Spieler): Human 995,
Demon 343, Construct 334, Elf 213, Animal 204, Divine 162, Alien 132, Orc 109, Aqua 104, Dwarf 101, Lizard 94, Dragon 48,
Tauren 47, Plant 32, Mutant 23, Voidborn 19, Goblin 17, Gnom 5.

**Bestellt:** drei statische Porträts, je Charakter eine andere Rasse. Keine Figur, keine Animation. Endpunkt
`/create-image-pixflux`, 192×224, mit Hintergrund (Vorstandszimmer, Lampenlicht), je ein POST ohne Wiederholung unter
`flock /tmp/pixellab-bestell.lock` (`scripts/pixellab-vorstand-portraets.py`). Schätzung vorher: 3 Generationen.

| Datei (`public/portraits/vorstand/`) | Charakter | Rasse | Akzent | `usage.generations` |
|---|---|---|---|---:|
| `antreiber-orc.png` | Der Antreiber | Orc | rote Krawatte, verschränkte Arme | 1,0 |
| `kaufmann-dwarf.png` | Der Kaufmann | Dwarf | goldene Krawatte, Taschenuhr | 1,0 |
| `kassenwart-construct.png` | Der Kassenwart | Construct | türkise Linsen und Krawatte, Kassenbuch | 1,0 |
| **Summe** | | | | **3,0** |

Guthaben laut `/balance` vorher 306,54, nachher 303,54 (Differenz 3,0, deckt sich mit der Summe). Reserve 150 unberührt.
Alle drei waren beim ersten Versuch brauchbar, nichts wurde wiederholt. Prompts und Saaten: `public/portraits/vorstand/quellen.json`.

**Zum Stil:** Die Spieler-Porträts unter `public/portraits/` sind gemalt (400×400, JPG), PixelLab liefert Pixel-Art. Die
Vorstands-Porträts sind deshalb im 2D-HD-Look der Arenen gehalten und übernehmen von den Spieler-Porträts die dunkle, warm
beleuchtete Bühne. Im Mockup stehen sie nie neben einem Spieler-Porträt; wo beide auf einer Seite landen (Office), bleibt
das Vorstandsbild klein und gerahmt. Ob der Stilbruch zu den gemalten Porträts stört, ist die eine Frage an Chris.

**Im Mockup** (`public/mockups/budget-gespraech-22-11.html`): das Porträt liegt über dem CSS-Gesicht (`portraet()`,
Zuordnung `PORTRAET`). Fehlt die Datei oder lädt sie nicht, bleibt das CSS-Gesicht stehen; `?portraet=aus` zeigt den Rückfall
gezielt. **Angepasst:** das CSS-Gesicht zeigte das Urteil als Miene; ein festes Bild kann das nicht, deshalb trägt jetzt der
Rahmen des Porträts die Urteilsfarbe (grün Zusage, gelb Gegenangebot, rot Ablehnung), dieselbe wie die Sprechblase. Die
Rasse steht klein im Bildfuß.

Geprüft mit Playwright bei 1920×1080: keine JS-Fehler, kein Seitenscroll, Bilder geladen, Rückfall bei blockierter Datei
geprüft; alle Aufnahmen angesehen. Bilder unter `docs/design/budget-gespraech-22-11/`:

| Datei (`-1920` ganze Seite, `-ausschnitt` linke Karte) | Zeigt |
|---|---|
| `portraet-antreiber-orc` | Death Peaches, Gegenangebot, gelber Rahmen |
| `portraet-kaufmann-dwarf` | Cold Steel, Zusage, grüner Rahmen |
| `portraet-kassenwart-construct` | Cash Creators, Gegenangebot |
| `portraet-rueckfall-css` | `?portraet=aus`, das alte CSS-Gesicht |

### Vorschlag für den vollen Satz (nicht bestellt, erst nach Chris' OK)

Ein Bild kostet über `create-image-pixflux` eine Generation; gerechnet wird mit rund 15 % Fehlversuchen (ein Fehlversuch
wird neu formuliert und bewusst neu bestellt, nie automatisch wiederholt).

| Variante | Umfang | Neue Bilder | Kosten (mit Fehlversuchen) |
|---|---|---:|---:|
| A · Kernsatz | 3 Charaktere × 6 Rassen (Human, Demon, Construct, Elf, Orc, Dwarf) | 15 | rund 18 |
| B · ein Vorstand je Team | 32 Teams, Rasse nach Team-Thema, Charakter nach Identität | 29 | rund 34 |
| C · volle Matrix | 3 Charaktere × 18 Rassen | 51 | rund 60 |
| Zusatz · Mienen | je Porträt drei Urteile (Zusage, Gegenangebot, Ablehnung) | ×3 | ×3, dazu Bild-zu-Bild für die Wiedererkennung |

**Empfehlung: B.** 32 feste Gesichter, eines je Verein, wirken wie Personen und nicht wie Typen; der Charakter eines Teams
steht mit der Identität fest, und die Rasse folgt dem Thema des Teams (das die KI-Kaderplanung schon kennt,
`lib/ai/team-theme-composition-service.ts`). A ist der Sparweg (Zuordnung je Team fest aus der Team-ID), C lohnt erst, wenn
Vorstände wechseln können. Die Mienen empfehle ich nicht: dreifache Kosten, und der farbige Rahmen sagt dasselbe. Bei einem
Guthaben von 303,5 und der Reserve 150 sind rund 153 Generationen frei, die sich die Porträts mit den anderen offenen
Bestellungen (Beute-Icons, Arenen) teilen; B passt hinein, C nur knapp.

## 10. Bau und Abgleich (23.11.)

Gebaut nach Chris' „bau das“ (23.11.). PM-Entscheide zu Abschnitt 7: (1) Messlauf A (Entscheidung pur, Quote nach Identitäts-Vertrauen inkl. 70 %), bei gerissenem Abbruchkriterium
Variante B (Untergrenze 80 % nur in Saison 1); die Startbudget-Staffel (+20/+2, #1703) ist schon auf main, A enthält also das Geld aus Lauf C. (2) Saison 1: der Draft wartet
auf alle Menschen, die selbst verhandeln; ab Saison 2 wartet das Fenster nicht (Abwesende bekommen den Vorschlag, nachverhandelbar bis zum ersten Kauf). (3) Eigener
Delegationsbereich „Vorstand“, Halbautomatik = KI. (4) Das Budget-Gespräch zählt nicht als eines der zwei Gespräche je Saison.

**Code:** `lib/resolve/wirtschafts-regeln.ts` (Stempel `toepfeS1`, `toepfeAbSaison1`; Schalter `OLY_TOEPFE_AB_SAISON_1=aus`, wirkt nur auf neue Saisons) ·
`lib/finance/vorstand-budgetfreigabe.ts` (Saison-1-Zweig weg, `gedeckelt` ab Saison 1, Faktor 0,5 für Rücklage und Gehaltspuffer im Topf, Startvertrauen
`startVertrauenAusIdentitaet`, `S1_QUOTE_UNTERGRENZE`) · `lib/board/team-season-objectives-service.ts` (Start nicht mehr neutral 5) ·
`lib/finance/vorstand-budget-gespraech.ts` (geführter Antrag, Urteil, Stempel `seasonState.budgetVereinbarung`, KI-Wahl, Tor, Tisch) · `lib/finance/vorstand-gespraech.ts` (Werte
„Rücklage voll“ 1/3/5, „Ziel senken“ 16/10/6, „Stufe tiefer“ 4) · `lib/ai/organic-squad/draft-adapter.ts` (`spielraumS1` und der Saison-1-KI-Puffer entfallen; `SAISON_EINS_RUECKLAGE_FAKTOR`
bleibt nur für Altstände ohne Stempel) · `lib/foundation/team-delegation.ts` (Bereich `vorstand`) · `app/api/finance/vorstand/route.ts` (`budget_unterschreiben`) ·
`app/api/draft/route.ts` (409 `budget_vereinbarung_fehlt`, solange ein Mensch nicht unterschrieben hat) · UI `app/foundation/office/BudgetGespraech.tsx` + `budget-gespraech.css`
(Office-Reiter „Budget“ und Tor vor dem Draft in `FoundationShellRouterBody.tsx`). Neues Spiel: ab Saison 1; laufender Spielstand: erst ab dem nächsten Saisonwechsel (Altstempel ohne `toepfeS1` = „alt“).
Wirkung über die vorhandenen Felder in `seasonState.vorstandBudget` (neu: `stufenSenkung`, `ruecklageVoll`, `zielTief`), gezeigt = gebucht. Tests: `tests/budget-gespraech-23-11.test.ts`.

**Abweichungen vom Konzept (ehrlich):** „Bescheiden“ bucht ein zusätzliches, leichteres Rang-Ziel (+0,3/−0,4, wirkt wie „Vertrauen einsetzen“ erst bei der nächsten Festlegung), das Vorstandsziel gilt weiter.
Vor dem ersten Pick gibt es keine Kaderstärke, das Rang-Ziel kommt deshalb aus dem Rang des Startbudgets in der Liga minus `1 + Ambition/3` (`schaetzeStartZielRang`); nach dem Draft gilt das echte Ziel.
Die neuen Bitten/Zusagen sind eigene Typen im Budget-Modul, die Office-Typen `VorstandBitteArt`/`VorstandZusageArt` blieben unverändert. Kreditfenster ab Saison 1 war schon durch die Phasenregel (`isEarlySeasonSetup`) offen.
In Saison 1 sperrt die Untergrenze 80 % auch „Bescheiden“ bei Quote 80 %.

### Messung (Abschnitt 6, `scripts/miss-teamfinanzen-saison.ts`, 32 KI-Teams, Battle, Wegwerf-SQLite)

Nicht erreicht: drei Saisons. Die Läufe wurden unter hoher Last (Load 13–18, drei Agenten) nach Saison 2 abgebrochen; gemessen sind Saison 1 (nach dem Draft = Saisonstart) und Saison 2 (nach der KI-Kaufphase). Saat 1 = Standard, Saat 2 = `--mischen 7`. Referenz main (Konzept Abschnitt 1): Bottom-4 37,4, Kader Median 13 (S1) → 11 (S2), Σ Kasse zum Start S2 587 bzw. 1158 C, drei Teams mit 9 bis 10 Spielern. Kein eigener Lauf gegen main.

| Lauf | Kader S1 Median / min / Teams unter 10 | Bottom-4 S1 | Σ Kasse S1-Start | Kader S2 Median / Teams unter 10 | Bottom-4 S2 | Σ Kasse S2-Start | „Alles“ / angezapft S2 | Sperre Kauf (Teams) S2 |
|---|---|---:|---:|---|---:|---:|---|---|
| A · Saat 1 (Quote 70 % möglich) | 12 / 8 / 9 | 37,1 | 2 560 | 12 / 7 | 39,7 | 1 604 | 2 / 2 | 4 (3) |
| B · Saat 1 (Untergrenze 80 %) | 12 / 8 / 10 | 37,6 | 2 511 | 12 / 6 | 40,4 | 1 622 | 2 / 4 | 6 (4) |
| B · Saat 2 | 12 / 8 / 7 | 37,3 | 2 535 | 12 / 6 | 39,1 | 1 511 | 4 / 3 | 12 (7) |

**Abbruchkriterium** (S1-Kader Median < 12, ein Team < 10, Bottom-4 < 37,4): Lauf A reißt es (Bottom-4 37,1; Teams mit 8 bis 9 Spielern; Median 12 knapp gehalten). Daraufhin B (Untergrenze 80 % in Saison 1): Bottom-4 37,6 (Saat 1) und
37,3 (Saat 2), Median 12, aber weiter 10 bzw. 7 Teams unter 10 Spielern (Minimum 8 = Pflichtkader). **Das Kriterium „kein Team unter 10“ hält auch B nicht**; main selbst hat laut Konzept drei solche Teams. Der Sprung S1 → S2 ist
weg: Kader-Median S1 und S2 gleich (12), Σ Kasse zum S2-Start 1 511 bis 1 622 C (main 1 158 C), Teams über dem Topf: keine Überziehung gemessen, weil die harte Sperre greift (Zähler „Sperre Kauf“ = abgelehnte Prüfungen, nicht Überziehungen).
Offene Entscheidung für Chris/PM: zusätzliche Hebel gegen die schmalen Kader (Untergrenze 90 % in Saison 1, oder Sockel +20/+2 verstärken) oder das Kriterium „unter 10“ für Saison 1 lockern.

### Abgleich Mockup | App (1920×1080 und 2560×1440, Bilder `docs/design/budget-gespraech-23-11/`)

Paare: `mockup-*` gegen `app-*` (`1-lage`, `2-verhandeln`, `2-gegenangebot`, `3-vereinbarung`, `3-unterschrieben`; dazu `app-2-zusage-ehrgeizig`, `app-2-alles`). Aufnahme mit `scripts/screenshot-budget-gespraech.ts`
(Wegwerf-SQLite, Dev-Server Port 3267, Team des Dev-Nutzers `user_local`, deviceScaleFactor 1). Kein Seitenscroll, kein Überlauf in Karten (automatisch geprüft je Aufnahme). Das App-Team ist ein Team aus dem Mittelfeld der Startbudgets, das Mockup zeigt Death Peaches, Zahlen weichen daher ab.

| Mockup-Merkmal | Stand |
|---|---|
| Hero mit Wappen, Titel, drei Schritt-Reitern mit Ergebnis | drin (Office-`BcHero`/`BcReiter`; Wertnotiz entfällt, Platz) |
| „Draft beginnt, sobald alle unterschrieben haben“ rechts | drin im Draft-Tor (zeigt, auf wen gewartet wird); im Office stattdessen „Zum Office“ |
| Linke Karte: Vorstands-Porträt, Charakter, Vertrauen/Finanzwert/Ambition | drin (PixelLab-Porträts aus #1695, Rahmenfarbe nach Urteil; kein CSS-Gesicht nötig) |
| Sprechblase mit Urteil, „Gegenangebot annehmen“ | drin |
| Waage Gewicht gegen Preis mit Posten, Vertrauens-Folgen, Regeltext | drin, Zahlen aus `beurteileBudgetWahl` |
| Schritt 1: Leiter Vertrauen → Freigabe, Transfertopf-Rechnung, Gehaltstopf-Rechnung, Saisonziel | drin, Zahlen aus dem echten Topf |
| Schritt 2: Ambition, Rücklage, Sonderantrag, Aufteilung mit Schieber | drin; „Bescheiden“ in Saison 1 bei Quote 80 % gesperrt (angepasst: Untergrenze) |
| Schritt 3: beide Töpfe groß, Klauseln, Stempel „Vereinbart“, „Gezeigt = gebucht“ | drin |
| Rechts: Entwurf, Balken, Kader-Ausblick, Vergleich mit dem Vorschlag | drin; Kader-Ausblick mit Marktpreisen (Median des freien Marktes) statt Beispielpreisen (angepasst) |
| Am Tisch: Chris, Franky, Ramona mit Status | angepasst: zeigt die tatsächlich menschlichen Teams des Spielstands (im Testspiel eines); keine Zahlen der anderen |
| Mockup-Leiste (Beispielteams), Schiene | fehlt bewusst: gehört nicht zur UI |
| Zielrang „6 von 16“ als Beispiel | angepasst: Rang aus Startbudget-Schätzung vor dem Draft, danach echtes Ziel |
