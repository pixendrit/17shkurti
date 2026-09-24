<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import { money, formatDate, plural, CHANNEL_LABELS } from '$lib/ui';
	import { ORDER_TABS, ORDER_TAB_LABELS } from '$lib/domain/views';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Gift from '@lucide/svelte/icons/gift';
	import Brush from '@lucide/svelte/icons/brush';
	import Hand from '@lucide/svelte/icons/hand';

	let { data } = $props();
</script>

<svelte:head><title>Porositë — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center justify-between gap-3">
	<h1 class="text-xl font-semibold text-slate-900">Porositë</h1>
	<a href="/orders/new" class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
		<Plus class="size-4" /> Porosi e re
	</a>
</div>

<form class="mb-3 flex gap-2" data-sveltekit-keepfocus action="/orders">
	<input type="hidden" name="tab" value={data.tab} />
	<div class="relative flex-1">
		<Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
		<input name="q" value={data.q} placeholder="Kërko emër, telefon, qytet, kod, nr. dërgese…" class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-slate-900 focus:outline-none" />
	</div>
	<button class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Kërko</button>
</form>

{#if data.q}
	<p class="mb-3 text-sm text-slate-600">
		Rezultatet për „{data.q}” në të gjitha porositë · <a href="/orders?tab={data.tab}" class="font-medium text-slate-900 underline">pastro</a>
	</p>
{:else}
	<div class="mb-3 flex gap-1 overflow-x-auto pb-1">
		{#each ORDER_TABS as t (t)}
			<a href="/orders?tab={t}" class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium {data.tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}">
				{ORDER_TAB_LABELS[t]} <span class="ml-0.5 text-xs opacity-60">{data.counts[t]}</span>
			</a>
		{/each}
	</div>
{/if}

<p class="mb-2 text-right text-xs text-slate-500">{plural(data.rows.length, 'porosi', 'porosi')} · {money(data.total)}</p>

{#if data.rows.length === 0}
	<div class="rounded-xl border border-slate-200 bg-white">
		<Empty message="Nuk ka porosi këtu" hint="Shtypni “Porosi e re” kur të vijë mesazhi i radhës." />
	</div>
{:else}
	<div class="space-y-2">
		{#each data.rows as o (o.id)}
			<a href="/orders/{o.id}" class="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="font-mono text-xs text-slate-400">{o.code}</span>
							<StatusBadge status={o.status} label={o.statusLabel} />
							{#if o.kind === 'gift'}<span class="inline-flex items-center gap-0.5 rounded bg-pink-50 px-1.5 py-0.5 text-[11px] font-medium text-pink-700"><Gift class="size-3" /> Dhuratë</span>{/if}
							{#if o.custom}<span class="inline-flex items-center gap-0.5 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700"><Brush class="size-3" /> Personalizuar</span>{/if}
							{#if o.method === 'hand'}<span class="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"><Hand class="size-3" /> Me dorë</span>{/if}
							{#if o.kind === 'sale' && o.balance <= 0 && o.total > 0}<span class="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">E paguar</span>{/if}
							{#if o.isDemo}<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">demo</span>{/if}
						</div>
						<p class="mt-1 truncate font-medium text-slate-900">{o.customer}</p>
						<p class="truncate text-sm text-slate-500">{[o.city, CHANNEL_LABELS[o.channel]].filter(Boolean).join(' · ')}</p>
						<p class="mt-1 truncate text-xs text-slate-500">{o.summary}</p>
					</div>
					<div class="shrink-0 text-right">
						<p class="tabular font-semibold text-slate-900">{o.kind === 'gift' ? 'Falas' : money(o.total)}</p>
						{#if o.kind === 'sale' && o.balance > 0 && o.balance < o.total}<p class="tabular text-[11px] text-amber-700">mbeten {money(o.balance)}</p>{/if}
						<p class="text-xs text-slate-400">{formatDate(o.createdAt)}</p>
						{#if o.canMake === true}
							<span class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"><CircleCheck class="size-3.5" /> Mund të bëhet</span>
						{:else if o.canMake === false}
							<span class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"><TriangleAlert class="size-3.5" /> Në pritje</span>
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
