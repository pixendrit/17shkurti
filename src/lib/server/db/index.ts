import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

/**
 * One client for every environment.
 *
 * - local / Docker: DATABASE_URL=file:./data/hijeshi.db  (a plain SQLite file)
 * - serverless:     DATABASE_URL=libsql://...  + DATABASE_AUTH_TOKEN
 *
 * Serverless filesystems are ephemeral, so a file: URL there would silently
 * lose every order. Hosted libSQL is what makes Vercel & friends viable.
 */
const url = env.DATABASE_URL || 'file:./data/hijeshi.db';

if (url.startsWith('file:')) {
	mkdirSync(dirname(url.slice('file:'.length)), { recursive: true });
}

const client = createClient({
	url,
	authToken: env.DATABASE_AUTH_TOKEN || undefined
});

export const db = drizzle(client, { schema });
export { schema, client };
