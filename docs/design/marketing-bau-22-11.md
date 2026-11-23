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

Entscheidungen des PM: Teammarke 4,0 C in beiden Ligen; Spieler-Anteil geht nie in die Kasse (hebt die Moral); Fans mögen/meiden nur echte
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
Einnahmenverhältnis 1,23 → 1,27, über dem Zielwert 1,20 des Finanzpapiers). Stellschrauben: Höchstwert Liga 1 senken. Marketing liegt knapp unter
der Konzeptrechnung (≈ 234 C bei acht Spielern je Team), weil die KI-Kader wenige Spieler mit Kante haben.

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
