import { goto, invalidateAll } from '$app/navigation';
import type * as m from '$lib/server/mutations';

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

export type { NewOrderInput } from '$lib/server/mutations';

export async function createOrder(input: Args<'createOrder'>[0]) {
	const id = await call('createOrder', input);
	await goto(`/orders/${id}`);
}

export async function deleteOrder(orderId: number) {
	await call('deleteOrder', orderId);
	await goto('/orders');
}

export const setOrderStatus = (orderId: number, status: string) =>
	call('setOrderStatus', orderId, status);
export const setPaymentStatus = (orderId: number, paymentStatus: string) =>
	call('setPaymentStatus', orderId, paymentStatus);
export const markAsMade = (orderId: number) => call('markAsMade', orderId);
export const changeStock = (...a: Args<'changeStock'>) => call('changeStock', ...a);
export const addBlank = (input: Args<'addBlank'>[0]) => call('addBlank', input);
export const setDtfStock = (input: Args<'setDtfStock'>[0]) => call('setDtfStock', input);
export const setOnOrder = (id: number, onOrder: number) => call('setOnOrder', id, onOrder);
export const receiveDtf = (id: number) => call('receiveDtf', id);
export const createDesign = (name: string, notes: string) => call('createDesign', name, notes);
export const toggleArchive = (id: number) => call('toggleArchive', id);
