/*
 * Stored values (product types, colours, statuses, channels) stay in English:
 * they are database keys, and orders are matched to stock by comparing them.
 * Only what's shown on screen is Albanian, through the label maps below.
 */
export const PRODUCT_TYPES = ['T-Shirt', 'Hoodie', 'Long Sleeve', 'Tote Bag'];
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const COLORS = ['White', 'Black', 'Grey', 'Navy', 'Beige', 'Red'];

const PRODUCT_LABELS: Record<string, string> = {
	'T-Shirt': 'Bluzë',
	Hoodie: 'Duks me kapuç',
	'Long Sleeve': 'Bluzë me mëngë të gjata',
	'Tote Bag': 'Çantë pëlhure'
};

const COLOR_LABELS: Record<string, string> = {
	White: 'E bardhë',
	Black: 'E zezë',
	Grey: 'Gri',
	Navy: 'Blu e errët',
	Beige: 'Bezhë',
	Red: 'E kuqe'
};

export const productLabel = (v: string) => PRODUCT_LABELS[v] ?? v;
export const colorLabel = (v: string) => COLOR_LABELS[v] ?? v;

export const STATUS_LABELS: Record<string, string> = {
	new: 'E re',
	confirmed: 'E konfirmuar',
	in_production: 'Në prodhim',
	ready: 'Gati',
	shipped: 'E nisur',
	delivered: 'E dorëzuar',
	cancelled: 'E anuluar'
};

/** Tailwind classes per status. Kept here so badges look the same everywhere. */
export const STATUS_STYLES: Record<string, string> = {
	new: 'bg-blue-100 text-blue-800 ring-blue-600/20',
	confirmed: 'bg-indigo-100 text-indigo-800 ring-indigo-600/20',
	in_production: 'bg-amber-100 text-amber-900 ring-amber-600/20',
	ready: 'bg-purple-100 text-purple-800 ring-purple-600/20',
	shipped: 'bg-cyan-100 text-cyan-900 ring-cyan-600/20',
	delivered: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
	cancelled: 'bg-slate-200 text-slate-600 ring-slate-500/20'
};

export const CHANNEL_LABELS: Record<string, string> = {
	instagram: 'Instagram',
	messenger: 'Messenger',
	tiktok: 'TikTok',
	whatsapp: 'WhatsApp',
	other: 'Tjetër'
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
	cash_on_delivery: 'Pagesë në dorëzim',
	bank_transfer: 'Transfertë bankare',
	cash: 'Kesh'
};

/** Statuses that still need blanks and transfers reserved for them. */
export const OPEN_STATUSES = ['new', 'confirmed', 'in_production', 'ready'];

export const CURRENCY = 'L';

/*
 * Formatted by hand rather than with toLocaleString('sq-AL'): the page renders
 * on the server and again in the browser, and their locale data can differ.
 * Hand-formatting guarantees the same text in both.
 */
export const MONTHS = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'kor', 'gsh', 'sht', 'tet', 'nën', 'dhj'];

export function money(n: number): string {
	const rounded = Math.round(n);
	// Non-breaking spaces, so "4 500 L" never wraps across lines in a narrow tile.
	const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
	return `${rounded < 0 ? '−' : ''}${digits}\u00a0${CURRENCY}`;
}

export function formatDate(ts: number | null): string {
	if (!ts) return '—';
	const d = new Date(ts * 1000);
	return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "1 artikull" / "3 artikuj" */
export function plural(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}
