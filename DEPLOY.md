# Deploying

Pick one. **Fly.io is the least work** — the SQLite file lives on a real disk, so
there's no second service to sign up for.

Whichever you pick, set these two secrets:

| Variable | Value |
| --- | --- |
| `APP_PIN` | your 4 digits |
| `SESSION_SECRET` | `openssl rand -hex 32` |

---

## Option 1 — Fly.io (recommended, one signup)

```bash
# one-time
curl -L https://fly.io/install.sh | sh
fly auth signup            # or: fly auth login

cd hijeshi-dashboard
fly launch --no-deploy --copy-config --name hijeshi-dashboard
fly volumes create hijeshi_data --size 1 --region cdg

fly secrets set APP_PIN=4071 SESSION_SECRET=$(openssl rand -hex 32)
fly deploy
```

`fly.toml` already mounts the volume at `/app/data` and migrations run on boot.
Your app lands on `https://hijeshi-dashboard.fly.dev`.

**Keep it to one machine.** A SQLite file on a volume can't be shared between
machines — `min_machines_running = 1` and no scaling out.

---

## Option 2 — Vercel (two signups: Vercel + Turso)

Vercel is serverless: the filesystem is wiped between invocations, so a local
SQLite file would silently lose every order. You need hosted libSQL.

```bash
# 1. database
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup
turso db create hijeshi
turso db show hijeshi --url          # -> libsql://hijeshi-<org>.turso.io
turso db tokens create hijeshi       # -> the auth token

# 2. app
npm i -g vercel
vercel link
vercel env add APP_PIN production
vercel env add SESSION_SECRET production
vercel env add DATABASE_URL production        # the libsql:// URL
vercel env add DATABASE_AUTH_TOKEN production # the token
vercel --prod
```

The build runs `vercel-build`, which applies migrations to Turso before building,
so the schema is in place on first deploy. `ORIGIN` is not needed — Vercel sets it.

---

## Option 3 — Your own server, behind Traefik, at hijeshi.dev.zhurma.fm

Traefik terminates TLS and proxies to the container on port 3000.

**Prerequisites:** Traefik running on an external Docker network (default name
`traefik`), a DNS record for `hijeshi.dev.zhurma.fm`, and a cert resolver
(default `letsencrypt`).

```bash
git clone https://github.com/pixendrit/17shkurti hijeshi-dashboard
cd hijeshi-dashboard
cp .env.example .env     # set APP_PIN, SESSION_SECRET, ORIGIN
docker compose up -d --build
docker compose logs -f hijeshi
```

### The two settings that actually break things

**`ORIGIN` must be the public https URL.** `adapter-node` compares it against the
`Origin` header on every form POST. Wrong or unset and the app loads fine but every
save returns `403 Cross-site POST form submissions are forbidden`.

**`TRAEFIK_NETWORK` must be the network Traefik is on.** Otherwise Traefik never
sees the container and you get its 404 instead of the app.

---

## Backups

The whole database is one SQLite file.

**Fly:**
```bash
fly ssh console -C "cat /app/data/hijeshi.db" > hijeshi-$(date +%F).db
```

**Docker:**
```bash
docker compose stop hijeshi
docker compose cp hijeshi:/app/data/hijeshi.db ./hijeshi-$(date +%F).db
docker compose start hijeshi
```
The volume is pinned to the name `hijeshi-data`, so renaming the project folder
won't orphan your data.

**Turso:** `turso db shell hijeshi .dump > hijeshi-$(date +%F).sql`
