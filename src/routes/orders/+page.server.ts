import { listOrders } from '$lib/data/orders';
import { orderReadiness } from '$lib/data/stock';
import type { PageServerLoad } from './$types';

/** Tabs that are a group of statuses rather than one. */
const GROUPS: Record<string, (o: { status: string; deliveryMethod: string }) => boolean> = {
	open: (o) => !['delivered', 'cancelled', 'returned'].includes(o.status),
	pickup: (o) => o.deliveryMethod === 'post' && o.status === 'ready',
	courier: (o) => o.deliveryMethod === 'post' && o.status === 'shipped'
};

export const load: PageServerLoad = async ({ url, locals: { db } }) => {
	const status = url.searchParams.get('status') ?? 'open';
	const q = url.searchParams.get('q') ?? '';
	const channel = url.searchParams.get('channel') ?? '';
	const kind = url.searchParams.get('kind') ?? '';
	const delivery = url.searchParams.get('delivery') ?? '';

	const group = status in GROUPS ? GROUPS[status] : undefined;
	const all = await listOrders(db, {
		status: group || status === 'all' ? undefined : status,
		q,
		channel: channel || undefined,
		kind: kind || undefined,
		delivery: delivery || undefined
	});
	const filtered = group ? all.filter(group) : all;

	// Only open, not-yet-made orders need the (heavier) stock check.
	const canMake = new Map<number, boolean>();
	for (const o of filtered) {
		if (!o.stockDeductedAt && ['new', 'in_production'].includes(o.status)) {
			canMake.set(o.id, (await orderReadiness(db, o.id)).ready);
		}
	}

	return {
		orders: filtered.map((o) => ({
			id: o.id,
			code: o.code,
			customerName: o.customerName,
			phone: o.phone,
			city: o.city,
			channel: o.channel,
			kind: o.kind,
			status: o.status,
			deliveryMethod: o.deliveryMethod,
			paymentStatus: o.paymentStatus,
			createdAt: o.createdAt,
			isDemo: o.isDemo,
			hasCustom: o.items.some((i) => i.isCustom),
			summary: o.items
				.map((i) => `${i.quantity}× ${i.isCustom ? 'Personalizuar' : (i.designName ?? 'Pa print')} ${i.size}`)
				.join(', '),
			units: o.econ.units,
			revenue: o.econ.revenue,
			canMake: canMake.get(o.id) ?? null
		})),
		filters: { status, q, channel, kind, delivery },
		total: filtered.reduce((a, o) => a + o.econ.revenue, 0)
	};
};
