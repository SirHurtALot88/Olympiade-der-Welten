# Drei Hovers im Saisonstand — und die GuV zeigt überall dasselbe

**Gewünscht** 23.08.2026 von Chris, mit Bildschirmfoto des Cash-Hovers im Team-Profil:

> „Können wir bitte diese Hovers auch im Saisonstand einbauen, dass, wenn ich zum Beispiel dort […]
> mit der Maus über den Marktwert von dem jeweiligen Team gehe, dass ich dann die Spieler dahinter
> sehe, beim Gehalt dasselbe, dass ich dann die Gehälter sehe, immer absteigend sortiert, dass ich,
> wenn ich mit der Maus über den Teamnamen gehe, dass ich dann so eine kleine Miniansicht bekomme,
> kompakt aus den Spielern […] Und was ich noch will, in der Teamansicht haben wir ja eine GuV
> Projektion drinne mit Cash minus Gehälter plus Sponsoren. Das müsste noch mal angepasst werden,
> dass es auch gleich ist mit dem, was wir im Saisonstand finden. Also dass diese GuV, die wir
> sehen, an allen Stellen dasselbe zeigt."

Nach dem Vorschlag: **„ja bau die drei hovers so und die guv nachbuchung auch."**

**Status: gebaut.**

## Teil 1 — die drei Hovers

Der Saisonstand hatte genau einen Hover (auf der GuV-Spalte, und den als schlichten `title`-Text).
Im Team-Profil existierten die Bausteine längst — `mwBreakdown`, `salaryBreakdown`. Neu ist
`lib/foundation/saisonstand-team-hover.ts`: dieselbe Sortierung, dieselbe Kappung, react-frei und
damit ohne Rendering prüfbar.

- **Marktwert** — Spieler absteigend, mit Anteil an der Summe.
- **Gehälter** — absteigend, mit Vertragsform (FL/BL/STD) und Restlaufzeit.
- **Teamname** — Kadergröße, Ø OVR, auslaufende Verträge, die drei wertvollsten Spieler, und die
  Zahlen der Zeile in einem Blick.

**Drei Entscheidungen liegen im Modul, nicht in der Ansicht:**

1. **Höchstens fünf Zeilen**, der Rest als Sammelzeile mit Summe. Zwölf Namen liest niemand.
2. **Ein fehlender Wert ist keine Null.** Solche Spieler zählen nicht mit, werden aber gezählt
   („2 ohne Angabe — nicht mitgezählt"), statt still zu verschwinden.
3. **Der Anteil misst sich an der Summe der Zeilen daneben**, nicht an der Spaltensumme. Die beiden
   dürfen auseinanderliegen; ein Prozentwert auf fremder Grundlage wäre schlimmer als keiner.

**Gebaut wird einmal je Tabellenzeile, nicht je Mausbewegung.** Der Kader kommt als `hoverKader`
über den Zeilen-Kontrakt herein — die Tabelle bekommt bewusst „das fertige Ergebnis, kein
gameState". Das Hover-Panel benutzt das vorhandene Portal-Vokabular (`.nl-teams-rank-portal`), kein
drittes Popover-System.

## Teil 2 — eine GuV, drei Probleme

Nachgemessen waren es nicht ein Unterschied, sondern drei:

**Zwei verschiedene Größen unter einem Namen.** Der Hover hieß „GuV (Projektion)", rechnete aber
einen **Kontostand** (`Cash − Gehälter + Sponsoren`). Die Spalte im Saisonstand ist ein **Ergebnis**
(Einnahmen − Ausgaben, ohne Cash). Die beiden konnten gar nicht gleich sein.

**Dem Team-Profil fehlten Posten.** Die gemeinsame Rechnung (`season-end-guv.ts`) kennt zehn; der
Hover kannte vier. An `1hf25q` gemessen wichen 5 von 6 geprüften Teams ab:

| Team | Saisonstand | Team-Profil | Differenz | was fehlte |
|---|---|---|---|---|
| **D-L** | **+8,8** | **−2,3** | **11,1** | Vorstandsziele 11,0 |
| B-B | −12,6 | −18,9 | 6,3 | Vorstandsziele 9,0 · Kreditzins −2,7 |
| B-P | +5,0 | +1,0 | 4,0 | Vorstandsziele 4,0 |
| A-A | +7,3 | +5,1 | 2,2 | Vorstandsziele 9,0 · Kreditzins −6,8 |

Bei D-L kippte das Vorzeichen: Gewinn gegen Verlust.

**Und in sechs von sieben Spielständen stand im Saisonstand gar keine GuV.** Nur `1hf25q` trug
`guv`/`guvPosten` — die entstanden bisher erst bei der Saisonende-Buchung. In Chris' `swnjlk` blieb
die Spalte leer, während das Team-Profil daneben eine Zahl zeigte.

**Geändert:**

- Der Riegel in `zieheSaisonstandGuvNach` („Teams ohne gespeicherte Postenliste bleiben unberührt")
  ist weg. Er verhinderte nicht die falsche Zahl, sondern die richtige.
- `zieheSaisonstandGuvNachSpieltag` hängt an der Spieltags-Buchung — an derselben Stelle wie die
  Punkte-Nachbuchung, aus demselben Grund: **einmal je Spieltag, nicht einmal je Klick.**
- Der Cash-Hover im Team-Profil liest jetzt `buildGuvBreakdown` mit den Posten aus dem Saisonstand.
  Er zeigt **beide** Größen getrennt: oben „GuV (Ergebnis)" mit allen Posten, darunter abgesetzt
  „Cash heute" und „≈ Cash am Saisonende". Fehlt die gemeinsame GuV, sagt er das — wie die Spalte,
  statt eine eigene Zahl zu erfinden.

**Kosten, gemessen statt vermutet:** `resolveSeasonGuvByTeam` braucht auf den echten Spielständen
0,6 bis 1,4 s beim ersten Aufruf und danach 17 bis 67 ms. (Der alte Kommentar nannte 334 Sekunden —
die galten für einen *frischen* Spielstand, in dem die Sponsor-Angebote erstmalig entstehen.)

**Wirkung, an allen sieben Ständen gemessen:**

```
swnjlk  Teams mit GuV  0 -> 32   (1379 ms)
hwz8fk                 0 -> 32   (1424 ms)
89rv3s                 0 -> 32   ( 666 ms)
0kalpx                 0 -> 32   (1212 ms)
1hf25q                32 -> 32   (  19 ms)
h0z7cl                 0 -> 32   (1050 ms)
n90y4m                 0 -> 32   ( 679 ms)
```

## Geprüft

Zwei neue Suiten, 18 Fälle:

- `tests/saisonstand-hovers-zeigen-die-spieler.test.ts` — 12 Fälle für die drei Hovers: Sortierung,
  Fünf-Zeilen-Kappung, fehlende Werte, Anteilsgrundlage, leerer Kader.
- `tests/guv-erscheint-auch-in-der-laufenden-saison.test.ts` — 6 Fälle für die Nachbuchung.

**Gegenprobe:** mit dem alten Riegel fällt der Fall „schreibt guv auch dort, wo noch nie eine Zeile
stand".

Zwei bestehende Tests trugen die aufgehobene Regel und sind **umgeschrieben statt gelöscht**:
`tests/saisonstand-guv-nachbuchung.test.ts` („fasst Teams ohne Postenliste nicht an" → das
Gegenteil) und `tests/standings-apply-service.test.ts` (prüft jetzt ausdrücklich, dass die GuV
mitgeschrieben wird).

*Nebenbei: der Quittungs-Riegel aus #641 hat bei genau dieser Notiz angeschlagen — sie nannte ihre
Tests ohne vollen Pfad. Der erste echte Treffer, und er saß beim Autor.*

`tsc` leer · `ci:import-exists` (2315) · `ci:client-bundle-lint` · `ci:flow-smoke` (205) ·
Quelltext-Wächter (1930) · Render-Wächter (217) · Persistenz-Suiten (1372) · Akzent-Ratchet grün.

changelog: 2026-08-23-saisonstand-hovers-und-eine-guv.json
