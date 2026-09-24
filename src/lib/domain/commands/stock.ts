/**
 * Commands on money out and the shelf: purchases, stock corrections,
 * settings, sample data.
 */
import type { Cents } from '../money';
import {
	COUNTRIES,
	EXPENSE_CATEGORIES,
	GARMENTS,
	type BlankLine,
	type Change,
	type Context,
	type ExpenseCategory,
	type Id,
	type Movement,
	type PrintLine,
	type Purchase,
	type Settings,
	type Subject,
	type World
} from '../model';
import { fail, ok, type Result } from '../result';
import { blank, onHand, printSubject, subjectKey } from '../stock';
import { subjectLabel } from '../labels';
import type { Instant } from '../time';
import { findPrint } from '../world';
import { isAmount, isCount } from './common';

/**
 * PurchaseInput: a purchase as entered, before it has an id.
 */
export type PurchaseInput = { date: Instant; note: string } & (
	| { kind: 'blanks'; lines: BlankLine[] }
	| { kind: 'dtf'; sheets: number; sheetPrice: Cents; lines: PrintLine[] }
	| { kind: 'expense'; category: ExpenseCategory; amount: Cents }
);

/** stockFrom : Purchase -> [(Subject, quantity)] — what a purchase put on the shelf. */
function stockFrom(p: Purchase): [Subject, number][] {
	switch (p.kind) {
		case 'blanks':
			return p.lines.map((l) => [blank(l.sku), l.quantity]);
		case 'dtf':
			return p.lines.map((l) => [printSubject(l.printId), l.quantity]);
		case 'expense':
			return [];
	}
}

/**
 * recordPurchase : World PurchaseInput Context -> Result<[Change]>
 * Money went out. Blanks and prints bought go on the shelf.
 */
export function recordPurchase(w: World, input: PurchaseInput, ctx: Context): Result<Change[]> {
	const base = { id: ctx.newId(), date: input.date, note: input.note.trim(), isDemo: false };
	let p: Purchase;
	switch (input.kind) {
		case 'blanks': {
			const lines = input.lines.filter((l) => l.quantity !== 0);
			if (lines.length === 0) return fail('Vendosni sa copë keni blerë.');
			if (lines.some((l) => !isCount(l.quantity))) return fail('Sasitë duhet të jenë numra të plotë.');
			if (lines.some((l) => !(GARMENTS as readonly string[]).includes(l.sku.garment))) return fail('Lloj bluze i panjohur.');
			if (lines.some((l) => !(isAmount(l.unitCost) && l.unitCost > 0))) return fail('Vendosni çmimin për copë.');
			p = { ...base, kind: 'blanks', lines };
			break;
		}
		case 'dtf': {
			if (!isCount(input.sheets)) return fail('Vendosni sa fletë keni blerë.');
			if (!(isAmount(input.sheetPrice) && input.sheetPrice > 0)) return fail('Vendosni çmimin për fletë.');
			const lines = input.lines.filter((l) => l.quantity !== 0);
			if (lines.some((l) => !isCount(l.quantity))) return fail('Sasitë duhet të jenë numra të plotë.');
			if (lines.some((l) => !findPrint(w, l.printId))) return fail('Printi nuk u gjet.');
			p = { ...base, kind: 'dtf', sheets: input.sheets, sheetPrice: input.sheetPrice, lines };
			break;
		}
		case 'expense': {
			if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) return fail('Kategori e panjohur.');
			if (!(isAmount(input.amount) && input.amount > 0)) return fail('Vendosni shumën e paguar.');
			p = { ...base, kind: 'expense', category: input.category, amount: input.amount };
			break;
		}
		default:
			return fail('Lloj blerjeje i panjohur.');
	}
	return ok([
		{ put: 'purchase', value: p },
		...stockFrom(p).map(([subject, delta]): Change => ({
			put: 'movement',
			value: { id: ctx.newId(), subject, delta, reason: 'purchase', note: '', orderId: null, purchaseId: p.id, at: input.date }
		}))
	]);
}

/**
 * deletePurchase : World Id Context -> Result<[Change]>
 * Removes a purchase entered by mistake, with the stock it added — unless
 * that stock has already been used.
 */
export function deletePurchase(w: World, purchaseId: Id, _ctx: Context): Result<Change[]> {
	const p = w.purchases.find((x) => x.id === purchaseId);
	if (!p) return fail('Blerja nuk u gjet.');
	const mine = w.movements.filter((m) => m.purchaseId === p.id);
	const have = onHand(w.movements);
	for (const m of mine) {
		const k = subjectKey(m.subject);
		have.set(k, (have.get(k) ?? 0) - m.delta);
	}
	const negative = mine.find((m) => (have.get(subjectKey(m.subject)) ?? 0) < 0);
	if (negative) return fail(`Nuk fshihet: ${subjectLabel(w, negative.subject)} nga kjo blerje është përdorur tashmë.`);
	return ok([...mine.map((m): Change => ({ delete: 'movement', id: m.id })), { delete: 'purchase', id: p.id }]);
}

/**
 * countStock : World (subject, count, note) Context -> Result<[Change]>
 * What was actually counted on the shelf. The difference is recorded as an
 * adjustment, so the ledger always explains the number.
 */
export function countStock(
	w: World,
	input: { subject: Subject; count: number; note: string },
	ctx: Context
): Result<Change[]> {
	if (!Number.isInteger(input.count) || input.count < 0) return fail('Sasia duhet të jetë një numër i plotë, jo negativ.');
	if (input.subject.kind === 'print' && !findPrint(w, input.subject.printId)) return fail('Printi nuk u gjet.');
	if (input.subject.kind === 'blank' && !(GARMENTS as readonly string[]).includes(input.subject.sku.garment))
		return fail('Lloj bluze i panjohur.');
	const delta = input.count - (onHand(w.movements).get(subjectKey(input.subject)) ?? 0);
	if (delta === 0) return ok([]);
	const m: Movement = {
		id: ctx.newId(),
		subject: input.subject,
		delta,
		reason: 'adjustment',
		note: input.note.trim(),
		orderId: null,
		purchaseId: null,
		at: ctx.now
	};
	return ok([{ put: 'movement', value: m }]);
}

/**
 * saveSettings : World Settings Context -> Result<[Change]>
 * New prices for orders taken from now on. Past orders keep theirs.
 */
export function saveSettings(_w: World, s: Settings, _ctx: Context): Result<Change[]> {
	const amounts = [
		s.defaultPrice,
		s.sheetPrice,
		s.laborPerShirt,
		s.packagingPerOrder,
		...GARMENTS.map((g) => s.blankCost[g]),
		...COUNTRIES.map((c) => s.courierCost[c])
	];
	if (amounts.some((a) => !isAmount(a))) return fail('Çmimet duhet të jenë shuma jo negative.');
	if (!(Number.isInteger(s.customPerSheet) && s.customPerSheet >= 1 && s.customPerSheet <= 100))
		return fail('Printime të personalizuara për fletë: një numër nga 1 deri në 100.');
	return ok([{ put: 'settings', value: s }]);
}

/**
 * clearDemo : World _ Context -> Result<[Change]>
 * Removes the sample orders and purchases, with everything that hangs off
 * them. Real records stay.
 */
export function clearDemo(w: World, _input: null, _ctx: Context): Result<Change[]> {
	const orders = new Set(w.orders.filter((o) => o.isDemo).map((o) => o.id));
	const purchases = new Set(w.purchases.filter((p) => p.isDemo).map((p) => p.id));
	if (orders.size === 0 && purchases.size === 0) return fail('Nuk ka të dhëna demo.');
	const images = w.orders
		.filter((o) => orders.has(o.id))
		.flatMap((o) => o.lines.flatMap((l) => (l.artwork.kind === 'custom' ? [l.artwork.front, l.artwork.back] : [])));
	return ok([
		...w.payments.filter((p) => orders.has(p.orderId)).map((p): Change => ({ delete: 'payment', id: p.id })),
		...w.movements
			.filter((m) => (m.orderId && orders.has(m.orderId)) || (m.purchaseId && purchases.has(m.purchaseId)))
			.map((m): Change => ({ delete: 'movement', id: m.id })),
		...images.map((id): Change => ({ delete: 'image', id })),
		...[...orders].map((id): Change => ({ delete: 'order', id })),
		...[...purchases].map((id): Change => ({ delete: 'purchase', id }))
	]);
}
