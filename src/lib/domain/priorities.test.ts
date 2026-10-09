import { describe, expect, it } from 'vitest';
import type { Change, World } from './model';
import type { Result } from './result';
import { apply } from './world';
import { context, world } from './testing';
import { carryOver, createPriority, editPriority, prioritiesView, setProgress, standing, toggleDay } from './priorities';
import { addDays, parseDay, weekOf } from './time';

const run = (w: World, r: Result<Change[]>) => {
	if (!r.ok) throw new Error(r.error);
	return apply(w, r.value);
};

/** A context whose "now" is noon of that day in Kosovo. */
const at = (day: string, ids?: string) => context(parseDay(day)!, ids);

const goal = (week: string, title: string, due: string | null = null) => ({ week, title, note: '', kind: 'goal' as const, due, from: null });

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
		const w = run(world(), createPriority(world(), goal(next, ' Website live ', '2026-10-04'), at('2026-09-24')));
		expect(w.priorities[0]).toMatchObject({ kind: 'goal', title: 'Website live', progress: 0, due: '2026-10-04' });
		const w2 = run(w, setProgress(w, { id: 'id1', progress: 40 }, at('2026-09-24')));
		expect(standing(w2.priorities[0], '2026-10-01')).toMatchObject({ status: 'ongoing', score: 40 });
		expect(standing(w2.priorities[0], '2026-10-05').status).toBe('late');
		expect(standing(run(w2, setProgress(w2, { id: 'id1', progress: 100 }, at('2026-09-24'))).priorities[0], '2026-10-05').status).toBe('done');
		expect(setProgress(w, { id: 'id1', progress: 120 }, at('2026-09-24')).ok).toBe(false);
	});

	it('a goal without a due day is late once its week is over', () => {
		const w = run(world(), createPriority(world(), goal(next, 'Pa afat'), at('2026-09-24')));
		expect(standing(w.priorities[0], '2026-10-04').status).toBe('ongoing');
		expect(standing(w.priorities[0], '2026-10-05').status).toBe('late');
	});

	it('a daily one: a box per day from its first day to Sunday', () => {
		const daily = { week: next, title: '1 dizajn i ri në ditë', note: '', kind: 'daily' as const, due: null, from: null };
		const w = run(world(), createPriority(world(), daily, at('2026-09-24')));
		const w2 = run(w, toggleDay(w, { id: 'id1', day: '2026-09-28' }, at('2026-09-30')));
		const s = standing(w2.priorities[0], '2026-09-30');
		expect(s.total).toBe(7);
		expect(s.days.map((d) => d.state).slice(0, 4)).toEqual(['done', 'missed', 'today', 'future']);
		expect(s.status).toBe('late');
		expect(run(w2, toggleDay(w2, { id: 'id1', day: '2026-09-28' }, at('2026-09-30'))).priorities[0]).toMatchObject({ done: [] });
		expect(toggleDay(w, { id: 'id1', day: '2026-10-05' }, at('2026-10-05')).ok).toBe(false);
	});

	it('ticks only its own days, and not ones still to come', () => {
		const daily = { week: next, title: 'Postim', note: '', kind: 'daily' as const, due: null, from: '2026-09-30' };
		const w = run(world(), createPriority(world(), daily, at('2026-09-29')));
		expect(toggleDay(w, { id: 'id1', day: '2026-09-29' }, at('2026-10-01')).ok).toBe(false); // before its first day
		expect(toggleDay(w, { id: 'id1', day: '2026-10-02' }, at('2026-10-01')).ok).toBe(false); // tomorrow
		expect(toggleDay(w, { id: 'id1', day: '2026-10-01' }, at('2026-10-01')).ok).toBe(true); // today
		expect(toggleDay(w, { id: 'id1', day: '2026-09-30' }, at('2026-10-01')).ok).toBe(true); // yesterday
	});

	it('refuses a week that isn’t a Monday, or an empty title', () => {
		expect(createPriority(world(), goal('2026-09-29', 'x'), at('2026-09-24')).ok).toBe(false);
		expect(createPriority(world(), goal(next, ' '), at('2026-09-24')).ok).toBe(false);
	});

	it('refuses a week already over, or a due day before the week', () => {
		expect(createPriority(world(), goal('2026-09-21', 'x'), at('2026-09-28')).ok).toBe(false);
		expect(createPriority(world(), goal('2026-09-21', 'x'), at('2026-09-27')).ok).toBe(true);
		expect(createPriority(world(), goal(next, 'x', '2026-09-27'), at('2026-09-24')).ok).toBe(false);
		expect(createPriority(world(), goal(next, 'x', next), at('2026-09-24')).ok).toBe(true);
		const w = run(world(), createPriority(world(), goal(next, 'x'), at('2026-09-24')));
		expect(editPriority(w, { id: 'id1', title: 'x', note: '', due: '2026-09-27' }, at('2026-09-24')).ok).toBe(false);
		expect(editPriority(w, { id: 'id1', title: 'x', note: '', due: '2026-10-01' }, at('2026-09-24')).ok).toBe(true);
	});

	it('takes days only as YYYY-MM-DD, without throwing', () => {
		for (const week of [' 2026-09-28', '2026-09-28 ', '2026-9-28', 'nesër', '2026-13-01', ''])
			expect(createPriority(world(), goal(week, 'x'), at('2026-09-24')).ok).toBe(false);
		for (const due of [' 2026-10-01', '2026-10-1', '2026-02-30', 'x'])
			expect(createPriority(world(), goal(next, 'x', due), at('2026-09-24')).ok).toBe(false);
		const daily = { week: next, title: 'x', note: '', kind: 'daily' as const, due: null, from: '2026-09-30 ' };
		expect(createPriority(world(), daily, at('2026-09-24')).ok).toBe(false);
		const w = run(world(), createPriority(world(), goal(next, 'x'), at('2026-09-24')));
		expect(editPriority(w, { id: 'id1', title: 'x', note: '', due: '2026-10-01 ' }, at('2026-09-24')).ok).toBe(false);
	});

	it('carries an unfinished priority into next week', () => {
		const w = run(world(), createPriority(world(), goal('2026-09-21', 'Dashboardi', '2026-09-27'), at('2026-09-21')));
		const w2 = run(w, setProgress(w, { id: 'id1', progress: 99 }, at('2026-09-21')));
		const w3 = run(w2, carryOver(w2, 'id1', at('2026-09-27', 'c')));
		expect(w3.priorities[1]).toMatchObject({ week: '2026-09-28', progress: 99, due: '2026-10-04' });
	});

	it('does not carry a finished priority, nor one already in next week', () => {
		const w = run(world(), createPriority(world(), goal('2026-09-21', 'Dashboardi'), at('2026-09-21')));
		const done = run(w, setProgress(w, { id: 'id1', progress: 100 }, at('2026-09-21')));
		expect(carryOver(done, 'id1', at('2026-09-27', 'c')).ok).toBe(false);
		const once = run(w, carryOver(w, 'id1', at('2026-09-27', 'c')));
		expect(carryOver(once, 'id1', at('2026-09-27', 'd')).ok).toBe(false); // a double click
		const typed = run(w, createPriority(w, goal(next, ' DASHBOARDI '), at('2026-09-27', 'e')));
		expect(carryOver(typed, 'id1', at('2026-09-27', 'f')).ok).toBe(false);
	});

	it('splits them into this week, next week and past weeks', () => {
		let w = world();
		for (const [week, title] of [['2026-09-14', 'old'], ['2026-09-21', 'this'], ['2026-09-28', 'next']])
			w = run(w, createPriority(w, goal(week, title), at(week, title)));
		const v = prioritiesView(w, parseDay('2026-09-27')!);
		expect([v.thisWeek.monday, v.thisWeek.items.map((i) => i.title)]).toEqual(['2026-09-21', ['this']]);
		expect(v.nextWeek.items.map((i) => i.title)).toEqual(['next']);
		expect(v.past.map((p) => p.monday)).toEqual(['2026-09-14']);
	});
});
