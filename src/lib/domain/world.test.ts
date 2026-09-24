import { describe, expect, it } from 'vitest';
import { apply, customerByPhone, nextCode, normalizePhone } from './world';
import { customer, order, world } from './testing';

describe('normalizePhone / customerByPhone', () => {
	it('reads a number however it was typed', () => {
		expect(normalizePhone('+383 44 111-222')).toBe('38344111222');
		expect(normalizePhone('0038344111222')).toBe('38344111222');
	});
	it('finds the customer by number', () => {
		const w = world({ customers: [customer({ phone: '+383 44 111 222' })] });
		expect(customerByPhone(w, '0038344111222')?.id).toBe('C1');
		expect(customerByPhone(w, '049 000 000')).toBeUndefined();
		expect(customerByPhone(w, '')).toBeUndefined();
	});
});

describe('nextCode', () => {
	it('counts on from the highest code', () => {
		expect(nextCode([])).toBe('HS-0001');
		expect(nextCode([order({ code: 'HS-0041' }), order({ code: 'HS-0007' })])).toBe('HS-0042');
	});
});

describe('apply', () => {
	it('puts, replaces and deletes', () => {
		const w0 = world();
		const w1 = apply(w0, [{ put: 'order', value: order() }]);
		expect(w1.orders).toHaveLength(1);
		const w2 = apply(w1, [{ put: 'order', value: order({ notes: 'x' }) }]);
		expect(w2.orders).toEqual([order({ notes: 'x' })]);
		expect(apply(w2, [{ delete: 'order', id: 'O1' }]).orders).toEqual([]);
		expect(w0.orders).toEqual([]); // the old world is untouched
	});
});
