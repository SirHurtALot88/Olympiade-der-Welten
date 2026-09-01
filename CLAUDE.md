# Olympiade der Welten — Kontext für Agenten

## Der Server ist die einzige Quelle

Die Olympiade läuft **ausschließlich** auf dem Hetzner-Server. Nichts wird lokal gespielt,
nichts lokal gespeichert. Wer über „den Spielstand" redet, meint den auf diesem Server.

| | |
|---|---|
| Server | `OlympiadeServer` (Hetzner) |
| IPv4 | `135.181.102.2` |
| IPv6 | `2a01:4f9:c012:9009::` |
| Benutzer | `root` |
| App-URL | `https://olympiade.duckdns.org/foundation` |
| Healthcheck | `https://olympiade.duckdns.org/api/health` |
| Repo auf dem Server | `/root/Olympiade-der-Welten` |
| Spielstand im Container | `/app/data/persistence/oly-app.sqlite` (Volume `oly-data`) |
| Compose-Datei | `deploy/hetzner/docker-compose.yml` |
| Dienst | `oly-app` |

```sh
ssh root@135.181.102.2
```

Der Zugang selbst (Schlüssel/Passwort) liegt bei Chris, nicht im Repo. Ebenso `deploy/hetzner/.env`
mit Domain und Login-Geheimnissen — die Datei ist absichtlich nicht versioniert.

**Agenten kommen an den Server NICHT heran** — nachgemessen, nicht vermutet: kein `ssh` im Container,
Port 22 nicht erreichbar, und HTTPS auf IP wie Domain wird vom Umgebungs-Proxy mit `403 CONNECT
tunnel failed` abgelehnt (nur eine Allowlist mit GitHub/npm ist offen). Der einzige Weg zu den
Spielständen führt über GitHub, siehe unten. Wer den Server direkt braucht, muss Chris bitten — oder
die Domain müsste in der Netzwerk-Policy der Claude-Code-Umgebung freigeschaltet werden.

**Befehle für Chris immer ohne nachgestellte `#`-Kommentare schreiben.** Seine Shell ist zsh, und
die behandelt `#` interaktiv nicht als Kommentar — eine Zeile wie `befehl   # erklaerung` scheitert
mit `command not found: #`. Erklärungen gehören in den Fließtext, nicht in die Befehlszeile.

## An die Spielstände kommen

Der Server pusht seine **komplette** SQLite (also alle Spielstände) per Cron auf den Branch
`live-save`:

```sh
git fetch origin live-save
git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > /tmp/abbild.gz
gunzip -c /tmp/abbild.gz > /tmp/abbild.sqlite
```

Danach zeigt man die Werkzeuge über `OLY_APP_SQLITE_PATH` auf die **Kopie**:

```sh
OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/e2e-saisonende-am-save-abbild.ts
```

Der SessionStart-Hook (`.claude/hooks/session-start.sh`) macht genau das automatisch, wenn der
lokale Store leer ist. Ein Store, in dem schon Spielstände liegen, wird **nie** überschrieben.

`data/online-saves/manifest.json` (JSON-Exporte auf `main`) ist der ältere, zweite Weg und nur noch
Rückfall. Er trug über die gesamte Historie nur Smoke- und Audit-Saves, nie einen echten Stand.

## An Chris' In-Game-Meldungen kommen

Dieselbe Mechanik, anderer Branch: der Server pusht jede über die Flagge im Spiel abgeschickte
Meldung nach `bug-reports`. **Dafür muss Chris nichts tun** — nicht kopieren, nicht weiterleiten.

```sh
git fetch origin bug-reports
git ls-tree -r --name-only origin/bug-reports
git show origin/bug-reports:data/bug-reports/<datei>.json
```

Jede Meldung ist eine JSON-Datei mit `note` (Chris' Text), `page.view` (wo er stand), `game`
(Spielstand, Saison, Spieltag) und `createdAt`. Der Dateiname trägt den Zeitstempel, `ls-tree`
liefert sie also schon sortiert.

**Vor jeder Runde einmal lesen.** Die Tickets, die sonst mühsam aus Chats zusammengesucht werden,
stehen hier vollständig und mit Kontext — inklusive der Ansicht, in der er den Fehler gesehen hat.
Ausführlicher: `docs/BUGFIXING_AGENT.md`.

## Zuerst prüfen: spiegelt der Server überhaupt noch?

```sh
npx tsx scripts/pruefe-spiegel-frische.ts
```

Beide Spiegel (`live-save`, `bug-reports`) hängen an Crons **auf dem Server**. Fallen die aus,
schlägt nichts fehl — es passiert nur nichts mehr, und zwar lautlos. Am 19.08. stellte sich heraus,
dass beide seit dem 14.08. standen: fünf Tage lang war das neueste „aktuelle" Abbild fünf Tage alt,
und keine In-Game-Meldung erreichte GitHub.

**Ein veraltetes Abbild sieht aus wie ein gültiger Spielstand.** Wer darauf misst, misst die
Vergangenheit und hält sie für die Gegenwart. Der SessionStart-Hook fährt die Prüfung deshalb bei
jedem Start — auch dann, wenn er den Import überspringt.

Beheben kann das nur Chris auf dem Server. Dafür gibt es **einen** Befehl statt fünf:

```sh
ssh root@135.181.102.2
cd Olympiade-der-Welten && bash deploy/hetzner/spiegel-reparieren.sh
```

Das Skript prüft Crontab, Cron-Dienst, Deploy-Stand und Logs, richtet die Crons neu ein und
spiegelt einmal sofort. Es zerstört nichts — nur mit `--deploy-loesen` fasst es den Arbeitsbaum an,
und auch dann sagt es vorher, was es wegwirft.

## Etwas auf den Server zurückspielen

Nur über `deploy/hetzner/pull-repaired-save.sh` — **nicht** von Hand. Der Grund ist WAL: neben
`oly-app.sqlite` liegen `-wal` und `-shm`, die zur alten Datei gehören. Tauscht man nur die
Hauptdatei, schreibt SQLite beim Start die alte WAL auf den neuen Stand; bestenfalls ist der alte
Stand zurück, schlimmstenfalls ist die Datenbank kaputt. Das Skript sichert vorher, hält die App an,
räumt WAL/SHM weg und kann mit `--zurueck` alles rückgängig machen.

## Kader auffüllen, wenn ein Kauflauf abgebrochen ist

Ein Fehler beim Saisonstart konnte den KI-Kauflauf auf halber Strecke stehen lassen: die Sperre
`skipIfExistingMarketTransfers` fragte nur „existiert IRGENDEIN Transfer dieser Saison?" und stieg
dann für die **ganze Liga** aus. Teams blieben auf ihrem Minimum stehen, und auch ein erneuter Klick
auf „KI picken" tat nichts. Der Code ist repariert — ein **bestehender** Spielstand holt das aber
nicht von selbst nach, weil das Kauffenster der Saison durch ist.

```sh
ssh root@135.181.102.2
cd Olympiade-der-Welten && bash deploy/hetzner/kader-auffuellen.sh
```

Ohne Schalter gibt es **nur den Bericht**, die App läuft weiter. `--apply` fährt den Kauf wirklich
(sichert vorher nach `/root/oly-save-sicherungen/`, hält die App an, setzt Besitzrechte zurück),
`--zurueck` dreht auf die letzte Sicherung zurück. Gekauft wird über denselben Produktionspfad, den
das Spiel selbst nimmt — keine zweite Kauflogik.

## Deploy

`deploy/hetzner/auto-deploy.sh` pollt per Cron `main` und baut bei neuen Commits neu. Er zieht mit
`--ff-only`; ein liegengebliebener lokaler Commit im Server-Repo blockiert ihn deshalb dauerhaft.
Logs: `tail -f /var/log/oly-deploy.log`.

Zweiter, ganz anderer Blockierer: volle Root-Platte, weil der Docker-Build mitten im Bauen
abbricht (`no space left on device`). Am 01.09. steckten so 6,8 GB reiner Git-Historie in `.git`,
bei nur ~200 MB Arbeitsbaum — verursacht durch `push-live-save.sh`/`push-bug-reports.sh`, die bei
jedem Cron-Lauf bewusst einen elternlosen Commit bauen und per Force-Push schicken (haelt den
Branch auf GitHub klein), der aber lokal sofort zum "dangling object" wird und nie von selbst
verschwindet. `deploy/hetzner/git-repo-aufraeumen.sh` raeumt das per `git gc --prune=now` weg und
laeuft seitdem woechentlich (sonntags 04:10) als dritter Cron neben den beiden Push-Crons, s.
`install-live-save-cron.sh`.
