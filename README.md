# hijeshi-dashboard

A dashboard built with [SvelteKit](https://svelte.dev/docs/kit), Svelte 5 and [Tailwind CSS](https://tailwindcss.com).

## Getting started

```bash
pnpm install
pnpm dev
```

## Scripts

| Command        | Description                                  |
| -------------- | -------------------------------------------- |
| `pnpm dev`     | Start the dev server                         |
| `pnpm build`   | Build for production                         |
| `pnpm preview` | Preview the production build locally         |
| `pnpm check`   | Type-check the project with `svelte-check`   |

## Deployment

The project uses [`adapter-auto`](https://svelte.dev/docs/kit/adapter-auto), which picks an adapter
based on the deployment platform it detects. If you settle on a specific host, swap it for that
platform's adapter in `vite.config.ts`.
