/**
 * How each piece of data reads in Albanian. Stored values stay in English
 * (they are keys); only what people see goes through here.
 */
import type {
	Channel,
	Color,
	Country,
	DeliveryMethod,
	ExpenseCategory,
	Garment,
	MovementReason,
	Order,
	OrderEvent,
	OrderKind,
	PaymentMethod,
	Purchase,
	Sku,
	Status,
	Subject,
	World
} from './model';

export const GARMENT_LABELS: Record<Garment, string> = {
	oversized_200g: 'Oversized 200gr',
	regular_fit: 'Regular fit'
};

export const COLOR_LABELS: Record<Color, string> = { black: 'E zezë', white: 'E bardhë' };

export const COUNTRY_LABELS: Record<Country, string> = {
	XK: 'Kosovë',
	AL: 'Shqipëri',
	MK: 'Maqedoni e Veriut',
	OTHER: 'Tjetër'
};

export const CHANNEL_LABELS: Record<Channel, string> = {
	instagram: 'Instagram',
	messenger: 'Messenger',
	tiktok: 'TikTok',
	whatsapp: 'WhatsApp',
	direct: 'Porosi direkte',
	other: 'Tjetër'
};

export const KIND_LABELS: Record<OrderKind, string> = { sale: 'Shitje', gift: 'Dhuratë / influencer' };

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
	courier: 'Me postë',
	hand: 'Dorëzim personal'
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
	cod: 'Pagesë në dorëzim',
	bank: 'Transfertë bankare',
	cash: 'Kesh'
};

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
	packaging: 'Paketim',
	marketing: 'Marketing / reklama',
	equipment: 'Pajisje',
	travel: 'Udhëtime',
	blanks: 'Bluza pa print',
	dtf: 'Fletë DTF',
	other: 'Tjetër'
};

export const PURCHASE_LABELS: Record<Purchase['kind'], string> = {
	blanks: 'Bluza pa print',
	dtf: 'Fletë DTF',
	expense: 'Shpenzim tjetër'
};

export const REASON_LABELS: Record<MovementReason, string> = {
	opening: 'Gjendja fillestare',
	purchase: 'Blerje',
	made: 'Përdorur për porosi',
	unmade: 'Kthyer nga porosia',
	adjustment: 'Rregullim'
};

export const STATUS_LABELS: Record<Status, string> = {
	new: 'E re',
	in_production: 'Në prodhim',
	ready: 'Gati',
	with_courier: 'Te postieri',
	delivered: 'E dorëzuar',
	returned: 'E kthyer',
	cancelled: 'E anuluar'
};

/**
 * statusLabel : Order -> String
 * A ready parcel is waiting for the courier; a ready hand delivery is simply
 * ready to hand over.
 */
export function statusLabel(o: Pick<Order, 'status' | 'delivery'>): string {
	if (o.status === 'ready') return o.delivery.method === 'courier' ? 'Pret postierin' : 'Gati për dorëzim';
	return STATUS_LABELS[o.status];
}

/** What the button for each event says. */
export const EVENT_LABELS: Record<OrderEvent, string> = {
	start: 'Fillo prodhimin',
	make: 'U bë — merr nga stoku',
	hand_over: 'Iu dha postierit',
	deliver: 'U dorëzua',
	return: 'U kthye',
	cancel: 'Anulo',
	undo: 'Zhbëj hapin e fundit'
};

/** sizeLabel : Size -> String — "M", or "masë e panjohur" */
export const sizeLabel = (s: Sku['size']) => (s === 'unknown' ? 'masë e panjohur' : s);

/** skuLabel : Sku -> String — "Oversized 200gr · E zezë · M" */
export const skuLabel = (s: Sku) => `${GARMENT_LABELS[s.garment]} · ${COLOR_LABELS[s.color]} · ${sizeLabel(s.size)}`;

/** printLabel : World Id -> String — "Shqiponja · bluzë e zezë" */
export function printLabel(w: Pick<World, 'designs' | 'prints'>, printId: string): string {
	const p = w.prints.find((x) => x.id === printId);
	const d = p && w.designs.find((x) => x.id === p.designId);
	if (!p || !d) return 'Print i panjohur';
	return `${d.name} · bluzë ${p.shirtColor === 'black' ? 'e zezë' : 'e bardhë'}`;
}

/** subjectLabel : World Subject -> String */
export const subjectLabel = (w: Pick<World, 'designs' | 'prints'>, s: Subject) =>
	s.kind === 'blank' ? skuLabel(s.sku) : `Print DTF: ${printLabel(w, s.printId)}`;

/** plural : Number String String -> String — "1 bluzë", "3 bluza" */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
