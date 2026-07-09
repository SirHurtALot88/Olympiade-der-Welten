# Foundation Gameplay/UI/Performance Top 100

Status: laufende Arbeitsliste fuer die naechsten UI-/Gameplay-/Performance-Patches. Reihenfolge = erwarteter Spieler-Nutzen.

## Jetzt Gestartet
1. Hauptseite entlasten: schwere Team-Vertragsforecasts nur im Vertrags-Subtab bauen. Status: erledigt.
2. AI-Preview und AI-Marktimpulse nur bei offenen Zusatzpanels berechnen. Status: erledigt.
3. Transfermarkt-Zeilen nur im Markt-Tab filtern/sortieren. Status: erledigt.
4. Transferhistorie nur im Historien-Tab aufbereiten. Status: erledigt.
5. Sichtbarer Schnellmodus-Chip im Flow-Coach. Status: erledigt.
6. Browser-QA ueber Home, Einsatzliste, Arena, Teams, Training, Markt, Historie, Saisonstand, Ranks und Diszis. Status: erledigt, siehe `docs/tab-performance-baseline-v1.md`.
7. Ladezeitmessung fuer Tab-Wechsel Home -> Einsatz -> Arena -> Markt. Status: erledigt, siehe `docs/tab-performance-baseline-v1.csv`.
8. Einsatzliste: naechster freier Slot noch deutlicher hervorheben. Status: erledigt (`LegacyLineupLabClient`: `is-next-target`, Auto-Focus auf `nextOpenSlotKey`).
9. Einsatzliste: Kandidaten nach "passt sofort" statt nur Score gruppieren. Status: erledigt (`teamdeckSortMode` Default `fit`).
10. Arena: Ergebnis-Reveal staerker als Event inszenieren. Status: erledigt (`MatchdayArenaV2Client`: `is-reveal-event` Pulse auf Timeline-Panel).
11. Transferhistorie/Recap nur im Historien-Tab laden. Status: erledigt.
12. Preisgeld-, Standings-Preview- und Management-Feeds nur in passenden Tabs laden. Status: erledigt.
13. Einsatzlisten-Fetchfehler abfangen statt Konsolenfehler werfen. Status: erledigt.
14. Initial-Placeholder darf keine Markt-, XP-, History-, Standings- oder Saisonstand-APIs feuern. Status: erledigt.
- Initial-Save-Load darf nicht an Transferhistorie-Lazy-Guard gekoppelt sein. Status: erledigt.
- XP-Preview erst im Training laden, nicht auf Home. Status: erledigt.
- Eingebettete Einsatzliste darf Kontext/Preview nicht doppelt laden. Status: erledigt.
- Live-Save-Refresh darf schwere Feeds nur fuer den aktiven Tab nachladen. Status: erledigt.
- Teams-Tab startet als leichter Kader-/Board-Fokus; Vergleich, History und grosse Tabellen bauen erst nach Klick. Status: erledigt, siehe `docs/tab-performance-hotspots-v2.md`.
- Arena-Preview ist entkoppelt: Basis/Score zuerst, Resolve/Standings im Hintergrund. Status: erledigt (`includeDetails=0` auf `/api/matchday/arena-base`, Details per Preview-APIs).
- Markt-, Historie-, Recap-, Resolve- und Standings-Fetches sind abortable. Status: erledigt.
- Version-Polling ist von 4s auf 25s plus Visibility-Pause entschaerft. Status: erledigt; aktuell 45s plus leichter Metadata-Pfad (<50ms).

## Einsatzliste
15. Slot-Status mit klaren Labels: offen, gefuellt, Konflikt, speichern. Status: erledigt (Draft-Slots: `legacy-lineup-slot-state-pill`, Issue-Chips, Save-CTA).
16. D1/D2-Flow als zwei sichtbare Arbeitsschritte statt langer Liste. Status: erledigt.
17. Team-Boost-Panel sticky neben den Slots halten. Status: erledigt.
18. "Beste Kandidaten" mit Grund anzeigen: Score, Fit, Fatigue, Rolle. Status: erledigt.
19. Kandidat per Klick auf aktiven Slot setzen, ohne Scroll-Bruch. Status: erledigt.
20. Nach Setzen automatisch naechsten Slot fokussieren. Status: erledigt.
21. Konflikte direkt am Slot klaeren statt gesammelt unten. Status: erledigt.
22. Captain-Entscheidung als eigener Schritt nach Slots.
23. Speichern-CTA erst dann prominent, wenn alle Pflichtslots gefuellt sind. Status: erledigt.
24. Bereits verwendete Spieler visuell dimmen. Status: erledigt.
25. Fatigue-Risiko mit kurzer Ursache anzeigen. Status: erledigt.
26. Diszi-Werte mit Tooltip und Rang zeigen.
27. Slotkarten kompakter fuer kleinere Screens.
28. Drag-Preview mit erwarteter Punktdifferenz.
29. "Auto-Fill Rest" als bewusstes Komfortfeature. Status: erledigt.
30. "Reset Slot" als Icon-Button pro Slot. Status: erledigt.
31. Fehlende Teamliste in Arena direkt zur Einsatzliste fuehren.

## Arena
32. Broadcast-Modus mit grosser Top-Duell-Buehne. Status: erledigt (`arena-v2-broadcast-panel` waehrend Slots-Phase).
33. Phasen-Reveal mit klarer "naechster Reveal"-Taste. Status: erledigt.
34. Score-Delta animiert einblenden.
35. Gewinnerzeile kurz hervorheben.
36. Topspieler nicht als Tabelle, sondern als Podium-Karten. Status: erledigt.
37. D1/D2-Wechsel mit Segment-Control.
38. "Warum gewonnen?" als kurze Faktor-Karten. Status: erledigt.
39. "Zurueck zur Einsatzliste" nur bei echten offenen Problemen prominent.
40. Arena-Hinweise nach Status gruppieren.
41. Ergebnisabschluss mit naechstem sinnvollen Schritt: Tabelle, Training, Markt. Status: erledigt.
42. Kleine Confetti-/Sweep-Animation fuer Top 3.
43. Tabellenbereich virtualisieren oder begrenzen.
44. Spielerbilder im Reveal lazy halten.
45. Sticky Mini-Score oben auf Mobile.
- Arena-Ladezustand als Skeleton statt leerer Panel. Status: erledigt (`arena-v2-board-skeleton-row`).

## Home
46. Home weiter als Manager-Zentrale straffen.
47. Next Play oben mit konkretem Grund. Status: erledigt (`HomeV2Client`: Next-Panel nutzt jetzt die primäre "Heute wichtig"-Begruendung statt generischem Hinweis).
48. "Heute wichtig" maximal drei Karten. Status: erledigt (`HomeV2Client`: `visibleTodayCards = todayCards.slice(0, 3)` fuer Board und Signal-Strip).
49. Kaderdruck, Lineupdruck, Marktchance als direkte Aktionen. Status: erledigt (`HomeV2Client`: Quick-Nav als direkte Foundation-Action-Cards fuer Einsatzliste, Markt, Training).
50. Spielerentwicklung: Gewinner und Risiko nebeneinander.
51. Keine Debug-/Source-Sprache in Spieleransicht.
52. Aktives Team prominent und wechselbar.
53. Multiplayer-Besitzergruppen kompakter.
54. Home-Tab soll keine Markt- oder History-Listen aufbereiten.
55. Saisonstatus mit naechstem Spieltag statt Rohstatus.

## Teams
56. Team-Kaderkarten standardmaessig nur Top-Fokus, Tabelle danach. Status: erledigt.
57. Vertrags-Tab komplett lazy halten.
58. Zusatzpanels nur manuell oeffnen. Status: erledigt fuer Vergleich/History und AI-Zusatzpanels.
59. Gehaltsdruck als Delta, nicht Absolutwert.
60. Team-Achsenkarten mit Rang + Wert.
61. Coach-Hints mit direktem Filter.
62. Vertrag auslaufend besser markieren. Status: erledigt (`FoundationTeamsDetailPanel`: auslaufende Vertraege/Zeilen bleiben sichtbar markiert und greifen ueber die kompakte Portrait-/Actions-Zeile schneller).
63. Rolle/Fit/Value als schnelle Chips. Status: erledigt (`FoundationTeamsDetailPanel`: Tabellen-Portraits laufen jetzt ueber `FoundationPlayerPortraitCard` mit Role-/Context-Meta statt nackter Mini-Bilder).
64. Tabellen-Spaltenpreset "Spielerisch" als Default pruefen.
65. Teamdrawer schneller oeffnen, Bilder lazy. Status: erledigt (`FoundationTeamsDetailPanel`: Tabellen-Portraits standardisiert ueber Foundation-Card, kleine Lazy-Portraits statt ad-hoc Bildpfad).

## Training
66. Training zuerst nach Upgrade bereit / Risiko / Stabil gruppieren.
67. Upgrade-Button direkt zum Spielerfokus und Attributbereich.
68. XP 0 nicht als Statusspam zeigen.
69. Regression sichtbar erklaeren: unter Erwartung, hoher MW-Druck, Fatigue. Status: erledigt (`training-view-shared`: sichtbarer `training-v2-regression-callout` mit Forecast, Fatigue-Warnung und Regression-Pressure).
70. Marktspieler-Normalisierung in Spielerprofil anzeigen.
71. Facilities unter Training einklappbar halten.
72. Spieler mit 0 Aktionen kompakter darstellen.
73. Negative Entwicklung nicht verstecken. Status: erledigt (`training-view-shared`: Regression-Faelle bekommen vor der Detailanalyse einen sichtbaren Decision-Callout).
74. "Level 0 / 0 XP" sauber als Startzustand formulieren. Status: erledigt (`training-view-shared`: neue Startzustand-Notation fuer Spieler ohne Saisonwerte).
75. Training-Filter per Tastatur erreichbar. Status: erledigt (`training-view-shared`: Filterkarten haben jetzt explizite Foundation-Buttons statt reiner Click-Kacheln).

## Transfermarkt
76. Marktspieler mit "normalisiert ueber Saison" Tooltip.
77. Preis/Gehalt/Value als Drei-Karten-Vergleich. Status: erledigt (`TransfermarktV2Client`: Deal-Vorschau bleibt als kompakter Vergleichsblock neben dem Spielerfokus und CTA-Stack lesbar).
78. Wunschliste als sticky Kurzliste. Status: erledigt (`TransfermarktV2Client`: Wishlist-Kontext nutzt jetzt klare Empty-/State-Kommunikation statt leerer Tabellenflaeche).
79. Kaufpreview neben Spieler halten. Status: erledigt (`TransfermarktV2Client`: Spielerfokus nutzt `FoundationPlayerPortraitCard`, Deal-Desk bleibt direkt daneben mit zusammenhaengender Vorschau).
80. Fit-Begruendung in 2-3 Chips.
81. Filterleiste kompakter und einklappbar. Status: erledigt (`TransfermarktV2Client`: leere Filter-/Kandidatenzustaende laufen ueber kompakte Foundation-States; Fokus-CTA-Buttons wurden auf die kleinere DS-Leiste vereinheitlicht).
82. Markt-Tabelle auf sichtbare Top-N begrenzen plus "mehr laden". Status: erledigt.
83. Verkauf aus Teamkontext schneller.
84. Anti-Rebuy-Hinweise als normales Spiel-Feedback.
85. Transferhistorie mit Story-Karten vor Tabelle.

## Saisonstand/Ranks/Diszis
86. Saisonstand zuerst Top 5 + eigenes Team zeigen. Status: erledigt (`displayStandingsRows`, „Alle Teams“-Toggle).
87. POW/SPE/MEN/SOC-Farben beibehalten, Rang klein dazu.
88. Finanzspalten standardmaessig einklappbar. Status: erledigt (Default `showFinanceColumns=false`, Kern/Finanzen-Toggle).
89. Tabellenkopf-Texte mit Tooltips. Status: erledigt (`SeasonStandingsV2Client`: Top-Bar-/Preset-Buttons tragen jetzt erklaerende Tooltips fuer Karten-, Kernwerte-, Finanzen- und Top-5/Alle-Teams-Switches).
90. Sticky aktive Teamzeile pruefen.
91. Historische Punkte als Trend statt Zahlenwand.
92. Diszi-Konfig als Karten + Tabelle danach.
93. Mobile Tabellen horizontal stabiler.
94. Spaltenpresets klarer benennen. Status: erledigt (`SeasonStandingsV2Client`: `Kern` wurde zu `Kernwerte`, Finanzen-/Top-5-Toggles wurden sprachlich geschaerft).
95. Tabellen-Skeletons beim Laden. Status: erledigt (`season-v2-table-skeleton-row`, `isLoading`-Prop).

## Technik/Performance
96. Dev-Server Browser-Performance-Audit pro Haupttab. Status: offen mit V12-Hinweis (`docs/tab-performance-hotspots-v12.md`: Re-Audit pending, solange Server/Runtime nicht verlaesslich verfuegbar ist).
97. Memo-Grenzen fuer Home/Teams/Market weiter schaerfen. Status: teilweise (`FoundationSeasonV2Panel`, Home-Management nur Office-Tab).
98. Grosse Tabellen listenweise paginieren oder virtualisieren. Status: weiter umgesetzt mit Transfermarkt-Schnellansicht und paginierter Transferhistorie; weitere Tabellen offen.
99. Bilder oberhalb des Folds eager, alle anderen lazy. Status: erledigt (`HomeV2Client`, `TransfermarktV2Client`: Above-the-fold Portraits laufen gezielt `eager`/`high`, restliche Karten bleiben lazy).
100. Alte TypeScript-Testfehler getrennt aufraeumen, damit Checks wieder voll gruen werden. Status: teilweise erledigt (`tests/foundation-gesamtkonzept-contract.test.ts` deckt die Sprint-6-Gesamtkonzept-Contracts separat ab; verbleibende Altfehler bleiben getrennt zu bereinigen).

## QA V1 Neue Findings
- Teams-Tab entlasten: 22s Baseline durch Tabellen-/History-Vollrender und alte Arena-Requests. Status: erledigt in V2, neuer Wert ca. 10,4s im Dev-QA.
- Arena-Preview/Standings beschleunigen oder entkoppeln: Resolve/Standings lagen bei 11-12s. Status: erledigt in V3 (`includeDetails=0`, separate Preview-Endpoints).
- Markt- und History-Fetches mit AbortController abbrechen, damit alte Requests nach Tabwechsel nicht weiterlaufen. Status: erledigt fuer UI-Fetches; Server kann bereits gestartete Dev-Requests noch fertig loggen.
- Saisonstand-Teamlogos und grosse Tabellenabschnitte weiter lazy/limitiert rendern.
- Version-Polling von 4s auf Idle-/Visibility-/Action-Takt pruefen. Status: V2 auf 25s plus hidden-pause entschaerft.

## QA V2 Neue Findings
- Transferhistorie bleibt mit mehreren tausend Zeilen der naechste grosse DOM-Hotspot; echte Pagination/Windowing priorisieren.
- Arena-Basis braucht weiterhin `lab-context` + `matchday-mvp-score`; ein kompakter Arena-Endpoint oder Client-Cache waere der naechste Hebel.
- Teams-Vergleich ist jetzt lazy, aber beim Einblenden sollte nur Top-N initial gerendert werden.
- Markt-Free-Agents bleibt 2-3s schwer; initiales Limit plus "Mehr laden" auch auf API-Ebene pruefen.

## QA V3 Neue Findings
- Transferhistorie ist jetzt paginiert (`100` initial, `Mehr laden` mit `offset`), damit der groesste Tabellen-Hotspot nicht mehr sofort tausende Zeilen rendert. Status: erledigt in V3, siehe `docs/tab-performance-hotspots-v3.md`.
- Markt-Free-Agents starten jetzt API-seitig limitiert (`48` initial, `Mehr laden` via `offset`). Status: erledigt in V3.
- Transfer-Recap ist im Markt eingeklappt und laedt nur beim Oeffnen; Historie feuert keine unnoetige Recap-API mehr. Status: erledigt in V3.
- Arena-Wechsel fuehlen sich im Client deutlich schneller an, aber serverseitige Resolve-/Standings-Previews laufen nach Tabwechsel noch zu Ende. Status: offen fuer kompakten Arena-Endpoint/Cache.
- Frischer Home-Reload bleibt im Dev-Modus spuerbar langsam, obwohl der Request-Scope sauber bleibt. Status: offen fuer weiteren Home-Start-Pass.
