# Arena-Screens gebaut (18.11.) — Stand, Ursache des D2-Fehlers, offene Punkte

Grundlage: Mockup `public/mockups/arena-spieltag-modern-18-11.html` und `docs/design/arena-spieltag-modern-18-11.md`
(Abschnitte 1, 2, 4). Nicht Teil dieses Baus: Screen 5 (Spieltagswertung, `DisciplineStageMatchdayPanel.tsx`).
Abhängigkeit: baut auf PR #1617 (Start/Ende/Figuren) auf, solange der nicht in `main` ist.

## Ursache des Fehlers beim Wechsel D1 → D2 („obwohl ich N-N steuere, geht er auf ein anderes Spiel")

Nachgemessen am Code, nicht am Save (Plattenplatz in der Umgebung reichte nicht für Save-Abbild und Build):

1. `bestimmeArenaSpieltagAnsicht` setzte für eine **Vierergruppe** `gastTeamId` auf den **Fixture-Gegner aus
   Disziplin 1**. Eine Vierergruppe ist aber eine eigene, zur Fixture-Paarung parallele Gruppierung
   (`mini-dm-pod-schedule.ts`): der D1-Gegner sitzt dort nicht zwingend mit dem eigenen Team. Der Host nannte
   deshalb im Kopf „N-N gegen <D1-Gegner>", während die Vorstellung des Motors die Gruppe in ihrer Buchungs-
   Reihenfolge zeigte (Team 0 gegen Team 1) — zwei Bauteile, zwei Paarungen, keine davon die eigene Gruppe.
2. Der Host suchte die Gruppe ein zweites Mal selbst (`findeArenaPodMitVorschau`) statt die gebuchte Gruppe aus der
   Wertungszeile zu lesen. Zwei unabhängige Ableitungen können auseinanderlaufen.

Behebung: `ArenaSpieltagAnsicht.podTeamIds` trägt die **gebuchte** Gruppe aus der Wertungszeile des eigenen Teams;
der Gast ist immer ein Mitglied dieser Gruppe (der D1-Gegner nur, wenn er dort sitzt); eine Gruppe ohne das
eigene Team wird nie gezeigt (`null`). Der Host nimmt Kopf, Vorstellung und Ladebild aus `podTeamIds`. Test:
`tests/arena-spieltag-ansicht.test.ts`, Block „Wechsel Disziplin 1 → Disziplin 2 landet auf dem eigenen Spiel".
Der Wechsel-Screen öffnet über `baueWechselSpielliste`/`waehleWechselStandard` immer das eigene Spiel.

## Was gebaut ist

| Screen | Baustein | Stand |
|---|---|---|
| Regieleiste (alle) | `ArenaRegieleiste.tsx`, `lib/.../arena-regie.ts` (`baueRegieSchritte`: gebucht, nicht „Arena lief"), CSS `.oly-regie*` in `battle-mode.css` | gebaut, ersetzt Titel/Paarung der 40-px-Leiste (jetzt 56 px) |
| 1 Laden | `ArenaLadebild` in `ArenaVorraum.tsx`, vier echte Ladeschritte (`baueLadeSchritte`), drei Fakten statt Fließtext, Ausblick auf D2 | gebaut |
| 2a/2b Vorstellung | `ArenaVorstellung`: zwei bzw. vier Teamkarten, eigenes Team orange + „Dein Team", Punkteschema, Kader (beste 6) gerundet + grobe Marken, Formkarte des Gegners verdeckt | gebaut, ohne Eignung je Einsatzplatz und ohne eigene Aufstellung/Formkarte (offen) |
| 3a/3b Live | Tafel vor dem Anpfiff „–" (`kampfStandText` im Motor, nur Anzeige-Text); Regieleiste | teilweise: Vierer-Tafel/Turm/Kontrollpunkte im Mockup-Look und Spielerleisten „–" offen |
| 4a Ergebnis Duell | unverändert (Motor-Endstand) | offen |
| 4b Ergebnis Vierergruppe | `renderEndstandPod` im Motor: Banner „Platz N von 4", Rangfolge 1–4 mit Kontrollpunkten und Liga-Punkten, EINE Tabelle mit Reitern (Alle nach Impact / je Team); `endstandZeile` herausgelöst | gebaut (Battlefield); Bahn-Pods (Staffel/Takeshi) offen |
| 6 Wechsel D1→D2 | `ArenaWechsel.tsx`: D1 gebucht, „gleiches Team, neues Spiel", eigenes Spiel in D2, übrige Spiele nur zur Orientierung | gebaut; „nur ansehen" für fremde Spiele offen |

Teamfarben: eigenes Team immer `#F2A03D`, die anderen Türkis/Violett/Rosa (`teamfarbeInGruppe`).

## Wertung

Alle Motor-Änderungen sind Anzeige (Endstand-DOM, Text der Tafel vor dem Anpfiff). Fingerabdruck `node scripts/pruefe-wertung-fingerabdruck.mjs`: GESAMT d3a39030a3ef (75 Eintraege), identisch zum Stand von #1617.

## Offene Punkte

- Screenshots und Mockup-Vergleich fehlen: beim Start der Arbeit waren auf `/` nur 1,5 GB frei (Vorgabe: unter 2,5 GB
  nicht bauen). Reihenfolge zum Nachholen: Build außerhalb des Locks, unter `flock /tmp/oly-aufnahme.lock` Server +
  Aufnahme (1920×1080 und 2560×1440), Bilder nach `docs/design/arena-screens-bau-18-11/`.
- Live-Vierer-HUD (Tafel mit vier gleichwertigen Feldern, Turm „Rangfolge live", Spielerleisten „–") ist HUD-Baukasten-
  Arbeit (Stufe 6 des Mockup-Plans) und nicht Teil dieses Baus.
- Vorstellung: eigene Aufstellung mit Eignung, Formkarte und Captain aus `arena-aufstellung-adapter.ts`.
- Ergebnis Duell (4a) im neuen Stil; Bahn-Pods (Staffel/Takeshi) im Endstand der Vierergruppe.
- „Nur ansehen" fremder Spiele (Mockup `?fremd=1`) — braucht einen eigenen Zustand im Host, der nie bucht.
- Die Leiste zeigt „Büro" als bestehenden Knopf „⤓ Seite"; ein eigener Link ins Büro braucht die Routenwahl der App.
