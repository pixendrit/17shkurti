import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// GitHub Pages serves a project site from /<repo>, so the app needs that prefix.
const raw = process.env.BASE_PATH ?? '';
const base = (raw === '' ? '' : raw.startsWith('/') ? raw : `/${raw}`) as '' | `/${string}`;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// A single-page app: every route is resolved in the browser, because
			// the database lives there too.
			adapter: adapter({ fallback: 'index.html', strict: false }),
			paths: { base, relative: false },
			appDir: 'app'
		})
	]
});
