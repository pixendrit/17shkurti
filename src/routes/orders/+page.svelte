<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import { money, formatDate, CHANNEL_LABELS } from '$lib/constants';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import { base } from '$app/paths';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let { data } = $props();

	const tabs = [
		{ key: 'open', label: 'Open' },
		{ key: 'new', label: 'New' },
		{ key: 'in_production', label: 'Production' },
		{ key: 'shipped', label: 'Shipped' },
		{ key: 'delivered', label: 'Delivered' },
		{ key: 'all', label: 'All' }
	];
</script>

<svelte:head><title>Orders — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center justify-between gap-3">
	<h1 class="text-xl font-semibold text-slate-900">Orders</h1>
	<a
		href="{base}/orders/new"
		class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
	>
		<Plus class="size-4" /> New order
	</a>
</div>

<form class="mb-4 flex gap-2" data-sveltekit-keepfocus action="{base}/orders">
	<input type="hidden" name="status" value={data.status} />
	<div class="relative flex-1">
		<Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
		<input
			name="q"
			value={data.q}
			placeholder="Search name, phone or code…"
			class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-slate-900 focus:outline-none"
		/>
	</div>
	<button class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
		Search
	</button>
</form>

<div class="mb-4 flex gap-1 overflow-x-auto pb-1">
	{#each tabs as t (t.key)}
		<a
			href="{base}/orders?status={t.key}{data.q ? `&q=${encodeURIComponent(data.q)}` : ''}"
			class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium
			{data.status === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}"
		>
			{t.label}
		</a>
	{/each}
</div>

{#if data.orders.length === 0}
	<div class="rounded-xl border border-slate-200 bg-white">
		<Empty message="No orders here" hint="Tap “New order” when the next DM comes in." />
	</div>
{:else}
	<div class="space-y-2">
		{#each data.orders as o (o.id)}
			<a
				href="{base}/orders/{o.id}"
				class="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<span class="font-mono text-xs text-slate-400">{o.code}</span>
							<StatusBadge status={o.status} />
							{#if o.paymentStatus === 'paid'}
								<span class="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">Paid</span>
							{/if}
						</div>
						<p class="mt-1 truncate font-medium text-slate-900">{o.customerName}</p>
						<p class="truncate text-sm text-slate-500">
							{o.phone} · {CHANNEL_LABELS[o.channel] ?? o.channel}
						</p>
						<p class="mt-1 truncate text-xs text-slate-500">
							{o.units} item{o.units === 1 ? '' : 's'} ·
							{o.items.map((i) => `${i.quantity}× ${i.designName ?? 'Plain'} ${i.size}`).join(', ')}
						</p>
					</div>
					<div class="shrink-0 text-right">
						<p class="tabular font-semibold text-slate-900">{money(o.total)}</p>
						<p class="text-xs text-slate-400">{formatDate(o.createdAt)}</p>
						{#if !['delivered', 'cancelled'].includes(o.status)}
							{#if o.canMake}
								<span class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
									<CircleCheck class="size-3.5" /> Can make
								</span>
							{:else}
								<span class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
									<TriangleAlert class="size-3.5" /> Missing stock
								</span>
							{/if}
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
