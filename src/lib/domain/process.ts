/**
 * The order process: which events can happen to an order, and what they do
 * to its status and timestamps. Stock and money are handled by the commands
 * that call this; here is only the order's own state.
 */
import type { Order, OrderEvent, Status } from './model';
import type { Instant } from './time';

/**
 * nextStatus : Order Event -> Status or null
 * The status an event moves an order to, or null when it can't happen now.
 *
 *   from \ event   start          make   hand_over      deliver     return    cancel
 *   new            in_production  ready                                       cancelled
 *   in_production                 ready                                       cancelled
 *   ready                                with_courier*  delivered†            cancelled
 *   with_courier                                        delivered   returned
 *     * courier orders only    † hand deliveries only
 *
 * undo steps back to where the order was before its last event.
 */
export function nextStatus(order: Order, event: OrderEvent): Status | null {
	const s = order.status;
	const courier = order.delivery.method === 'courier';
	switch (event) {
		case 'start':
			return s === 'new' ? 'in_production' : null;
		case 'make':
			return s === 'new' || s === 'in_production' ? 'ready' : null;
		case 'hand_over':
			return s === 'ready' && courier ? 'with_courier' : null;
		case 'deliver':
			return s === 'with_courier' || (s === 'ready' && !courier) ? 'delivered' : null;
		case 'return':
			return s === 'with_courier' ? 'returned' : null;
		case 'cancel':
			return s === 'new' || s === 'in_production' || s === 'ready' ? 'cancelled' : null;
		case 'undo':
			return previousStatus(order);
	}
}

/** previousStatus : Order -> Status or null — where undo takes the order. */
function previousStatus(order: Order): Status | null {
	switch (order.status) {
		case 'new':
			return null;
		case 'in_production':
			return 'new';
		case 'ready':
			return 'in_production';
		case 'with_courier':
			return 'ready';
		case 'delivered':
			return order.handedOverAt != null ? 'with_courier' : 'ready';
		case 'returned':
			return 'with_courier';
		case 'cancelled':
			return order.madeAt != null ? 'ready' : 'new';
	}
}

/**
 * step : Order Event Instant -> Order or null
 * The order after the event happened at `at`, or null if it can't happen.
 * Each step records when it happened; undo clears what it takes back.
 */
export function step(order: Order, event: OrderEvent, at: Instant): Order | null {
	const status = nextStatus(order, event);
	if (status == null) return null;
	const o = { ...order, status };
	if (event === 'undo') {
		if (order.status === 'ready') o.madeAt = null;
		if (order.status === 'with_courier') o.handedOverAt = null;
		if (order.status === 'delivered') o.deliveredAt = null;
		if (order.status === 'returned') o.returnedAt = null;
		if (order.status === 'cancelled') o.cancelledAt = null;
		return o;
	}
	if (status === 'ready') o.madeAt = at;
	if (status === 'with_courier') o.handedOverAt = at;
	if (status === 'delivered') o.deliveredAt = at;
	if (status === 'returned') o.returnedAt = at;
	if (status === 'cancelled') o.cancelledAt = at;
	return o;
}

/** possibleEvents : Order -> [Event] — what can be done to the order now. */
export const possibleEvents = (order: Order): OrderEvent[] =>
	(['start', 'make', 'hand_over', 'deliver', 'return', 'cancel', 'undo'] as const).filter(
		(e) => nextStatus(order, e) != null
	);

/** Open: still to be made or sent. */
export const isOpen = (o: Order) => o.status === 'new' || o.status === 'in_production' || o.status === 'ready';

/** Unmade: its shirts don't exist yet. */
export const isUnmade = (o: Order) => o.status === 'new' || o.status === 'in_production';

/** Live: it happened, or is happening — neither cancelled nor returned. */
export const isLive = (o: Order) => o.status !== 'cancelled' && o.status !== 'returned';
