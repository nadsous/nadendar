# Nadendar Sync

Serveur de synchronisation des foyers Nadendar. Il ne stocke que des enregistrements
**chiffrés de bout en bout** (AES-GCM, clé transmise uniquement par le code d'invitation)
et des identifiants anonymisés : il ne peut lire ni les calendriers ni leur structure.

- En production : `https://nads.site/sync` (VPS de nads.site, Debian 13)
- Code : `main.ts` (Deno, sans dépendance), base Deno KV
- Tests de bout en bout : `SYNC_URL=https://nads.site/sync deno task test`

## Sur le VPS

| Élément | Emplacement |
|---|---|
| Code | `/opt/nadendar-sync/` |
| Données (Deno KV) | `/var/lib/nadendar-sync/sync.db` |
| Sauvegardes (14 jours) | `/var/backups/nadendar-sync/` — chaque nuit à 3 h 30 |
| Service | `nadendar-sync.service` — utilisateur `nadendar`, `127.0.0.1:8787`, 256 Mo max |
| Nginx | `/etc/nginx/snippets/nadendar-sync.conf`, inclus dans le bloc HTTPS de `nads.site` |

```bash
systemctl status nadendar-sync           # état
journalctl -u nadendar-sync -f           # journaux
systemctl list-timers nadendar-sync-backup.timer
```

## Mise à jour

Depuis le PC, à la racine du projet :

```bash
bash server/deploy/deploy.sh root@ton-serveur
```

Le script est idempotent : il recopie le code, redémarre le service et vérifie
`https://nads.site/sync/health`. La configuration Nginx n'est modifiée qu'une fois, avec une
copie de sécurité (`nads.site.avant-nadendar.<date>`) et un retour arrière si `nginx -t` échoue.

## Sauvegardes hors du VPS

Les sauvegardes restent sur le VPS : pensez à les copier ailleurs (elles sont chiffrées) :

```bash
rsync -avz root@ton-serveur:/var/backups/nadendar-sync/ ./sauvegardes-nadendar/
```
