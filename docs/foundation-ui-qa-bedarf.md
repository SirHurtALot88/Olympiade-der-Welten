# Foundation UI/UX QA - Seite fuer Seite

Stand: 2026-06-19

## Browser-QA erledigt
- Home: Desktop ohne Layout-Overflow; Mobile-Hero und Play-Lane auf echte Einspalten-Layouts gebracht.
- Globaler Kontext: sichtbare Admin-Sprache reduziert. "Aktiver Kontext" heisst jetzt "Spielstand"; Phasen werden als Spielbegriffe angezeigt.
- Teamsteuerung: "UI-Fokus-Team", "Local Owner", "Control ai" und aehnliche Admin-Begriffe in Manager-/Team-Sprache uebersetzt.
- Saisonstand: Mobile-Scrollproblem gefixt. Breite Tabellen bleiben im Scroll-Container, die Seite selbst bleibt 390px breit.
- Transfermarkt: sichtbare "Read-only", "SQLite", "Buy", "Pool Audit" und "Scope"-Texte in normale Markt-/Planungssprache uebersetzt.
- Mobile Dock/Header: Dock bleibt innerhalb der Viewportbreite; Kontextbanner stackt sauber.
- Live-Check: `/foundation`, Transfermarkt APIs, Standings Preview und Preisgeld Preview antworten erfolgreich.

## Home
Erledigt:
- Managerkarte nutzt "Manager" und "automatisch/gefuehrt/beobachtet" statt Owner/Control.
- Mobile Karten laufen nicht mehr aus dem Viewport.
- Multiplayer-Block spricht von Teams/Mitspielern/automatisch gefuehrten Teams.
- Flow-Controller heisst jetzt Spielablauf; Source-/Auswahlchips wurden in Spielstand-/Saison-Sprache uebersetzt.
- Home-Spielerkarten zeigen keine nutzlosen Fit-Tags mehr; XP 0 und Erschoepfung 0 werden ausgeblendet.
- Home-Spielerbuttons springen jetzt konkret: Training zum Spielertraining, Upgrade zum XP-Planen, Verkaufen in den Verkaufsdialog.

Noch sinnvoll:
- Save-Name ist noch sehr lang und prominent. Spaeter eventuell kuerzen oder in ein kleines Save-Menue verschieben.
- "AI" als Kuerzel ist an einigen Stellen noch sichtbar. Wenn komplett nicht-technisch gewuenscht, in "Auto" umbenennen.

## Einsatzliste
Erledigt:
- Vorherige Flow-Upgrades bleiben aktiv: offene Slots, aktiver Slot, naechster Slot, Top-Pick, Team-Boost statt Einzelboost.
- Coach-Leiste ist jetzt ein echter 6-Schritt-Flow: Fokus, Einsetzen, Captain, Taktik, Speichern, Arena.
- Sichtbare Quellen-/Statusreste im Kopf und in der Preview wurden in Spielsprache uebersetzt.

Noch sinnvoll:
- Browser-Drag-and-drop einmal manuell visuell testen; automatisiert ist das schwer belastbar.

## Arena
Erledigt:
- "Matchday Arena" wurde zu "Spieltag Arena".
- Technische Resolve-/SQLite-Hinweise in der sichtbaren Arena entfernt.
- Arena wirkt mehr wie Broadcast und weniger wie Tabelle.
- Eventmodus als Toggle eingebaut: groessere Buehne, staerkerer Broadcast-Fokus, kompaktere Ergebnisaktion.
- Eventmodus hat jetzt zusaetzliche Lane-/Result-Animationen fuer mehr Broadcast-Gefuehl.
- Ergebnisboard nutzt jetzt Spielsprache, eine klare Entscheidungszeile und eine staerkere Siegerkarte.
- Status-Kacheln sprechen jetzt von Arena/Zustand statt technischem Status.

Noch sinnvoll:
- Ergebnisboard langfristig noch staerker als kompletter Kampfverlauf mit Reveal-Timeline ausbauen.

## Teams
Erledigt:
- Teamkarten zeigen Bedarf, Economy und Bereichsranks.
- Mobile Breite bleibt stabil.
- Teamdrawer hat jetzt Tabs fuer Kader, Vertraege und Historie.
- Spieler im Teamdrawer oeffnen per einfachem Klick.

Noch sinnvoll:
- Kaderrollen in der Detailansicht noch prominenter machen.
- Optional eigener Transfer-Tab im Teamdrawer, sobald Team-Transferdaten dort gebuendelt werden.

## Saisonstand
Erledigt:
- Mobile Dokumentbreite gefixt; Tabelle scrollt im Container.
- Scroll-Hinweis fuer breite Tabellen vorhanden.
- Kompakte Leaderboard-Karten vor der Tabelle ergaenzt, inklusive aktivem Team und Rangdelta.
- Saisonstand startet jetzt mit Top-Story-Karten fuer Titelrennen, eigenes Team, Momentum, Star und Bereichsleader.

Noch sinnvoll:
- Saisonstories spaeter mit Formkurve/letzten Spieltagen erweitern.

## Transfermarkt
Erledigt:
- Buy/Watch/Sell zeigt Gruende und Warnchips.
- Aktive Filterchips sichtbar.
- Technische Markttexte in Spielsprache uebersetzt.
- Empty State hat direkte Aktion.
- Auto-Analysebereiche sind standardmaessig eingeklappt und koennen bei Bedarf bewusst geoeffnet werden.
- Aufgeklappte Auto-Bereiche nutzen mehr Spielsprache: Auto-Teams, Hinweise, Steuerung, Planung statt AI/Warnings/Control.

Noch sinnvoll:
- Spieler-Hoverpreview bzw. Schnellpreview fuer mobile als Bottom Sheet.
- "Auto" statt "AI" konsequent im sichtbaren UI durchziehen.

## Training & Gebaeude
Noch sinnvoll:
- Status-/Source-Chips nochmal per Browser gezielt pruefen.
- Facility-Zustand eher als Wartungskarten statt Statusmatrix darstellen.

## Spieler
Erledigt:
- Spielerdrawer hat eine sticky Sprungnavigation fuer Profil, Achsen, Diszis, Entwicklung, Transfer und Historie.
- Drawer-Sprache weiter geglaettet: Development/Season-Reste in Hauptueberschriften reduziert.
- Sichtbare Profilchips sprechen jetzt von Marktprofil/Spielerprofil, Scout-Wert, Erschoepfung, Saisonpunkten und TP Auto statt Source/RTG/Fatigue/Season/AI.
- Spieler koennen jetzt im Season-End-Apply auch echte Regression erhalten: bei hoher Rueckschrittsschuld verliert das Weak-Development-Attribut 1 Punkt und wird als Progression-Event gespeichert.
- Trainingskarten zeigen Netto-Entwicklung, Rueckschrittdruck und negative Diszi-Deltas statt nur Verbesserungen.

Noch sinnvoll:
- XP-CTA sticky im Drawer, wenn Upgrade sinnvoll ist.
- Risikowerte weiter in kurze Spielsprache uebersetzen.

## Ranks / Diszis
Erledigt:
- Ranks starten mit Leadercards.
- Diszi-Konfiguration hat Filterchips fuer Alle, POW, SPE, MEN und SOC.

Noch sinnvoll:
- Ranks optional als Bereichskarten statt nur Tabelle.

## Transferhistorie
Erledigt:
- Recap-Sprache wurde geglaettet: Top-Zugaenge, Abgaenge, Teamuebersicht, Hinweise und Steuerung statt Read-only/Warnings/Control.
- Recap startet jetzt mit Story-Karten: groesster Kauf, bester Verkauf, Value Deal und riskanter Move.

Noch sinnvoll:
- Technische Scope-Warnungen nur in Detail-/Analysemodus zeigen.

## Performance
Erledigt:
- `content-visibility` fuer schwere Listen/Tabellen als erste Entlastung.

Noch sinnvoll:
- Foundation-SSR/Ladezeit ist spuerbar hoch. Beim Neustart dauerte `/foundation` teils 8-25 Sekunden.
- Echte Virtualisierung fuer Saisonstand, Spielerlisten und Transfermarkt.
- Daten fuer Home leichter laden als fuer komplette Foundation.
