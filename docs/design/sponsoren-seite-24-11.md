# Sponsorenseite neu (Phase 4, 24.11.)

Vorlage: `public/mockups/sponsoren-modern-22-11.html` (Ansichten `vertrag|angebote|liga|rechnung`), Rechenkern und View-Modell: `docs/design/sponsoren-rework-bau-24-11.md`.
Bildpaare **Mockup | App** (links Mockup, rechts echte App, je Ansicht in 1920x1080, 2560x1440 und 1710x1112): `docs/design/sponsoren-seite-24-11/paar-<ansicht>-<breite>.png`;
Einzelaufnahmen bei 1920 daneben. Aufnahme: `scripts/screenshot-sponsoren-seite.ts` (Wegwerf-SQLite, neues Spiel, 32 Teams, erstes Team menschlich, Topf-Regel ab Saison 1).

## Was gebaut ist

| Stelle | Inhalt |
|---|---|
| `app/foundation/sponsors-v2/SponsorenModern.tsx` | Kopf (Hero, vier Reiter, Saisonfaktor), Ansichten Vertrag und Angebote, Sponsorentermin-Karte |
| `app/foundation/sponsors-v2/SponsorenLigaRechnung.tsx` | Liga-Vergleich (16 Zeilen, alle 14 Spalten sortierbar) und „So rechnet der Saisonfaktor“ |
| `app/foundation/sponsors-v2/sponsoren-bits.tsx`, `sponsoren-modern.css` | Wappen, Farb-Marken, drei SVG-Diagramme, eigenes CSS im Mockup-Stil (Tokens `--bc-haus`, `--bc-zahl`) |
| `lib/sponsors/sponsor-seite-modell.ts` | reine Hilfen: Scouting-Nebel des Erwartungsrangs, Auszahlungsstufen, Faktor-Regler, Bilanz-Kennzahlen |
| `FoundationSponsorsPanel.tsx` | wählt: Topf-Regel -> neue Seite, sonst alte Seite mit Hinweis |
| `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx` | `chooseTeamSponsor(offerId, wahl?)` schickt `vertragsart`, `laufzeit`, `farben` an `POST /api/sponsor/choose`; neu `answerSponsorTermin(terminId, antwort)` -> `POST /api/sponsor/event` mit `antwort`, danach frisches `loadSave` (die Zusage ändert Kasse, Ereignisse und Form) |
| `lib/sponsors/sponsor-uebersicht.ts` (Rechenzweig, minimal) | **neu: `ligaBilanz`** (beide Ligen mit Ergebnis bei Erwartung + Summe der Grundbeträge je Liga) für Säulenbild und Verhältnis Liga 1 : Liga 2; Text der Kader-Ersatz-Formel auf 6 % (+8 % in Saison 1) korrigiert |

Mehrspieler: das Team kommt aus `selectedTeamId` (aktives Team der Shell), Schreibrecht aus `selectedTeamCanManage`; beide Schreibwege laufen unverändert hinter `authorizeServerRoomWrite`. Die Phase-Sperre (`sponsor_choice`) sperrt „Unterschreiben“ und nennt den Grund.

## Alter Spielstand

`baueSponsorUebersicht` liefert `null` -> die **alte** Seite (`FoundationSponsorsNewLook`) bleibt unverändert zuständig, darüber ein Hinweisband „Neues Sponsorensystem gilt ab der nächsten Saison“. Die alte Seite wird **nicht** entfernt: unter der alten Regel läuft dort die Wahl (Leiter, Seltenheit, Achsen), und `FoundationPrizeFinanceHost`, `SponsorOfferCardNewLook` und sechs Tests hängen an ihr. Sie fliegt in der Folge-PR raus, wenn kein Spielstand mehr unter „alt“ läuft.

## Abgleich Mockup gegen App

**drin**
- Kopf mit Wappen, vier Reitern und Saisonfaktor-Kachel; Reiter „Laufender Vertrag“ trägt den Markennamen.
- Vertrag: Hauptsponsor mit Wappen, Zeilen Grundbetrag, Leistungsteil, Farb-Partner, Ziel, Hochrechnung (**groß je Saison, klein je Spieltag**), Tabelle „Endet die Saison auf“, Leistungsteil-Diagramm (Platz je Spieltag gegen Erwartungsrang, Abschlag-Säulen), Farb-Partner je Farbe mit Spitze, Sponsorentermine.
- Sponsorentermin als Entscheidung: **Zusagen / Absagen / An die KI geben**, gesperrt ohne Verwaltungsrecht.
- Angebote: drei Karten mit Wappen, Vertragsart (Fest/Leistung/Prämie), Grundbetrag, Satz je Platz, Zieleinsatz, Auszahlungstabelle und Kurve, **Passungszeile** („Passung −4 % (Beliebtheit niedrig, 1 Saison Treue)“); rechts Laufzeit 1 bis 3, zwei Farben, Ziel, Summe, „KI wählen lassen“, „Unterschreiben“. Keine Seltenheitsstufen.
- Liga-Vergleich: 16 Teams, alle Spalten sortierbar, eigenes Team markiert, Balken „Ergebnis bei Erwartung“, Fußzeile mit Mittel, Teams im Plus, Gefälle, größter zu kleinstem Grundbetrag.
- Rechnung: vier Schritte, Formel, Beispiel, Faktor-Regler, Säulenbild beider Ligen, Liga-Bilanz.
- Scouting-Nebel: fremde Erwartungsränge nur als Viertel (1–4, 5–8, 9–12, 13–16), Sortierung nach der Untergrenze; „Fog of War aus“ (`scenarioMeta.scoutingNebelAus`) macht sie exakt.

**angepasst (warum)**
- Angebotskarten: im Mockup eine Karte je Vertragsart mit eigener Marke; im Datenmodell hat jede **Marke** alle drei Arten. Eine Karte je Marke, die Art wählt man per Chip, Tabelle und Kurve folgen.
- Prestige-Tabelle (Seltenheit) ersetzt durch „Passung der Marke“ (Entscheidung 3, 23.11.).
- Farb-Partner-Chips zeigen den **Kaderrang** (Stärke des Kaders in der Farbe unter allen 32 Teams, derselbe Wert, nach dem die KI wählt) statt „Liga-Rang nach Farb-Punkten“: Farb-Punkte gibt es erst mit gespielten Spieltagen.
- Kosten-Spalte statt „Gehalt“ (das Modell führt Kosten = Gehälter + Unterhalt – Planeinnahmen).
- Liga-Vergleich: Spalten Leistung, Farbe, Ziel einzeln; Ergebnis bei Erwartung statt „Ergebnis neu“.
- Rechnungsansicht: Säulen je Liga nach Ergebnis absteigend sortiert (nicht nach Erwartungsrang), weil die Erwartungsränge fremder Teams im Nebel liegen.
- Sponsorentermin: die Mockup-Karte „Ereignisse“ (alte Würfel-Klauseln) entfällt, es gibt nur noch Termine.
- Leistungsteil-Diagramm: Achse bis höchstens Platz 16, passend zur Ligagröße.

**fehlt (warum)**
- „Nachfordern, einmal je Angebot“: nicht gebaut (Konzept 4.6, Phase 5, keine Route).
- Zielwahl „Entwicklung / Kaderpflege / Ausbau / Solidität“: das Ziel hängt am Angebot (Achsen-Karte), es gibt keine Wahl; die Seite zeigt Name und Einsatz des Angebotsziels oder „kein Ziel“.
- „Heute: Vertragsanker minus Gehalt“ (graue Säulen, Spalten „heute“, „Ergebnis heute“, „Warum weniger als heute?“): braucht das alte System als Vergleich, im Datenmodell nicht mehr vorhanden. Kein erfundener Ersatz.
- Vorstandszitat und Beispiel-Marken „BEISPIEL“: Mockup-Erfindung ohne Datenquelle.
- Erwartungsrang-Spaltenkopf der Angebote mit Vorjahr: nur der gemeinsame Erwartungsrang (Vorstand) ist Quelle.

## Gefundene und behobene Mängel (2 Schleifen)

1. Chip-Beschriftung „Leistungs“ (aus `replace("vertrag", "")`) -> feste Kurzformen Fest / Leistung / Prämie.
2. „Liga-Rang 22“ bei den Farb-Chips: der Rang ist gegen 32 Teams -> als „Kaderrang“ beschriftet und erklärt.
3. Liga-Vergleich: Tabelle höher als das Panel, der Hero rutschte beim Klick nach oben (Seitenscroll in der Hülle) -> Tabelle füllt die Panelhöhe, kein Überlauf mehr.
4. Angebotskurve: „Erwartung 51,7 C“ überlagerte den Endwert bei Erwartungsrang 15 -> Beschriftung wechselt die Seite, Endwert entfällt in den letzten Rängen.
5. Aufnahme-Skript: Saison-Briefing legte sich über die Reiter -> schließt vor jedem Klick.

Offen/akzeptiert: bei 1710x1112 kürzt „Liga-Vergleich“ im Reiter ab (Reiter schrumpfen gleichmäßig, Text bleibt über das Tooltip lesbar).

## Probleme, die ich im Rechenkern sehe (Entscheidung nötig)

- **Vorschau-Grundbetrag gegen Richtwert**: vor dem Stichtag zeigt die Vertragsansicht den *live* gerechneten Grundbetrag (z. B. 24,5 C), das Angebot nannte den Richtwert 51,7 C und eine Vorab-Zusage von 47 C. Am Stichtag hebt die Zusage auf mindestens 90 % des vorläufigen Betrags. Die Vorschau sollte dieselbe Untergrenze anwenden (Rechenzweig) oder die Seite die Zusage nennen; bis dahin steht am Marker „Vorschau“ ein Hinweis.
- Alle Teams starten im neuen Spiel mit Kosten ≈ 0 (kein Kader vor dem Draft), das „Ergebnis bei Erwartung“ ist deshalb vor dem Draft überall stark positiv. Sinnvoll erst nach dem Draft lesen.
- Der Faktor-Regler leitet die Wert-Korrektur aus den gezeigten Größen ab (`topfBeiFaktor`); sobald `TopfStand.rechnung.wertKorrektur` auf dem Rechenzweig steht, ersetzt die Seite die Ableitung durch den Wert.

## Tests

`tests/sponsoren-seite-modern.test.tsx` (8): alle vier Ansichten gerendert, Passung, drei Arten, 16 Zeilen mit 14 sortierbaren Köpfen, Nebel, Sperre ohne Verwaltungsrecht, Helfer. 35 weitere Dateien, die Panel, Shell oder View-Modell lesen, bleiben grün (334 Tests). Wertungs-Fingerabdruck `GESAMT fe1dc086d68d` unverändert, alle sechs Schutzsummen unverändert. `tsc --noEmit`: keine Fehler in den berührten Dateien. Browser-Bündel der Seite (esbuild `--platform=browser`) enthält keine `node:`-Module.
