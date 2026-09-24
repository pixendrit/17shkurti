# hijeshi-dashboard

Order desk for **Hijeshi Shqiptare**, a small t-shirt shop that sells through
Instagram, Messenger and TikTok DMs. Built for several people working from one
shared set of orders and stock.

It answers three questions:

1. **Who ordered what?** Name, phone, address, product, size, colour and design.
2. **Can I make it yet?** Is the blank shirt in stock and is the DTF transfer
   printed, or do I need to buy blanks or send artwork to the printer?
3. **Am I making money?** Revenue, cost, profit and what's still owed.

## What it covers

- **Orders** from Instagram, Messenger, TikTok, WhatsApp or direct, sales or
  influencer gifts, sent by courier or handed over in person, to Kosovo,
  Albania or North Macedonia. Customers are recognised by phone number.
- **The order process** is a fixed set of steps: new → in production → made
  (takes its shirts and prints from stock) → with the courier → delivered, or
  returned, or cancelled. Every step can be undone, one at a time.
- **Personalised prints**: an order with a custom print can't be saved without
  its front and back mockups, and can't be made until its own DTF has arrived.
- **Dërgesat**: hand a pile of parcels to the courier in one tap, mark them
  delivered or returned, and record the courier's payout.
- **Payments** are recorded as they come in (part payments too), so what's
  owed is always what was charged minus what was received.
- **Costs per shirt**, fixed when the order is taken: the blank, its share of a
  DTF sheet, labour, packaging and the courier. Changing a price in Settings
  never rewrites past profit.
- **Stock** is a ledger: buying blanks or DTF sheets, making an order, and
  counting the shelf each add a movement. Open orders are served first come,
  first served, so the last shirt is never promised twice.
- **Statistika**: where each euro of a shirt goes, profit after gifts and
  returns, money in versus money out, and sales by source, country, delivery,
  design, colour and garment.

## How it's built

Following *How to Design Programs*: data definitions first, then functions
that follow from them, each with its examples as tests. See
[docs/DESIGN.md](docs/DESIGN.md).

```
src/lib/domain/   the shop's rules, pure functions over plain data — no I/O
src/lib/server/   the shell: repo.ts loads the whole shop in ONE database round
                  trip and commits a command's changes in ONE atomic batch
src/routes/       pages: load = view(world); form actions = run a command
migrations/       the schema, with CHECK constraints for every data rule
```

SvelteKit 2 (Svelte 5) and Tailwind 4 on **Cloudflare Workers**, with a **D1**
(SQLite) database in Western Europe. Everyone signs in with the same 4-digit
code and sees the same data.

## Deploying

Free Cloudflare account, no card needed. Put these in the environment:

| Variable | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token: the "Edit Cloudflare Workers" template plus **Account → D1 → Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | shown on the Cloudflare dashboard home |
| `APP_PIN` | the 4-digit unlock code |

Then:

```bash
pnpm install
pnpm ship
```

`scripts/deploy.sh` creates the database and the `workers.dev` subdomain if they
don't exist yet, applies migrations, builds, deploys, sets the secrets and then
checks that the site answers. You can run it again safely: redeploys keep
`SESSION_SECRET`, so nobody gets logged out.

## Local development

```bash
pnpm install
cp .dev.vars.example .dev.vars   # APP_PIN and SESSION_SECRET for local use
pnpm db:migrate:local            # creates a local D1 database under .wrangler/
pnpm dev                         # or: pnpm preview, which runs the real Workers runtime
pnpm test                        # the domain's examples, and the repository against SQLite
pnpm check                       # types
```

A schema change is a new numbered file in `migrations/`.

## Security

A 4-digit code has only 10,000 combinations, so the lockout is what protects it:
after 5 wrong attempts, that IP is blocked for 15 minutes. The failed attempts
are counted in D1 rather than in memory, because Workers run in many short-lived
instances. Sessions are HMAC-signed cookies that last 30 days.

## Moving from the first version

`scripts/migrate-v1.ts` turned the first version's database (euros as
decimals, designs split into "X Black"/"X White", a stock count per row) into
this schema. It writes everything through the real repository into a fresh
database and checks the totals before producing SQL to load. **Keep database
exports and courier files out of this repository**: they hold customers'
names, phones and addresses, and the repository is public.

## Backups

D1 keeps its own point-in-time history, and **Backup** in the menu downloads the
whole shop (everything but the pictures) as one JSON file.
