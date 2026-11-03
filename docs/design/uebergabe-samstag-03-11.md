# Übergabe für Samstag — Stand 03.11., 13:10 UTC

Budget für heute ist durch, weiter geht es erst Samstag. Dieses Dokument steht für sich: wer es
liest, braucht keine Vorgeschichte aus dem Chat. Alle Status-Angaben unten sind **live
nachgelesen** (GitHub-REST-API, `git` im Worktree, `curl` auf den Server) um ca. 13:08 UTC am
03.11. — nicht aus dem Gedächtnis. Am Samstag trotzdem neu nachsehen, bevor man sich darauf
verlässt.

Verbindlich bleibt `CLAUDE.md` (rho > 0,80 je Einzelspiel, Pp-Abweichung ≤ 25 als Pflichtprüfung,
gesperrte Eignungsmatrix, Hetzner als einzige Spielstand-Quelle, Befehle für Chris ohne
`#`-Kommentare, Attribution auf Commits/PRs).

## 1. Kurzfassung

Heute gemerged: **#1338** (Save-Karten aufgeräumt) und **#1339** (Entwurf-Board Top-3 + 8
Review-Funde) — #1339 ist **live auf dem Server**, die ausgelieferte `battle-mode.engine.js` ist
byte-gleich mit `main`. Offen, nur noch zu mergen: **#1340** (5 Stat-Anzeige-Fixes) und **#1341**
(reine Doku, Verhalten-Text je Disziplin) — beide nicht mehr Draft, CI lief beim Schreiben noch.
Das Wettessen-Paket liegt als **Draft-PR #1342** auf GitHub, hat aber **Merge-Konflikte** mit
`main` (zwei Dateien) und braucht deshalb zuerst einen Rebase/Merge, bevor CI überhaupt läuft.
Danach kommt der Backlog in Abschnitt 6 — davon ist noch nichts begonnen.

## 2. Heute erledigt und gemerged

| PR | Titel | Gemerged (UTC) |
|---|---|---|
| #1338 | Save-Karten: Battle/Management-Mode-Badge + aufgeräumt | 03.11., 10:11 |
| #1339 | Entwurf-Board: Top-3 Vorschläge + Positions-Kürzel, 8 Review-Funde behoben | 03.11., 12:33 |

- **#1338** — Jede Save-Karte zeigt jetzt als Badge, ob es ein Battle- oder Management-Spielstand
  ist; dafür weniger Infos je Karte, die Liste ist ruhiger.
- **#1339** — Entwurf-Board: je Slot die **Top-3-Vorschläge** aus dem Kader, im Kader die
  stärksten Positionen eines Spielers als Kürzel (`topSlotsFuer`, `slotKuerzel`); Reihenfolge
  korrigiert, Sprites, kompakte Labels, beide Diszis. Dazu acht Funde aus dem Opus-Review zur
  vorherigen Kulissen/Figuren-PR behoben. Mit im Merge liegen zwei Fable-Konzeptpapiere:
  `docs/design/wettessen-uebersicht-format-1v1-03-11.md` und
  `docs/design/kampfwerte-anzeige-und-diszi-alltime-statistik-03-11.md`.

## 3. Heute erledigt, PR offen — muss nur noch gemerged werden

Stand 13:08 UTC: beide **offen, nicht Draft, nicht gemerged**, `mergeable_state = blocked`
(blockiert nur, weil Pflicht-Checks noch laufen — keine Konflikte).

### #1340 — Board: letzter Fund aus Fables Stat-Audit

Branch `claude/board-stat-anzeige-fixes-031126`, Kopf `89ae3a68c`. Fünf Stat-Anzeige-Fixes im
Entwurf-Board, keine Änderung an der Simulation:

1. Tempo-Formel auf `KARTEN_SPD` umgestellt (die Anzeige rechnete mit einer anderen Grundlage
   als die Engine).
2. Tempo-Cooldown-Tooltip korrigiert.
3. Heiler-Badge-Formel korrigiert.
4. Rohwerte statt Kampfwerte: neue Funktion `kampfwerteVorschau()` zeigt die Werte so, wie die
   Einheit im Kampf wirklich dasteht (siehe Hinweis 7.2).
5. Tote Veranlagung-Platzhalter „Bollwerk / Wachstum / Standhaft" im Spielerprofil-Panel
   entfernt.

CI zum Zeitpunkt des Schreibens: ✅ full-test-suite Shard 1/4 und 4/4, pps-referenz-frische,
lockfile-libc-waechter, arena-image-chromium-probe, weiche; ⏭ kartenschmiede (übersprungen,
richtig so); ⏳ **noch laufend**: full-test-suite Shard 2/4 und 3/4, persistenz-suiten,
test-and-smoke, arena-chromium-tests. Kein roter Check.

### #1341 — Doku: Verhalten-Text (Persönlichkeit/Slot) je Disziplin — Fables Verifikation

Branch `claude/verhalten-drei-stufen-doku-031126`, Kopf `f6472e563`. Nur
`docs/design/verhalten-drei-stufen-board-text-03-11.md`, kein Code. Inhalt: was die Texte
„Haltung", „Persönlichkeit" und „Rolle" im Board je Disziplin tatsächlich bewirken — Grundlage
für den Backlog-Punkt 6.6.

CI: gleiches Bild wie #1340 — grün bis dahin, fünf Checks noch laufend, kein roter.

**Samstag zuerst:** beide PRs nachsehen. Sind die Checks grün → mergen. Ist einer rot → Log lesen
(`gh api repos/SirHurtALot88/Olympiade-der-Welten/commits/<sha>/check-runs`), nicht blind neu
starten.

## 4. Hetzner-Deploy-Verifikation

**Für #1339 erledigt — Abweichung vom Stand 12:41 UTC.** Beim Check um 12:41 sah es so aus, als
hätte der Server den Merge noch nicht übernommen. Um 13:08 nachgemessen:

- `last-modified: Tue, 03 Nov 2026 12:35:04 GMT` auf
  `https://olympiade.duckdns.org/mockups/battle-mode.engine.js` — also knapp zwei Minuten **nach**
  dem Merge von #1339 (12:33:19).
- Die ausgelieferte Datei ist **byte-gleich** mit `origin/main:public/mockups/battle-mode.engine.js`
  (`cmp` ohne Unterschied), `topSlotsFuer` (neu aus #1339) kommt zweimal vor.
- `/api/health` antwortet 200.

**Noch offen: #1340.** Nach dessen Merge erneut prüfen. Marker für #1340 ist `kampfwerteVorschau`
— der ist heute live erwartungsgemäß **nicht** drin (0 Treffer), weil #1340 noch nicht gemerged
ist. **Nicht** `kampfwerteVorschau` als Marker für #1339 nehmen, sondern `topSlotsFuer`.

```sh
curl -sI https://olympiade.duckdns.org/mockups/battle-mode.engine.js
curl -s https://olympiade.duckdns.org/mockups/battle-mode.engine.js | grep -c kampfwerteVorschau
curl -s https://olympiade.duckdns.org/mockups/battle-mode.engine.js | grep -c topSlotsFuer
```

`last-modified` muss nach dem Merge-Zeitpunkt liegen, der erste `grep` muss > 0 liefern. Der
Auto-Deploy brauchte heute rund zwei Minuten. Ist der Server nach mehreren Stunden immer noch
alt, laut `CLAUDE.md` Abschnitt „Deploy": Chris schaut per SSH ins Log
(`tail -f /var/log/oly-deploy.log`); bekannte Blocker sind ein liegengebliebener lokaler Commit
im Server-Repo (`--ff-only` hängt) und eine volle Root-Platte (`no space left on device`, dann
`deploy/hetzner/git-repo-aufraeumen.sh`). Agenten kommen per HTTPS ran, nicht per SSH.

## 5. Wettessen-Übersichts-Paket — läuft, NICHT verloren, braucht Samstag Aufmerksamkeit

Auftrag: Chris, 03.11.: „wettessen sieht generell sehr unübersichtlich aus" — Fable hat
Darstellung und Format geprüft (Konzept `docs/design/wettessen-uebersicht-format-1v1-03-11.md`,
schon auf `main`), und Chris wollte die Vorschläge „diesmal auch umgesetzt".

**Abweichung vom erwarteten Stand:** der Branch ist **schon gepusht** und es gibt bereits einen
**Draft-PR #1342** („Wettessen: Übersichts-Paket — Ebenen entwirren, Mauer sichtbar, Tischduelle
(Konzept 03.11.)", angelegt 13:08 UTC). Der Hintergrund-Agent lief beim Schreiben nicht mehr
(kein Prozess mehr sichtbar).

| | |
|---|---|
| Worktree | `/home/user/oly-wettessen` (existiert) |
| Branch | `claude/wettessen-uebersicht-paket-031126` |
| Kopf | `68b30df90` (lokal = remote) |
| Uncommitted | nichts — Arbeitsbaum sauber |
| Basis | `705f216b6` = Merge von #1338, also **vor** #1339 und #1340 |
| PR | #1342, Draft, `mergeable = false`, `mergeable_state = dirty` |
| CI | **keine Checks gelaufen** — bei Konflikten startet die PR-CI nicht |

Vier Commits auf dem Branch:

1. `9c5e4f410` — PR 1: Ebenen entwirren — eine Uhr, eine Währung (Einheit des Tages), drei
   Elemente je Esser; vier Zonen statt vier überlappender Anzeigesysteme; zwei Zeitfehler
   (Uhr eine Minute voraus, `done` im Tick) nebenbei behoben.
2. `274aae2fb` — PR 2: Mauer, Pause und Haltung sichtbar — Magen-Pegel und Stempel je Esser.
3. `eddb962a0` — PR 3: Tischduelle (Sitzordnung Heim-Gast-Heim-Gast), Callout-Dosis,
   Nachzählung, Gürtel.
4. `68b30df90` — Umsetzungsnachtrag im Konzeptpapier + Nachher-Screenshots.

Geänderte Dateien gegenüber der Basis: `public/mockups/battle-mode.engine.js` (+/− ca. 840
Zeilen), `public/mockups/battle-mode.css`, das Konzeptpapier, neu
`scripts/pruefe-wettessen-identisch.mjs` (prüft, dass der Ablauf bit-gleich bleibt, also nur
Darstellung geändert wurde) und `scripts/screenshot-wettessen-matrix.mjs`, dazu neun PNGs unter
`docs/design/`.

**Konflikte (mit `git merge-tree` nachgemessen), sowohl gegen `origin/main` als auch gegen den
#1340-Branch:**

- `public/mockups/battle-mode.engine.js` — inhaltlicher Konflikt mit #1339 (und #1340).
- `docs/design/wettessen-uebersicht-format-1v1-03-11.md` — add/add-Konflikt: die Datei kam
  über #1339 schon auf `main`, der Wettessen-Branch hat sie in seinem ersten Commit ebenfalls neu
  angelegt und im vierten erweitert. Auflösung: `main`-Fassung als Grundlage, den
  Umsetzungsnachtrag aus dem Branch oben drauf.

**Was bis zum Live-Check noch fehlt:**

1. Erst #1340 mergen (sonst löst man den Engine-Konflikt zweimal).
2. Im Worktree `git fetch origin main` und `origin/main` hereinholen (Merge ist hier einfacher
   als Rebase über vier Commits, die alle dieselbe Datei anfassen). Konflikte in den zwei Dateien
   auflösen.
3. `node scripts/pruefe-wettessen-identisch.mjs` erneut laufen lassen — der Ablauf muss nach dem
   Merge weiter identisch sein. Danach die Screenshot-Matrix einmal neu fahren und auf Augenschein
   prüfen.
4. Push (normal, kein Force nötig bei Merge), dann ist #1342 nicht mehr „dirty" und CI startet.
5. CI grün → Draft entfernen → mergen → Live-Check wie in Abschnitt 4 (Marker z. B.
   `wettessenBugStandHtml` oder `zeichneWettessenCountdown`).

Da es nur um Darstellung geht und der Ablauf bit-gleich bleibt, ändert das Paket keine rho- oder
Pp-Werte; falls beim Konfliktlösen doch Mechanik-Code berührt wird, gilt die Pflichtprüfung aus
`CLAUDE.md`.

## 6. Backlog für Samstag — noch NICHT begonnen

1. **Kader-Liste: Zahlen neben den Top-3-Kürzeln.** #1339 zeigt im Kader die drei stärksten
   Positionen eines Spielers nur als Kürzel; Chris will den numerischen Wert daneben sehen.
2. **Feste Farbe je Rolle/Slot (6 Stück).** Dieselbe Farbe für das Kürzel in der Kader-Liste und
   für die zugehörige Rollenkarte, damit man ohne Lesen zuordnen kann.
3. **Goldener Rahmen um den Diszi-Wert der Top-N im Team**, N = Anzahl Slots dieser Diszi. Chris
   wörtlich sinngemäß: hat eine Diszi nur 2 Slots, sind nur die Top-2-Spieler umrahmt.
4. **Rollenkarten im FM27-Stil:** farbige `++ / + / − / −−`-Indikatoren statt reinem Text,
   abgeleitet aus dem Attribut-Gewichtsprofil des Slots. Nur Anzeige — die Matrix bleibt gesperrt.
5. **Enforcer (Engel mit Flügeln):** greift optisch nur mit den Flügeln an, die
   Angriffsanimation hängt nicht an den echten Angriffen — verknüpfen. Zusätzlich: Fernkämpfer
   mit Bogen brauchen beim Schuss einen sichtbaren, modellierten Pfeil (gibt es noch nicht).
6. **Fables Verhalten-Text-Befund umsetzen** (Grundlage `docs/design/verhalten-drei-stufen-board-text-03-11.md`,
   erst nach Merge von #1341):
   - Haltung-Dropdowns und Persönlichkeitszeile im Board auf `istArena(disc)` beschränken — sie
     wirken nur in TDM, Mini-DM und Battlefield-Entwurf, sonst sind sie wirkungslos.
   - Rollen-Zeile für alle 20 Disziplinen aus den vorhandenen Tabellen füllen statt Platzhaltertext.
   - Ehrliche Quoten an den Dropdowns plus Hinweis „Entwurfskampf ≠ Spieltag".
   - Danach optional Engine-Arbeit in der Priorität des Dokuments: Stufe 3 in Übergabe/UI buchen,
     Stufe 1 ins Pod-Chassis, echter Befehlsbruch für Renegade/Egomaniac statt loser
     Bewegungs-Leine, Opportunist-Bindung anheben. **Jeder dieser Schritte mit rho- und
     Pp-Abnahme** (`scripts/miss-alle-disziplinen.mjs`, `scripts/messe-arena-einfluss.mjs`) —
     Pflichtprüfung laut `CLAUDE.md`.
7. **All-Time-Diszi-Statistik (Stage A):** Klick im Kader öffnet `PlayerDetailDrawer` mit PP,
   Liga-Rang und Career-Stats zur Disziplin. Konzept steht in
   `docs/design/kampfwerte-anzeige-und-diszi-alltime-statistik-03-11.md`. **Chris hat noch nicht
   gesagt, ob das gebaut werden soll — Samstag nachfragen, nicht einfach anfangen.**

## 7. Technische Hinweise, damit nichts doppelt schiefgeht

### 7.1 `battle-mode.engine.js` ist ein IIFE — Temporal Dead Zone beachten

Die Datei ist **ein** großes, von oben nach unten ausgeführtes IIFE, kein Modul mit Exports.
`const`/`let` auf oberster Ebene haben eine Temporal Dead Zone: Code, der **vor** der Deklaration
von `PERS` (ca. Zeile 7754) oder `persOf` (ca. Zeile 36592) synchron läuft, darf sie nicht
anfassen — sonst `ReferenceError` beim Laden und die ganze Arena ist tot. Neue Anzeige-Logik,
die `persOf`/`PERS` braucht, gehört in eine Funktion, die erst **danach** aufgerufen wird, z. B.
`renderProfile()` (ca. Zeile 37842, Aufruf erst ca. Zeile 54836). Nicht täuschen lassen von
Nachbarzeilen wie `fbarProfilName`, die im oberen Teil funktionieren — die hängen nur an
`SQUAD`, das früher deklariert ist. Zeilennummern verschieben sich mit jedem Merge; per `grep`
suchen.

### 7.2 `kampfwerteVorschau(p, d, slId)` ist absichtlich eine Kopie

Kommt mit #1340 (ca. Zeile 36520). Sie dupliziert die Kampfwert-Berechnung aus `baueEinheit()`
nur für die Vorschau im Entwurf-Board. **Nicht** zusammenlegen und **nicht** `baueEinheit()`
umbauen — die echte Simulation ist bit-identisch abgesichert, ein Umbau riskiert genau das. Wenn
`baueEinheit()` sich später ändert, die Vorschau bewusst nachziehen.

### 7.3 Playwright lokal ist unter Last wackelig

Lokale Verifikation gegen eine frische `live-save`-Kopie bricht manchmal mit „Target crashed"
oder Timeout ab, wenn parallel andere Hintergrund-Agenten oder Browser laufen (nur 4 Kerne). Das
ist kein Bug im Code: neu versuchen oder auf die textuelle Prüfung per `page.evaluate()` setzen
statt auf reproduzierbare Screenshots.

### 7.4 Scratchpad läuft voll

Heute lief die Platte auf 100 % (`ENOSPC` im Testlauf). Alte, große Scratch-Dateien
(`*.sqlite`-Kopien längst abgeschlossener Aufgaben) regelmäßig löschen — aber **nie** etwas, das
ein noch laufender Hintergrund-Agent benutzt (erkennbar an frischer `mtime` und Pfadnamen wie
`wettessen-impl`). Weitere Worktrees, die heute noch herumliegen und nicht zu dieser Übergabe
gehören: `/home/user/oly-staffel` (Branch `staffel-doppellauf`) und ein als „prunable"
markierter Scratch-Worktree auf `claude/bahn-pod-liga-wip` — vor dem Aufräumen prüfen, ob noch
jemand daran arbeitet, nicht einfach löschen.

## 8. Reihenfolge für Samstag, kurz

1. `npx tsx scripts/pruefe-spiegel-frische.ts` und `git fetch origin bug-reports` (neue
   Meldungen von Chris lesen).
2. #1340 und #1341: CI ansehen, mergen.
3. Live-Check #1340 (Abschnitt 4).
4. #1342 (Wettessen): `main` hereinholen, Konflikte lösen, Identitätsprüfung, push, CI, mergen,
   Live-Check.
5. Chris zu 6.7 (All-Time-Statistik) fragen.
6. Backlog 6.1–6.6 in der Reihenfolge, die Chris dann festlegt.
