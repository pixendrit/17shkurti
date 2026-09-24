import { goto, invalidateAll } from '$app/navigation';
import type * as m from '$lib/server/mutations';
import type { NewOrderInput } from '$lib/server/create-order';
import { shrinkImage } from './image';

/**
 * Browser-side handles for every write. Each posts to /api/action, where the
 * matching function in $lib/server/mutations runs against the shared database,
 * then the page data is reloaded so everyone's view stays current.
 */
type Ops = typeof m;
type Args<K extends keyof Ops> = Ops[K] extends (db: never, ...a: infer A) => unknown ? A : never;
type Ret<K extends keyof Ops> = Awaited<ReturnType<Ops[K]>>;

async function call<K extends keyof Ops>(op: K, ...args: Args<K>): Promise<Ret<K>> {
	const res = await fetch('/api/action', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ op, args })
	});
	if (res.status === 401) {
		await goto('/login');
		throw new Error('E kyçur');
	}
	const body = (await res.json().catch(() => ({}))) as { result?: Ret<K>; error?: string };
	if (!res.ok || body.error) throw new Error(body.error ?? 'Nuk u ruajt. Kontrolloni lidhjen me internetin.');
	await invalidateAll();
	return body.result as Ret<K>;
}

export type { NewOrderInput };
export type Mockups = Record<number, { front?: File | null; back?: File | null }>;

/**
 * Create an order, with personalised-print mockups when an item needs them.
 * Returns an error message, or navigates to the new order.
 */
export async function createOrder(input: NewOrderInput, mockups: Mockups = {}): Promise<string | null> {
	const form = new FormData();
	form.set('order', JSON.stringify(input));
	for (const [idx, pair] of Object.entries(mockups)) {
		for (const side of ['front', 'back'] as const) {
			const file = pair[side];
			if (!file) continue;
			const blob = await shrinkImage(file);
			form.set(`item${idx}_${side}`, new File([blob], `${side}.img`, { type: blob.type }));
		}
	}
	const res = await fetch('/api/orders', { method: 'POST', body: form });
	if (res.status === 401) {
		await goto('/login');
		return 'E kyçur';
	}
	const body = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
	if (!res.ok || body.error || !body.id) return body.error ?? 'Porosia nuk u ruajt.';
	await goto(`/orders/${body.id}`);
	return null;
}

export async function deleteOrder(orderId: number) {
	await call('deleteOrder', orderId);
	await goto('/orders');
}

export const setOrderStatus = (orderId: number, status: string) => call('setOrderStatus', orderId, status);
export const setPaymentStatus = (orderId: number, paymentStatus: string) =>
	call('setPaymentStatus', orderId, paymentStatus);
export const editOrder = (...a: Args<'editOrder'>) => call('editOrder', ...a);
export const markAsMade = (orderId: number) => call('markAsMade', orderId);
export const shipOrders = (ids: number[]) => call('shipOrders', ids);
export const deliverOrders = (ids: number[]) => call('deliverOrders', ids);
export const settleOrders = (ids: number[]) => call('settleOrders', ids);
export const setCustomPrintReady = (itemId: number, ready: boolean) => call('setCustomPrintReady', itemId, ready);
export const changeStock = (...a: Args<'changeStock'>) => call('changeStock', ...a);
export const addBlank = (input: Args<'addBlank'>[0]) => call('addBlank', input);
export const setDtfStock = (input: Args<'setDtfStock'>[0]) => call('setDtfStock', input);
export const setOnOrder = (id: number, onOrder: number) => call('setOnOrder', id, onOrder);
export const receiveDtf = (id: number) => call('receiveDtf', id);
export const createDesign = (name: string, notes: string) => call('createDesign', name, notes);
export const renameDesign = (id: number, name: string) => call('renameDesign', id, name);
export const toggleArchive = (id: number) => call('toggleArchive', id);
export const setShirtsPerSheet = (id: number, n: number) => call('setShirtsPerSheet', id, n);
export const saveCostSettings = (s: Args<'saveCostSettings'>[0]) => call('saveCostSettings', s);
export const addExpense = (e: Args<'addExpense'>[0]) => call('addExpense', e);
export const deleteExpense = (id: number) => call('deleteExpense', id);
export const buyBlanks = (p: Args<'buyBlanks'>[0]) => call('buyBlanks', p);
export const buyDtf = (p: Args<'buyDtf'>[0]) => call('buyDtf', p);
export const clearDemoData = () => call('clearDemoData');
