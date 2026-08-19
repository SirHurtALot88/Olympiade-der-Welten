#!/usr/bin/env bash
# push-bug-reports.sh — auf dem Hetzner-Server ausfuehren.
#
# Holt die im Spiel gemeldeten Fehler (rote Flagge oben rechts) aus dem laufenden Container und
# spiegelt sie auf den GitHub-Branch "bug-reports". Erst damit sind Meldungen vom Live-Server
# ueberhaupt lesbar: geschrieben werden sie im Container-Dateisystem, und dort sieht sie sonst
# niemand ausser dem Container selbst.
#
# Bewusst so gebaut — dieselben Gruende wie bei push-live-save.sh:
#   - NUR der eigene Branch "bug-reports" wird gepusht → main bleibt unberuehrt, der Auto-Deploy
#     (der main pollt) baut NICHT neu, das Spiel laeuft ohne Unterbrechung.
#   - Der Arbeitsbaum wird NICHT angefasst (eigener temporaerer Git-Index) → Auto-Deploy bleibt sauber.
#   - Nutzt den bereits gespeicherten Git-Zugang (wie auto-deploy.sh) — keine Tokens hier.
#
# Warum ein ELTERNLOSER Commit + Force-Push und keine Historie: die Quelle der Wahrheit ist das
# Docker-Volume `oly-bug-reports`, in dem die Meldungen liegen bleiben. Der Branch ist nur ein
# Spiegel davon. So bleibt er immer genau EIN Commit gross statt bei jedem Cron-Lauf zu wachsen.
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
BRANCH="bug-reports"
TMP_DIR="/tmp/oly-bug-reports"

echo "[1/3] Meldungen aus dem Container kopieren ..."
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
# Fehlt der Ordner im Container, wurde schlicht noch nie etwas gemeldet — das ist kein Fehler.
if ! docker compose -f "$COMPOSE" cp oly-app:/app/data/bug-reports/. "$TMP_DIR" 2>/dev/null; then
  echo "      Noch keine Meldungen vorhanden — nichts zu tun."
  rm -rf "$TMP_DIR"
  exit 0
fi

REPORT_COUNT="$(find "$TMP_DIR" -maxdepth 1 -name 'bug-*.json' | wc -l | tr -d ' ')"
if [ "$REPORT_COUNT" = "0" ]; then
  echo "      Noch keine Meldungen vorhanden — nichts zu tun."
  rm -rf "$TMP_DIR"
  exit 0
fi
echo "      $REPORT_COUNT Meldung(en) gefunden."

echo "[2/3] Commit bauen (main + Arbeitsbaum bleiben unberuehrt) ..."
export GIT_INDEX_FILE=/tmp/oly-bug-reports-index
rm -f "$GIT_INDEX_FILE"

# Auf dem BESTEHENDEN Branch-Inhalt aufsetzen statt bei leer anzufangen.
#
# Der Live-Server ist nicht mehr die einzige Quelle: lokal gespielte Runden schieben ihre
# Meldungen ebenfalls hierher (lib/bug-report/bug-report-git.ts). Baute dieser Lauf den Baum
# aus dem leeren Verzeichnis auf, wuerde der Force-Push unten alles loeschen, was nicht aus
# dem Container kommt — alle 15 Minuten, lautlos.
#
# Beide Seiten bilden deshalb die VEREINIGUNG: bestehender Branch + eigene Dateien. Der Branch
# bleibt dabei ein einziger elternloser Commit, wie bisher.
git fetch -q origin "$BRANCH" 2>/dev/null || true
if git rev-parse --verify -q "refs/remotes/origin/$BRANCH" >/dev/null 2>&1; then
  git read-tree "refs/remotes/origin/$BRANCH"
else
  git read-tree --empty
fi
while IFS= read -r FILE; do
  BLOB="$(git hash-object -w "$FILE")"
  git update-index --add --cacheinfo 100644 "$BLOB" "data/bug-reports/$(basename "$FILE")"
done < <(find "$TMP_DIR" -maxdepth 1 -name 'bug-*.json' | sort)
TREE="$(git write-tree)"
COMMIT="$(printf 'chore(bug-reports): %s Meldung(en) vom Live-Server' "$REPORT_COUNT" | git commit-tree "$TREE")"
unset GIT_INDEX_FILE
rm -rf "$TMP_DIR"

echo "[3/3] Push nach GitHub (Branch $BRANCH) ..."
if ! PUSH_AUSGABE="$(git push -f origin "$COMMIT:refs/heads/$BRANCH" 2>&1)"; then
  printf '%s\n' "$PUSH_AUSGABE"
  erklaere_push_fehler "$PUSH_AUSGABE"
  exit 1
fi
printf '%s\n' "$PUSH_AUSGABE"

echo ""
echo "FERTIG — die Meldungen liegen jetzt auf GitHub (Branch '$BRANCH')."
echo "Der Bugfixing-Agent liest sie von dort (siehe docs/BUGFIXING_AGENT.md)."
