import { and, eq } from 'drizzle-orm';
import { invalidateAll, goto } from '$app/navigation';
import { base } from '$app/paths';
import { getDb, persist } from './db';
import {
	blanks,
	designs,
	dtfStock,
	orderItems,
	orders,
	stockLog
} from '$lib/data/schema';
import { nextOrderCode } from '$lib/data/orders';
import { adjustStock, deductStockForOrder, orderReadiness } from '$lib/data/stock';

/** Every mutation goes through here so the database is always persisted after. */
async function write<T>(fn: (db: Awaited<ReturnType<typeof getDb>>) => Promise<T>): Promise<T> {
	const db = await getDb();
	const result = await fn(db);
	await persist();
	await invalidateAll();
	return result;
}

export type NewOrderInput = {
	customerName: string;
	phone: string;
	address?: string;
	city?: string;
	channel: string;
	paymentStatus: string;
	paymentMethod: string;
	shippingFee: number;
	discount: number;
	notes?: string;
	items: {
		productType: string;
		color: string;
		size: string;
		designId: number | null;
		quantity: number;
		unitPrice: number;
	}[];
};

export async function createOrder(input: NewOrderInput) {
	const id = await write(async (db) => {
		const code = await nextOrderCode(db);
		const ts = Math.floor(Date.now() / 1000);

		const [order] = await db
			.insert(orders)
			.values({
				code,
				customerName: input.customerName,
				phone: input.phone,
				address: input.address || null,
				city: input.city || null,
				channel: input.channel,
				status: 'new',
				paymentStatus: input.paymentStatus,
				paymentMethod: input.paymentMethod,
				shippingFee: input.shippingFee,
				discount: input.discount,
				notes: input.notes || null,
				createdAt: ts,
				updatedAt: ts
			})
			.returning();

		// Snapshot cost now, so profit stays right even if prices change later.
		for (const item of input.items) {
			const [blank] = await db
				.select()
				.from(blanks)
				.where(
					and(
						eq(blanks.productType, item.productType),
						eq(blanks.color, item.color),
						eq(blanks.size, item.size)
					)
				)
				.limit(1);

			let unitCost = blank?.unitCost ?? 0;
			if (item.designId) {
				const [dtf] = await db
					.select()
					.from(dtfStock)
					.where(eq(dtfStock.designId, item.designId))
					.limit(1);
				unitCost += dtf?.unitCost ?? 0;
			}
			await db.insert(orderItems).values({ ...item, orderId: order.id, unitCost });
		}
		return order.id;
	});

	await goto(`${base}/orders/${id}`);
}

export async function setOrderStatus(orderId: number, status: string) {
	const ts = Math.floor(Date.now() / 1000);
	await write((db) =>
		db
			.update(orders)
			.set({ status, updatedAt: ts, deliveredAt: status === 'delivered' ? ts : null })
			.where(eq(orders.id, orderId))
	);
}

export async function setPaymentStatus(orderId: number, paymentStatus: string) {
	await write((db) =>
		db
			.update(orders)
			.set({ paymentStatus, updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(orders.id, orderId))
	);
}

/** Take the blanks and transfers out of stock. Refuses when short. */
export async function markAsMade(orderId: number): Promise<string | null> {
	const db = await getDb();
	if (!(await orderReadiness(db, orderId)).ready) {
		return 'Not enough stock to make this order yet.';
	}
	await write(async (d) => {
		await deductStockForOrder(d, orderId);
		await d
			.update(orders)
			.set({ status: 'ready', updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(orders.id, orderId));
	});
	return null;
}

export async function deleteOrder(orderId: number) {
	await write(async (db) => {
		// sql.js honours foreign keys only when the pragma is on; delete children
		// explicitly so a stale pragma can never orphan rows.
		await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
		await db.delete(orders).where(eq(orders.id, orderId));
	});
	await goto(`${base}/orders`);
}

export async function changeStock(
	kind: 'blank' | 'dtf',
	refId: number,
	delta: number,
	reason = 'Manual adjustment'
) {
	await write((db) => adjustStock(db, kind, refId, delta, reason));
}

export async function addBlank(input: {
	productType: string;
	color: string;
	size: string;
	quantity: number;
	unitCost: number;
}): Promise<string | null> {
	const db = await getDb();
	const existing = (await db.select().from(blanks)).find(
		(b) =>
			b.productType === input.productType && b.color === input.color && b.size === input.size
	);
	if (existing) return 'That blank already exists.';
	await write((d) => d.insert(blanks).values(input));
	return null;
}

/**
 * Set the transfer count and cost for a design.
 *
 * Every design gets a stock row at zero the moment it is created, so this is
 * almost always an update rather than an insert — treat it as an upsert so the
 * form never dead-ends on "already exists".
 */
export async function setDtfStock(input: {
	designId: number;
	quantity: number;
	unitCost: number;
}): Promise<string | null> {
	const db = await getDb();
	const [existing] = await db
		.select()
		.from(dtfStock)
		.where(eq(dtfStock.designId, input.designId))
		.limit(1);

	if (existing) {
		const delta = input.quantity - existing.quantity;
		await write(async (d) => {
			await d
				.update(dtfStock)
				.set({ quantity: input.quantity, unitCost: input.unitCost })
				.where(eq(dtfStock.id, existing.id));
			// Keep the audit trail honest about the correction.
			if (delta !== 0) {
				await d.insert(stockLog).values({
					kind: 'dtf',
					refId: existing.id,
					delta,
					reason: 'Stock set manually'
				});
			}
		});
		return null;
	}

	await write((d) => d.insert(dtfStock).values(input));
	return null;
}

export async function setOnOrder(id: number, onOrder: number) {
	await write((db) =>
		db.update(dtfStock).set({ onOrder: Math.max(0, onOrder) }).where(eq(dtfStock.id, id))
	);
}

/** Transfers arrived: move them from on-order into real stock. */
export async function receiveDtf(id: number) {
	const db = await getDb();
	const [row] = await db.select().from(dtfStock).where(eq(dtfStock.id, id)).limit(1);
	if (!row || row.onOrder <= 0) return;
	await write(async (d) => {
		await adjustStock(d, 'dtf', id, row.onOrder, 'Print order received');
		await d.update(dtfStock).set({ onOrder: 0 }).where(eq(dtfStock.id, id));
	});
}

export async function createDesign(name: string, notes: string): Promise<string | null> {
	if (!name.trim()) return 'Give the design a name.';
	await write(async (db) => {
		const [design] = await db
			.insert(designs)
			.values({ name: name.trim(), notes: notes.trim() || null })
			.returning();
		// Start tracking its transfer stock straight away, at zero.
		await db.insert(dtfStock).values({ designId: design.id, quantity: 0 });
	});
	return null;
}

export async function toggleArchive(id: number) {
	const db = await getDb();
	const [current] = await db.select().from(designs).where(eq(designs.id, id)).limit(1);
	if (!current) return;
	await write((d) => d.update(designs).set({ archived: !current.archived }).where(eq(designs.id, id)));
}
