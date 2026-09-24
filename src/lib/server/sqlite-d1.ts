/**
 * A stand-in for Cloudflare D1 over Node's built-in SQLite, for tests and
 * scripts. Covers what the app uses: prepare/bind/all/first/run and batch,
 * which runs as one transaction like D1's.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type Value = string | number | null;

class Statement {
	constructor(
		private db: DatabaseSync,
		readonly sql: string,
		readonly params: Value[] = []
	) {}
	bind(...params: Value[]) {
		return new Statement(this.db, this.sql, params);
	}
	async all<T>() {
		return { results: this.db.prepare(this.sql).all(...this.params) as T[], success: true };
	}
	async first<T>() {
		return (this.db.prepare(this.sql).get(...this.params) as T) ?? null;
	}
	async run() {
		this.db.prepare(this.sql).run(...this.params);
		return { success: true };
	}
	/** Runs the statement now; reads return rows, writes return none. */
	exec() {
		const st = this.db.prepare(this.sql);
		return /^\s*select/i.test(this.sql) ? st.all(...this.params) : (st.run(...this.params), []);
	}
}

export function sqliteD1(file = ':memory:') {
	const db = new DatabaseSync(file);
	db.exec('PRAGMA foreign_keys = ON');
	const d1 = {
		raw: db,
		prepare: (sql: string) => new Statement(db, sql),
		async batch(stmts: Statement[]) {
			db.exec('BEGIN');
			try {
				const out = stmts.map((s) => ({ results: s.exec(), success: true }));
				db.exec('COMMIT');
				return out;
			} catch (e) {
				db.exec('ROLLBACK');
				throw e;
			}
		},
		/** Applies every migration in the folder, in name order. */
		migrate(dir = 'migrations') {
			for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort())
				db.exec(readFileSync(join(dir, f), 'utf8'));
			return d1;
		}
	};
	return d1;
}

/** asD1 : the stand-in, typed as the D1Database the app expects. */
export const asD1 = (x: ReturnType<typeof sqliteD1>) => x as unknown as D1Database;
