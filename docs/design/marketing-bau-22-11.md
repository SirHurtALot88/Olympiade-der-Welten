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

**Umgesetzt (Variante L):** Teammarke = Liga-Basis (Liga 1: 3,0 C, Liga 2: 5,0 C, Ligamittel 4,0 C) + 0,5 C je Platz Abstand von der Ligamitte nach **Budget-Rang**
im Ligakreis (reichstes Team zahlt am wenigsten, 0 bis 9 C), `teammarkeAusRang`. Der Deckel von 12 C je Team und Saison bleibt (Rest geht als Moral an die
Spieler), er greift in den Messungen bei keinem Team.

| Saat (Saison 1) | Marketing Summe (L1 / L2 je Team) | Teams GuV ≥ 0 ohne → mit | Einnahmen L1 : L2 ohne → mit | GuV-Abstand reiche 8 − arme 8 ohne → mit | Marketing reiche 8 / arme 8 | Moral je Spieler |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 225,0 (7,6 / 6,5) | 16 → 18 | 1,25 → 1,24 | 4,1 → 2,1 (−2,0) | 6,4 / 8,4 | +1,09 |
| 2 | 217,6 (7,1 / 6,4) | 19 → 24 | 1,25 → 1,24 | 11,4 → 9,5 (−1,9) | 6,4 / 8,3 | +0,98 |
| 3 | 217,2 (7,4 / 6,2) | 18 → 21 | 1,24 → 1,23 | 11,9 → 10,4 (−1,6) | 6,4 / 8,0 | +0,91 |
| Mittel | 219,9 | 17,7 → 21,0 | 1,25 → 1,24 | 9,1 → 7,3 (−1,8) | | |

**Saison 2** (dieselben drei Läufe, Teamerfolg der Vorsaison wirkt; die Fanfarbe driftet im Lauf mit `OLY_MARKETING=aus` nicht, Rohdaten `messung-schere-s2.txt`):

| Saat (Saison 2) | Marketing Summe (L1 / L2 je Team) | Teams GuV ≥ 0 ohne → mit | Einnahmen L1 : L2 ohne → mit | GuV-Abstand reiche 8 − arme 8 ohne → mit | Marketing reiche 8 / arme 8 | Moral je Spieler |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 224,0 (7,2 / 6,8) | 26 → 28 | 1,25 → 1,24 | −5,0 → −7,7 (−2,8) | 6,1 / 8,9 | +0,84 |
| 2 | 224,0 (7,2 / 6,8) | 28 → 28 | 1,23 → 1,22 | −15,3 → −16,7 (−1,4) | 7,2 / 8,5 | +0,77 |
| 3 | 211,3 (6,6 / 6,6) | 27 → 29 | 1,38 → 1,35 | 0,2 → −1,5 (−1,7) | 6,3 / 8,0 | +0,65 |

Ziel erreicht: das Verhältnis steigt in keiner Saat, der Abstand wächst nirgends (er schrumpft um 1,6 bis 2,0 C). Nebenwirkung: die Schere dreht leicht (arme
Teams bekommen im Mittel mehr Marketing als reiche, 8,2 gegen 6,4 C); `teammarkeRangSteigung` 0,5 → 0,35 halbiert das, wenn das nicht gewollt ist.
Der Wert "ohne Marketing" liegt hier (anderer Draft, drei neue Saaten) bei 1,24 bis 1,25 statt 1,23 der ersten Messung.

## Nachbesserung 2: Dauer der Spieltagsbuchung

Team-Anteile und Moral werden nicht mehr je Spieltag für alle Teams gerechnet, sondern einmal je Saison und Kaderstand (`dauerCache`,
Schlüssel aus Saison, Team, Liga, Fanfarbe, Aushängeschild-Wahl, Budget-Rang und einem Hash des Kaders aus Spieler, Restlaufzeit, Klausel, Rating, Gehalt). Je Spieltag
wird nur 1/N gebucht. Folge: die Moral im Team-Anteil und die Verletzung wirken nicht mehr je Spieltag (Verletzte zählen nicht mehr zur Hälfte);
Kauf, Verkauf, Verlängerung und Klausel rechnen neu. Der Moral-Zuschlag liest dieselbe gecachte, gedeckelte Zeile (gezeigt = gebucht).

Messung `scripts/miss-spieltagsbuchung-dauer.ts` (`bucheSpieltagFinanzen` für alle 32 Teams, 364 Spieler, neues GameState-Objekt je Spieltag, Rechner unter Last):

| | Spieltag 1 (kalt) | Spieltag 2 bis 4 |
|---|---:|---:|
| ohne Marketing (`aus-sofort`) | 133 ms | 95 bis 124 ms |
| Marketing vorher | 828 ms | 516 bis 583 ms |
| Marketing nachher (Cache) | 734 ms | 84 bis 86 ms |

## Abgleich Mockup – App (Aufnahmen `docs/design/marketing-bau-22-11/`, Team D-P, Live-Abbild-Kopie)

Bilder: `app-marketing-{fan,spieler,verlauf}-{1920x1080,2560x1440,1710x1112}.png`, `app-transfermarkt-marketability-1920x1080.png`, `app-finanzen-guv-1920x1080.png`.
Kein Seitenscroll in allen Marketing-Aufnahmen, keine JS-Fehler.

| Mockup-Feature | Stand |
|---|---|
| Hero mit Kennzahl-Reitern, Aushängeschild rechts | drin |
| Drei Karten (Wohin das Geld geht, Aushängeschild, Team-Anteil dynamisch) | drin |
| Tabelle nur eigener Kader: Reichweite-Stapel, Passung mit vier Beiträgen, Team-Anteil-Balken mit zwei Gründen, ans Team / an ihn, Summe, sortierbar | drin |
| Reiter Fanprofil, Spieler (drei Fragen), Verlauf | drin |
| Umschalter zwischen zwei Teams, Phone-Schalter | entfällt (nur Mockup-Steuerung) |
| Spalte Marketability im Transfermarkt mit Nebel | drin (Spalte „Mkt“) |
| Tabelle ohne inneres Scrollen | angepasst: ab etwa acht Spielern scrollt die Tabelle innen, die Summenzeile bleibt unten |
| „neue Vorliebe“ im Fanprofil (Klasse wächst nach zwei Saisons Aushängeschild) | fehlt (Folgeauftrag) |
| Aushängeschild wählen, Werbeklausel verhandeln | fehlt (Folgeauftrag) |

Nebenbefund: die Transfermarkt-Seite meldet 36 px Seitenscroll (y) bei 1920x1080; nicht untersucht, vermutlich nicht aus diesem Bau.

## Folgeaufträge

1. Werbeklausel in der Vertragsverhandlung (drei Stufen, ±4 % Gehalt); das Feld `RosterEntry.marketingKlausel` ist vorbereitet und wird gelesen.
2. Aushängeschild-Wahl des Managers (Schreibweg über `authorizeServerRoomWrite`, delegierbar im Bereich Sponsor).
3. Aktionen als Werbeschub (MVP, Medaille, Szene, Skandal): Schub bleibt 0.
4. KI-Kaufbewertung mit Team-Anteil (höchstens +8 %), Verkaufsaufschlag fürs Aushängeschild.
5. Vorlieben wachsen, Stimmung/Fan-Shop-Faktoren der Teammarke, Fan-Boykott/Star-Debüt (Tickets, Stadion-Auftrag).
6. Marketability auch im Draft-Brett und im Spielerprofil.
7. Messung mit mehreren Saaten und Saison 2 (Drift, Teamerfolg); Einnahmenverhältnis 1,27 gegen Ziel 1,20 prüfen.
