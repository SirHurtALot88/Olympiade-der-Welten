#!/usr/bin/env bash
# Sagt der CI, ob eine Änderung NUR die Kartenschmiede (Moosgrab) betrifft.
#
#   bash scripts/ci-nur-kartenschmiede.sh <basis-sha> [kopf, Standard HEAD]
#
# Gibt "true" oder "false" aus. Dann laufen statt der Oly-Suiten (Build, Browser-Smokes,
# volle Testsuite, Persistenz, Rangtreue) nur die Kartenschmiede-Prüfungen. Die Kartenschmiede ist
# eine eigenständige HTML-Seite (apps/kartenschmiede) und wird vom Oly-Code nicht gelesen.
#
# Im Zweifel immer "false", also die volle CI: ohne Basis (manueller Lauf, erster Push eines
# Branches), wenn die Basis nicht zu holen ist, bei leerem Diff, und sobald auch nur eine Datei
# außerhalb der Liste unten liegt. Die Routen unter app/ stehen bewusst NICHT in der Liste: sie
# hängen am Next-Build und an Oly-Wächtern (Schreibrouten-Politik), dort läuft weiter alles.
set -euo pipefail

basis="${1:-}"
kopf="${2:-HEAD}"

if [[ -z "$basis" || "$basis" =~ ^0+$ ]]; then
  echo false
  exit 0
fi

if ! git cat-file -e "${basis}^{commit}" 2>/dev/null; then
  git fetch --quiet --no-tags --depth=1 origin "$basis" 2>/dev/null || { echo false; exit 0; }
fi

dateien="$(git diff --name-only "$basis" "$kopf" 2>/dev/null)" || { echo false; exit 0; }

if [[ -z "$dateien" ]]; then
  echo false
  exit 0
fi

fremd="$(grep -v -E '^(apps/kartenschmiede/|lib/kartenschmiede/|tests/kartenschmiede[^/]*\.test\.ts$|scripts/kartenschmiede-[^/]*$|docs/design/moosgrab-[^/]*\.md$)' <<<"$dateien" || true)"

if [[ -z "$fremd" ]]; then
  echo true
else
  echo false
fi
