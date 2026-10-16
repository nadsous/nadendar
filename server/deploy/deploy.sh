#!/usr/bin/env bash
# Déploiement depuis le PC : ./server/deploy/deploy.sh root@ton-serveur
# Copie le serveur sur le VPS puis lance install.sh (en root, ou via sudo).
set -euo pipefail
TARGET="${1:?usage : deploy.sh utilisateur@serveur}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="/tmp/nadendar-sync-deploy"

echo "▸ Envoi vers $TARGET"
ssh "$TARGET" "rm -rf $TMP && mkdir -p $TMP/deploy"
scp -q "$HERE/main.ts" "$HERE/backup.ts" "$HERE/deno.json" "$TARGET:$TMP/"
scp -q "$HERE"/deploy/*.service "$HERE"/deploy/*.timer "$HERE"/deploy/*.conf "$HERE"/deploy/install.sh "$TARGET:$TMP/deploy/"

echo "▸ Installation"
if [[ "$TARGET" == root@* ]]; then
  ssh "$TARGET" "bash $TMP/deploy/install.sh"
else
  ssh -t "$TARGET" "sudo bash $TMP/deploy/install.sh"
fi
