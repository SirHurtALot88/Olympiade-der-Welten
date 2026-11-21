# Navigation, Weiter-Flow und Saison-Info (21.11.)

Drei Aufträge von Chris. Code: `lib/foundation/history-unterzustand.ts`, `lib/foundation/takt-auswahl.ts`,
`lib/foundation/takt-klick-store.ts`, `app/foundation/shell/FoundationTaktgeber.tsx`,
`app/foundation/season-briefing/SaisonInfoModern.tsx`. Tests: `tests/navigation-flow-21-11.test.ts`.
Messung: `scripts/screenshot-navigation-flow.ts`.

## 1. Maus Zurück/Vor

Maustasten 4/5 lösen Browser-Back/Forward aus. Die Foundation pusht Ansichtswechsel (`setFoundationView`),
Spielerprofil und Teamprofil schon in die History. Es fehlten die Zustände INNERHALB einer Seite, die nur als
React-State lebten:

| Zustand | vorher | jetzt |
|---|---|---|
| Spielerprofil-Blatt im Draft (`profilId`) | Zurück sprang aus der ganzen Seite | eigener Eintrag (`olySub:draftProfil`), Zurück schließt das Blatt, Vor öffnet es wieder |
| Reiter der Draft-Seite (Live, Pick-Tafel, Liga, Ergebnis) | kein Eintrag | jeder Wechsel ein Eintrag (`olySub:draftReiter`) |
| Draft-Seite offen/verlassen (Office-Knopf, Weiter) | Zurück aus dem Office landete nicht im Draft | der Eintrag, auf dem der Draft offen war, trägt eine Marke (`olySub:draftOffen`); Zurück dorthin öffnet ihn, Vor ins Office schließt ihn |

Regeln: gleicher Stand = kein neuer Eintrag (Re-Render, Popstate); belegt nach leer = ein Schritt zurück statt
zusätzlichem Eintrag; `writeFoundationUrlState(..., "replace")` rettet die Unterzustände des Eintrags; nach Reload
werden Reste getilgt. Die Taste `BrowserBack` ruft `preventDefault`, sonst ging der Browser zusätzlich selbst zurück.
Ungespeicherte Eingaben: die Unterzustände enthalten keine; Dialoge mit Eingaben (Skip, Abbruch) sind nicht in der History.

## 2. Weiter-Knopf und Leertaste

Ursachen:

1. **Leertaste war nicht der Knopf.** Der Scope-Hook rief immer `triggerGlobalNext()`, der Knopf je nach Ansicht die
   Aktion des Drafts, der Einsatzliste oder des globalen Flows. Im Draft sprang die Leertaste deshalb in den globalen Flow.
   Jetzt registriert der sichtbare Taktgeber seine Aktion (`takt-klick-store.ts`), die Leertaste ruft genau sie.
2. **„Aktion läuft · Liga wird erstellt“ trotz Draft.** Mit Draft-Zustand der Saison bleibt `leagueSetupStatus`
   `in_progress`, solange der Mensch noch wählt/pickt. Die Aktivität zeigte dann „läuft“ und sperrte die Anzeige.
   `ligaAufbauAktivitaetStatus` lässt die Aktivität bei Draft-Zustand weg (der Draft trägt den Aufbau selbst).
3. **Jede laufende Hintergrund-Aktivität (Live-Sync, KI-Vorschau …) schaltete den Knopf auf „Aktion läuft“.** „Läuft“
   gilt jetzt nur bei echter Sperre (`gesperrt` = `globalNextDisabled`: Schritt wird angewendet, Cockpit beschäftigt,
   Saisonwechsel).
4. **Draft wartet im Office (Startwahl, „Draft wartet“-Hinweis).** Der Knopf zeigte den globalen Schritt. Jetzt: „Zum Draft“.
5. **Knopf tut nichts sichtbar.** Im Zustand „zu“ ohne kritische Punkte (z. B. „Spieler wählen“) und beim globalen Flow, wenn
   nach 600 ms Adresse und Ansicht gleich sind, öffnet der Taktgeber den Ablauf und erklärt, was hier noch fehlt.

Tabelle: welche Quelle gilt (`waehleTaktQuelle`, Vorrang von oben):

| Zustand | Quelle | Knopf | Leertaste |
|---|---|---|---|
| Draft-Seite offen, Startwahl offen | draft | „Wahl treffen“ (zu) | erklärt per Ablauf |
| Draft: ich bin dran, Spieler gewählt | draft | „<Name> picken“ | pickt |
| Draft: ich bin dran, nichts gewählt | draft | „Spieler wählen“ (zu) | erklärt per Ablauf |
| Draft: KI am Zug | draft | „Vor zu meinem Pick“ | startet KI-Vorlauf |
| Draft: Nachzug | draft | „Draft abschließen“ / „Noch n Pflichtplätze“ | Dialog / erklärt |
| Draft: fertig | draft | „Weiter“ | schließt Draft, lädt Spielstand |
| Draft wartet, Draft-Seite verlassen (Office) | draft-hinweis | „Zum Draft“ | öffnet den Draft |
| Einsatzliste mit Abgabe | einsatzliste | „Einsatzliste abgeben“ | Einsatzliste hat eigene Leertaste („nächste Aufgabe“) |
| Saisonstart (Season-Info, Team, Roster, Sponsor, Transfers, Training, Kapitän) | global | nächster Schritt aus `game-flow-controller` (`season_intro`, `team_confirm`, `roster_review`, `choose_sponsor`, `first_transfers`/`fill_roster`, `training_facilities`, `appoint_captain`) | wie Knopf |
| Transfermarkt | global | `buy_players` / `sell_players` / `finalize_transfers` | wie Knopf |
| Training | global | `check_training` / `set_training` | wie Knopf |
| Einsatzliste fehlt, Arena | global | `set_lineup` → `confirm_lineup` → `open_arena` → `run_reveal` | Arena behält Pause |
| Spieltagswertung | global | `review_matchday_results` → `open_season_standings` (quittierbar) → `matchday_facilities` (optional) → `advance_to_next_matchday` | wie Knopf |
| Saisonende | global | `review_previous_season`, `apply_rewards`, `player_development`, `prepare_season`, `start_matchday_1` | wie Knopf |
| Kritischer Punkt (Rot) | global | Zustand „zu“ | erst Ablauf, zweiter Druck springt zum ersten roten Punkt |
| Echte Sperre (`globalNextDisabled`) | global | „Aktion läuft“ | ignoriert |
| Textfeld / Dialog offen | egal | — | ignoriert |

Offen: die Phasen im globalen Flow sind nur über die bestehende Schrittliste und `resolveGameFlowActionStep`
abgesichert (eigene Tests dort); eine Simulation aller Phasen am echten Spielstand steht aus. Ein hängender
`cockpitBusyKey` (Schreibfehler ohne Aufräumen) würde weiterhin „läuft“ zeigen; es gibt dafür keinen Wachhund.

## 3. Saison-Info (Season-Einstieg)

`SaisonInfoModern` ersetzt den alten Modal-Inhalt in `FoundationShellRouterBody.tsx`. Inhalte gleich: Salary Factor,
Spieltage, POW/SPE/MEN/SOC, Cash, Spieltags-Reihenfolge, große Diszis, Farb-Dopplungen, künftige Faktoren, Knöpfe
Später / Diszis ansehen / Erledigt (Testids `season-briefing-*` bleiben). Neu: Broadcast-Tokens, Barlow-Zahlen,
Disziplin-Icons aus `public/discipline-icons`, Spielplan-Reihenfolge als Karten mit großer Spieltagsnummer,
Viererdisziplinen (Mini DM, Battlefield, Takeshi, Staffel) mit Marke „4er“. Bilder:
`saisoninfo-vorher-*.png`, `saisoninfo-nachher-*.png`.
