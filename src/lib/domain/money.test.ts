import { describe, expect, it } from 'vitest';
import { divide, euroInput, formatEuro, parseEuro, sum } from './money';

describe('parseEuro', () => {
	it.each([
		['24,50', 2450],
		['24.50', 2450],
		['24', 2400],
		['0.12', 12],
		['0,5', 50],
		['1 250', 125000],
		[' 8 € ', 800]
	])('%s is %i cents', (text, cents) => expect(parseEuro(text)).toBe(cents));

	it.each(['', 'abc', '-3', '1,234', '2.5.1', '12,345'])('%j is not an amount', (text) =>
		expect(parseEuro(text)).toBeNull()
	);
});

describe('formatEuro', () => {
	it.each([
		[2500, '25 €'],
		[2450, '24,50 €'],
		[12, '0,12 €'],
		[125000, '1 250 €'],
		[-300, '−3 €'],
		[0, '0 €']
	])('%i reads %j', (c, text) => expect(formatEuro(c)).toBe(text));
});

describe('euroInput', () => {
	it.each([
		[2500, '25'],
		[2450, '24,50'],
		[12, '0,12'],
		[0, '0']
	])('%i goes back into a field as %j', (c, text) => {
		expect(euroInput(c)).toBe(text);
		expect(parseEuro(euroInput(c))).toBe(c);
	});
});

describe('divide / sum', () => {
	it('splits to the nearest cent', () => {
		expect(divide(1200, 4)).toBe(300);
		expect(divide(1200, 7)).toBe(171);
		expect(divide(1200, 0)).toBe(1200);
	});
	it('adds up', () => expect(sum([{ a: 1 }, { a: 2 }], (x) => x.a)).toBe(3));
});
