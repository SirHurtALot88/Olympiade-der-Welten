# Neue Karten einstellen: so läuft es (Stand 13.11.2026, mit Chris abgestimmt)

Chris schickt ein Foto je Karte. Antwort immer im gleichen Format, so schnell wie möglich:
**zuerst die Überschrift**, dann kompakt die Daten. Kein Code, kein Set, keine Auflage als eigene Zeilen.

## Ablauf je Karte

1. **Karte erkennen** (Foto): Set-Code, Name, Seltenheit, Auflage. Alle Karten gelten als **NM**, außer Chris sagt
   etwas anderes oder die Karte ist sichtbar abgenutzt (dann GD/LP vorschlagen und darauf hinweisen).
2. **Quick Check Seltenheit** über YGOPRODeck (`cardinfo.php?id=<Passcode vom Foto>`), `card_sets` des Set-Codes.
3. **Bereits erfasst?** Wenn die Karte schon in dieser Sitzung vorkam oder in LEC existiert: **darauf hinweisen**, Chris
   erhöht nur die Anzahl am bestehenden Artikel (kein neues Angebot, kein neuer Titel).
4. **Cardmarket-Eintrag finden** (Dateien `price_guide_3.json` + `products_singles_3.json`, siehe `apps/LEC/src/lib/market/catalog.ts`):
   - Neue Sets: Eintrag über das Datum `dateAdded` und die Zahl der Versionen (V.1 = niedrigste Seltenheit, meist die
     normale Ultra/Secret Rare; V.2 = nächste, oft Full-Art oder Secret).
   - **Alte Sets: Expansion über die Set-Mitglieder bestimmen.** Alle Kartennamen des Sets von YGOPRODeck holen
     (`cardinfo.php?cardset=<Setname>`), die `idExpansion` mit den meisten Treffern im Katalog nehmen, dann den Eintrag der Karte darin lesen.
   - Mehrere Expansionen möglich: beide zeigen und um das „ab“ der Cardmarket-Suche bitten (Chris: Suche „SET-001“ ergibt
     meist 1 bis 4 Treffer, das „ab“ ordnet den Eintrag zu).
5. **Preis rechnen genau wie die LEC-Seite** (`computeMarketTargetRange`, `contributionMarginForPrice`, Standard-Kostensätze,
   shopweit ca. 2.565 Stück/Jahr, Werbesatz GOOD für die Marge):
   - **Marktwert** = Mittel aus Trend, Ø 1, Ø 7, Ø 30 Tage und dem **„ab“ doppelt** (nur wenn „ab“ ≥ 40 % des Mittels der Schnitte,
     so rechnet die Seite). Chris' DE-„ab“ aus seinem Screenshot hat Vorrang vor dem Katalog-„ab“ (der gilt über alle Sprachen).
   - **Empfohlener VK** = Zielspanne 25–33 % Marge, Mindestpreis 4,99 €, Marktdeckel bei teuren Karten.
   - **Marge und Gewinn**: Nachkauf zum Marktwert als EK (wie die Spalte „Marge Nachkauf“ in LEC). Bei Karten über etwa 25 € Marktwert
     rechnet Chris **mit EK 25 €**, weil teure Karten nie nachgekauft werden (Einmalverkauf).
   - **Einstiegspreis**: in der unteren Hälfte der Spanne, **immer auf .99** (nie .49), **nie Preisvorschlag/Verhandeln** („kein Basar“).
6. **Titel** (max. 80 Zeichen): `Yu-Gi-Oh! <SET-DE123> <Kartenname deutsch> <Seltenheit> <Zustand> <Auflage>`.
   Bei Überlänge zuerst Seltenheit kürzen (UR, StR), dann „Yu-Gi-Oh!“ weglassen. Englische Karten: englischer Name und Code.
   Auflage: `1st` bei „1. Auflage“, `Unlimited`, `Limitierte Auflage`. Zustand: NM, LP, GD (Cardmarket-Zustandsseite).

## Ausgabeformat

Überschrift im Codeblock, darunter Tabelle: Trend / Ø 1 / 7 / 30 T, ab, Marktwert, Empfohlener VK, Einstieg, Marge, Gewinn.
Dazu kurze Hinweise (Version zu prüfen, „ab“ ausgelassen, Zustand). Keine Set-/Code-/Auflage-Zeilen.

## Zustand GD/LP

Der Preisführer hat keinen Zustandsfilter (Preise gelten für NM). Abschläge auf die Cardmarket-Preise (Chris, 13.11.): **EX 85 %, GD 70 %, LP 60 %, PL 45 %, Poor 30 %**
(`apps/LEC/src/lib/market/condition.ts`, gilt auch in LEC). „Played“ im Titel zählt als PL. Besser bleibt das „ab“ mit Filter Zustand/Deutschland von Chris.

## Offene Punkte

- Das DE-„ab“ je Karte kann die Seite aus dem Preisführer nicht lesen (gilt über alle Sprachen).
- Cardmarket-Suche ist von hier aus gesperrt (403); Zahlen kommen aus den öffentlichen Katalogdateien oder aus Chris' Screenshots.
- Bestandsprüfung („schon erfasst?“) braucht Lesezugriff auf LEC; bis dahin nur Treffer aus der laufenden Sitzung melden.
