import { describe, expect, it } from 'vitest';
import type { Change, World } from './model';
import type { Result } from './result';
import { apply } from './world';
import { context, T0, world } from './testing';
import { carryOver, createPriority, prioritiesView, setProgress, standing, toggleDay } from './priorities';
import { addDays, parseDay, weekOf } from './time';

const run = (w: World, r: Result<Change[]>) => {
	if (!r.ok) throw new Error(r.error);
	return apply(w, r.value);
};

describe('weeks', () => {
	it('names a week by its Monday', () => {
		expect(weekOf('2026-09-27')).toBe('2026-09-21'); // a Sunday
		expect(weekOf('2026-09-28')).toBe('2026-09-28'); // a Monday
		expect(addDays('2026-09-28', 6)).toBe('2026-10-04');
	});
});

describe('priorities', () => {
	const next = '2026-09-28';

	it('a goal: progress and a due day', () => {
		const w = run(world(), createPriority(world(), { week: next, title: ' Website live ', note: '', kind: 'goal', due: '2026-10-04', from: null }, context()));
		expect(w.priorities[0]).toMatchObject({ kind: 'goal', title: 'Website live', progress: 0, due: '2026-10-04' });
		const w2 = run(w, setProgress(w, { id: 'id1', progress: 40 }, context()));
		expect(standing(w2.priorities[0], '2026-10-01')).toMatchObject({ status: 'ongoing', score: 40 });
		expect(standing(w2.priorities[0], '2026-10-05').status).toBe('late');
		expect(standing(run(w2, setProgress(w2, { id: 'id1', progress: 100 }, context())).priorities[0], '2026-10-05').status).toBe('done');
		expect(setProgress(w, { id: 'id1', progress: 120 }, context()).ok).toBe(false);
	});

	it('a daily one: a box per day from its first day to Sunday', () => {
		const w = run(world(), createPriority(world(), { week: next, title: '1 dizajn i ri në ditë', note: '', kind: 'daily', due: null, from: null }, context()));
		const w2 = run(w, toggleDay(w, { id: 'id1', day: '2026-09-28' }, context()));
		const s = standing(w2.priorities[0], '2026-09-30');
		expect(s.total).toBe(7);
		expect(s.days.map((d) => d.state).slice(0, 4)).toEqual(['done', 'missed', 'today', 'future']);
		expect(s.status).toBe('late');
		expect(run(w2, toggleDay(w2, { id: 'id1', day: '2026-09-28' }, context())).priorities[0]).toMatchObject({ done: [] });
		expect(toggleDay(w, { id: 'id1', day: '2026-10-05' }, context()).ok).toBe(false);
	});

	it('refuses a week that isn’t a Monday, or an empty title', () => {
		expect(createPriority(world(), { week: '2026-09-29', title: 'x', note: '', kind: 'goal', due: null, from: null }, context()).ok).toBe(false);
		expect(createPriority(world(), { week: next, title: ' ', note: '', kind: 'goal', due: null, from: null }, context()).ok).toBe(false);
	});

	it('carries an unfinished priority into next week', () => {
		const w = run(world(), createPriority(world(), { week: '2026-09-21', title: 'Dashboardi', note: '', kind: 'goal', due: '2026-09-27', from: null }, context()));
		const w2 = run(w, setProgress(w, { id: 'id1', progress: 99 }, context()));
		const w3 = run(w2, carryOver(w2, 'id1', context(T0, 'c')));
		expect(w3.priorities[1]).toMatchObject({ week: '2026-09-28', progress: 99, due: '2026-10-04' });
	});

	it('splits them into this week, next week and past weeks', () => {
		let w = world();
		for (const [week, title] of [['2026-09-14', 'old'], ['2026-09-21', 'this'], ['2026-09-28', 'next']])
			w = run(w, createPriority(w, { week, title, note: '', kind: 'goal', due: null, from: null }, context(T0, title)));
		const v = prioritiesView(w, parseDay('2026-09-27')!);
		expect([v.thisWeek.monday, v.thisWeek.items.map((i) => i.title)]).toEqual(['2026-09-21', ['this']]);
		expect(v.nextWeek.items.map((i) => i.title)).toEqual(['next']);
		expect(v.past.map((p) => p.monday)).toEqual(['2026-09-14']);
	});
});
