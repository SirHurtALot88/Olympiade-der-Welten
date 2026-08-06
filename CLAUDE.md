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
| Repo auf dem Server | `/root/Olympiade-der-Welten` |
| Spielstand im Container | `/app/data/persistence/oly-app.sqlite` (Volume `oly-data`) |
| Compose-Datei | `deploy/hetzner/docker-compose.yml` |
| Dienst | `oly-app` |

```sh
ssh root@135.181.102.2
```

Der Zugang selbst (Schlüssel/Passwort) liegt bei Chris, nicht im Repo. Ebenso `deploy/hetzner/.env`
mit Domain und Login-Geheimnissen — die Datei ist absichtlich nicht versioniert.

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

## Etwas auf den Server zurückspielen

Nur über `deploy/hetzner/pull-repaired-save.sh` — **nicht** von Hand. Der Grund ist WAL: neben
`oly-app.sqlite` liegen `-wal` und `-shm`, die zur alten Datei gehören. Tauscht man nur die
Hauptdatei, schreibt SQLite beim Start die alte WAL auf den neuen Stand; bestenfalls ist der alte
Stand zurück, schlimmstenfalls ist die Datenbank kaputt. Das Skript sichert vorher, hält die App an,
räumt WAL/SHM weg und kann mit `--zurueck` alles rückgängig machen.

## Deploy

`deploy/hetzner/auto-deploy.sh` pollt per Cron `main` und baut bei neuen Commits neu. Er zieht mit
`--ff-only`; ein liegengebliebener lokaler Commit im Server-Repo blockiert ihn deshalb dauerhaft.
Logs: `tail -f /var/log/oly-deploy.log`.
