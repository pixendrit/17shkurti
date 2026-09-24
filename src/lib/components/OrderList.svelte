<script lang="ts">
	import Gift from '@lucide/svelte/icons/gift';
	import StatusBadge from './StatusBadge.svelte';
	import { money, formatDate } from '$lib/ui';
	import type { OrderRow } from '$lib/domain/views';

	let {
		rows,
		empty = 'Asgjë këtu.',
		limit = Infinity,
		detail = 'summary'
	}: { rows: (OrderRow & { missing?: string[] })[]; empty?: string; limit?: number; detail?: 'summary' | 'missing' | 'contact' } = $props();
</script>

{#if rows.length === 0}
	<p class="py-6 text-center text-sm text-slate-500">{empty}</p>
{:else}
	<ul class="divide-y divide-slate-100">
		{#each rows.slice(0, limit) as o (o.id)}
			<li>
				<a href="/orders/{o.id}" class="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50">
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-slate-900">
							{o.customer}{#if o.kind === 'gift'} <Gift class="inline size-3.5 text-pink-600" />{/if}
							{#if o.isDemo}<span class="ml-1 text-[10px] font-normal text-slate-400">demo</span>{/if}
						</p>
						<p class="truncate text-xs text-slate-500">
							<span class="font-mono">{o.code}</span> ·
							{#if detail === 'missing' && o.missing}<span class="text-amber-700">mungon {o.missing.join(', ')}</span>
							{:else if detail === 'contact'}{o.phone}{o.city ? ` · ${o.city}` : ''}{o.trackingRef ? ` · ${o.trackingRef}` : ''}
							{:else}{formatDate(o.createdAt)} · {o.summary}{/if}
						</p>
					</div>
					<div class="shrink-0 text-right">
						<p class="tabular text-sm font-medium">
							{o.kind === 'gift' ? 'Falas' : money(o.total)}
						</p>
						{#if o.kind === 'sale' && o.balance > 0 && o.balance < o.total}
							<p class="tabular text-[11px] text-amber-700">mbeten {money(o.balance)}</p>
						{/if}
						<StatusBadge status={o.status} label={o.statusLabel} />
					</div>
				</a>
			</li>
		{/each}
		{#if rows.length > limit}<li class="px-4 py-2 text-center text-xs text-slate-500">+ {rows.length - limit} të tjera</li>{/if}
	</ul>
{/if}
