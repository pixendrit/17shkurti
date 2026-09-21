import { eq } from 'drizzle-orm';
import { getDb } from '$lib/client/db';
import { nextOrderCode } from '$lib/data/orders';
import { designs } from '$lib/data/schema';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const db = await getDb();
	return {
		designs: await db.select().from(designs).where(eq(designs.archived, false)),
		code: await nextOrderCode(db)
	};
};
