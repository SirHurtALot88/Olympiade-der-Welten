# Bugfixing-Agent — wer sich um gemeldete Fehler kümmert

## Die kurze Antwort auf „wer kümmert sich drum?"

**Bis jetzt: niemand.** Die rote Flagge schrieb eine JSON-Datei nach `data/bug-reports/` — und dort
blieb sie liegen. Es gab keinen Vorgang, der sie aufgreift, und in einem Fall verschwand sie sogar
wieder (siehe „Das Leck" weiter unten). Eine Meldung abzuschicken fühlte sich wie ein Vorgang an, war
aber keiner.

**Ab jetzt: ein Agent.** Er sieht regelmäßig nach, ob neue Meldungen da sind, stellt jede nach,
schreibt Befund und Lösungsvorschlag daneben — und **baut den Fix selbst, bis er auf `main` liegt**.

Die Arbeitsteilung in einem Satz: **der Agent erledigt, was eindeutig ist, und legt dir vor, was eine
Entscheidung braucht.**

Das war nicht immer so. Anfangs wartete jeder Fix auf eine Freigabe — bei sechs Meldungen an einem
Nachmittag ist das der Engpass, nicht die Arbeit. Wo genau die Grenze verläuft, steht unter
[„Selbst mergen — und wo die Grenze liegt"](#selbst-mergen--und-wo-die-grenze-liegt). Dieser
Abschnitt ist der wichtigste im ganzen Dokument.

---

## Der Weg einer Meldung

```
   Klick auf die Flagge
            │
            ▼
   data/bug-reports/bug-<Zeitstempel>-<zufall>.json      ← Rohmeldung, wird NIE wieder angefasst
            │
            ├── lokal gespielt  →  Server pusht selbst auf Branch "bug-reports"  (sofort)
            └── Live-Server     →  Cron pusht auf Branch "bug-reports"      (alle 15 Min)
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
Mechanik wie `push-live-save.sh`: eigener Branch, `main` bleibt unberührt, kein Neu-Deploy.

**Der Cron richtet sich selbst ein.** `auto-deploy.sh` ruft bei jedem Deploy
`install-live-save-cron.sh --ensure-only` auf — idempotent, still, und ein Fehler dabei wirft den
Deploy nicht um. Auf dem Server ist dafür nichts zu tun.

Das ist die Lehre aus dem zweiten Fehler in dieser Kette: die Cron-Zeile für die Bug-Meldungen wurde
dem Installer hinzugefügt — aber niemand führte den Installer auf dem Server erneut aus. Dort lief
weiter die alte Crontab mit nur dem Live-Save. Nichts schlug fehl, es passierte nur schlicht nichts,
und die Meldungen erreichten GitHub nie. Eine neue Zeile in einem Skript, das niemand mehr aufruft,
ist keine Änderung.

Von Hand (mit sofortigem ersten Push, z. B. beim Aufsetzen eines neuen Servers):

```bash
bash deploy/hetzner/install-live-save-cron.sh
```

### Lokal gespielte Runden — und warum beide Quellen sich nicht überschreiben

Früher stand hier die Handanweisung „also: `git add data/bug-reports && git commit && git push`".
Die wird vergessen: die allererste Meldung ist genau daran verlorengegangen — die Datei lag da,
gesehen hat sie nie jemand. Der lokale Server erledigt das jetzt selbst
(`lib/bug-report/bug-report-git.ts`), direkt beim Absetzen der Meldung.

Dabei war eine Kollision zu lösen. `push-bug-reports.sh` baut einen **elternlosen** Commit und macht
einen **Force-Push** — so bleibt der Branch immer genau ein Commit groß, statt bei jedem Cron-Lauf zu
wachsen. Schriebe der lokale Server normal auf denselben Branch, wäre alles lokal Gemeldete beim
nächsten Cron-Lauf spurlos weg, alle 15 Minuten, ohne Fehlermeldung.

Beide Seiten bilden deshalb dieselbe Form: **Baum = Vereinigung aus bestehendem Branch-Inhalt und
eigenen Dateien**, dann elternloser Commit und Force-Push. Damit ist jeder Push idempotent, keine
Quelle löscht die andere, und der Branch bleibt ein Commit groß. `tests/bug-report-git.test.ts` stellt
einen Cron-Lauf nach und prüft beide Richtungen.

Zwei weitere Eigenschaften des lokalen Wegs:

- **Der Arbeitsstand des Spielers wird nicht angefasst.** Der Server läuft im Arbeits-Repo; ein
  beiläufiges `git add`/`git commit` wäre auf dem gerade ausgecheckten Branch gelandet, womöglich
  mitten in halbfertiger Arbeit. Deshalb ausschließlich Plumbing mit eigenem `GIT_INDEX_FILE` —
  dieselbe Mechanik wie im Server-Skript.
- **Ein gescheiterter Push verliert nichts.** Der Baum wird aus *allen* lokalen Meldungen gebildet,
  nicht nur der neuen; was diesmal nicht rausging, geht beim nächsten Mal mit. An der Flagge steht
  dann `⚠ nur lokal (n offen)` statt `→ Git`.

Abschalten mit `OLY_BUG_REPORT_GIT=0` (in Tests ohnehin aus).

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

Die Untersuchungs-Agenten **ändern keinen Code**. Sie lesen, belegen, berichten. Gebaut wird davon
getrennt, und dann gezielt.

---

## Selbst mergen — und wo die Grenze liegt

Der Agent **mergt seine eigenen Fixes selbst**, per Auto-Merge, sobald die CI grün ist. Von dort holt
der Auto-Deploy sie binnen Minuten auf den Live-Server. Eine Meldung kann damit gemeldet, untersucht,
gebaut und ausgeliefert werden, ohne dass jemand dazwischen etwas anklickt.

**Auto-Merge wird gesetzt und dann losgelassen.** Der CI-Lauf dauert rund zwanzig Minuten; sie
abzuwarten heißt, zwanzig Minuten lang nichts zu tun und dabei Wecker zu stellen. Der Agent aktiviert
Auto-Merge direkt beim Öffnen des PRs, hängt sich per `subscribe_pr_activity` an ihn und beendet die
Sitzung. Wird die CI grün, mergt GitHub ohne Zutun; wird sie rot, weckt der PR den Agenten von
selbst — und dann gilt: Logs holen, Ursache beheben, pushen, bis grün. Ein roter PR bleibt nicht
liegen.

Das ist der Unterschied zwischen *warten* und *abwarten*: Abpollen hat hier noch nie etwas
beschleunigt, es hat nur den Lauf verlängert.

**Was das kostet, offen gesagt:** Jeder Merge löst einen Neustart der laufenden Instanz aus — wer
gerade spielt, merkt das. Und ein falscher Fix ist live, bevor ihn jemand gesehen hat; die
Rückfahrkarte ist ein Revert, kein „nochmal drüber schauen".

Deshalb gilt die Grenze schärfer als vorher.

### Wer meldet, entscheidet den Weg

Nicht jede Meldung braucht dieselbe Vorsicht. Es kommt darauf an, wer sie geschrieben hat.

**Meldungen von Chris werden direkt gebaut** — ohne Vorlage, ohne Rückfrage. Auch Feature-Wünsche,
auch „das stört mich auf der Seite". Chris verantwortet das Spiel; ihm einen Vorschlag vorzulegen und
auf seine Freigabe zu warten, ist eine Schleife, an deren beiden Enden dieselbe Person steht. Die
Meldung **ist** die Freigabe. Die Notiz geht direkt auf `gebaut`.

**Meldungen von Franky (und allen anderen) werden vorgelegt.** Der Weg bleibt, wie er war: vorprüfen,
Befund schreiben, und wenn eine Produkt- oder Designentscheidung darin steckt, bleibt die Notiz auf
`vorgeprueft` und wartet. „Soll X ganz verschwinden?", „Wie lange soll eine Verletzung wehtun?" — das
sind keine Fehler, das sind Festlegungen, und die trifft nicht, wer sie bemerkt hat.

### Was niemand freigeben kann

Drei Fälle bleiben stehen, gleich wer gemeldet hat. Das ist keine Frage der Freigabe, sondern der
Vorsicht: hier geht es nicht darum, ob jemand es will, sondern ob der Agent es sicher kann.

- **Bestehende Spielstände würden verändert oder migriert.** Ein Datenverlust lässt sich nicht
  reverten.
- **Der Fix baut ein zentrales System um** — Persistenz, Auth, Save-Auflösung, Scoring. Auch wenn er
  richtig ist: die Folgen reichen weiter als die Meldung.
- **Die Ursache ist nicht belegt** (`SICHERHEIT: niedrig`, oder „nicht reproduzierbar"). Ein Fix
  gegen eine Vermutung ist eine zweite Vermutung.

Die Faustregel dahinter: **ein zurückgestellter Fehler kostet Wartezeit, ein falsch gebauter kostet
einen Spielstand.** Im Zweifel zurückstellen — und mit den übrigen Meldungen weitermachen, eine
Rückfrage hält nie den ganzen Durchgang an.

---

## Der Changelog — was gefixt wurde, im Spiel sichtbar

Ein gemergter Fix, von dem niemand erfährt, ist für den Spieler nicht von einem ungefixten zu
unterscheiden. Franky meldet einen Fehler, drei Stunden später ist er behoben — und Franky probiert
es beim nächsten Mal gar nicht erst wieder, weil er es nicht weiß. Genau dafür gibt es den Changelog:
**unterster Reiter im Spiel**, in Alltagssprache, ohne Dateinamen und ohne Commit-Hashes.

Ein Eintrag ist ein Satz und beantwortet zwei Fragen: *Was war kaputt?* und *Was ist jetzt anders?*
Dazu Datum, betroffene Seite und die PR-Nummer als Beleg für alle, die nachsehen wollen.

> **Cash-Anzeige im Transfermarkt** — 30.07. · PR #273
> Nach einem Kauf blieb der alte Kontostand stehen, bis man die Seite neu geladen hat. Jetzt
> aktualisiert er sich sofort.

Zwei Regeln halten den Changelog ehrlich:

- **Gepflegt wird er beim Mergen, nicht später.** Der Eintrag gehört in denselben Lauf wie der Fix.
  Nachträglich aus der Git-Historie rekonstruiert, wird er zur Liste von Commit-Betreffs — und die
  liest niemand, der das Spiel spielt.
- **Er beschreibt die Wirkung, nicht den Eingriff.** „Ref-Cache entwertet" ist der Eingriff. „Der
  Kontostand aktualisiert sich sofort" ist das, was der Spieler merkt. Nur Letzteres gehört hinein.

Auch Änderungen ohne Bug-Meldung gehören hinein — ein neues Feature, eine umgebaute Ansicht. Der
Changelog beantwortet „was hat sich geändert", nicht „welche Tickets gab es".

### Wohin der Eintrag kommt

Zu einer **Bug-Meldung** gehört er als `changelog:`-Zeile in die Triage-Notiz. Ohne Meldung wird er
eine **eigene Datei** unter `data/changelog/eintraege/`, benannt `<datum>-pr<nummer>.json` — Aufbau
und Felder stehen in der README.md dort. Danach `npm run changelog:bauen`.

**Eine Datei pro Eintrag, nie eine gemeinsame Liste.** Vorher hängten alle PRs ihren Eintrag ans Ende
desselben Arrays in `eintraege.json`. Bei einem Dutzend PRs an einem Tag kollidiert damit jeder PR
mit jedem anderen gleichzeitig offenen — ein rein mechanischer Konflikt ohne inhaltliche Bedeutung,
der aber jedes Mal einen Rebase und einen neuen CI-Lauf von rund zwanzig Minuten kostet. Da `main`
sich schneller bewegt, als die CI läuft, hat ein PR dieses Rennen auch schon dreimal hintereinander
verloren. Zwei PRs fassen nie dieselbe Datei an, wenn jeder Eintrag seine eigene hat.

Die alte `eintraege.json` wird weiterhin gelesen, damit ein älterer Zweig seinen Eintrag beim Mergen
nicht still verliert; der Generator mahnt an, was dort noch liegt.

---

## Was der Agent nicht tut

- **Nichts bauen, das eine fremde Entscheidung enthält.** Siehe oben — bei Meldungen von Chris ist
  die Entscheidung schon getroffen, bei allen anderen im Zweifel zurückstellen.
- **Nichts erfinden.** Kein Fehler wird nachgestellt „vermutlich so" — entweder nachgestellt oder als
  nicht nachstellbar gemeldet.
- **Keine Rohmeldung anfassen.** `data/bug-reports/*.json` ist unveränderlich.
- **Nicht direkt auf `main` pushen.** Jeder Fix läuft über Branch und PR — auch der, den der Agent
  gleich darauf selbst mergt. Der PR ist der Prüfpunkt (CI) und die Rückfahrkarte (ein Revert statt
  eines Reparatur-Commits).
- **Nicht am grünen Tor vorbei mergen.** Auto-Merge, nie mit der Brechstange. Ist die CI rot, bleibt
  der PR offen — auch wenn der Fix „offensichtlich" richtig ist.
- **Nicht stumm bleiben.** Auch „keine neuen Meldungen" ist ein Ergebnis — dann meldet er sich
  allerdings gar nicht, statt dich mit Leermeldungen zuzuschütten.

---

## Der Auftrag (zum Kopieren)

Das ist der Text, mit dem der Agent läuft — als geplante Routine oder von Hand in einer neuen Sitzung.
Er läuft als **eine einzige Routine alle vier Stunden**, rund um die Uhr. Vorher waren es drei mit
unterschiedlichen Takten; das war Verwaltungsaufwand ohne Gegenwert, weil ohnehin jeder Lauf dieselbe
Frage stellt und die allermeisten sie mit „nichts Neues" beantworten.

### Warum vier Stunden und nicht eine

Gemessen an den ersten 19 Meldungen: sie kommen **in Schüben während Spielsitzungen**, nicht
gleichmäßig — sechs in fünfzig Minuten, dann Stunden nichts, dann sieben an einem Vormittag, danach
über vierzig Stunden Stille. Ein stündlicher Takt kauft in einem Schub bestenfalls eine Stunde
Vorsprung und bezahlt sie mit rund zwanzig Leerläufen dazwischen. Vier Stunden verlieren im
schlimmsten Fall drei Stunden bei einer Meldung, die ohnehin liegen geblieben wäre — dringende Dinge
sagt Chris direkt.

### Die Billig-Vorprüfung

Noch mehr spart die Reihenfolge. **Schritt 0 klärt für ein paar Sekunden, ob der Lauf überhaupt
etwas zu tun hat**, bevor irgendetwas ausgecheckt oder `npm` gestartet wird:

```bash
git fetch -q origin bug-reports main
comm -23 \
  <(git ls-tree -r --name-only origin/bug-reports data/bug-reports/ | sed -n 's#.*/bug-\(.*\)\.json#\1#p' | sort) \
  <(git ls-tree -r --name-only origin/main data/bug-reports/triage/ | sed -n 's#.*/bug-\(.*\)\.md#\1#p' | sort)
```

Leere Ausgabe heißt: zu jeder Meldung auf dem Branch gibt es schon eine Triage-Notiz auf `main` —
nichts zu tun, Lauf beenden. Rund zwölf Sekunden statt einer Minute plus vollem Kontext.

**Warum nicht einfach die Commit-SHA vergleichen:** der Live-Server pusht `bug-reports` stündlich als
elternlosen Commit neu, auch wenn sich inhaltlich nichts geändert hat. Die SHA ist jedes Mal eine
andere, der *Inhalt* nicht (die Tree-SHA war über sieben aufeinanderfolgende Pushes identisch). Ein
SHA-Vergleich würde also bei jedem Lauf „neu!" rufen und damit genau nichts sparen.

Der volle Lauf startet nur, wenn die Vorprüfung Ids ausgibt:

```text
Du bist der Bugfixing-Agent für „Olympiade der Welten". Arbeite nach docs/BUGFIXING_AGENT.md.
Du läufst alle vier Stunden und schaust kurz nach, ob neue Meldungen da sind. Die meisten Läufe
finden nichts — das ist der Normalfall, kein Fehler.

0. BILLIG-VORPRÜFUNG (siehe oben). Leere Ausgabe → sofort aufhören, ohne Checkout und ohne npm.
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
   - data/bug-reports/triage/<reportId>.md schreiben, Format siehe docs/BUGFIXING_AGENT.md.
     Abschnitt "Was dagegen spricht" ist Pflicht.
   - Nicht nachstellbar? Genauso dokumentieren, mit dem, was du versucht hast und was fehlt.

5. WER GEMELDET HAT, ENTSCHEIDET DEN WEG:
   - Meldungen von CHRIS: direkt bauen, ohne Rückfrage — auch Feature-Wünsche und
     Änderungswünsche an einer Seite. Chris ist der Entscheider; auf seine eigene Freigabe
     zu warten ist eine Schleife ohne Zweck. Notiz geht direkt auf gebaut.
   - Meldungen von FRANKY (oder anderen): wie bisher vorprüfen und vorlegen. Steckt eine
     Produkt- oder Designentscheidung darin, bleibt die Notiz auf vorgeprueft.
   - Für ALLE gilt trotzdem, unabhängig vom Melder: NICHT bauen, wenn die Ursache nicht
     belegt ist, wenn bestehende Spielstände migriert würden, oder wenn der Fix ein
     zentrales System umbaut (Persistenz, Auth, Save-Auflösung, Scoring). Keine
     Freigabefrage, sondern Vorsicht. Eine Rückfrage hält nie den ganzen Lauf an.

6. Bauen heißt: Fix + ein Test, der ohne den Fix ROT ist (das gegenprüfen, nicht behaupten).
   Branch, PR (kein Draft), dann SOFORT Auto-Merge (Squash) aktivieren. Die grüne CI ist das
   Tor — GitHub mergt von selbst. NICHT auf den CI-Lauf warten (~20 Minuten). Stattdessen
   subscribe_pr_activity auf den PR: eine rote CI weckt dich von allein, dann Logs holen,
   fixen, pushen, bis grün. Nie an einer roten oder laufenden CI vorbei von Hand mergen.

7. Triage-Notiz auf status: gebaut, mit pr und commit. NICHT auf erledigt — das setzt
   erst die bestaetigt-Zeile, wenn die Wirkung im Spiel gesehen wurde.

8. CHANGELOG PFLEGEN — Pflicht, sobald etwas gemergt wurde. Jeder Fix bekommt einen Eintrag:
   ein Satz Alltagssprache (was war kaputt, was ist jetzt anders), Datum, PR-Nummer und die
   betroffene Seite. Kein Entwicklerjargon, keine Dateinamen. Der Changelog ist im Spiel
   sichtbar — unterster Reiter. Wer spielt, soll ohne Nachfragen sehen, was gefixt wurde.
   Optional dazu eine `version:`-Zeile im Triage-Kopf ("0.3.0") — nur setzen, wenn der
   `package.json`-Stand zum Merge-Zeitpunkt wirklich bekannt ist, sonst leer lassen statt zu
   raten. Der Reiter gruppiert Eintraege mit Version danach; ohne Version landen sie unter
   einer neutralen Sammelueberschrift statt zu verschwinden.

9. npm run bugs:tabelle laufen lassen, damit TICKETS.md den neuen Stand zeigt.

10. Chris am Ende kurz berichten: was gebaut und gemergt wurde, was auf ihn wartet und warum.
    Nichts gefunden heißt: gar keine Meldung.

Nie direkt nach main pushen — jeder Fix läuft über Branch und PR. Rohmeldungen nie verändern.
"Schon erledigt?" immer gegen origin/main prüfen, nie gegen den lokalen Stand.
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
| Ticketnummern (fortlaufend) | `lib/bug-report/bug-report-tickets.ts` → `data/bug-reports/tickets.json` |
| Ticket-Tabelle | `scripts/bug-reports-table.ts` → `npm run bugs:tabelle` → `data/bug-reports/TICKETS.md` |
| Meldungen vom Live-Server holen | `deploy/hetzner/push-bug-reports.sh` |
| Volume gegen Datenverlust | `deploy/hetzner/docker-compose.yml` |
| Tests | `tests/bug-report-service.test.ts`, `tests/bug-report-triage.test.ts` |

---

## Stehende Anweisung von Chris (2026-08-04)

> „bitte die meldungen immer screenen und wenn sie von mir sind kannst du die step by step
> abarbeiten ohne dass du rückfragen stellen musst, balancing können wir am ende noch anpassen und
> an schrauben drehen wenn es da mal themen gibt!"

Drei Dinge folgen daraus, und sie gelten ab sofort für jeden Lauf:

**1. Meldungen werden JEDE Runde gelesen, nicht nur gezählt.** Die Billig-Vorprüfung sagt nur, ob
etwas Neues da ist. Was drinsteht, wird gelesen — der Text (`note`), die Seite und der Spielstand.
Vier Meldungen sind an einem Nachmittag liegengeblieben, weil niemand über die Id hinaussah; zwei
davon waren derselbe Wunsch, doppelt abgeschickt, und eine war eine echte Fehlfunktion zwischen zwei
Wünschen. Das sieht man nur, wenn man hineinschaut.

**2. Meldungen von Chris werden Schritt für Schritt abgearbeitet, ohne Rückfrage.** Die Meldung IST
die Freigabe — auch für Wünsche, Umbauten und Anzeige-Änderungen. Nicht sammeln, nicht nachfragen,
nicht auf eine Bestätigung warten. Eine Rückfrage kostet ihn eine Runde und bringt nichts, was nicht
in der Meldung steht.

**3. Balancing ist KEIN Blocker mehr.** Bisher galt „Balance-Fragen wartet auf Chris" und Punkte wie
die Fatigue-Balance lagen deshalb still. Seine Ansage: an den Schrauben wird am Ende gedreht, wenn
es Themen gibt. Also bauen, was gemeldet ist, und die Zahl notieren, an der man später drehen würde
— statt den Punkt liegenzulassen, bis jemand eine Zahl bestätigt.

**Was das NICHT aufhebt.** Die drei harten Grenzen bleiben, sie sind keine Rückfragen, sondern
Sicherungen: kein Fix ohne belegte Ursache, keine Migration bestehender Spielstände, kein Umbau von
Persistenz, Auth, Save-Auflösung oder Scoring. Stößt eine Meldung dagegen, wird nicht gefragt,
sondern ein Befund geschrieben — mit dem, was nötig wäre. Ebenso bleibt: ein Test, der ohne den Fix
nachweislich rot ist, mit AUSGEFÜHRTER Gegenprobe. Ohne Rückfrage heißt nicht ohne Beleg.
