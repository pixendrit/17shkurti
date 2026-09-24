<script lang="ts">
	import {
		PRODUCT_TYPES,
		SIZES,
		COLORS,
		CHANNEL_LABELS,
		COUNTRY_LABELS,
		money,
		productLabel,
		colorLabel
	} from '$lib/constants';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Gift from '@lucide/svelte/icons/gift';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import DesignThumb from '$lib/components/DesignThumb.svelte';
	import { createOrder, type Mockups } from '$lib/client/actions';

	let { data } = $props();
	const s = $derived(data.settings);

	let kind = $state<'sale' | 'gift'>('sale');
	let customerName = $state('');
	let phone = $state('');
	let address = $state('');
	let city = $state('');
	let country = $state('XK');
	let channel = $state('instagram');
	let deliveryMethod = $state<'post' | 'manual'>('post');
	let trackingRef = $state('');
	/** null = use the courier price for the country. */
	let shippingCostOverride = $state<number | null>(null);
	let shippingFee = $state(0);
	let discount = $state(0);
	let paymentStatus = $state('unpaid');
	let paymentMethod = $state('cash_on_delivery');
	let notes = $state('');
	let error = $state<string | null>(null);
	let saving = $state(false);

	type Row = {
		productType: string;
		color: string;
		size: string;
		designId: string;
		quantity: number;
		unitPrice: number | null;
		isCustom: boolean;
		front: File | null;
		back: File | null;
		frontUrl: string | null;
		backUrl: string | null;
	};

	const blankRow = (from?: Row): Row => ({
		productType: from?.productType ?? PRODUCT_TYPES[0],
		color: from?.color ?? COLORS[0],
		size: 'M',
		designId: from?.designId ?? '',
		quantity: 1,
		unitPrice: from?.unitPrice ?? s.defaultPrice,
		isCustom: false,
		front: null,
		back: null,
		frontUrl: null,
		backUrl: null
	});

	let rows = $state<Row[]>([blankRow()]);

	const courierCost = $derived(deliveryMethod === 'post' ? (s.postCost[country] ?? 0) : 0);
	const shippingCost = $derived(shippingCostOverride ?? courierCost);

	const units = $derived(rows.reduce((a, r) => a + (r.quantity || 0), 0));
	const subtotal = $derived(kind === 'gift' ? 0 : rows.reduce((a, r) => a + (r.quantity || 0) * (r.unitPrice ?? 0), 0));
	const revenue = $derived(kind === 'gift' ? 0 : subtotal + (shippingFee || 0) - (discount || 0));

	/** Same rules the server snapshots with, so the estimate matches what gets saved. */
	function perShirtCost(r: Row) {
		const blank = s.blankCost[r.productType] ?? 0;
		const perSheet = r.isCustom
			? s.customShirtsPerSheet
			: (data.designs.find((d) => String(d.id) === r.designId)?.shirtsPerSheet ?? 0);
		const dtf = r.isCustom || r.designId ? s.dtfSheetPrice / Math.max(1, perSheet || 4) : 0;
		return blank + dtf + s.laborPerShirt;
	}
	const cost = $derived(
		rows.reduce((a, r) => a + (r.quantity || 0) * perShirtCost(r), 0) + s.packagingPerOrder + (shippingCost || 0)
	);

	function setDelivery(m: 'post' | 'manual') {
		deliveryMethod = m;
		shippingCostOverride = null;
		paymentMethod = m === 'post' ? 'cash_on_delivery' : 'cash';
	}

	function pickMockup(row: Row, side: 'front' | 'back', e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
		const key = side === 'front' ? 'frontUrl' : 'backUrl';
		if (row[key]) URL.revokeObjectURL(row[key]!);
		row[side] = file;
		row[key] = file ? URL.createObjectURL(file) : null;
	}

	async function submit(e: Event) {
		e.preventDefault();
		error = null;
		const missing = rows.findIndex((r) => r.isCustom && (!r.front || !r.back));
		if (missing >= 0) {
			error = `Artikulli ${missing + 1} është i personalizuar: ngarkoni mockup-in para dhe pas.`;
			return;
		}
		saving = true;
		const mockups: Mockups = {};
		rows.forEach((r, i) => {
			if (r.isCustom) mockups[i] = { front: r.front, back: r.back };
		});
		try {
			error = await createOrder(
				{
					kind,
					customerName,
					phone,
					address,
					city,
					country,
					channel,
					deliveryMethod,
					paymentStatus,
					paymentMethod,
					shippingFee: Number(shippingFee) || 0,
					discount: Number(discount) || 0,
					shippingCost: shippingCostOverride,
					trackingRef,
					notes,
					items: rows.map((r) => ({
						productType: r.productType,
						color: r.color,
						size: r.size,
						designId: r.designId ? Number(r.designId) : null,
						quantity: Number(r.quantity) || 0,
						unitPrice: kind === 'gift' ? 0 : Number(r.unitPrice) || 0,
						isCustom: r.isCustom
					}))
				},
				mockups
			);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Porosia nuk u ruajt.';
		} finally {
			saving = false;
		}
	}

	const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
	const small = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm';
	const label = 'mb-1 block text-xs font-medium text-slate-600';
</script>

<svelte:head><title>Porosi e re — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center gap-3">
	<a href="/orders" class="text-sm text-slate-500 hover:text-slate-900">← Porositë</a>
	<h1 class="text-xl font-semibold text-slate-900">Porosi e re</h1>
	<span class="font-mono text-xs text-slate-400">{data.code}</span>
</div>

<form onsubmit={submit} class="space-y-4">
	<!-- Sale or influencer gift -->
	<div class="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
		<button type="button" onclick={() => (kind = 'sale')} class="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium {kind === 'sale' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}">
			<ShoppingBag class="size-4" /> Shitje
		</button>
		<button type="button" onclick={() => (kind = 'gift')} class="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium {kind === 'gift' ? 'bg-pink-600 text-white' : 'text-slate-600 hover:bg-slate-50'}">
			<Gift class="size-4" /> Dhuratë / influencer
		</button>
	</div>
	{#if kind === 'gift'}
		<p class="rounded-lg bg-pink-50 px-3 py-2 text-xs text-pink-800">
			Dërgohet falas. Kostoja e saj llogaritet si shpenzim marketingu, jo si shitje.
		</p>
	{/if}

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-slate-900">{kind === 'gift' ? 'Influenceri' : 'Klienti'}</h2>
		<div class="grid gap-3 sm:grid-cols-2">
			<label class="block"><span class={label}>Emri *</span><input bind:value={customerName} required class={field} /></label>
			<label class="block"><span class={label}>Telefoni *</span><input bind:value={phone} required inputmode="tel" class={field} /></label>
			<label class="block sm:col-span-2"><span class={label}>Adresa</span><input bind:value={address} class={field} /></label>
			<label class="block"><span class={label}>Qyteti</span><input bind:value={city} class={field} /></label>
			<label class="block">
				<span class={label}>Shteti</span>
				<select bind:value={country} onchange={() => (shippingCostOverride = null)} class={field}>
					{#each Object.entries(COUNTRY_LABELS) as [code, name] (code)}<option value={code}>{name}</option>{/each}
				</select>
			</label>
			<label class="block sm:col-span-2">
				<span class={label}>Burimi i porosisë</span>
				<select bind:value={channel} class={field}>
					{#each Object.entries(CHANNEL_LABELS) as [code, name] (code)}<option value={code}>{name}</option>{/each}
				</select>
			</label>
		</div>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-slate-900">Artikujt</h2>
			<button type="button" onclick={() => rows.push(blankRow(rows[rows.length - 1]))} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
				<Plus class="size-3.5" /> Shto artikull
			</button>
		</div>

		<div class="space-y-3">
			{#each rows as row, i (i)}
				<div class="rounded-lg border p-3 {row.isCustom ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200'}">
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-6">
						<label class="block sm:col-span-2">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Produkti</span>
							<select bind:value={row.productType} class={small}>
								{#each PRODUCT_TYPES as p (p)}<option value={p}>{productLabel(p)}</option>{/each}
							</select>
						</label>
						<label class="block">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Ngjyra</span>
							<select bind:value={row.color} class={small}>
								{#each COLORS as c (c)}<option value={c}>{colorLabel(c)}</option>{/each}
							</select>
						</label>
						<label class="block">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Masa</span>
							<select bind:value={row.size} class={small}>
								{#each SIZES as sz (sz)}<option value={sz}>{sz}</option>{/each}
							</select>
						</label>
						<label class="col-span-2 block">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Dizajni</span>
							<select bind:value={row.designId} disabled={row.isCustom} class="{small} disabled:bg-slate-100 disabled:text-slate-400">
								<option value="">{row.isCustom ? '— Print i personalizuar —' : '— Pa print —'}</option>
								{#each data.designs as d (d.id)}<option value={String(d.id)}>{d.name}</option>{/each}
							</select>
						</label>
					</div>

					<label class="mt-2 inline-flex items-center gap-2 text-sm font-medium text-violet-900">
						<input type="checkbox" bind:checked={row.isCustom} onchange={() => row.isCustom && (row.designId = '')} class="size-4 rounded border-slate-300" />
						Print i personalizuar
					</label>

					{#if row.isCustom}
						<!-- A personalised print can't be made without knowing exactly what goes on it. -->
						<div class="mt-2 grid grid-cols-2 gap-2">
							{#each [['front', 'Mockup para'], ['back', 'Mockup pas']] as [side, text] (side)}
								{@const url = side === 'front' ? row.frontUrl : row.backUrl}
								<label class="block cursor-pointer rounded-lg border-2 border-dashed {url ? 'border-violet-300' : 'border-violet-400 bg-white'} p-2 text-center">
									{#if url}
										<img src={url} alt={text} class="mx-auto aspect-square w-full rounded object-cover" />
										<span class="mt-1 block text-[11px] text-violet-700">Ndrysho</span>
									{:else}
										<span class="block py-6 text-xs font-medium text-violet-800">{text} *</span>
									{/if}
									<input type="file" accept="image/*" class="hidden" onchange={(e) => pickMockup(row, side as 'front' | 'back', e)} />
								</label>
							{/each}
						</div>
					{:else if row.designId}
						{@const chosen = data.designs.find((d) => String(d.id) === row.designId)}
						{#if chosen && (chosen.images.front || chosen.images.back)}
							<div class="mt-2 flex gap-2">
								<DesignThumb designId={chosen.id} images={chosen.images} side="front" size="size-16" alt="{chosen.name} — para" />
								<DesignThumb designId={chosen.id} images={chosen.images} side="back" size="size-16" alt="{chosen.name} — pas" />
							</div>
						{/if}
					{/if}

					<div class="mt-2 flex items-end gap-2">
						<label class="block w-20">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Sasia</span>
							<input type="number" min="1" bind:value={row.quantity} class={small} />
						</label>
						{#if kind === 'sale'}
							<label class="block w-28">
								<span class="mb-1 block text-[11px] font-medium text-slate-500">Çmimi për copë</span>
								<input type="number" min="0" step="0.01" inputmode="decimal" bind:value={row.unitPrice} class={small} />
							</label>
						{/if}
						<p class="tabular flex-1 text-right text-sm font-medium text-slate-700">
							{kind === 'gift' ? 'Falas' : money((row.quantity || 0) * (row.unitPrice ?? 0))}
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
		<div class="mb-3 grid grid-cols-2 gap-2">
			<button type="button" onclick={() => setDelivery('post')} class="rounded-lg border py-2 text-sm font-medium {deliveryMethod === 'post' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 hover:bg-slate-50'}">Me postë</button>
			<button type="button" onclick={() => setDelivery('manual')} class="rounded-lg border py-2 text-sm font-medium {deliveryMethod === 'manual' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 hover:bg-slate-50'}">Dorëzim personal</button>
		</div>
		<div class="grid gap-3 sm:grid-cols-3">
			<label class="block">
				<span class={label}>{deliveryMethod === 'post' ? 'Posta na kushton' : 'Kosto dorëzimi'}</span>
				<input type="number" min="0" step="0.01" inputmode="decimal" value={shippingCost} oninput={(e) => (shippingCostOverride = e.currentTarget.value === '' ? null : Number(e.currentTarget.value))} class={field} />
			</label>
			<label class="block">
				<span class={label}>Transport nga klienti</span>
				<input type="number" min="0" step="0.01" inputmode="decimal" bind:value={shippingFee} class={field} />
			</label>
			{#if deliveryMethod === 'post'}
				<label class="block">
					<span class={label}>Nr. i dërgesës</span>
					<input bind:value={trackingRef} placeholder="nga posta, nëse e keni" class={field} />
				</label>
			{/if}
		</div>
		{#if deliveryMethod === 'post'}
			<p class="mt-2 text-xs text-slate-500">
				{COUNTRY_LABELS[country]}: posta na merr {money(courierCost)}. Për klientin transporti është falas, përveç nëse e vendosni më lart.
			</p>
		{/if}
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-slate-900">Pagesa</h2>
		{#if kind === 'sale'}
			<div class="grid gap-3 sm:grid-cols-3">
				<label class="block">
					<span class={label}>E paguar?</span>
					<select bind:value={paymentStatus} class={field}>
						<option value="unpaid">Jo ende</option>
						<option value="paid">Po</option>
					</select>
				</label>
				<label class="block">
					<span class={label}>Mënyra</span>
					<select bind:value={paymentMethod} class={field}>
						<option value="cash_on_delivery">Pagesë në dorëzim</option>
						<option value="bank_transfer">Transfertë bankare</option>
						<option value="cash">Kesh</option>
					</select>
				</label>
				<label class="block">
					<span class={label}>Zbritja</span>
					<input type="number" min="0" step="0.01" inputmode="decimal" bind:value={discount} class={field} />
				</label>
			</div>
		{/if}
		<label class="mt-3 block">
			<span class={label}>Shënime</span>
			<textarea bind:value={notes} rows="2" placeholder={kind === 'gift' ? 'Profili, çfarë pritet (video, story)…' : 'Çdo kërkesë e veçantë e klientit…'} class={field}></textarea>
		</label>

		<!-- What this order is worth, before saving it. -->
		<div class="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
			<div class="flex justify-between"><span class="text-slate-600">{units} {units === 1 ? 'copë' : 'copë'}</span><span class="tabular text-lg font-semibold text-slate-900">{kind === 'gift' ? 'Falas' : money(revenue)}</span></div>
			<div class="flex justify-between text-xs text-slate-500"><span>Kosto e përafërt</span><span class="tabular">{money(cost)}</span></div>
			<div class="flex justify-between text-xs font-medium {revenue - cost >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
				<span>{kind === 'gift' ? 'Kosto marketingu' : 'Fitimi i përafërt'}</span>
				<span class="tabular">{money(kind === 'gift' ? cost : revenue - cost)}</span>
			</div>
		</div>
	</section>

	{#if error}
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
	{/if}

	<div class="flex gap-2">
		<button disabled={saving} class="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
			{saving ? 'Duke ruajtur…' : 'Ruaj porosinë'}
		</button>
		<a href="/orders" class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">Anulo</a>
	</div>
</form>
