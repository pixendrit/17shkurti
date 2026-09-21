<script lang="ts">
	let {
		label,
		value,
		sub,
		tone = 'neutral'
	}: {
		label: string;
		value: string;
		sub?: string;
		tone?: 'neutral' | 'good' | 'warn';
	} = $props();

	const toneClass = {
		neutral: 'text-slate-900',
		good: 'text-emerald-700',
		warn: 'text-amber-700'
	};
</script>

<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
	<p class="text-xs font-medium text-slate-500">{label}</p>
	<p class="tabular mt-1 text-2xl font-semibold {toneClass[tone]}">{value}</p>
	{#if sub}<p class="mt-0.5 text-xs text-slate-500">{sub}</p>{/if}
</div>
