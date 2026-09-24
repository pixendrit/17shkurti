<script lang="ts">
	import Empty from '$lib/components/Empty.svelte';
	import { money, formatDate, plural, COUNTRY_LABELS } from '$lib/ui';
	import Search from '@lucide/svelte/icons/search';

	let { data } = $props();
	const returning = $derived(data.customers.filter((c) => c.orders > 1).length);
</script>

<svelte:head><title>Klientët — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-baseline justify-between gap-3">
	<h1 class="text-xl font-semibold text-slate-900">Klientët</h1>
	<span class="text-sm text-slate-500">{plural(data.customers.length, 'klient', 'klientë')} · {returning} blejnë sërish</span>
</div>

<form class="mb-4 flex gap-2" data-sveltekit-keepfocus>
	<div class="relative flex-1">
		<Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
		<input name="q" value={data.q} placeholder="Kërko emër, telefon, qytet…" class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-slate-900 focus:outline-none" />
	</div>
	<button class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Kërko</button>
</form>

{#if data.customers.length === 0}
	<div class="rounded-xl border border-slate-200 bg-white"><Empty message="Asnjë klient" /></div>
{:else}
	<ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
		{#each data.customers as c (c.id)}
			<li>
				<a href="/orders?q={encodeURIComponent(c.phone)}" class="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50">
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-slate-900">{c.name}</p>
						<p class="truncate text-xs text-slate-500">{c.phone} · {[c.city, COUNTRY_LABELS[c.country]].filter(Boolean).join(', ')}</p>
					</div>
					<div class="shrink-0 text-right">
						<p class="tabular text-sm font-medium">{money(c.spent)}</p>
						<p class="text-[11px] text-slate-500">{plural(c.orders, 'porosi', 'porosi')}{c.gifts ? ` · ${c.gifts} dhuratë` : ''}{c.last ? ` · ${formatDate(c.last)}` : ''}</p>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}
