/**
 * Builders for examples: a valid record with sensible values, overridden by
 * what the example is about. Used by tests only.
 */
import type { Context, Customer, Design, Order, OrderLine, Print, Sku, World } from './model';
import { emptyWorld } from './model';

export const T0 = 1_780_000_000; // a fixed "now" for examples

export const sku = (over: Partial<Sku> = {}): Sku => ({
	garment: 'oversized_200g',
	color: 'black',
	size: 'M',
	...over
});

export const line = (over: Partial<OrderLine> = {}): OrderLine => ({
	id: 'L1',
	sku: sku(),
	artwork: { kind: 'print', printId: 'P-black' },
	quantity: 1,
	unitPrice: 2500,
	cost: { blank: 800, dtf: 300, labor: 200 },
	...over
});

export const order = (over: Partial<Order> = {}): Order => ({
	id: 'O1',
	code: 'HS-0001',
	customerId: 'C1',
	kind: 'sale',
	channel: 'instagram',
	delivery: { method: 'courier', cost: 250, trackingRef: '' },
	lines: [line()],
	packaging: 12,
	shippingCharged: 0,
	discount: 0,
	notes: '',
	status: 'new',
	stockTracked: true,
	isDemo: false,
	createdAt: T0,
	madeAt: null,
	handedOverAt: null,
	deliveredAt: null,
	returnedAt: null,
	cancelledAt: null,
	...over
});

export const customer = (over: Partial<Customer> = {}): Customer => ({
	id: 'C1',
	name: 'Arta Krasniqi',
	phone: '+38344111222',
	address: 'Rr. Nëna Terezë 1',
	city: 'Prishtinë',
	country: 'XK',
	...over
});

export const design = (over: Partial<Design> = {}): Design => ({
	id: 'D1',
	name: 'Shqiponja',
	notes: '',
	archived: false,
	createdAt: T0,
	...over
});

export const print = (over: Partial<Print> = {}): Print => ({
	id: 'P-black',
	designId: 'D1',
	shirtColor: 'black',
	perSheet: 4,
	front: null,
	back: null,
	...over
});

/** A shop with one design printed for black and white shirts, and one customer. */
export const world = (over: Partial<World> = {}): World => ({
	...emptyWorld(),
	designs: [design()],
	prints: [print(), print({ id: 'P-white', shirtColor: 'white' })],
	customers: [customer()],
	...over
});

/**
 * A context whose ids count up: id1, id2, … — from 1 for each context, so a
 * test's first ids are predictable; and a second context in the same test
 * can be given its own prefix so its ids don't collide.
 */
export function context(now = T0, prefix = 'id'): Context {
	let n = 0;
	return { now, newId: () => `${prefix}${++n}` };
}
