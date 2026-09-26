<script lang="ts">
	import { enhance } from '$app/forms';
	import FormError from '$lib/components/FormError.svelte';
	import LineEditor from '$lib/components/LineEditor.svelte';
	import ScreenshotPicker from '$lib/components/ScreenshotPicker.svelte';
	import { busy } from '$lib/client/enhance';
	import { newRow, type Row } from '$lib/client/lines';
	import { untrack } from 'svelte';
	import { deliveryCost, lineCost } from '$lib/domain/economics';
	import { euroInput, parseEuro } from '$lib/domain/money';
	import { COUNTRIES, CHANNELS, type Artwork, type Country, type DeliveryMethod } from '$lib/domain/model';
	import { money, field, label, formatDateTime, imageUrl, CHANNEL_LABELS, COUNTRY_LABELS, PAYMENT_LABELS } from '$lib/ui';
	import Zap from '@lucide/svelte/icons/zap';
	import Gift from '@lucide/svelte/icons/gift';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';

	let { data } = $props();
	const s = $derived(data.costs.settings);

	let kind = $state<'sale' | 'gift'>('sale');
	let country = $state<Country>('XK');
	let delivery = $state<DeliveryMethod>('courier');
	let deliveryCostText = $state('');
	let shippingText = $state('');
	let discountText = $state('');

	let rows = $state<Row[]>([newRow(untrack(() => data.costs.settings.defaultPrice))]);
	/** Filled in once from the quick order being completed, then the person's to edit. */
	let who = $state(untrack(() => ({ name: data.draft?.name ?? '', phone: data.draft?.phone ?? '', notes: data.draft?.note ?? '' })));
	let editor: LineEditor | undefined = $state();

	/** The artwork the server will decide for a row, for the estimate. */
	function artworkOf(r: Row): Artwork {
		if (r.art === 'custom') return { kind: 'custom', front: '', back: '', printReady: false };
		const p = editor?.printFor(r.art, r.color);
		return p ? { kind: 'print', printId: p.id } : { kind: 'none' };
	}

	const n = (t: string) => Math.max(0, Number.parseInt(t, 10) || 0);
	const units = $derived(rows.reduce((a, r) => a + n(r.qty), 0));
	const subtotal = $derived(kind === 'gift' ? 0 : rows.reduce((a, r) => a + n(r.qty) * (parseEuro(r.price) ?? 0), 0));
	const usualDelivery = $derived(deliveryCost(s, delivery, country));
	const delivered = $derived(parseEuro(deliveryCostText) ?? usualDelivery);
	const revenue = $derived(kind === 'gift' ? 0 : subtotal + (parseEuro(shippingText) ?? 0) - (parseEuro(discountText) ?? 0));
	const cost = $derived(
		rows.reduce((a, r) => {
			const c = lineCost(data.costs, r.garment, artworkOf(r));
			return a + n(r.qty) * (c.blank + c.dtf + c.labor);
		}, 0) + s.packagingPerOrder + delivered
	);
</script>

<svelte:head><title>Porosi e re — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center gap-3">
	<a href="/orders" class="text-sm text-slate-500 hover:text-slate-900">← Porositë</a>
	<h1 class="text-xl font-semibold text-slate-900">Porosi e re</h1>
	<span class="font-mono text-xs text-slate-400">{data.code}</span>
</div>

{#if data.draft}
	{@const d = data.draft}
	<section class="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
		<div class="mb-3 flex items-start justify-between gap-3">
			<div>
				<h2 class="flex items-center gap-1.5 text-sm font-semibold text-amber-950"><Zap class="size-4" /> Po plotëson porosinë e shpejtë</h2>
				<p class="text-xs text-amber-900">Ruajtur {formatDateTime(d.createdAt)}{d.note ? ` · ${d.note}` : ''}. Screenshot-et shkojnë me porosinë.</p>
			</div>
			<form method="POST" action="?/deleteDraft" use:enhance={busy({ confirm: 'Ta fshij këtë porosi të shpejtë bashkë me screenshot-et?' })}>
				<input type="hidden" name="draftId" value={d.id} />
				<button class="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100">Fshije</button>
			</form>
		</div>
		{#if d.screenshots.length}
			<div class="flex gap-2 overflow-x-auto pb-1">
				{#each d.screenshots as id, i (id)}
					<a href={imageUrl(id)} target="_blank" class="shrink-0"><img src={imageUrl(id)} alt="Screenshot {i + 1}" class="h-72 rounded-lg border border-amber-200 object-contain sm:h-96" /></a>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<form method="POST" action="?/create" enctype="multipart/form-data" use:enhance={busy({ reset: false })} class="space-y-4">
	<input type="hidden" name="kind" value={kind} />
	{#if data.draft}<input type="hidden" name="fromDraft" value={data.draft.id} />{/if}
	<div class="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
		<button type="button" onclick={() => (kind = 'sale')} class="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium {kind === 'sale' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}">
			<ShoppingBag class="size-4" /> Shitje
		</button>
		<button type="button" onclick={() => (kind = 'gift')} class="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium {kind === 'gift' ? 'bg-pink-600 text-white' : 'text-slate-600 hover:bg-slate-50'}">
			<Gift class="size-4" /> Dhuratë / influencer
		</button>
	</div>
	{#if kind === 'gift'}
		<p class="rounded-lg bg-pink-50 px-3 py-2 text-xs text-pink-800">Dërgohet falas. Kostoja e saj llogaritet si shpenzim marketingu, jo si shitje.</p>
	{/if}

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-slate-900">{kind === 'gift' ? 'Influenceri' : 'Klienti'}</h2>
		<div class="grid gap-3 sm:grid-cols-2">
			<label class="block"><span class={label}>Emri *</span><input name="name" bind:value={who.name} required autocomplete="off" class={field} /></label>
			<label class="block"><span class={label}>Telefoni *</span><input name="phone" bind:value={who.phone} required inputmode="tel" autocomplete="off" class={field} /></label>
			<label class="block sm:col-span-2"><span class={label}>Adresa</span><input name="address" autocomplete="off" class={field} /></label>
			<label class="block"><span class={label}>Qyteti</span><input name="city" autocomplete="off" class={field} /></label>
			<label class="block">
				<span class={label}>Shteti</span>
				<select name="country" bind:value={country} class={field}>
					{#each COUNTRIES as c (c)}<option value={c}>{COUNTRY_LABELS[c]}</option>{/each}
				</select>
			</label>
			<label class="block sm:col-span-2">
				<span class={label}>Burimi i porosisë</span>
				<select name="channel" class={field}>
					{#each CHANNELS as c (c)}<option value={c}>{CHANNEL_LABELS[c]}</option>{/each}
				</select>
			</label>
		</div>
		<p class="mt-2 text-xs text-slate-500">Nëse numri është i njohur, porosia shkon te i njëjti klient dhe adresa përditësohet.</p>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<LineEditor bind:this={editor} bind:rows designs={data.designs} {kind} defaultPrice={data.costs.settings.defaultPrice} />
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-slate-900">Dërgesa</h2>
		<input type="hidden" name="delivery" value={delivery} />
		<div class="mb-3 grid grid-cols-2 gap-2">
			<button type="button" onclick={() => ((delivery = 'courier'), (deliveryCostText = ''))} class="rounded-lg border py-2 text-sm font-medium {delivery === 'courier' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 hover:bg-slate-50'}">Me postë</button>
			<button type="button" onclick={() => ((delivery = 'hand'), (deliveryCostText = ''))} class="rounded-lg border py-2 text-sm font-medium {delivery === 'hand' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 hover:bg-slate-50'}">Dorëzim personal</button>
		</div>
		<div class="grid gap-3 sm:grid-cols-3">
			<label class="block">
				<span class={label}>{delivery === 'courier' ? 'Posta na kushton €' : 'Kosto dorëzimi €'}</span>
				<input name="deliveryCost" bind:value={deliveryCostText} placeholder={euroInput(usualDelivery)} inputmode="decimal" class={field} />
			</label>
			{#if kind === 'sale'}
				<label class="block">
					<span class={label}>Transport nga klienti €</span>
					<input name="shippingCharged" bind:value={shippingText} placeholder="0" inputmode="decimal" class={field} />
				</label>
			{/if}
			{#if delivery === 'courier'}
				<label class="block">
					<span class={label}>Nr. i dërgesës</span>
					<input name="trackingRef" placeholder="nga posta, nëse e keni" class={field} />
				</label>
			{/if}
		</div>
		{#if delivery === 'courier'}
			<p class="mt-2 text-xs text-slate-500">{COUNTRY_LABELS[country]}: posta na merr {money(usualDelivery)}. Për klientin transporti është falas, përveç nëse e vendosni më lart.</p>
		{/if}
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-slate-900">{kind === 'sale' ? 'Pagesa' : 'Shënime'}</h2>
		{#if kind === 'sale'}
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="block">
					<span class={label}>E paguar tashmë?</span>
					<select name="paidWith" class={field}>
						<option value="">Jo ende — paguhet në dorëzim</option>
						<option value="bank">Po, {PAYMENT_LABELS.bank.toLowerCase()}</option>
						<option value="cash">Po, {PAYMENT_LABELS.cash.toLowerCase()}</option>
					</select>
				</label>
				<label class="block">
					<span class={label}>Zbritja €</span>
					<input name="discount" bind:value={discountText} placeholder="0" inputmode="decimal" class={field} />
				</label>
			</div>
		{/if}
		<label class="mt-3 block">
			<span class={label}>Shënime</span>
			<textarea name="notes" rows="2" placeholder={kind === 'gift' ? 'Profili, çfarë pritet (video, story)…' : 'Çdo kërkesë e veçantë e klientit…'} bind:value={who.notes} class={field}></textarea>
		</label>
		<div class="mt-3">
			<span class={label}>Screenshot-e të bisedës {data.draft?.screenshots.length ? '(të tjera, përveç atyre më lart)' : ''}</span>
			<ScreenshotPicker />
		</div>

		<!-- What this order is worth, worked out the way the server will. -->
		<div class="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
			<div class="flex justify-between"><span class="text-slate-600">{units} copë</span><span class="tabular text-lg font-semibold text-slate-900">{kind === 'gift' ? 'Falas' : money(revenue)}</span></div>
			<div class="flex justify-between text-xs text-slate-500"><span>Kosto</span><span class="tabular">{money(cost)}</span></div>
			<div class="flex justify-between text-xs font-medium {revenue - cost >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
				<span>{kind === 'gift' ? 'Kosto marketingu' : 'Fitimi'}</span>
				<span class="tabular">{money(kind === 'gift' ? cost : revenue - cost)}</span>
			</div>
		</div>
	</section>

	<FormError />

	<div class="flex gap-2">
		<button class="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">Ruaj porosinë</button>
		<a href="/orders" class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">Anulo</a>
	</div>
</form>
