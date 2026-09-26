/**
 * Row: one line of the order form, as the browser edits it.
 *   key:  names its fields (garment-<key>, …)
 *   id:   the order line it edits, or null for a new one
 *   art:  "none", "custom", or "design:<id>"
 *   front/back:            previews of mockups picked now
 *   keptFront/keptBack:    mockups the line already has (editing)
 */
import type { Color, Garment, OrderLine, Print } from '$lib/domain/model';
import { euroInput } from '$lib/domain/money';

export type Row = {
	key: number;
	id: string | null;
	garment: Garment;
	color: Color;
	size: string;
	art: string;
	qty: string;
	price: string;
	front: string | null;
	back: string | null;
	keptFront: string | null;
	keptBack: string | null;
};

let next = 0;

/** newRow : Cents Row? -> Row — a fresh line, copying the shirt of the one above. */
export const newRow = (defaultPrice: number, from?: Row): Row => ({
	key: next++,
	id: null,
	garment: from?.garment ?? 'oversized_200g',
	color: from?.color ?? 'black',
	size: 'M',
	art: from?.art === 'custom' ? 'none' : (from?.art ?? 'none'),
	qty: '1',
	price: from?.price ?? euroInput(defaultPrice),
	front: null,
	back: null,
	keptFront: null,
	keptBack: null
});

/** rowOf : OrderLine [Print] -> Row — an existing line, ready to edit. */
export function rowOf(l: OrderLine, prints: Print[]): Row {
	const a = l.artwork;
	const designId = a.kind === 'print' ? prints.find((p) => p.id === a.printId)?.designId : undefined;
	return {
		key: next++,
		id: l.id,
		garment: l.sku.garment,
		color: l.sku.color,
		size: l.sku.size === 'unknown' ? 'M' : l.sku.size,
		art: a.kind === 'custom' ? 'custom' : designId ? `design:${designId}` : 'none',
		qty: String(l.quantity),
		price: euroInput(l.unitPrice),
		front: null,
		back: null,
		keptFront: a.kind === 'custom' ? a.front : null,
		keptBack: a.kind === 'custom' ? a.back : null
	};
}
