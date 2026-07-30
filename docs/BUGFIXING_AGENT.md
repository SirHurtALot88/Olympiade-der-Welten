# Bugfixing-Agent — wer sich um gemeldete Fehler kümmert

## Die kurze Antwort auf „wer kümmert sich drum?"

**Bis jetzt: niemand.** Die rote Flagge schrieb eine JSON-Datei nach `data/bug-reports/` — und dort
blieb sie liegen. Es gab keinen Vorgang, der sie aufgreift, und in einem Fall verschwand sie sogar
wieder (siehe „Das Leck" weiter unten). Eine Meldung abzuschicken fühlte sich wie ein Vorgang an, war
aber keiner.

**Ab jetzt: ein Agent.** Er sieht regelmäßig nach, ob neue Meldungen da sind, stellt jede nach,
schreibt Befund und Lösungsvorschlag daneben — und legt sie **dir** zur Entscheidung vor. Gebaut wird
erst nach deiner Freigabe.

Die Arbeitsteilung in einem Satz: **der Agent prüft und schlägt vor, du entscheidest, der Agent
baut.**

---

## Der Weg einer Meldung

```
   Klick auf die Flagge
            │
            ▼
   data/bug-reports/bug-<Zeitstempel>-<zufall>.json      ← Rohmeldung, wird NIE wieder angefasst
            │
            ├── lokal gespielt  →  committen und pushen
            └── Live-Server     →  Cron pusht auf Branch "bug-reports"  (alle 15 Min)
            │
            ▼
   Der Agent liest sie, stellt sie nach, schreibt
   data/bug-reports/triage/<reportId>.md                 ← Befund + Lösungsvorschlag
            │
            ▼
   npm run bugs:review    →    deine Entscheidungsvorlage
            │
            ├── „angenommen"  →  der Agent baut den Fix, PR, merge  →  status: erledigt
            └── „abgelehnt"   →  bleibt dokumentiert liegen
```

### Das Leck, das dabei aufgefallen ist

Auf dem Hetzner-Server war `data/bug-reports/` **kein Volume**. Die Flagge schrieb nach
`/app/data/bug-reports` *innerhalb des Containers*, und der Auto-Deploy baut bei jedem Push auf `main`
einen neuen Container. **Jede auf dem Live-Server gemeldete Sache war beim nächsten Deploy gelöscht** —
ohne Spur, ohne Fehlermeldung. Behoben mit dem eigenen Volume `oly-bug-reports`
(`deploy/hetzner/docker-compose.yml`).

Damit die Meldungen den Server auch verlassen, gibt es `deploy/hetzner/push-bug-reports.sh` — dieselbe
Mechanik wie `push-live-save.sh`: eigener Branch, `main` bleibt unberührt, kein Neu-Deploy. Der
Cron-Installer richtet beides zusammen ein:

```bash
bash deploy/hetzner/install-live-save-cron.sh    # einmalig auf dem Server
```

> **Wichtig für lokal gespielte Runden:** Meldungen, die auf deinem Rechner entstehen, liegen in
> deinem lokalen `data/bug-reports/`. Der Agent läuft in einer frischen Umgebung und sieht **nur, was
> im Repo liegt**. Also: `git add data/bug-reports && git commit && git push`. Sonst kennt der Agent
> die Meldung nicht — sie ist nicht verloren, aber unsichtbar.

---

## Was in einer Meldung steht

Der Wert steckt nicht im Freitext, sondern im **Zustand**. Ohne ihn ist „das hier ist kaputt" nicht
nachstellbar — daran sind in diesem Projekt schon mehrere Diagnosen gescheitert.

| Feld | Inhalt |
|---|---|
| `note` | Freitext des Melders — optional |
| `reporter` | **wer gemeldet hat**: `displayName`, `username`, `ownerId` |
| `reporter.source` | `session` \| `auth_disabled` \| `not_logged_in` |
| `page` | **die Seite**: `path`, `view`, `tab` und `label` („Spieltag · Arena") |
| `url`, `viewport`, `clientTime`, `userAgent` | Browser-Kontext |
| `game.saveId`, `game.saveName` | aktiver Spielstand |
| `game.seasonId`, `game.seasonYear`, `game.currentMatchday` | Saison und Spieltag |
| `game.matchdayId`, `game.matchdayStatus` | Zustand des Spieltags |
| `game.activeTeamIds` | die vom Menschen geführten Teams |

Zwei Details, die leicht übersehen werden:

- **`reporter` setzt der Server** aus dem signierten Session-Cookie, nie der Browser. Ein
  mitgeschickter Name wäre frei behauptbar und damit als Zuordnung wertlos.
- **`reporter.source` trägt die Bedeutung, nicht der leere Name.** „Login ist aus" (Solo am eigenen
  Rechner — es *gibt* keinen Benutzer) und „niemand angemeldet" sehen im Feld `username` identisch
  aus, verlangen beim Nachstellen aber Verschiedenes.
- **`page.label` kommt aus der Navigations-Konfiguration**, nicht aus einer zweiten Liste. Sonst
  driftet die Beschriftung in der Meldung von der im Spiel weg, und die Meldung zeigt auf eine
  Ansicht, die so gar nicht mehr heißt.

`game` ist `null`, wenn beim Melden kein Spielstand aktiv war. Eine Meldung ohne Spielkontext ist
weniger wert, aber besser als keine — sie wird trotzdem geschrieben.

---

## Die Vorprüfung

Für jede Meldung legt der Agent `data/bug-reports/triage/<reportId>.md` an. **Die Rohmeldung wird
dabei nie verändert** — sie ist ein Protokoll: was der Melder gesehen hat, ist nachträglich nicht mehr
feststellbar. Stünde die Bewertung in derselben Datei, wäre das Protokoll beim ersten Schreibfehler
mit weg.

Format — Kopf maschinenlesbar, Rest für dich:

```markdown
status: vorgeprueft
titel: Arena zählt die Punkte der zweiten Disziplin doppelt
schwere: hoch
ergebnis: <ab `gebaut`/`abgelehnt` Pflicht — ein Satz, was dabei herauskam>
pr: <ab `gebaut` Pflicht>
commit: <Merge-Commit auf main>
gemergt: <Datum>
bestaetigt: <ab `erledigt` PFLICHT — WIE die Wirkung belegt wurde>

**Befund.** Nachgestellt im gemeldeten Save (Saison 1, Spieltag 1): nach dem Wechsel auf
Disziplin 2 steht die Gesamtwertung 214 statt 107. Reproduzierbar in 3 von 3 Versuchen.

**Ursache.** `lib/scoring/matchday-points.ts:88` addiert das Disziplin-Ergebnis erneut auf
die schon gebuchte Summe, statt sie zu ersetzen. Eingeführt in #228.

**Lösungsvorschlag.** Die Buchung auf „ersetzen" umstellen (eine Zeile) und einen Test
ergänzen, der zwei Disziplinen nacheinander wertet.

**Was dagegen spricht.** Bestehende Spielstände tragen die falsche Summe bereits — sie
werden durch den Fix nicht rückwirkend korrigiert.

**Aufwand.** klein
```

Der Abschnitt **„Was dagegen spricht"** ist Pflicht, auch wenn nichts dagegen spricht (dann: „nichts").
Ein Vorschlag ohne Kehrseite ist meistens einer, bei dem nicht weit genug geschaut wurde.

Findet der Agent den Fehler **nicht**, steht das genauso da — mit dem, was er versucht hat, und was er
von dir bräuchte (Screenshot, Spielstand, genauer Klickweg). Ein ehrliches „nicht reproduzierbar" ist
brauchbar; ein erratener Befund ist es nicht.

---

## Vorlegen und entscheiden

**Die Übersicht: [`data/bug-reports/TICKETS.md`](../data/bug-reports/TICKETS.md)** — alle Meldungen
mit Nummer, Melder, Seite, Stand und Ergebnis auf einer Seite.

```bash
npm run bugs:tabelle             # TICKETS.md neu erzeugen, fehlende Nummern vergeben
npm run bugs:tabelle -- --check  # schreibt nichts, Exit 1 bei Abweichung
npm run bugs:review              # Volltext: was offen ist — der Normalfall
npm run bugs:review -- --nr 3    # ein einzelnes Ticket
npm run bugs:review -- --alle    # auch Abgelehntes und Erledigtes
npm run bugs:review -- --json    # maschinenlesbar
```

### Warum die Tabelle erzeugt und nicht gepflegt wird

Die beiden Fehlerarten sind nicht gleich schlimm. Einer **erzeugten** Tabelle, deren Quelle jemand
nicht nachgezogen hat, sieht man die Lücke an — sie schreibt „Wirkung nicht bestätigt" in die Zelle
und mahnt sie beim Erzeugen an. Eine **gepflegte** Tabelle, die ein Lauf vergisst, behauptet
stattdessen etwas Plausibles und Falsches.

Das ist keine Theorie. Nach einem einzigen Tag Betrieb lagen für die Sponsoren-Meldung bereits **zwei
unabhängige Fixes** im Repo (#268 aus einer anderen Sitzung und einer aus dieser), weil niemand sehen
konnte, dass die Sache schon bearbeitet wurde. Genau diese Doppelarbeit soll die Tabelle verhindern —
und das kann sie nur, wenn man ihr trauen kann.

Deshalb: **`TICKETS.md` wird nie von Hand editiert.** Der Stand einer Meldung wird in ihrer
Triage-Notiz gepflegt, die Tabelle liest ihn dort ab. Zwei gleichzeitige Läufe fassen so verschiedene
Dateien an und können sich nicht gegenseitig überschreiben.

**Ticket-Nummern** stehen in `data/bug-reports/tickets.json` und werden nur **angehängt**, nie
geändert. Ein Nachzügler bekommt die nächste freie Nummer, auch wenn das die Chronologie bricht —
„Nr. 3" muss nächste Woche noch dieselbe Meldung sein. Nach Datum durchzunummerieren würde bei jedem
Nachzügler alle späteren Nummern verschieben.

Die Ausgabe ist eine **Entscheidungsvorlage**: pro Meldung stehen Zustand, Seite, Melder, Befund und
Vorschlag beieinander, sodass genau eine Frage beantwortbar ist — *soll das gefixt werden?*

Der Weg einer Meldung, bewusst kurz gehalten (jeder zusätzliche Status ist einer, bei dem unklar wird,
wer am Zug ist):

| Status | Bedeutung | Am Zug |
|---|---|---|
| `offen` | noch nicht angesehen | Agent |
| `vorgeprueft` | Befund und Vorschlag liegen vor | **du** |
| `angenommen` | freigegeben, Fix ist zu bauen | Agent |
| `gebaut` | Fix gemergt, **Wirkung noch nicht belegt** | wer bestätigt |
| `abgelehnt` | soll nicht gefixt werden | — |
| `erledigt` | Fix gemergt **und** Wirkung belegt | — |

`gebaut` gibt es, weil die Unterscheidung schon einmal Schaden angerichtet hat: Die Cash-Meldung galt
nach einem Merge als behoben — der Fix stieß einen Reload an, der zwei Zeilen weiter von einem
Zwischenspeicher verschluckt wurde. Ein „erledigt", während der Fehler weiterläuft, nimmt die Meldung
aus dem Blick. **`erledigt` gibt es deshalb nur mit gefülltem `bestaetigt:`** — sonst stuft der Parser
selbsttätig auf `gebaut` zurück.

Entscheiden kannst du auf zwei Wegen: im Beileger den Status ändern — oder es dem Agenten einfach
sagen („die Arena-Sache ja, den Rest nein").

---

## Arbeitsweise: wer welche Arbeit macht

Die Untersuchung einer einzelnen Meldung ist mechanisch — Code durchsuchen, Commits prüfen, Tests
laufen lassen, Belege sammeln. Das läuft **je Meldung als eigener Sonnet-Agent, alle parallel**.
Drei Meldungen dauern damit so lange wie eine, und keine Untersuchung färbt auf die andere ab.

**Opus** (oder Fable) macht nur das, was Urteil verlangt: die Befunde gegenlesen, Widersprüche und
zu forsche Schlüsse aussortieren, gewichten, und die Entscheidungsvorlage schreiben. Ein Agent, der
seine eigene Untersuchung bewertet, findet selten etwas daran auszusetzen — deshalb sind Untersuchen
und Bewerten getrennt.

Jeder Untersuchungs-Agent liefert dasselbe Raster zurück, damit die Befunde vergleichbar sind:

```
SCHON ERLEDIGT: ja/nein/teilweise + Belege (Commit-Hashes)
BEFUND:         was tatsächlich passiert
URSACHE:        Datei:Zeile + Erklärung
LÖSUNGSVORSCHLAG
WAS DAGEGEN SPRICHT   ← Pflichtfeld, notfalls "nichts"
AUFWAND:        klein/mittel/groß
SICHERHEIT:     hoch/mittel/niedrig
```

`SICHERHEIT` trägt mehr, als es aussieht: Ein Befund mit „niedrig" darf nicht wie ein gesicherter
aussehen, wenn er Ihnen vorgelegt wird. Und **„schon erledigt?" wird zuerst geprüft** — es wäre die
teuerste Art, Zeit zu verbrennen, einen Fehler zu untersuchen, den ein Commit von gestern längst
behoben hat.

Die Untersuchungs-Agenten **ändern keinen Code**. Sie lesen, belegen, berichten. Gebaut wird erst
nach Ihrer Freigabe, und dann gezielt.

---

## Was der Agent nicht tut

- **Nicht ungefragt bauen.** Zwischen Befund und Fix steht immer deine Freigabe. Einzige Ausnahme, und
  auch nur wenn du sie vorher erteilst: offensichtliche Ein-Zeilen-Fixes.
- **Nichts erfinden.** Kein Fehler wird nachgestellt „vermutlich so" — entweder nachgestellt oder als
  nicht nachstellbar gemeldet.
- **Keine Rohmeldung anfassen.** `data/bug-reports/*.json` ist unveränderlich.
- **Nicht nach `main` pushen.** Fixes laufen über einen Branch und einen PR.
- **Nicht stumm bleiben.** Auch „keine neuen Meldungen" ist ein Ergebnis — dann meldet er sich
  allerdings gar nicht, statt dich mit Leermeldungen zuzuschütten.

---

## Der Auftrag (zum Kopieren)

Das ist der Text, mit dem der Agent läuft — als geplante Routine oder von Hand in einer neuen Sitzung:

```text
Du bist der Bugfixing-Agent für „Olympiade der Welten". Arbeite nach docs/BUGFIXING_AGENT.md.

1. Neue Meldungen holen:
   - git fetch origin bug-reports und den Branch-Inhalt nach data/bug-reports/ übernehmen
     (der Branch ist ein Spiegel des Live-Servers, ein einzelner elternloser Commit)
   - dazu die Meldungen, die schon auf main liegen
2. npm run bugs:review -- --json  →  alles mit status "offen" ist zu prüfen.
3. Gibt es nichts Offenes: keine Meldung an den Nutzer, Sitzung beenden.
4. Für jede offene Meldung:
   - Den Zustand aus der Meldung nachstellen (Save, Saison, Spieltag, Seite, geführtes Team).
     Der passende Spielstand liegt auf Branch "live-save".
   - Ursache im Code belegen, mit Datei:Zeile. Keine Vermutungen als Befund ausgeben.
   - data/bug-reports/triage/<reportId>.md schreiben, Format siehe docs/BUGFIXING_AGENT.md,
     status: vorgeprueft. Abschnitt "Was dagegen spricht" ist Pflicht.
   - Nicht nachstellbar? Genauso dokumentieren, mit dem, was du versucht hast und was fehlt.
5. Triage-Notizen committen, auf den Arbeitsbranch pushen, Draft-PR öffnen.
6. Chris die Vorlage geben: pro Meldung ein Absatz — was ist kaputt, woran liegt es,
   was schlägst du vor, was kostet es. Danach auf seine Freigabe warten.
7. Erst nach Freigabe bauen: Fix, Test der den Fehler festhält, PR. Danach status: erledigt.

Nie nach main pushen. Rohmeldungen nie verändern.
```

---

## Die beteiligten Stellen

| Was | Wo |
|---|---|
| Die Flagge in der Oberfläche | `components/feedback/BugReportFlag.tsx` |
| Ablage und Anreicherung | `lib/bug-report/bug-report-service.ts` |
| Vorprüfung und Status | `lib/bug-report/bug-report-triage.ts` |
| API (`POST`/`GET /api/bug-report`) | `app/api/bug-report/route.ts` |
| Entscheidungsvorlage | `scripts/bug-reports-review.ts` → `npm run bugs:review` |
| Meldungen vom Live-Server holen | `deploy/hetzner/push-bug-reports.sh` |
| Volume gegen Datenverlust | `deploy/hetzner/docker-compose.yml` |
| Tests | `tests/bug-report-service.test.ts`, `tests/bug-report-triage.test.ts` |
