import { describe, expect, it } from 'vitest';
import { dayInput, formatDate, formatDateTime, monthKey, offset, parseDay, startOfDay } from './time';

const utc = (s: string) => Date.parse(s) / 1000;

describe('offset (Kosovo clock)', () => {
	it('is +1 in winter and +2 in summer', () => {
		expect(offset(utc('2026-01-15T12:00:00Z'))).toBe(3600);
		expect(offset(utc('2026-07-15T12:00:00Z'))).toBe(7200);
	});
	it('switches at 01:00 UTC on the last Sunday of March and October', () => {
		expect(offset(utc('2026-03-29T00:59:59Z'))).toBe(3600);
		expect(offset(utc('2026-03-29T01:00:00Z'))).toBe(7200);
		expect(offset(utc('2026-10-25T00:59:59Z'))).toBe(7200);
		expect(offset(utc('2026-10-25T01:00:00Z'))).toBe(3600);
	});
});

describe('formatting', () => {
	it('uses the Kosovo day, not the UTC one', () => {
		// 22:30 UTC on 23 Sept is 00:30 on 24 Sept in Kosovo
		expect(formatDate(utc('2026-09-23T22:30:00Z'))).toBe('24 sht 2026');
		expect(formatDateTime(utc('2026-09-23T22:30:00Z'))).toBe('24 sht 2026, 00:30');
		expect(monthKey(utc('2026-09-30T22:30:00Z'))).toBe('2026-10');
	});
	it('shows a dash for no date', () => expect(formatDate(null)).toBe('—'));
});

describe('date fields', () => {
	it('round-trips a day', () => {
		const t = parseDay('2026-09-24')!;
		expect(dayInput(t)).toBe('2026-09-24');
		expect(formatDateTime(t)).toBe('24 sht 2026, 12:00');
	});
	it('rejects what is not a day', () => {
		expect(parseDay('24/09/2026')).toBeNull();
		expect(parseDay('2026-02-30')).toBeNull();
	});
	it('finds midnight', () =>
		expect(startOfDay(utc('2026-09-24T10:00:00Z'))).toBe(utc('2026-09-23T22:00:00Z')));
});
