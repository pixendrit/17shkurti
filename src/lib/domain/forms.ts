/**
 * Reading forms: what was typed and picked, turned into a command's input —
 * or a message saying which field is wrong. Pure: the shell hands over the
 * fields (and uploaded pictures already read into Uploads).
 */
import type { NewOrder, OrderEdit, LineInput, CustomerInput, DeliveryInput } from './commands/orders';
import type { PurchaseInput } from './commands/stock';
import { parseEuro, type Cents } from './money';
import {
	CHANNELS,
	COLORS,
	COUNTRIES,
	DELIVERY_METHODS,
	EVENTS,
	EXPENSE_CATEGORIES,
	GARMENTS,
	ORDER_KINDS,
	PAYMENT_METHODS,
	SIZES,
	type Color,
	type Garment,
	type OrderEvent,
	type PaymentMethod,
	type Settings,
	type Size,
	type Subject,
	type Upload
} from './model';
import { fail, ok, type Result } from './result';
import { parseDay, type Instant } from './time';

/**
 * Form: a submitted form.
 *   text(name):   the field's value, "" when absent
 *   list(name):   every value of a repeated field (checkboxes, rows)
 *   upload(name): the picture uploaded in that field, if any
 */
export type Form = { text(name: string): string; list(name: string): string[]; upload(name: string): Upload | null };

/** formOf : fields uploads -> Form — a form from plain values (for tests and the shell). */
export function formOf(fields: Record<string, string | string[]>, uploads: Record<string, Upload> = {}): Form {
	return {
		text: (n) => {
			const v = fields[n];
			return (Array.isArray(v) ? v[0] : v) ?? '';
		},
		list: (n) => {
			const v = fields[n];
			return v == null ? [] : Array.isArray(v) ? v : [v];
		},
		upload: (n) => uploads[n] ?? null
	};
}

// ---- Fields -------------------------------------------------------------------

/** pick : [T] String T -> T — the value if it's one of the choices, else the fallback. */
const pick = <T extends string>(choices: readonly T[], v: string, fallback: T): T =>
	(choices as readonly string[]).includes(v) ? (v as T) : fallback;

/** oneOf : [T] String String -> Result<T> — the value if it's one of the choices. */
const oneOf = <T extends string>(choices: readonly T[], v: string, what: string): Result<T> =>
	(choices as readonly string[]).includes(v) ? ok(v as T) : fail(`Zgjidhni ${what}.`);

/** whole : String -> Number or null — a whole number, as typed. */
export function whole(text: string): number | null {
	const t = text.trim();
	return /^-?\d+$/.test(t) ? Number(t) : null;
}

/** amount : String String -> Result<Cents> — an amount of euro; empty is 0. */
function amount(text: string, what: string): Result<Cents> {
	if (text.trim() === '') return ok(0);
	const c = parseEuro(text);
	return c == null ? fail(`${what}: shkruani një shumë në euro, p.sh. 24,50.`) : ok(c);
}

/** amountOrNull : String String -> Result<Cents or null> — empty means "not given". */
function amountOrNull(text: string, what: string): Result<Cents | null> {
	return text.trim() === '' ? ok(null) : amount(text, what);
}

/** day : String Instant -> Instant — the date picked, or today when none. */
const day = (text: string, now: Instant) => parseDay(text) ?? now;

// ---- Orders -------------------------------------------------------------------

function customerFrom(f: Form): CustomerInput {
	return {
		name: f.text('name'),
		phone: f.text('phone'),
		address: f.text('address'),
		city: f.text('city'),
		country: pick(COUNTRIES, f.text('country'), 'XK')
	};
}

function deliveryFrom(f: Form): Result<DeliveryInput> {
	const method = oneOf(DELIVERY_METHODS, f.text('delivery'), 'mënyrën e dërgesës');
	if (!method.ok) return method;
	const cost = amountOrNull(f.text('deliveryCost'), 'Kostoja e dërgesës');
	if (!cost.ok) return cost;
	return ok({ method: method.value, cost: cost.value, trackingRef: f.text('trackingRef') });
}

/**
 * The line rows of the new-order form. Each row has a key k, listed in the
 * repeated field "line", and fields garment-k, color-k, size-k, art-k
 * ("none", "custom" or "design:<id>"), qty-k, price-k and, for custom
 * prints, the pictures front-k and back-k.
 */
function lineFrom(f: Form, k: string, n: number): Result<LineInput> {
	const garment = oneOf(GARMENTS, f.text(`garment-${k}`), `llojin e bluzës (artikulli ${n})`);
	const color = oneOf(COLORS, f.text(`color-${k}`), `ngjyrën (artikulli ${n})`);
	const size = oneOf(SIZES, f.text(`size-${k}`), `masën (artikulli ${n})`);
	if (!garment.ok) return garment;
	if (!color.ok) return color;
	if (!size.ok) return size;
	const quantity = whole(f.text(`qty-${k}`));
	if (quantity == null) return fail(`Artikulli ${n}: sasia duhet të jetë një numër i plotë.`);
	const price = amount(f.text(`price-${k}`), `Artikulli ${n}, çmimi`);
	if (!price.ok) return price;
	const art = f.text(`art-${k}`);
	const artwork: LineInput['artwork'] =
		art === 'custom'
			? { kind: 'custom', front: f.upload(`front-${k}`), back: f.upload(`back-${k}`) }
			: art.startsWith('design:')
				? { kind: 'design', designId: art.slice('design:'.length) }
				: { kind: 'none' };
	return ok({ sku: { garment: garment.value, color: color.value, size: size.value }, artwork, quantity, unitPrice: price.value });
}

/** parseNewOrder : Form -> Result<NewOrder> */
export function parseNewOrder(f: Form): Result<NewOrder> {
	const lines: LineInput[] = [];
	for (const [i, k] of f.list('line').entries()) {
		const l = lineFrom(f, k, i + 1);
		if (!l.ok) return l;
		lines.push(l.value);
	}
	const delivery = deliveryFrom(f);
	if (!delivery.ok) return delivery;
	const shippingCharged = amount(f.text('shippingCharged'), 'Transporti nga klienti');
	if (!shippingCharged.ok) return shippingCharged;
	const discount = amount(f.text('discount'), 'Zbritja');
	if (!discount.ok) return discount;
	const paid = f.text('paidWith');
	return ok({
		customer: customerFrom(f),
		kind: pick(ORDER_KINDS, f.text('kind'), 'sale'),
		channel: pick(CHANNELS, f.text('channel'), 'other'),
		delivery: delivery.value,
		lines,
		shippingCharged: shippingCharged.value,
		discount: discount.value,
		notes: f.text('notes'),
		paidWith: paid ? pick(PAYMENT_METHODS, paid, 'cash') : null
	});
}

/** parseOrderEdit : Form -> Result<OrderEdit> */
export function parseOrderEdit(f: Form): Result<OrderEdit> {
	const delivery = deliveryFrom(f);
	if (!delivery.ok) return delivery;
	const shippingCharged = amount(f.text('shippingCharged'), 'Transporti nga klienti');
	if (!shippingCharged.ok) return shippingCharged;
	const discount = amount(f.text('discount'), 'Zbritja');
	if (!discount.ok) return discount;
	return ok({
		customer: customerFrom(f),
		kind: pick(ORDER_KINDS, f.text('kind'), 'sale'),
		channel: pick(CHANNELS, f.text('channel'), 'other'),
		delivery: delivery.value,
		shippingCharged: shippingCharged.value,
		discount: discount.value,
		notes: f.text('notes')
	});
}

/** parseEvent : Form -> Result<OrderEvent> */
export const parseEvent = (f: Form): Result<OrderEvent> => oneOf(EVENTS, f.text('event'), 'hapin');

/** parsePayment : Form Instant -> Result<{ amount, method, receivedAt }> — empty amount: all that's owed. */
export function parsePayment(f: Form, now: Instant): Result<{ amount: Cents | null; method: PaymentMethod; receivedAt: Instant }> {
	const a = amountOrNull(f.text('amount'), 'Shuma');
	if (!a.ok) return a;
	const method = oneOf(PAYMENT_METHODS, f.text('method'), 'mënyrën e pagesës');
	if (!method.ok) return method;
	return ok({ amount: a.value, method: method.value, receivedAt: day(f.text('date'), now) });
}

// ---- Purchases and stock ------------------------------------------------------

/**
 * parsePurchase : Form Instant -> Result<PurchaseInput>
 *   blanks:  garment, color, unitCost, and qty-<size> for each size
 *   dtf:     sheets, sheetPrice, and qty-<printId> for each print
 *   expense: category, amount
 */
export function parsePurchase(f: Form, now: Instant): Result<PurchaseInput> {
	const base = { date: day(f.text('date'), now), note: f.text('note') };
	const kind = f.text('kind');
	if (kind === 'blanks') {
		const garment = oneOf(GARMENTS, f.text('garment'), 'llojin e bluzës');
		const color = oneOf(COLORS, f.text('color'), 'ngjyrën');
		if (!garment.ok) return garment;
		if (!color.ok) return color;
		const unitCost = amount(f.text('unitCost'), 'Çmimi për copë');
		if (!unitCost.ok) return unitCost;
		const lines = [];
		for (const size of SIZES) {
			const text = f.text(`qty-${size}`);
			if (text.trim() === '') continue;
			const q = whole(text);
			if (q == null) return fail(`Masa ${size}: shkruani një numër të plotë.`);
			lines.push({ sku: { garment: garment.value, color: color.value, size }, quantity: q, unitCost: unitCost.value });
		}
		return ok({ ...base, kind, lines });
	}
	if (kind === 'dtf') {
		const sheets = whole(f.text('sheets'));
		if (sheets == null) return fail('Vendosni sa fletë keni blerë.');
		const sheetPrice = amount(f.text('sheetPrice'), 'Çmimi për fletë');
		if (!sheetPrice.ok) return sheetPrice;
		const lines = [];
		for (const printId of f.list('print')) {
			const text = f.text(`qty-${printId}`);
			if (text.trim() === '') continue;
			const q = whole(text);
			if (q == null) return fail('Sasitë e printimeve duhet të jenë numra të plotë.');
			lines.push({ printId, quantity: q });
		}
		return ok({ ...base, kind, sheets, sheetPrice: sheetPrice.value, lines });
	}
	if (kind === 'expense') {
		const category = oneOf(EXPENSE_CATEGORIES, f.text('category'), 'kategorinë');
		if (!category.ok) return category;
		const a = amount(f.text('amount'), 'Shuma');
		if (!a.ok) return a;
		return ok({ ...base, kind, category: category.value, amount: a.value });
	}
	return fail('Lloj blerjeje i panjohur.');
}

/**
 * parseSubject : Form -> Result<Subject>
 * "blank:<garment>/<color>/<size>" or "print:<id>", as stock.subjectKey writes it.
 */
export function parseSubject(f: Form): Result<Subject> {
	const s = f.text('subject');
	const blank = /^blank:([a-z_0-9]+)\/([a-z]+)\/([A-Z]+)$/.exec(s);
	if (blank) {
		const [, g, c, z] = blank;
		if ((GARMENTS as readonly string[]).includes(g) && (COLORS as readonly string[]).includes(c) && (SIZES as readonly string[]).includes(z))
			return ok({ kind: 'blank', sku: { garment: g as Garment, color: c as Color, size: z as Size } });
	}
	if (s.startsWith('print:') && s.length > 6) return ok({ kind: 'print', printId: s.slice(6) });
	return fail('Artikulli i stokut i panjohur.');
}

// ---- Settings -----------------------------------------------------------------

/** parseSettings : Form -> Result<Settings> */
export function parseSettings(f: Form): Result<Settings> {
	const fields: [keyof Settings & string, string][] = [
		['defaultPrice', 'Çmimi i zakonshëm'],
		['sheetPrice', 'Fleta DTF'],
		['laborPerShirt', 'Puna për bluzë'],
		['packagingPerOrder', 'Paketimi']
	];
	const s: Partial<Record<string, number>> = {};
	for (const [name, what] of fields) {
		const a = amount(f.text(name), what);
		if (!a.ok) return a;
		s[name] = a.value;
	}
	const customPerSheet = whole(f.text('customPerSheet'));
	if (customPerSheet == null) return fail('Printime të personalizuara për fletë: shkruani një numër.');
	const blankCost = {} as Settings['blankCost'];
	for (const g of GARMENTS) {
		const a = amount(f.text(`blank-${g}`), 'Çmimi i bluzës');
		if (!a.ok) return a;
		blankCost[g] = a.value;
	}
	const courierCost = {} as Settings['courierCost'];
	for (const c of COUNTRIES) {
		const a = amount(f.text(`courier-${c}`), 'Posta');
		if (!a.ok) return a;
		courierCost[c] = a.value;
	}
	return ok({
		defaultPrice: s.defaultPrice!,
		sheetPrice: s.sheetPrice!,
		laborPerShirt: s.laborPerShirt!,
		packagingPerOrder: s.packagingPerOrder!,
		customPerSheet,
		blankCost,
		courierCost
	});
}
