# hijeshi-dashboard

Order desk for **Hijeshi Shqiptare** — a small t-shirt shop selling through
Instagram, Messenger and TikTok DMs.

**Live: https://pixendrit.github.io/17shkurti/**

It answers the three questions DMs make hard to track:

1. **Who ordered what?** Name, phone, address, product, size, colour, design.
2. **Can I actually make it?** Do I have the blank shirt, and is the DTF transfer
   printed — or do I need to buy blanks and send artwork to the printer?
3. **Am I making money?** Revenue, cost, profit, and what's still owed.

## Where your data lives

**In your browser, and nowhere else.** SQLite is compiled to WebAssembly and runs
on the page; the database is saved into your browser's storage after every change.
Nothing is uploaded — there is no server and no account.

That has one consequence worth taking seriously:

> **Clearing your browser data deletes your orders.** They also don't follow you
> to another phone or laptop on their own.

So the app has **Backup** and **Restore** in the menu. Backup downloads the whole
database as one `.db` file; Restore loads it back, on this device or another one.
Do it regularly — after a busy day, say. Treat the backup file as the real copy.

The 4-digit code is a lock screen, not a security boundary: it stops someone
picking up an unlocked phone and reading the order book. Since the data never
leaves the device, there's no server-side secret to protect.

## How the stock logic works

Every order item needs two things: a **blank** (product + colour + size) and, if
it has artwork, a **DTF transfer** for that design.

- Orders are labelled **Can make** or **Missing stock** on the dashboard and list.
- The Stock page turns every open order into one **shopping list**: blanks to buy
  and designs to print. Demand is summed across all open orders first, then stock
  subtracted once — so one blank covering three orders isn't counted three times.
- **Mark as made** deducts blanks and transfers in one step and writes to an
  append-only `stock_log`. It runs once per order and refuses when stock is short.
- Transfers at the print shop are tracked as **on order**, so they count toward
  demand without pretending they're in the drawer.

## Stack

SvelteKit 2 (Svelte 5, runes) · Tailwind 4 · SQLite (WASM) via Drizzle ORM,
built as a static single-page app and deployed to GitHub Pages by
`.github/workflows/deploy.yml` on every push to `main`.

## Local development

```bash
pnpm install
pnpm dev
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Static build into `build/` |
| `pnpm check` | Type-check |

`BASE_PATH` sets the sub-path for project-site hosting; CI derives it from the
repo name, so renaming the repo keeps the deploy working.

## Wanting a real server instead?

An earlier version ran as a Node server with a proper database and Traefik config
for `hijeshi.dev.zhurma.fm`. It's kept at the `server-version` tag:

```bash
git checkout server-version
```

It needs somewhere to host it (Fly.io, a VPS, or Vercel + Turso) — that's the
trade: real hosting and multi-device data, versus this, which is free, private
and already running.
