<script lang="ts">
	import { enhance } from '$app/forms';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Thumb from '$lib/components/Thumb.svelte';
	import FormError from '$lib/components/FormError.svelte';
	import OrderList from '$lib/components/OrderList.svelte';
	import { busy } from '$lib/client/enhance';
	import { euroInput } from '$lib/domain/money';
	import { CHANNELS, COUNTRIES, PAYMENT_METHODS } from '$lib/domain/model';
	import {
		money, formatDate, formatDateTime, dayInput, imageUrl, field, label, primary, secondary,
		CHANNEL_LABELS, COUNTRY_LABELS, DELIVERY_LABELS, EVENT_LABELS, KIND_LABELS, PAYMENT_LABELS, REASON_LABELS
	} from '$lib/ui';
	import Phone from '@lucide/svelte/icons/phone';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Copy from '@lucide/svelte/icons/copy';
	import Gift from '@lucide/svelte/icons/gift';
	import Pencil from '@lucide/svelte/icons/pencil';
	import X from '@lucide/svelte/icons/x';

	let { data } = $props();
	const o = $derived(data.order);
	const c = $derived(data.customer);
	const e = $derived(data.economics);
	let editing = $state(false);
	let copied = $state(false);
	let editDelivery = $state<'courier' | 'hand'>('courier');

	/** One tap copies the address block for the courier's form. */
	async function copyAddress() {
		if (!c) return;
		const text = [c.name, c.phone, c.address, [c.city, COUNTRY_LABELS[c.country]].filter(Boolean).join(', ')].filter(Boolean).join('\n');
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}

	/** The main next step gets the big button; undo, cancel and return stay small. */
	const MAIN = ['start', 'make', 'hand_over', 'deliver'] as const;
	const main = $derived(data.events.filter((ev) => (MAIN as readonly string[]).includes(ev)));
	const minor = $derived(data.events.filter((ev) => !(MAIN as readonly string[]).includes(ev)));
	const eventLabel = (ev: string) =>
		ev === 'deliver' && o.delivery.method === 'hand' ? 'U dorëzua në dorë' : EVENT_LABELS[ev as keyof typeof EVENT_LABELS];

	const costLines = $derived([
		['Bluzat pa print', e.blank],
		['DTF', e.dtf],
		['Puna', e.labor],
		['Paketimi', e.packaging],
		[o.delivery.method === 'courier' ? 'Posta' : 'Dorëzimi', e.delivery]
	] as const);

	const timeline = $derived(
		[
			['Porosia u mor', o.createdAt],
			['U bë', o.madeAt],
			['Iu dha postierit', o.handedOverAt],
			['U dorëzua', o.deliveredAt],
			['U kthye', o.returnedAt],
			['U anulua', o.cancelledAt]
		].filter((x): x is [string, number] => x[1] != null)
	);
</script>

<svelte:head><title>{o.code} — Hijeshi</title></svelte:head>

<div class="mb-5 flex flex-wrap items-center gap-2">
	<a href="/orders" class="text-sm text-slate-500 hover:text-slate-900">← Porositë</a>
	<h1 class="text-xl font-semibold text-slate-900">{o.code}</h1>
	<StatusBadge status={o.status} label={data.statusLabel} />
	{#if o.kind === 'gift'}
		<span class="inline-flex items-center gap-1 rounded bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700"><Gift class="size-3" /> Dhuratë</span>
	{:else if e.revenue > 0 && data.balance <= 0}
		<span class="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">E paguar</span>
	{:else if data.balance > 0}
		<span class="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{data.paid > 0 ? `Mbeten ${money(data.balance)}` : 'E papaguar'}</span>
	{/if}
	{#if o.isDemo}<span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">demo</span>{/if}
</div>

<FormError />

<div class="grid gap-4 *:min-w-0 lg:grid-cols-3">
	<div class="space-y-4 lg:col-span-2">
		{#if editing}
			<form method="POST" action="?/edit" use:enhance={() => async ({ result, update }) => { await update({ reset: false }); if (result.type === 'success') editing = false; }} class="rounded-xl border border-slate-900 bg-white p-4 shadow-sm">
				<h2 class="mb-3 text-sm font-semibold text-slate-900">Ndrysho porosinë</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="block"><span class={label}>Emri</span><input name="name" value={c?.name ?? ''} required class={field} /></label>
					<label class="block"><span class={label}>Telefoni</span><input name="phone" value={c?.phone ?? ''} required class={field} /></label>
					<label class="block sm:col-span-2"><span class={label}>Adresa</span><input name="address" value={c?.address ?? ''} class={field} /></label>
					<label class="block"><span class={label}>Qyteti</span><input name="city" value={c?.city ?? ''} class={field} /></label>
					<label class="block"><span class={label}>Shteti</span>
						<select name="country" class={field}>{#each COUNTRIES as k (k)}<option value={k} selected={c?.country === k}>{COUNTRY_LABELS[k]}</option>{/each}</select>
					</label>
					<label class="block"><span class={label}>Burimi</span>
						<select name="channel" class={field}>{#each CHANNELS as k (k)}<option value={k} selected={o.channel === k}>{CHANNEL_LABELS[k]}</option>{/each}</select>
					</label>
					<label class="block"><span class={label}>Lloji</span>
						<select name="kind" class={field}><option value="sale" selected={o.kind === 'sale'}>Shitje</option><option value="gift" selected={o.kind === 'gift'}>Dhuratë / influencer</option></select>
					</label>
					<label class="block"><span class={label}>Dërgesa</span>
						<select name="delivery" bind:value={editDelivery} class={field}>
							<option value="courier">{DELIVERY_LABELS.courier}</option><option value="hand">{DELIVERY_LABELS.hand}</option>
						</select>
					</label>
					<label class="block"><span class={label}>{editDelivery === 'courier' ? 'Posta na kushton €' : 'Dorëzimi na kushton €'}</span><input name="deliveryCost" value={euroInput(o.delivery.cost)} inputmode="decimal" class={field} /></label>
					{#if editDelivery === 'courier'}
						<label class="block"><span class={label}>Nr. i dërgesës</span><input name="trackingRef" value={o.delivery.method === 'courier' ? o.delivery.trackingRef : ''} class={field} /></label>
					{/if}
					<label class="block"><span class={label}>Transport nga klienti €</span><input name="shippingCharged" value={euroInput(o.shippingCharged)} inputmode="decimal" class={field} /></label>
					<label class="block"><span class={label}>Zbritja €</span><input name="discount" value={euroInput(o.discount)} inputmode="decimal" class={field} /></label>
					<label class="block sm:col-span-2"><span class={label}>Shënime</span><textarea name="notes" rows="2" class={field}>{o.notes}</textarea></label>
				</div>
				<p class="mt-2 text-xs text-slate-500">Bluzat dhe kostot e tyre mbeten siç u morën me porosinë.</p>
				<div class="mt-3 flex gap-2">
					<button class={primary}>Ruaj</button>
					<button type="button" onclick={() => (editing = false)} class={secondary}>Anulo</button>
				</div>
			</form>
		{:else}
			<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h2 class="font-semibold text-slate-900">{c?.name ?? '—'}</h2>
						{#if c}
							<p class="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><Phone class="size-3.5" /><a href="tel:{c.phone}" class="hover:underline">{c.phone}</a></p>
							<p class="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
								<MapPin class="mt-0.5 size-3.5 shrink-0" /><span>{[c.address, c.city, COUNTRY_LABELS[c.country]].filter(Boolean).join(', ')}</span>
							</p>
						{/if}
						<p class="mt-2 text-xs text-slate-500">{KIND_LABELS[o.kind]} · {CHANNEL_LABELS[o.channel]} · {DELIVERY_LABELS[o.delivery.method]} · {formatDate(o.createdAt)}</p>
						{#if o.delivery.method === 'courier' && o.delivery.trackingRef}
							<p class="mt-1 text-xs text-slate-500">Nr. i dërgesës: <span class="font-mono">{o.delivery.trackingRef}</span></p>
						{/if}
					</div>
					<div class="flex shrink-0 flex-col gap-1.5">
						<button onclick={copyAddress} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"><Copy class="size-3.5" /> {copied ? 'U kopjua' : 'Kopjo'}</button>
						<button onclick={() => ((editDelivery = o.delivery.method), (editing = true))} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"><Pencil class="size-3.5" /> Ndrysho</button>
					</div>
				</div>
				{#if o.notes}<p class="mt-3 whitespace-pre-line rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{o.notes}</p>{/if}
			</section>
		{/if}

		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">Artikujt</h2></header>
			<div class="divide-y divide-slate-100">
				{#each data.lines as { line: l, label: text, printName, images } (l.id)}
					<div class="px-4 py-3">
						<div class="flex items-start gap-3">
							{#if l.artwork.kind === 'print'}<Thumb id={images.back ?? images.front} size="size-14" alt={printName ?? ''} />{/if}
							<div class="min-w-0 flex-1">
								<p class="font-medium text-slate-900">{text}</p>
								<p class="text-xs text-slate-500">
									{#if l.artwork.kind === 'custom'}<span class="font-medium text-violet-700">Print i personalizuar</span> · {/if}
									kosto për copë {money(l.cost.blank + l.cost.dtf + l.cost.labor)}
								</p>
							</div>
							<p class="tabular shrink-0 text-sm font-medium text-slate-700">{o.kind === 'gift' ? 'Falas' : money(l.quantity * l.unitPrice)}</p>
						</div>
						{#if l.artwork.kind === 'custom'}
							<div class="mt-3 grid grid-cols-2 gap-2 sm:max-w-sm">
								{#each [['front', 'para'], ['back', 'pas']] as const as [side, text] (side)}
									<a href={imageUrl(images[side]!)} target="_blank" class="block">
										<img src={imageUrl(images[side]!)} alt="Mockup {text}" class="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
										<span class="mt-0.5 block text-center text-[11px] text-slate-500">Mockup {text}</span>
									</a>
								{/each}
							</div>
							{#if o.status === 'new' || o.status === 'in_production'}
								<form method="POST" action="?/printReady" use:enhance={busy()} class="mt-2">
									<input type="hidden" name="lineId" value={l.id} />
									<input type="hidden" name="ready" value={l.artwork.printReady ? '0' : '1'} />
									<button class="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium {l.artwork.printReady ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-violet-300 text-violet-800 hover:bg-violet-50'}">
										{#if l.artwork.printReady}<CircleCheck class="size-3.5" /> Printi ka ardhur (zhbëj){:else}Shëno: printi DTF ka ardhur{/if}
									</button>
								</form>
							{/if}
						{/if}
					</div>
				{/each}
			</div>

			<div class="space-y-1 border-t border-slate-100 px-4 py-3 text-sm">
				{#if o.kind === 'sale'}
					<div class="flex justify-between text-slate-600"><span>Nëntotali</span><span class="tabular">{money(e.subtotal)}</span></div>
					{#if o.shippingCharged}<div class="flex justify-between text-slate-600"><span>Transport nga klienti</span><span class="tabular">{money(o.shippingCharged)}</span></div>{/if}
					{#if o.discount}<div class="flex justify-between text-slate-600"><span>Zbritja</span><span class="tabular">−{money(o.discount)}</span></div>{/if}
					<div class="flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900"><span>Të ardhurat</span><span class="tabular">{money(e.revenue)}</span></div>
				{/if}
				{#each costLines as [name, v] (name)}
					<div class="flex justify-between text-xs text-slate-500"><span>− {name}</span><span class="tabular">{money(v)}</span></div>
				{/each}
				<div class="flex justify-between border-t border-slate-100 pt-1 text-sm font-semibold {e.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
					<span>{o.kind === 'gift' ? 'Kosto marketingu' : o.status === 'returned' ? 'Humbja nga kthimi' : 'Fitimi'}</span>
					<span class="tabular">{money(o.kind === 'gift' ? e.cost : e.profit)}</span>
				</div>
				{#if o.status === 'cancelled'}<p class="text-xs text-slate-400">E anuluar: nuk llogaritet në statistika.</p>{/if}
			</div>
		</section>

		{#if data.historyCount > 0}
			<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
				<header class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">Porositë e tjera të klientit ({data.historyCount})</h2></header>
				<OrderList rows={data.history} />
			</section>
		{/if}
	</div>

	<div class="space-y-4">
		<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<h2 class="mb-3 text-sm font-semibold text-slate-900">Hapi i radhës</h2>
			{#if data.readiness && !data.readiness.ready}
				<div class="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
					<p class="flex items-center gap-1 font-medium"><TriangleAlert class="size-3.5" /> Ende nuk mund të bëhet</p>
					<ul class="mt-1 list-disc pl-5">
						{#each data.readiness.short as s (s)}<li>mungon {s}</li>{/each}
						{#if data.readiness.customPending}<li>{data.readiness.customPending} print i personalizuar s’ka ardhur</li>{/if}
					</ul>
					<p class="mt-1 text-amber-800">Porositë më të vjetra marrin stokun e para.</p>
				</div>
			{:else if data.readiness?.ready}
				<p class="mb-3 flex items-center gap-1 text-xs font-medium text-emerald-700"><CircleCheck class="size-3.5" /> Gjithçka në stok — mund të bëhet tani</p>
			{/if}
			<form method="POST" action="?/advance" use:enhance={busy()} class="space-y-2">
				{#each main as ev (ev)}
					<button name="event" value={ev} class="w-full rounded-lg px-3 py-2.5 text-sm font-semibold {ev === 'make' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'} disabled:opacity-50">
						{eventLabel(ev)}
					</button>
				{/each}
				{#if main.length === 0}<p class="text-sm text-slate-500">Porosia ka përfunduar.</p>{/if}
				{#if minor.length}
					<div class="flex flex-wrap gap-2 pt-1">
						{#each minor as ev (ev)}
							<button name="event" value={ev} class="rounded-lg border px-2.5 py-1.5 text-xs font-medium {ev === 'undo' ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'border-rose-200 text-rose-700 hover:bg-rose-50'} disabled:opacity-50">
								{eventLabel(ev)}
							</button>
						{/each}
					</div>
				{/if}
			</form>
			{#if main.includes('make')}<p class="mt-2 text-xs text-slate-500">„U bë” merr bluzat dhe printimet nga stoku.</p>{/if}
			<ul class="mt-3 space-y-0.5 border-t border-slate-100 pt-2 text-xs text-slate-500">
				{#each timeline as [what, at] (what)}<li class="flex justify-between"><span>{what}</span><span>{formatDateTime(at)}</span></li>{/each}
			</ul>
		</section>

		{#if o.kind === 'sale'}
			<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<h2 class="mb-3 text-sm font-semibold text-slate-900">Pagesat</h2>
				{#if data.payments.length}
					<ul class="mb-3 space-y-1.5 text-sm">
						{#each data.payments as p (p.id)}
							<li class="flex items-center gap-2">
								<span class="flex-1 text-slate-600">{formatDate(p.receivedAt)} · {PAYMENT_LABELS[p.method]}</span>
								<span class="tabular font-medium">{money(p.amount)}</span>
								<form method="POST" action="?/unpay" use:enhance={busy({ confirm: 'Ta heq këtë pagesë?' })}>
									<input type="hidden" name="paymentId" value={p.id} />
									<button aria-label="Hiq pagesën" class="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><X class="size-3.5" /></button>
								</form>
							</li>
						{/each}
					</ul>
				{/if}
				<p class="mb-2 flex justify-between text-sm"><span class="text-slate-600">Mbeten</span><span class="tabular font-semibold {data.balance > 0 ? 'text-red-700' : data.balance < 0 ? 'text-amber-700' : 'text-emerald-700'}">{money(data.balance)}</span></p>
				{#if data.balance < 0}<p class="mb-2 text-xs text-amber-800">Klientit i detyrohemi {money(-data.balance)} (paguar, pastaj kthyer ose zbritur).</p>{/if}
				{#if data.balance > 0}
					<form method="POST" action="?/pay" use:enhance={busy()} class="space-y-2">
						<div class="grid grid-cols-2 gap-2">
							<label class="block"><span class={label}>Shuma €</span><input name="amount" placeholder={euroInput(data.balance)} inputmode="decimal" class={field} /></label>
							<label class="block"><span class={label}>Data</span><input type="date" name="date" value={dayInput(Math.floor(Date.now() / 1000))} class={field} /></label>
						</div>
						<select name="method" class={field}>
							{#each PAYMENT_METHODS as m (m)}<option value={m} selected={m === (o.delivery.method === 'courier' ? 'cod' : 'cash')}>{PAYMENT_LABELS[m]}</option>{/each}
						</select>
						<button class="{primary} w-full">Shëno pagesën</button>
					</form>
				{/if}
			</section>
		{/if}

		{#if data.movements.length}
			<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<h2 class="mb-2 text-sm font-semibold text-slate-900">Stoku i përdorur</h2>
				<ul class="space-y-1 text-xs text-slate-600">
					{#each data.movements as m (m.id)}
						<li class="flex justify-between gap-2"><span>{REASON_LABELS[m.reason]}: {m.label}</span><span class="tabular font-medium {m.delta < 0 ? 'text-rose-700' : 'text-emerald-700'}">{m.delta > 0 ? '+' : ''}{m.delta}</span></li>
					{/each}
				</ul>
			</section>
		{/if}

		<form method="POST" action="?/delete" use:enhance={busy({ confirm: 'Ta fshij përgjithmonë këtë porosi? Pagesat fshihen dhe stoku kthehet.' })}>
			<button class="w-full rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-600">Fshi porosinë</button>
		</form>
	</div>
</div>
