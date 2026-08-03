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
