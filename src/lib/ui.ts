/**
 * What pages share: formatting, labels, and the look of common elements.
 */
export { formatEuro as money, euroInput } from '$lib/domain/money';
export { formatDate, formatDateTime, dayInput, monthLabel } from '$lib/domain/time';
export * from '$lib/domain/labels';
import type { Status } from '$lib/domain/model';

/** Tailwind classes per status, so badges look the same everywhere. */
export const STATUS_STYLES: Record<Status, string> = {
	new: 'bg-blue-100 text-blue-800 ring-blue-600/20',
	in_production: 'bg-amber-100 text-amber-900 ring-amber-600/20',
	ready: 'bg-purple-100 text-purple-800 ring-purple-600/20',
	with_courier: 'bg-cyan-100 text-cyan-900 ring-cyan-600/20',
	delivered: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
	returned: 'bg-rose-100 text-rose-800 ring-rose-600/20',
	cancelled: 'bg-slate-200 text-slate-600 ring-slate-500/20'
};

export const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
export const small = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm';
export const label = 'mb-1 block text-xs font-medium text-slate-600';
export const card = 'rounded-xl border border-slate-200 bg-white shadow-sm';
export const primary =
	'inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50';
export const secondary =
	'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

/** imageUrl : Id -> String — a stored picture. */
export const imageUrl = (id: string) => `/api/image/${id}`;
