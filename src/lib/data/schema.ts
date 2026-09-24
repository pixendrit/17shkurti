import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text, real, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';

const now = sql`(unixepoch())`;

/** Artwork that gets printed onto a blank garment. */
export const designs = sqliteTable('designs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	notes: text('notes'),
	archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
	/**
	 * How many shirts' worth of this design (front + back) fit on one DTF
	 * sheet. The DTF cost of one shirt is the sheet price divided by this.
	 */
	shirtsPerSheet: integer('shirts_per_sheet').notNull().default(4),
	createdAt: integer('created_at').notNull().default(now)
});

/**
 * Blank garment stock, keyed by the three things that make a blank unique:
 * what it is, what colour, what size.
 */
export const blanks = sqliteTable(
	'blanks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		productType: text('product_type').notNull(),
		color: text('color').notNull(),
		size: text('size').notNull(),
		quantity: integer('quantity').notNull().default(0),
		unitCost: real('unit_cost').notNull().default(0),
		lowStockAt: integer('low_stock_at').notNull().default(2)
	},
	(t) => [uniqueIndex('blanks_variant_idx').on(t.productType, t.color, t.size)]
);

/** DTF transfer film stock, one row per design. */
export const dtfStock = sqliteTable(
	'dtf_stock',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		designId: integer('design_id')
			.notNull()
			.references(() => designs.id, { onDelete: 'cascade' }),
		quantity: integer('quantity').notNull().default(0),
		unitCost: real('unit_cost').notNull().default(0),
		lowStockAt: integer('low_stock_at').notNull().default(2),
		/** Set when prints have been sent to the print shop but haven't arrived. */
		onOrder: integer('on_order').notNull().default(0)
	},
	(t) => [uniqueIndex('dtf_design_idx').on(t.designId)]
);

/**
 * new → in_production → ready (packed; for courier orders: waiting for the
 * courier to pick it up) → shipped (handed to the courier) → delivered.
 * returned: the courier brought it back. Hand deliveries skip `shipped`.
 */
export const ORDER_STATUSES = [
	'new',
	'in_production',
	'ready',
	'shipped',
	'delivered',
	'returned',
	'cancelled'
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CHANNELS = ['instagram', 'messenger', 'tiktok', 'whatsapp', 'direct', 'other'] as const;
export type Channel = (typeof CHANNELS)[number];

export const PAYMENT_STATUSES = ['unpaid', 'paid'] as const;
export const PAYMENT_METHODS = ['cash_on_delivery', 'bank_transfer', 'cash'] as const;

/** sale: a normal order. gift: sent free to an influencer — a marketing cost. */
export const ORDER_KINDS = ['sale', 'gift'] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

/** post: through the courier. manual: handed over in person. */
export const DELIVERY_METHODS = ['post', 'manual'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const COUNTRIES = ['XK', 'AL', 'MK', 'OTHER'] as const;
export type Country = (typeof COUNTRIES)[number];

export const orders = sqliteTable(
	'orders',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Human-facing reference, e.g. HS-0042. */
		code: text('code').notNull(),
		customerName: text('customer_name').notNull(),
		phone: text('phone').notNull(),
		address: text('address'),
		city: text('city'),
		channel: text('channel').notNull().default('instagram'),
		status: text('status').notNull().default('new'),
		paymentStatus: text('payment_status').notNull().default('unpaid'),
		paymentMethod: text('payment_method').notNull().default('cash_on_delivery'),
		/** What the customer pays for shipping — usually 0, shipping is free. */
		shippingFee: real('shipping_fee').notNull().default(0),
		discount: real('discount').notNull().default(0),
		notes: text('notes'),
		kind: text('kind').notNull().default('sale'),
		deliveryMethod: text('delivery_method').notNull().default('post'),
		country: text('country').notNull().default('XK'),
		/** What the shop pays the courier for this parcel. */
		shippingCost: real('shipping_cost').notNull().default(0),
		packagingCost: real('packaging_cost').notNull().default(0),
		/** The courier's own reference for the parcel. */
		trackingRef: text('tracking_ref'),
		/** Handed to the courier (or, for hand deliveries, handed over). */
		shippedAt: integer('shipped_at'),
		/** When the money arrived — from the courier's settlement, or in hand. */
		paidAt: integer('paid_at'),
		/** Sample data, removable in one go from Settings. */
		isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
		/** Set once the blanks and transfers for this order have been deducted from stock. */
		stockDeductedAt: integer('stock_deducted_at'),
		createdAt: integer('created_at').notNull().default(now),
		updatedAt: integer('updated_at').notNull().default(now),
		deliveredAt: integer('delivered_at')
	},
	(t) => [
		uniqueIndex('orders_code_idx').on(t.code),
		index('orders_status_idx').on(t.status),
		index('orders_phone_idx').on(t.phone),
		index('orders_tracking_idx').on(t.trackingRef)
	]
);

export const orderItems = sqliteTable(
	'order_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		productType: text('product_type').notNull(),
		color: text('color').notNull(),
		size: text('size').notNull(),
		designId: integer('design_id').references(() => designs.id, { onDelete: 'set null' }),
		quantity: integer('quantity').notNull().default(1),
		unitPrice: real('unit_price').notNull().default(0),
		/**
		 * Per-shirt costs snapshotted when the order is created, so changing a
		 * price in Settings later never rewrites past profit. unitCost is their sum.
		 */
		unitCost: real('unit_cost').notNull().default(0),
		blankCost: real('blank_cost').notNull().default(0),
		dtfCost: real('dtf_cost').notNull().default(0),
		laborCost: real('labor_cost').notNull().default(0),
		/** A personalised print: needs its own DTF and front/back mockups. */
		isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
		/** The personalised DTF print has arrived from the printer. */
		customPrintReady: integer('custom_print_ready', { mode: 'boolean' }).notNull().default(false)
	},
	(t) => [index('order_items_order_idx').on(t.orderId)]
);

/** Append-only audit of every stock change, so numbers can always be explained. */
export const stockLog = sqliteTable('stock_log', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	kind: text('kind').notNull(), // 'blank' | 'dtf'
	refId: integer('ref_id').notNull(),
	delta: integer('delta').notNull(),
	reason: text('reason').notNull(),
	orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull().default(now)
});

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const EXPENSE_CATEGORIES = ['blanks', 'dtf', 'packaging', 'marketing', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Money that went out: blank shirts, DTF sheets, packaging, ads… */
export const expenses = sqliteTable(
	'expenses',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		date: integer('date').notNull(),
		category: text('category').notNull(),
		description: text('description'),
		/** Pieces or sheets bought, when that makes sense. */
		quantity: real('quantity'),
		/** Total paid, in euro. */
		amount: real('amount').notNull(),
		isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [index('expenses_date_idx').on(t.date)]
);

/** Front/back mockups of a personalised print, attached to an order item. */
export const orderItemImages = sqliteTable(
	'order_item_images',
	{
		itemId: integer('item_id')
			.notNull()
			.references(() => orderItems.id, { onDelete: 'cascade' }),
		side: text('side').notNull(),
		mime: text('mime').notNull(),
		data: text('data').notNull(),
		updatedAt: integer('updated_at').notNull().default(now)
	},
	(t) => [primaryKey({ columns: [t.itemId, t.side] })]
);

export type Design = typeof designs.$inferSelect;
export type Blank = typeof blanks.$inferSelect;
export type DtfStock = typeof dtfStock.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Expense = typeof expenses.$inferSelect;

export const designsRelations = relations(designs, ({ one, many }) => ({
	dtf: one(dtfStock, { fields: [designs.id], references: [dtfStock.designId] }),
	items: many(orderItems)
}));

export const dtfStockRelations = relations(dtfStock, ({ one }) => ({
	design: one(designs, { fields: [dtfStock.designId], references: [designs.id] })
}));

export const ordersRelations = relations(orders, ({ many }) => ({
	items: many(orderItems)
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
	order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
	design: one(designs, { fields: [orderItems.designId], references: [designs.id] })
}));

/**
 * Front and back pictures of a design, as base64. Kept in D1 rather than R2
 * because R2 needs a card on file even on the free tier. Images are shrunk in
 * the browser before upload (see $lib/client/image.ts), so each is ~50-150 KB.
 * Kept out of `designs` so listing designs never drags image data along.
 */
export const designImages = sqliteTable(
	'design_images',
	{
		designId: integer('design_id')
			.notNull()
			.references(() => designs.id, { onDelete: 'cascade' }),
		side: text('side').notNull(), // 'front' | 'back'
		mime: text('mime').notNull(),
		data: text('data').notNull(),
		updatedAt: integer('updated_at').notNull().default(now)
	},
	(t) => [primaryKey({ columns: [t.designId, t.side] })]
);

export const IMAGE_SIDES = ['front', 'back'] as const;
export type ImageSide = (typeof IMAGE_SIDES)[number];

/**
 * Failed PIN attempts per IP. Kept in the database rather than in memory
 * because Workers run many short-lived isolates, so a memory counter would
 * reset constantly and never actually throttle anything.
 */
export const loginAttempts = sqliteTable('login_attempts', {
	ip: text('ip').primaryKey(),
	count: integer('count').notNull().default(0),
	lockedUntil: integer('locked_until').notNull().default(0)
});
