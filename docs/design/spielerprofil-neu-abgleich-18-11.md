# Spielerprofil neu: Abgleich Mockup und App (18.11.)

Gebaut nach `public/mockups/spielerprofil-modern-18-11.html` und `docs/design/spielerprofil-modern-18-11.md`, mit Chris' Entscheidungen vom 18.11. und den zwei Nachträgen (Gehalt groß je Saison, klein je Spieltag; Marktwert für alle exakt sichtbar, Nebel für Eignung, Achsen, Attribute und Potenzial).
Aufnahmen aus der echten App (Wegwerf-Battle-Save nach sieben Spieltagen, Skript `scripts/screenshot-spielerprofil-neu.ts`) liegen in `docs/design/spielerprofil-neu-18-11/`, je Reiter bei 2560x1440, 1920x1080 und 1710x1112. Die Gegenüberstellung links Mockup, rechts App steht in `abgleich-*.png` im selben Ordner.

## Aufbau im Code

| Teil | Datei |
|---|---|
| Seite mit sechs Reitern | `app/foundation/spielerprofil/SpielerprofilSeite.tsx` und `Tab*.tsx` |
| Kurzprofil (Drawer ohne Reiter) | `SpielerKurzprofil.tsx`, geöffnet über `SpielerKurzprofilHost.tsx` und `lib/foundation/spieler-kurzprofil-store.ts` |
| Figuren-Bühne, PP-Balken, Bausteine | `bausteine.tsx` |
| Eigenes CSS (`spr-`, wächst mit Breite und Höhe) | `spielerprofil.css` |
| Datenseite (Ränge, Verletzung, Nebel, Wege, Gehalt) | `lib/foundation/spielerprofil-modell.ts`, Hook `use-spielerprofil-modell.ts` |

Alle Listen rufen weiter `openPlayerDrawerById`; das öffnet jetzt das Kurzprofil. „Ganzes Profil öffnen“ führt auf die Seite (`?view=player-profile&playerId=…&tab=…`). Alte Reiter-Namen in URLs (`details`, `training`, `report`) werden auf die neuen abgebildet.
Entfernt: `PlayerDetailDrawer.tsx` (4337 Zeilen), `PlayerHeroNewLook.tsx`, `PlayerProfileClient.tsx`, die drei Hilfsbauteile in `player-profile/`, rund 2650 Zeilen toter `player-*`-Regeln in `app/globals.css`.

## Drin

- **Überblick:** Figur groß auf der Kulisse der besten Disziplin (Stand, Lauf, Angriff, Treffer anklickbar, Drehen, Porträt groß ohne Figur, rotes Band bei Verletzung), Form-, Moral- und Einsatzkarte, zwölf Attribute in vier Achsen, „Hier ist er stark“ mit Primär-/Nebenweg, Player Points mit Balken je Spieltag und Ziellinie 5, Vertrag in Kurzform.
- **Disziplinen:** 20 Kacheln in vier Achsenspalten mit Eignung, **Rang in der Liga** und **Rang unter allen aktiven Spielern**, Kaderrang (Top 6 markiert), PP und **PP-Rang in der Liga**; rechts „Warum diese Zahl“ (Matrixgewichte, Attributwerte, Beiträge, Weg) und die besten 6 des Kaders.
- **Leistung:** PP je Spieltag (gebuchte Werte aus dem Saison-Ledger), Einsatztabelle mit Rang am Spieltag, Form davor/danach, Zeile „verletzt · × 50 %“ im Spiel der Verletzung.
- **Entwicklung:** Potenzial, zwölf Attribute Saisonstart, heute, Decke (im Nebel als Spanne), Training (Intensität und Klasse, nur eigene Spieler), Trainingsverlauf, Verletzungen.
- **Vertrag:** Gehalt **groß je Saison, klein je Spieltag**, Ratenleiste, Staffel je Saison, Marktwert (exakt für alle), Kaufpreis, Gehaltsrang im Kader, Entscheidungen Verlängern und Verkaufen (bestehende Verhandlungs- und Verkaufs-Fenster), Forderungen, Platz für die Vorstand-Freigabe.
- **Karriere:** Saison-Zeilen mit Liga, Geschichte, Auszeichnungen, Wechsel.
- **Kurzprofil:** Figur, Statuszeile (verletzt · nicht einsetzbar · noch N Spieltage in Rot), Gesicht und Pfeil, Gesamtwert, PP mit Liga-Rang, Gehalt, alle 20 Disziplinen mit Liga-Rang, PP-Balken, letzte Einsätze, Verlängern, Verkaufen, Merken, Ganzes Profil öffnen.
- **Nebel** bei fremden Spielern: Eignung, Achsen, Attribute, Potenzial und Ränge nur als Bereiche (unbekannt 10er-Stufe, beobachtet 5er-Stufe, voll gescoutet exakt); Form und Moral nur als Stufe, keine Gründe. Der globale Schalter `NEXT_PUBLIC_DEBUG_PLAYER_ATTRIBUTES` (heute standardmäßig „alles sichtbar“) wirkt unverändert; `hatNebel` liest dieselbe Sichtbarkeit wie das Scouting.

## Angepasst gegenüber dem Mockup (Chris-Entscheidungen)

- Keine Kaderrolle als Wort; kein Reiter „Report“.
- Disziplinen kompakter, mit Liga-Rang und Rang unter allen Aktiven; PP mit Liga-Rang; Kaderstärke über die besten 6.
- Gehalt groß je Saison, klein je Spieltag (Überblick, Vertrag, Karriere, Kurzprofil).
- Kopf (Zurück, Name, Blättern, Reiter, Zustand) steht in der Seite selbst, weil der App-Rahmen mit dem Regieband noch nicht auf `main` liegt; er wandert später in dessen Slot.
- PP-Skala: nur die Markierung bei 5, die Werte sind die echten gebuchten.

## Fehlt

- Regieband und Seiten-Slot (App-Rahmen nicht auf `main`).
- Rollen je Disziplin mit „Passung“ (im Mockup erfunden; im Bau wäre es die Platzwert-Funktion der Einsatzliste).
- Duell-Ergebnis (S/U/N) je Einsatz und Rang-Verlauf in der Leistungstabelle: die Zuordnung „er war aufgestellt“ ist noch nicht gebaut.
- Marktwert-Verlauf je Spieltag (nur je Saison).
- Dialoge Verlängern/Verkaufen im Mockup-Stil: es öffnen die bestehenden Fenster.
- Vorstand-Freigabe mit Quote und freiem Betrag: nur der Platz mit dem vorhandenen Vorstandsvertrauen, die Quote folgt mit der Finanz-Stufe. Ein Fog-Schalter aus #1597 ist noch nicht vorhanden.
- Blättern mit ↑/↓ im Drawer; die Seite blättert nur im Kader des Teams.
- Form-Kurve nur für die laufende Saison.
- Aus der alten Schublade nicht übernommen: Klassen-Vorschau, Trainingshistorie als Diagramm, Potenzial-Drift je Saison, Disziplin-Forecast; die zugehörigen reinen Quelltext-Tests sind entfernt, die Rechenlogik-Tests blieben.
- Die Verletzungs-Mechanik selbst (50 % in der Verletzungs-Disziplin gebucht) liegt auf eigenem Branch; die Anzeige liest die vorhandenen Verletzungsdaten.
- Phone ist nicht Teil dieses Baus.

## Einbau in den App-Rahmen (Runde 2)

Der Kopf der Seite (Zurück, Porträt, Name, Blättern, Team und Liga, Form, Moral, Status, Merken) steht jetzt im **Seiten-Slot des Regiebands** (`FoundationBandSlot`), die sechs Reiter im Unterreiter-Platz des Bands (`FoundationSubNav` in der Shell). Die Seite hat keinen eigenen Kopf mehr, ihre Höhe richtet sich nach `--fb-u` und der Bandhöhe. **Alle Bilder in `spielerprofil-neu-18-11/` stammen noch aus der Zeit vor diesem Einbau** (eigener Kopf in der Seite, alter Rahmen); die Neuaufnahme im Rahmen steht aus (siehe unten).

## Stand der Aufnahmen

Vorhanden (Wegwerf-Save, Skript `scripts/screenshot-spielerprofil-neu.ts`): alle Reiter bei **2560x1440** (Überblick Star, Überblick verletzt, Disziplinen, Leistung verletzt, Vertrag, Entwicklung, Karriere, Nebel fremder Spieler, ohne Figur), bei **1920x1080** Überblick, Überblick verletzt, Disziplinen, Leistung, Vertrag, dazu vier Gegenüberstellungen `abgleich-*.png` (links Mockup, rechts App).
**Offen:** Entwicklung, Karriere, Nebel und ohne Figur bei 1920x1080, der ganze Satz bei 1710x1112 und die Drawer-Bilder. Der Rechner war durch parallele Dev-Server überlastet (Server stürzten ab), die Läufe laufen seit der Sperre über `flock /tmp/oly-aufnahme.lock`; das Skript setzt mit `OLY_SHOT_VORHANDENE_UEBERSPRINGEN=1` dort fort, wo es aufgehört hat. Der Drawer wird über die Kaderzeile der Teamansicht geöffnet; das Auffinden der Zeile ist im Skript noch nicht bestätigt. Die Messung unten gilt für die vorhandenen Bilder.

## Messung

Je Aufnahme prüft das Skript `scrollWidth/-Height`: die Seite scrollt bei allen drei Zielbildschirmen nicht. Einzige gemeldete Überbreite ist die Pixel-Figur, die absichtlich über ihren Kasten hinausragt (durchsichtiger Rand, abgeschnitten).
