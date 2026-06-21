# Foundation UI/UX Top 100 Backlog

Prioritaet liegt auf Gameflow, Einsatzliste, Arena, Home, Transfermarkt und Teams. Ziel: weniger spielbare Tabellen, mehr Spiel-App mit klarer naechster Aktion.

## Fortschritt
Stand: 100/100 umgesetzt.

1-10 erledigt: Globales Spiel-Dock, Next-Play/Leertaste-Flow, uebersetzte Home-Warnungen, Home-Manager-Lane, Einsatzlisten-Status "Was fehlt noch?", staerkerer aktiver Slot, gekoppelter Kandidatenrail mit Top-Pick-Signal, teamweiter Boost/Taktik-Fokus, klarere Arena-Timeline und Arena-Zuruecksprung nur bei offenen Lineups.

11-20 erledigt: Saisonstand-Race-Summary bleibt aktiv, Transfermarkt hat ein Buy/Watch/Sell-Entscheidungsboard, Teamkarte auf Home ist klickbar mit Drawer-Doppelklick, Aufgaben wirken als Quests mit Dringlichkeit, Kontext/Warnings bleiben uebersetzt, Home hat Heute-wichtig-Karten, sichtbaren Matchday-Fortschritt, kompaktere Team-/Liga-Signale, Spielerhinweise fuer Risiko/Upgrade/Markt und sortierte Aufgaben nach Kritikalitaet.

21-30 erledigt: Home-News/Story Cards sind als Feed mit Kategorie-Icons scanbarer, Liga-Kurzkarte bleibt kompakt, mobile Home/Transfer-Karten fallen sauber auf eine Spalte, Einsatzlisten-Slotboard nutzt D1/D2-Zonen, Auto-Fill mit Undo bleibt der schnelle Vorschlag, Captain-Badge und Fatigue direkt am Slotspieler sind sichtbar, Kandidaten zeigen Score-Delta, Team-Taktik/Team-Einsatz sind zentral und "Naechster Slot" springt direkt zum naechsten offenen Einsatz.

31-40 erledigt: Speichern/Assign bleibt animiert, Warnungen sind kontextueller, Arena zeigt Gewinner und Topspieler deutlicher, Timeline/Reveal-Progress sind staerker, Motion-Beats bleiben reduziert kompatibel, Result Board erklaert "Was hat entschieden?", Ergebnis-CTA fuehrt zu Saisonstand/Spieltagsergebnis, fehlende Lineups erscheinen als To-do-Karten und mobile Arena-Spuren brechen sauber um.

41-50 erledigt: Saisonstand hat gepinnte Kernspalten, Bereichsleader, aktives Team, Podium, Sprunglinks, ruhigen Hover, Kompakt/Expert-Modus, mobile Top-Player/Archivlogik und Teamvergleich startet nun mit Teamkarten statt nur Tabelle.

51-60 erledigt: Teamkarten zeigen nun Transferbedarf, Economy-Kontext und POW/SPE/MEN/SOC-Rang-Badges, Player-Drawer behalten ihren Kopf beim Scrollen, und der Ranks-Reiter startet mit Leadercards fuer Gesamtstaerke und Bereiche statt direkt mit Tabellenwand.

61-70 erledigt: Transfermarkt-Decision-Cards zeigen Buy/Watch/Sell-Gruende und Warnchips, aktive Filter erscheinen direkt ueber der Tabelle, die Wishlist bleibt als eigener Streifen nutzbar, Aktionen sind klarer erreichbar und leere Marktzustaende haben jetzt einen direkten Filter-lockern-Button.

71-80 erledigt: Seiten, Karten und neue Decision-Elemente nutzen einheitliche Soft-Motion, Hover/Active/Fokus-Zustaende sind staerker, Zeilenspruenge koennen visuell aufblitzen, mobile Dock-Bedienung bleibt sticky und Reduced-Motion deaktiviert die Effekte sauber.

81-90 erledigt: Source-/Debug-/Read-only-Hinweise sind in den normalen Spielansichten weiter versteckt, Arena nutzt sichtbar Spieltag-Sprache statt technischen Resolve-/SQLite-Status, wichtige Warnungen bleiben als echte Handlungsblocker sichtbar und mobile breite Tabellen zeigen einen dezenten Scroll-Hinweis.

91-100 erledigt: Die grossen Ausbaupunkte sind als stabile erste Stufe umgesetzt: schwere Tabellen/Listen nutzen Browser-Render-Entlastung, Sprunganker respektieren Header/Dock, Arena wirkt breiter und mehr wie Broadcast, Karten/Texte umbrechen robuster und Accessibility-/Fokusregeln greifen konsistenter.

## P0 - Sofort spuerbarer Flow
1. Globales Spiel-Dock fuer Weiter, Home, Einsatzliste, Arena und Markt.
2. Leertaste-Flow visuell deutlicher als "Next Play" kommunizieren.
3. Home-Warnungen von internen Codes in klare Spielersprache uebersetzen.
4. Home als echte Manager-Zentrale staerken: naechster Schritt, Teamzustand, Matchday, Aufgaben.
5. Einsatzliste immer mit sichtbarem "Was fehlt noch?"-Status.
6. Einsatzliste: aktiver Slot muss deutlicher gepulst/markiert sein.
7. Einsatzliste: Kandidatenrail staerker an den aktiven Slot koppeln.
8. Einsatzliste: Teamweite Boosts als Matchday-Entscheidung inszenieren.
9. Arena: klarer "Start / Reveal / Ergebnis"-Rhythmus.
10. Arena: Zurueck-zur-Einsatzliste nur zeigen, wenn Lineups fehlen.
11. Saisonstand: Race-Summary oberhalb der Tabelle.
12. Transfermarkt: Kandidaten in Buy/Sell/Watch-Logik klarer trennen.
13. Teams: Team-Drawer und Karten als Hauptnavigation nutzen.
14. Inbox: Aufgaben als Spiel-Quests statt technische Meldungen darstellen.
15. Kontextbanner kompakter machen, Dock und Flow-HUD uebernehmen Orientierung.

## P1 - Hauptseiten
16. Home: aktive Teamkarte klickbar mit schneller Teamwahl.
17. Home: "Heute wichtig" als 3-Karten-Streifen.
18. Home: Matchday-Countdown mit Slot-Fortschritt.
19. Home: Spielerkarte mit Risiko/Upgrade/Verkaufen-Hinweisen.
20. Home: Aufgaben nach Kritikalitaet sortieren und weniger Rohdaten zeigen.
21. Home: News/Story in Feed-Optik mit kleinen Icons.
22. Home: Liga kurz als kompakte Leaderboard-Karte.
23. Home: mobile Layouts staerker verdichten.
24. Einsatzliste: Slots nach D1/D2 optisch wie Spielfeld-Zonen darstellen.
25. Einsatzliste: Auto-fill als Vorschlag mit Undo und Preview.
26. Einsatzliste: Captain-Wahl visuell mit Krone/Leader-Badge.
27. Einsatzliste: Erschoepfung und Risiko direkt am Spielerbild anzeigen.
28. Einsatzliste: Diszi-Synergie und Score-Delta beim Hover.
29. Einsatzliste: Team-Taktik pro D1/D2 als Segmentsteuerung.
30. Einsatzliste: "naechster offener Slot" per Button und Space direkt fokussieren.
31. Einsatzliste: Erfolg nach Speichern mit kurzer Animation.
32. Einsatzliste: Warnungen nur kontextuell, keine Debuglisten.
33. Arena: Ergebniskarten mit klarer Gewinnerseite.
34. Arena: Reveal-Schritte mit Progress.
35. Arena: Topspieler des Duells prominenter.
36. Arena: Sound-/Motion-freundliche visuelle Beats ohne Ueberladung.
37. Arena: Result-Summary mit "Was hat entschieden?".
38. Arena: Nach Ergebnis direkt zu Saisonstand oder naechstem Team.
39. Arena: fehlende Lineups als kompakte To-do-Karten.
40. Arena: mobile Ansicht als vertikaler Kampfverlauf.

## P2 - Tabellen zu App-Flows machen
41. Saisonstand: gepinnte Kernspalten bleiben, Detailspalten in Gruppen.
42. Saisonstand: Bereichsleader immer sichtbar.
43. Saisonstand: aktives Team als Linie/Glow markieren.
44. Saisonstand: Top-3 subtile Podium-Faerbung.
45. Saisonstand: "Springe zu Finanzen/Diszis/Kern" als Tabs.
46. Saisonstand: Zeilenhover ohne Layoutshift.
47. Saisonstand: Tabellenmodus "Kompakt / Analyse".
48. Saisonstand: Top Player als Cards auf Mobile.
49. Saisonstand: Archivmodus visuell klar read-only.
50. Teams: Teamliste mit Scorecards statt nur Tabelle.
51. Teams: Teamdetail mit Kaderrollen-Spalte.
52. Teams: Transferbedarf als Ampel.
53. Teams: Salary/Cash/MW als Balanced Score.
54. Teams: POW/SPE/MEN/SOC Ranks ueberall mit Rang-Badge.
55. Spieler: Player-Drawer als echte Karte mit Sticky Header.
56. Spieler: Tabs im Drawer fuer Profil, Saison, Training, Markt.
57. Spieler: Risikowerte direkt uebersetzen.
58. Spieler: XP-Upgrade-CTA an sinnvollen Stellen.
59. Ranks: Topwerte als Leadercards vor Tabelle.
60. Diszis: Kategorien farbig und filterbar.

## P3 - Transfermarkt
61. Transfermarkt: Buy Board mit Empfehlung, Risiko, Fit und Preis.
62. Transfermarkt: Sell Board mit Gewinn, Vertragsende, Kaderimpact.
63. Transfermarkt: Wishlist als feste Seitenleiste.
64. Transfermarkt: Spieler-Preview beim Hover/Focus.
65. Transfermarkt: Teamfilter und Budget immer sichtbar.
66. Transfermarkt: "Warum kaufen?" und "Warum nicht?" als Chips.
67. Transfermarkt: Marktwert/Gehalt kompakter als Economy-Kacheln.
68. Transfermarkt: Tabellenaktionen erst bei Hover, aber mobil sichtbar.
69. Transfermarkt: Filterzustand als Chips.
70. Transfermarkt: leere Zustaende mit konkreter naechster Aktion.

## P4 - Spielgefuehl und Motion
71. Globale Seitenwechsel mit kurzer Fade/Slide-Animation.
72. Kartenhover mit leichtem Lift, keine starken Spruenge.
73. Naechster Schritt pulst nur dezent bei Blockern.
74. Erfolgsaktionen mit kurzem Confirmation-Flash.
75. Tabellenzeilen markieren sich beim Sprung.
76. Reduzierte Bewegung respektieren.
77. Sticky CTA auf Mobile.
78. Schnellzugriff mit letzten Aktionen.
79. Tastaturhilfe nur bei Bedarf, nicht als Dauertext.
80. Fokuszustand fuer Tastaturbedienung deutlich.

## P5 - Komfort und Konsistenz
81. Alle internen Statuscodes uebersetzen.
82. Read-only/Debug-Hinweise nur in technischen Views.
83. Einheitliche Badge-Texte fuer ready/warning/blocked.
84. Einheitliche Button-Hierarchie pro Panel.
85. Gleiche Begriffe fuer Einsatzliste/Lineup vermeiden.
86. "Spieltag" statt "Matchday" in Spielertexten, ausser technische Quellen.
87. Fehlermeldungen mit Zielbutton ausstatten.
88. Ladezustaende mit Skeletons statt Textwarten.
89. Persistente Teamwahl klar sichtbar.
90. Mobile Horizontal-Tabellen mit besserer Scroll-Hilfe.

## P6 - Spaetere grosse Hebel
91. Dashboard-Route als eigener Home-Screen mit schnellerem Datenbedarf.
92. Einsatzliste virtualisieren, wenn sehr viele Spieler sichtbar sind.
93. Transfermarkt virtualisieren.
94. Arena als eigene inszenierte Vollbildansicht.
95. Saisonstand optional als Card-Leaderboard fuer Manager-Modus.
96. Teamwechsel-Dock fuer Multi-Team-Owner.
97. Replay/History fuer Spieltagsergebnisse.
98. Onboarding fuer erste Saison.
99. Theme-Tuning pro Olympia/Fantasy-Welt.
100. Accessibility-Pass mit Screenreader-Labels fuer alle Flow-Aktionen.
