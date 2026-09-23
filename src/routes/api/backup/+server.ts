import { blanks, designs, dtfStock, orderItems, orders, stockLog } from '$lib/data/schema';
import type { RequestHandler } from './$types';

/** Every table as one JSON file — a copy you hold yourself, on top of D1's own backups. */
export const GET: RequestHandler = async ({ locals: { db } }) => {
	const dump = {
		exportedAt: new Date().toISOString(),
		designs: await db.select().from(designs),
		blanks: await db.select().from(blanks),
		dtfStock: await db.select().from(dtfStock),
		orders: await db.select().from(orders),
		orderItems: await db.select().from(orderItems),
		stockLog: await db.select().from(stockLog)
	};
	return new Response(JSON.stringify(dump, null, 2), {
		headers: {
			'content-type': 'application/json',
			'content-disposition': `attachment; filename="hijeshi-${dump.exportedAt.slice(0, 10)}.json"`
		}
	});
};
