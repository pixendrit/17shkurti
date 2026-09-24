<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import { money, formatDate, plural, CHANNEL_LABELS } from '$lib/constants';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Gift from '@lucide/svelte/icons/gift';
	import Brush from '@lucide/svelte/icons/brush';
	import Hand from '@lucide/svelte/icons/hand';

	let { data } = $props();

	const tabs = [
		{ key: 'open', label: 'Të hapura' },
		{ key: 'new', label: 'Të reja' },
		{ key: 'in_production', label: 'Në prodhim' },
		{ key: 'pickup', label: 'Pret postierin' },
		{ key: 'courier', label: 'Te postieri' },
		{ key: 'delivered', label: 'Të dorëzuara' },
		{ key: 'returned', label: 'Të kthyera' },
		{ key: 'all', label: 'Të gjitha' }
	];

	/** Keep the other filters when one changes. */
	function href(change: Record<string, string>) {
		const p = new URLSearchParams();
		for (const [k, v] of Object.entries({ ...data.filters, ...change })) if (v) p.set(k, v);
		return `/orders?${p}`;
	}
</script>

<svelte:head><title>Porositë — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center justify-between gap-3">
	<h1 class="text-xl font-semibold text-slate-900">Porositë</h1>
	<a href="/orders/new" class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
		<Plus class="size-4" /> Porosi e re
	</a>
</div>

<form class="mb-3 flex gap-2" data-sveltekit-keepfocus action="/orders">
	{#each Object.entries(data.filters) as [k, v] (k)}{#if k !== 'q' && v}<input type="hidden" name={k} value={v} />{/if}{/each}
	<div class="relative flex-1">
		<Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
		<input name="q" value={data.filters.q} placeholder="Kërko emër, telefon, qytet, kod…" class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-slate-900 focus:outline-none" />
	</div>
	<button class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Kërko</button>
</form>

<div class="mb-2 flex gap-1 overflow-x-auto pb-1">
	{#each tabs as t (t.key)}
		<a href={href({ status: t.key })} class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium {data.filters.status === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}">{t.label}</a>
	{/each}
</div>

<div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
	<select onchange={(e) => (location.href = href({ channel: e.currentTarget.value }))} class="rounded-lg border border-slate-300 bg-white px-2 py-1.5">
		<option value="" selected={!data.filters.channel}>Çdo burim</option>
		{#each Object.entries(CHANNEL_LABELS) as [k, v] (k)}<option value={k} selected={data.filters.channel === k}>{v}</option>{/each}
	</select>
	<select onchange={(e) => (location.href = href({ kind: e.currentTarget.value }))} class="rounded-lg border border-slate-300 bg-white px-2 py-1.5">
		<option value="" selected={!data.filters.kind}>Shitje dhe dhurata</option>
		<option value="sale" selected={data.filters.kind === 'sale'}>Vetëm shitje</option>
		<option value="gift" selected={data.filters.kind === 'gift'}>Vetëm dhurata</option>
	</select>
	<select onchange={(e) => (location.href = href({ delivery: e.currentTarget.value }))} class="rounded-lg border border-slate-300 bg-white px-2 py-1.5">
		<option value="" selected={!data.filters.delivery}>Çdo dërgesë</option>
		<option value="post" selected={data.filters.delivery === 'post'}>Me postë</option>
		<option value="manual" selected={data.filters.delivery === 'manual'}>Dorëzim personal</option>
	</select>
	<span class="ml-auto text-slate-500">{plural(data.orders.length, 'porosi', 'porosi')} · {money(data.total)}</span>
</div>

{#if data.orders.length === 0}
	<div class="rounded-xl border border-slate-200 bg-white">
		<Empty message="Nuk ka porosi këtu" hint="Shtypni “Porosi e re” kur të vijë mesazhi i radhës." />
	</div>
{:else}
	<div class="space-y-2">
		{#each data.orders as o (o.id)}
			<a href="/orders/{o.id}" class="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="font-mono text-xs text-slate-400">{o.code}</span>
							<StatusBadge status={o.status} delivery={o.deliveryMethod} />
							{#if o.kind === 'gift'}<span class="inline-flex items-center gap-0.5 rounded bg-pink-50 px-1.5 py-0.5 text-[11px] font-medium text-pink-700"><Gift class="size-3" /> Dhuratë</span>{/if}
							{#if o.hasCustom}<span class="inline-flex items-center gap-0.5 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700"><Brush class="size-3" /> Personalizuar</span>{/if}
							{#if o.deliveryMethod === 'manual'}<span class="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"><Hand class="size-3" /> Me dorë</span>{/if}
							{#if o.kind === 'sale' && o.paymentStatus === 'paid'}<span class="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">E paguar</span>{/if}
						</div>
						<p class="mt-1 truncate font-medium text-slate-900">{o.customerName}</p>
						<p class="truncate text-sm text-slate-500">{[o.city, CHANNEL_LABELS[o.channel] ?? o.channel].filter(Boolean).join(' · ')}</p>
						<p class="mt-1 truncate text-xs text-slate-500">{plural(o.units, 'copë', 'copë')} · {o.summary}</p>
					</div>
					<div class="shrink-0 text-right">
						<p class="tabular font-semibold text-slate-900">{o.kind === 'gift' ? 'Falas' : money(o.revenue)}</p>
						<p class="text-xs text-slate-400">{formatDate(o.createdAt)}</p>
						{#if o.canMake === true}
							<span class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"><CircleCheck class="size-3.5" /> Mund të bëhet</span>
						{:else if o.canMake === false}
							<span class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"><TriangleAlert class="size-3.5" /> Mungon stoku</span>
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
