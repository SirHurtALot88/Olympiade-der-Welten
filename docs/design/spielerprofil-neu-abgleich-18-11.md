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
- Kopf (Zurück, Name, Blättern, Zustand, Merken) steht im Seiten-Slot des Regiebands, die Reiter im Unterreiter-Platz (siehe „Einbau in den App-Rahmen“). Im Band ist wenig Platz: bei Verletzung steht dort nur „verletzt · N Spieltage“, der Satz „nicht einsetzbar · noch N Spieltage“ steht ausgeschrieben in der Einsatzfähigkeits-Karte und im Kurzprofil.
- PP-Skala: nur die Markierung bei 5, die Werte sind die echten gebuchten.

## Fehlt

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

Der Kopf der Seite (Zurück, Porträt, Name, Blättern, Team und Liga, Form, Moral, Status, Merken) steht jetzt im **Seiten-Slot des Regiebands** (`FoundationBandSlot`), die sechs Reiter im Unterreiter-Platz des Bands (`FoundationSubNav` in der Shell). Die Seite hat keinen eigenen Kopf mehr, ihre Höhe richtet sich nach `--fb-u` und der Bandhöhe.

**Korrektur der Höhe (19.11.):** die Neuaufnahme im Rahmen zeigte, dass die Seite 73 px zu hoch war (Dokument 1153 statt 1080 bei 1920x1080, gleiche Abweichung bei 2560 und 1710): Panel-Polster (16 px) und Schalen-Fuß (48 px) des Rahmens fehlten in der Rechnung. Jetzt `100vh - 4,5 · --fb-u - 120px`; gemessen bei 1920x1080, 2560x1440 und 1710x1112: Dokumenthöhe = Fensterhöhe, nichts scrollt.

## Stand der Aufnahmen (19.11., alle im Rahmen neu)

Alle Bilder in `spielerprofil-neu-18-11/` sind neu aus dem Produktionsbau der App (`OLY_SHOT_PROD=1`, deviceScaleFactor 1, Wegwerf-Battle-Save nach vier Spieltagen, Skript `scripts/screenshot-spielerprofil-neu.ts`, Save danach gelöscht, `.next` danach gelöscht):

- **2560x1440 und 1920x1080:** `01` Überblick Star, `02` Überblick verletzt, `03` Disziplinen, `04` Leistung verletzt, `05` Vertrag, `06` Entwicklung, `07` Karriere, `08` Nebel fremder Spieler, `09` ohne Figur.
- **1710x1112:** `01`, `02` Überblick (Star, verletzt).
- **Kurzprofil:** `10` Drawer Star, `11` Drawer verletzt (2560 und 1920), `12` Überblick mit verletzter Figur (rotes Band), `13`/`14`/`15` Drawer vor Verlängern, Verkaufen, Ganzes Profil, dazu `13-aktion-verlaengern-…`, `14-aktion-verkaufen-…`, `15-aktion-ganzes-profil-…` nach dem Klick.
- `abgleich-*.png` (links Mockup, rechts App) sind **nicht neu**: sie stammen aus der Zeit vor dem Einbau in den Rahmen und zeigen den alten eigenen Kopf.

## Klicktest Kurzprofil, Verlängern, Verkaufen (19.11., echte App im Produktionsbau)

Weg: Teamansicht, Kaderkarte anklicken, Kurzprofil, dann je Knopf. Gemessen mit Playwright gegen den Produktionsserver.

- **Kurzprofil** öffnet über die Kaderkarte (Skript findet die Karte jetzt über `.home-v2-player-name`; die alte Suche nach Tabellenzeilen fand nichts, Kader sind Karten unter dem Falz).
- **Ganzes Profil öffnen** wechselt auf `?view=playerProfile&tab=overview&playerId=…`, die Seite mit Rahmen-Kopf steht.
- **Verlängern** öffnet die Gehaltsverhandlung. **Das ging zunächst nicht:** das Fenster saß außerhalb des Bildschirms (Hintergrund verwischt, kein Fenster sichtbar). Ursache: `fb-auf … both` in `components/foundation/broadcast/rahmen.css` ließ nach dem Aufstieg ein `transform` am Inhalt stehen; damit wurde `.foundation-content` zum Bezugsrahmen für `position: fixed`, der Hintergrund maß 2761 px statt 1080 px und das Fenster saß in dessen Mitte. Behoben mit `backwards` statt `both`; danach misst der Hintergrund 1080 px und das Fenster steht mittig. Betrifft jedes Fenster aus der Teamansicht, nicht nur das Profil.
- **Das Fenster zeigt mitten in der Saison „Gehaltsverhandlung öffnet am Season-End (nach MD10) – bis dahin nur Vorschau“** und sperrt die Schritte; das ist die bestehende Regel, kein Fehler dieses Baus.
- **Verkaufen:** der Aufruf geht raus, die Antwort ist `409 sell_only_at_season_end` (Verkauf nur zum Saisonende). Es öffnet sich kein Fenster, und in den sechs Sekunden danach war keine sichtbare Meldung zu sehen. Das ist das Verhalten des bestehenden Verkaufswegs; ob er eine sichtbare Rückmeldung geben sollte, ist eine eigene Frage und hier nicht verändert.

## Messung

Je Aufnahme prüft das Skript `scrollWidth/-Height`. Dokumenthöhe = Fensterhöhe bei allen drei Zielbildschirmen. Im ersten Durchlauf meldeten die Seiten mit verletztem Spieler `seiteScrollt: true` über die Breitenprüfung: das Band ragte rechts über (Merken über der Saison-Uhr, „Weiter“ angeschnitten), weil Name, Zurück-Wort und der lange Status nicht nebeneinander passten. Jetzt steht im Band nur „verletzt · N Spieltage“, bei Verletzung nur der Pfeil statt „Zurück“, der Namenskasten hat eine Mindestbreite, und die Überblick-Bilder (`01`, `02`, `12`, alle drei Größen) sind danach neu aufgenommen und melden `seiteScrollt: false`. `03`–`09` stammen aus dem Durchlauf davor (anderer Wegwerf-Save, also andere Spielernamen); ihr Inhalt hat sich durch die Band-Änderung nicht verschoben, ihre Messzeile war aber noch die alte. Bei 1710x1112 wird der Name im Band noch mit „…“ gekürzt. Gemeldete Überbreite sonst nur bei der Pixel-Figur, die absichtlich über ihren Kasten hinausragt (durchsichtiger Rand, abgeschnitten).
