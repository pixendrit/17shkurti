<script lang="ts">
	/**
	 * Horizontal bars for "compare magnitude" — one hue, more-is-darker is not
	 * needed here because the ordering already carries rank, so a single
	 * series colour is used with direct labels on every row.
	 */
	let {
		rows,
		format = (n: number) => String(n)
	}: {
		rows: { label: string; value: number; note?: string }[];
		format?: (n: number) => string;
	} = $props();

	const max = $derived(Math.max(1, ...rows.map((r) => r.value)));
</script>

{#if rows.length === 0}
	<p class="py-6 text-center text-sm text-slate-500">Nothing yet.</p>
{:else}
	<ul class="space-y-2.5">
		{#each rows as r (r.label)}
			<li>
				<div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
					<span class="truncate text-slate-700">{r.label}</span>
					<span class="tabular shrink-0 font-medium text-slate-900">
						{format(r.value)}{#if r.note}<span class="ml-1 font-normal text-slate-400">{r.note}</span>{/if}
					</span>
				</div>
				<!-- track + bar: 8px tall, 4px rounded data-end, square at the baseline -->
				<div class="h-2 w-full overflow-hidden rounded-sm bg-slate-100">
					<div
						class="h-full rounded-r-[4px]"
						style="width: {Math.max(2, (r.value / max) * 100)}%; background: var(--series-1);"
					></div>
				</div>
			</li>
		{/each}
	</ul>
{/if}
