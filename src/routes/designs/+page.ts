import { asc } from 'drizzle-orm';
import { getDb } from '$lib/client/db';
import { designs, dtfStock } from '$lib/data/schema';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const db = await getDb();
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
