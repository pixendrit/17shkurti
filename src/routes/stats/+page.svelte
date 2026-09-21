<script lang="ts">
	import StatTile from '$lib/components/StatTile.svelte';
	import BarList from '$lib/components/BarList.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import { money, CHANNEL_LABELS } from '$lib/constants';
	import { base } from '$app/paths';

	let { data } = $props();
	let showTable = $state(false);

	const ranges = [
		{ days: 30, label: '30 days' },
		{ days: 90, label: '90 days' },
		{ days: 365, label: '1 year' },
		{ days: 0, label: 'All time' }
	];

	const pct = (n: number) => `${Math.round(n * 100)}%`;
</script>

<svelte:head><title>Stats — Hijeshi</title></svelte:head>

<!-- viz-root carries the chart colour roles, light and dark -->
<div class="viz-root">
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-xl font-semibold text-slate-900">Stats</h1>
		<div class="flex gap-1">
			{#each ranges as r (r.days)}
				<a
					href="{base}/stats?days={r.days}"
					class="rounded-lg px-3 py-1.5 text-sm font-medium
					{data.days === r.days ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}"
				>
					{r.label}
				</a>
			{/each}
		</div>
	</div>

	<div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Revenue" value={money(data.revenue)} sub="{data.orderCount} orders" />
		<StatTile label="Profit" value={money(data.profit)} sub="{pct(data.margin)} margin" tone="good" />
		<StatTile label="Collected" value={money(data.collected)} sub="actually in hand" />
		<StatTile
			label="Still owed"
			value={money(data.outstanding)}
			sub="unpaid orders"
			tone={data.outstanding > 0 ? 'warn' : 'neutral'}
		/>
	</div>

	<div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Items sold" value={String(data.units)} />
		<StatTile label="Avg order" value={money(data.avgOrder)} />
		<StatTile label="Cost of goods" value={money(data.cost)} />
		<StatTile label="Orders" value={String(data.orderCount)} />
	</div>

	<section class="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold text-slate-900">Revenue by month</h2>
				<p class="text-xs text-slate-500">Cancelled orders excluded</p>
			</div>
			<button
				onclick={() => (showTable = !showTable)}
				class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
			>
				{showTable ? 'Chart' : 'Table'}
			</button>
		</header>
		<div class="p-4">
			{#if showTable}
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-100 text-left text-xs text-slate-500">
							<th class="pb-2 font-medium">Month</th>
							<th class="pb-2 text-right font-medium">Orders</th>
							<th class="pb-2 text-right font-medium">Revenue</th>
							<th class="pb-2 text-right font-medium">Profit</th>
						</tr>
					</thead>
					<tbody>
						{#each data.byMonth as m (m.month)}
							<tr class="border-b border-slate-50">
								<td class="py-1.5">{m.month}</td>
								<td class="tabular py-1.5 text-right">{m.orders}</td>
								<td class="tabular py-1.5 text-right">{money(m.revenue)}</td>
								<td class="tabular py-1.5 text-right">{money(m.profit)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<TrendChart
					points={data.byMonth.map((m) => ({ x: m.month, y: m.revenue }))}
					format={money}
					label="Revenue"
				/>
			{/if}
		</div>
	</section>

	<div class="grid gap-4 lg:grid-cols-2">
		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3">
				<h2 class="text-sm font-semibold text-slate-900">Where orders come from</h2>
			</header>
			<div class="p-4">
				<BarList
					rows={data.byChannel.map((c) => ({
						label: CHANNEL_LABELS[c.channel] ?? c.channel,
						value: c.revenue,
						note: `· ${c.orders}`
					}))}
					format={money}
				/>
			</div>
		</section>

		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3">
				<h2 class="text-sm font-semibold text-slate-900">Best-selling designs</h2>
			</header>
			<div class="p-4">
				<BarList
					rows={data.byDesign.slice(0, 8).map((d) => ({ label: d.name, value: d.units }))}
					format={(n) => `${n}`}
				/>
			</div>
		</section>
	</div>
</div>

<style>
	.viz-root {
		--series-1: #2a78d6;
	}
</style>
