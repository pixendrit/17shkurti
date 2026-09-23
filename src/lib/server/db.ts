import { drizzle } from 'drizzle-orm/d1';
import * as schema from '$lib/data/schema';
import type { DB } from '$lib/data/types';

export function createDb(d1: D1Database): DB {
	return drizzle(d1, { schema });
}
