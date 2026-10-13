# Übergabe: Kampagnen und Szenarien (Moosgrab) und Kartenschmiede

Für den Agenten, der künftig Kampagnen, Szenarien, Karten und Audio-Cues für Chris' Tabletop-Runden baut.
Stand 13.10.2026. Sprache mit Chris: Deutsch.

## Worum es geht

Chris spielt mit Freunden (Franky, Ramona) OPR Age of Fantasy Quest mit selbst bemalten Minis. Dazu gibt es:

- **Kartenschmiede**: ein Kartenbauer auf der Olympiade-Seite (`/kartenschmiede`, läuft auf dem Hetzner-Server).
  Code in `apps/kartenschmiede/` und `lib/kartenschmiede/`, Tests in `tests/kartenschmiede.test.ts`.
- **Moosgrab**: die erste Kampagne. Ein Dorf am alten Wald, Menschen werden zu Pilzzombies. Die Geschichte wird
  Schritt für Schritt aufgedeckt und mischt Rollenspiel und Kampf. Ab Map 4 kippt sie ins Sci-Fi.
- **Kampagnenbibel**: Chris' Claude-Docs-Dokument mit allem zu Moosgrab, privat auf claude.ai:
  https://claude.ai/code/artifact/47fabd6b-4f74-42cd-8173-7f737e4fa04d
  - Reiter Kampagnenbibel: Überblick, Wahrheit hinter Moosgrab, Kampagnenbogen, Regeln, Figuren, Gelände, Audio-Konzept.
  - Reiter Map 1, Map 2: Spielleiter-Blätter.
  - Reiter Suno-Cues: alle Texte.

  Kommst du nicht an das Dokument, bitte Chris um Zugriff. Dieses Dokument hier fasst das Nötigste zusammen.

## Feste Entscheidungen (nicht neu verhandeln)

- **Keine feste Heldengruppe.** Gruppen sind frei, Gegner können später als Gefährten rekrutiert werden.
  Story und Cues funktionieren mit jeder Gruppe: Das Audio spricht „ihr“ an, nie einzelne Helden.
  Persönliche Haken kommen über Fundstücke, Ereignisse und Entscheidungen, nicht über Figuren-Hintergründe.
- **Gleiche Regeln für alle Spieler.** Keine Einsteiger- oder Profi-Varianten.
- **Rollen in der Kartenschmiede:** nur Held und Gegner. Gefährten sind Gegnerkarten, die der Spielleiter freischaltet.
- **Rahmen und Stufe hängen fest an den Punkten.** Formate: Gegner als Postkarte quer 15 × 10 cm,
  Helden als Heldenbogen A4.
- **Keine Spoiler.** Weder in Cues noch in sichtbaren Eigenschaften von Figuren noch in Track-Titeln.
  Was die Spieler finden sollen, wird erst nach der Entdeckung genannt, vorher nur ein Hinweis.
  Beispiel: In der Kapelle wird die Falltür erst genannt, wenn jemand den Altar untersucht.

## Regelwerk am Tisch (Stand: gemergt in PR #1152)

Basis ist OPR Age of Fantasy: Qualität, Verteidigung, Zäh und Waffenzeilen. Dazu kommen:

- **4 Aktionswürfel pro Zug** (nach Warhammer Quest: Blackstone Fortress), für Helden und Gegner gleich.
  - Bewegen 6" (höchstens 2×), Angreifen und Helfen gehen mit jedem Würfel.
  - Ein zweiter Angriff braucht 5+.
  - Fähigkeiten haben eine Stufe 0–3 (Feld `energie`, Symbol `{Pn}`): 0 = passiv oder Auslöser, 1 = 3+, 2 = 5+, 3 = eine 6.
  - Ob ein Angriff trifft, wird danach normal gewürfelt.
- **Schicksalswürfel:** Zu Rundenbeginn 5 W6, die einzigartigen Zahlen kommen in einen Gruppenpool.
- **Initiative abwechselnd wie OPR:** ein Held, dann eine Gegnergruppe.
- **Gegner-Verhaltenswürfel:** Ein W6 entscheidet, was Gegner mit ihren Würfeln tun. Es gibt eine ruhige und eine
  wütende Tabelle, umgeschaltet ab Runde 4 oder nach Alarm. Gegner verschwenden keine Aktion.
- **Kampagnenregeln:**
  - Atemzug-Leiste: Trödeln stärkt den Wald, über die ganze Kampagne.
  - Sporenuhr: Map 1.
  - Sporennebel: verseuchte Zonen, Qualitätstest oder −1 auf Treffen.
  - Lärm-Leiste: Map 2, 0–6.
  - Namensregel mit Sporenpunkten.
  - Suchmarker.
- **Befallene Helden** würfeln 3 statt 4 Aktionswürfel, schwer befallene 2. Diese Zahlen habe ich umgerechnet,
  Chris hat sie noch nicht bestätigt.

## Moosgrab: Stand

| Map | Ort | Stand |
|---|---|---|
| 1 | Der kranke Waldrand (K1S1) | Fertig. Rettung der Tochter, die trotzdem zur „Erblühten“ wird. Bossfight, danach Cue 01B-5 mit dem Kupferanhänger. |
| 2 | Die Kapelle ohne Priester (vor dem Dorf) | Spielleiter-Blatt fertig. Stille und Lärm-Leiste, Kampf nur bei Lärm oder Glocke, Mutter Hedda in der Krypta. |
| 3 | Das Dorf bei Nacht | Nur grob: Häuser durchsuchen, Überlebende, Folgen aus Map 2 (Glocke, Wahrheit an Hedda). |
| 4 | Unter dem Brunnen, Labor | Grob: Wurzelgänge werden zu Metallwänden. Aussichtsloser Kampf gegen Myzel-Soldaten, 4 Runden durchhalten. |
| 5 | Das Herz von Moosgrab | Grob: Chaos-Finale mit Space Marines als Verbündeten. Ziel ist das Herz, nicht alle Gegner. Am Ende die Probe-Entscheidung. |

**Wahrheit hinter Moosgrab (nur Spielleiter):** Vor etwa 40 Jahren stürzte eine Forschungsstation „als Stern“ in den Wald.
Sie züchtete ein Pilzgeflecht als lebende Waffe. Das Dorf baute den Brunnen auf das zugeschüttete Loch. Das Geflecht
lernt erst Tiere, dann Menschen, dann Namen. Ein Space-Marine-Bergungstrupp will eine Probe sichern.

**Szenario-Format, das Chris mag** (wie seine K1S1-Karte):
- Hauptziel, Nebenziel, Spezialregel, Belohnung, Konsequenzen für spätere Missionen, Spielleiter-Hinweis.
- Grobe Skizze mit Gelände nach OPR (Deckung, schwierig, gefährlich, unpassierbar), Suchmarkern, Feindzonen, Heldenstart.
- Dazu ein Spielleiter-Blatt pro Teil:
  - Auslöser
  - Was die Spieler sehen
  - Tabelle der möglichen Aktionen mit Ergebnis
  - Weiter, wenn …
- Live gespielte Figuren bekommen Kernaussagen, die immer kommen, plus Zusätze je nach Verhalten der Helden,
  plus „was sie nicht weiß“.

## Audio-Cues (Suno)

- Pro Map kurze Tracks. Jeder Track endet mit einem hörbaren Signal: `[Church Bell Toll]`, dann sagt der Erzähler
  die Anweisung und wörtlich „Ihr seid am Zug.“, dann `[End]`. Stille allein ist kein Signal.
  Ein langer Cue geht auch, dann mit `[Silence]` nach dem Signal.
- **Nach jedem `[Pause]` und jedem Geräusch-Tag den Sprecher-Tag neu setzen**, sonst fällt Suno auf den Erzähler zurück.
- Style-Vorlage von Chris: „German dark fantasy spoken-word narration, cinematic ambient background, no singing,
  deep calm male narrator, audiobook trailer style …“ (vollständig in der Kampagnenbibel).
- Checkliste vor jedem Cue: Signal, Sprecher-Tags, keine Spoiler, keine Spielleiter-Geheimnisse, einmal laut lesen.
- Offen:
  - Extra-Cues 02-X1 (Lärm 3), 02-X2 (Lärm 6), 02-X3 (Glocke).
  - Battle Cue 2 (Orgel und Chor).
  - Text von 01B-4A „Die Frau aus den Wurzeln“: von Chris holen, er liegt nur in Suno.

## Kartenschmiede: Was du wissen musst

- Regeln, Punkte und Simulator stehen in `apps/kartenschmiede/regeln.js`:
  - `punkte`, `energieVon`, `preisVon`, `simuliere`, `faehigkeitsCheck`, `balanceTest`.
  - Fähigkeiten werden nach Mindestwurf billiger: ×1 / 0,95 / 0,55 / 0,35.
- Katalog in `katalog.js` (`GRUNDBESTAND`, Fraktionen, Tags, Elemente-Prägung, `welleWuerfeln`, `skaliere`).
  Generator in `generator.js`.
- Regeltexte nutzen Symbol-Kürzel in geschweiften Klammern: `{A2}` Treffer, `{DS1}`, `{V+1}`, `{H2}`, `{R12}`, `{F3}`,
  `{X}`, `{S}`, `{RU}`, `{Z4}`, `{D4}`, `{P1}` (= Würfelstufe 1). Neue Texte nur mit bekannten Kürzeln, ein Test prüft das.
- Neue Gegner für Moosgrab als Fraktion „Urwild“ mit Gift-Prägung. Bosse der Stufe 6 ab 225 Punkten.
  Chris' Helden zusammen etwa 345 Punkte.
- Prüfen: `npx vitest run tests/kartenschmiede.test.ts` und ESLint auf `apps/kartenschmiede`.
  Die eigenständige Seite für Browser-Tests baut `npx tsx scripts/kartenschmiede-eigenstaendig.ts <out.html>`.
- **Chris' Freigabe: Kartenschmiede-PRs mergen, sobald CI grün ist.**

## Arbeitsweise: von der bemalten Mini zur fertigen Karte

Chris' Vorgabe vom 13.10.: **Keine Karten auf Verdacht bauen.** Jede Karte entsteht aus einer Mini, die Chris
selbst bemalt hat und zeigt. Ablauf, immer in einem Rutsch:

1. Chris schickt Fotos einer fertig bemalten Mini.
2. Du liest daraus Größe (Infanterie, groß, Monster), Ausrüstung, Pose und Farben, und baust eine Karte ins
   bestehende Konzept: Fraktion, Prägung, Werte nach der Punkte-Formel, Waffen und Fähigkeiten.
3. **Fehlt eine passende Fähigkeit, legst du eine neue an.** Sie kommt in `katalog.js` (`GRUNDBESTAND`), mit
   Symbol-Kürzeln, Würfelstufe und Preis, der Preis geprüft mit dem Preis-Check.
4. Du schreibst den Bild-Prompt im Stil der Kartenschmiede (Funktion `prompt()` in `app.js`), mit dem Hinweis auf das
   Mini-Foto als Vorlage. Chris gibt ihn zusammen mit dem Foto in ChatGPT.
5. Karte und Prompt landen in der **Werkbank** (`apps/kartenschmiede/werkbank/<name>.json`), Status
   „wartet auf Bild“. So geht nichts verloren, auch wenn das Bild erst Tage später kommt.
6. Schreibt Chris „das ist das Bild von XY“, setzt du es ein:
   - Bild nach `apps/kartenschmiede/assets/`, Eintrag in `BILDER` in `lib/kartenschmiede/seite.ts`.
   - Karte als Vorlage in `VORLAGEN` in `app.js`, mit Ausschnitt und Zoom.
   - Druckfertige Karte als JPG an Chris schicken, Status in der Werkbank auf „fertig“.
   - PR, mergen bei grünem CI.

## Offene Entscheidungen für Chris

1. **Boss-Modus:** Bosse nach jedem zweiten Helden aktivieren, mit Simulator-Modus „Boss gegen Gruppe“.
2. **Zauber:** Der Aktionswürfel soll zugleich der Zauberwurf sein. Heute würfelt man doppelt, auf der Karte stehen dann zwei „5+“.
3. **Befallen:** 3 und 2 Würfel bestätigen.
4. **Mutter Hedda:** Ist sie die Dorfälteste und heißt sie so? Annahme, Kommentar dazu im Dokument.
5. **Preise einiger Fähigkeiten:** Der Preis-Check meldet sie als zu billig, Chris entscheidet:
   - Wunden heilen
   - Lebensentzug
   - Nanoregeneration
   - Heilendes Licht
   - Psi-Blitz
   - Rudeljäger

## Sonstiges zu Chris

- Befehle für ihn immer ohne `#`-Kommentare am Zeilenende (zsh).
- Gelände-Budget eher klein. Empfohlen: Battle Systems Village Ruins (etwa 25 € bei Fantasywelt), Filz als Boden, Pilze später.
- Er hat einen Black-Grail-Trupp (Trench Crusade). Die Figuren passen als Befallene.
- Interesse an Slaanesh (Hedonites-Spearhead), The Old World (neue Tomb-Kings-Skelette) und später an einem 3D-Drucker mit OPR-Patreon.
- Warhammer Quest Dunkelwasser hat Ideen geliefert: Verhaltenswürfel und „befallen statt tot“. Das Regelwerk selbst wurde nicht übernommen.
