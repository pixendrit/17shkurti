import { getDb } from '$lib/client/db';
import { shoppingList } from '$lib/data/stock';
import { asc } from 'drizzle-orm';
import { blanks, designs, dtfStock } from '$lib/data/schema';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const db = await getDb();
	const allDesigns = await db.select().from(designs);
	const designName = new Map(allDesigns.map((d) => [d.id, d.name]));

	const dtf = await db.select().from(dtfStock);
	const list = await shoppingList(db);

	return {
		blanks: await db
			.select()
			.from(blanks)
			.orderBy(asc(blanks.productType), asc(blanks.color), asc(blanks.size)),
		dtf: dtf.map((d) => ({ ...d, designName: designName.get(d.designId) ?? 'Unknown' })),
		designs: allDesigns.filter((d) => !d.archived),
		toBuy: list.blanks,
		toPrint: list.transfers.map((t) => ({ ...t, designName: designName.get(t.designId) ?? 'Unknown' }))
	};
};
