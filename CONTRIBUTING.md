# Contributing

Thanks for considering a contribution to **leads-finder**. This document covers everything you need to get a change merged.

By submitting a contribution you agree that it is licensed under [Apache 2.0](LICENSE).

## Getting set up

See the [README](README.md) for environment setup. TL;DR:

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env             # fill at least DATABASE_URL and ANTHROPIC_API_KEY
pnpm migrate
pnpm worker     # in one terminal
pnpm web        # in another
```

## Branch & commit conventions

- Branch from `main`. Name branches `<type>/<short-slug>` (e.g. `feat/sequence-pause`, `fix/inbox-pagination`).
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(scope): …`, `fix(scope): …`, `docs(scope): …`, `chore(scope): …`, `refactor(scope): …`, `test(scope): …`.
- Keep commits atomic and in English.

## Database changes

The schema lives in `db/schema.ts` and is the single source of truth. After editing it:

```bash
pnpm migrate:generate     # produces db/migrations/NNNN_*.sql
pnpm migrate              # apply locally
```

Commit both the schema edit and the generated SQL file in the same commit.

## Tests

Vitest runs against a real Postgres. The integration suite expects a database reachable at port `5434` (the default in `docker-compose.yml`).

```bash
pnpm test          # full run
pnpm test:watch    # watch mode
```

`vitest.config.ts` uses `fileParallelism: false` because the suite shares a single test database — keep it that way.

## Lint

```bash
pnpm lint
```

Both the root and `web/` packages are covered.

## Pull request checklist

Before requesting review:

- [ ] `pnpm lint` is clean.
- [ ] `pnpm test` passes locally.
- [ ] If you touched `db/schema.ts`, a generated migration is committed alongside.
- [ ] Public-facing changes (CLI flags, env vars, API routes) are reflected in `README.md` or relevant `docs/*.md`.
- [ ] Commits follow Conventional Commits.
- [ ] No secrets, fixtures with real customer data, or unrelated formatting noise.

Open the PR against `main` and fill in the template. Small, focused PRs get merged faster.

## Reporting issues

Use the bug report or feature request template under `.github/ISSUE_TEMPLATE/`. For security issues, **do not** open a public issue — see [SECURITY.md](SECURITY.md).

## Code of conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md). Please read it before participating.
