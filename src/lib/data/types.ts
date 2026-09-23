import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from './schema';

/**
 * Every module here uses `select()` rather than the relational
 * `db.query.*.findFirst` API: on some drivers findFirst returns a truthy
 * all-undefined object when nothing matches, and `select()` behaves the same
 * everywhere.
 */
export type DB = DrizzleD1Database<typeof schema>;
