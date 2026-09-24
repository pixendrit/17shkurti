import { describe, expect, it } from 'vitest';
import type { Change, World } from '../model';
import type { Result } from '../result';
import { apply } from '../world';
import { context, line, order, world } from '../testing';
import { addPrint, createDesign, deleteDesign, editDesign, editPrint, setPrintImage } from './catalog';

const run = (w: World, r: Result<Change[]>) => {
	if (!r.ok) throw new Error(r.error);
	return apply(w, r.value);
};
const png = { mime: 'image/png' as const, data: 'AAAA' };

describe('createDesign', () => {
	it('makes a print for each shirt colour', () => {
		const w = run(world(), createDesign(world(), { name: ' Dardania ', notes: '', colors: ['black', 'white'], perSheet: 5 }, context()));
		const d = w.designs.find((x) => x.name === 'Dardania')!;
		expect(w.prints.filter((p) => p.designId === d.id).map((p) => [p.shirtColor, p.perSheet])).toEqual([
			['black', 5],
			['white', 5]
		]);
	});
	it.each([
		[{ name: '', colors: ['black'], perSheet: 4 }, /emër/],
		[{ name: 'shqiponja', colors: ['black'], perSheet: 4 }, /Ekziston/],
		[{ name: 'X', colors: [], perSheet: 4 }, /ngjyrë/],
		[{ name: 'X', colors: ['black'], perSheet: 0 }, /fletë/]
	] as const)('refuses %j', (input, error) => {
		const r = createDesign(world(), { notes: '', ...input, colors: [...input.colors] }, context());
		expect(!r.ok && r.error).toMatch(error);
	});
});

describe('editing', () => {
	it('renames and archives', () => {
		const w = run(world(), editDesign(world(), { designId: 'D1', name: 'Shqiponja 2', notes: 'n', archived: true }, context()));
		expect(w.designs[0]).toMatchObject({ name: 'Shqiponja 2', notes: 'n', archived: true });
	});
	it('changes prints per sheet', () =>
		expect(run(world(), editPrint(world(), { printId: 'P-white', perSheet: 6 }, context())).prints[1].perSheet).toBe(6));
	it('adds a print only for a colour it lacks', () => {
		expect(addPrint(world(), { designId: 'D1', color: 'white', perSheet: 4 }, context()).ok).toBe(false);
		const w0 = world({ prints: [world().prints[0]] });
		expect(run(w0, addPrint(w0, { designId: 'D1', color: 'white', perSheet: 4 }, context())).prints).toHaveLength(2);
	});
});

describe('setPrintImage', () => {
	it('stores the picture and drops the one it replaces', () => {
		const w0 = world({ prints: [{ ...world().prints[0], front: 'old' }] });
		const r = setPrintImage(w0, { printId: 'P-black', side: 'front', image: png }, context());
		expect(r.ok && r.value).toEqual([
			{ put: 'image', value: expect.objectContaining({ id: 'id1', mime: 'image/png' }) },
			{ put: 'print', value: expect.objectContaining({ front: 'id1' }) },
			{ delete: 'image', id: 'old' }
		]);
	});
	it('refuses what isn’t a picture', () =>
		expect(setPrintImage(world(), { printId: 'P-black', side: 'front', image: { mime: 'text/html' as never, data: 'x' } }, context()).ok).toBe(false));
});

describe('deleteDesign', () => {
	it('deletes an unused design with its prints', () => {
		const w = run(world(), deleteDesign(world(), 'D1', context()));
		expect(w.designs).toEqual([]);
		expect(w.prints).toEqual([]);
	});
	it('keeps a design that orders name', () =>
		expect(deleteDesign(world({ orders: [order({ lines: [line()] })] }), 'D1', context()).ok).toBe(false));
});
