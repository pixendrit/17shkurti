import initSqlJs, { type Database } from 'sql.js';
import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import * as schema from '$lib/data/schema';
import { base } from '$app/paths';

/**
 * The whole database lives in this browser.
 *
 * SQLite is compiled to WebAssembly and kept in memory; after every write the
 * full file is serialised into IndexedDB. The database is small (a few thousand
 * orders is well under a megabyte), so rewriting it wholesale is simpler and
 * safer than trying to journal changes, and it makes "export a backup" the same
 * bytes we already hold.
 *
 * Nothing is ever uploaded: the orders never leave the device.
 */

const DB_NAME = 'hijeshi';
const STORE = 'files';
const KEY = 'db';

let sqlDb: Database | null = null;
let orm: SQLJsDatabase<typeof schema> | null = null;

function idb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function loadBytes(): Promise<Uint8Array | null> {
	const db = await idb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
		tx.onsuccess = () => resolve(tx.result ? new Uint8Array(tx.result) : null);
		tx.onerror = () => reject(tx.error);
	});
}

async function saveBytes(bytes: Uint8Array): Promise<void> {
	const db = await idb();
	return new Promise((resolve, reject) => {
		// Store a plain ArrayBuffer — structured clone handles it everywhere.
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(bytes.buffer.slice(0), KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/** Persist the current in-memory database. Call after every write. */
export async function persist(): Promise<void> {
	if (!sqlDb) return;
	await saveBytes(sqlDb.export());
}

let ready: Promise<SQLJsDatabase<typeof schema>> | null = null;

export function getDb(): Promise<SQLJsDatabase<typeof schema>> {
	ready ??= (async () => {
		const SQL = await initSqlJs({ locateFile: () => `${base}/sql-wasm.wasm` });

		const existing = await loadBytes();
		sqlDb = existing ? new SQL.Database(existing) : new SQL.Database();
		sqlDb.run('PRAGMA foreign_keys = ON');

		orm = drizzle(sqlDb, { schema });

		if (!existing) {
			await applySchema();
			await persist();
		}
		return orm;
	})();
	return ready;
}

/** Create the tables on a first run, from the same migration the server uses. */
async function applySchema() {
	const res = await fetch(`${base}/schema.sql`);
	if (!res.ok) throw new Error('Could not load schema.sql');
	const sql = await res.text();
	for (const stmt of sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)) {
		sqlDb!.run(stmt);
	}
}

/** Download the database file — this is the backup. */
export async function exportDb(): Promise<Blob> {
	const db = await getDb();
	void db;
	return new Blob([sqlDb!.export() as BlobPart], { type: 'application/x-sqlite3' });
}

/** Replace everything with a previously exported file. */
export async function importDb(file: File): Promise<void> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const SQL = await initSqlJs({ locateFile: () => `${base}/sql-wasm.wasm` });
	// Fail before destroying anything if the file isn't a usable database.
	const candidate = new SQL.Database(bytes);
	candidate.exec('SELECT count(*) FROM orders');

	sqlDb = candidate;
	sqlDb.run('PRAGMA foreign_keys = ON');
	orm = drizzle(sqlDb, { schema });
	ready = Promise.resolve(orm);
	await persist();
}

/** Throw the local database away and start clean. */
export async function resetDb(): Promise<void> {
	const db = await idb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).delete(KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	sqlDb = null;
	orm = null;
	ready = null;
}
