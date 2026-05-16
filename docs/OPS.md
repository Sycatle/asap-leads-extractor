# Ops runbook (Docker + Postgres)

## Topology

```
nginx (host) ──▶ web (Docker)  ┐
                                ├──▶ postgres (Docker)
              worker (Docker)  ┘
```

Docker Compose services:
- `postgres` — Postgres 17 alpine, volume `postgres_data`, healthcheck `pg_isready`.
- `migrate` — one-shot, applies Drizzle migrations (`depends_on: postgres healthy`).
- `worker` — multi-pipeline orchestrator (official Playwright image, `mem_limit: 1.5g`).
- `web` — Next.js standalone (`mem_limit: 768m`, port 3000).

## Healthcheck

```bash
curl http://localhost:3000/api/health
# → {"status":"ok","totalLeads":1234,"timestamp":"..."}
```

Public (no auth). Wire it to an external monitor (UptimeRobot, BetterStack, etc.). Replace `localhost:3000` with your public domain in production.

## Deployment

```bash
git pull
docker compose pull              # if using a registry, otherwise skip
docker compose up -d --build     # rebuild + rolling restart
docker compose ps                # check healthy
```

The `migrate` service applies pending Drizzle migrations automatically before `worker` and `web` start.

**Rollback:**
```bash
git checkout <previous-commit>
docker compose up -d --build
# drizzle-kit has no automatic `down` — to revert a migration,
# write and run the inverse SQL manually from db/migrations/.
# Test rollbacks in staging first.
```

## Backup (Postgres)

```bash
# Full dump (run via cron on the host)
docker compose exec -T postgres pg_dump -U leads -Fc leads > backups/leads_$(date +%Y%m%d_%H%M%S).dump

# Rotation: keep the last 7
ls -1t backups/leads_*.dump | tail -n +8 | xargs -r rm
```

## Restore

```bash
# 1. Stop writers
docker compose stop worker web

# 2. Snapshot the current state (just in case)
docker compose exec -T postgres pg_dump -U leads -Fc leads > backups/before-restore_$(date +%s).dump

# 3. Drop + recreate
docker compose exec postgres psql -U leads -c "DROP DATABASE leads;"
docker compose exec postgres psql -U leads -c "CREATE DATABASE leads;"

# 4. Restore
docker compose exec -T postgres pg_restore -U leads -d leads --no-owner --clean --if-exists < backups/leads_YYYYMMDD_HHMMSS.dump

# 5. Sanity check
docker compose exec postgres psql -U leads -d leads -c "SELECT count(*) FROM leads;"

# 6. Restart
docker compose up -d worker web
curl http://localhost:3000/api/health
```

## Secret rotation

```bash
# 1. Update the value in .env
# 2. Recreate the services that consume it:
docker compose up -d --force-recreate worker web
```

Managed secrets:
- `ANTHROPIC_API_KEY` — rotate via console.anthropic.com.
- `PAPPERS_API_KEY` — rotate via pappers.fr.
- `RESEND_API_KEY` — rotate via resend.com.
- `RESEND_WEBHOOK_SECRET` — rotate by re-creating the webhook in Resend (Svix).
- `UNSUB_TOKEN_SECRET` — rotating invalidates **all** outstanding unsub links; only rotate when needed.
- `ALLOWED_USERS` — edit `.env` manually.
- `POSTGRES_PASSWORD` — change `.env` then `ALTER USER leads PASSWORD '...'` inside Postgres.

## Cron schedule (worker CLI)

Run these as PM2 cron jobs, systemd timers, or host crontab against the container:

| Command | Frequency | Purpose |
|---|---|---|
| `pnpm cli sequence-tick` | every 1 minute | Send the next batch of due enrollments. |
| `pnpm cli sender-health` | daily 02:00 | Aggregate previous-day events into `sender_health_daily`, auto-pause unhealthy senders, send admin alerts. |
| `pnpm cli warmup-ramp` | daily 03:00 | Advance the daily limit of senders still in warmup; promote to `ready` at week 4. |
| `pnpm cli purge` | daily 04:00 | GDPR 3-year retention: soft-delete inactive contacts, add their emails to the suppression list. Add `--apply` to commit (dry-run by default). |

Example systemd timer (host):
```ini
# /etc/systemd/system/leads-sequence-tick.timer
[Unit]
Description=leads-finder sequence tick

[Timer]
OnCalendar=*:0/1
Persistent=true

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/leads-sequence-tick.service
[Unit]
Description=leads-finder sequence tick

[Service]
Type=oneshot
ExecStart=/usr/bin/docker compose -f /srv/leads-finder/docker-compose.yml exec -T worker pnpm cli sequence-tick
```

## Email outbound monitoring

After enabling outbound (Phase 1+), monitor:

- **`sender_health_daily.alertFlag = true`** — rows where the sender exceeded a threshold the previous day.
  ```sql
  SELECT sender_id, date, sent, bounce_rate_bps, complaint_rate_bps, open_rate_bps
  FROM sender_health_daily
  WHERE alert_flag = true
  ORDER BY date DESC LIMIT 20;
  ```
- **Default thresholds** (basis points = ×10000):
  - `bounce_rate_bps > 300` (3 %) → alert.
  - `complaint_rate_bps > 10` (0.1 %) → alert **and** auto-pause sender.
  - `open_rate_bps < 3000` (30 %) with `sent ≥ 5` → alert (likely deliverability problem).
- **`sender_accounts.warmup_status = 'paused'`** — auto-paused senders need manual triage before resuming.
- **`enrollments.status = 'error'`** with non-empty `last_error` — runner exceptions per enrollment.

A daily summary email is sent to `ADMIN_NOTIFY_EMAIL` when any row trips a threshold.

## GDPR retention

`pnpm cli purge` enforces the 3-year retention rule. Defaults:
- Selects contacts whose `last_contacted_at` (or `collected_at` if never contacted) is older than 3 years.
- Soft-deletes (`deleted_at`) and inserts the email into `suppression_list` with reason `gdpr_purge`.
- Dry-run by default. Pass `--apply` to commit. Pass `--years 2` to override the window.

```bash
# Preview
pnpm cli purge

# Apply
pnpm cli purge --apply
```

## Logs

```bash
docker compose logs -f --tail=200 worker
docker compose logs -f --tail=200 web
docker compose logs -f --tail=200 postgres
```

Host nginx logs (adjust the path to your domain):
```bash
tail -f /var/log/nginx/your-domain.access.log
tail -f /var/log/nginx/your-domain.error.log
```

## Periodic checks

- [ ] `docker compose ps` — all services healthy (quarterly).
- [ ] Backup restore tested in staging (quarterly).
- [ ] `pnpm audit --prod` (monthly — Dependabot opens PRs otherwise).
- [ ] `ALLOWED_USERS` rotation (quarterly).
- [ ] Recent `backups/leads_*.dump` present (weekly).
- [ ] `sender_health_daily.alertFlag` review (weekly while outbound is active).

## Common incidents

### "Database connection refused"

```bash
docker compose ps              # postgres healthy?
docker compose logs postgres   # auth / volume errors?
docker compose restart postgres
```

### Web 502 (from nginx)

```bash
docker compose ps              # web healthy?
docker compose logs web        # stacktrace?
docker compose exec web wget -qO- http://localhost:3000/api/health
```

### Worker stuck on a pipeline

```bash
docker compose logs worker | grep -i "blockReason\|error"
docker compose restart worker
```

### Migration pending at startup

The `migrate` service runs once before worker/web. If startup hangs:
```bash
docker compose logs migrate
docker compose run --rm migrate pnpm migrate
```

### Sender auto-paused

```bash
docker compose exec postgres psql -U leads -d leads \
  -c "SELECT id,email,warmup_status,daily_limit FROM sender_accounts WHERE warmup_status='paused';"
```
Investigate the previous-day `sender_health_daily` row, fix DNS / content issues, then:
```sql
UPDATE sender_accounts SET warmup_status='ready' WHERE id=$ID;
```

### Inbound webhook silent

- Check that the inbound provider (Postmark / Resend Inbound) is delivering to `/api/webhooks/inbound-email`.
- `lead_emails` rows with `direction='inbound'` and `handled=false` are visible in the dashboard inbox.
- Classifier failures don't drop the message (the row is stored unhandled and visible).

## Nginx (host)

`nginx.conf` at the repo root is the reference reverse-proxy config (TLS Cloudflare origin + rate-limit + security headers). With Docker Compose, point `proxy_pass http://127.0.0.1:3000` at the published port of the `web` service. The rest (security headers, `limit_req_zone`, gzip, `/_next/static` cache) stays valid.
