/**
 * Looking things up in the world, and applying changes to it.
 */
import type { Change, Customer, Id, Order, Trashed, World } from './model';

/**
 * apply : World [Change] -> World
 * The world after the changes are written: what the database will hold once
 * the shell commits them. Lets one command build on another (making several
 * orders in a row), and lets tests check a command by its effect.
 */
export function apply(w: World, changes: readonly Change[]): World {
	const next: World = {
		...w,
		designs: [...w.designs],
		prints: [...w.prints],
		customers: [...w.customers],
		orders: [...w.orders],
		payments: [...w.payments],
		purchases: [...w.purchases],
		movements: [...w.movements],
		drafts: [...w.drafts],
		trash: [...w.trash],
		priorities: [...w.priorities]
	};
	const put = <T extends { id: Id }>(list: T[], value: T) => {
		const i = list.findIndex((x) => x.id === value.id);
		if (i >= 0) list[i] = value;
		else list.push(value);
	};
	const drop = <T extends { id: Id }>(list: T[], id: Id) => {
		const i = list.findIndex((x) => x.id === id);
		if (i >= 0) list.splice(i, 1);
	};
	for (const c of changes) {
		if ('put' in c) {
			switch (c.put) {
				case 'customer': put(next.customers, c.value); break;
				case 'design': put(next.designs, c.value); break;
				case 'print': put(next.prints, c.value); break;
				case 'order': putOrder(next, c.value); break;
				case 'payment': put(next.payments, c.value); break;
				case 'purchase': put(next.purchases, c.value); break;
				case 'movement': put(next.movements, c.value); break;
				case 'settings': next.settings = c.value; break;
				case 'draft': put(next.drafts, c.value); break;
				case 'priority': put(next.priorities, c.value); break;
				case 'image': break; // pictures aren't part of the world
			}
		} else {
			switch (c.delete) {
				case 'order':
					drop(next.orders, c.id);
					next.trash = next.trash.filter((t) => t.order.id !== c.id);
					break;
				case 'payment': drop(next.payments, c.id); break;
				case 'purchase': drop(next.purchases, c.id); break;
				case 'movement': drop(next.movements, c.id); break;
				case 'design': drop(next.designs, c.id); break;
				case 'print': drop(next.prints, c.id); break;
				case 'customer': drop(next.customers, c.id); break;
				case 'draft': drop(next.drafts, c.id); break;
				case 'priority': drop(next.priorities, c.id); break;
				case 'image': break;
			}
		}
	}
	return next;
}

/**
 * putOrder : World Order -> void (updates the world being built)
 * An order put with deletedAt goes to the trash, taking its payments and
 * stock movements with it; put back without, it comes out with them.
 */
function putOrder(w: World, o: Order) {
	const inTrash = w.trash.find((t) => t.order.id === o.id);
	if (o.deletedAt != null) {
		const owned = <T extends { orderId: Id | null }>(xs: T[]) => xs.filter((x) => x.orderId === o.id);
		const entry: Trashed = inTrash
			? { ...inTrash, order: o }
			: { order: o, payments: owned(w.payments), movements: owned(w.movements) };
		w.orders = w.orders.filter((x) => x.id !== o.id);
		w.payments = w.payments.filter((p) => p.orderId !== o.id);
		w.movements = w.movements.filter((m) => m.orderId !== o.id);
		w.trash = [entry, ...w.trash.filter((t) => t.order.id !== o.id)];
		return;
	}
	if (inTrash) {
		w.trash = w.trash.filter((t) => t.order.id !== o.id);
		w.payments = [...w.payments, ...inTrash.payments];
		w.movements = [...w.movements, ...inTrash.movements];
	}
	const i = w.orders.findIndex((x) => x.id === o.id);
	if (i >= 0) w.orders[i] = o;
	else w.orders.push(o);
}

export const findOrder = (w: World, id: Id) => w.orders.find((o) => o.id === id);
export const findTrashed = (w: World, id: Id) => w.trash.find((t) => t.order.id === id);
export const findCustomer = (w: World, id: Id) => w.customers.find((c) => c.id === id);
export const findDesign = (w: World, id: Id) => w.designs.find((d) => d.id === id);
export const findPrint = (w: World, id: Id) => w.prints.find((p) => p.id === id);
export const findDraft = (w: World, id: Id) => w.drafts.find((d) => d.id === id);

/**
 * normalizePhone : String -> String
 * A phone number reduced to what identifies it, so the same customer is
 * found however the number was typed: digits only, "00" read as "+".
 *   "+383 44 111-222" -> "38344111222"    "0038344111222" -> "38344111222"
 */
export function normalizePhone(phone: string): string {
	return phone.replace(/\D/g, '').replace(/^00/, '');
}

/** customerByPhone : World String -> Customer or undefined */
export function customerByPhone(w: World, phone: string): Customer | undefined {
	const key = normalizePhone(phone);
	return key ? w.customers.find((c) => normalizePhone(c.phone) === key) : undefined;
}

/**
 * nextCode : [Order] -> String
 * The code for a new order: one more than the highest so far.
 *   [] -> "HS-0001"     [HS-0041, HS-0007] -> "HS-0042"
 */
export function nextCode(orders: readonly Order[]): string {
	const max = orders.reduce((m, o) => Math.max(m, Number(/(\d+)$/.exec(o.code)?.[1] ?? 0)), 0);
	return `HS-${String(max + 1).padStart(4, '0')}`;
}

/**
 * separateTrash : World -> World
 * The world as stored has trashed orders among the rest: move them, with
 * their payments and stock movements, into `trash`, newest first.
 */
export function separateTrash(w: World): World {
	const trashed = new Set(w.orders.filter((o) => o.deletedAt != null).map((o) => o.id));
	if (trashed.size === 0) return w;
	return {
		...w,
		orders: w.orders.filter((o) => !trashed.has(o.id)),
		payments: w.payments.filter((p) => !trashed.has(p.orderId)),
		movements: w.movements.filter((m) => !m.orderId || !trashed.has(m.orderId)),
		trash: [
			...w.trash,
			...w.orders
				.filter((o) => trashed.has(o.id))
				.map((order) => ({
					order,
					payments: w.payments.filter((p) => p.orderId === order.id),
					movements: w.movements.filter((m) => m.orderId === order.id)
				}))
		].sort((a, b) => (b.order.deletedAt ?? 0) - (a.order.deletedAt ?? 0))
	};
}
