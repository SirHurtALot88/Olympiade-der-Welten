# Scouting-Ausbau — Konzept (Fable, 11.11.)

Auftrag Chris (10.11.), wörtlich:

> erweiter bitte das Scouting, dass dort endlos viele Spieler für ein team gespeichert werden
> dürfen, es wird aber weiterhin dann nur die obersten X der liste gescoutet bis die vollständig
> gescoutet sind. Füge da auch noch eine % anzeige hinzu damit man abschätzen kann wie gut
> gescoutet der spieler ist mit so nem kreis a la FM27 bzw da ist ja immer eine Note von 1+ bis 6
> umrahmt mit einer Scout Empfehlung […] wenn man drauf klickt kommt ein kleiner bericht vom Scout
> warum er denkt, dass der Spieler gut ist oder gut ins Team passt, oder eben auch nicht. Sowohl
> aus Skill sicht, fit, Füllt lücken, ergänzt gut, günstig, teuer usw. Vergleich mit anderen
> Spielern wo er sich einrankend wie beim Transfermarkt in Pow Spe Men Soc etc. lass fable das mal
> erarbeiten und bring das mit rein

**Zur Entstehung:** Die Fable-Rolle lief in dieser Runde nicht als eigener Unteragent — der
ausführenden Sitzung stand kein Werkzeug zum Abspalten eines Unteragenten zur Verfügung. Die
Konzeptrunde wurde deshalb in derselben Sitzung VOR dem Bau als eigener Schritt gefahren, mit der
Code-Erkundung unten als Grundlage. Die offenen Fragen in Abschnitt 6 sind ehrlich offen.

## 0. Was es schon gab (Code-Erkundung)

| Baustein | Stand vor dem Ausbau |
|---|---|
| `lib/scouting/scouting-wishlist-slots.ts` | `getScoutingWishlistSlotsForLevel` (6 + 4 je Bürostufe) begrenzte die GANZE Wunschliste; `canAddPlayerToTransferWishlist` lehnte bei voller Liste ab („Wishlist voll"). `priorityRank` als Reihenfolge war schon da. |
| `getActiveScoutingWishlistEntries` | schnitt nach Priorität die obersten X ab — auch dann, wenn die schon fertig gescoutet waren. Ein fertiger Spieler auf Platz 1 hielt seinen Slot für immer. |
| `facility-scout-pipeline-service.ts` | Pipeline ersetzt bei jedem Refresh alle Intel-Records durch die aktuelle Belegung. Fällt ein Spieler aus der Belegung, ist sein Fortschritt weg. |
| `ScoutingPriorityQueue.tsx` | Drag-&-Drop-Warteschlange, Trennlinie „Über Slot-Limit — nur gemerkt". Die Trennung aktiv/wartend war also visuell schon angelegt. |
| `ScoutingReportPanel.tsx` / `scouting-report-service.ts` | ausführlicher Report (CA/PO, Top-6-Impact, Disziplinen, Traits, Markt) — aber nur Zahlen, kein **Urteil** und kein **Warum**. |
| Transfermarkt (`TransfermarktV2NewLook.tsx`) | Einordnung je Achse: `computeCandidateAxisTeamRankEstimates` + `formatTeamRankEstimateLabel` („Rang #3/12", unsicher „ca. #2–5/12"), `VeloAxisRail` mit Team-Top-6-Ø als Marke. Das ist das Vorbild für den Attribut-Vergleich. |
| `NlGauge` | 240°-Bogen — kein geschlossener Ring, für den FM-Look ungeeignet. |

## 1. Entscheidung: Note ist eine EIGENE Skala — das Urteil des Scouts, nicht ein drittes Sternemaß

Die CA/PO-Sterne (`potentialScoreToStars`, `NlAbilityStars`) beantworten „wie gut ist der Spieler
absolut". Die Scout-Note beantwortet etwas anderes: **„wie sehr empfiehlt dein Scout diesen Spieler
für DEIN Team, zu DIESEM Preis"**. Ein 4-Sterne-Spieler kann für ein Team, das auf seiner Achse
schon sechs Stärkere hat und der zu teuer ist, eine 4 bekommen — und ein 2,5-Sterne-Spieler, der
genau die SOC-Lücke schließt und günstig ist, eine 2+. Das ist gewollt und genau der FM-Gedanke
(die FM-Scoutnote ist auch kein Ability-Wert, sondern eine Empfehlung).

Damit gibt es bewusst zwei Skalen, die sich nicht widersprechen können, weil sie Verschiedenes
messen. Sterne = Fähigkeit (absolut, app-weit gleich). Note = Empfehlung (relativ zum eigenen Kader).

**Notenskala:** deutsche Schulnoten 1+ bis 6, niedriger ist besser. 16 Stufen
(1+, 1, 1−, 2+, … 5−, 6), gleichmäßig auf einen Empfehlungswert 0–100 gelegt (6 Punkte je Stufe,
1+ ab 92, unter 8 eine 6).

| Note | Empfehlung | Ton |
|---|---|---|
| 1+ … 1− | **Sofort holen** | grün |
| 2+ … 2− | **Klare Empfehlung** | grün-hell |
| 3+ … 3− | **Solide Option** | neutral |
| 4+ … 4− | **Nur als Ergänzung** | gelb |
| 5+ … 6 | **Finger weg** | rot |

## 2. Der Bewertungskreis (FM27-Ring)

```
     ╭──────╮        Ring: geschlossener Kreis, Füllung = Scouting-% (Uhrzeigersinn ab 12 Uhr)
    │  2+   │       Mitte: Note groß
    │ 64 %  │       darunter klein: Scouting-%
     ╰──────╯
  Klare Empfehlung   Label unter dem Ring, eingefärbt im Ton der Note
```

- **Ring-Füllung = Scouting-%**, nicht die Note. Fortschritt und Urteil sind zwei Größen; FM
  trennt sie genauso (Kreis = Kenntnis, Mitte = Bewertung).
- **Scouting-%** = effektive Enthüllungssicherheit (`getEffectiveRevealConfidence`, das Maximum
  aus aktivem Scouting und Auto-Reveal) relativ zur Schwelle „voll gescoutet" der aktuellen
  Bürostufe (`getFullRevealCertaintyThreshold`). 100 % heißt also genau dasselbe wie
  „Vollständig gescoutet" in der Warteschlange — eine Quelle für eine Größe.
- **Ringfarbe = Ton der Note**, nicht des Fortschritts. Bei unbekannter Note grau.
- **Nebel:** unter 25 % zeigt der Kreis „?" und „Noch kein Urteil" — der Scout hat den Spieler
  kaum gesehen. 25–59 %: Notenspanne aus zwei ganzen Noten („2–3"). 60–99 %: ganze Note mit „≈"
  („≈2"). Erst bei 100 % die genaue Note mit Plus/Minus („2+"). Die Richtung der Spanne ist je
  Spieler deterministisch (Hash der Spieler-ID), damit nichts flackert. Das Empfehlungs-Label folgt
  der Mitte der Spanne.
- Größen: `sm` (36 px, Warteschlangenzeile), `md` (64 px, Report-Kopf).
- Der Kreis ist ein **Button**: Klick öffnet den Scout-Bericht. Tastatur-bedienbar, `aria-label`
  trägt Note, Empfehlung und Prozent im Klartext.

## 3. Der Scout-Bericht

Aufbau von oben nach unten — erst das Urteil, dann die Begründung, dann die Zahlen:

1. **Kopf:** Kreis (md), Empfehlung, ein Satz Fazit in der Stimme des Scouts
   („Ich würde ihn holen — er schließt unsere SOC-Lücke und ist günstig.").
2. **Begründungen** als Zeilen mit Ton-Punkt (grün/neutral/rot), in dieser Reihenfolge und
   Gewichtung für den Empfehlungswert:

   | # | Kriterium | Gewicht | Frage | Quelle |
   |---|---|---:|---|---|
   | 1 | **Skill** | 35 | Wie gut ist er — im eigenen Kader und absolut? | Rang je Achse im Kader (`computeCandidateAxisTeamRankEstimates`), bester Achswert |
   | 2 | **Lücke** | 20 | Schließt er die schwächste Achse des Kaders / fehlt dem Kader Personal? | Top-6-Ø je Achse vorher/nachher, Kader unter Minimum |
   | 3 | **Ergänzung** | 15 | Passt sein Profil zum Kader oder doppelt er nur, was schon da ist? | Top-6-Gesamtschnitt-Delta, stärkste Achse vs. Kaderstärken |
   | 4 | **Fit** | 10 | Passen Rasse/Unterklassen/Gesinnung/Traits zum Team? | `calculateTransfermarktFit` (dieselbe Zahl wie die Fit-Kachel im Markt) |
   | 5 | **Preis** | 20 | Günstig oder teuer für das, was er kann? | Marktwert gegen den Median vergleichbar starker Spieler (Ø-Achswert ±4) |
   | — | **Potenzial** | Hinweis | Ist da noch Luft nach oben? | `playerPotential.potentialBand`, erst ab 50 % Scouting, fließt NICHT in die Note |

   Skill vorne, weil Chris' Sorge sonst „eine Hülpe" ist; Lücke und Preis gleich auf, weil beides
   die typische Kaufentscheidung trägt; Fit mit kleinem Gewicht, weil er im Spiel nur Moral/Harmonie
   bewegt. Potenzial bewusst ohne Gewicht: es ist (je nach Stufe) verschleiert, und eine Note, die
   sich beim Weiterscouten wegen eines Nebelwerts dreht, wäre unfair.

3. **Einordnung POW/SPE/MEN/SOC** — exakt das Transfermarkt-Muster: je Achse Wert, Meter mit
   Team-Top-6-Ø als Marke (`VeloAxisRail`), daneben „Rang #3/12" bzw. „ca. #2–5/12" unter Nebel
   (`formatTeamRankEstimateLabel`). Unter 25 % keine Werte, nur „noch nicht gesehen".

Im Nebel spricht der Scout vorsichtig: unter 25 % sind Skill/Lücke/Ergänzung „Noch zu wenig
gesehen" (neutral, ohne Gewicht), bis 99 % stehen die Sätze mit „Erster Eindruck:" davor. Preis und
Fit beruhen auf Basisinfos (Marktwert, Rasse, Klasse), die im Markt immer sichtbar sind — die
spricht der Scout von Anfang an aus.

**Wo der Bericht aufgeht:** Klick auf den Kreis in einer Warteschlangenzeile klappt den Bericht
direkt unter der Zeile auf (kein Seitenwechsel, „kleiner Bericht"). Im Reiter „Scouting Report"
steht derselbe Bericht als erste Karte über den bisherigen Zahlen-Karten. Eine Komponente, zwei
Orte.

## 4. Unbegrenzte Liste, begrenzte aktive Queue

- `canAddPlayerToTransferWishlist` lehnt nie mehr ab. Die Liste ist unbegrenzt, in allen Phasen.
- **Aktiv** gescoutet werden die obersten X Einträge, die **noch nicht voll gescoutet** sind
  (X = `getScoutingWishlistSlotsForLevel(Bürostufe)`, im Draft 15). Ein fertiger Spieler gibt
  seinen Slot frei, der nächste rückt automatisch nach. Das ist der Satz „bis die vollständig
  gescoutet sind".
- **Fortschritt bleibt erhalten:** Wer aus der aktiven Queue fällt (fertig, oder vom Spieler nach
  unten sortiert), behält seinen Intel-Record als *geparkt* (`parked: true`). Geparkte Records
  ticken nicht, belegen keinen Slot und zählen nicht in „belegt" — aber ihr Prozentwert bleibt
  stehen. Ohne das würde ein fertiger Spieler beim nächsten Refresh auf 0 fallen und sofort wieder
  in die Queue rutschen (Pendeln).
- Manuelle Beobachtungen (Scouting-Hub) zählen nur gegen die **aktiven** Wunschlisten-Plätze,
  nicht gegen die ganze Liste — sonst würde eine lange Merkliste sie aussperren.
- `trimTransferWishlistToSlotLimit` (Kappung Draft → Saison) entfällt: Es gibt nichts mehr zu kappen.

**UI-Trennung** in der Warteschlange, drei Gruppen in Prioritätsreihenfolge, eine sortierbare Liste:

- **Wird gescoutet** (aktiv, X Plätze, Fokus auf Platz 1 hervorgehoben),
- **Fertig gescoutet** (Kreis voll, kaufbereit — belegen keinen Slot mehr),
- **Wartet** (unter der Trennlinie „Wartet auf freien Scout-Slot", gedimmt).

Die Gruppen ergeben sich aus der Reihenfolge, nicht aus einer zweiten Liste — wer einen Wartenden
nach oben zieht, verdrängt den untersten Aktiven. Der Kopf zeigt „N gemerkt · A von X Slots aktiv".
Im Transfermarkt verschwindet die „Wishlist voll"-Sperre; stattdessen der Hinweis „wartet auf
Scout-Slot", wenn die aktiven Plätze voll sind.

## 5. Abgrenzung

- Keine neuen Figuren/Animationen, nur ein SVG-Ring.
- Kein Eingriff in Eignungsmatrix, Spielmechanik oder KI-Kauflogik — das Urteil ist reine Anzeige.
- Die KI-Teams benutzen keine Wunschliste; die Entkopplung betrifft nur menschliche Teams.

## 6. Offene Fragen an Chris

1. **Gewichte** (Skill 35 / Lücke 20 / Preis 20 / Ergänzung 15 / Fit 10) sind eine erste Setzung.
   Wenn dir die Noten zu streng oder zu milde vorkommen, ist das die Stellschraube
   (`SCOUT_VERDICT_WEIGHTS` in `lib/scouting/scout-verdict-service.ts`).
2. **Potenzial in die Note?** Bisher nur Hinweiszeile. Für junge Spieler könnte man es ab 100 %
   Scouting mit einrechnen.
3. **Draft:** die aktive Queue hat im Draft 15 Plätze (die frühere Listen-Grenze). Soll im Draft
   alles gleichzeitig gescoutet werden?
4. **Cash:** der Preis wird gegen den Markt bewertet, nicht gegen dein Konto. Übersteigt der
   Marktwert dein aktuelles Cash, sagt der Scout es in der Preis-Zeile dazu — die Note ändert das
   bewusst nicht (Cash schwankt über die Saison, die Empfehlung soll stabil bleiben). Passt das so?
5. **Bauphasen-Schalter:** `DEBUG_FORCE_PLAYER_VISIBILITY` (Standard AN) hebt den Nebel im
   Scouting-Report auf. Das Urteil folgt dem: solange der Schalter an ist, zeigt der Kreis die
   genaue Note schon bei 0 %. Der Ring selbst zeigt immer den ECHTEN Scouting-Fortschritt.

## 7. Umsetzung (Stand 11.11.)

| Teil | Datei |
|---|---|
| Lesende Scouting-Zustände inkl. Scouting-% (Blatt-Modul, kein Importkreis) | `lib/scouting/scouting-reveal-state.ts` |
| Unbegrenzte Liste, aktive Queue (`getScoutingWishlistQueue`, `splitScoutingWishlistQueue`) | `lib/scouting/scouting-wishlist-slots.ts` |
| Geparkte Records (Fortschritt bleibt, kein Slot, kein Tick) | `lib/scouting/facility-scout-pipeline-service.ts`, Feld `PlayerScoutIntelRecord.parked` |
| Scout-Urteil (Note, Empfehlung, Kriterien, Achsen-Einordnung) | `lib/scouting/scout-verdict-service.ts` |
| Bewertungskreis | `app/foundation/scouting-center-v2/ScoutGradeRing.tsx` |
| Scout-Bericht | `app/foundation/scouting-center-v2/ScoutVerdictReport.tsx` (Warteschlange aufklappbar + Reiter „Scouting Report") |
| Transfermarkt: keine „Wishlist voll"-Sperre mehr, Status „Fertig gescoutet" / „Wartet auf Scout-Slot" | `app/foundation/transfermarkt-v2/*` |
| Tests | `tests/scouting-unbegrenzte-wunschliste.test.ts`, `tests/scout-verdict-service.test.tsx` |
