<script lang="ts">
	import { money, formatDate, plural, COUNTRY_LABELS } from '$lib/constants';
	import Truck from '@lucide/svelte/icons/truck';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import Hand from '@lucide/svelte/icons/hand';
	import Wallet from '@lucide/svelte/icons/wallet';
	import Gift from '@lucide/svelte/icons/gift';
	import type { Snippet } from 'svelte';
	import { deliverOrders, setOrderStatus, settleOrders, shipOrders } from '$lib/client/actions';

	let { data } = $props();
	type Row = (typeof data.awaitingPickup)[number];

	/** Selected order ids per section. */
	let picked = $state<Record<string, number[]>>({ pickup: [], courier: [], hand: [], unpaid: [] });
	let busy = $state(false);
	let error = $state<string | null>(null);

	function toggle(section: string, id: number) {
		const list = picked[section];
		picked[section] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}
	function toggleAll(section: string, rows: Row[]) {
		picked[section] = picked[section].length === rows.length ? [] : rows.map((r) => r.id);
	}
	const total = (rows: Row[], ids: number[]) => rows.filter((r) => ids.includes(r.id)).reduce((a, r) => a + r.revenue, 0);

	async function act(section: string, fn: (ids: number[]) => Promise<unknown>) {
		if (picked[section].length === 0) return;
		busy = true;
		error = null;
		try {
			await fn(picked[section]);
			picked[section] = [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Diçka shkoi keq.';
		} finally {
			busy = false;
		}
	}

	async function one(fn: () => Promise<unknown>) {
		error = null;
		try {
			await fn();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Diçka shkoi keq.';
		}
	}
</script>

<svelte:head><title>Dërgesat — Hijeshi</title></svelte:head>

<h1 class="mb-5 text-xl font-semibold text-slate-900">Dërgesat</h1>

{#if error}<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>{/if}

{#snippet list(section: string, rows: Row[], empty: string, extra?: Snippet<[Row]>)}
	{#if rows.length === 0}
		<p class="px-4 py-6 text-center text-sm text-slate-500">{empty}</p>
	{:else}
		<div class="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
			<input type="checkbox" checked={picked[section].length === rows.length} onchange={() => toggleAll(section, rows)} aria-label="Zgjidh të gjitha" class="size-4 rounded border-slate-300" />
			Zgjidh të gjitha
		</div>
		<ul class="divide-y divide-slate-100">
			{#each rows as r (r.id)}
				<li class="flex items-center gap-3 px-4 py-2.5">
					<input type="checkbox" checked={picked[section].includes(r.id)} onchange={() => toggle(section, r.id)} aria-label="Zgjidh {r.code}" class="size-4 shrink-0 rounded border-slate-300" />
					<a href="/orders/{r.id}" class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-slate-900">
							{r.customerName}
							{#if r.kind === 'gift'}<Gift class="inline size-3.5 text-pink-600" />{/if}
						</p>
						<p class="truncate text-xs text-slate-500">
							{r.code} · {[r.city, COUNTRY_LABELS[r.country]].filter(Boolean).join(', ')} · {plural(r.units, 'copë', 'copë')}
							{#if r.trackingRef} · <span class="font-mono">{r.trackingRef}</span>{/if}
						</p>
					</a>
					<div class="shrink-0 text-right">
						<p class="tabular text-sm font-medium">{r.kind === 'gift' ? 'Falas' : money(r.revenue)}</p>
						<p class="text-[11px] text-slate-400">{formatDate(r.since)}</p>
					</div>
					{#if extra}{@render extra(r)}{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet courierButtons(r: Row)}
	<button onclick={() => one(() => setOrderStatus(r.id, 'returned'))} class="shrink-0 rounded-md border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50">Kthyer</button>
{/snippet}

<div class="grid gap-4 *:min-w-0 lg:grid-cols-2">
	<section class="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<PackageCheck class="size-4 text-purple-600" />
			<h2 class="text-sm font-semibold text-slate-900">Pret postierin</h2>
			<span class="ml-auto text-xs text-slate-400">{data.awaitingPickup.length}</span>
		</header>
		{@render list('pickup', data.awaitingPickup, 'Asnjë pako nuk pret postierin.')}
		{#if data.awaitingPickup.length}
			<div class="border-t border-slate-100 p-3">
				<button disabled={busy || !picked.pickup.length} onclick={() => act('pickup', shipOrders)} class="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
					Dorëzo te postieri ({picked.pickup.length})
				</button>
			</div>
		{/if}
	</section>

	<section class="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<Truck class="size-4 text-cyan-600" />
			<h2 class="text-sm font-semibold text-slate-900">Te postieri</h2>
			<span class="ml-auto text-xs text-slate-400">{data.withCourier.length}</span>
		</header>
		{@render list('courier', data.withCourier, 'Asnjë pako te postieri.', courierButtons)}
		{#if data.withCourier.length}
			<div class="border-t border-slate-100 p-3">
				<button disabled={busy || !picked.courier.length} onclick={() => act('courier', deliverOrders)} class="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
					U dorëzuan te klienti ({picked.courier.length})
				</button>
			</div>
		{/if}
	</section>

	<section class="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<Hand class="size-4 text-amber-600" />
			<h2 class="text-sm font-semibold text-slate-900">Për dorëzim personal</h2>
			<span class="ml-auto text-xs text-slate-400">{data.toHandOver.length}</span>
		</header>
		{@render list('hand', data.toHandOver, 'Asgjë për t’u dorëzuar me dorë.')}
		{#if data.toHandOver.length}
			<div class="border-t border-slate-100 p-3">
				<button disabled={busy || !picked.hand.length} onclick={() => act('hand', deliverOrders)} class="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
					U dorëzuan ({picked.hand.length})
				</button>
			</div>
		{/if}
	</section>

	<section class="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<Wallet class="size-4 text-emerald-600" />
			<h2 class="text-sm font-semibold text-slate-900">Dorëzuar, pa u paguar</h2>
			<span class="ml-auto text-xs text-slate-400">{money(data.unpaid.reduce((a, r) => a + r.revenue, 0))}</span>
		</header>
		{@render list('unpaid', data.unpaid, 'Të gjitha të dorëzuarat janë paguar.')}
		{#if data.unpaid.length}
			<div class="border-t border-slate-100 p-3">
				<button disabled={busy || !picked.unpaid.length} onclick={() => act('unpaid', settleOrders)} class="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
					U paguan / barazuan · {money(total(data.unpaid, picked.unpaid))}
				</button>
			</div>
		{/if}
	</section>
</div>
