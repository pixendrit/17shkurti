# hijeshi-dashboard

Order desk for **Hijeshi Shqiptare** — a small t-shirt shop that sells through
Instagram, Messenger and TikTok DMs.

It answers the three questions that DMs make hard to keep track of:

1. **Who ordered what?** Name, phone, address, product, size, colour, design.
2. **Can I actually make it?** Do I have the blank shirt, and do I have the DTF
   transfer printed — or do I need to buy blanks and send artwork to the printer?
3. **Am I making money?** Revenue, cost, profit, what's still owed.

## Stack

SvelteKit 2 (Svelte 5, runes) · Tailwind 4 · SQLite via Drizzle ORM ·
`adapter-node` in Docker behind Traefik.

SQLite is deliberate: one shop, one person, a few thousand orders a year. The
whole database is a single file you can copy as a backup.

## Running locally

```bash
pnpm install
cp .env.example .env      # then edit APP_PIN and SESSION_SECRET
pnpm db:migrate
pnpm db:seed              # optional demo data — WIPES the tables, dev only
pnpm dev
```

Open http://localhost:5173 and enter the 4-digit code from `.env`.

## How the stock logic works

Every order item needs two things: a **blank** (product + colour + size) and,
if it has artwork, a **DTF transfer** for that design.

- The order list and dashboard label each order **Can make** or **Missing stock**.
- The Stock page turns every open order into one **shopping list**: blanks to buy
  and designs to print. Demand is summed across all open orders first, then stock
  is subtracted once — so one blank covering three orders isn't counted three times.
- **Mark as made** deducts blanks and transfers in one step and writes the change
  to an append-only `stock_log`. It runs once per order and refuses when stock is
  short, so numbers can't drift.
- Transfers sent to the print shop are tracked separately as **on order**, so they
  count toward covering demand without pretending they're in the drawer yet.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Production build into `build/` |
| `pnpm start` | Run the production build |
| `pnpm check` | Type-check |
| `pnpm db:generate` | Generate a migration after editing the schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed` | Demo data — **deletes existing rows**, never run in production |

## Deploying

See **[DEPLOY.md](DEPLOY.md)**.

## Security note

A 4-digit PIN is 10 000 combinations, so the throttle is what actually protects
it: 5 wrong attempts locks that IP out for 15 minutes. Sessions are signed with
`SESSION_SECRET` (HMAC-SHA256) and last 30 days. This is sized for a private
single-operator tool — if the dashboard ever holds more than this shop's own
orders, move to a real password.
