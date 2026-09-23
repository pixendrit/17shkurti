import { asc } from 'drizzle-orm';
import { designs, dtfStock } from '$lib/data/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { db } }) => {
	const rows = await db.select().from(designs).orderBy(asc(designs.name));
	const stock = await db.select().from(dtfStock);
	const byDesign = new Map(stock.map((s) => [s.designId, s]));

	return {
		designs: rows.map((d) => ({
			...d,
			transfers: byDesign.get(d.id)?.quantity ?? 0,
			tracked: byDesign.has(d.id)
		}))
	};
};
