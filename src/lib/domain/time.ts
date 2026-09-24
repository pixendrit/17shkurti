/**
 * Instant: a moment, as whole seconds since 1970 (Unix time, UTC).
 *
 * The shop is in Kosovo, so days and months are Kosovo's: Central European
 * Time, +1 hour, and +2 in summer. The rule is written out here instead of
 * asking the runtime's locale data, which differs between the server and
 * phones — the same moment must print the same everywhere.
 */
export type Instant = number;

export const DAY = 86400;

const MONTHS = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'kor', 'gsh', 'sht', 'tet', 'nën', 'dhj'];
export const MONTHS_LONG = [
	'janar',
	'shkurt',
	'mars',
	'prill',
	'maj',
	'qershor',
	'korrik',
	'gusht',
	'shtator',
	'tetor',
	'nëntor',
	'dhjetor'
];

/** The last Sunday of a month, 01:00 UTC: when European summer time starts or ends. */
function lastSundayAt1Utc(year: number, month: number): Instant {
	const last = new Date(Date.UTC(year, month + 1, 0, 1));
	last.setUTCDate(last.getUTCDate() - last.getUTCDay());
	return last.getTime() / 1000;
}

/**
 * offset : Instant -> Seconds
 * How far Kosovo's clock is ahead of UTC at that moment: 3600 or 7200.
 */
export function offset(t: Instant): number {
	const year = new Date(t * 1000).getUTCFullYear();
	const summer = t >= lastSundayAt1Utc(year, 2) && t < lastSundayAt1Utc(year, 9);
	return summer ? 7200 : 3600;
}

/** The calendar day and time on a Kosovo wall clock. */
function local(t: Instant) {
	const d = new Date((t + offset(t)) * 1000);
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth(),
		day: d.getUTCDate(),
		hour: d.getUTCHours(),
		minute: d.getUTCMinutes()
	};
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * formatDate : Instant or null -> String
 *   an instant on 24 Sept 2026 -> "24 sht 2026";   null -> "—"
 */
export function formatDate(t: Instant | null): string {
	if (t == null) return '—';
	const l = local(t);
	return `${pad(l.day)} ${MONTHS[l.month]} ${l.year}`;
}

/** formatDateTime : Instant -> String — "24 sht 2026, 14:05" */
export function formatDateTime(t: Instant): string {
	const l = local(t);
	return `${formatDate(t)}, ${pad(l.hour)}:${pad(l.minute)}`;
}

/** dayInput : Instant -> String — the day as a date field wants it, "2026-09-24". */
export function dayInput(t: Instant): string {
	const l = local(t);
	return `${l.year}-${pad(l.month + 1)}-${pad(l.day)}`;
}

/**
 * parseDay : String -> Instant or null
 * A date field's value as noon of that day in Kosovo, or null if it isn't one.
 * Noon, so the day never slips across midnight either way.
 *   "2026-09-24" -> 24 Sept 2026 12:00 in Kosovo     "24/09" -> null
 */
export function parseDay(text: string): Instant | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
	if (!m) return null;
	const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
	const utcNoon = Date.UTC(y, mo, d, 12) / 1000;
	const back = new Date(utcNoon * 1000);
	if (back.getUTCMonth() !== mo || back.getUTCDate() !== d) return null;
	return utcNoon - offset(utcNoon);
}

/** monthKey : Instant -> String — the Kosovo month an instant falls in, "2026-09". */
export function monthKey(t: Instant): string {
	const l = local(t);
	return `${l.year}-${pad(l.month + 1)}`;
}

/** monthLabel : String -> String — "2026-09" -> "sht 2026" */
export function monthLabel(key: string): string {
	const [y, m] = key.split('-').map(Number);
	return `${MONTHS[m - 1]} ${y}`;
}

/** startOfDay : Instant -> Instant — midnight in Kosovo at the start of that day. */
export function startOfDay(t: Instant): Instant {
	const l = local(t);
	const utcMidnight = Date.UTC(l.year, l.month, l.day) / 1000;
	return utcMidnight - offset(utcMidnight);
}
