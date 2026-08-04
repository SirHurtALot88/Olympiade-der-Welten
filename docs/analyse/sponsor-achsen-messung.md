# Sponsor-Achsen-Messung (V4)

Datum: 2026-08-03

## Kontext

Seit dem V4-Umbau (#361, #362) sind `kaderpflege`, `entwicklung`, `soliditaet`, `ausbau` und
`wachstum` die EINZIGEN Sponsorziele im Spiel. Der alte Katalog aus 27 Bonus- und 6 Golden-Zielen
(gemessen von `scripts/sponsor-ziele-audit.ts`) wurde entfernt. Damit haengt an diesen fuenf Achsen
die gesamte Zielvielfalt: faellt eine Achse nie, faellt sie immer, oder verteilt sie sich schief,
hat der Spieler faktisch weniger als fuenf Ziele.

Dieses Dokument ist ein reiner MESS-Befund. Es werden keine Spielregeln, Skalen oder Preise
geaendert.

## Methode

- Werkzeug: `scripts/sponsor-achsen-messung.ts`, ausgewertet via
  `evaluateSpecialComponentStage` aus `lib/sponsor/sponsor-objective-evaluator.ts`.
- Ausgewertet wird AUSSCHLIESSLICH gegen die ECHTEN, im Save unterschriebenen Vertraege
  (`gameState.seasonState.sponsorContractsByTeamId`) — nie gegen frisch erzeugte Angebote gegen
  denselben Endstand. Eine Achse misst gegen die bei Angebotserzeugung eingefrorene eigene
  Ausgangslage (`axisbase`/`axisscale`/`axisoffset`); wertet man frisch erzeugte Angebote gegen
  denselben Stand aus, aus dem sie erzeugt wurden, kommt jede Wachstumsachse per Konstruktion auf 0.
  Diese Fehlmessung ist im ersten Anlauf tatsaechlich passiert und hat drei Achsen faelschlich auf
  0 % gedrueckt.

## Quelle

Eine mit `scripts/long-run-sandbox-s1-s6.ts` komplett durchgespielte Saison 1:
Draft (335 Picks) → Preseason inklusive `chooseSponsorOfferForAiTeams` fuer alle KI-Teams →
10 Spieltage. Damit sind die Sponsorvertraege nachweislich VOR den Spieltagen unterschrieben und
ihre Ausgangslage am echten Saisonstart eingefroren.

- Save: `fresh-season-1-1785739977188`
- Ablage: `outputs/balancing-run.sqlite` (isoliert)
- 32 Teams, **32 von 32 mit Sponsorvertrag**, 32 Achsen-Vertragskomponenten

## Ergebnis

| Achse | n | Ø Erfüllung | Median | 0 % (nie) | teilweise | 100 % (voll) | Ø Rohmetrik | Zielwert |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Kaderwert (`wachstum`) | 6 | **0,0 %** | 0,0 % | 6 | 0 | 0 | −29,91 % | +12 % |
| Ausbau (`ausbau`) | 0 | — | — | — | — | — | — | 2 Stufen |
| Solidität (`soliditaet`) | 10 | **99,3 %** | 100,0 % | 0 | 1 | 9 | 58,06 C | 30 C |
| Entwicklung (`entwicklung`) | 8 | **100,0 %** | 100,0 % | 0 | 0 | 8 | 10,13 Sprünge | 3 Sprünge |
| Frische (`kaderpflege`) | 8 | 44,3 % | 31,4 % | 4 | 2 | 2 | 51,24 % | 90 % |

## Einordnung je Achse

**`kaderpflege` (Frische) — die einzige, die funktioniert.** Ø 44,3 %, Median 31,4 %, und die
Verteilung ist echt gemischt: 4× nicht erfuellt, 2× teilweise, 2× voll. Das ist ein Ziel, dessen
Ausgang offen ist und das man durch Rotation beeinflusst. So soll eine Achse aussehen.

**`entwicklung` (100 %) und `soliditaet` (99,3 %) sind verkappte Gehaltserhoehungen.** 17 von 18
Vertraegen fallen voll. Die Rohwerte zeigen, wie weit die Ziele daneben liegen: bei `entwicklung`
werden im Schnitt **10,13 Sprünge** gegen ein Ziel von **3** erreicht — mehr als das Dreifache. Bei
`soliditaet` **58,06 C** gegen ein Ziel von **30 C**, fast das Doppelte. Fuer diese 18 Teams ist das
Sponsorziel keine Entscheidung, sondern eine Formalie. Da die Achse mit `SPONSOR_V4_AXIS_PBAR = 0,5`
bepreist ist (der Vertrag zieht `p·G` ab und zahlt bei Erfuellung `G`), bekommen sie systematisch
**mehr, als die Bepreisung unterstellt**.

**`wachstum` (Kaderwert) ist ein verstecktes Preisschild.** 6 von 6 Vertraegen fallen auf 0. Der
Grund steht in der Rohmetrik: der Kaderwert ist im Schnitt um **29,91 % GESUNKEN**, waehrend das
Ziel **+12 %** verlangt. Das Ziel ist damit nicht schwer, sondern in der gemessenen Saison
unerreichbar — und die 6 Teams zahlen den Abschlag `p·G`, ohne je eine Chance auf die Auszahlung zu
haben. Der schrumpfende Kaderwert selbst ist ein eigener, groesserer Befund (siehe unten).

**`ausbau` wurde kein einziges Mal unterschrieben.** Auf dem separat geprueften Live-Save
(`new-game-1785174792968-8d7mdx`) wird sie durchaus gewaehlt (5 von 32), hier keinmal. Ob das an der
Angebotsziehung, an `sponsorV4OfferableAxes` oder am Zufall dieser einen Saison liegt, ist mit
n = 0 nicht zu entscheiden.

**Fazit: von fuenf Achsen traegt genau eine.** Zwei sind Geschenke, eine ist eine Gebuehr, eine kam
nicht vor. Fuer 18 der 32 Teams ist das Sponsorziel eine Formalie, fuer 6 eine Strafe.

## Grenzen der Stichprobe

- **Eine Saison, 32 Vertraege.** Je Achse bleiben 6 bis 10 Datenpunkte — genug, um 0 % und 100 % als
  Strukturbefund zu lesen (bei n = 8 und Ø 100 % ist die Aussage "faellt praktisch immer" belastbar),
  zu wenig fuer eine genaue Quotenangabe. `kaderpflege` mit Ø 44,3 % sollte man als "liegt im
  Korridor" lesen, nicht als exakten Wert.
- **`ausbau` mit n = 0 ist keine Messung**, sondern eine offene Frage.
- **Der Kaderwert-Schwund ist saisonspezifisch.** Ob die −29,91 % ein Merkmal der Season-1-Sandbox
  sind (Draft-inflationierte Startwerte, die sich normalisieren) oder ein durchgaengiger Effekt,
  entscheidet erst eine Messung ueber mehrere Saisons. Fuer die Bewertung von `wachstum` macht das
  einen Unterschied: im ersten Fall ist nur die S1-Zielleiter falsch, im zweiten die Achse selbst.

## Nebenbefund

Der gemessene Kaderwert-Rueckgang von rund 30 % ueber eine Saison betrifft nicht nur die
`wachstum`-Achse — er beeinflusst jede Bewertung, die auf Marktwerten aufsetzt. Das gehoert
unabhaengig von den Sponsoren nachgeprueft.

## Nachkalibrierung (2026-08-03)

Aufbauend auf der Messung oben wurden die Zielskalen in `lib/sponsor/sponsor-v4-axes.ts`
nachgezogen. Methode: dieselben 32 Vertraege aus `fresh-season-1-1785739977188` erneut ausgewertet,
einmal mit den im Vertrag eingefrorenen (alten) `scale`/`offset` und einmal mit den aktuellen aus
dem Code — die Rohmetrik selbst haengt nicht an der Skala, ein neuer Save war dafuer nicht noetig
(`scripts/sponsor-achsen-messung.ts` wurde um genau diese Vorher/Nachher-Tabelle und um eine
Quantils-/Rohwerte-Ausgabe erweitert).

### Quoten vorher/nachher

| Achse | n | Zielwert alt | Zielwert neu | Ø Erfüllung alt | Ø Erfüllung neu |
|---|---:|---:|---:|---:|---:|
| `soliditaet` | 10 | 30 C | **110 C** | 99,3 % | **56,1 %** |
| `entwicklung` | 8 | 3 Sprünge | **20 Sprünge** | 100,0 % | **50,6 %** |
| `kaderpflege` | 8 | 90 % | 90 % (unveraendert) | 44,3 % | 44,3 % |
| `wachstum` | 6 | 12 % | 12 % (unveraendert, aber ab S1 nicht mehr angeboten) | 0,0 % | — (kein Vertrag mehr) |
| `ausbau` | 0 | 2 Stufen | 2 Stufen (unveraendert) | — | — |

Beide korrigierten Achsen liegen jetzt im Zielkorridor 35–65 % Ø Erfuellung. Der Anker war jeweils
die gemessene Verteilung der Rohmetrik dieser Saison (Median als Naeherung fuer „wo landet die
Haelfte der Teams"), nicht eine exakte 50,0-%-Punktlandung — bei n = 8 bzw. n = 10 waere das
Ueberanpassung an eine einzelne Saison:

- **`soliditaet`**: Rohmetrik-Verteilung `[27.31, 37.16, 39.95, 40.51, 42.84, 46.55, 48.70, 85.28,
  95.28, 116.99]` C. Nullpunkt (Grosszuegigkeits-Offset) bei −10 C blieb unveraendert — er ist ein
  Design-Kulanzwert, kein Messwert, und die realen Werte lagen ohnehin nie in seiner Naehe. Skala
  40 → 120 (Zielwert 30 → 110 C) verschiebt allein die obere Schwelle dorthin, wo die Verteilung
  tatsaechlich spreizt.
- **`entwicklung`**: Rohmetrik-Verteilung `[7, 8, 10, 10, 10, 11, 12, 13]` Spruenge, Median 10. Skala
  3 → 20 (kein Offset). Bei 20 erreicht keiner der acht gemessenen Vertraege den Deckel — die
  Erfuellung ist im gemessenen Bereich rein linear, keine Klumpung mehr bei 0 % oder 100 %.
- **`kaderpflege`**: unveraendert — lag mit Ø 44,3 % bereits im Korridor und mit 4× nicht erfuellt /
  2× teilweise / 2× voll erfuellt bereits als einzige Achse mit echter Streuung vor.
- **`ausbau`**: unveraendert — n = 0 ist keine Messgrundlage. Kurz nachgeschaut, warum: `offerable`
  war fuer alle 32 Teams `true` (Gebaeude-Headroom 37–40 von 40 moeglichen Stufen), und die
  Slate-Ziehung (`rollSponsorOfferSlate`) hat die Achse nur bei 7 von 32 Teams aus dem 5-Slot-Angebot
  herausrotiert — 25 Teams hatten die Karte im Angebot, trotzdem hat sie keines unterschrieben. Der
  Ausschluss liegt damit vermutlich in der KI-Angebotswahl (`scoreOfferForAi` in
  `sponsor-offer-service.ts`) oder in der Kartengroesse der Achse, nicht in `sponsorV4OfferableAxes`
  — nicht weiter untersucht, unveraendert gelassen wie im Auftrag vorgesehen.

### `wachstum`: Ursache geklaert, Achse ab Saison 1 nicht mehr angeboten statt umskaliert

Der gemessene Rueckgang (Ø Rohmetrik −29,91 %, alle 6 Vertraege negativ) ist **kein Skalenproblem**.
Nachverfolgt bis zum Code:

1. `wachstum` misst `teamMarketValue`, das am Ende auf `player.marketValue` aufsetzt
   (`resolvePlayerEconomyContract` in `lib/foundation/player-economy-contract.ts`).
2. Direkt nach dem Draft steht dort die **heuristische Draft-Schaetzung**
   (`lib/player-generator/commit-draft-to-free-agent.ts`, Kommentar dort explizit: "marketValue…: the
   draft's heuristic estimate"), berechnet unabhaengig von der Liga.
3. Am Saisonende (nach dem letzten Spieltag, `season-end-xp-apply-service.ts`, Phase „ai-xp" in
   `scripts/long-run-sandbox-s1-s6.ts`) ersetzt `applyRankTableMarketValuesToGameState` (aus
   `lib/player-formulas/market-value-apply.ts`) `player.marketValue` fuer **jeden** Spieler im Pool
   einmalig durch den rang-basierten Wert (`calculateMarketValueFromRankTable`,
   `league-market-value-snapshot.ts`) — eine strukturell andere, nicht direkt vergleichbare
   Bewertungsmethode (relativer Rang ueber den gesamten Spielerpool statt heuristische Einzelschaetzung).
4. Die Sponsor-Vertrags-Baseline wird bei Preseason-Angebot eingefroren, **vor** diesem
   Methodenwechsel. Der Endwert der Saison steht **nach** ihm. Der gemessene Einbruch ist damit
   ueberwiegend der Methodenwechsel selbst, nicht reale Kaderwert-Entwicklung.

Das trifft strukturell nur **Saison 1**: ab Saison 2 ist die Baseline selbst schon rang-basiert (vom
Saisonende der Vorsaison), Baseline und Endwert nutzen dann dieselbe Methode — der Effekt verdampft
weitgehend (bleibt nur fuer den Anteil neu eintretender/heuristisch bewerteter Spieler relevant, der
in S1 100 % des Kaders betrifft, ab S2 nur noch die Rotation).

Fuer S1 gibt es dafuer bereits ein historisches Vorbild: `resolveMarketValueGrowthStages` in
`lib/sponsor/sponsor-special-objectives.ts` (vor der Entfernung des alten Katalogs, Commit
`3efa6801^`) fuehrte eine **eigene, flachere S1-Leiter** (1/2/3 % statt 5/10/15 %), begruendet damit,
dass in S1 der Transfermarkt-Hebel fehlt und nur organisches Training zaehlt. Dieser alte Fall
erklaert aber nur eine MILDE Daempfung (S1-Ziel blieb positiv, 1–8 %) — der hier gefundene
Methodenwechsel-Effekt ist deutlich groesser (Rohmetrik im Schnitt −29,91 %, nicht nahe 0) und eine
andere Ursache.

**Entscheidung:** `wachstum` wird ab Saison 1 nicht mehr angeboten (`offerable` prueft jetzt
`gameState.season.id !== "season-1"`), Skala/Ziel (12 %, Offset 0) bleiben unveraendert. Eine eigene
S1-Leiter wurde bewusst NICHT gebaut: die einzige verfuegbare S1-Messung ist durch genau den
Methodenwechsel verzerrt, den eine solche Leiter kompensieren muesste — eine Zielleiter daraus
abzuleiten waere Raten auf verzerrter Datenbasis. Fuer S2+ liegen keine Messdaten vor; die Skala
12 % blieb dort bewusst unveraendert statt geraten (siehe Auftrag: "wenn du die Ursache nicht sauber
klaerst … Achse unveraendert lassen"). Eine Messung ueber S2–S6 ist die naheliegende Folgearbeit,
bevor an dieser Skala erneut gedreht wird.
