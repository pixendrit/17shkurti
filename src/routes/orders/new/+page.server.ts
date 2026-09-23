import { eq } from 'drizzle-orm';
import { nextOrderCode } from '$lib/data/orders';
import { designs } from '$lib/data/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { db } }) => {
	return {
		designs: await db.select().from(designs).where(eq(designs.archived, false)),
		code: await nextOrderCode(db)
	};
};
