# Bug-Meldungen: von der Flagge zur Entscheidung

Grundlage für einen Bugfixing-Agenten. Beschreibt, was es heute gibt, wo es hakt, und wie der
Weg von der Meldung bis zu deiner Entscheidung aussehen sollte.

---

## 1. Was heute passiert — und wer sich kümmert

**Niemand.** Das ist keine Untertreibung, sondern der Stand:

1. Du klickst die Flagge. `POST /api/bug-report` schreibt eine JSON-Datei nach
   `data/bug-reports/bug-<ISO>-<random>.json`.
2. Ende.

Es gibt keine Benachrichtigung, keine Weiterleitung, keine Liste, die jemand ansieht. Die Datei
liegt auf **dem Rechner, auf dem der Server läuft** — bei dir lokal.

Das ist der eigentliche Bruch: dein Rechner und meine Arbeitsumgebung sind **getrennte Klone**
desselben Repos. Ich sehe deine Meldung erst, wenn die Datei committet und gepusht wird. Deine
Meldung von heute 14:00:46 ist hier nicht angekommen — `data/bug-reports/` enthält im Repo bis
jetzt ausschließlich die `README.md`.

Der Ordner ist zwar bewusst nicht in `.gitignore` ("wird ins Repo committet"), aber committen tut
ihn niemand. Es fehlt der Schritt dazwischen.

## 2. Was in einer Meldung steht (nach dieser Änderung)

| Feld | Herkunft | Anmerkung |
|---|---|---|
| `note` | Freitext | optional |
| `view` | `?view=` | präzise, aber nur in der Foundation-Shell vorhanden |
| `path`, `pageTitle` | Browser | **neu** — benennen die Seite auch dort, wo `view` fehlt |
| `url`, `viewport`, `clientTime` | Browser | |
| `userAgent` | Request-Header | |
| `reporter.ownerId/label/fromSession` | Session | **neu** — siehe unten |
| `game.saveId/saveName` | aktiver Spielstand | |
| `game.seasonId/seasonYear/currentMatchday` | Saison | |
| `game.matchdayId/matchdayStatus` | Spieltag | |
| `game.activeTeamIds` | `teamControlSettings` | die vom Menschen geführten Teams |

Zwei Dinge, die man beim Lesen wissen muss:

- **`reporter.fromSession`** unterscheidet belegt von erschlossen. Ist der Login aus, gibt es keine
  Session — es sitzt aber trotzdem einer an der Tastatur, und den benennt der Fallback als den
  lokalen Benutzer (`Chris`). Bei zwei Spielern auf einer gemeinsamen Instanz wäre diese Annahme
  still falsch, deshalb steht sie als Annahme im Datensatz und nicht als Feststellung.
- Die Identität kommt **nur aus der Session**, nie aus dem Request-Body. Sonst könnte eine Meldung
  im Namen eines anderen abgesetzt werden.

## 3. Was fehlt

### 3a. Der Transportweg (blockiert alles andere)

Solange die Datei auf deiner Platte liegt, kann kein Agent sie sehen. Drei Wege, in aufsteigender
Verlässlichkeit:

| Weg | Aufwand | Haken |
|---|---|---|
| **A. Du committest den Ordner** | keiner | manuell, wird vergessen — genau das ist heute passiert |
| **B. Server committet+pusht selbst** | klein | braucht Schreibrechte aufs Repo; Push kann fehlschlagen und muss dann nachlaufen |
| **C. GitHub Issue je Meldung** | mittel | braucht ein Token in der lokalen Umgebung; dafür sofort sichtbar, kommentierbar, mit Zustandsmodell (open/closed), das nicht selbst gebaut werden muss |

**Empfehlung: C.** Der Grund ist nicht der Transport, sondern das, was danach kommt. Deine Anforderung
"gesammelt und mir vorgelegt, damit ich entscheide" ist ein Zustandsmodell — offen, geprüft,
akzeptiert, abgelehnt, erledigt. Das gibt es bei GitHub fertig, inklusive Historie und
Benachrichtigung, und jeder Agent kann es über die vorhandenen GitHub-Werkzeuge lesen und schreiben.
Baut man es über JSON-Dateien nach, ist es ein zweites, schlechteres Issue-System.

Fällt C wegen des Tokens aus, ist B der Rückfall: nach dem Schreiben der Datei ein Commit auf einen
eigenen Branch `bug-reports` und ein Push. Der Branch bleibt getrennt von der Entwicklung, damit
Meldungen keine PRs anfassen.

### 3b. Die Vorprüfung

Was ein Agent je Meldung leisten kann, bevor du sie ansiehst:

1. **Reproduzieren.** Das ist der Punkt, an dem der mitgeschickte Zustand sich auszahlt: `saveId`,
   Saison, Spieltag und geführtes Team sagen genau, welcher Stand geladen und wohin navigiert werden
   muss. Braucht den Spielstand — siehe die offene Frage unten.
2. **Einordnen.** Fehlfunktion, Anzeigefehler, Balancing oder Wunsch? Die vier führen zu völlig
   verschiedenen Antworten, und die Einordnung ist oft schon die halbe Entscheidung.
3. **Duplikate erkennen.** Gegen die bereits vorliegenden Meldungen. Gleiche Ansicht + gleiche
   Beschreibung ist fast immer dieselbe Sache.
4. **Verorten.** Welche Datei, welche Funktion. Bei einer Ansicht wie `matchdayArena` ist das ein
   überschaubarer Suchraum.
5. **Lösungsvorschlag** mit Aufwand und Risiko.

**Was der Agent nicht tun sollte: ungefragt fixen.** Du hast ausdrücklich gesagt, dass du entscheiden
willst. Der Agent liefert Befund und Vorschlag; der Fix kommt erst nach deinem Ja. Ausnahme wäre
allenfalls etwas, das offensichtlich und folgenlos ist — aber diese Grenze verschiebt sich in der
Praxis immer nach oben, deshalb würde ich sie gar nicht erst aufmachen.

### 3c. Die Vorlage an dich

Ein Bericht je Runde, nicht je Meldung — sonst ist es dasselbe Rauschen wie vorher, nur formatierter.
Je Meldung eine Zeile mit: Melder, Seite, Spielstand + Spieltag, Beschreibung, Einordnung,
Reproduziert ja/nein, Vorschlag, Aufwand. Sortiert nach Schwere. Darunter je Meldung ein Absatz mit
dem Befund.

Auslösung: nach einer festen Zahl neuer Meldungen oder auf Zuruf. Zeitgesteuert (täglich) erzeugt
leere Berichte an Tagen ohne Meldung.

## 4. Offene Fragen, die du entscheiden musst

**Kommt der Spielstand mit?** Ohne ihn bleibt "Reproduzieren" bei "Zustand gelesen, plausibel". Die
Meldung nennt zwar `saveId`, aber die Datei selbst liegt bei dir. Möglich wäre, bei einer Meldung
automatisch einen Snapshot nach `data/online-saves/` zu exportieren und mitzucommitten — das ist der
Mechanismus, den es für Saves bereits gibt. Kostet Platz und macht jede Meldung schwerer; dafür ist
sie dann wirklich nachstellbar statt nur beschrieben.

**Wie weit darf der Agent?** Mein Vorschlag: Befund + Vorschlag, kein Code. Wenn du mehr willst,
wäre die nächste Stufe "Fix in einem Draft-PR, der auf deine Freigabe wartet" — dann siehst du die
Änderung statt einer Beschreibung, und nichts landet ohne dich auf `main`.

**Was passiert mit Abgelehntem?** Bei GitHub-Issues gelöst (closed mit Begründung). Bei Dateien
bräuchte es ein Statusfeld — ein Argument mehr für C.

## 5. Was ich mit dieser Änderung schon gemacht habe

- `reporter` (Owner-ID, Klarname, `fromSession`) — serverseitig aus der Session, nicht aus dem Body.
- `path` und `pageTitle` neben `view`, damit die Seite auch außerhalb der Foundation-Shell benennbar
  ist.
- `formatBugReportPage()` als eine Stelle für die Seitenbezeichnung, damit Liste, Bericht und
  Rückmeldung nicht auseinanderlaufen.
- Die Rückmeldung nach dem Senden zeigt jetzt Seite, Spielstand **und** unter welchem Namen gemeldet
  wurde.

Der Transportweg (3a) ist **nicht** gebaut — das ist die Entscheidung, die zuerst ansteht, weil alles
Weitere daran hängt.
