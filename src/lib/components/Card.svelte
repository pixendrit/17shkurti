<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		children,
		actions
	}: {
		title?: string;
		subtitle?: string;
		children: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
	{#if title}
		<header class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold text-slate-900">{title}</h2>
				{#if subtitle}<p class="text-xs text-slate-500">{subtitle}</p>{/if}
			</div>
			{#if actions}{@render actions()}{/if}
		</header>
	{/if}
	<div class="p-4">{@render children()}</div>
</section>
