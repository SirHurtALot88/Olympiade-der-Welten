status: gebaut
ergebnis: Die Sperre greift — der Fehler war die Erklärung. Roher Code-String als Nutzertext behoben, Auswahlliste zeigt jetzt „Verletzt" statt „blockiert". Die Frage der Sperrdauer liegt bei Chris.
pr: #264
titel: Verletzung war nicht erkennbar — roher Code-String als Nutzertext, „blockiert" statt „Verletzt"
schwere: hoch

> Diese Meldung kam direkt im Gespräch, nicht über die Flagge — deshalb ohne Rohmeldung.

**Befund — die Vermutung ist widerlegt.** Verletzte Spieler lassen sich **nicht** in eine
Aufstellung speichern. Jeder Schreibweg läuft durch `validateLegacyLineupContext`
(`lib/lineups/legacy-lineup-validator.ts:22-28`), und die Liste, gegen die dort geprüft wird,
enthält die verletzten Spieler sehr wohl: `rosterPlayerRefs`
(`lib/lineups/legacy-lineup-local-service.ts:516`) wird aus dem **ungefilterten** `activePlayers`
gebaut, nicht aus dem gefilterten `selectableActivePlayers` (Zeile 449). Das war der naheliegende
Verdacht, und er trifft nicht zu.

Geprüft wurden alle Wege: menschliches Speichern, KI-Stapelspeichern, KI-Auswahl (dort werden
Verletzte gar nicht erst angeboten), Formkarten-Zuweisung, Auto-Prep. Alle sperren korrekt.

**Was tatsächlich kaputt war — und es erklärt das Gefühl gut.**

1. `formatLegacyLineupDragBlockReason` (`lib/lineups/legacy-lineup-drag-drop.ts:71`) gab für die
   Verletzung den **rohen Code-String** zurück. Jeder andere Sperrgrund daneben hatte deutschen
   Text. Der Spieler las wörtlich `player_injured_unavailable` — als Hinweis an der Kandidatenliste
   und als Meldung nach einem verhinderten Zug. Wer das sieht, hält es zu Recht für kaputt.
2. In der Auswahlliste (`LegacyLineupLabClient.tsx:3495`) stand für **jeden** Sperrgrund dasselbe
   Wort „blockiert". Warum ein Spieler nicht ging, sah man erst im Hovertext — eine Verletzung war
   vor dem Setzen also nicht erkennbar. Das ist die zweite Meldung, wörtlich.

**Gebaut.** Beide Punkte behoben. Sechs Zusicherungen, darunter eine, die **jeden** Sperrgrund
gegen rohe Bezeichner prüft — damit fällt der nächste vergessene Fall auf, nicht nur dieser eine.
Ohne den Fix sind zwei davon rot.

**Was dagegen spricht.** Der Quelltext-Test zur Auswahlliste belegt nicht das Bild im Browser, nur
dass die Unterscheidung existiert. Und zwei Punkte bleiben offen (siehe unten) — einer davon ist
eine Entscheidung, die mir nicht zusteht.

**Offen 1 — Sperrdauer, Entscheidung für Chris.** `INJURY_UNAVAILABLE_MATCHDAYS = 1` und
`INJURY_RECOVERING_MATCHDAYS = 1` (`lib/fatigue/fatigue-injury-service.ts:107-108`). Ein Spieler ist
also **genau einen** Spieltag gesperrt; am übernächsten steht er auf `recovering`, ist einsetzbar
und wird **ohne Abzug** gewertet. Das ist so getestet und damit gewollt — sieht aber von außen aus
wie „verletzter Spieler spielt". Wenn eine Verletzung länger wehtun soll, ist das eine
Balancing-Entscheidung, kein Fehler.

**Offen 2 — zweite Absicherung beim Auswerten.**
`legacy-matchday-result-apply-service.ts:474-488` bildet `canApply` allein aus `preview.status`;
`readinessByTeamId` wird berechnet, aber nicht einbezogen, und `preview.status`
(`legacy-matchday-resolve-engine.ts:183-196`) prüft keine Verfügbarkeit. Der Speicher-Riegel ist
damit die **einzige** Schranke. Heute ist kein Weg bekannt, wie ein gültig gespeicherter Entwurf
später ungültig wird — deshalb kein akuter Fehler, aber eine fehlende zweite Linie.

**Aufwand.** Gebaut: klein · Offen 2: klein · Offen 1: Entscheidung

**Sicherheit.** hoch für das Gebaute (beide Stellen nachgeprüft, Test ohne Fix rot). Mittel dafür,
dass Punkt „Offen 1" das ist, was Chris tatsächlich gesehen hat.
