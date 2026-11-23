# Marketing: Bau und Messung (22.11.)

Chris, 22.11.: „die Mockups sehen gut aus, hast die Freigabe die umzusetzen“. Konzept: `docs/design/marketing-22-11.md` (Runde 3),
Mockup `public/mockups/marketing-22-11.html`. Umfang dieses Baus: nur Marketing (Werbegeld, Team-Anteil, Moral, Teammarke, Seite,
Marketability im Transfermarkt). Stadion, Tickets, Medaillen und Kredite folgen getrennt.

## Gebaut

| Baustein | Stelle |
|---|---|
| Stammdaten (Traits, Klassen, Rassen, 32 Fanprofile aus echten Rassen/Klassen/Traits) | `lib/marketing/marketing-daten.ts` |
| Rechnung (Reichweite, Passung, Werbegeld, Team-Anteil 15–65 %, Netz 25 % des Gehalts, Moral-Zuschlag, Fanfarben-Drift) | `lib/marketing/marketing-modell.ts` |
| Regel-Stempel `seasonState.marketingRegel` (neues Spiel ab Saison 1, bestehender Spielstand ab dem nächsten Saisonwechsel, `OLY_MARKETING=aus` / `aus-sofort`, nur Server) | `lib/marketing/marketing-regel.ts`, compose + `.env.example` |
| Kontext aus dem Spielstand, Teamerfolg, Aushängeschild | `lib/marketing/marketing-kontext.ts` |
| Team-Übersicht, Jahres-/Saisonbetrag, Drift beim Saisonwechsel | `lib/marketing/marketing-team.ts` |
| Buchung je Spieltag (Ledger-Feld `marketing`, Kasse = Summe der Buchungen), Kontoauszug, Erwartung | `lib/finance/finanzen-je-spieltag*.ts`, `kontoauszug.ts` |
| GuV-Posten „Marketing“ | `lib/finance/season-end-guv.ts`, Resolver und View-Modell |
| Moral: Grund „Werbeverträge“ (Zuschlag nach der Streckung; Team-Anteil rechnet mit der Moral ohne Zuschlag, `moralOhneWerbung`) | `lib/morale/player-morale-service.ts` |
| Seite `MarketingModern` (Nav unter Team, Reiter Fanprofil / Spieler / Verlauf, je Manager getrennt) | `app/foundation/marketing/` |
| Marktspalte „Mkt“ mit Nebel (serverseitig nur Stufe 10er/5er/exakt) | `lib/marketing/marketing-markt.ts`, `transfermarkt-local-service.ts`, `TransfermarktModern.tsx` |
| Tests | `tests/marketing-bau.test.ts`, `tests/marketing-seite.test.tsx` |

Entscheidungen des PM (Teammarke danach nach der Scheren-Messung geändert, siehe unten): Spieler-Anteil geht nie in die Kasse (hebt die Moral); Fans mögen/meiden nur echte
Rassen, Klassen, Traits; Mensch und KI gleiche Regeln.

## Annahmen, die das Konzept offen ließ

- Saisonziel „erreicht“ = obere Liga-Hälfte, Titel = Rang 1, Farb-Meister = meiste Punkte einer Farbe in der Liga (Teamerfolg, Drift-Schritt).
- Kader-Anteil der Fanfarben-Drift: Klassenfarben des Kaders am Saisonende gleich gewichtet (nicht nach Einsätzen).
- Stimmung und Fan-Shop der Teammarke: Faktor 1,0. Schub durch Aktionen: 0. Aushängeschild: KI-Regel (höchste Marketability unter den besten sechs);
  die Manager-Wahl wird gelesen (`marketingAushaengeschild`), aber noch nirgends geschrieben.

## Messung Saison 1 (32 KI-Teams, gleiche Anlage und gleicher Draft, mit gegen ohne Marketing)

Rohausgabe: `docs/design/marketing-bau-22-11/messung-s1.txt`; Skripte `scripts/miss-teamfinanzen-saison.ts --marketing-stempel an|aus`,
`scripts/auswerte-marketing-saison.ts`. Ein Lauf, eine Saat.

| | ohne | mit |
|---|---:|---:|
| Marketing in den Kassen (Summe) | 0 | **215,2 C** (Liga 1: 132,8 · Liga 2: 82,4; je Team 8,3 · 5,1) |
| davon Teammarke / Team-Anteile | – | 128,0 / 89,9 C |
| Werbegeld im Kader / an die Spieler | – | 272,9 / 183,0 C |
| Sicherheitsnetz greift | – | 4 von 364 Spielern |
| Teams mit operativer GuV ≥ 0 | 11 von 32 | **16 von 32** (nur Marketing; das Ziel zwei Drittel gilt inkl. aller geplanten Posten) |
| Einnahmen Liga 1 : Liga 2 | 1,23 | 1,27 |
| Kasse Saisonende, Abstand oberes/unteres Viertel | 49,0 | 51,3 |
| operative GuV, reiche 8 / arme 8 nach Budget | 0,6 / 0,2 | 11,7 / 5,8 |
| mittlere Kader-Moral | 50,3 | 51,3 (je Team −4,2 bis +5,4; Zuschlag im Mittel 1,1 Punkte) |

Lesart: Marketing bringt 5 Teams über die Null. Die Schere nach Budget öffnet sich leicht (Marketing nach Budget: reiche 8 ⌀ 9,8 C, arme 8 ⌀ 4,8 C;
Einnahmenverhältnis 1,23 → 1,27). Das war zu viel, siehe Nachbesserung unten. Marketing liegt knapp unter
der Konzeptrechnung (≈ 234 C bei acht Spielern je Team), weil die KI-Kader wenige Spieler mit Kante haben.

## Nachbesserung 1: Schere reich/arm (Vorgabe: darf nicht wachsen)

Vorgabe des PM: Einnahmenverhältnis L1/L2 steigt nicht über den Wert ohne Marketing, der GuV-Abstand nach Budget (reiche 8 minus arme 8) wächst höchstens um 1 C.
Messung: 3 Saaten (je 32 KI-Teams, derselbe Lauf mit `OLY_MARKETING=aus`; weil Marketing den Spielverlauf nicht ändert, ist "mit" = GuV ohne + Marketing,
`scripts/auswerte-marketing-schere.ts`). Varianten rechnen offline auf denselben Läufen (`scripts/vergleiche-marketing-varianten.mjs`, alle Zeilen in
`docs/design/marketing-bau-22-11/messung-schere-varianten-s1.txt`).

**Der Vorschlag des PM wirkt nicht.** Teammarke nach Finanzwert (4 + 0,4 x (5,1 − Finanzwert), 2 bis 6 C) und der Deckel von 12 C ändern die Schere kaum
(Delta des GuV-Abstands +3,8 gegen +3,9 beim pauschalen Sockel; Verhältnis 1,25 → 1,27). Gründe: (1) der Finanzwert der Team-Matrix hängt kaum am Budget,
nach dem "reich/arm" gemessen wird; (2) der Deckel greift nie (größte Team-Anteile je Team liegen unter 12 C, `Deckel` = 0 Teams); (3) die Liga-Schere
kommt aus dem niedrigeren Werbe-Höchstwert der Liga 2, den ein gleicher Sockel nicht ausgleicht.

**Umgesetzt (Variante L, Steigung 0,35):** Teammarke = Liga-Basis (Liga 1: 3,0 C, Liga 2: 5,0 C, Ligamittel 4,0 C) + 0,35 C je Platz Abstand von der Ligamitte nach **Budget-Rang**
im Ligakreis (reichstes Team zahlt am wenigsten, 0 bis 9 C), `teammarkeAusRang`. Die Steigung 0,35 (zuerst 0,5, das drehte die Schere zu stark: arme Teams bekamen
8,3 gegen 6,4 C) lässt Marketing eher neutral wirken; den Aufholweg tragen Sponsor-Rework und Budget-Staffel. Der Deckel von 12 C je Team und Saison bleibt (Rest geht als Moral
an die Spieler), er greift in den Messungen bei keinem Team.

Messung wiederholt für 0,35 (dieselben drei Läufe, offline neu gerechnet, weil die Steigung nur die Teammarke ändert; die Team-Anteile der Läufe sind ohne Verletzten-Halbierung
gemessen, deren Wirkung klein ist). Rohdaten `messung-schere-s1.txt` und `messung-schere-s2.txt`.

| Saat (Saison 1) | Marketing Summe (L1 / L2 je Team) | Teams GuV ≥ 0 ohne → mit | Einnahmen L1 : L2 ohne → mit | GuV-Abstand reiche 8 − arme 8 ohne → mit | Marketing reiche 8 / arme 8 | Moral je Spieler |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 224,1 (7,5 / 6,5) | 16 → 19 | 1,25 → 1,24 | 4,1 → 3,2 (−0,9) | 6,9 / 7,8 | +1,09 |
| 2 | 216,7 (7,1 / 6,5) | 19 → 24 | 1,25 → 1,24 | 11,4 → 10,6 (−0,8) | 6,8 / 7,7 | +0,98 |
| 3 | 216,3 (7,3 / 6,2) | 18 → 21 | 1,24 → 1,23 | 11,9 → 11,4 (−0,5) | 6,9 / 7,4 | +0,91 |
| Mittel | 219,0 | 17,7 → 21,3 | 1,25 → 1,24 | 9,1 → 8,4 (−0,7) | | |

| Saat (Saison 2) | Marketing Summe (L1 / L2 je Team) | Teams GuV ≥ 0 ohne → mit | Einnahmen L1 : L2 ohne → mit | GuV-Abstand reiche 8 − arme 8 ohne → mit | Marketing reiche 8 / arme 8 | Moral je Spieler |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 223,1 (7,1 / 6,8) | 26 → 28 | 1,25 → 1,24 | −5,0 → −6,3 (−1,4) | 6,8 / 8,2 | +0,84 |
| 2 | 223,2 (7,2 / 6,8) | 28 → 28 | 1,23 → 1,21 | −15,3 → −15,5 (−0,2) | 7,6 / 7,8 | +0,77 |
| 3 | 210,5 (6,5 / 6,6) | 27 → 28 | 1,38 → 1,35 | 0,2 → −0,2 (−0,4) | 6,9 / 7,2 | +0,65 |
| Mittel | 218,9 | 27,0 → 28,0 | 1,29 → 1,27 | −6,7 → −7,3 (−0,6) | | |

Ziel erreicht: das Verhältnis steigt in keiner Saat und der GuV-Abstand wächst nirgends (Veränderung −0,2 bis −1,4 C). Marketing wirkt damit leicht ausgleichend, aber deutlich
weniger als bei 0,5; reiche und arme 8 liegen im Marketing nahe beieinander (6,8 gegen 7,7 C). Der Ausgangswert "ohne Marketing" liegt in diesen Läufen bei 1,24 bis 1,25
(Saison 1) statt 1,23 der ersten Messung (anderer Draft).

## Nachbesserung 2: Der Marketing-Stand liegt im Spielstand (Review-Befunde 1 bis 7)

Vorher hing die Rechnung an einem modulweiten `dauerCache` (Schlüssel ohne Teamerfolg, Moral und PP-Perzentil). Folgen: der Browser rechnete ab Saison 2 beim ersten
Rendern mit Teamerfolg 0 (die Kompaktladung hat keine `seasonSnapshots`) und behielt das; der Server fror die Moral beim ersten Rechnen nach jedem Neustart ein; zwischen Spielständen
im selben Prozess konnte der Cache übergreifen. Jetzt:

- **Teamerfolg im Stempel.** `marketingStempelFuerSaisonwechsel` schreibt den Teamerfolg der Vorsaison je Team nach `seasonState.marketingRegel.teamErfolg`; `teamErfolgVorsaison` liest daraus (Snapshot nur noch als Rückfall für Stempel ohne das Feld).
- **`seasonState.marketingStand[teamId]`** = `{ seasonId, kaderHash, berechnetAmSpieltag, ansKasse, moralOhne je Spieler, leistungPerz je Spieler, moralZuschlag je Spieler }`.
  Geschrieben nur vom Server in `bucheSpieltagFinanzen` (`aktualisiereMarketingStand`): beim ersten Spieltag der Saison und neu, wenn sich der Kader-Hash eines Teams ändert (Spieler, Restlaufzeit, Klausel, Rating, Gehalt, Verletzt-Status, Aushängeschild-Wahl). Moral und Perzentil werden dabei mit dem Stand dieses Spieltags eingefroren; beim Saisonwechsel wird der Stand gelöscht.
- **Lesen:** Seite, GuV-Prognose, Erwartung, Moral-Zuschlag und Buchung lesen nur den Stand. Mit passendem Hash rechnet die Seite mit den eingefrorenen Eingaben (Server, Browser und Neustart ergeben dieselbe Zahl). Ohne Stand oder nach einer Kaderänderung zeigt die Seite eine **Vorschau** (Kennzeichnung „Vorschau“ im Kopf), die Buchung schreibt vor dem Lesen den Stand und bucht nie eine Vorschau. Der Moral-Zuschlag ist ohne Stand 0.
- **Kein modulweiter Cache mehr**, nur ein Memo je Spielstand-Objekt (WeakMap, ohne Zustandswirkung).
- **Notbremse (4):** `marketingSaisonbetrag` zählt Gebuchtes immer, nur der offene Rest hängt an `marketingAktiv`. `OLY_MARKETING=aus-sofort` wird beim nächsten Buchen als `marketingRegel.notbremse` in den Stempel gespiegelt; `marketingAktiv` liest ihn, damit der Browser sie sieht.
- **Farb-Meister (5)** nur innerhalb der eigenen Liga (`gleicheLigaWie`).
- **PM-Entscheidung (6):** die Marketing-Einnahme bleibt bewusst als Puffer in der Kasse und erhöht keinen Topf der laufenden Saison. Der Sponsor-Rework rechnet die neuen Einnahmen ohnehin gegen den Topf.
- **Transfermarkt (7):** auch der volle Pfad in `transfermarkt-local-service.ts` (nicht nur die Kompaktliste) füllt `marketability`.

Tests (`tests/marketing-bau.test.ts`, Block „Marketing-Stand im Spielstand“): Vorschau gegen Stand und Hash-Änderungen; Neustart (JSON-Roundtrip, Perzentil-Änderung, nächster Spieltag bucht denselben Betrag); Saison 2 mit Kompaktladung ohne Snapshots; Notbremse.

Laufzeit `scripts/miss-spieltagsbuchung-dauer.ts` (`bucheSpieltagFinanzen` für alle 32 Teams, 328 Kaderzeilen, neues GameState-Objekt je Spieltag):

| | Spieltag 1 (kalt, schreibt den Stand) | Spieltag 2 bis 4 (warm) |
|---|---:|---:|
| ohne Marketing (`aus-sofort`) | 133 ms | 95 bis 124 ms |
| Marketing mit `dauerCache` (vorher) | 734 ms | 84 bis 86 ms |
| Marketing mit Stand im Spielstand (nachher) | 698 ms | 81 bis 90 ms |

Schere reich/arm: die Zahlen der Nachbesserung 1 hängen an der Formel, nicht am Cache; die Vorschau rechnet dieselbe Formel mit denselben Eingaben (Saison 1 identisch). Eine Saison-2-Neumessung steht aus (nur der Farb-Meister der eigenen Liga ändert dort etwas, nicht neu gemessen).

## Abgleich Mockup – App (Aufnahmen `docs/design/marketing-bau-22-11/`, Team D-P, Live-Abbild-Kopie, nach dem main-Merge und den Review-Fixes)

Bildpaare „links Mockup, rechts App“ (`vergleich-<ansicht>-<größe>.png`, erzeugt mit `scripts/vergleich-marketing-bilder.mjs`):
Fan, Spieler, Verlauf je 1920x1080, 2560x1440 und 1710x1112; Finanzen-GuV und Transfermarkt-Marketability je 1920x1080 und 2560x1440. Die App-Aufnahmen (`app-*.png`) kommen aus
`scripts/screenshot-marketing-bau.ts`. Seitenscroll in allen Marketing- und GuV-Aufnahmen 0, keine JS-Fehler. Der Spielstand der Aufnahme hat noch keinen Marketing-Stand, die Seite zeigt deshalb
sichtbar „Vorschau“ im Kopf. Das Mockup kennt nur die Ansichten Fan/Spieler/Verlauf; für GuV und Transfermarkt gibt es kein Marketing-Mockup, verglichen wird mit
`finanzen-modern-18-11.html` und `transfermarkt-modern-18-11.html` (dort kommt nur eine Zeile bzw. Spalte dazu).

| Mockup-Merkmal | Stand |
|---|---|
| Kopf mit Wappen, Dachzeile, Titel „Marketing“, Untertitel mit Fanprofil, ans Team, an die Spieler | drin (Dachzeile trägt zusätzlich „Vorschau“ ohne Stand) |
| Kennzahl-Reiter Fans / Marketing / Verlauf mit großer Zahl, Aushängeschild rechts | drin |
| Tabelle „Dein Kader: wer wirbt, und warum?“, nur eigener Kader | drin |
| Spalten Reichweite-Stapel (Leistung, Ausstrahlung, Typ), Passung mit vier Beiträgen, Marketability, Werbegeld, Team-Anteil-Balken mit Gründen, ans Team, an ihn, Summenzeile | drin |
| Aushängeschild-Markierung „GESICHT“, Verletzt-Marke | drin |
| Karten „Wohin das Werbegeld geht“, „Team-Anteil: dynamisch“, „Aushängeschild“ | angepasst: Karte Aushängeschild zeigt Reichweite und Anteil als Text, kein „Schub durch Aktionen“ (Aktionen sind Folgeauftrag) |
| Rechte Spalte, Reiter Fanprofil (Ton-Skala, mag/meidet, Farbe der Fans) | drin |
| Reiter Spieler (drei Fragen: warum fällt er auf, warum passt er, wie viel bekommt das Team) | drin |
| Reiter Verlauf (Fanfarbe je Saison mit Grund, Schritt je Teamerfolg, Regel) | angepasst: zeigt nur die Saisons des echten Spielstands (hier nur der Start), das Mockup hat vier Beispielsaisons samt Prognose; Zeilen „Kader heute / Erfolg heute“ und „Neu gemocht seit Saison“ fehlen (Folgeauftrag 5) |
| Fußzeile mit Legende und Hinweis „Fremde Spieler: Marketability im Transfermarkt“ | drin (Hinweis und Einheit C je Saison) |
| Mockup-Steuerung (Teamumschalter H-R / G-G, Phone-Schalter, Vorschlag-Banner) | entfällt (nur Mockup) |
| Zahlen im Mockup (Beispielwerte für Moral, Vertrag, Klausel) | angepasst: die App rechnet mit echten Spielstandwerten |
| Tabelle ohne inneres Scrollen | angepasst: ab etwa acht Spielern scrollt die Tabelle innen, die Summenzeile bleibt unten |
| Spalte Marketability im Transfermarkt mit Nebel | drin (Spalte „Mkt“, Stufe nach Scouting; Kompaktliste und voller Pfad) |
| Posten „Marketing“ in der GuV (Teammarke + Team-Anteile) | drin |
| Icon in der Schiene | drin (Lautsprecher-Symbol, neu) |
| „neue Vorliebe“ im Fanprofil, Aushängeschild wählen, Werbeklausel verhandeln | fehlt (Folgeaufträge 1, 2, 5) |

Nebenbefund: die Transfermarkt-Seite meldet 36 px Seitenscroll (y) bei 1920x1080 und 2560x1440; nicht Teil dieses Baus, nicht untersucht.

## Folgeaufträge

1. Werbeklausel in der Vertragsverhandlung (drei Stufen, ±4 % Gehalt); das Feld `RosterEntry.marketingKlausel` ist vorbereitet und wird gelesen.
2. Aushängeschild-Wahl des Managers (Schreibweg über `authorizeServerRoomWrite`, delegierbar im Bereich Sponsor).
3. Aktionen als Werbeschub (MVP, Medaille, Szene, Skandal): Schub bleibt 0.
4. KI-Kaufbewertung mit Team-Anteil (höchstens +8 %), Verkaufsaufschlag fürs Aushängeschild.
5. Vorlieben wachsen, Stimmung/Fan-Shop-Faktoren der Teammarke, Fan-Boykott/Star-Debüt (Tickets, Stadion-Auftrag).
6. Marketability auch im Draft-Brett und im Spielerprofil.
7. Messung mit mehreren Saaten und Saison 2 (Drift, Teamerfolg); Einnahmenverhältnis 1,27 gegen Ziel 1,20 prüfen.
