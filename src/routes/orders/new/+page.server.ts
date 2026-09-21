import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { blanks, designs, dtfStock, orderItems, orders } from '$lib/server/db/schema';
import { nextOrderCode } from '$lib/server/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		designs: await db.select().from(designs).where(eq(designs.archived, false)),
		code: await nextOrderCode()
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const f = await request.formData();

		const customerName = String(f.get('customerName') ?? '').trim();
		const phone = String(f.get('phone') ?? '').trim();

		if (!customerName) return fail(400, { error: 'Customer name is required.' });
		if (!phone) return fail(400, { error: 'Phone number is required.' });

		// Items arrive as parallel arrays from the repeatable rows in the form.
		const productTypes = f.getAll('productType').map(String);
		const colors = f.getAll('color').map(String);
		const sizes = f.getAll('size').map(String);
		const designIds = f.getAll('designId').map(String);
		const quantities = f.getAll('quantity').map((v) => Number(v) || 0);
		const prices = f.getAll('unitPrice').map((v) => Number(v) || 0);

		const rows = productTypes
			.map((pt, i) => ({
				productType: pt,
				color: colors[i] ?? '',
				size: sizes[i] ?? '',
				designId: designIds[i] ? Number(designIds[i]) : null,
				quantity: quantities[i] ?? 0,
				unitPrice: prices[i] ?? 0
			}))
			.filter((r) => r.productType && r.quantity > 0);

		if (rows.length === 0) return fail(400, { error: 'Add at least one item.' });

		const code = await nextOrderCode();
		const ts = Math.floor(Date.now() / 1000);

		const [order] = await db
			.insert(orders)
			.values({
				code,
				customerName,
				phone,
				address: String(f.get('address') ?? '').trim() || null,
				city: String(f.get('city') ?? '').trim() || null,
				channel: String(f.get('channel') ?? 'instagram'),
				status: String(f.get('status') ?? 'new'),
				paymentStatus: String(f.get('paymentStatus') ?? 'unpaid'),
				paymentMethod: String(f.get('paymentMethod') ?? 'cash_on_delivery'),
				shippingFee: Number(f.get('shippingFee')) || 0,
				discount: Number(f.get('discount')) || 0,
				notes: String(f.get('notes') ?? '').trim() || null,
				createdAt: ts,
				updatedAt: ts
			})
			.returning();

		// Snapshot unit cost now (blank + transfer) so profit stays correct later.
		for (const r of rows) {
			const blank = await db.query.blanks.findFirst({
				where: (b, { and, eq: e }) =>
					and(e(b.productType, r.productType), e(b.color, r.color), e(b.size, r.size))
			});
			let unitCost = blank?.unitCost ?? 0;
			if (r.designId) {
				const dtf = await db.query.dtfStock.findFirst({ where: eq(dtfStock.designId, r.designId) });
				unitCost += dtf?.unitCost ?? 0;
			}
			await db.insert(orderItems).values({ ...r, orderId: order.id, unitCost });
		}

		throw redirect(303, `/orders/${order.id}`);
	}
};
