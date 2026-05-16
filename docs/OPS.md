# Ops runbook

## Topologie

- Process manager : PM2 (`ecosystem.config.cjs`)
  - `leadflow-web` — Next.js sur 127.0.0.1:3000
  - `leadflow-worker` — orchestrateur (restart quotidien 6h)
  - `leadflow-backup` — backup quotidien 2h, rotation 7
- Reverse proxy : nginx → 127.0.0.1:3000 (TLS Cloudflare origin)
- DB : SQLite WAL, `data/leads.db`

## Healthcheck

```
curl https://leads.visibee.fr/api/health
# {"status":"ok","timestamp":"..."}
```

Public (pas d'auth) — à exposer à un outil de monitoring (UptimeRobot, Hetzner, BetterStack).

## Déploiement

```bash
./deploy.sh
# 1. git pull
# 2. pnpm install
# 3. cd web && pnpm build
# 4. pnpm migrate:up
# 5. pm2 reload ecosystem.config.cjs --env production
```

**Rollback déploiement** :
```bash
git checkout <commit-précédent>
./deploy.sh
pnpm migrate:rollback     # si une migration a été appliquée
```

## Backup

### Manuel

```bash
./backup.sh --rotate 7
ls -lh data/backups/
```

Utilise `sqlite3 .backup` (WAL-safe), fallback sur `cp` si `sqlite3` absent.

### Automatique

Cron PM2 dans `ecosystem.config.cjs` : tous les jours à 2h, rotation 7 jours.

## Restauration

**À tester en staging avant l'urgence.**

```bash
# 1. Stopper l'app
pm2 stop leadflow-web leadflow-worker

# 2. Sauvegarder la base courante (au cas où)
cp data/leads.db data/leads.db.before-restore.$(date +%s)
rm -f data/leads.db-wal data/leads.db-shm

# 3. Restaurer
cp data/backups/leads_YYYYMMDD_HHMMSS.db data/leads.db

# 4. Vérifier intégrité
sqlite3 data/leads.db 'PRAGMA integrity_check;'
# attendu: "ok"

# 5. Vérifier que les migrations sont à jour
pnpm migrate:status

# 6. Redémarrer
pm2 start leadflow-web leadflow-worker
curl http://localhost:3000/api/health
```

## Rotation des secrets

```bash
# 1. Nouveau mot de passe / clé
# 2. Mettre à jour .env (et le vault si configuré)
# 3. Redémarrer pour recharger l'env
pm2 restart leadflow-web leadflow-worker --update-env
```

Secrets actuels :
- `PAPPERS_API_KEY` — rotation via dashboard pappers.fr
- `ALLOWED_USERS` — édition manuelle dans `.env`

## Logs

```bash
pm2 logs leadflow-web --lines 200
pm2 logs leadflow-worker --lines 200
tail -f /var/log/nginx/leads.visibee.fr.access.log
tail -f /var/log/nginx/leads.visibee.fr.error.log
```

## Vérifs régulières

- [ ] Restauration backup testée en staging (trimestriel)
- [ ] `pnpm audit --prod` (mensuel — sinon Dependabot ouvre des PRs)
- [ ] Rotation `ALLOWED_USERS` (trimestriel)
- [ ] Vérifier que `data/backups/` a bien des fichiers récents (hebdo)
- [ ] `pm2 status` — pas de process en `errored`

## Incidents fréquents

### "Database is locked"

WAL mode rend rare ce cas. Si présent :
```bash
fuser data/leads.db          # identifier le processus
pm2 restart leadflow-worker  # libérer
```

### Web 502

```bash
pm2 status                   # leadflow-web up ?
pm2 logs leadflow-web        # stacktrace
curl http://127.0.0.1:3000/api/health
```

### Worker bloqué sur scrape

```bash
pm2 logs leadflow-worker | grep -i "blockReason\|error"
pm2 restart leadflow-worker
```
