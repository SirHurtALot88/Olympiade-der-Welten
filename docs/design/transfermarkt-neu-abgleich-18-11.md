# Transfermarkt neu: Abgleich Mockup | App (18.11.2026)

Gebaut nach `public/mockups/transfermarkt-modern-18-11.html` (Fable) und `docs/design/transfermarkt-modern-18-11.md`.
Neue Komponente `app/foundation/transfermarkt-modern/`, eigenes CSS unter `.tmk`, alte Markt-Seite entfernt. Kein zweiter
Kauf-/Verkaufsweg: Vorschau und Abschluss laufen über `/api/transfermarkt/buy`, `/api/transfermarkt/sell` und
`/api/contracts/renewal`, das Verhandlungsgedächtnis wird wie bisher geschrieben.

Bilder aus der echten App (Wegwerf-Battle-Save, `scripts/screenshot-transfermarkt-neu.ts`, Port 3216):
`docs/design/transfermarkt-neu-18-11/`.

## App-Rahmen

Reiter (Markt · Verkauf · Verträge · Historie · Draft „bald") und der Fenster-Status (Phase, Kauf offen/zu, Verkauf offen/zu)
stehen im Seiten-Slot des Regierbands (`FoundationBandSlot`). Die Seite hat keine eigene Kopfzeile mehr; die Hauptaktion und
Kasse trägt das Band. Der Reiter „Vertragsangebot“ im Unterreiter ist der des Rahmens (öffnet den Verhandlungstisch).

## Scouting-Nebel (Chris, 18.11.: Pflicht), feste Stufen

Regel wie im Kader-&-Teams-Mockup: **unbekannt 10er-Stufe, beobachtet 5er-Stufe, gescoutet exakt**. Angezeigt wird die Stufe,
nie „~Zahl“, nie eine Spanne um den wahren Wert. Eine Stelle, `lib/market/transfermarkt-sicht.ts`, baut aus dem Feed-Eintrag die
**sichtbare Sicht**; die Seite liest nur sie. Der **Marktwert** ist für alle Spieler exakt sichtbar (kein Nebel).

| Größe | Unbekannt (Stufe 0) | Beobachtet/teilweise (1–4) | Gescoutet (5) |
|---|---|---|---|
| Eignung je Disziplin (alle 20) | 10er-Stufe „90–99“ | 5er-Stufe „85–89“ | exakt |
| Achsen POW/SPE/MEN/SOC | Zweier-Gruppe „B–A“ | Note „B“ | Note |
| Attribute (Wege zum Erfolg) | aufgedeckte nur als Gruppe | als Note (nie genauer, auch bei Stufe 4 keine Zahl) | Note |
| Erwartete PP | grob auf halbe Punkte („≈ 4,5–5,0“, oben gedeckelt „≈ 5,0“) | wie links aus der 5er-Stufe | exakt |
| Kaderrang mit ihm | Rangspanne aus der Stufe | Rangspanne | exakt |

**Sortieren und Filtern** nur nach Stufe: der Schlüssel ist die Mitte der Stufe (für alle Spieler der Stufe gleich), bei
Gleichstand entscheidet der Name, dann die Id (`sortiereNachSicht`). Die Filter „kann meinen Rang heben“ und „Achse ≥ B“ nutzen die
obere Grenze der Stufe. Der Lesedienst liefert dafür neu `disciplineEstimates` (alle 20 Disziplinen, mit der Stufe des Spielers
fürs gewählte Team). Tests: `tests/transfermarkt-sicht-nebel.test.ts` (innerhalb einer Stufe alphabetisch, auch wenn die wahren
Werte umgekehrt liegen; 99 und 90 sind ungescoutet nicht unterscheidbar; Stufe 4 zeigt Attribute nur als Note).

**Fog of War abschaltbar:** `scenarioMeta.scoutingNebelAus` im Spielstand (Standard: fehlt = Nebel AN; es gab keine bestehende
Einstellung). Aus: der Lesedienst rechnet jeden Spieler als voll gescoutet, die Sicht zeigt exakte Werte und sortiert nach ihnen,
das Panel trägt „Nebel aus (Test)“. `lib/market/transfermarkt-nebel-einstellung.ts`, Test `tests/transfermarkt-nebel-aus.test.ts`
(beide Fälle). Einen Schalter in der Oberfläche gibt es nicht; die Einstellung wird im Spielstand gesetzt.

Bekannt: der Feed enthält Rohwerte weiterhin im Netzwerkverkehr (andere Abnehmer, KI-Dienste); die Oberfläche zeigt, sortiert und
filtert sie nicht (ein Vertragstest hält das fest). Das Potenzial im Panel kommt als Spanne aus dem vorhandenen Potenzial-Scouting
(`buildPlayerScoutPotential`) und ist noch nicht auf feste Stufen umgestellt.

## Vorgaben von Chris (18.11.), eingearbeitet

- Kaderstärke über die **besten 6**; Rang gegen die eigene Liga; Verletzte zählen nicht.
- **Gehalt: groß je Saison, klein darunter je Spieltag**, überall (Liste, Panel, Geld-Block, Vergleich, Verkauf, Verträge, Tisch).
- Einheit C; Fit, Value-Chip, Bracket, gespeicherte Suchen entfallen (Value nur als Sortierung).
- Ein gemeinsames Transferfenster in der Anzeige: Phase, Kauf und Verkauf getrennt als offen/zu.
- Verkauf und Verträge zeigen die Saison-Leistung (PP mit Liga-Rang). Form folgt mit Form/Moral (Spalte angelegt).
- Draft: nur Platzhalter-Reiter.
- **Vorstand-Freigabe** als Datenvertrag `lib/market/transfermarkt-freigabe.ts` (Kontostand, freigegeben, ausgegeben, noch frei,
  gesperrt mit Grund; harte Sperre nur für den Abschluss, Ablöse plus Gehalt; Verkaufserlös nur zur Quote frei, „davon werden
  X C frei“). Der Host übergibt heute `freigabe: null`, dann zeigt die Seite nur den Kontostand. Finanzen-Stufe 3 füllt `freigabe`.
- **Was ist diese Saison wichtig?** Kaderstärke-Block mit Auftritten, Slots, eigener Stärke, Liga-Rang, Bedarfs-Hinweis, nach
  Wichtigkeit sortierbar; die gewählte Disziplin trägt das in die Liste (`lib/market/transfermarkt-disziplin-bedarf.ts`).

## Kauf und Verkauf geprüft (Integrationstest)

`tests/transfermarkt-modern-integration.test.ts` fährt die Produktionswege (`previewLocal…`/`executeLocal…`,
`previewContractRenewalAction`/`applyContractRenewalAction`) gegen einen Wegwerf-Spielstand mit genug Kasse:

- **Kauf:** Vorschau, Angebot an der Zusage-Schwelle, abschließen. Spieler im Kader, Kasse um die Ablöse gesenkt, Gehalt um sein
  Gehalt erhöht, Laufzeit stimmt; derselbe Idempotenz-Schlüssel bucht nicht doppelt.
- **Verkauf:** im Kauffenster (Saisonstart) liefert die Vorschau `canSell: false` mit `sell_only_at_season_end` (so ist der **409 der
  Route**: Fenster zu, nicht ein Fehler; die Vorschau trägt dann keine Preise). Die Seite sagt das jetzt klar („Verkaufsfenster zu“,
  Text aus `translateSellBlockingReason`) statt „Vorschau lädt“. Im Verkaufsfenster (`transfer_sell_phase`): Vorschau mit Erlös,
  abschließen, Spieler weg, Kasse um den Erlös erhöht.
- **Verlängerung:** Vorschau mit Forderung, Bestätigung, anwenden; Laufzeit und Gehalt stehen im Kader.

Die Routen selbst brauchen eine Sitzung (Cookies) und sind im Test nicht aufrufbar; ihre Phasensperren werden mit derselben Funktion
geprüft (`evaluateGamePhaseAction`). Im Browser lief der Kauf bis zum Abschluss und der Verkauf mit Erlös (Bilder 05, 06, 07).
Hinweis: Kauf- und Verkaufsfenster sind in der Phasen-Politik noch getrennt (Kauf bei Saisonstart, Verkauf am Saisonende); das
„gemeinsame Fenster“ ist hier nur die Anzeige, die Politik (`transfer-window-policy.ts`) ist nicht geändert.

## Drin / Angepasst / Fehlt

**Drin:** Markt (15 Zeilen je Blatt), Disziplin-Fokus über 20 Disziplinen, Geld-Block, Kaderstärke mit „mit ihm“, Spieler-Panel mit
PixelLab-Figur (sonst Porträt), Wege zum Erfolg, Wirkung auf den Kader, Merkliste, Vergleich (bis drei), Verhandlungstisch (Kauf und
Verlängerung), Verkauf mit zweistufiger Bestätigung, Verträge mit Gehaltslast je Saison.

**Angepasst:** Kopfzeile im Rahmen-Slot; „Gesamt“ fehlt (wäre ein wahrer Wert), dafür Potenzial; Form/Moral fehlen bis zum Bau; der
Vertragswunsch kommt im Tisch aus der Server-Vorschau.

**Fehlt:** echte Freigabe-Zahlen, Rücklage-Ziel, Kassensturz, Apron-Linien, Abschlag in den Liga-Topf (Finanzen V2); Form/Moral;
Verletzungsdauer; Draft-Neubau; Rohwerte aus dem Feed-Payload entfernen; Potenzial auf feste Stufen; die echte PP-Umrechnung (die
Gerade des Mockups ist eine Näherung); ein Schalter für den Nebel in der Oberfläche. Alte Reste bis zum Teams-Umbau:
`FoundationMarketSellShellHost` (Verkaufs-Dialog der Teams-Ansicht) und `.nl-market-deal-*` in `globals.css`.

## Design-Token-Lint

`scripts/lint-design-tokens.ts` meldet 220 Verstöße, keiner in Dateien dieses PR (neuer Ordner, `lib/market`, Skript, Tests). Die
veralteten Baseline-Einträge der gelöschten Dateien sind entfernt.
