# KI-Merkliste fremder Spieler (21.11.)

Chris, 21.11.: „ja, KI soll eine Merkliste fremder Spieler bekommen“. Damit entsteht die Postfach-Meldung „Interesse an einem Spieler“.

## Ableitung (keine neue Heuristik)

`lib/ai/ki-merkliste.ts` bewertet für jedes KI-Team alle Spieler, die einem **anderen** Team gehören, mit der Funktion, nach der die KI beim Kauf wählt:
`buyUtility(spieler, zustand)` aus `lib/ai/organic-squad/utility.ts`. Der Zustand kommt aus demselben Planrahmen wie beim echten Kauf
(`buildOrganicDraftFrame`: Kader, Bedarf je Disziplin, Kasse, Forecast, Identität, GM-Gewichte, Vorstands-Topf), ohne Zufalls-Saatgut.
Ein Spieler kommt auf die Liste, wenn
1. `buyUtility` größer ist als `stopUtility` desselben Zustands („lieber nichts tun“ verliert), und
2. das Team ihn zahlen könnte (Ablöse höchstens Kasse und höchstens freier Investitionstopf des Vorstands).

Je Team höchstens `KI_MERKLISTE_MAX` = 6, absteigend nach Vorsprung (Gleichstand nach `playerId`). Stufe nach Vorsprung relativ zum besten Kandidaten des
Teams: ab 0,85 Wunschziel (3), ab 0,65 interessiert (2), sonst beobachtet (1). Grund: die Disziplin mit dem größten Bedarf-mal-Wert des Spielers
(Bedarf aus `computeDisciplineNeeds`) und wie viele solide Spieler (> 60) das Team dort schon hat.
Nur Teams mit `controlMode === "ai"` führen eine Liste.

## Speicherort und Zeitpunkt

`seasonState.kiMerkliste[teamId]` (Typ `KiMerklisteEintrag`) und `seasonState.kiMerklisteStand`. Neu gerechnet beim Spieltagsabschluss
(`matchday-progress-service.ts`, nach dem Fortschreiben von Form und Moral, vor dem Einfrieren am Saisonende); `seit` bleibt, solange der
Spieler auf der Liste steht. Scheitert die Rechnung, bleibt die alte Liste, der Abschluss läuft weiter. Abschalten: `OLY_KI_MERKLISTE=0`.
Leseseite ohne Kaderplanung: `lib/ai/ki-merkliste-lesen.ts` (für Postfach und Drawer).

## Wirkung auf Käufe: keine

Die KI kauft ausschließlich aus dem Pool freier Spieler (`executeLocalTransfermarktBuy` mit `fromTeamId: null`); es gibt keinen Kaufweg von Team zu Team.
Ein Merkliste-Spieler lässt sich über die bestehenden Kauf- und Angebotswege deshalb nicht ansprechen, und es gibt keinen sauberen Anknüpfungspunkt, ohne
einen neuen Transferweg zu erfinden. Das Kaufverhalten bleibt unverändert; Wertungs-Fingerabdruck `GESAMT eaafed96150e` unverändert.
Die Meldung sagt das ehrlich: „Ein Hinweis, kein Angebot“.

## Meldung und Drawer

`buildKiInteresseMeldungen` (`lib/foundation/inbox-neue-meldungen.ts`): je Spieler und KI-Team eine Info-Meldung an den Besitzer-Manager
(über das Team, `controlMode` manual; nie hart ein Name), höchstens 5 je Team. Die Stufe steckt in der Kennung: dieselbe Meldung über alle Spieltage,
bei höherer Stufe eine neue (ungelesen). Sie steht in „Im Blick behalten“, hält den Spieltag nie auf, Absender „Markt & Scouting“. Der Text nennt Team, Stufe,
seit wann und den Disziplin-Bedarf des KI-Teams, keine Werte (Scouting-Nebel). Im Kurzprofil eines eigenen Spielers steht eine Zeile „Auf der Merkliste von …“.

## Messung (Kopie des live-save-Abbilds, Spielstand `new-game-1795114260527-nzr0z9`, Saison 1, Spieltag 12)

`scripts/miss-ki-merkliste.ts`: 31 KI-Teams, 834 ms gesamt (27 ms je Team, so viel kommt zum Spieltagsabschluss hinzu), deterministisch.
Längen je Team: 17 Teams voll (6), eines mit 2, 13 mit 0 (nichts bezahlbar oder nichts besser als „nichts tun“). Stufen 1/2/3: 19/33/52.
In dieser Lage steht kein Spieler des menschlichen Teams (Death Peaches) auf einer Liste; für die Aufnahmen rechnet
`scripts/ki-merkliste-aufbau.ts` mit `IB_REICH=1` die Liste einmal mit Kasse x10 (nur in der Kopie), dann erscheinen drei Meldungen.
Nicht gemessen: Stabilität der Liste über mehrere echte Spieltage (die Fortschreibung des Abbilds wäre ein eigener Lauf).

## Abgleich mit dem Mockup

Aufnahmen `docs/design/ki-merkliste-21-11/app-0{1,2}-*-{1920x1080,2560x1440}.png`. Kein Seitenscroll, keine Überlappung. Die Meldung folgt dem Karten- und Briefstil der
übrigen Info-Meldungen (Absender, Titel, Text, Link „Spieler ansehen“). Das Mockup hatte „Interesse an Jorund“ ohne Datenquelle, jetzt aus echter Bewertung. Das Kurzprofil-Band ist nicht aufgenommen.

## Runde 2 (21.11.): Markt und fremde Teams, kein Listen-Limit, Scouting als einzige Grenze, ein Speicher

Chris, 21.11., wörtlich: „KI Teams können auch Spieler vom Transfermarkt UND anderen Spielern auf die Liste setzen und wir hatten das Limit ja aufgehoben, nur das Scouting, wie viele parallel aufgedeckt werden von ihren Stats, ist limitiert.“ Die Abschnitte oben beschreiben Runde 1 (höchstens 6, nur fremde Teams, eigener Speicher); wo sie dem Folgenden widersprechen, gilt Runde 2.

**Befund vorab.** KI-Teams hatten schon denselben Scouting-Speicher wie Menschen: `scoutIntelByTeamId[teamId]` wird für alle Teams von `refreshScoutPipelineForAllTeams` / `advanceScoutIntelTick` geführt, die Plätze kommen aus `getScoutingWishlistQueue` (Wunschliste `seasonState.transferWishlist`, oberste X nicht fertige Einträge, X = `getScoutingWishlistSlotLimit` = 6 + 4 je Stufe des Scouting-Büros, im Draft 15). Die KI hatte nur nie Wunschlisten-Einträge. In der Messung stehen alle 32 Teams auf Scouting-Büro 0 (6 Plätze, Aufdeck-Tempo 0 — so ist es beim Menschen auch).

**Was sich ändert.**
1. **Kandidaten:** alle Spieler, die nicht zum eigenen Kader gehören — freie Spieler des Marktes (kein Kader-Eintrag) und Spieler anderer Teams. Ableitung unverändert (`buyUtility` > `stopUtility`, bezahlbar); `besitzerTeamId` ist bei Marktspielern `null`.
2. **Kein Listen-Limit.** `KI_MERKLISTE_MAX = 6` ist weg. Nur eine technische Obergrenze `KI_MERKLISTE_TECHNIK_MAX = 400` je Team schützt den Speicher (`lib/ai/ki-merkliste-lesen.ts`); abgeschnitten wird von unten (kleinster Vorsprung, Stufe 1). In der Messung erreichen 5 von 31 Teams die 400.
3. **Ein Speicher, dieselben Funktionen wie der Mensch.** `aktualisiereKiMerkliste` schreibt die Liste als Einträge in `seasonState.transferWishlist` (`teamId` = KI-Team, Zusatz `ki: KiWunschMeta` mit Stufe, Vorsprung, Disziplin, abgedeckt, seit, stand, Besitzer), `priorityRank` = Stufe absteigend, dann Vorsprung (Wunschziel zuerst), nach etwaigen Handeinträgen des Teams (die gehen vor und werden nie überschrieben). Danach ruft sie `refreshScoutPipeline` je KI-Team auf — der Weg, den auch `addScoutingWatchlistEntry` und `syncWishlistToScoutingWatchlist` für den Menschen nehmen. Die Scouting-Begrenzung ist damit nicht nachgebaut, sondern dieselbe Queue (`getScoutingWishlistQueue`: aktiv / fertig / wartend).
4. **`seasonState.kiMerkliste` ist nur noch Lese-Hülle.** `kiMerklisteFuerTeam` und `kiInteresseAnSpieler` lesen zuerst die Wunschliste (`ki`-Einträge) und fallen für Teams ohne solche Einträge auf das alte Feld zurück; die erste Neuberechnung übernimmt `seit` und entfernt das Feld. Spielstände aus Runde 1 laden unverändert (Test „alte kiMerkliste“).
5. **Postfach und Kurzprofil:** unverändert in Verhalten. Die Meldung „Interesse an …“ entsteht nur für Spieler im Kader eines menschlichen Teams (Marktspieler erzeugen keine), höchstens 5 je Team, ohne Doppelmeldung, Stufe in der Kennung.

**Was der Mensch davon nicht sieht.** Die Wunschliste des Menschen filtert `ki`-Einträge heraus (`use-foundation-cross-tab-market-filters.ts`, beide Lesestellen), und Hinzufügen/Entfernen in `use-foundation-shell-router-body-scope.tsx` lässt `ki`-Einträge anderer Teams stehen (vorher trafen diese Filter nach `playerId` alle Teams — bei drei Menschen ohnehin ein Risiko, mit 32 KI-Teams ein Fehler).

**Kaufverhalten: unverändert, und das muss man dafür erzwingen.** Der gemeinsame Speicher würde sonst zwei bestehende Kaufbonus-Quellen berühren (`ai-market-plan-apply-service.ts`, `getDiversityAdjustedBuyScore`): +5 für Spieler auf Watch-/Wunschliste des Teams und `Scouting-Sicherheit / 20` (bis +5). Beides ignoriert jetzt Spieler, die das Team nur über die KI-Merkliste im Blick hat (`kiMerklisteSpielerIds`); die Tests des Kaufplans bleiben grün. Restfall: war ein Spieler vorher passiv gescoutet und kommt jetzt auf die Liste, zählt seine Intel nicht mehr für den Kauf (bei Büro 0 ohnehin 0).

**Info für eine spätere Entscheidung: nutzt die KI beim Kauf verdeckte Werte?** Ja. Die Kaufbewertung (`toOrganicPlayerView` in `lib/ai/organic-squad/draft-adapter.ts`, daraus `buyUtility`) liest die wahren `coreStats`, die wahren `disciplineRatings` und das versteckte Potenzial (`resolvePlayerPotentialScoreFromGameState`, `hiddenPotentialScore`) jedes Kandidaten, unabhängig von Scouting-Stufe oder Büro-Level des KI-Teams; dasselbe gilt für die Merkliste, weil sie dieselbe Funktion nutzt. Die KI unterliegt dem Nebel also nicht. Nur ein kleiner Bonus (`Scouting-Sicherheit / 20`) im Kauf-Ranking hängt am echten Scouting-Stand. Nicht geändert. **Nachtrag 21.11.: umgesetzt (Chris: „Option A“), siehe `docs/design/ki-nebel-21-11.md`.**

**Messung Runde 2** (`scripts/miss-ki-merkliste.ts`, Kopie des Abbilds, `new-game-1795114260527-nzr0z9`, Saison 1, Spieltag 12, 31 KI-Teams):
- Länge je Team: min 0, Median 54, p90 400, max 400, Summe 4182 (Runde 1: höchstens 6, Summe 104). 11 Teams mit 0 oder 1 Eintrag (nichts bezahlbar oder nichts besser als „nichts tun“).
- Anteil: 3128 Marktspieler (75 %), 1054 Spieler fremder Teams (25 %); Stufen 1/2/3: 3612 / 456 / 114 (die lange Schleppe sind Stufe-1-Beobachtungen).
- Scouting-Plätze: jedes Team mit mindestens sechs Einträgen belegt genau seine 6 aktiven Plätze (Kapazität 6 bei Büro 0), 4060 Einträge warten auf einen freien Platz; Teams mit weniger Einträgen belegen entsprechend weniger. Es wird nie mehr aufgedeckt als beim Menschen.
- Laufzeit des ganzen Abschlussschritts (Neuberechnung, Schreiben, Scouting-Plätze): 779 ms für alle 31 Teams (~25 ms je Team, in der Größenordnung von Runde 1). Die Berechnung allein 1,3 s im kalten Lauf, danach schneller (JIT).
- Speicher: Wunschliste im Spielstand von 0 auf 1,9 MiB (4182 Einträge à ~450 Byte) bei 26,8 MiB Gesamtstand.
- Ausgabe deterministisch (zwei Läufe identisch).

**Tests.** `tests/ki-merkliste.test.tsx` (16): Marktspieler und fremde Spieler drin, eigene nie, kein 6er-Limit, Handeinträge und Wunschliste des Menschen unberührt, Scouting-Plätze begrenzt (6) und nach Stufe belegt, Scouting-Records stimmen mit der Queue überein, Migration der alten `kiMerkliste`, freie Spieler ohne Meldung. Außerdem `tests/transfer-wishlist-stale-write.test.ts` (Quelltext-Prüfung an die `ki`-Ausnahme angepasst). Wertungs-Fingerabdruck unverändert `GESAMT eaafed96150e`.
