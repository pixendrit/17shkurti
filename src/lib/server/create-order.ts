import { eq, inArray } from 'drizzle-orm';
import {
	blanks,
	CHANNELS,
	COUNTRIES,
	DELIVERY_METHODS,
	designs,
	IMAGE_SIDES,
	ORDER_KINDS,
	ORDER_STATUSES,
	orderItemImages,
	orderItems,
	orders
} from '$lib/data/schema';
import { nextOrderCode } from '$lib/data/orders';
import { getSettings } from '$lib/data/settings';
import type { DB } from '$lib/data/types';

export type NewOrderItem = {
	productType: string;
	color: string;
	size: string;
	designId: number | null;
	quantity: number;
	unitPrice: number;
	isCustom?: boolean;
};

export type NewOrderInput = {
	kind: string;
	customerName: string;
	phone: string;
	address?: string;
	city?: string;
	country: string;
	channel: string;
	deliveryMethod: string;
	paymentStatus: string;
	paymentMethod: string;
	shippingFee: number;
	discount: number;
	/** Leave empty to use the courier price for the country from Settings. */
	shippingCost?: number | null;
	trackingRef?: string;
	notes?: string;
	items: NewOrderItem[];
};

/** Fields only the importer may set: history that happened before the app. */
export type ImportFields = {
	status?: string;
	createdAt?: number;
	shippedAt?: number | null;
	deliveredAt?: number | null;
	paidAt?: number | null;
	isDemo?: boolean;
	/** The shirts were made before the app existed: don't expect stock for them. */
	alreadyMade?: boolean;
};

export type ItemImage = { mime: string; data: string };
/** Mockups by item index: { 0: { front, back } }. */
export type ItemImages = Record<number, Partial<Record<'front' | 'back', ItemImage>>>;

const MIMES = ['image/webp', 'image/jpeg', 'image/png'];
const MAX_BASE64 = 950 * 1024;

const oneOf = <T extends string>(list: readonly T[], v: string, fallback: T): T =>
	(list as readonly string[]).includes(v) ? (v as T) : fallback;

/**
 * Create an order with its items and any personalised-print mockups.
 * Everything is validated before anything is written, so a rejected order
 * leaves nothing half-saved.
 */
export async function createOrder(
	db: DB,
	input: NewOrderInput,
	images: ItemImages = {},
	extra: ImportFields = {}
): Promise<{ error: string } | { id: number }> {
	const kind = oneOf(ORDER_KINDS, input.kind, 'sale');
	const name = input.customerName?.trim();
	const phone = input.phone?.trim();
	if (!name) return { error: 'Emri i klientit është i detyrueshëm.' };
	if (!phone) return { error: 'Numri i telefonit është i detyrueshëm.' };

	const items = (input.items ?? []).filter((i) => i && i.productType && i.quantity > 0);
	if (items.length === 0) return { error: 'Shtoni të paktën një artikull.' };

	for (const [idx, item] of items.entries()) {
		const n = idx + 1;
		if (!Number.isInteger(item.quantity)) return { error: `Artikulli ${n}: sasia duhet të jetë numër i plotë.` };
		if (kind === 'sale' && !(item.unitPrice > 0)) return { error: 'Vendosni çmimin për çdo artikull.' };
		if (item.isCustom) {
			const pics = images[idx] ?? {};
			if (!pics.front || !pics.back) {
				return { error: `Artikulli ${n} është i personalizuar: ngarkoni mockup-in para dhe pas.` };
			}
			for (const side of IMAGE_SIDES) {
				const pic = pics[side]!;
				if (!MIMES.includes(pic.mime)) return { error: 'Mockup-et duhet të jenë WebP, JPEG ose PNG.' };
				if (pic.data.length > MAX_BASE64) return { error: 'Një nga mockup-et është shumë i madh.' };
			}
		}
	}

	const s = await getSettings(db);
	const country = oneOf(COUNTRIES, input.country, 'XK');
	const deliveryMethod = oneOf(DELIVERY_METHODS, input.deliveryMethod, 'post');
	const shippingCost =
		input.shippingCost != null && input.shippingCost >= 0
			? input.shippingCost
			: deliveryMethod === 'post'
				? (s.postCost[country] ?? 0)
				: 0;

	// Per-shirt costs, snapshotted now so later price changes don't rewrite history.
	const designIds = [...new Set(items.map((i) => i.designId).filter((v): v is number => !!v))];
	const designRows = designIds.length
		? await db.select().from(designs).where(inArray(designs.id, designIds))
		: [];
	const perSheet = new Map(designRows.map((d) => [d.id, Math.max(1, d.shirtsPerSheet)]));
	const blankRows = await db.select().from(blanks);

	const ts = Math.floor(Date.now() / 1000);
	const createdAt = extra.createdAt ?? ts;
	const status = extra.status ? oneOf(ORDER_STATUSES, extra.status, 'new') : 'new';

	const [order] = await db
		.insert(orders)
		.values({
			code: await nextOrderCode(db),
			customerName: name,
			phone,
			address: input.address?.trim() || null,
			city: input.city?.trim() || null,
			country,
			channel: oneOf(CHANNELS, input.channel, 'other'),
			kind,
			deliveryMethod,
			status,
			paymentStatus: kind === 'gift' ? 'paid' : input.paymentStatus === 'paid' ? 'paid' : 'unpaid',
			paymentMethod: input.paymentMethod || 'cash_on_delivery',
			shippingFee: Math.max(0, input.shippingFee || 0),
			discount: Math.max(0, input.discount || 0),
			shippingCost,
			packagingCost: s.packagingPerOrder,
			trackingRef: input.trackingRef?.trim() || null,
			notes: input.notes?.trim() || null,
			createdAt,
			updatedAt: createdAt,
			shippedAt: extra.shippedAt ?? null,
			deliveredAt: extra.deliveredAt ?? null,
			paidAt: extra.paidAt ?? (kind === 'gift' ? null : input.paymentStatus === 'paid' ? createdAt : null),
			stockDeductedAt: extra.alreadyMade ? createdAt : null,
			isDemo: extra.isDemo ?? false
		})
		.returning();

	for (const [idx, item] of items.entries()) {
		const blank = blankRows.find(
			(b) => b.productType === item.productType && b.color === item.color && b.size === item.size
		);
		const blankCost = blank && blank.unitCost > 0 ? blank.unitCost : (s.blankCost[item.productType] ?? 0);
		const dtfCost = item.isCustom
			? s.dtfSheetPrice / Math.max(1, s.customShirtsPerSheet)
			: item.designId
				? s.dtfSheetPrice / (perSheet.get(item.designId) ?? 4)
				: 0;
		const laborCost = s.laborPerShirt;

		const [row] = await db
			.insert(orderItems)
			.values({
				orderId: order.id,
				productType: item.productType,
				color: item.color,
				size: item.size,
				designId: item.designId || null,
				quantity: item.quantity,
				unitPrice: kind === 'gift' ? 0 : item.unitPrice,
				blankCost,
				dtfCost,
				laborCost,
				unitCost: blankCost + dtfCost + laborCost,
				isCustom: !!item.isCustom,
				customPrintReady: !!item.isCustom && !!extra.alreadyMade
			})
			.returning({ id: orderItems.id });

		if (item.isCustom) {
			for (const side of IMAGE_SIDES) {
				const pic = images[idx][side]!;
				await db
					.insert(orderItemImages)
					.values({ itemId: row.id, side, mime: pic.mime, data: pic.data, updatedAt: createdAt });
			}
		}
	}

	return { id: order.id };
}

/** Courier references already in the database, so an import never adds a parcel twice. */
export async function existingTrackingRefs(db: DB): Promise<Set<string>> {
	const rows = await db.select({ ref: orders.trackingRef }).from(orders);
	return new Set(rows.map((r) => r.ref).filter((r): r is string => !!r));
}

export async function orderExists(db: DB, id: number) {
	const [row] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, id)).limit(1);
	return !!row;
}
