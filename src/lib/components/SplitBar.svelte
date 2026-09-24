<script lang="ts">
	/**
	 * Part-to-whole in one horizontal bar: where each euro goes. Colours come
	 * from the validated categorical order and are always paired with a
	 * labelled row below, so the bar never relies on colour alone.
	 */
	import { money } from '$lib/ui';

	let { parts, total }: { parts: { label: string; value: number; color: string }[]; total: number } = $props();

	const shown = $derived(parts.filter((p) => p.value > 0));
	const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
</script>

{#if total <= 0}
	<p class="py-6 text-center text-sm text-slate-500">Ende s'ka shitje në këtë periudhë.</p>
{:else}
	<!-- 2px surface gaps separate the segments; the ends are rounded, the joins square. -->
	<div class="flex h-6 w-full gap-[2px] overflow-hidden rounded bg-white" role="img" aria-label="Ndarja e çmimit">
		{#each shown as p (p.label)}
			<div style="width: {pct(p.value)}%; background: {p.color};" class="min-w-[2px] first:rounded-l last:rounded-r" title="{p.label}: {money(p.value)}"></div>
		{/each}
	</div>
	<ul class="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
		{#each parts as p (p.label)}
			<li class="flex items-center gap-2">
				<span class="size-3 shrink-0 rounded-sm" style="background: {p.color};"></span>
				<span class="flex-1 text-slate-700">{p.label}</span>
				<span class="tabular font-medium text-slate-900">{money(p.value)}</span>
				<span class="tabular w-10 text-right text-xs text-slate-500">{Math.round(pct(p.value))}%</span>
			</li>
		{/each}
	</ul>
{/if}
