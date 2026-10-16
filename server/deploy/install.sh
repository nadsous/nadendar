#!/usr/bin/env bash
# Installation / mise à jour de Nadendar Sync sur le VPS de nads.site. À lancer en root
# depuis le dossier qui contient main.ts, backup.ts et deploy/. Idempotent : relançable
# pour chaque mise à jour.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/nads.site}"
DOMAIN="${DOMAIN:-nads.site}"

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root (sudo)."; exit 1; }
echo "▸ Installation de Nadendar Sync depuis $SRC"

# 1. Deno : on réutilise celui de nads.site, sinon on l'installe dans /usr/local.
if [ ! -x /usr/local/bin/deno ]; then
  FOUND="$(command -v deno || true)"
  [ -z "$FOUND" ] && FOUND="$(ls /root/.deno/bin/deno /home/*/.deno/bin/deno 2>/dev/null | head -1 || true)"
  if [ -n "$FOUND" ]; then
    echo "▸ Deno trouvé : $FOUND → copié dans /usr/local/bin"
    install -m 0755 "$FOUND" /usr/local/bin/deno
  else
    echo "▸ Installation de Deno"
    curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- -y
  fi
fi
/usr/local/bin/deno --version | head -1

# 2. Utilisateur système et dossiers.
id nadendar >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin nadendar
install -d -o root -g root -m 0755 /opt/nadendar-sync
install -d -o nadendar -g nadendar -m 0750 /var/lib/nadendar-sync /var/backups/nadendar-sync
install -m 0644 "$SRC/main.ts" "$SRC/backup.ts" "$SRC/deno.json" /opt/nadendar-sync/

# 3. Services systemd.
install -m 0644 "$SRC/deploy/nadendar-sync.service" "$SRC/deploy/nadendar-sync-backup.service" "$SRC/deploy/nadendar-sync-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now nadendar-sync.service
systemctl restart nadendar-sync.service
systemctl enable --now nadendar-sync-backup.timer

echo "▸ Attente du service"
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:8787/health >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:8787/health && echo

# 4. Nginx : /sync/ dans le bloc HTTPS existant, avec retour arrière si la config échoue.
install -d /etc/nginx/snippets
install -m 0644 "$SRC/deploy/nginx-nadendar-sync.conf" /etc/nginx/snippets/nadendar-sync.conf
if ! grep -q "snippets/nadendar-sync.conf" "$NGINX_SITE"; then
  BACKUP="$NGINX_SITE.avant-nadendar.$(date +%Y%m%d%H%M%S)"
  cp "$NGINX_SITE" "$BACKUP"
  # Inséré à l'ouverture du bloc « server » qui écoute en 443 (Certbot place le
  # « listen 443 » en fin de bloc : on remonte donc au « server { » qui le contient).
  awk '
    NR == FNR {
      if ($0 ~ /^[[:space:]]*server[[:space:]]*\{/) last = FNR
      if ($0 ~ /listen[^;]*443/ && !target) target = last
      next
    }
    { print }
    FNR == target { print "    include snippets/nadendar-sync.conf;"; done = 1 }
    END { if (!done) exit 3 }
  ' "$BACKUP" "$BACKUP" > "$NGINX_SITE" || {
    echo "✗ Bloc HTTPS introuvable dans $NGINX_SITE : configuration inchangée."
    cp "$BACKUP" "$NGINX_SITE"
    exit 1
  }
  if ! nginx -t; then
    echo "✗ Nginx refuse la configuration : retour à l'ancienne."
    cp "$BACKUP" "$NGINX_SITE"
    nginx -t
    exit 1
  fi
  echo "▸ Nginx modifié (copie de sécurité : $BACKUP)"
fi
nginx -t
systemctl reload nginx

# 5. Vérification de bout en bout, depuis l'extérieur.
sleep 1
if curl -fsS "https://$DOMAIN/sync/health"; then
  echo
  echo "✓ Nadendar Sync est en ligne : https://$DOMAIN/sync"
else
  echo "✗ https://$DOMAIN/sync/health ne répond pas : voir journalctl -u nadendar-sync et la config Nginx."
  exit 1
fi
systemctl --no-pager --lines=0 status nadendar-sync.service | head -5
