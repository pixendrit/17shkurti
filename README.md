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
  Albania or North Macedonia.
- **Personalised prints**: an order with a custom print can't be saved without
  its front and back mockups; it then needs its own DTF, tracked until it
  arrives.
- **Dërgesat**: hand several parcels to the courier in one tap, mark them
  delivered or returned, and settle them when the courier pays out.
- **Costs per order**, snapshotted when it's created: blank, DTF share
  (sheet price ÷ shirts per sheet), labour, packaging and courier fee. Changing
  a price in Settings never rewrites past profit.
- **Shpenzimet**: buying blanks adds them to stock at a weighted-average cost;
  buying DTF sheets adds their prints to stock.
- **Statistika**: where each euro of a shirt goes, profit after gifts and
  returns, money in versus money out, and sales by source, country, delivery
  method, design and colour.

## Stack

SvelteKit 2 (Svelte 5) and Tailwind 4, running on **Cloudflare Workers** with a
**D1** (SQLite) database through Drizzle ORM. Everyone signs in with the same
4-digit code and sees the same data in real time.

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
```

After changing `src/lib/data/schema.ts`, run `pnpm db:generate` to write a new
migration into `drizzle/`.

## How the stock logic works

Each order item needs a **blank** (product, colour and size) and, if it has
artwork, a **DTF transfer** for that design.

- Orders show **Can make** or **Missing stock** on the dashboard and order list.
- The Stock page turns all open orders into one **shopping list** of blanks to
  buy and designs to print. It adds up demand across every open order first and
  subtracts stock once, so one blank covering three orders isn't counted three
  times.
- **Mark as made** takes the blanks and transfers out of stock in one step and
  records it in an append-only `stock_log`. It runs once per order and refuses
  if stock is short.
- Transfers still at the print shop are tracked as **on order**. They count
  toward demand but aren't treated as stock you have.

## Security

A 4-digit code has only 10,000 combinations, so the lockout is what protects it:
after 5 wrong attempts, that IP is blocked for 15 minutes. The failed attempts
are counted in D1 rather than in memory, because Workers run in many short-lived
instances. Sessions are HMAC-signed cookies that last 30 days.

## Importing history and demo data

`POST /api/import` takes orders and expenses in bulk, through the same code the
app uses, so costs come out identical. Parcels already stored (matched by the
courier's reference) are skipped, and demo data is only ever added once.

`scripts/demo-data.mjs` builds such a payload: demo orders and expenses marked
as demo (removable in one go from Settings), plus, optionally, real parcels
from a courier export. **Keep courier exports out of this repository**: they
hold customers' names, phones and addresses, and the repository is public.

## Backups

D1 keeps its own point-in-time history, and **Backup** in the menu downloads every
table as a JSON file.
