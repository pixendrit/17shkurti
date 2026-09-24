<script lang="ts">
	import { enhance } from '$app/forms';
	import FormError from '$lib/components/FormError.svelte';
	import Thumb from '$lib/components/Thumb.svelte';
	import { busy } from '$lib/client/enhance';
	import { shrink } from '$lib/client/shrink';
	import { deliveryCost, lineCost } from '$lib/domain/economics';
	import { euroInput, parseEuro } from '$lib/domain/money';
	import { COLORS, COUNTRIES, CHANNELS, GARMENTS, SIZES, type Artwork, type Color, type Country, type DeliveryMethod, type Garment } from '$lib/domain/model';
	import { money, field, small, label, CHANNEL_LABELS, COLOR_LABELS, COUNTRY_LABELS, GARMENT_LABELS, PAYMENT_LABELS } from '$lib/ui';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
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

	/** Row: one line of the form. `key` names its fields; `art` is none, custom or design:<id>. */
	type Row = { key: number; garment: Garment; color: Color; size: string; art: string; qty: string; price: string; front: string | null; back: string | null };
	let next = 0;
	const newRow = (from?: Row): Row => ({
		key: next++,
		garment: from?.garment ?? 'oversized_200g',
		color: from?.color ?? 'black',
		size: 'M',
		art: from?.art === 'custom' ? 'none' : (from?.art ?? 'none'),
		qty: '1',
		price: from?.price ?? euroInput(data.costs.settings.defaultPrice),
		front: null,
		back: null
	});
	let rows = $state<Row[]>([newRow()]);

	const printFor = (art: string, color: Color) =>
		art.startsWith('design:') ? data.designs.find((d) => d.id === art.slice(7))?.prints.find((p) => p.shirtColor === color) : undefined;

	/** The artwork the server will decide for a row, for the estimate. */
	function artworkOf(r: Row): Artwork {
		if (r.art === 'custom') return { kind: 'custom', front: '', back: '', printReady: false };
		const p = printFor(r.art, r.color);
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

<form method="POST" enctype="multipart/form-data" use:enhance={busy({ reset: false })} class="space-y-4">
	<input type="hidden" name="kind" value={kind} />
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
			<label class="block"><span class={label}>Emri *</span><input name="name" required autocomplete="off" class={field} /></label>
			<label class="block"><span class={label}>Telefoni *</span><input name="phone" required inputmode="tel" autocomplete="off" class={field} /></label>
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
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-slate-900">Artikujt</h2>
			<button type="button" onclick={() => rows.push(newRow(rows[rows.length - 1]))} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
				<Plus class="size-3.5" /> Shto artikull
			</button>
		</div>

		<div class="space-y-3">
			{#each rows as row, i (row.key)}
				{@const k = row.key}
				{@const print = printFor(row.art, row.color)}
				<div class="rounded-lg border p-3 {row.art === 'custom' ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200'}">
					<input type="hidden" name="line" value={k} />
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-6">
						<label class="block sm:col-span-2">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Bluza</span>
							<select name="garment-{k}" bind:value={row.garment} class={small}>
								{#each GARMENTS as g (g)}<option value={g}>{GARMENT_LABELS[g]}</option>{/each}
							</select>
						</label>
						<label class="block">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Ngjyra</span>
							<select name="color-{k}" bind:value={row.color} class={small}>
								{#each COLORS as c (c)}<option value={c}>{COLOR_LABELS[c]}</option>{/each}
							</select>
						</label>
						<label class="block">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Masa</span>
							<select name="size-{k}" bind:value={row.size} class={small}>
								{#each SIZES as sz (sz)}<option value={sz}>{sz}</option>{/each}
							</select>
						</label>
						<label class="col-span-2 block">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Printi</span>
							<select name="art-{k}" bind:value={row.art} class={small}>
								<option value="none">— Pa print —</option>
								{#each data.designs as d (d.id)}<option value="design:{d.id}">{d.name}</option>{/each}
								<option value="custom">✎ I personalizuar (me mockup)</option>
							</select>
						</label>
					</div>

					{#if row.art === 'custom'}
						<!-- A personalised print can't be made without knowing exactly what goes on it. -->
						<div class="mt-2 grid grid-cols-2 gap-2">
							{#each [['front', 'Mockup para'], ['back', 'Mockup pas']] as const as [side, text] (side)}
								<label class="block cursor-pointer rounded-lg border-2 border-dashed {row[side] ? 'border-violet-300' : 'border-violet-400 bg-white'} p-2 text-center">
									{#if row[side]}
										<img src={row[side]} alt={text} class="mx-auto aspect-square w-full rounded object-cover" />
										<span class="mt-1 block text-[11px] text-violet-700">Ndrysho</span>
									{:else}
										<span class="block py-6 text-xs font-medium text-violet-800">{text} *</span>
									{/if}
									<input type="file" name="{side}-{k}" accept="image/*" required class="sr-only" use:shrink={(url) => (row[side] = url)} />
								</label>
							{/each}
						</div>
					{:else if row.art.startsWith('design:')}
						{#if print}
							{#if print.front || print.back}
								<div class="mt-2 flex gap-2"><Thumb id={print.front} size="size-16" alt="para" /><Thumb id={print.back} size="size-16" alt="pas" /></div>
							{/if}
						{:else}
							<p class="mt-2 text-xs font-medium text-amber-700">Ky dizajn nuk ka ende print për bluzë {COLOR_LABELS[row.color].toLowerCase()} — shtojeni te Dizajnet.</p>
						{/if}
					{/if}

					<div class="mt-2 flex items-end gap-2">
						<label class="block w-20">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Sasia</span>
							<input name="qty-{k}" bind:value={row.qty} inputmode="numeric" class={small} />
						</label>
						{#if kind === 'sale'}
							<label class="block w-28">
								<span class="mb-1 block text-[11px] font-medium text-slate-500">Çmimi për copë €</span>
								<input name="price-{k}" bind:value={row.price} inputmode="decimal" class={small} />
							</label>
						{/if}
						<p class="tabular flex-1 text-right text-sm font-medium text-slate-700">
							{kind === 'gift' ? 'Falas' : money(n(row.qty) * (parseEuro(row.price) ?? 0))}
						</p>
						{#if rows.length > 1}
							<button type="button" onclick={() => rows.splice(i, 1)} aria-label="Hiq artikullin" class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
								<Trash2 class="size-4" />
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
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
			<textarea name="notes" rows="2" placeholder={kind === 'gift' ? 'Profili, çfarë pritet (video, story)…' : 'Çdo kërkesë e veçantë e klientit…'} class={field}></textarea>
		</label>

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
