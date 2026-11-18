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
  Pfeile vorher → nachher, Wert, Warum (derselbe Satz wie bisher, `formBegruendung`; Zahlen betont, Erschöpfung bernsteinfarben).
- Tafel Moral mit Gesicht (`BcMoralGesicht`), Zahl, stärkstem gespeichertem Grund und dessen Punktwirkung.
- „Was jetzt zu tun ist“ nur aus gespeicherten Werten: erschöpft (Bremse an diesem Spieltag), verletzt, kalt (Form nach
  dem Spieltag Stufe −1/−2, ohne die schon genannten), Moral unter 40 mit negativem Grund.
- Kästen „Heiß in Spieltag N+1“ (Stufe +1/+2) und „Kalt“, mit den echten Formwerten.
- Große Bauchbinde (größte Bewegung, blätterbar 1 von 5), mittig über der linken Tafel.
- Füllt die Fläche: Höhe `100dvh − 150px`, Schrift, Zeilen und Porträts mit `clamp()`; 2560×1440 ohne Quetschen.
  Phone: Tafeln untereinander, Bauchbinde klebt unten.
- Datenquelle unverändert (`baueFormMeldungen`, additiv um Disziplin, Abstand, Bremse erweitert); keine zweite Rechnung,
  keine Änderung an Wertung oder Spiellogik.

## Angepasst
- **Moral „vorher → nachher“ → aktueller Wert plus stärkster Grund.** Grund: Die Moral wird je Spieltag überschrieben,
  ein Vorher-Wert ist nirgends gespeichert. Ihn zu erfinden wäre falsch („gezeigt = gebucht“). Folgeauftrag, falls
  gewünscht: beim Fortschreiben der Moral den Vorwert additiv mitschreiben (Datenmodell, nicht Teil dieses PRs).
- Heiß-/Kalt-Text ohne die Formkarten-Empfehlung des Mockups („beide Social: gelbe Karte …“). Grund: dafür fehlt hier die
  Kartenzerlegung für den nächsten Spieltag; stattdessen die Regel in einem Satz (über Erwartung bleiben).
- Hinweis „kalte Spieler nicht in Schlüsselslots“ ohne Prüfung gegen die nächste Aufstellung (die gibt es nach dem
  Spieltag noch nicht); es ist die Empfehlung für alle kalten Spieler.
- Bauchbinde ohne Schließen-Knopf (wie im Mockup), blätterbar.
- Zeilenanzahl: alle Spieler des Teams mit Verlaufseintrag, nicht nur Aufgestellte.

## Fehlt
- Moral-Vorher-Wert (siehe oben).
- Kopf-Untertitel „412 : 396“ nur bei Duellen mit gespeichertem Seitenstand; ohne ihn steht „gegen Gegner“.
- Kein eigener Menüpunkt in der Seitenleiste (Einstieg über Ergebnis und Einsatzliste, wie beauftragt).
