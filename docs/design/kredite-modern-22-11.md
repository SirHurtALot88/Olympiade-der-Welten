# Kredite im neuen Stil (Mockup, 22.11.)

Chris, 22.11.: „Bitte auch priorisiert noch anstoßen die noch offenen Seiten Kredite / Ranks / Leaders zu reworken“.
Dies ist Schritt 1 des Ablaufs aus CLAUDE.md: Mockup und Erklärung. Gebaut wird erst nach „bau das“. Kein App-Code, kein
PixelLab (0 Generationen).

- Mockup: `public/mockups/kredite-modern-22-11.html`
- Gemeinsame Dateien der drei Mockups: `public/mockups/kredite-ranks-leaders-22-11/` (`basis.css`, `basis.js`, `daten.js`)
- Schalter: `?stand=bsp|echt`, `&betrag=<C>`, `&lz=<Saisons>`, `&liga=2|alle`, `&still=1` (ohne Mockup-Leiste)

## 1. Kernidee

**Kredite werden ein Reiter der Finanzseite, kein eigener Navigationspunkt mehr.** Ein Kredit ist eine Finanzentscheidung
und gehört neben Kasse, Budgets und Sponsor. Die Seite beantwortet drei Fragen auf einem Bildschirm: Was schulde ich
(links), was kostet mich ein neuer Kredit wirklich (Mitte), wie stehe ich in der Liga da (rechts).

## 2. Was die Seite heute zeigt

`app/foundation/credits/FoundationCreditsNewLook.tsx` (1447 Zeilen, alter Stil): Kennzahlen, Auslastungs-Tacho, Balken
„Jährliche Belastung“, Tabelle der laufenden Kredite, Schieber für Summe und Laufzeit, Angebotskarten (Bank und Teams),
Ablöse-Rechnung. Es fehlen: ein Tilgungsplan, die Wirkung auf Töpfe, GuV und Vorstand, ein Liga-Vergleich und die Rate je
Spieltag. In Saison 1 zeigt die Seite nur „Kreditsystem in Vorbereitung“; das ist seit der Entscheidung „Kredite ab
Saison 1“ (`finanzen-posten-22-11.md` f.6) überholt.

## 3. Aufbau

| Tafel | Inhalt |
|---|---|
| Kopf | „Finanzen“ mit den Reitern Kasse, Budgets, Sponsor, **Kredite** (Schulden und Zahl der Kredite im Reiter). Rechts Vorstand: Vertrauen, Freigabe, „Kredit erlaubt“ oder die Sperre. |
| **Laufende Kredite** (links) | Fünf Kennzahlen: Schulden, Rate (groß je Saison, klein je Spieltag), Ø Zins, freier Rahmen mit Auslastung, Schuldendienst gegen die 20-%-Grenze. Darunter die Kredite als sortierbare Tabelle (Geber, aufgenommen, Restschuld, Zins, Restlaufzeit in Raten, Rate, Ablösen). |
| Tilgungsplan (links unten) | Für den gewählten Kredit: ein Balken je Rate (Zins rot, Tilgung gold), Linie der Restschuld, grüner Strich „heute“. Daneben die Tabelle je Saison (Raten, Zins, Tilgung, Summe, Rest) und die 20 Spieltage der laufenden Saison (bezahlt, nächste Rate, offen). Fußzeile: Ablöse heute. |
| **Neuer Kredit** (Mitte) | Warnung, wenn die Kasse im Minus steht (Pflichtkredit am Kassensturz, mit Betrag). Betrag per Schieber bis zum Rahmen, Laufzeit 1 bis 10 Saisons. Angebote von Bank und Teams mit Zins, Rate und Gesamtzinsen; das günstigste ist markiert, ein Geber mit zu wenig Geld ist gesperrt. |
| Wirkung (Mitte unten) | Vorher → nachher für Kasse, Transfertopf (mit Freigabe-Quote), Raten im Gehaltstopf, GuV der Saison (nur der Zins), Raten bis Saisonende, Gesamtkosten. Balken „Schuldendienst an den Planeinnahmen“ mit den Marken 10 % (KI-Grenze) und 20 % (Obergrenze). Der Knopf ist gesperrt, wenn die Obergrenze reißt oder der Vorstand eine Sparauflage verhängt hat. |
| **Liga-Vergleich** (rechts) | Eigene Liga oder alle 32. Schulden, Rate, Schuldendienst, Bankzins. **Rang 1 = geringste Schulden** (Rangregel), klein daneben der Rang unter allen 32. Jede Spalte sortierbar; der Rang gilt für die sortierte Spalte. |

## 4. Regeln im Mockup

Aus dem Code übernommen (`lib/finance/loan-service.ts`), nichts neu erfunden:

| Größe | Regel | Death Peaches (echt) |
|---|---|---|
| Bankzins | 10 % + 1,2 % je fehlendem Finanzpunkt − 0,4 % je Zusatzsaison, 7 bis 20 % | Finanzwert 3,05 → 18,3 % (1 Saison), 17,9 % (2) |
| Team-Angebot | Bankzins − 1 % − bis 1 % bei reichem Geber, nie unter 5 % | Wrecking Legionnaires 15,9 % |
| Kreditrahmen | 15 % der Kasse + 30 % des Kaderwerts − Restschuld | 0,30 × 236,2 = 70,9 C (Kasse −1,2 zählt nicht) |
| Ablöse | Restschuld + 20 % der entgangenen Zinsen | im Fuß des Tilgungsplans |
| Obergrenze | Schuldendienst ≤ 20 % der Planeinnahmen (`finanzkonzept-v2-18-11.md` Abschnitt 6) | Planeinnahmen 84,4 C → höchstens 16,9 C Rate je Saison |
| Pflichtkredit | Kasse < 0 am Kassensturz: Fehlbetrag + 10 % des Jahresgehalts, 2 Saisons, 12 % | 1,2 + 7,0 = 8,2 C |
| Vorstand | Kredit landet im Transfertopf und unterliegt der Freigabe; unter 60 % Freigabe kein freiwilliger Kredit; die Rate senkt das Gehaltsbudget | Saison 1: Freigabe 100 % |
| GuV | nur der Zins zählt, die Tilgung ist eine Bilanzbewegung | Zeile „GuV Saison 1“ |

**Neu gegenüber dem Code: Raten je Spieltag.** Der Code bucht heute die Jahresrate am Saisonende (`applyLoanSettlement`).
Das Mockup zeigt das Zielbild aus dem Finanzkonzept („2 Saisons = 40 Raten je Spieltag“): Laufzeit × 20 Raten, Zins je
Rate = Jahreszins / 20, gleichbleibende Rate. Ein Kredit, der mitten in der Saison aufgenommen wird, zahlt seine erste
Rate am nächsten Spieltag; der Plan zeigt deshalb eine angebrochene erste und letzte Saison. Die Rate steht überall groß
je Saison und klein je Spieltag (Gehaltsregel aus CLAUDE.md, hier sinngemäß angewandt).

## 5. Echte Daten und Beispielwerte

Echt, aus dem Live-Abbild (Spielstand `new-game-1795114260527-nzr0z9`, Saison 1, vor Spieltag 12): Kasse, Kaderwert,
Gehalt, Finanzwert, Vorstands-Vertrauen und Sponsor-Hochrechnung aller 32 Teams. Death Peaches steht mit −1,2 C wirklich im
Minus; die Pflichtkredit-Warnung ist also kein erfundener Fall.

Beispiel, mit gestrichelter Marke „Beispiel“: die laufenden Kredite. **Im Spielstand läuft kein einziger Kredit.** Der
Schalter „Kredite: echt (keine)“ zeigt genau diesen Zustand samt Leerzustand der linken Tafel. Die zwei Beispielkredite
(Bank 10 C über 3 Saisons, Wrecking Legionnaires 5 C über 2 Saisons) und die Schulden der anderen Teams rechnen mit den
echten Formeln und echten Teamwerten. Team-Angebote rechnen mit Beziehung 0 und einer geschätzten Reserve des Gebers.

## 6. Bilder

Alle aus dem Mockup, selbst angesehen. Kein Seitenscroll, keine Überläufe (Messung im Aufnahmeskript: Dokumentgröße =
Fenstergröße, keine Zeile breiter als ihre Tafel).

| Datei | Ansicht |
|---|---|
| `kredite-modern-22-11/kredite-1920x1080.png` | Standard, Beispielkredite |
| `kredite-modern-22-11/kredite-2560x1440.png` | dasselbe auf dem Hauptbildschirm |
| `kredite-modern-22-11/kredite-1710x1112.png` | MacBook |
| `kredite-modern-22-11/kredite-echt-1920x1080.png` | echter Stand: kein Kredit, alle Teams Rang 1 |

Die Schrift wächst mit dem Fenster (16 px bei 1920×1080, 21 px bei 2560×1440, 14,7 px bei 1710×1112), alle Maße hängen
daran.

## 7. Für den Bau

- Neue Komponente als Reiter in `app/foundation/finances/FinanzenModern.tsx`; `FoundationCreditsNewLook.tsx` und der Block
  `.nl-credit*` fliegen danach raus, der Navigationspunkt „Kredite“ wird zum Sprung auf den Reiter.
- Schreibweg nur über den Server (`authorizeServerRoomWrite`, Besitz über `ownerId`), aktives Team aus
  `activeManagerTeamId`. Delegation: der Bereich gehört zu „Käufe/Verkäufe/Verträge“ oder bekommt einen eigenen Schalter.
- Rechner und Sperre müssen dieselbe Funktion nutzen wie die Buchung (gezeigt = gebucht), für Mensch und KI gleich.
- Raten je Spieltag sind eine Mechanik-Änderung (Tilgungsplan, Notkredit-Rücknahme, GuV-Posten) und gehören in einen
  eigenen PR vor der Seite. Ohne sie zeigt die Seite dieselben Tafeln mit „Rate am Saisonende“.

## 8. Offene Fragen

1. **Raten je Spieltag jetzt bauen?** Empfehlung: ja, als eigener Mechanik-PR vor der Seite. Das Finanzkonzept sieht es
   vor, und die Kasse je Spieltag ist schon live; nur der Kredit bucht noch am Saisonende.
2. **Sind die Schulden fremder Teams öffentlich?** Das Mockup zeigt sie exakt (Kreditregister der Liga), die Kasse nicht.
   Alternative: grobe Stufen wie beim Scouting-Nebel.
3. **Zinsspanne.** Der Code rechnet 7 bis 20 % (Death Peaches 18 %), `finanzen-posten-22-11.md` nennt 5 bis 12 %. Das
   Mockup folgt dem Code. Falls 5 bis 12 % gewollt ist, muss die Formel neu geeicht werden.

## 9. Bau (22.11., nach „bau das“)

Entscheidungen (PM, verbindlich): Raten je Spieltag als eigener erster Teil; das Kreditregister der Liga ist öffentlich und exakt, die Kasse fremder
Teams bleibt verborgen; Zinsspanne bleibt 7 bis 20 %; Kredite gehören zum Bereich „Käufe/Verkäufe/Verträge“, kein eigener Delegationsschalter.

**Teil 1, Mechanik** (`lib/finance/kredit-raten.ts`): Stempel `seasonState.kreditRegel` (`raten` | `saisonende`), neues Spiel ab Saison 1, bestehender
Spielstand ab dem nächsten Saisonwechsel (Lade-Migration schreibt `saisonende` fest), Rückweg `OLY_KREDIT_RATEN=aus` (neue Saisons). Jeder Rechenweg fragt
`kreditRatenAktiv(gameState)`. Rate = Annuität über Laufzeit x Spieltage mit Zins/N, gebucht in `bucheSpieltagFinanzen` als Posten `kreditZins`,
`kreditTilgung`, `kreditEingang` (Rückfluss an den Geber eines Team-Kredits), Kasse = Summe der Buchungen, idempotent über das Ledger. Die
Saisonende-Abrechnung überspringt, was die Spieltage buchen; ein Raten-Kredit in einer Saison ohne Raten wird zur Jahresrate zurückgerechnet, ein alter Kredit in
einer Raten-Saison umgerechnet: keine Doppelbuchung, keine Lücke. Zahlungsausfall je Spieltag: bezahlt wird, was da ist, Rest plus 5 % Strafzins kapitalisiert, ein
Vertrauenspunkt je Kredit und Saison, geplatzt nach einem Viertel der Saison (5 Raten). GuV: nur der Zins (eine Zerlegung `kreditSaisonZerlegung` für GuV,
Verpflichtungen, Planer). Notkredit-Rücknahme, Ablöse, Kontoauszug und Kassenprognose angepasst. Die Sperre für Saison 1 ist gefallen (Finanzkonzept f.6); die KI leiht in
Saison 1 weiter nie für den Draft. Gefundener Fehler: der gebuchte Team-Satz ignorierte den Eigenzins des Gebers, das Angebot nicht; jetzt gleich.

**Teil 2, Seite** (`FinanzenKredite.tsx`, `kredite-modern.css`, Modell `lib/finance/kredite-seite-modell.ts`): Reiter „Kredite“ der Finanzseite, drei Tafeln. Der
Navigationspunkt „Kredite“ springt auf den Reiter. `FoundationCreditsNewLook`, Host, View-Modell und `.nl-credit*` sind entfernt. Sperren (Obergrenze 20 % der
Planeinnahmen, Sparauflage) in `lib/finance/kredit-pruefung.ts`: dieselbe Funktion sperrt den Knopf und die Route `POST /api/finance/loan/originate`.

| Mockup-Merkmal | Stand | Anmerkung |
|---|---|---|
| Reiter Kredite im Kopf der Finanzseite, Schulden und Zahl | drin | |
| Vorstand rechts im Kopf (Vertrauen, Freigabe, erlaubt/gesperrt) | drin | zeigt „Kredit nur in der Vorsaison“, wenn das Fenster zu ist |
| Fünf Kennzahlen (Schulden, Rate groß/klein, Ø Zins, Rahmen, Schuldendienst) | drin | |
| Tabelle laufender Kredite, sortierbar, Ablösen | drin | Ablösen wählt den Kredit und fragt im Fuß nach (zwei Schritte) |
| Tilgungsplan: Diagramm, Tabelle je Saison, Spieltagsleiste, Ablösefuß | drin | Plan wird aus dem Kredit nachgerechnet; bei verpassten Raten oder alten Krediten nur der Rest ab heute |
| Rechner: Betrag, Laufzeit 1 bis 10, Angebote, günstigstes, gesperrter Geber | drin | |
| Wirkung vorher → nachher | angepasst | Transfertopf, Kasse, GuV kommen aus der simulierten echten Aufnahme; „Raten im Gehaltstopf“ heißt „Raten je Saison (Fixkosten)“, weil die Rate den Gehaltstopf im Code nicht mindert |
| Warnung bei Kasse im Minus (Pflichtkredit) | angepasst | der Pflichtkredit am Kassensturz ist nicht gebaut; gezeigt wird der echte Notkredit der Bank am Ende des Kauffensters (4 Saisons, Bankzins) |
| Schuldendienst-Balken mit 10 % / 20 % | drin | 20 % sperrt auf Seite und Server |
| Liga-Vergleich, Rang 1 = geringste Schulden, Rang unter 32 klein | drin | alle Spalten sortierbar |
| Kreditregister (alle Kredite, Nehmer und Geber) | neu | Reiter „Register“ im Liga-Vergleich (Wunsch aus der alten Seite, bleibt erhalten) |
| Beispielmarken „Beispiel“ | entfallen | die App zeigt echte Werte |
| Zweiter Beispielkredit (Wrecking Legionnaires) | fehlt im Bild | Team-Geber hatte in der Aufnahme nicht genug freies Geld; die Zeile ist in Test und Seite vorhanden |
| Aufnehmen mitten in der Saison | fehlt (bewusst) | die Phasenregel `credit_borrow` bleibt: Vorsaison und vor dem ersten Spieltag |

Bilder (Mockup | App): `vergleich-1920x1080.png` (Spieltag 12, Fenster zu), `vergleich-2560x1440.png`, `vergleich-1710x1112.png` (Vorsaison, Aufnehmen und Ablösen aktiv),
`vergleich-leer-1920x1080.png` (kein Kredit); dazu `app-kredite-register-1920x1080.png`. Kein Seitenscroll, keine Überlappung bei 1920, 2560 und 1710.

### 9a. Review-Fixes zu PR #1717 (22.11.) und die Verzugsregel

**Verzug (PM-Entscheidung, verbindlich; ersetzt „geplatzt“).** Ein Kredit „in Verzug“ (Status `defaulted`) wird **weiter eingezogen**:

- An jedem Spieltag mit positiver Kasse zahlt das Team die Rate oder so viel, wie da ist, Zins zuerst. Kein Strafzins über die 5 % auf den Fehlbetrag hinaus.
- Bei Team-Krediten geht der Rückfluss weiter an den Geber (eigene Ledger-Zeile, `kreditEingang`), der Geber verliert nichts dauerhaft.
- Solange der Kredit in Verzug ist: Neukreditsperre (`isDefaultedDebtBorrowBlocked`) und **−1 Vorstandsvertrauen je Saison in Verzug** (einmal, beim ersten Einzug oder beim ersten Ausfall der Saison, nicht je Spieltag).
- „In Verzug“ gilt ab 5 verpassten Raten **innerhalb einer Saison** (ein Viertel der Spieltage). `missedPayments` zählt je Saison und je Regel und wird beim Saisonwechsel zurückgesetzt (`kreditSaisonwechsel`). Im alten Saisonende-Weg gibt es nur eine Rate je Saison, dort gilt die eine verpasste Jahresrate als Verzug.
- Ist die Restschuld getilgt, endet der Verzug (Status `paid`). Der Status selbst bleibt über den Saisonwechsel stehen, bis getilgt ist.
- Am Laufzeitende gibt es keine Ballonzahlung: Nach einem Ausfall wird die Rate über die Restlaufzeit neu verrentet (`rateFuerRestraten`); war es die letzte Rate, kommt eine Saison Laufzeit dazu (Saisonende-Weg: Mindestlaufzeit 2, Jahresrate neu). Kein NaN, keine Endlosschleife.
- `ratenSicht` liefert für Kredite in Verzug nicht mehr `null`; GuV, Schuldendienst und Verpflichtungen zählen sie als laufend (`kreditLaeuft`).

| Befund | Änderung |
|---|---|
| W1 doppelt gezählte Tilgung | neue Restschuld = Restschuld − gezahlte Tilgung + ungezahlter Zins + 5 % Fehlbetrag, in `bucheKreditRaten` und in `buildSettlementRows`/`applyLoanSettlement` (`capitalizedShortfall` = ungezahlter Zins + Strafzins). Beispiel 100 C, 3 Saisons, n=10, Kasse im Minus: 102,19 statt 104,7. |
| W2 Verzug | siehe oben |
| W3 KI | `resolveAiLoanDecision` ruft vor jedem `shouldBorrow: true` `pruefeKreditAufnahme` mit der echten Rate aus `kreditKonditionen`; die Ausnahme „längste Laufzeit trotz Überschreitung“ ist weg, der Liquiditätszweig geht ebenfalls durch Obergrenze und Sparauflage, nur der Notkredit der Bank ist ausgenommen. Eine gemeinsame Grenze von 20 %; die 10 % sind nur noch die Warnfarbe der Seite. |
| M1 gezeigt = gebucht | `kreditSaisonZerlegung`, `computeEarlyPayoff(loan, gameState)` und `kreditZeile` rechnen ohne Raten-Saison mit `alsJahresrateKredit`, wie die Saisonende-Abrechnung. |
| M2 Rechner = Route | die Vorschau prüft mit `sim.loan.installmentPerSeason` (wie die Route); „bis Saisonende“ ohne Raten-Saison ist die Jahresrate. |
| M3 Mehrspieler | `originateLoan` prüft wie `buildLoanOffers`: ein manuell geführter Geber verleiht nur sein freigegebenes `lendingBudget` minus Verliehenes, sonst `lender_budget_not_released`. |
| K1 | `direkterEingang` bucht `kreditEingang` und `cashDelta` auf die schon stehende Zeile des Gebers (Kasse = Summe der Buchungen). |
| K2 | `kreditSaisonwechsel` im Saisonwechsel: Zähler zurück, Raten-Kredit bei geänderter Spieltagszahl neu verrentet. |
| K5 | Baseline-Eintrag der gelöschten Datei entfernt, Kommentar im Router aktualisiert. |

Tests: `tests/kredit-review-fixes-22-11.test.ts` (alle Befunde), angepasst `tests/loan-service.test.ts` (Verzug wird eingezogen, Schwelle 1 im Saisonende-Weg) und `tests/ai-loan-decision-service.test.ts` (Sperre mit echter Rate).
