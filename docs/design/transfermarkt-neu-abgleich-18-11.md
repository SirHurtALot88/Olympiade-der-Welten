# Transfermarkt neu: Abgleich Mockup | App (18.11.2026)

Gebaut nach `public/mockups/transfermarkt-modern-18-11.html` (Fable) und `docs/design/transfermarkt-modern-18-11.md`.
Neue Komponente `app/foundation/transfermarkt-modern/`, eigenes CSS unter `.tmk`, alte Markt-Seite entfernt. Kein zweiter
Kauf-/Verkaufsweg: Vorschau und Abschluss laufen über `/api/transfermarkt/buy`, `/api/transfermarkt/sell` und
`/api/contracts/renewal`, das Verhandlungsgedächtnis wird wie bisher geschrieben.

Bilder aus der echten App (Wegwerf-Battle-Save im Transferfenster, `scripts/screenshot-transfermarkt-neu.ts`, Port 3216):
`docs/design/transfermarkt-neu-18-11/`.

## Scouting-Nebel (Chris, 18.11.: Pflicht)

Eine Stelle, `lib/market/transfermarkt-sicht.ts`, baut aus dem Feed-Eintrag die **sichtbare Sicht** eines Spielers. Die Seite
liest nur diese Sicht, nie `pow`/`ovr`/`mvs`/Tier-Rohwerte (der Feed schickt sie technisch mit; ein Vertragstest hält fest, dass
die Komponenten sie nicht anfassen).

| Größe | Sichtbar als | Quelle |
|---|---|---|
| Eignung je Disziplin (alle 20) | Schätzung mit Spanne (`~72`, Balken mit Spannenband); ab Scouting-Stufe 5 exakt | `buildScoutedDisciplineTiers` über das neue Feld `disciplineEstimates` des Lesedienstes (Stufe je Spieler und Team aus `getEffectiveScoutingLevel`); Halbbreite der Spanne je Stufe 11,5 / 8,5 / 6,25 / 4 / 2 / 0 (Summe der Rausch-Amplituden der Schätzung) |
| Achsen POW/SPE/MEN/SOC | Tier-Bereich („B-C"), exakt erst bei hoher Sicherheit | `getScoutingTierWindow` |
| Attribute (Wege zum Erfolg) | aufgedeckt als Note oder Bereich, sonst „?" | `buildTransfermarktScoutedAttributeRows` |
| Erwartete PP | Spanne („≈ 2,1–3,4") aus der Eignungs-Spanne; Näherung (Gerade des Mockups, Umrechnung aus den PP-Referenzen steht aus) | `erwartetePpSpanne` |
| Kaderrang mit ihm | Rangspanne („9.–11.") aus unterer und oberer Spannengrenze | `wirkungMitKandidat` |

**Sortieren und Filtern:** der Schlüssel ist die Mitte der sichtbaren Spanne; Gleichstand entscheidet der Name, dann die Id,
nie ein wahrer Wert (`sortiereNachSicht`). Unbekanntes steht am Ende. Der Filter „kann meinen Rang heben" und „Achse ≥ B" nutzen
die obere Grenze der sichtbaren Spanne („könnte reichen"). Test: `tests/transfermarkt-sicht-nebel.test.ts` (zwei Spieler mit
gleicher sichtbarer Spanne, stark unterschiedlichem wahren Wert: Reihenfolge ändert sich beim Tauschen der wahren Werte nicht;
die Sicht enthält keinen der Rohwerte).

Bekannt: der Feed enthält die Rohwerte weiterhin im Netzwerkverkehr (alter Zustand, andere Abnehmer wie die KI-Dienste). Die
Oberfläche zeigt, sortiert und filtert sie nicht. Sie serverseitig zu entfernen ist ein eigener Schritt.

## Vorgaben von Chris (18.11.), eingearbeitet

- Kaderstärke über die **besten 6**; Rang gegen die eigene Liga (`leagueTeamIds`, sonst alle Teams); Verletzte zählen nicht.
- Gehalt überall **je Spieltag und je Saison** (Liste, Fokus, Verhandlungstisch, Verkauf, Verträge).
- Fit, Value-Chip, Bracket, gespeicherte Suchen entfallen; „Value" ist nur noch eine Sortierung. Einheit überall **C**.
- Ein gemeinsames Transferfenster: die Kopfzeile zeigt Phase, Kauf und Verkauf getrennt als offen/zu.
- Verkauf und Verträge zeigen die **Saison-Leistung** (PP mit Liga-Rang). Form folgt mit Form/Moral (Spalte ist angelegt).
- Draft: nur Platzhalter-Reiter („bald"), er führt zurück zum Markt (heutiger Draft-Weg).
- **Vorstand-Freigabe**: Datenvertrag `lib/market/transfermarkt-freigabe.ts` (`TransferFreigabe`: Quote, freigegeben, ausgegeben,
  Grund). Der Geld-Block zeigt Kontostand, davon freigegeben, schon ausgegeben, noch frei, gesperrt mit Grund; die Sperre ist
  **hart** (Ablöse plus Gehalt über dem freien Betrag sperrt den Abschluss, Verhandeln bleibt möglich); im Verkauf steht „davon
  werden X C frei". Der Host übergibt heute `freigabe: null`, die Seite zeigt dann nur den Kontostand. Anschluss: Finanzen-Stufe 3
  füllt `freigabe` im Host (`FoundationMarketV2ShellHost`). Stufen nach Vertrauen als Funktion bereit (`freigabeQuoteAusVertrauen`).
- **Was ist diese Saison wichtig?** Der Kaderstärke-Block zeigt je Disziplin Auftritte in der Saison (aus dem Spielplan,
  `getSeasonDisciplineSchedule`, vor dem ersten Spieltag aus der Saisonvorlage), Einsatz-Slots, eigene Stärke (beste 6) und
  Liga-Rang, sortierbar nach Wichtigkeit (Auftritte × Slots) und mit Bedarfs-Hinweis („häufig, aber schwach besetzt"); die
  gewählte Disziplin trägt das in die Liste (Filterleiste, Fußzeile). `lib/market/transfermarkt-disziplin-bedarf.ts`.

## Drin

Markt als Seite (15 Zeilen je Blatt, drei Spalten), Disziplin-Fokus über alle 20 Disziplinen, Geld und Freigabe links, Kaderstärke
mit „mit ihm", Spieler-Panel mit PixelLab-Figur (sonst Porträt) vor der Disziplin-Kulisse, Eignungsprofil, Wege zum Erfolg
(Primär-/Nebenweg/offen), Wirkung auf den Kader, Charakter, Kosten, Merkliste, Profil, Vergleich bis zu drei Spieler,
Verhandlungstisch (Kauf und Verlängerung) mit Zusage/Gegenangebot/Absage, Verkauf mit zweistufiger Bestätigung und Erlös,
Verträge mit Gehaltslast je Saison. Von außen geöffnete Deals (Hauptaktion, Spieler-Drawer) öffnen den Verhandlungstisch.

## Angepasst gegenüber dem Mockup

- Kein Regieband im Rahmen: der Rahmen ist noch nicht auf main; die Reiter und der Fenster-Status stehen in einer eigenen
  Kopfzeile der Seite und wandern später in den Slot.
- „Gesamt" fehlt (wäre ein wahrer Wert); statt dessen Potenzial als Spanne aus dem Scouting.
- Form und Moral (Liste, Fokus) fehlen bis Form/Moral gebaut ist; die Verkaufs-Spalte „Form" ist angelegt.
- Vertragswunsch (Wunschlaufzeit/-form) kommt im Verhandlungstisch aus der Server-Vorschau, nicht im Fokus-Panel.
- Verkaufsfaktor und Erlös kommen aus der echten Vorschau (nicht fest 0,90).

## Fehlt

- Echte Freigabe-Zahlen und Rücklage-Ziel, Kassensturz-Vorschau, Apron-Linien (Finanzen V2).
- Abschlag → Liga-Topf (Finanzen V2).
- Form/Moral; Verletzungsdauer („n Spieltage"): es gibt nur „verletzt".
- Draft-Neubau (16 Runden, höchstens 14 Spieler, Verhandlung im Draft, Skip): eigener Schritt.
- Rohwerte aus dem Feed-Payload entfernen (siehe oben).
- Alte Reste: `FoundationMarketSellShellHost` (Verkaufs-Dialog der Teams-Ansicht) und `.nl-market-deal-*` in `globals.css` bleiben,
  bis die Teams-Seite neu gebaut ist; sonst ist die alte Markt-Seite samt Kauf-Modal entfernt.
