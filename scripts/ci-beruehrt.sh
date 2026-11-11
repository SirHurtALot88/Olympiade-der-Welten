#!/usr/bin/env bash
# Sagt der CI, ob eine Änderung Dateien unter einem Pfadmuster berührt.
#
#   bash scripts/ci-beruehrt.sh <basis-sha> <regex> [kopf, Standard HEAD]
#
# Gibt "true" oder "false" aus. Ohne Basis (manueller Lauf, erster Push) oder wenn der Diff nicht
# zu holen ist: "true", damit im Zweifel geprüft wird.
set -euo pipefail

basis="${1:-}"
muster="${2:?Regex fehlt}"
kopf="${3:-HEAD}"

if [[ -z "$basis" || "$basis" =~ ^0+$ ]]; then
  echo true
  exit 0
fi

if ! git cat-file -e "${basis}^{commit}" 2>/dev/null; then
  git fetch --quiet --no-tags --depth=1 origin "$basis" 2>/dev/null || { echo true; exit 0; }
fi

dateien="$(git diff --name-only "$basis" "$kopf" 2>/dev/null)" || { echo true; exit 0; }

if grep -q -E "$muster" <<<"$dateien"; then
  echo true
else
  echo false
fi
