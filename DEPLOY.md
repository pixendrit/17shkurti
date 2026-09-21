# Deploying to hijeshi.dev.zhurma.fm

Traefik terminates TLS and proxies to the container on port 3000.

## Prerequisites

- Traefik already running, joined to an external Docker network (the compose file
  defaults to one called `traefik` — change `TRAEFIK_NETWORK` if yours differs).
- A DNS `A`/`CNAME` record for `hijeshi.dev.zhurma.fm` pointing at the host.
- A Traefik certificate resolver (the compose file defaults to `letsencrypt`).

## First deploy

```bash
git clone <this repo> hijeshi-dashboard
cd hijeshi-dashboard

cp .env.example .env
```

Edit `.env` and set at minimum:

```ini
APP_PIN=4071                                   # your own 4 digits
SESSION_SECRET=<openssl rand -hex 32>          # long random string
ORIGIN=https://hijeshi.dev.zhurma.fm
```

Then:

```bash
docker compose up -d --build
docker compose logs -f hijeshi
```

Migrations run automatically on container start, so the first boot creates the
schema. Open https://hijeshi.dev.zhurma.fm and enter your PIN.

## The two settings that actually break things

**`ORIGIN` must be the public https URL.** `adapter-node` compares it against the
`Origin` header on every form POST. If it's wrong or unset, the app loads fine but
every save returns `403 Cross-site POST form submissions are forbidden`.

**`TRAEFIK_NETWORK` must be the network Traefik is on.** If it isn't, Traefik never
sees the container and you get a 404 from Traefik rather than the app.

## Updating

```bash
git pull
docker compose up -d --build
```

## Backups

The entire database is one SQLite file in the `hijeshi-data` volume.

```bash
docker compose exec hijeshi \
  sh -c 'sqlite3 /app/data/hijeshi.db ".backup /app/data/backup.db"' \
  || docker compose cp hijeshi:/app/data/hijeshi.db ./hijeshi-backup.db
```

The simple version — copy the file out while the app is stopped:

```bash
docker compose stop hijeshi
docker compose cp hijeshi:/app/data/hijeshi.db ./hijeshi-$(date +%F).db
docker compose start hijeshi
```

The volume is pinned to the name `hijeshi-data`, so renaming the project folder
won't orphan your data.

## Running without Traefik

```bash
docker compose run --rm -p 3000:3000 \
  -e ORIGIN=http://localhost:3000 hijeshi
```
