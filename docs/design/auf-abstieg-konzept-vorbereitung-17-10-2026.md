# Auf-/Abstieg: Vorlage für Chris' Finanzentscheidung (Vorbereitung, nicht Umsetzung)

Stand: 2026-10-17. Dies ist **keine Bau-Entscheidung und keine Empfehlung**, welche Antwort
richtig ist — nur eine Vorlage, damit Task #161 (Finanzfragen klären) schnell entschieden werden
kann, sobald Chris Zeit hat. Task #158 (`league_movement` bauen) bleibt blockiert, bis das hier
beantwortet ist. Es wurde in dieser Runde **kein Code geändert** außer diesem Dokument.

Grundlage: `docs/design/liga-split-plan.md` Abschnitt 10, Fragen 3–6 (Finanzfragen Auf-/Abstieg),
abgeglichen mit dem aktuellen Codestand (17.10.) und mit
`docs/design/battle-mode-20-spieltage-liga-mechanik-16-10.md`, der dieselben Fragen am 16.10.
noch einmal bestätigt, aber nicht neu gestellt hat (dort Abschnitt 7, Frage 9: „Sponsor-/
Finanz-Fragen aus liga-split-plan.md 10.3–10.4 … sind weiterhin offen und werden mit Auf-/Abstieg
akut"). Von den vier Fragen in 10.3–10.6 ist eine inzwischen erledigt (10.5, siehe Abschnitt 2)
— es bleiben **drei** echte Entscheidungen für Chris.

---

## 1. Mechanischer Rahmen, der heute schon feststeht

Das hier ist **nicht** Teil der offenen Fragen — es ist bereits entschieden/gebaut und bildet den
Rahmen, in dem die Finanzfragen unten überhaupt Sinn ergeben:

- **Zwei Ligen à 16 Teams** (`LEAGUE_SIZE = 16`, `lib/season/league-split.ts`), Liga-Zugehörigkeit
  lebt am `SeasonState` (`leagueByTeamId`), nicht am Team — ändert sich pro Saison.
- **3 Auf-/Absteiger pro Saisonübergang** (`RELEGATION_COUNT = 3`, in `league-split.ts` bereits
  definiert, aber von **keinem** Produktionscode gelesen — bestätigt per Grep am 17.10. und per
  Kommentar in `preseason-workflow-service.ts:607-609`).
- **Zeitpunkt**: am Saisonende, zwischen Snapshot und Transition — neuer Schritt `league_movement`
  in `runSeasonCompletion()` (`lib/season/season-completion-service.ts`), danach in
  `buildNextSeasonGameState()`/`preseason-workflow-service.ts` die neue `leagueByTeamId`-Zuordnung
  an den Fixture-Generator reichen (Codekommentar dort sagt bereits, dass genau dieser Block
  umgestellt werden muss, sobald eine Auf-/Abstiegs-PR kommt).
- **Kriterium für den Endrang**: Punkte, dann **Punkteverhältnis** als erster Tiebreaker. Das ist
  seit dem 16.10. tatsächlich gebaut und nicht mehr nur Plan: `lib/standings/
  saisonstand-punkte-nachbuchung.ts` und `lib/standings/standings-verhaeltnis.ts` liefern das
  Verhältnis bereits als Spalte (`StandingRecord.verhaeltnis`), `resolveProjectedRankWithTiePolicy`
  sortiert `points → verhaeltnis → totalScore`. Für den Abstieg heißt das: der Endrang, auf dem
  `league_movement` aufsetzt, ist schon heute dieselbe, bereits korrigierte Tabelle, nicht nur ein
  rohes Punktefeld.
- **Wer steigt auf/ab**: Liga-2-Rang 1–3 steigt auf, Liga-1-Rang 14–16 steigt ab (16 Teams,
  3 Plätze) — das ist die naheliegende Lesart von `RELEGATION_COUNT = 3`, aber **nicht
  ausdrücklich noch einmal von Chris bestätigt** als "genau diese drei Plätze, keine Relegation/
  Playoff-Variante". Das gehört nicht zu den drei Finanzfragen, ist aber eine Annahme, die beim
  Bauen von Task #158 mit auffällt und die hier schon mal benannt wird, falls Chris dazu auch kurz
  etwas sagen will.

**Was die Punkte+Verhältnis-Tabellen heute schon liefern, und was noch fehlt, bevor `league_movement`
überhaupt etwas zu lesen hat:**

- Die Tabelle selbst (Punkte, Rang, jetzt auch Verhältnis als Tiebreaker) existiert und wird
  korrekt geführt — **aber nur als EINE Tabelle**. `app/foundation/season-v2/
  SeasonStandingsNewLook.tsx` rendert heute ein einziges `nl-standings-board` über alle Teams,
  keine Liga-1-/Liga-2-Trennung in der Anzeige (Kopfkommentar der Datei: „keine
  Auf-/Abstiegszonen (kein Zonen-Konzept im Datenmodell)" — Stand 17.10. weiterhin so, per Grep
  bestätigt). Das Datenmodell (`leagueByTeamId`) kennt die Trennung, die UI zeigt sie nicht.
- Das Punkteverhältnis ist liga-**übergreifend** dieselbe Spalte/Formel, es gibt keine getrennte
  Normierung je Liga — für Auf-/Abstieg ist das unproblematisch, weil Endrang ohnehin nur
  **innerhalb** der eigenen Liga verglichen wird.
- Die Finanzfragen unten entstehen genau an der Stelle, an der die sportliche Tabelle endet und
  die Geldseite (Sponsor-Leiter, Apron, Verträge) beginnt — das ist nicht bloß UI, sondern
  eigene Rechenlogik.

---

## 2. Offene Finanzfragen aus `liga-split-plan.md` Abschnitt 10, Punkte 3–6

Nummeriert wie im Originaldokument (dort Listenpunkte 3–6 von insgesamt zwölf). Jede ist so
umformuliert, dass eine kurze Antwort reicht. Wo das Plandokument selbst schon einen Vorschlag
macht, steht der als „Vorschlag im Plandokument" dabei — das ist **kein** eigener Ratschlag dieser
Vorbereitung, sondern ein Zitat/Verweis auf das, was Fable am 25.08. schon notiert hat. Die
Entscheidung bleibt bei Chris.

**10.5 ist raus — erledigt, keine Chris-Entscheidung nötig.** Die ursprüngliche Frage („nach
welchem Kriterium werden Bestands-Saves inkl. Live-Save in Liga 1/Liga 2 aufgeteilt?") setzte
voraus, dass es laufende Saves gibt, die aufgeteilt werden müssen. Der Liga-Split gilt aber seit
dem Spielmodus-Plan ausdrücklich nur für **Battle-Saves** — Manager-Saves bekommen nie eine
`leagueByTeamId` (`isLeagueSplitActive()` bleibt für sie `false`). Im aktuellen Live-Save-Abbild
gibt es Stand 17.10. **keinen einzigen Battle-Save** — alle acht Saves sind Manager-Saves. Es
gibt also schlicht keine Bestands-Saves, die in Liga 1/Liga 2 aufgeteilt werden müssten; neue
Battle-Saves bekommen ihre Zuordnung bereits nach Budget-Startrang (`buildInitialLeagueAssignment()`,
entschieden). Bleiben damit **drei** Fragen: Topfgröße, Apron, Mehrjahresverträge.

### 10.3 — Wie groß ist der Sponsor-Topf je Liga?

Heute zahlt `sponsorLigaLeiter()` (`lib/sponsor/sponsor-liga-leiter.ts`) aus einem Topf
(`SPONSOR_WERTUNGSTOPF`), der für **einen** 32er-Rangraum kalibriert ist. Mit zwei 16er-Ligen
muss der Topf aufgeteilt werden, sonst zahlt das Spiel doppelt aus.

**Bitte eine Option wählen:**
- **(a) 50/50** — beide Ligen bekommen exakt die Hälfte des bisherigen Gesamttopfs.
- **(b) Gehaltsproportional** — der Topf wird nach der Summe der Teamgehälter je Liga aufgeteilt
  (Liga 1 hat im Schnitt höhere Gehälter, bekommt also mehr).
- **(c) Bewusst asymmetrisch, z. B. 60/40 Liga 1/Liga 2** — Aufstieg lohnt sich dann finanziell
  stärker, weil der Sprung in den größeren Topf echtes Geld bedeutet.
- **(d) Andere Aufteilung** (bitte Zahl/Verhältnis nennen).

*Kein Vorschlag im Plandokument — die drei Varianten stehen dort gleichrangig als offene Frage.*

### 10.4 — Wird der Apron pro Liga oder weiterhin global gerechnet?

`computeApronLines()` (`lib/season/apron-service.ts`) zieht zwei Gehaltslinien am
**Median-Gehalt der gesamten Liga** (heute: aller 32 Teams). Bei getrennten Ligen mit
unterschiedlichem Gehaltsniveau würde ein globaler Median Liga 1 strukturell bestrafen (ihr
Median liegt über dem Gesamt-Median) und Liga 2 subventionieren.

**Bitte bestätigen oder ablehnen:**
- **Ja, Apron künftig pro Liga rechnen** (eigener Median je 16er-Liga).
- **Nein, global über alle 32 Teams belassen** (dann bitte kurz sagen, ob die oben beschriebene
  Verzerrung bewusst in Kauf genommen wird).

*Vorschlag im Plandokument: „pro Liga rechnen" (Abschnitt 3, „noch nicht von Chris bestätigt") —
das ist die Empfehlung aus dem 25.08.-Plan, keine neue von dieser Vorbereitung.*

### 10.6 — Was passiert mit Mehrjahres-Sponsorverträgen, wenn das Team die Liga wechselt?

Ein Team kann einen laufenden, mehrjährigen Sponsorvertrag haben, wenn es auf- oder absteigt. Die
Vertragssumme/-stufe wurde für die alte Liga kalkuliert.

**Bitte eine Option wählen:**
- **(a) Leiter umbauen** — der bestehende Vertrag wird beim nächsten Reroll automatisch auf die
  neue Liga umgerechnet (Vertrag bleibt bestehen, nur die Zahlenbasis wechselt).
- **(b) Ausstiegsklausel** — der Vertrag endet automatisch bei einem Liga-Wechsel (Abstieg
  insbesondere), das Team verhandelt neu.
- **(c) Andere Regel** (bitte kurz beschreiben).

*Vorschlag im Plandokument: „Leiter beim Reroll auf neue Liga umbauen" wird als Vorschlag genannt,
mit „oder Ausstiegsklausel bei Abstieg" als ausdrücklich offene Alternative (Abschnitt 10,
Punkt 6) — beide Optionen stehen im Plandokument selbst, keine davon ist dort schon entschieden.*

### Bonus, optional (keine der drei Pflichtfragen, aber mit Auf-/Abstieg erst sichtbar): 10.8 — Zählt Liga-2-Platz-1 als „Titel"?

Es gibt künftig zwei Liga-Sieger (Liga 1, Liga 2), aber vermutlich nur einen „Gesamt-Meister"
(Liga 1). Offen ist, ob der Liga-2-Erste für Achievements/Historie als eigener Titel zählt.

**Bitte eine Option wählen, falls gewünscht — sonst einfach weglassen:**
- **(a) Ja** — Liga-2-Platz-1 ist ein eigenständiger Titel („Zweitliga-Meister"), getrennt von
  Liga 1 ausgewiesen.
- **(b) Nein** — nur der Liga-1-Erste zählt als Titel/Meister, Liga 2 hat Sieger, aber keinen
  Titel.

*Kein Vorschlag im Plandokument — dort nur als Frage notiert (Abschnitt 10, Punkt 8), keine
Finanzfrage im engeren Sinn, deshalb nicht in der Dreier-Liste oben, aber klein genug, um hier
mitzunehmen.*

---

## 3. Was eine Antwort auf diese drei Fragen NICHT mitentscheidet

Damit die Entscheidungsrunde nicht ausufert: folgende, verwandte Punkte aus `liga-split-plan.md`
Abschnitt 10 sind **nicht** Teil dieser Vorlage (sie sind entweder schon entschieden, oder gehören
nicht zu 10.3–10.6, oder werden erst relevant, wenn der Auf-/Abstieg schon läuft):

- Frage 10.1 (10 vs. 15 Spieltage, verpasste Gegner) und 10.2 (Bedeutung der Paarung) sind durch
  den 16.10.-Beschluss (20 Spieltage, Doppel-Rundenplan) inzwischen überholt/beantwortet.
- Frage 10.7 (Punkte-Inflation vs. historische Vergleichbarkeit) ist eine Liga-Split-Frage, aber
  keine Finanzfrage — nicht Teil von Task #161. Frage 10.8 (Meister-Begriff bei zwei Ligen) ist
  ebenfalls keine Finanzfrage, aber klein genug, um oben als optionale Bonus-Frage mitgenommen zu
  werden (Abschnitt 2, letzter Punkt) — falls Chris sie dort gleich mitbeantworten will.
- Frage 10.11 (ein Mensch mit Teams in beiden Ligen im Auf-/Abstiegsrennen) ist bereits
  entschieden: zulassen, im Season-Review transparent ausweisen (Abschnitt 2.4). **Korrektur
  gegenüber einer früheren Fassung dieser Vorlage:** Liga-2-Teams sind nicht dauerhaft
  menschenfrei — Chris hat bei Task #155 klargestellt, dass Liga-2-Teams **jederzeit** von einem
  Menschen übernommen werden können; gefiltert wird ausschließlich beim **Anlegen eines neuen
  Saves** im Wizard (dort werden nur Liga-1-Teams zur Auswahl angeboten, Liga-2 ist „simuliert" nur
  im Sinn von „niemand hat es beim Start gewählt", nicht im Sinn eines dauerhaften Verbots). Damit
  erledigt sich Frage 10.11 weitgehend von selbst — offen bleibt höchstens, ob eine spätere
  Übernahme eines Liga-2-Teams im Season-Review genauso sichtbar gemacht wird wie ein Start-Pick;
  das ist keine Finanzfrage und keine Frage für jetzt, wird hier nur erwähnt.

---

## 4. Kern-Dateien für die spätere Umsetzung (Task #158, erst nach Klärung von #161)

- `lib/season/league-split.ts` — `RELEGATION_COUNT`, `LeagueTier`, `isLeagueSplitActive`.
- `lib/season/season-completion-service.ts` — Einbauort für den neuen Schritt `league_movement`.
- `lib/season/preseason-workflow-service.ts:607-619` — Stelle, an der die neue `leagueByTeamId`-
  Zuordnung an den Fixture-Generator der Folgesaison übergeben werden muss.
- `lib/sponsor/sponsor-liga-leiter.ts`, `lib/season/apron-service.ts` — hängen an 10.3/10.4.
- `lib/standings/saisonstand-punkte-nachbuchung.ts`, `lib/standings/standings-verhaeltnis.ts` —
  liefern die Endtabelle (Punkte + Verhältnis), auf der `league_movement` aufsetzen soll.
- `app/foundation/season-v2/SeasonStandingsNewLook.tsx` — zeigt heute eine gemeinsame Tabelle,
  bräuchte für eine spätere Auf-/Abstiegs-Anzeige die Liga-1-/Liga-2-Trennung (separate Frage,
  nicht Teil dieser Finanz-Vorlage).

---

**Quellen:** `docs/design/liga-split-plan.md` Abschnitt 10 (Fragen 3–6, davon 10.5 inzwischen
erledigt — siehe Abschnitt 2), Abschnitt 3 (Apron-Empfehlung), Abschnitt 8 (Migrationskriterium,
ursprünglicher Anlass für die jetzt erledigte Frage 10.5); `docs/design/
battle-mode-20-spieltage-liga-mechanik-16-10.md` Abschnitt 7 Punkt 9 (Bestätigung, dass 10.3/10.4
weiterhin offen sind) und Abschnitt 4.3 (Einbauort `league_movement`); Task #155 (Klarstellung zu
Liga-2-Übernahmen, Abschnitt 3).
