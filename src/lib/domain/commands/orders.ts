/**
 * Commands on orders: taking one, fixing it, moving it along, getting paid.
 */
import { balance, deliveryCost, lineCost } from '../economics';
import { formatEuro, sum, type Cents } from '../money';
import {
	CHANNELS,
	COUNTRIES,
	ORDER_KINDS,
	PAYMENT_METHODS,
	type Change,
	type Channel,
	type Context,
	type Country,
	type Customer,
	type Delivery,
	type DeliveryMethod,
	type Id,
	type Movement,
	type Order,
	type OrderEvent,
	type OrderKind,
	type OrderLine,
	type PaymentMethod,
	type Sku,
	type Upload,
	type World
} from '../model';
import { COLOR_LABELS, EVENT_LABELS, subjectLabel } from '../labels';
import { step } from '../process';
import { fail, ok, type Result } from '../result';
import { needs, onHand, shortfall, subjectKey } from '../stock';
import type { Instant } from '../time';
import { apply, customerByPhone, findCustomer, findOrder, nextCode } from '../world';
import { isAmount, isCount, storeImage } from './common';

// ---- Inputs -----------------------------------------------------------------

/** CustomerInput: who the order is for, as typed on the form. */
export type CustomerInput = { name: string; phone: string; address: string; city: string; country: Country };

/**
 * ArtworkInput: what to print, as chosen on the form.
 *   design: a catalogue design; the print follows from the shirt colour
 *   custom: personalised, with its two mockups
 */
export type ArtworkInput =
	| { kind: 'none' }
	| { kind: 'design'; designId: Id }
	| { kind: 'custom'; front: Upload | null; back: Upload | null };

export type LineInput = { sku: Sku; artwork: ArtworkInput; quantity: number; unitPrice: Cents };

/** DeliveryInput: cost null means "the usual price" from Settings. */
export type DeliveryInput = { method: DeliveryMethod; cost: Cents | null; trackingRef: string };

export type NewOrder = {
	customer: CustomerInput;
	kind: OrderKind;
	channel: Channel;
	delivery: DeliveryInput;
	lines: LineInput[];
	shippingCharged: Cents;
	discount: Cents;
	notes: string;
	/** Paid in full when the order was taken, and how. */
	paidWith: PaymentMethod | null;
};

// ---- Customers --------------------------------------------------------------

/**
 * checkCustomer : CustomerInput -> Result<CustomerInput> — trimmed, with what's required.
 */
function checkCustomer(c: CustomerInput): Result<CustomerInput> {
	const t = { ...c, name: c.name.trim(), phone: c.phone.trim(), address: c.address.trim(), city: c.city.trim() };
	if (!t.name) return fail('Emri i klientit është i detyrueshëm.');
	if (!t.phone) return fail('Numri i telefonit është i detyrueshëm.');
	if (!(COUNTRIES as readonly string[]).includes(t.country)) return fail('Shteti i panjohur.');
	return ok(t);
}

/**
 * resolveCustomer : World CustomerInput (Customer or null) Context -> [Customer, [Change]]
 * The customer an order belongs to: the one with this phone number, brought
 * up to date; else the current one with the new details (an edited order);
 * else someone new.
 */
function resolveCustomer(
	w: World,
	input: CustomerInput,
	current: Customer | null,
	ctx: Context
): [Customer, Change[]] {
	const base = customerByPhone(w, input.phone) ?? current;
	const next: Customer = { id: base?.id ?? ctx.newId(), ...input };
	const same = base && JSON.stringify(base) === JSON.stringify(next);
	return [next, same ? [] : [{ put: 'customer', value: next }]];
}

// ---- Taking an order --------------------------------------------------------

const MAX_LINES = 50;

/**
 * createOrder : World NewOrder Context -> Result<[Change]>
 * Takes an order. Everything is checked before anything is decided, so a
 * refused order leaves nothing behind. Each shirt's cost is fixed now.
 */
export function createOrder(w: World, input: NewOrder, ctx: Context): Result<Change[]> {
	const who = checkCustomer(input.customer);
	if (!who.ok) return who;
	if (!(ORDER_KINDS as readonly string[]).includes(input.kind)) return fail('Lloji i porosisë i panjohur.');
	if (!(CHANNELS as readonly string[]).includes(input.channel)) return fail('Burimi i panjohur.');
	if (input.lines.length === 0) return fail('Shtoni të paktën një artikull.');
	if (input.lines.length > MAX_LINES) return fail('Shumë artikuj në një porosi.');
	const gift = input.kind === 'gift';
	if (!isAmount(input.shippingCharged) || !isAmount(input.discount)) return fail('Shumat nuk janë të sakta.');

	const changes: Change[] = [];
	const lines: OrderLine[] = [];
	for (const [i, l] of input.lines.entries()) {
		const n = `Artikulli ${i + 1}`;
		if (!isCount(l.quantity)) return fail(`${n}: sasia duhet të jetë një numër i plotë, të paktën 1.`);
		if (!gift && !(isAmount(l.unitPrice) && l.unitPrice > 0)) return fail(`${n}: vendosni çmimin.`);

		let artwork: OrderLine['artwork'];
		const a = l.artwork;
		if (a.kind === 'none') artwork = a;
		else if (a.kind === 'design') {
			const print = w.prints.find((p) => p.designId === a.designId && p.shirtColor === l.sku.color);
			if (!print) {
				const name = w.designs.find((d) => d.id === a.designId)?.name;
				return fail(
					name
						? `${n}: „${name}” nuk ka print për bluzë ${COLOR_LABELS[l.sku.color].toLowerCase()}.`
						: `${n}: dizajni nuk u gjet.`
				);
			}
			artwork = { kind: 'print', printId: print.id };
		} else {
			if (!a.front || !a.back) return fail(`${n} është i personalizuar: ngarkoni mockup-in para dhe pas.`);
			const front = storeImage(a.front, ctx);
			if (!front.ok) return front;
			const back = storeImage(a.back, ctx);
			if (!back.ok) return back;
			changes.push({ put: 'image', value: front.value }, { put: 'image', value: back.value });
			artwork = { kind: 'custom', front: front.value.id, back: back.value.id, printReady: false };
		}
		lines.push({
			id: ctx.newId(),
			sku: { ...l.sku },
			artwork,
			quantity: l.quantity,
			unitPrice: gift ? 0 : l.unitPrice,
			cost: lineCost(w, l.sku.garment, artwork)
		});
	}

	const subtotal = sum(lines, (l) => l.quantity * l.unitPrice);
	if (!gift && input.discount > subtotal + input.shippingCharged) return fail('Zbritja është më e madhe se porosia.');

	const delivery = makeDelivery(w, input.delivery, who.value.country);
	if (!delivery.ok) return delivery;

	const [customer, customerChanges] = resolveCustomer(w, who.value, null, ctx);
	const order: Order = {
		id: ctx.newId(),
		code: nextCode(w.orders),
		customerId: customer.id,
		kind: input.kind,
		channel: input.channel,
		delivery: delivery.value,
		lines,
		packaging: w.settings.packagingPerOrder,
		shippingCharged: gift ? 0 : input.shippingCharged,
		discount: gift ? 0 : input.discount,
		notes: input.notes.trim(),
		status: 'new',
		stockTracked: true,
		isDemo: false,
		createdAt: ctx.now,
		madeAt: null,
		handedOverAt: null,
		deliveredAt: null,
		returnedAt: null,
		cancelledAt: null
	};
	changes.push(...customerChanges, { put: 'order', value: order });

	if (input.paidWith && !gift) {
		if (!(PAYMENT_METHODS as readonly string[]).includes(input.paidWith)) return fail('Mënyra e pagesës e panjohur.');
		const amount = balance(order, []);
		if (amount > 0)
			changes.push({
				put: 'payment',
				value: { id: ctx.newId(), orderId: order.id, amount, method: input.paidWith, receivedAt: ctx.now }
			});
	}
	return ok(changes);
}

/** makeDelivery : World DeliveryInput Country -> Result<Delivery> */
function makeDelivery(w: World, d: DeliveryInput, country: Country): Result<Delivery> {
	const cost = d.cost ?? deliveryCost(w.settings, d.method, country);
	if (!isAmount(cost)) return fail('Kostoja e dërgesës nuk është e saktë.');
	if (d.method === 'courier') return ok({ method: 'courier', cost, trackingRef: d.trackingRef.trim() });
	if (d.method === 'hand') return ok({ method: 'hand', cost });
	return fail('Mënyra e dërgesës e panjohur.');
}

// ---- Fixing an order --------------------------------------------------------

/** OrderEdit: what can be corrected on an order after it was taken. */
export type OrderEdit = {
	customer: CustomerInput;
	kind: OrderKind;
	channel: Channel;
	delivery: DeliveryInput;
	shippingCharged: Cents;
	discount: Cents;
	notes: string;
};

/**
 * editOrder : World (Id, OrderEdit) Context -> Result<[Change]>
 * Corrects an order's details. Its shirts and their costs stay as they were;
 * the delivery method can't change once the order has left.
 */
export function editOrder(w: World, input: { orderId: Id; edit: OrderEdit }, ctx: Context): Result<Change[]> {
	const o = findOrder(w, input.orderId);
	if (!o) return fail('Porosia nuk u gjet.');
	const e = input.edit;
	const who = checkCustomer(e.customer);
	if (!who.ok) return who;
	if (!(ORDER_KINDS as readonly string[]).includes(e.kind)) return fail('Lloji i porosisë i panjohur.');
	if (!(CHANNELS as readonly string[]).includes(e.channel)) return fail('Burimi i panjohur.');
	if (!isAmount(e.shippingCharged) || !isAmount(e.discount)) return fail('Shumat nuk janë të sakta.');
	const left = o.handedOverAt != null || o.deliveredAt != null;
	if (left && e.delivery.method !== o.delivery.method) return fail('Porosia është nisur: mënyra e dërgesës nuk ndryshon më.');
	const delivery = makeDelivery(w, e.delivery, who.value.country);
	if (!delivery.ok) return delivery;

	const [customer, customerChanges] = resolveCustomer(w, who.value, findCustomer(w, o.customerId) ?? null, ctx);
	const gift = e.kind === 'gift';
	const next: Order = {
		...o,
		customerId: customer.id,
		kind: e.kind,
		channel: e.channel,
		delivery: delivery.value,
		shippingCharged: gift ? 0 : e.shippingCharged,
		discount: gift ? 0 : e.discount,
		notes: e.notes.trim()
	};
	return ok([...customerChanges, { put: 'order', value: next }]);
}

/**
 * setPrintReady : World (order, line, ready) Context -> Result<[Change]>
 * A personalised print came back from the printer (or, undone, didn't).
 */
export function setPrintReady(
	w: World,
	input: { orderId: Id; lineId: Id; ready: boolean },
	_ctx: Context
): Result<Change[]> {
	const o = findOrder(w, input.orderId);
	const l = o?.lines.find((x) => x.id === input.lineId);
	if (!o || !l || l.artwork.kind !== 'custom') return fail('Artikulli nuk u gjet.');
	const lines = o.lines.map((x) => (x.id === l.id && x.artwork.kind === 'custom' ? { ...x, artwork: { ...x.artwork, printReady: input.ready } } : x));
	return ok([{ put: 'order', value: { ...o, lines } }]);
}

/**
 * deleteOrder : World Id Context -> Result<[Change]>
 * Removes an order as if it never happened: its payments, its mockups, and
 * its stock movements go too, so what it took is back on the shelf.
 */
export function deleteOrder(w: World, orderId: Id, _ctx: Context): Result<Change[]> {
	const o = findOrder(w, orderId);
	if (!o) return fail('Porosia nuk u gjet.');
	return ok([
		...w.payments.filter((p) => p.orderId === o.id).map((p): Change => ({ delete: 'payment', id: p.id })),
		...w.movements.filter((m) => m.orderId === o.id).map((m): Change => ({ delete: 'movement', id: m.id })),
		...o.lines.flatMap((l): Change[] =>
			l.artwork.kind === 'custom'
				? [
						{ delete: 'image', id: l.artwork.front },
						{ delete: 'image', id: l.artwork.back }
					]
				: []
		),
		{ delete: 'order', id: o.id }
	]);
}

// ---- Moving an order along ---------------------------------------------------

/**
 * advance : World (Id, Event) Context -> Result<[Change]>
 * An event happens to an order.
 *   make: needs every personalised print back, and, for a tracked order,
 *         its blanks and prints on the shelf — which it takes.
 *   undo of make: gives back what making took.
 */
export function advance(w: World, input: { orderId: Id; event: OrderEvent }, ctx: Context): Result<Change[]> {
	const o = findOrder(w, input.orderId);
	if (!o) return fail('Porosia nuk u gjet.');
	const next = step(o, input.event, ctx.now);
	if (!next) return fail(`${o.code}: „${EVENT_LABELS[input.event]}” nuk bëhet dot tani.`);

	const changes: Change[] = [{ put: 'order', value: next }];
	if (input.event === 'make') {
		const pending = o.lines.filter((l) => l.artwork.kind === 'custom' && !l.artwork.printReady);
		if (pending.length) return fail(`${o.code}: printi i personalizuar ende s’ka ardhur.`);
		const short = shortfall(onHand(w.movements), o);
		if (short.length)
			return fail(`${o.code}: mungon ${short.map((s) => `${s.quantity} × ${subjectLabel(w, s.subject)}`).join(', ')}.`);
		for (const n of needs(o).values())
			changes.push({ put: 'movement', value: movement(ctx, n.subject, -n.quantity, 'made', o.id) });
	}
	if (input.event === 'undo' && o.status === 'ready') {
		// Give back exactly what this order still holds, subject by subject.
		const held = new Map<string, { subject: Movement['subject']; delta: number }>();
		for (const m of w.movements.filter((m) => m.orderId === o.id)) {
			const k = subjectKey(m.subject);
			const cur = held.get(k) ?? { subject: m.subject, delta: 0 };
			cur.delta += m.delta;
			held.set(k, cur);
		}
		for (const h of held.values())
			if (h.delta < 0) changes.push({ put: 'movement', value: movement(ctx, h.subject, -h.delta, 'unmade', o.id) });
	}
	return ok(changes);
}

function movement(ctx: Context, subject: Movement['subject'], delta: number, reason: Movement['reason'], orderId: Id): Movement {
	return { id: ctx.newId(), subject, delta, reason, note: '', orderId, purchaseId: null, at: ctx.now };
}

/**
 * advanceMany : World (Ids, Event) Context -> Result<[Change]>
 * The same event for several orders — the courier took a pile of parcels.
 * Each order sees the world as the ones before it left it; if one can't,
 * none do.
 */
export function advanceMany(w: World, input: { orderIds: Id[]; event: OrderEvent }, ctx: Context): Result<Change[]> {
	if (input.orderIds.length === 0) return fail('Zgjidhni të paktën një porosi.');
	let world = w;
	const all: Change[] = [];
	for (const orderId of input.orderIds) {
		const r = advance(world, { orderId, event: input.event }, ctx);
		if (!r.ok) return r;
		world = apply(world, r.value);
		all.push(...r.value);
	}
	return ok(all);
}

// ---- Getting paid -----------------------------------------------------------

/**
 * recordPayment : World (order, amount or null, method, when) Context -> Result<[Change]>
 * Money came in for an order. No amount means "whatever is still owed".
 */
export function recordPayment(
	w: World,
	input: { orderId: Id; amount: Cents | null; method: PaymentMethod; receivedAt: Instant | null },
	ctx: Context
): Result<Change[]> {
	const o = findOrder(w, input.orderId);
	if (!o) return fail('Porosia nuk u gjet.');
	if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) return fail('Mënyra e pagesës e panjohur.');
	const due = balance(o, w.payments);
	const amount = input.amount ?? due;
	if (!(isAmount(amount) && amount > 0))
		return fail(input.amount == null ? `${o.code} është paguar tashmë.` : 'Vendosni shumën e marrë.');
	if (input.amount != null && amount > due && due > 0)
		return fail(`Shuma është më e madhe se sa mbetet për t’u paguar (${formatEuro(due)}).`);
	return ok([
		{
			put: 'payment',
			value: { id: ctx.newId(), orderId: o.id, amount, method: input.method, receivedAt: input.receivedAt ?? ctx.now }
		}
	]);
}

/**
 * settle : World (Ids, method) Context -> Result<[Change]>
 * The courier paid out for these parcels: each is paid what it still owes.
 * Orders that owe nothing are passed over.
 */
export function settle(w: World, input: { orderIds: Id[]; method: PaymentMethod }, ctx: Context): Result<Change[]> {
	const changes: Change[] = [];
	for (const id of input.orderIds) {
		const o = findOrder(w, id);
		if (!o) return fail('Porosia nuk u gjet.');
		if (balance(o, w.payments) <= 0) continue;
		const r = recordPayment(w, { orderId: id, amount: null, method: input.method, receivedAt: null }, ctx);
		if (!r.ok) return r;
		changes.push(...r.value);
	}
	if (changes.length === 0) return fail('Këto porosi janë paguar tashmë.');
	return ok(changes);
}

/** deletePayment : World Id Context -> Result<[Change]> — a payment recorded by mistake. */
export function deletePayment(w: World, paymentId: Id, _ctx: Context): Result<Change[]> {
	if (!w.payments.some((p) => p.id === paymentId)) return fail('Pagesa nuk u gjet.');
	return ok([{ delete: 'payment', id: paymentId }]);
}
