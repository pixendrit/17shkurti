/**
 * Priorities: what the shop commits to each week, and how it's going.
 */
import type { Change, Context, Day, Id, Priority, World } from './model';
import { fail, ok, type Result } from './result';
import { addDays, dayInput, parseDay, weekOf, type Instant } from './time';

/** Strictly "YYYY-MM-DD", and a real day: no spaces, no "2026-9-1", no "2026-02-30". */
const isDay = (d: unknown): d is Day => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && parseDay(d) != null;

/** A goal's due day: none, or a day not before its week. The error, or null if it's fine. */
const badDue = (due: Day | null, week: Day) =>
	!due ? null : !isDay(due) ? 'Afati nuk është datë (VVVV-MM-DD).' : due < week ? 'Afati nuk mund të jetë para javës.' : null;

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// ---- Commands -------------------------------------------------------------------

export type PriorityInput = {
	week: Day;
	title: string;
	note: string;
	kind: 'goal' | 'daily';
	due: Day | null; // goal
	from: Day | null; // daily: first day (defaults to the week's Monday)
};

/**
 * createPriority : World PriorityInput Context -> Result<[Change]>
 * A priority for this week or a later one. A daily one runs from its first day to Sunday.
 */
export function createPriority(_w: World, input: PriorityInput, ctx: Context): Result<Change[]> {
	const title = input.title.trim();
	if (!title) return fail('Shkruani prioritetin.');
	if (!isDay(input.week) || weekOf(input.week) !== input.week) return fail('Java e panjohur.');
	if (input.week < weekOf(dayInput(ctx.now))) return fail('Kjo javë ka kaluar.');
	const base = { id: ctx.newId(), week: input.week, title, note: input.note.trim(), createdAt: ctx.now };
	if (input.kind === 'daily') {
		const from = input.from || input.week;
		if (!isDay(from) || weekOf(from) !== input.week) return fail('Dita e fillimit duhet të jetë brenda javës.');
		return ok([{ put: 'priority', value: { ...base, kind: 'daily', from, done: [] } }]);
	}
	const bad = badDue(input.due, input.week);
	if (bad) return fail(bad);
	return ok([{ put: 'priority', value: { ...base, kind: 'goal', progress: 0, due: input.due || null } }]);
}

const find = (w: World, id: Id) => w.priorities.find((p) => p.id === id);

/** setProgress : World (id, 0–100) Context -> Result<[Change]> — how far a goal has come. */
export function setProgress(w: World, input: { id: Id; progress: number }, _ctx: Context): Result<Change[]> {
	const p = find(w, input.id);
	if (!p || p.kind !== 'goal') return fail('Qëllimi nuk u gjet.');
	if (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100) return fail('Përqindja: nga 0 deri në 100.');
	return ok([{ put: 'priority', value: { ...p, progress: input.progress } }]);
}

/**
 * toggleDay : World (id, day) Context -> Result<[Change]>
 * A daily priority done that day, or not after all. Only its own days, and not ones still to come.
 */
export function toggleDay(w: World, input: { id: Id; day: Day }, ctx: Context): Result<Change[]> {
	const p = find(w, input.id);
	if (!p || p.kind !== 'daily') return fail('Prioriteti nuk u gjet.');
	if (!daysOf(p).includes(input.day)) return fail('Kjo ditë nuk është pjesë e prioritetit.');
	if (input.day > dayInput(ctx.now)) return fail('Kjo ditë nuk ka ardhur ende.');
	const done = p.done.includes(input.day) ? p.done.filter((d) => d !== input.day) : [...p.done, input.day].sort();
	return ok([{ put: 'priority', value: { ...p, done } }]);
}

/** editPriority : World (id, title, note, due) Context -> Result<[Change]> */
export function editPriority(w: World, input: { id: Id; title: string; note: string; due: Day | null }, _ctx: Context): Result<Change[]> {
	const p = find(w, input.id);
	if (!p) return fail('Prioriteti nuk u gjet.');
	const title = input.title.trim();
	if (!title) return fail('Shkruani prioritetin.');
	const bad = p.kind === 'goal' ? badDue(input.due, p.week) : null;
	if (bad) return fail(bad);
	const next: Priority = p.kind === 'goal' ? { ...p, title, note: input.note.trim(), due: input.due || null } : { ...p, title, note: input.note.trim() };
	return ok([{ put: 'priority', value: next }]);
}

/**
 * carryOver : World Id Context -> Result<[Change]>
 * An unfinished priority, again next week: a goal keeps its progress (its
 * due day moves a week on if it had passed); a daily one starts again Monday.
 * Not a finished one, and not twice (same title already next week).
 */
export function carryOver(w: World, id: Id, ctx: Context): Result<Change[]> {
	const p = find(w, id);
	if (!p) return fail('Prioriteti nuk u gjet.');
	if (standing(p, dayInput(ctx.now)).status === 'done') return fail('Ky prioritet është kryer.');
	const week = addDays(p.week, 7);
	if (w.priorities.some((q) => q.week === week && sameTitle(q.title, p.title))) return fail('Ky prioritet është tashmë në javën tjetër.');
	const base = { id: ctx.newId(), week, title: p.title, note: p.note, createdAt: ctx.now };
	const next: Priority =
		p.kind === 'goal'
			? { ...base, kind: 'goal', progress: p.progress, due: p.due && p.due < week ? addDays(p.due, 7) : p.due }
			: { ...base, kind: 'daily', from: week, done: [] };
	return ok([{ put: 'priority', value: next }]);
}

/** deletePriority : World Id Context -> Result<[Change]> */
export function deletePriority(w: World, id: Id, _ctx: Context): Result<Change[]> {
	return find(w, id) ? ok([{ delete: 'priority', id }]) : fail('Prioriteti nuk u gjet.');
}

// ---- Reading ----------------------------------------------------------------------

/** daysOf : daily Priority -> [Day] — the days it covers, first day to Sunday. */
export function daysOf(p: Extract<Priority, { kind: 'daily' }>): Day[] {
	const days: Day[] = [];
	for (let d = p.from; d <= addDays(p.week, 6); d = addDays(d, 1)) days.push(d);
	return days;
}

/**
 * Status: how a priority stands today.
 *   done:    finished (goal at 100%, or every day ticked)
 *   late:    a goal past its due day (or its week's Sunday, without one), or a daily one with a missed day
 *   ongoing: anything else
 */
export type Status = 'done' | 'late' | 'ongoing';

/**
 * standing : Priority Day -> { status, score, total, days? }
 * Where a priority stands on a given day. A daily one's day counts as missed
 * only once it's over.
 */
export function standing(p: Priority, today: Day) {
	if (p.kind === 'goal') {
		const deadline = p.due || addDays(p.week, 6);
		const status: Status = p.progress >= 100 ? 'done' : deadline < today ? 'late' : 'ongoing';
		return { status, score: p.progress, total: 100, days: [] as { day: Day; state: 'done' | 'missed' | 'today' | 'future' }[] };
	}
	const days = daysOf(p).map((day) => ({
		day,
		state: (p.done.includes(day) ? 'done' : day < today ? 'missed' : day === today ? 'today' : 'future') as 'done' | 'missed' | 'today' | 'future'
	}));
	const score = days.filter((d) => d.state === 'done').length;
	const status: Status = score === days.length ? 'done' : days.some((d) => d.state === 'missed') ? 'late' : 'ongoing';
	return { status, score, total: days.length, days };
}

/**
 * prioritiesView : World Instant -> this week, next week, and past weeks
 * (newest first), each with its priorities and how they stand
 */
export function prioritiesView(w: World, now: Instant) {
	const today = dayInput(now);
	const thisWeek = weekOf(today);
	const nextWeek = addDays(thisWeek, 7);
	const week = (monday: Day) => ({
		monday,
		items: w.priorities
			.filter((p) => p.week === monday)
			.sort((a, b) => a.createdAt - b.createdAt)
			.map((p) => ({ ...p, ...standing(p, today) }))
	});
	const past = [...new Set(w.priorities.map((p) => p.week).filter((m) => m < thisWeek))].sort().reverse();
	const later = [...new Set(w.priorities.map((p) => p.week).filter((m) => m > nextWeek))].sort();
	return { today, thisWeek: week(thisWeek), nextWeek: week(nextWeek), later: later.map(week), past: past.map(week) };
}
