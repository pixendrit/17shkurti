<script lang="ts">
	import { enhance } from '$app/forms';
	import FormError from '$lib/components/FormError.svelte';
	import ScreenshotPicker from '$lib/components/ScreenshotPicker.svelte';
	import { busy } from '$lib/client/enhance';
	import { field, label } from '$lib/ui';
	import Zap from '@lucide/svelte/icons/zap';
	import CircleCheck from '@lucide/svelte/icons/circle-check';

	let saved = $state(0);
</script>

<svelte:head><title>Porosi e shpejtë — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center gap-3">
	<a href="/" class="text-sm text-slate-500 hover:text-slate-900">← Paneli</a>
	<h1 class="flex items-center gap-1.5 text-xl font-semibold text-slate-900"><Zap class="size-5 text-amber-600" /> Porosi e shpejtë</h1>
</div>

<p class="mb-4 max-w-prose text-sm text-slate-600">
	Ruaje tani me screenshot-et e bisedës, plotësoje më vonë. Del te <b>Paneli → Për t'u plotësuar</b>; kur ta hapësh, formulari i porosisë vjen i mbushur me çfarë shkruan këtu.
</p>

{#if saved}
	<p class="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800" role="status">
		<CircleCheck class="size-4" /> U ruajt{saved > 1 ? ` (${saved})` : ''}. Mund të shtosh tjetrën, ose <a href="/" class="underline">shko te paneli</a>.
	</p>
{/if}

<FormError />

<form method="POST" enctype="multipart/form-data" use:enhance={busy({ after: () => (saved += 1) })} class="space-y-4">
	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-slate-900">Screenshot-et e bisedës</h2>
		<ScreenshotPicker big label="Zgjidh screenshot-et" />
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-slate-900">Nëse e ke në dorë <span class="font-normal text-slate-500">(jo e detyrueshme)</span></h2>
		<div class="grid gap-3 sm:grid-cols-2">
			<label class="block"><span class={label}>Emri</span><input name="name" autocomplete="off" class={field} /></label>
			<label class="block"><span class={label}>Telefoni</span><input name="phone" inputmode="tel" autocomplete="off" class={field} /></label>
			<label class="block sm:col-span-2"><span class={label}>Shënim</span><input name="note" placeholder="p.sh. 2 të zeza L, Shqiponja, pret përgjigje për adresën" class={field} /></label>
		</div>
	</section>

	<button class="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">Ruaj për më vonë</button>
</form>
