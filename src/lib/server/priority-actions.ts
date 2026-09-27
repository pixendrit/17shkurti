/**
 * The form actions for priorities, shared by the Priorities page and the
 * dashboard (which ticks today's box).
 */
import type { RequestEvent } from '@sveltejs/kit';
import { carryOver, createPriority, deletePriority, editPriority, setProgress, toggleDay } from '$lib/domain/priorities';
import { whole } from '$lib/domain/forms';
import { fail, ok } from '$lib/domain/result';
import { act } from './shop';

export const priorityActions = {
	create: (e: RequestEvent) =>
		act(e, createPriority, (f) =>
			ok({
				week: f.text('week'),
				title: f.text('title'),
				note: f.text('note'),
				kind: f.text('kind') === 'daily' ? ('daily' as const) : ('goal' as const),
				due: f.text('due') || null,
				from: f.text('from') || null
			})
		),
	progress: (e: RequestEvent) =>
		act(e, setProgress, (f) => {
			const n = f.text('done') ? 100 : whole(f.text('progress'));
			return n == null ? fail('Përqindja duhet të jetë numër.') : ok({ id: f.text('id'), progress: n });
		}),
	day: (e: RequestEvent) => act(e, toggleDay, (f) => ok({ id: f.text('id'), day: f.text('day') })),
	edit: (e: RequestEvent) =>
		act(e, editPriority, (f) => ok({ id: f.text('id'), title: f.text('title'), note: f.text('note'), due: f.text('due') || null })),
	carry: (e: RequestEvent) => act(e, carryOver, (f) => ok(f.text('id'))),
	remove: (e: RequestEvent) => act(e, deletePriority, (f) => ok(f.text('id')))
};
