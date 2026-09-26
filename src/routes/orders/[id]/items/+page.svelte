<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import FormError from '$lib/components/FormError.svelte';
	import LineEditor from '$lib/components/LineEditor.svelte';
	import { busy } from '$lib/client/enhance';
	import { rowOf, type Row } from '$lib/client/lines';
	import { primary, secondary } from '$lib/ui';

	let { data } = $props();
	let rows = $state<Row[]>(untrack(() => data.order.lines.map((l) => rowOf(l, data.prints))));
	const unknownSizes = untrack(() => data.order.lines.some((l) => l.sku.size === 'unknown'));
</script>

<svelte:head><title>Artikujt e {data.order.code} — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center gap-3">
	<a href="/orders/{data.order.id}" class="text-sm text-slate-500 hover:text-slate-900">← {data.order.code}</a>
	<h1 class="text-xl font-semibold text-slate-900">Ndrysho artikujt</h1>
</div>

<p class="mb-4 max-w-prose text-sm text-slate-600">
	Mund t'i ndryshosh derisa porosia të bëhet. Bluzat që mbeten njëlloj e ruajnë koston e tyre; të rejat marrin koston e sotme.
	{#if unknownSizes}<b>Masat e panjohura shfaqen si M: ndreqi para se të ruash.</b>{/if}
</p>

<FormError />

<form method="POST" enctype="multipart/form-data" use:enhance={busy({ reset: false })} class="space-y-4">
	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<LineEditor bind:rows designs={data.designs} kind={data.order.kind} defaultPrice={data.defaultPrice} />
	</section>
	<div class="flex gap-2">
		<button class="{primary} flex-1 py-2.5">Ruaj artikujt</button>
		<a href="/orders/{data.order.id}" class="{secondary} py-2.5">Anulo</a>
	</div>
</form>
