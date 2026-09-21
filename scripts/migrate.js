import { createClient } from '@libsql/client';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const url = process.env.DATABASE_URL || 'file:./data/hijeshi.db';
if (url.startsWith('file:')) mkdirSync(dirname(url.slice(5)), { recursive: true });

const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });

await db.execute('CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY, applied_at INTEGER)');
const { rows } = await db.execute('SELECT name FROM __migrations');
const applied = new Set(rows.map((r) => r.name));

let files;
try {
	files = readdirSync('./drizzle').filter((f) => f.endsWith('.sql')).sort();
} catch {
	console.error('No drizzle/ folder — run `pnpm db:generate` first.');
	process.exit(1);
}

let count = 0;
for (const file of files) {
	if (applied.has(file)) continue;
	const sql = readFileSync(join('./drizzle', file), 'utf8');
	const statements = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);

	// batch() is transactional, so a half-applied migration can't be recorded.
	await db.batch(
		[...statements, { sql: 'INSERT INTO __migrations (name, applied_at) VALUES (?, ?)', args: [file, Math.floor(Date.now() / 1000)] }],
		'write'
	);
	console.log(`applied ${file}`);
	count++;
}

console.log(count === 0 ? 'Database already up to date.' : `Applied ${count} migration(s).`);
