import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Runs on Cloudflare Workers; the D1 database and secrets arrive on
			// `platform.env`. In `vite dev` they are emulated from wrangler.jsonc.
			adapter: adapter()
		})
	]
});
