# Saisonpause nach Spieltag 10 (21.11., Welle 4)

Auftrag: „Pause nach 10 Spieltagen: ein Spieltag Fatigue-Regeneration für alle, sichtbar kommuniziert.“

## 0. Vorgefundener Stand

Die **Wirkung** gab es auf `main` schon: Pause nach Spieltag 10 ist Teil der Belastungsregel v2
(PR #1671, `docs/design/belastung-resistenz-bau-21-11/README.md`). Gebucht in
`applyFatigueAndInjuryAfterMatchday` -> `bucheBelastungsPause` (Erholung eines spielfreien Spieltags:
`calculatePlayerRecovery`, 28 + Reha-Zentrum, x Trainingsmodus; Verletzte `injuryRecovery`), Stempel
`seasonState.belastungsPause = { seasonId, nachMatchdayId, eintraege }`, Rücknahme bei Replay
(`undoBelastungsPause`), Test in `tests/belastung-resistenz.test.ts` (genau einmal, idempotent, Verletzte,
Alt-Regel ohne Pause). Kein Training, keine Finanzbuchung, keine Moral-/Formänderung, keine Wertung, Spielplan
unverändert. Die Einsatzliste trug ein Pause-Band (Ankündigung bis Spieltag 10, Rückblick danach).

Nicht übernommen, bewusst:

- **Neuer Stempel `pausenRegeneration`**: überflüssig, `belastungsPause` ist derselbe Stempel (und trägt die
  Einzelwerte, aus denen der Bericht gerechnet wird).
- **Pause schon in der laufenden Saison eines bestehenden Spielstands**: bleibt bei Chris' Entscheidung vom
  21.11. (Belastungsregel v2 inklusive Pause und aktiver Erholung 4,0 gilt ab der FOLGENDEN Saison; die
  laufende rechnet bit-identisch alt). Die Pause allein vorzuziehen hieße, die laufende Saison ohne den
  Ausgleich der aktiven Erholung (4,5 -> 4,0) und ohne neue Lastformel zu fahren. Wer es doch will, braucht
  eine ausdrückliche Freigabe von Chris.
- **Verletzungen laufen in der Pause einen Spieltag ab**: bewusst nicht gebaut. Jede Verletzung dauert in
  dieser Engine genau einen Spieltag (`unavailableUntil` = nächster Spieltag). Ein Ablauf in der Pause würde
  daher jede Verletzung von Spieltag 10 aufheben, bevor sie je einen Spieltag gekostet hat (Test
  „verletzt an Spieltag 10 fehlt an Spieltag 11“ hält das fest). Verletzte erholen sich in der Pause aber
  (Erschöpfung sinkt, im Bericht ausgewiesen).

## 1. Neu in diesem Zweig

| Was | Wo |
|---|---|
| Schalter `OLY_SAISONPAUSE=0` (oder `aus`): keine Pause, keine Marken, Regel v2 sonst unverändert | `istSaisonpauseAbgeschaltet`, `lib/fatigue/fatigue-injury-service.ts` |
| Bericht im Postfach „Saisonpause: alle Spieler erholen sich“, je sichtbarem Team (Mensch und KI gleich), aus den gebuchten Werten | `lib/fatigue/saisonpause-bericht.ts`, `buildNews` in `lib/foundation/game-inbox-service.ts` (Quelle `saisonpause`, Kategorie `news` = Chronik, Info, hält keinen Spieltag auf) |
| Marke „Pause · Regeneration“ im Saisonstand, Reiter Spieltage, zwischen Spieltag 10 und 11, hervorgehoben an Spieltag 10/11; Dachzeile „nach Spieltag 10 von 20 · Pause · Regeneration“ | `SeasonStandingsModern.tsx`, `saisonstand-modern.css`, Bündel `pause` aus `use-foundation-shell-router-body-scope.tsx` |
| Ankündigung ab Spieltag 9 in der Einsatzliste: „Pause nach Spieltag 10 — nach dem nächsten Spieltag“ / „gleich nach diesem Spieltag“ (gelb) | `EinsatzlisteModern.tsx`, `einsatzliste-modern.css` |
| Messung mit/ohne Pause: `scripts/messe-saisonpause.ts` (`runKorridorSeason` liefert dafür `avgFatigueByMatchday`, `anteilRotByMatchday`) | |

Der Postfach-Eintrag läuft über den gemeinsamen Dienst `buildGameInboxItems`; die neue Postfach-Fassung
(PR #1673, `claude/sammel-21-11-c`) liest dieselbe Liste und zeigt ihn als Chronik-Eintrag. Mehrspieler:
Sichtbarkeit über `getVisibleTeamIds` wie jede andere Meldung, kein hart verdrahteter Besitzer.

## 2. Messung

`npx tsx scripts/messe-saisonpause.ts --saaten=6`: 32 Teams, v2-Stempel, 20 Spieltage, echte Buchung, Einsatz
„Normal“, Rotation „niedrigste Erschöpfung zuerst“ (derselbe Basisfall wie `messe-belastung-resistenz.ts`).
Mit/ohne = `OLY_SAISONPAUSE` unset/`0`; sechs Saaten.

| | ohne Pause | mit Pause |
|---|---:|---:|
| Ø Erschöpfung nach Spieltag 10 (Beginn Spieltag 11) | 33,6 | 11,8 |
| Anteil >= 65 nach Spieltag 10 | 10,3 % | 0,4 % |
| Ø Erschöpfung nach Spieltag 11 | 35,4 | 17,3 |
| Anteil >= 65 nach Spieltag 11 | 12,8 % | 2,1 % |
| Ø Erschöpfung nach Spieltag 15 | 43,4 | 32,0 |
| Verletzungen Spieltag 11-15 | 99,8 | 40,8 |
| Verletzungen Spieltag 1-10 | 45,3 | 45,3 |
| Verletzungen je Saison | 266,8 | 163,8 |

Die Pause nimmt den Druck der zweiten Saisonhälfte (Spieltage 11-15 minus 59 %); die erste Hälfte ist
bit-gleich (45,3 = 45,3). Mit Pause liegt die Saison im Korridor 150-200, ohne Pause (aktive Erholung 4,0) darüber —
deshalb ist die Pause Teil der Regel v2 und nicht einzeln abschaltbar gedacht (Notbremse).

Messung auf dem live-save-Abbild: die laufenden Saisons der Server-Saves tragen keinen v2-Stempel, die Pause
würde dort in dieser Saison nicht greifen; deshalb ist der Korridor-Aufbau mit Stempel die aussagekräftige Messung.

## 3. Prüfung

- `tests/saisonpause.test.ts` (neu, 5 Tests): Bericht je Team (Mensch/KI, `hostMode` und eigenes Team), Zahlen =
  gebuchter Eintrag, vor Spieltag 10 kein Bericht, Marken-Referenz, Schalter aus (keine Pause, Konto = Vor-Pausen-Stand,
  Verletzungen unverändert), genau einmal.
- Gebuchte Pause je Saison genau einmal, idempotent bei Replay, Verletzte, Alt-Regel ohne Pause: weiter
  `tests/belastung-resistenz.test.ts`.
- Fingerabdruck `node scripts/pruefe-wertung-fingerabdruck.mjs --node`: **GESAMT eaafed96150e** unverändert.

## 4. Abgleich Bilder

Aufnahmen aus der echten App (Dev-Server mit `OLY_AUTO_EXPORT_SAVES=0`, Wegwerf-Save nach Spieltag 10) unter
`docs/design/saisonpause-21-11/`: `app-spielplan-pause-*.png`, `app-postfach-pause-*.png`, `app-einsatzliste-pause-*.png`
(`scripts/screenshot-saisonpause.ts`).
