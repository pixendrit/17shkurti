<script lang="ts">
	import StatTile from '$lib/components/StatTile.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { money } from '$lib/constants';
	import { base } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Truck from '@lucide/svelte/icons/truck';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import Printer from '@lucide/svelte/icons/printer';

	let { data } = $props();
</script>

<svelte:head><title>Dashboard — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center justify-between gap-3">
	<div>
		<h1 class="text-xl font-semibold text-slate-900">Today</h1>
		<p class="text-sm text-slate-500">
			{data.openCount} open order{data.openCount === 1 ? '' : 's'}{#if data.newCount > 0}, {data.newCount} brand new{/if}
		</p>
	</div>
	<a href="{base}/orders/new" class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
		<Plus class="size-4" /> New order
	</a>
</div>

<div class="mb-5 grid grid-cols-3 gap-3">
	<StatTile label="Revenue (30d)" value={money(data.revenue30)} />
	<StatTile label="Profit (30d)" value={money(data.profit30)} tone="good" />
	<StatTile label="Still owed" value={money(data.outstanding)} tone={data.outstanding > 0 ? 'warn' : 'neutral'} />
</div>

{#if data.toBuyCount > 0 || data.toPrint.length > 0}
	<div class="mb-5 grid gap-3 sm:grid-cols-2">
		{#if data.toBuyCount > 0}
			<a href="{base}/stock" class="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 hover:border-amber-300">
				<ShoppingCart class="size-5 shrink-0 text-amber-700" />
				<div>
					<p class="text-sm font-semibold text-amber-900">Buy {data.toBuyCount} blank{data.toBuyCount === 1 ? '' : 's'}</p>
					<p class="text-xs text-amber-800">Open orders need them</p>
				</div>
			</a>
		{/if}
		{#if data.toPrint.length > 0}
			<a href="{base}/stock" class="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 hover:border-purple-300">
				<Printer class="size-5 shrink-0 text-purple-700" />
				<div>
					<p class="text-sm font-semibold text-purple-900">Print {data.toPrint.length} design{data.toPrint.length === 1 ? '' : 's'}</p>
					<p class="truncate text-xs text-purple-800">{data.toPrint.map((t) => t.designName).join(', ')}</p>
				</div>
			</a>
		{/if}
	</div>
{/if}

<div class="grid gap-4 lg:grid-cols-3">
	{#snippet orderList(orders: any[], empty: string)}
		{#if orders.length === 0}
			<p class="py-6 text-center text-sm text-slate-500">{empty}</p>
		{:else}
			<ul class="divide-y divide-slate-100">
				{#each orders as o (o.id)}
					<li>
						<a href="{base}/orders/{o.id}" class="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50">
							<div class="min-w-0">
								<p class="truncate text-sm font-medium text-slate-900">{o.customerName}</p>
								<p class="truncate text-xs text-slate-500">{o.code} · {o.units} item{o.units === 1 ? '' : 's'}</p>
							</div>
							<div class="shrink-0 text-right">
								<p class="tabular text-sm font-medium">{money(o.total)}</p>
								<StatusBadge status={o.status} />
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/snippet}

	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<CircleCheck class="size-4 text-emerald-600" />
			<h2 class="text-sm font-semibold text-slate-900">Can make now</h2>
			<span class="ml-auto text-xs text-slate-400">{data.canMake.length}</span>
		</header>
		{@render orderList(data.canMake, 'Nothing waiting to be printed.')}
	</section>

	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<TriangleAlert class="size-4 text-amber-600" />
			<h2 class="text-sm font-semibold text-slate-900">Waiting on stock</h2>
			<span class="ml-auto text-xs text-slate-400">{data.blocked.length}</span>
		</header>
		{@render orderList(data.blocked, 'Nothing blocked.')}
	</section>

	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
			<Truck class="size-4 text-cyan-600" />
			<h2 class="text-sm font-semibold text-slate-900">Ready to send</h2>
			<span class="ml-auto text-xs text-slate-400">{data.toShip.length}</span>
		</header>
		{@render orderList(data.toShip, 'Nothing packed yet.')}
	</section>
</div>
