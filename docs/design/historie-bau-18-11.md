# Historie modern — Bau und Abgleich (18.11.)

Vorlage: `public/mockups/historie-modern-18-11.html`, Erklärung `docs/design/historie-modern-18-11.md` (PR #1636, von Chris
abgenommen, seine fünf Antworten alle „ja"). Bilder des Baus: `docs/design/historie-bau-18-11/`, Mockup-Bilder zum Vergleich:
`docs/design/historie-modern-18-11/`. Die Wertung ist nicht berührt.

**Baut auf PR #1634** (`lib/season/transferbilanz-buchung.ts`): Das Fenster vor Saison N gehört zu Saison N, der Draft ist
Kaderaufbau, die Transferbilanz von Saison 1 ist „—". Die Regel wird verwendet, nicht neu erfunden: `buchungsArt` der Zeilen kommt aus
`useHistoryV2Derivations`, `transferNet`/`kaderaufbauNet` der Saisonen aus `foundation-season-history-projection`.

## Umfang: zwei PRs

1. **Diese PR (Historie):** Schienenpunkt, Saison-Archiv, Transfers, Ewige Tabelle, Zeitleiste, Blatt.
2. **Zweite PR (Spielplan und Ranks):** Mockup-Bilder 09 bis 11. Ranks (Matrix Team × 20 Disziplinen, PPs pro Bereich) und Spielplan
   (Gegner und eigenes Ergebnis je Spieltag aus Spielplan plus Spieltagsergebnissen) brauchen eigene Daten-Zusammenführung; beides
   zusammen hätte diese PR über jedes prüfbare Maß gehoben. Beide Punkte bleiben bis dahin unverändert in der Schiene.

## Wo was liegt

| Teil | Datei |
|---|---|
| Rechnung Saisons, Meister, Auf-/Abstieg, Team-Verlauf | `lib/foundation/historie-modern.ts` |
| Rechnung Transfers (Kaderaufbau trennen, Bilanz je Team, Zeit, CSV) | `lib/foundation/historie-transfers.ts` |
| Ewige Tabelle (Ø/Bester Platz und Medaillen über beide Ligen, Aufstiege, Abstiege) | `lib/foundation/all-time-table.ts` |
| Seiten | `components/foundation/historie/` (`HistorieArchiv`, `HistorieTransfers`, `HistorieEwigeTabelle`, `HistorieZeitleiste`, `HistorieBlatt`, `HistorieLinien`) |
| Stil | `components/foundation/historie/historie-modern.css` — der Mockup-Ausschnitt unverändert, unter `.hist` eingehängt |
| Verdrahtung | `foundation-nav-config.ts` (ein Punkt `seasonArchive`), `foundation-view-routing.ts`, `FoundationShellRouterBody.tsx` (drei Reiter im Regieband), `use-foundation-shell-router-body-scope.tsx` (`historieWechsel`) |
| Prüfstand der Bilder | `scripts/historie-pruefstand/` |

## Entscheidungen im Code

- **Meister** ist nur Platz 1 der Liga 1. Platz 1 der Liga 2 ist `meisterLiga2` und zählt als Aufstieg (Marke „▲ Meister Liga 2").
  Gezählt wird in der Ewigen Tabelle aus den Plätzen über beide Ligen, nicht aus `isGold`, damit alte Kurzfassungen dasselbe sagen.
- **Aufstieg/Abstieg:** Wechselt das Team in der Folgesaison die Liga, entscheidet das; fehlt die Folgesaison, gilt die Tabellenregel
  (Liga 1 Platz 14 bis 16 ab, Liga 2 Platz 1 bis 3 auf, `RELEGATION_COUNT`).
- **Ø Platz, Bester Platz, Meister/Zweiter/Dritter/Top 5/Top 10** rechnen über beide Ligen (Liga 2 ab Platz 17,
  `toLeagueSpanningPosition`). Folge für die Medaillen: Platz 2 der Liga 2 ist kein „Zweiter" mehr (vorher zählte er mit). Die Rangfolge
  bleibt nach kumulierten Punkten.
- **Kaderaufbau getrennt:** Zeilen mit `buchungsArt === "kaderaufbau"` stehen nur in der eigenen Ansicht (Zeitleiste, erstes Glied). In
  „Alle Fenster" zählen sie nicht mit, ein Hinweis mit Sprung sagt das. Im Archiv und im Blatt steht die Transferbilanz von Saison 1 als „—".
- **Pick und Runde:** Der Draft speichert beides nicht (`TransferHistoryEntry` hat weder Pick-Nummer noch Runde). Es gilt der Rückfall der
  Empfehlung: alle Zeilen, nach Team gruppiert, nach Zeitstempel geordnet, laufende Nummer statt Pick.

## Abgleich gegen das Mockup

| Mockup-Teil | Stand | Anmerkung |
|---|---|---|
| Ein Schienenpunkt „Historie" mit drei Reitern im Regieband | drin | Gruppe Welt; die alten Punkte unter Markt und Team entfallen, ihre Ansichten bleiben als Reiter |
| Kein eigener Seitenkopf, ein h1 in der Shell | drin | Kennzahlen im Seiten-Slot des Bandes (`HistorieBandKpis`) |
| Kein Seitenscrollen, Listen scrollen in ihrer Karte | drin | Seitenwurzel skaliert wie die Startseite (`HistorieSeite`) |
| Saison-Zeitleiste (Archiv und Transfers) | drin | im Archiv Saisons breit, Fenster schmal; im Transfers-Reiter umgekehrt; Klick aufs schmale Glied wechselt den Reiter |
| Zeitleiste: laufende Saison | angepasst | zeigt „läuft · Spieltag n / 20"; ihr Zwischenstand ist nicht im Archiv, Klick führt zum Saisonstand |
| Zeitleiste: Netto im Fenster | angepasst | „dein Netto" nur für archivierte Saisons (aus `transferNet`); das laufende Fenster zeigt nur die Zahl der Deals |
| Zeitleiste im Archiv: Deals je Fenster | angepasst | Archiv kennt keine Deal-Zahl (Feed liegt nur im Transfers-Reiter), das Fenster heißt dort „Transfers" |
| Archiv: Liga 1 und Liga 2 nebeneinander, Zonen, Marken | drin | Gold Meister, Rot Abstieg, Grün Aufstieg, Marken wie im Mockup |
| Archiv: Sport/Geld | drin | Sport: Punkte, POW/SPE/MEN/SOC, Start, ±; Geld: Kasse, Gehalt, Marktwert, GuV, Transfers |
| Archiv: Saison in Kürze, Kletterer & Absturz, Zeugnis | drin | Zeugnis aus `startplatz`, `rankDiff`, Kasse, Transferbilanz |
| Transfers: Bilanz je Team (Volumen/Erlös/Netto, Klick filtert) | drin | rechnet immer alle Teams; der Teamfilter filtert nur die Deal-Liste |
| Transfers: Deals mit Filtern Art, Klasse, Quelle, Suche, Sortierung | drin | alle Filter der alten Seite bleiben (Saison über die Zeitleiste, Team über die Bilanz) |
| Transfers: Höhepunkte, Deal im Blick, CSV | drin | |
| Deal im Blick: Marktwert-Verlauf | fehlt | im Mockup erfunden; der Spielstand hält keinen Marktwert-Verlauf je Spieler am Deal |
| Kaderaufbau als eigene Ansicht, getrennt von Transfers | drin | siehe oben; „Startbudget je Team" (Budget → Kader → Kasse) ist **angepasst** zu „Kaderaufbau je Team" (Ausgaben, Picks), weil das Startbudget nicht in der Historie steht |
| Kaderaufbau: Pick-Nummer und Runde | fehlt | Draft speichert sie nicht, Rückfall nach Team gruppiert |
| Ewige Tabelle: vier Sichten, Verlaufskacheln, Liga-Filter, Sortierung | drin | |
| Ewige Tabelle: Entwicklung (Platz, Punkte, MW, Kasse, Teamwert), Auf und ab | drin | |
| Blatt rechts mit Team-Verlauf | drin | auf allen drei Reitern; „Größte Deals" nur im Transfers-Reiter (dort liegen die Deals) |
| Spalten, Filter, Saisonwahl der alten Seiten | drin | bis auf das, was das Mockup ausdrücklich streicht: Timeline/Tabelle-Umschalter, Seitenblättern (Liste scrollt, „Mehr laden" bleibt), Karte „Deals & Bilanz je Season" (steht in der Zeitleiste), Achsenprofil im Spotlight |
| Auswahl der Saison beim Wechsel Transfers → Archiv | offen | das Archiv öffnet auf der jüngsten Saison, die Saison aus der Zeitleiste wird nicht mitgegeben |
| Spielplan, Ranks | zweite PR | |

## Bilder

Pfad: `docs/design/historie-bau-18-11/`, je 1920×1080 und 2560×1440 (deviceScaleFactor 1, Chromium).

**Wichtig, ehrlich:** Die Bilder stammen NICHT aus der echten App. Sie entstehen aus einem Prüfstand (`scripts/historie-pruefstand/`), der die
**echten Komponenten** (Saison-Archiv, Transfers, Ewige Tabelle samt Zeitleiste und Blatt, echte Rechnung `historie-modern.ts`,
echtes `buildAllTimeTableModel`, echtes CSS, echte Wappen und Portraits) in einem Browser-Bundle rendert — mit **erfundenen Zahlen**
(32 echte Teams, drei archivierte Saisons und eine laufende, erfundene Platzierungen und Deals aus fester Saat). Das Regieband ist
nachgebaut (der Schriftzug und die Reiter), die Seite darunter ist echt. Grund: Platte knapp (3 GB frei) und die App steht hinter dem Login.
Der Prüfstand läuft nicht in der App und ist kein Test.

Aufnahme: `flock /tmp/oly-aufnahme.lock node scripts/historie-pruefstand/aufnahme.mjs`.

| Bild | Zustand |
|---|---|
| `01-archiv-saison3` | Saison-Archiv, Sport |
| `02-archiv-saison2-geld` | Archiv Saison 2, Geld |
| `03-archiv-blatt-team-verlauf` | Blatt rechts, Team-Verlauf |
| `04-transfers-fenster-saison3` | Transfers, Fenster vor Saison 3 |
| `05-transfers-kaderaufbau-saison1` | Kaderaufbau |
| `06-transfers-alle-fenster` | alle Fenster |
| `07-ewige-tabelle-punkte`, `08-ewige-tabelle-titel`, `09-ewige-tabelle-blatt` | Ewige Tabelle |
