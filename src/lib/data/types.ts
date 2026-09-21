import type { SQLJsDatabase } from 'drizzle-orm/sql-js';
import type * as schema from './schema';

/**
 * The sql-js driver's relational `db.query.*.findFirst` returns a truthy
 * all-undefined object when nothing matches, instead of undefined. Every module
 * here therefore uses `select()` only, which behaves the same on every driver.
 */
export type DB = SQLJsDatabase<typeof schema>;
