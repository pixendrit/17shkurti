import { countStock } from '$lib/domain/commands/stock';
import { parseSubject, whole } from '$lib/domain/forms';
import { fail, ok } from '$lib/domain/result';
import { stockView } from '$lib/domain/views';
import { act, load as world } from '$lib/server/shop';

export const load = async (event) => stockView(await world(event));

export const actions = {
	count: (e) =>
		act(e, countStock, (f) => {
			const subject = parseSubject(f);
			if (!subject.ok) return subject;
			const count = whole(f.text('count'));
			return count == null ? fail('Shkruani sa copë janë.') : ok({ subject: subject.value, count, note: f.text('note') });
		})
};
