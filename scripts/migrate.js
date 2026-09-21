import Database from 'better-sqlite3';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const path = process.env.DATABASE_PATH || './data/hijeshi.db';
mkdirSync(dirname(path), { recursive: true });

const db = new Database(path);
db.pragma('journal_mode = WAL');
db.exec('CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY, applied_at INTEGER)');

const applied = new Set(db.prepare('SELECT name FROM __migrations').all().map((r) => r.name));
const dir = './drizzle';

let files = [];
try {
	files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
} catch {
	console.error('No drizzle/ folder — run `pnpm db:generate` first.');
	process.exit(1);
}

let count = 0;
for (const file of files) {
	if (applied.has(file)) continue;
	const sql = readFileSync(join(dir, file), 'utf8');
	// drizzle-kit separates statements with this marker
	const statements = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
	const run = db.transaction(() => {
		for (const s of statements) db.exec(s);
		db.prepare('INSERT INTO __migrations (name, applied_at) VALUES (?, ?)').run(
			file,
			Math.floor(Date.now() / 1000)
		);
	});
	run();
	console.log(`applied ${file}`);
	count++;
}

console.log(count === 0 ? 'Database already up to date.' : `Applied ${count} migration(s).`);
db.close();
