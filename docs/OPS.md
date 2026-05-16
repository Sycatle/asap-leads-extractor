# Ops runbook (Docker + Postgres)

## Topologie

```
nginx (host) ──▶ web (Docker)  ┐
                                ├──▶ postgres (Docker)
              worker (Docker)  ┘
```

Services Docker Compose :
- `postgres` — Postgres 17 alpine, volume `postgres_data`, healthcheck `pg_isready`
- `migrate` — one-shot, applique les migrations Drizzle (depends_on postgres healthy)
- `worker` — orchestrateur multi-pipelines (image Playwright officielle, mem_limit 1.5 Go)
- `web` — Next.js standalone (mem_limit 768 Mo, port 3000)

## Healthcheck

```bash
curl https://leads.visibee.fr/api/health
# {"status":"ok","totalLeads":1234,"timestamp":"..."}
```

Public (pas d'auth). À exposer à un monitoring externe (UptimeRobot, BetterStack, etc.).

## Déploiement

```bash
git pull
docker compose pull              # si images registry, sinon skip
docker compose up -d --build     # rebuild + restart rolling
docker compose ps                # vérifie healthy
```

Le service `migrate` applique automatiquement les migrations Drizzle pending avant que worker et web ne démarrent.

**Rollback** :
```bash
git checkout <commit-précédent>
docker compose up -d --build
# Si la migration doit être rollback, drizzle-kit n'a pas d'option `down` 
# automatique → exécuter manuellement le SQL inverse depuis db/migrations/
```

## Backup Postgres

```bash
# Dump complet (à exécuter via cron sur l'host)
docker compose exec -T postgres pg_dump -U leads -Fc leads > backups/leads_$(date +%Y%m%d_%H%M%S).dump

# Rotation : garder les N derniers
ls -1t backups/leads_*.dump | tail -n +8 | xargs -r rm
```

## Restauration

```bash
# 1. Stop apps qui écrivent
docker compose stop worker web

# 2. Backup courant (au cas où)
docker compose exec -T postgres pg_dump -U leads -Fc leads > backups/before-restore_$(date +%s).dump

# 3. Drop + recreate
docker compose exec postgres psql -U leads -c "DROP DATABASE leads;"
docker compose exec postgres psql -U leads -c "CREATE DATABASE leads;"

# 4. Restore
docker compose exec -T postgres pg_restore -U leads -d leads --no-owner --clean --if-exists < backups/leads_YYYYMMDD_HHMMSS.dump

# 5. Vérifier intégrité
docker compose exec postgres psql -U leads -d leads -c "SELECT count(*) FROM leads;"

# 6. Redémarrer
docker compose up -d worker web
curl http://localhost:3000/api/health
```

## Rotation des secrets

```bash
# 1. Nouveau mot de passe / clé dans .env
# 2. Redémarrer les services qui consomment l'env :
docker compose up -d --force-recreate worker web
```

Secrets gérés :
- `ANTHROPIC_API_KEY` — rotation via console.anthropic.com
- `PAPPERS_API_KEY` — rotation via pappers.fr
- `ALLOWED_USERS` — édition manuelle dans `.env`
- `POSTGRES_PASSWORD` — rotation = changer .env + `ALTER USER leads PASSWORD '...'` dans Postgres

## Logs

```bash
docker compose logs -f --tail=200 worker
docker compose logs -f --tail=200 web
docker compose logs -f --tail=200 postgres
```

Logs nginx (host) :
```bash
tail -f /var/log/nginx/leads.visibee.fr.access.log
tail -f /var/log/nginx/leads.visibee.fr.error.log
```

## Vérifs régulières

- [ ] `docker compose ps` — tous services healthy (trimestriel)
- [ ] Restauration backup testée en staging (trimestriel)
- [ ] `pnpm audit --prod` (mensuel — sinon Dependabot ouvre des PRs)
- [ ] Rotation `ALLOWED_USERS` (trimestriel)
- [ ] Vérifier `backups/leads_*.dump` récents (hebdo)

## Incidents fréquents

### "Database connection refused"

```bash
docker compose ps              # postgres healthy ?
docker compose logs postgres   # erreurs auth / volume ?
docker compose restart postgres
```

### Web 502 (depuis nginx)

```bash
docker compose ps              # web healthy ?
docker compose logs web        # stacktrace ?
docker compose exec web wget -qO- http://localhost:3000/api/health
```

### Worker bloqué sur une pipeline

```bash
docker compose logs worker | grep -i "blockReason\|error"
docker compose restart worker
```

### Migration pending au démarrage

Le service `migrate` est exécuté en mode one-shot avant worker/web. Si le démarrage bloque :
```bash
docker compose logs migrate
docker compose run --rm migrate pnpm migrate
```

## Nginx (host)

`nginx.conf` à la racine est la conf historique pour le reverse-proxy
(TLS Cloudflare origin + rate-limit + headers de sécurité). Avec Docker
Compose, faire pointer le `proxy_pass http://127.0.0.1:3000` sur le port
publié par le service `web`. Le reste de la conf (security headers,
limit_req_zone, gzip, cache `/_next/static`) reste valide.
