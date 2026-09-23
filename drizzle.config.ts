import { defineConfig } from 'drizzle-kit';

// Only used to generate migration SQL; wrangler applies it to D1.
export default defineConfig({
	schema: './src/lib/data/schema.ts',
	out: './drizzle',
	dialect: 'sqlite'
});
