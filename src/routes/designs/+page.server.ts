import { addPrint, createDesign, deleteDesign, editDesign, editPrint, setPrintImage } from '$lib/domain/commands/catalog';
import { whole } from '$lib/domain/forms';
import { COLORS, type Color } from '$lib/domain/model';
import { fail, ok } from '$lib/domain/result';
import { designsView } from '$lib/domain/views';
import { act, load as world } from '$lib/server/shop';

export const load = async (event) => ({ designs: designsView(await world(event)) });

const color = (v: string): Color => ((COLORS as readonly string[]).includes(v) ? (v as Color) : 'black');

export const actions = {
	create: (e) =>
		act(e, createDesign, (f) =>
			ok({ name: f.text('name'), notes: f.text('notes'), colors: f.list('color').map(color), perSheet: whole(f.text('perSheet')) ?? 0 })
		),
	edit: (e) =>
		act(e, editDesign, (f) => ok({ designId: f.text('designId'), name: f.text('name'), notes: f.text('notes'), archived: f.text('archived') === '1' })),
	delete: (e) => act(e, deleteDesign, (f) => ok(f.text('designId'))),
	addPrint: (e) =>
		act(e, addPrint, (f) => ok({ designId: f.text('designId'), color: color(f.text('color')), perSheet: whole(f.text('perSheet')) ?? 4 })),
	perSheet: (e) => act(e, editPrint, (f) => ok({ printId: f.text('printId'), perSheet: whole(f.text('perSheet')) ?? 0 })),
	image: (e) =>
		act(e, setPrintImage, (f) => {
			const image = f.upload('image');
			const side = f.text('side') === 'back' ? 'back' : 'front';
			return image ? ok({ printId: f.text('printId'), side, image }) : fail('Zgjidhni një foto.');
		})
};
