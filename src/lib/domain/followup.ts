/**
 * Keeping clients informed: which step of an order they should hear about
 * now, and the message that tells them.
 */
import { balance } from './economics';
import { formatEuro } from './money';
import type { Country, Customer, FollowUp, Order, Payment, World } from './model';
import { lineLabel } from './labels';

/**
 * stageOf : Order -> FollowUp or null
 * The step the order is at that the client should know about.
 *   ready -> ready    with_courier -> shipped    delivered -> delivered
 *   anything else -> null (nothing to tell yet, or nothing to tell at all)
 */
export function stageOf(o: Pick<Order, 'status'>): FollowUp | null {
	switch (o.status) {
		case 'ready':
			return 'ready';
		case 'with_courier':
			return 'shipped';
		case 'delivered':
			return 'delivered';
		default:
			return null;
	}
}

/**
 * dueFollowUp : Order -> FollowUp or null
 * What the client should be told now and hasn't been. Only the current step
 * counts: an order that went straight to delivered only needs its thanks.
 */
export function dueFollowUp(o: Pick<Order, 'status' | 'notified'>): FollowUp | null {
	const s = stageOf(o);
	return s && o.notified[s] == null ? s : null;
}

/**
 * fill : String {key: value} -> String
 * A template with its {placeholders} replaced; unknown ones are left as typed.
 *   fill("Hi {emri}!", { emri: "Arta" }) -> "Hi Arta!"
 */
export const fill = (template: string, values: Record<string, string>): string =>
	template.replace(/\{([a-z_]+)\}/g, (m, k: string) => values[k] ?? m);

/** The placeholders a message can use, and what each becomes. */
export const PLACEHOLDERS: Record<string, string> = {
	emri: 'emri i klientit',
	kodi: 'kodi i porosisë, p.sh. HS-0042',
	bluzat: 'çfarë ka porosia, p.sh. 2 × Shqiponja · E zezë · L',
	per_pagese: 'sa ka për të paguar, ose “e paguar”',
	nr_dergeses: 'numri i dërgesës te posta'
};

/**
 * message : World Order Customer FollowUp -> String
 * The text to send the client for that step, from the shop's template.
 */
export function message(w: Pick<World, 'settings' | 'designs' | 'prints'> & { payments: Payment[] }, o: Order, c: Customer | null, stage: FollowUp): string {
	const due = balance(o, w.payments);
	return fill(w.settings.messages[stage], {
		emri: (c?.name ?? '').split(' ')[0] || 'dhe mirëdita',
		kodi: o.code,
		bluzat: o.lines.map((l) => lineLabel(w, l)).join(', '),
		per_pagese: o.kind === 'gift' ? 'dhuratë nga ne' : due > 0 ? formatEuro(due) : 'e paguar',
		nr_dergeses: o.delivery.method === 'courier' && o.delivery.trackingRef ? o.delivery.trackingRef : '—'
	});
}

const DIAL: Record<Country, string> = { XK: '383', AL: '355', MK: '389', OTHER: '' };

/**
 * whatsappNumber : String Country -> String or null
 * A phone number as WhatsApp wants it: country code and digits, no "+".
 * A local number (starting with 0) gets the client's country code.
 *   "044 123 456", XK -> "38344123456"    "+355 69 111 2233" -> "355691112233"
 *   "—" -> null
 */
export function whatsappNumber(phone: string, country: Country): string | null {
	let d = phone.replace(/\D/g, '').replace(/^00/, '');
	if (d.startsWith('0')) {
		if (!DIAL[country]) return null;
		d = DIAL[country] + d.slice(1);
	}
	return d.length >= 10 ? d : null;
}
