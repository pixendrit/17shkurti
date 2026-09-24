<script lang="ts">
	import { page } from '$app/state';

	const titles: Record<number, string> = {
		401: 'E kyçur',
		404: 'Faqja nuk u gjet',
		500: 'Diçka shkoi keq'
	};
</script>

<svelte:head><title>{page.status} — Hijeshi</title></svelte:head>

<div class="py-16 text-center">
	<p class="font-mono text-sm text-slate-400">{page.status}</p>
	<h1 class="mt-2 text-xl font-semibold text-slate-900">{titles[page.status] ?? 'Gabim'}</h1>
	{#if page.error?.message && page.error.message !== 'Not Found' && page.error.message !== 'Internal Error'}
		<p class="mt-2 text-sm text-slate-500">{page.error.message}</p>
	{/if}
	<a href="/" class="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
		Kthehu te paneli
	</a>
</div>
