#!/usr/bin/env bash
# push-live-save.sh — auf dem Hetzner-Server ausfuehren.
#
# Kopiert die Live-Spielstand-SQLite aus dem laufenden Docker-Container und pusht sie
# (gzip-komprimiert) auf den GitHub-Branch "live-save". Von dort liest Claude den
# aktuellen Save. So kann ein Bug in genau deinem aktiven Spielstand reproduziert werden.
#
# Bewusst so gebaut:
#   - Es wird NUR der eigene Branch "live-save" gepusht → main bleibt unberuehrt,
#     der Auto-Deploy (der main pollt) baut NICHT neu, das Spiel laeuft ohne Unterbrechung.
#   - Der Arbeitsbaum wird NICHT angefasst (eigener temporaerer Git-Index) → Auto-Deploy
#     bleibt sauber.
#   - Nutzt den bereits gespeicherten Git-Zugang (wie auto-deploy.sh) — keine Tokens hier.
set -euo pipefail

# ---------------------------------------------------------------------------
# ANMELDUNG FEHLT? DANN SAG DAS AUCH.
#
# GEMESSEN AM 19.08.: beide Spiegel standen seit dem 14.08. still. Im Log stand fuenf Tage lang,
# alle 15 Minuten, nur:
#
#     fatal: could not read Username for 'https://github.com': No such device or address
#
# Das ist die Meldung von git, wenn es im Cron nach einem Passwort fragen will und kein Terminal
# findet. Wer sie nicht kennt, liest daraus einen Netzwerk- oder Geraetefehler — dabei fehlt
# schlicht der gespeicherte Zugang. `git fetch` laeuft ohne Anmeldung weiter, `git push` nicht;
# der Auto-Deploy funktionierte deshalb die ganze Zeit, und niemand kam auf die Spur.
#
# Diese Funktion uebersetzt die drei Faelle in Klartext samt Loesung. Sie aendert nichts am
# Verhalten — sie macht nur sichtbar, was zu tun ist.
# ---------------------------------------------------------------------------
erklaere_push_fehler() {
  local ausgabe="$1"
  case "$ausgabe" in
    *"could not read Username"*|*"Authentication failed"*|*"Password authentication is not supported"*|*"terminal prompts disabled"*)
      echo ""
      echo "!!! DER PUSH SCHEITERT AN DER ANMELDUNG, NICHT AM NETZ !!!"
      echo ""
      echo "  GitHub nimmt fuer Git keine Passwoerter mehr an — es braucht einen Token."
      echo ""
      echo "  1) Token erzeugen:  https://github.com/settings/tokens/new"
      echo "     Note 'Olympiade Server', Expiration 'No expiration', Scope: repo"
      echo ""
      echo "  2) Auf diesem Server EINMAL von Hand pushen und den Token als Passwort eingeben:"
      echo "       git config --global credential.helper store"
      echo "       cd /root/Olympiade-der-Welten"
      echo "       bash $(basename "$0")"
      echo "     Username = der GitHub-Benutzername, Password = der Token (er wird beim"
      echo "     Einfuegen nicht angezeigt, das ist normal)."
      echo ""
      echo "  Danach liegt der Zugang in ~/.git-credentials und der Cron laeuft wieder allein."
      echo ""
      ;;
  esac
}

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

COMPOSE="deploy/hetzner/docker-compose.yml"
BRANCH="live-save"
TMP_DB="/tmp/oly-live.sqlite"
TMP_GZ="/tmp/oly-live.sqlite.gz"

DB_IM_CONTAINER="/app/data/persistence/oly-app.sqlite"

# WARUM DIESER SCHRITT: die App laeuft mit `journal_mode = WAL` (lib/persistence/sqlite.ts).
# Dabei landen frische Schreibvorgaenge NICHT sofort in `oly-app.sqlite`, sondern in der
# Seitendatei `oly-app.sqlite-wal` — bis ein Checkpoint sie einarbeitet.
#
# Vorher kopierte dieses Skript nur `oly-app.sqlite`. Ergebnis: der Cron lief brav alle 10
# Minuten und pushte jedes Mal denselben VERALTETEN Stand, ohne dass irgendwo ein Fehler
# auftauchte. Ein Spielstand war so tagelang "aktuell" auf GitHub und stimmte trotzdem nicht.
#
# Der Checkpoint laeuft ueber die better-sqlite3-Instanz der App selbst (die Abhaengigkeit ist im
# Container garantiert vorhanden — ein `sqlite3`-CLI waere es nicht). TRUNCATE arbeitet die WAL
# vollstaendig ein und leert sie; die laufende App nimmt daran keinen Schaden, ein Checkpoint ist
# ein normaler, nebenlaeufiger SQLite-Vorgang.
echo "[1/4] WAL einarbeiten (sonst fehlt alles seit dem letzten Checkpoint) ..."
if ! docker compose -f "$COMPOSE" exec -T oly-app node -e "
  const Database = require('better-sqlite3');
  const db = new Database('$DB_IM_CONTAINER');
  const result = db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
  console.log('      Checkpoint:', JSON.stringify(result));
"; then
  echo "FEHLER: WAL-Checkpoint fehlgeschlagen — es wird NICHT gepusht." >&2
  echo "        Ein Push waere sonst ein veralteter Stand, der wie ein aktueller aussieht." >&2
  exit 1
fi

echo "[2/4] Live-Save aus dem Container kopieren ..."
docker compose -f "$COMPOSE" cp "oly-app:$DB_IM_CONTAINER" "$TMP_DB"
gzip -cf "$TMP_DB" > "$TMP_GZ"
rm -f "$TMP_DB"
echo "      Groesse: $(du -h "$TMP_GZ" | cut -f1)"

echo "[3/4] Commit bauen (main + Arbeitsbaum bleiben unberuehrt) ..."
# Bewusst ein ELTERNLOSER Einzel-Commit + Force-Push: der Branch "live-save" bleibt so
# immer genau EIN Commit (~wenige MB) statt bei jedem Cron-Lauf zu wachsen → kein Repo-Muell.
export GIT_INDEX_FILE=/tmp/oly-live-index
rm -f "$GIT_INDEX_FILE"
git read-tree --empty
BLOB="$(git hash-object -w "$TMP_GZ")"
git update-index --add --cacheinfo 100644 "$BLOB" "data/online-saves/hetzner-live.sqlite.gz"
TREE="$(git write-tree)"
COMMIT="$(printf 'chore(saves): live Hetzner save snapshot' | git commit-tree "$TREE")"
unset GIT_INDEX_FILE
rm -f "$TMP_GZ"

echo "[4/4] Push nach GitHub (Branch $BRANCH) ..."
if ! PUSH_AUSGABE="$(git push -f origin "$COMMIT:refs/heads/$BRANCH" 2>&1)"; then
  printf '%s\n' "$PUSH_AUSGABE"
  erklaere_push_fehler "$PUSH_AUSGABE"
  exit 1
fi
printf '%s\n' "$PUSH_AUSGABE"

echo ""
echo "FERTIG — dein Live-Save liegt jetzt auf GitHub (Branch '$BRANCH')."
echo "Sag Claude Bescheid: 'live save ist da'."
