# Office: Vorstand, Ziele, Gespräch, Prämien — Bau (21.11.)

Mockup `public/mockups/office-vorstand-21-11.html`, Erklärung `docs/design/office-vorstand-21-11.md` (dort „Entscheidungen Chris 21.11.“).
Gebaut sind beide Stufen: **A** (Vorstand und Ziele, Gespräch, Zielsystem, Ablösung der Finanz-Knöpfe) und **B** (Prämien: Sieg- und Treueprämie).

## Wo was liegt

| Teil | Datei |
|---|---|
| Seite, Reiter | `app/foundation/office/OfficeModern.tsx` (+ `OfficeVorstandTab`, `OfficeGespraechTab`, `OfficePraemienTab`, `office-modern.css`) |
| Modell der Seite (nichts neu gerechnet) | `lib/finance/office-modell.ts` |
| Zielarten, Laufzeit, Lieblingsspieler, Widerspruchsprüfung | `lib/board/vorstand-ziele-erweitert.ts`, Einbau in `lib/board/team-season-objectives-service.ts` |
| Gespräch (Waage, Antrag, Gegenangebot) | `lib/finance/vorstand-gespraech.ts`, Zustand `vorstand-gespraech-zustand.ts` |
| Prämien | `lib/finance/vorstand-praemien.ts` |
| Schreibweg | `POST /api/finance/vorstand` (`gespraech_antrag`, `gespraech_annehmen`, `gespraech_zurueckziehen`, `praemien_setzen`) hinter `authorizeServerRoomWrite`, frisch vom Server gelesen |
| Tests | `tests/office-vorstand-21-11.test.ts` (22), angepasst: `tests/finanzen-seite-modern.test.tsx`, `tests/team-season-objectives-service.test.ts` |

## Fund: Geldstrafe wurde noch gebucht

`penaltyCash` wurde in `buildTeamSeasonObjectiveSettlement` als **negativer Cash-Betrag** gebucht (verfehltes Ziel zog 1 bis 10 C ab), und das Ziel
„Vorstandsvertrauen wiederherstellen“ kündigte „Der Vorstand kürzt das Budget um X M“ an. Beides widersprach der Vorgabe vom 18.11.
**Behoben:** ein verfehltes Ziel bucht nie Geld (nur `rewardCash` bei Erfüllung); der Hinweis spricht von weniger Freigabe. Das Feld bleibt als totes Altfeld an den
Datensätzen (viele Tests und Generatoren schreiben es), wird nirgends gebucht und im Office nicht gezeigt (Test prüft `penaltyCash|Malus` nicht im Modell).
Offen: `FoundationTeamsDetailPanel.tsx` (Pille „Malus“) und die Sponsor-Karten (`penaltyCash` des Sponsor-Vertrags, andere Quelle) zeigen es weiter.

## Entscheidungen im Bau (Annahmen, bitte prüfen)

* **Neue Zielarten kommen zusätzlich zum kompakten Slate** (wie Sponsor- und Budget-Ziele), nicht auf Kosten eines Plätzchens: sonst verdrängen sie das Spieler-Ziel (Slot 4) und verschieben die KI-Neigung. Sie fließen **nicht** in `buildAiBias` ein.
* **KI-Teams:** die neuen Ziele werden ausgewertet und gezeigt, **Strafen (−1,0 Lieblings-Verkauf, −0,4 Vertragslaufzeiten) greifen nur beim Menschen**, bis eine Messung mit 32 KI-Teams vorliegt. Positives gilt für alle.
* **Vertragslaufzeiten:** ab Saison 2; gemessen werden die Enden der **kommenden zwei Saisons** (nicht die auslaufenden, das ist die Verlängerungs-Entscheidung selbst). Grenze 30 % des Kaders, mindestens 3. Gefährdet bis Saisonende, dann verfehlt. Laufzeit zwei Saisons.
* **Lieblingsspieler:** Wahl steht in der Spieler-Id des Ziels (fest für die Saison, kein eigener Speicher). Das „kleine Einsatz-Ziel“ aus dem Mockup fehlt (keine Datenquelle für Einsätze je Spieler).
* **Widerspruchsregeln** (wenige, lesbar): Sparziel (Transferdeckel, Netto-Transferbilanz) × Rang-Ziel bei Kader unter Soll; Cash-Reserve und Transferdeckel × Gebäude/Entwicklung; Gehaltsquote × „Lieblingsspieler verlängern“. Das Mockup-Beispiel (Netto-Transferausgaben gegen Top 6) ist die erste Regel; das nächste Ziel desselben Bereichs rückt nach, das verworfene steht mit Grund am Ersatz (`ersetzt`).
* **Gespräch:** Preise und Werte der Waage sind die Startwerte aus `vorstandsgespraech-18-11.md`. Bitten: Freigabe anheben, Sonderbudget Gehalt, Notrücklage anzapfen, Alles auf eine Karte, Ziel tauschen, Lieblingsspieler freigeben. Zusagen: höheres Saisonziel, Gehaltsdeckel, Vertrauen einsetzen, Lieblingsspieler verlängern. Zusagen werden zu Zielen (Vertrauen über die bestehende Buchung bei der Abrechnung).
* **Siegprämie:** „Sieg“ = Disziplin-Ergebnis in der oberen Hälfte der Liga (Annahme, nicht festgelegt). Stufen 0,01 / 0,02 C je Sieg und Einsatz, Treueprämie 5 / 10 % des neuen Gehalts; Moral +1/+2 je Sieg, +5/+10 bei Treue. Alle Werte sind Startwerte ohne Messung.

## Drin / angepasst / fehlt (Mockup gegen App)

Bilder: `docs/design/office-vorstand-bau-21-11/app-*.png` (1920×1080 und 2560×1440, Szenario Death Peaches, Stand als Saison 2 im Transferfenster aufbereitet), `s1/` (echter Stand Saison 1). Die Mockup-Bilder liegen in `docs/design/mockups-21-11/office-0*.png`.
Gemessen: kein Seitenscroll, kein horizontaler Überlauf, keine JavaScript-Fehler. Nicht geprüft: 1710×1112, Phone.

| Mockup-Merkmal | Stand |
|---|---|
| Kopf mit Reitern und Kennzahlen | drin; „Kabine“ als vierter Reiter (bestehende Ansicht); „Sponsor“ fehlt (eigene Seite) |
| Vertrauens-Bogen, Stufen-Tabelle mit aktiver Zeile | drin |
| „Was es bewegt hat“ (Verlauf) | **angepasst:** „Was am Saisonende zählt“ (Verlauf wird nicht gespeichert) |
| Ränge in der Liga | angepasst: Vertrauen, Gehaltskosten (günstigstes = 1), Kasse; Kaderstärke-Rang fehlt |
| Widerspruchsprüfung, Paar-Chips, verworfenes Ziel | drin |
| Zielkarten mit Laufzeit-Marke, NEU, Hinweis, Folgen | drin; „je Bereich höchstens ein Ziel“ nicht erzwungen |
| Vertragslaufzeiten mit Balken, Lieblingsspieler mit Porträt | drin |
| „So vergibt der Vorstand“ (4 Schritte) | angepasst an das, was der Code tut |
| Abrechnung, Zielprämien, Freigabe nächste Saison | drin |
| Freigabe/Budgets, Kassenbalken, Töpfe, Sonderwege, Regel-Tabelle | drin |
| Notfall-Antrag | **fehlt** (nie gebaut, nicht Teil der Entscheidungen) |
| Gespräch: 3 Schritte, Wechselrede, Waage, Folgen vorher/nachher, Bindungen, Protokoll | drin |
| Bitte „Prämientopf“, Zusage „Rückzahlung aus Verkäufen“ | **fehlt** (Prämien zahlen aus dem Gehaltstopf; Rückzahlung braucht Verkaufs-Hooks) |
| Prämien: Siegprämie, Treueprämie, Spielertabelle (sortierbar, Moral-Gesicht, Gehalt groß/klein), Kosten, harte Sperre | drin |
| Prämie fürs Saisonziel, Sonderprämie Spieltag, Klauseln je Spieler | **fehlt** (laut Entscheidung 7 später) |

## Finanzseite

„Rücklage anzapfen“ und „Alles auf eine Karte“ sind dort ersetzt durch Lesetext und den Knopf „Zum Gespräch“; „Annehmen“ bei einer Forderung des Vorstands und der Umschicht-Schieber bleiben. Die Route lehnt die beiden alten Aktionen ab (die KI ruft die Funktionen direkt).

## Offen

KI und Prämien messen (32 KI-Teams); KI-Strafen der neuen Zielarten nach der Messung; Notfall-Antrag; Sponsor im Office; 1710×1112; Spieltags-Hook der Siegprämie am Live-Spielstand in einem echten Spieltag testen (Unit-Test deckt Buchung, Idempotenz, Moral).
