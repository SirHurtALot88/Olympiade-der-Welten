# Nach dem Spieltag: Abgleich Mockup und App (18.11.)

Soll: `public/mockups/form-moral-modern-17-11.html` (Ansicht „Nach dem Spieltag“). Ist: eigene Ansicht
`app/foundation/nach-dem-spieltag/` (`NachDemSpieltag.tsx`, `nach-dem-spieltag.css`), Ableitungen in
`lib/lineups/nach-dem-spieltag.ts`, Tests `tests/nach-dem-spieltag.test.ts`. Bilder in `nach-dem-spieltag-18-11/`:
`abgleich-2560/1920/1710.png` (links Mockup, rechts App), `app-nach-dem-spieltag-*.png` (einzeln, auch Phone).
Aufnahme: `scripts/screenshot-nach-dem-spieltag.ts` (Wegwerf-Battle-Save, sechs gespielte Spieltage, Port 3212).

Erreichbar: Spieltagsergebnis (Einstiegskarte „Form und Moral ansehen“ ersetzt die alte eingehängte Liste),
Einsatzliste modern (ein Knopf „Nach dem Spieltag“ im Kopf), URL `?view=nach-dem-spieltag`.

## Drin
- Kopf mit Wappen, „Spieltag N · abgeschlossen“, Titel, Disziplin-Reitern (D1/D2) und Ergebnis aus den **gebuchten**
  `disciplineResults`: Sieg/Remis/Niederlage mit Stand im Duell, „Platz n von 4“ im Vierer-Pod, „Platz n von N“ sonst.
  Dazu Tagesrang und Spieltag-Wahl.
- Tafel Form-Meldungen: Porträt, Name, Kurzzeile (Disziplin ± Leistung gegen Erwartung / kein Einsatz / verletzt),
  Pfeile vorher → nachher, Wert, Warum (Satz aus `formBegruendung`; Zahlen betont, Erschöpfung bernsteinfarben) **und alle
  Anteile, die zusammen den Wert ergeben** („+21 Zug zur Mitte · −10 Verletzt“, „−12 Leistung gegen Erwartung · −10 Verletzt“).
  Die Zerlegung (`zerlegeFormAenderung`) folgt `advancePlayerFormDetail` Schritt für Schritt (Leistung bzw. Zug zur Mitte,
  Erschöpfungsbremse `LERN_RATE × Abzug`, Verletzung −10); Klemmung auf 0..100 und Rundung landen im Hauptanteil, die Summe
  der ganzen Zahlen ist immer die gerundete Änderung (Test über acht Fälle, auch für fertige Zeilen). Vorher stand bei
  Verletzten nur „10 Punkte Abzug“, obwohl der Wert aus Zug zur Mitte bzw. Leistung plus Abzug kam; die Zahl selbst war richtig.
  Ist ein Spieler verletzt UND gespielt, nennt der Warum-Satz jetzt Leistung und Abzug.
- Tafel Moral mit Gesicht vorher → nachher (`BcMoralGesicht`), Zahl, Veränderung und stärkstem gespeichertem Grund; nur wer
  sich bewegt hat (≥ 0,5), größte Bewegung zuerst. Der Vorwert kommt aus einem neuen additiven Feld
  `PlayerMoraleState.vorher` (`{ morale, matchdayId }`), das `buildCurrentMoraleState` beim Spieltagswechsel aus dem bisher
  gespeicherten Wert mitschreibt; es geht in keine Rechnung ein. Alte Stände ohne das Feld zeigen weiter nur Wert und Grund.
- „Was jetzt zu tun ist“ nur aus gespeicherten Werten: erschöpft (Bremse an diesem Spieltag), verletzt, kalt (Form nach
  dem Spieltag Stufe −1/−2, ohne die schon genannten), Moral unter 40 mit negativem Grund.
- Kästen „Heiß in Spieltag N+1“ (Stufe +1/+2) und „Kalt“, mit den echten Formwerten.
- Große Bauchbinde (größte Bewegung, blätterbar 1 von 5), mittig über der linken Tafel.
- Füllt die Fläche: Höhe `100dvh − 150px`, Schrift, Zeilen und Porträts mit `clamp()`; 2560×1440 ohne Quetschen.
  Phone: Tafeln untereinander, Bauchbinde klebt unten.
- Datenquelle unverändert (`baueFormMeldungen`, additiv um Disziplin, Abstand, Bremse erweitert); keine zweite Rechnung,
  keine Änderung an Wertung oder Spiellogik.

- **PP-Spalte (Chris, 18.11.):** je Spieler „PP · Rang“: Player Points des Spieltags, Rang am Spieltag (unter allen Spielern mit
  gebuchtem PP) und Saison-PP-Rang (bis einschließlich dieses Spieltags, alle Spieler der Liga-Datei). Quelle ist derselbe
  Saison-Ledger (`buildSeasonPointsLedger`, `points` = Anteil + Mutator), den Saisonstand und Spieltagsergebnis lesen; keine zweite
  Rechnung. Spieler ohne gebuchten Einsatz zeigen „kein Einsatz“.
- **Verletzt (Chris, 18.11.):** statt „10 Punkte Abzug“ steht „verletzt · nicht einsetzbar (noch N Spieltage)“, die Dauer aus der
  gespeicherten Sperre (`getPlayerAvailabilityView`, `injuryUntilMatchday`), plus der Formanteil „−10 Verletzt (Formabzug)“. Auch der
  Hinweis „Was jetzt zu tun ist“ nennt es. Die 50 %-Regel in der Verletzungs-Disziplin steht bewusst nicht im Text: sie baut ein
  anderer Agent in der Wertung, die Anzeige sagt nur, was gespeichert ist.

## Angepasst
- **Moral vorher → nachher** war aus den gespeicherten Daten nicht herleitbar (Moral wird je Spieltag neu berechnet und
  überschrieben, die Gründe sind kein Tages-Log), deshalb das additive Feld `vorher` (siehe oben).
- **Grund-Text der Moral ist „stärkster gespeicherter Grund“, nicht „Grund der Bewegung“.** Die Moral übernimmt die ersten zwei
  gespeicherten Gründe unverändert in den nächsten Stand (`carryableStoredReasons`, `player-morale-service.ts`), auch wenn sie nicht
  mehr zutreffen. Das erklärt „Team spielt um Titel/Meisterschaft +12“ bei einem Team weiter hinten: ein früherer Stand
  (Rang ≤ 3 in der Liga) bleibt als Grund hängen. Außerhalb dieser Ansicht, hier nur gemeldet, nicht geändert. Dazu: der Rang
  kommt aus `standings[teamId].rank`, der **pro Liga** gezählt wird (1–16), die Schwellen (≤ 3, ≤ 8, ≥ 25) sind aber für 32 Teams
  gedacht; „≥ 25“ kann in einer 16er-Liga nie auslösen.
- Heiß-/Kalt-Text ohne die Formkarten-Empfehlung des Mockups („beide Social: gelbe Karte …“). Grund: dafür fehlt hier die
  Kartenzerlegung für den nächsten Spieltag; stattdessen die Regel in einem Satz (über Erwartung bleiben).
- Hinweis „kalte Spieler nicht in Schlüsselslots“ ohne Prüfung gegen die nächste Aufstellung (die gibt es nach dem
  Spieltag noch nicht); es ist die Empfehlung für alle kalten Spieler.
- Bauchbinde ohne Schließen-Knopf (wie im Mockup), blätterbar.
- Zeilenanzahl: alle Spieler des Teams mit Verlaufseintrag, nicht nur Aufgestellte.

## Fehlt
- Kopf-Untertitel „412 : 396“ nur bei Duellen mit gespeichertem Seitenstand; ohne ihn steht „gegen Gegner“.
- Kein eigener Menüpunkt in der Seitenleiste (Einstieg über Ergebnis und Einsatzliste, wie beauftragt).
