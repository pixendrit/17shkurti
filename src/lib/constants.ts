export const PRODUCT_TYPES = ['T-Shirt', 'Hoodie', 'Long Sleeve', 'Tote Bag'];
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const COLORS = ['White', 'Black', 'Grey', 'Navy', 'Beige', 'Red'];

export const STATUS_LABELS: Record<string, string> = {
	new: 'New',
	confirmed: 'Confirmed',
	in_production: 'In production',
	ready: 'Ready',
	shipped: 'Shipped',
	delivered: 'Delivered',
	cancelled: 'Cancelled'
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
	other: 'Other'
};

/** Statuses that still need blanks and transfers reserved for them. */
export const OPEN_STATUSES = ['new', 'confirmed', 'in_production', 'ready'];

export const CURRENCY = 'L';

export function money(n: number): string {
	const rounded = Math.round(n);
	return `${rounded.toLocaleString('en-US').replace(/,/g, ' ')} ${CURRENCY}`;
}

export function formatDate(ts: number | null): string {
	if (!ts) return '—';
	return new Date(ts * 1000).toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
}
