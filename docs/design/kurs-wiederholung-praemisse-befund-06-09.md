# Keine Kurs-Wiederholung pro Saison — Befund statt Umsetzung (06.09.)

**Auftrag:** Garantieren, dass die zweite Austragung von Takeshi's Castle in einer Saison einen
anderen der drei Kurse (Nordhof/Sumpfpfad/Die Mauern, `BAHN_ART["takeshis-castle"].kurse` in
`public/mockups/battle-mode.engine.js`) zieht als die erste — deterministisch aus Save/Saison/
Spieltag, ohne die Kurswahl von der Saat zu entkoppeln.

**Ergebnis dieser Runde: keine Umsetzung.** Beim Reinlesen (Schritt 1 des Auftrags: „verstehe
zuerst genau, wie die Saison-Schicht weiß, dass Takeshi's Castle 2x in einer Saison vorkommt, und
an welchen zwei Matchdays das passiert") zeigt sich: **das passiert nirgends.** Nicht „noch nicht
gebaut", sondern strukturell ausgeschlossen — und zwar aus zwei unabhängigen Gründen, jeder für
sich hinreichend. Ein Mechanismus gegen ein Ereignis zu bauen, das nie eintritt, hätte nichts
bewiesen und nichts für Chris verändert. Das ist genau der Fall, für den der Auftrag selbst um eine
Doku statt einer blinden Lösung bittet.

---

## Befund 1: Keine Disziplin kommt in einer Saison zweimal vor

`lib/season/season-discipline-schedule.ts`, `buildSeededDisciplinePairs()`: die Funktion mischt
den **gesamten** Disziplin-Pool (`shuffleSeeded`) und zieht dann mit `available.shift()` **ohne
Zurücklegen** je zwei Disziplinen pro Spieltag, für `requiredMatchdays = ceil(Disziplinen.length /
2)` Spieltage. Mit den 20 offiziellen Disziplinen (`lib/data/dataAdapter.ts`, vier Kategorien à
genau fünf) ergibt das `ceil(20/2) = 10` Spieltage à 2 Disziplinen = **exakt 20 Slots für exakt 20
Disziplinen — jede genau einmal, nie zweimal.** Läuft der Pool vorzeitig leer, wird NICHT
wiederholt, sondern eine Warnung geschrieben (`season_schedule_discipline_pool_exhausted`) und der
Slot bleibt leer. Es gibt in diesem Code keinen Pfad, der eine Disziplin zweimal in dieselbe Saison
einträgt.

Nachgemessen, nicht nur gelesen — `scripts/pruefe-disziplin-wiederholung-je-saison.ts` (neu, dieser
Befund):

```
Disziplinen: 20, benoetigte Spieltage: 10
  season-1: Takeshi-Vorkommen = 1, Disziplinen gesamt gebucht = 20
  season-2: Takeshi-Vorkommen = 1, Disziplinen gesamt gebucht = 20
  season-3: Takeshi-Vorkommen = 1, Disziplinen gesamt gebucht = 20

Ueber 200 simulierte Saisons (20 Disziplinen, 10 Spieltage):
  maximale Vorkommen EINER Disziplin in EINER Saison: 1
  Saisons mit mindestens einer Wiederholung: 0 von 200
```

200 verschiedene Saison-Seeds, null Wiederholungen — nicht selten, sondern **unmöglich** unter
diesem Algorithmus. Das gilt für alle 20 Disziplinen gleichermaßen, nicht nur für Takeshi's Castle.

**Reibung mit CLAUDE.md:** Chris' Zitat vom 02.09. „wir haben ja pro season dann nur 2x Hockey"
steht im Abschnitt zur rho-Methodik (Einzelspiel- vs. Saison-Rangtreue) und wurde dort offenbar als
Aussage über die Spielhäufigkeit gelesen. Ob damit eine künftige/andere Saison-Struktur gemeint war
(zwei Halbrunden, doppelter Durchlauf der 10 Spieltage) oder die Aussage sich auf etwas anderes
bezog (z. B. wie oft Hockey über mehrere Saisons hinweg in der Praxis drankommt) — das lässt sich
aus dem Code nicht auflösen und ist eine Chris-Frage, keine technische.

## Befund 2: Die drei Kurse existieren nur im Mess-Motor, nicht im gespielten Spiel

Selbst wenn Befund 1 nicht gälte: die Kurswahl in `bauSpurt()` ist heute an **keinem** Produktions-
Aufrufer angeschlossen.

- `spieleDisziplin(dId, saat, opt)` — die einzige Funktion im Motor, die für eine beliebige
  Disziplin `M.bau(saat)` aufruft — wird ausschließlich aus Mess-Skripten aufgerufen
  (`scripts/miss-gewichtheben-archetypen.mjs`, `bahnSerie()` intern im Motor mit den synthetischen
  Saaten `1337+i*7919`). Kein Treffer in `lib/` oder `app/`.
- Der einzige Produktions-Bridge zum Motor ist `lib/battle/arena-headless-runner.ts` (Playwright,
  lädt den echten Browser-Motor) — er legt ausschließlich `spieleFeldspiel`, `spieleBuehneHeben`,
  `spieleBuehneDuell`, `spieleBuehneAuftritt` frei. Kein `spieleSpurt`/`spieleBahn`/„Bahn"-Äquivalent
  existiert.
- Das reale Saison-Ergebnis einer Disziplin wie Takeshi's Castle kommt serverseitig NICHT aus dem
  Motor, sondern aus einer eigenständigen TypeScript-Formel
  (`lib/foundation/discipline-stage/discipline-stage-data.ts:buildDisciplineStageModel`, Rating −
  Fatigue + Form) bzw. aus dem gebuchten Ergebnis
  (`lib/foundation/discipline-stage/discipline-stage-from-booked-result.ts`). Beide kennen kein
  „Kurs"-Feld.
- Die echte, im Spiel sichtbare Bühne für Takeshi's Castle ist eine **native** React-Komponente
  (`app/foundation/discipline-stage/arena/disciplines/takeshi.tsx`, Primitive `parcours`) — sie
  referenziert `BAHN_ART`, `kurse`, „Nordhof"/„Sumpfpfad"/„Die Mauern" **nirgends**. Sie zeichnet
  einen einzigen, festen „Serpentinen-Kurs".
- `app/dev-arena/page.tsx`, wo `takeshis-castle` mit einer manuellen Seed-Zahl durchgeklickt werden
  kann, trägt den Kommentar „Kein Teil des Spiels; nur für Screenshots/Playwright".

Die drei benannten Kurse aus #813 sind damit heute ausschließlich ein **Mess-Artefakt** der
rho-Abnahme-Sonden (`miss-alle-disziplinen.mjs`, `bahnSerie`) — kein Chris jemals sichtbarer
Spielzustand. `docs/pm-briefings/pm-gesamtstand-2026-09-06.md` Abschnitt 5/6 bestätigt das
unabhängig: von 20 Disziplinen sind heute nur drei „im Spiel" (Basketball/Football/Hockey über den
Playwright-Bridge); Bahn- und Bühnen-Disziplinen — Takeshi's Castle eingeschlossen — sind zwar
„bestanden" (über der rho-Schranke gemessen), aber noch nicht produktiv verdrahtet
(„Produktivierungswelle" ist dort offener Schritt 3, noch nicht Schritt 1 dieses Auftrags).

## Warum das die Prämisse des Auftrags kippt, nicht nur seine Reihenfolge

Das ursprüngliche PM-Briefing (Abschnitt 5, Folgeauftrag C) hatte den Auftrag nur wegen der
fehlenden Kurse als „heute nicht baubar, aber nach #813 baubar" eingestuft — das war zu optimistisch,
weil es die Frage „gibt es überhaupt einen Aufrufer, der eine Saat mit Matchday-Kontext an `bauSpurt`
übergibt" nicht bis zum Ende verfolgt hat. Es gibt ihn nicht — und selbst wenn es ihn gäbe, gibt es
keine Saison, in der er zweimal für dieselbe Disziplin aufgerufen würde. Ein Mechanismus, der beides
umginge, hätte gegen eine erfundene Schnittstelle gearbeitet: die Form des künftigen Aufrufs (ob
Ansatz a: Saison-Schicht bestimmt den Kurs explizit, oder Ansatz b: Saat + Vorkommen-Nummer) ist
erst dann sinnvoll festlegbar, wenn klar ist, *woher* diese Saat für eine echte Season-Race überhaupt
kommen soll — das entscheidet sich erst in der Produktivierungswelle (Schritt 3 des PM-Briefings),
nicht vorher.

---

## Optionen für Chris

**Option A — Zurückstellen (empfohlen).** Nichts bauen, bis zwei Voraussetzungen erfüllt sind: (1)
Takeshi's Castle (und die anderen Bahn-Disziplinen) sind über einen echten Produktions-Aufrufer an
den Motor angeschlossen (PM-Briefing Schritt 3, „Produktivierungswelle"), UND (2) eine
Saison-Struktur existiert, in der eine Disziplin nachweislich zweimal vorkommt (erfordert eine
Chris-Entscheidung zur Saison-Länge/-Struktur — siehe Reibung mit CLAUDE.md oben). Erst dann lässt
sich der Mechanismus gegen echte Aufrufer entwerfen UND an echten Saisons/Messungen beweisen, statt
gegen eine angenommene Schnittstelle. Aufwand jetzt: null. Risiko: null.

**Option B — Inerte Vorarbeit jetzt.** `SeasonDisciplineScheduleEntry`/`SeasonDisciplineScheduleSlot`
um ein rein informatives, aus dem bestehenden Schedule ableitbares Feld `occurrenceInSeason`
(1-basiert, gezählt über `matchdayIndex`-Reihenfolge) ergänzen — kostenlos und deterministisch, weil
die Saison-Schicht die volle Spielplan-Sicht schon hat. Mit den heutigen 20 Disziplinen ist der Wert
IMMER 1 (Befund 1), ändert also nichts am gemessenen rho und an keiner bestehenden Ausgabe. Zusätzlich
im Motor einen rein optionalen Parameter an `bauSpurt`/`spieleDisziplin` vorsehen („vermeide Kurs X"),
der ohne Wert exakt das heutige Verhalten behält (bestehende Mess-Skripte bleiben ziffernidentisch).
Nutzen: wenn die Produktivierungswelle kommt, ist die Schedule-Seite schon vorbereitet. Risiko: die
konkrete Form könnte trotzdem nicht zum späteren echten Aufrufer-Vertrag passen, weil der noch nicht
feststeht — die Vorarbeit wäre dann Ballast statt Ersparnis.

**Option C — Eng auf die Mess-Sonde begrenzen.** Nur `bahnSerie()`/die Mess-Skripte selbst (die
heute schon 24 aufeinanderfolgende Saaten `1337+i*7919` durch `bauSpurt` schicken) um eine
„nie zweimal hintereinander derselbe Kurs"-Regel erweitern — der bereits geplante Kursmischer
(`docs/design/takeshi-kursmischer-nachweis-06-09.mjs`) liefert P(gleich) ≈ 1/3, aber keine Garantie.
Das wäre ehrlich messbar und risikofrei (nur Mess-Code), trifft aber nicht Chris' eigentliche Bitte:
es betrifft nie eine echte, von ihm gespielte Saison, sondern nur die Statistik-Ausgabe der Sonde.

**Empfehlung:** Option A. Die Zusatz-Arbeit aus Option B lässt sich risikofrei nachholen, sobald
Schritt 3 des PM-Briefings (Produktivierungswelle) den echten Aufrufer-Vertrag festlegt — vorher
geraten sowohl die Datenform als auch der Motor-Vertrag zur Wette auf eine Schnittstelle, die noch
niemand gebaut hat.

---

## Was in dieser Runde sonst nicht angefasst wurde

Keine Zeile in `public/mockups/battle-mode.engine.js`, `lib/season/season-discipline-schedule.ts`
oder einer der 19 anderen Disziplinen geändert. `node scripts/miss-alle-disziplinen.mjs 24` wurde
bewusst NICHT erneut gefahren — es gibt keine Code-Änderung, gegen die zu messen wäre; der zuletzt
dokumentierte Stand (Takeshi's Castle 0,861 nach #813) bleibt die gültige Referenz. Einzige neue
Datei: `scripts/pruefe-disziplin-wiederholung-je-saison.ts` (Einmal-Sonde, s. Befund 1 oben) — sie
bleibt als Beleg im Repo, ist aber kein Teil der regulären Test-Suite.
