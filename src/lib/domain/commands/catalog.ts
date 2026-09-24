/**
 * Commands on the catalogue: designs, and their prints for each shirt colour.
 */
import { COLORS, type Change, type Color, type Context, type Design, type Id, type Print, type Upload, type World } from '../model';
import { fail, ok, type Result } from '../result';
import { findDesign, findPrint } from '../world';
import { storeImage } from './common';

const checkPerSheet = (n: number) => Number.isInteger(n) && n >= 1 && n <= 100;

/** nameTaken : World String Id? -> Boolean — another design already has this name. */
const nameTaken = (w: World, name: string, except?: Id) =>
	w.designs.some((d) => d.id !== except && d.name.trim().toLowerCase() === name.trim().toLowerCase());

/**
 * createDesign : World (name, notes, colours, perSheet) Context -> Result<[Change]>
 * A new design, with a print for each shirt colour it's printed on.
 */
export function createDesign(
	w: World,
	input: { name: string; notes: string; colors: Color[]; perSheet: number },
	ctx: Context
): Result<Change[]> {
	const name = input.name.trim();
	if (!name) return fail('Jepini dizajnit një emër.');
	if (nameTaken(w, name)) return fail(`Ekziston tashmë një dizajn „${name}”.`);
	const colors = COLORS.filter((c) => input.colors.includes(c));
	if (colors.length === 0) return fail('Zgjidhni të paktën një ngjyrë bluze.');
	if (!checkPerSheet(input.perSheet)) return fail('Printime për fletë: një numër nga 1 deri në 100.');
	const design: Design = { id: ctx.newId(), name, notes: input.notes.trim(), archived: false, createdAt: ctx.now };
	return ok([
		{ put: 'design', value: design },
		...colors.map((shirtColor): Change => ({
			put: 'print',
			value: { id: ctx.newId(), designId: design.id, shirtColor, perSheet: input.perSheet, front: null, back: null }
		}))
	]);
}

/** editDesign : World (id, name, notes, archived) Context -> Result<[Change]> */
export function editDesign(
	w: World,
	input: { designId: Id; name: string; notes: string; archived: boolean },
	_ctx: Context
): Result<Change[]> {
	const d = findDesign(w, input.designId);
	if (!d) return fail('Dizajni nuk u gjet.');
	const name = input.name.trim();
	if (!name) return fail('Jepini dizajnit një emër.');
	if (nameTaken(w, name, d.id)) return fail(`Ekziston tashmë një dizajn „${name}”.`);
	return ok([{ put: 'design', value: { ...d, name, notes: input.notes.trim(), archived: input.archived } }]);
}

/** addPrint : World (design, colour, perSheet) Context -> Result<[Change]> — print a design on another colour. */
export function addPrint(w: World, input: { designId: Id; color: Color; perSheet: number }, ctx: Context): Result<Change[]> {
	if (!findDesign(w, input.designId)) return fail('Dizajni nuk u gjet.');
	if (!(COLORS as readonly string[]).includes(input.color)) return fail('Ngjyrë e panjohur.');
	if (w.prints.some((p) => p.designId === input.designId && p.shirtColor === input.color))
		return fail('Ky dizajn e ka tashmë këtë print.');
	if (!checkPerSheet(input.perSheet)) return fail('Printime për fletë: një numër nga 1 deri në 100.');
	const p: Print = { id: ctx.newId(), designId: input.designId, shirtColor: input.color, perSheet: input.perSheet, front: null, back: null };
	return ok([{ put: 'print', value: p }]);
}

/**
 * editPrint : World (print, perSheet) Context -> Result<[Change]>
 * How many fit on a sheet. Changes the DTF cost of orders taken from now on.
 */
export function editPrint(w: World, input: { printId: Id; perSheet: number }, _ctx: Context): Result<Change[]> {
	const p = findPrint(w, input.printId);
	if (!p) return fail('Printi nuk u gjet.');
	if (!checkPerSheet(input.perSheet)) return fail('Printime për fletë: një numër nga 1 deri në 100.');
	return ok([{ put: 'print', value: { ...p, perSheet: input.perSheet } }]);
}

/**
 * setPrintImage : World (print, side, picture) Context -> Result<[Change]>
 * Puts a picture on the front or back of a print, replacing the old one.
 */
export function setPrintImage(
	w: World,
	input: { printId: Id; side: 'front' | 'back'; image: Upload },
	ctx: Context
): Result<Change[]> {
	const p = findPrint(w, input.printId);
	if (!p) return fail('Printi nuk u gjet.');
	if (input.side !== 'front' && input.side !== 'back') return fail('Ana e panjohur.');
	const img = storeImage(input.image, ctx);
	if (!img.ok) return img;
	const old = p[input.side];
	return ok([
		{ put: 'image', value: img.value },
		{ put: 'print', value: { ...p, [input.side]: img.value.id } },
		...(old ? [{ delete: 'image', id: old } as Change] : [])
	]);
}

/**
 * deleteDesign : World Id Context -> Result<[Change]>
 * Removes a design that was never used. One that was is archived instead:
 * past orders still name it.
 */
export function deleteDesign(w: World, designId: Id, _ctx: Context): Result<Change[]> {
	const d = findDesign(w, designId);
	if (!d) return fail('Dizajni nuk u gjet.');
	const prints = w.prints.filter((p) => p.designId === d.id);
	const ids = new Set(prints.map((p) => p.id));
	const used =
		w.orders.some((o) => o.lines.some((l) => l.artwork.kind === 'print' && ids.has(l.artwork.printId))) ||
		w.movements.some((m) => m.subject.kind === 'print' && ids.has(m.subject.printId));
	if (used) return fail('Ky dizajn është përdorur në porosi ose stok: arkivojeni në vend që ta fshini.');
	return ok([
		...prints.flatMap((p): Change[] => [
			...[p.front, p.back].filter((x): x is string => !!x).map((id): Change => ({ delete: 'image', id })),
			{ delete: 'print', id: p.id }
		]),
		{ delete: 'design', id: d.id }
	]);
}
