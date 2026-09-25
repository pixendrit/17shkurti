<script lang="ts">
	import { enhance } from '$app/forms';
	import FormError from '$lib/components/FormError.svelte';
	import Thumb from '$lib/components/Thumb.svelte';
	import { busy } from '$lib/client/enhance';
	import { money, formatDate, field, label, primary, COLOR_LABELS, REASON_LABELS } from '$lib/ui';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import Printer from '@lucide/svelte/icons/printer';
	import Brush from '@lucide/svelte/icons/brush';
	import Plus from '@lucide/svelte/icons/plus';

	let { data } = $props();
	let tab = $state<'blanks' | 'prints' | 'ledger'>('blanks');

	/** What the correction form is set to; picking a cell fills it in. */
	let subject = $state('');
	let count = $state('');
	let form: HTMLElement | undefined = $state();
	function pick(key: string, have: number) {
		subject = key;
		count = String(have);
		form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
	const cellTone = (have: number, short: number) =>
		short > 0 ? 'bg-amber-50 text-amber-900' : have > 0 ? 'bg-white text-slate-900' : 'bg-slate-50 text-slate-400';
</script>

<svelte:head><title>Stoku — Hijeshi</title></svelte:head>

<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-xl font-semibold text-slate-900">Stoku</h1>
	<div class="flex gap-2">
		<a href="/purchases?kind=blanks" class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"><Plus class="size-3.5" /> Bleva bluza</a>
		<a href="/purchases?kind=dtf" class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"><Plus class="size-3.5" /> Mora DTF</a>
	</div>
</div>

<FormError />

{#if data.toBuy.length || data.toPrint.length || data.custom.length}
	<div class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#if data.toBuy.length}
			<section class="rounded-xl border border-amber-200 bg-amber-50 p-4">
				<h2 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900"><ShoppingCart class="size-4" /> Bluza për të blerë</h2>
				<ul class="space-y-1 text-sm text-amber-900">
					{#each data.toBuy as b (b.label)}<li class="flex justify-between gap-2"><span>{b.label}</span><span class="tabular font-semibold">{b.short}</span></li>{/each}
				</ul>
			</section>
		{/if}
		{#if data.toPrint.length}
			<section class="rounded-xl border border-orange-200 bg-orange-50 p-4">
				<h2 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-orange-900"><Printer class="size-4" /> DTF për të printuar</h2>
				<ul class="space-y-1 text-sm text-orange-900">
					{#each data.toPrint as p (p.printId)}<li class="flex justify-between gap-2"><span>{p.design} · bluzë {COLOR_LABELS[p.color].toLowerCase()}</span><span class="tabular font-semibold">{p.short}</span></li>{/each}
				</ul>
				<p class="mt-2 border-t border-orange-200 pt-2 text-sm font-semibold text-orange-900">Porosit ≈ {data.dtfOrder.metres} m DTF · {money(data.dtfOrder.cost)}</p>
			</section>
		{/if}
		{#if data.custom.length}
			<section class="rounded-xl border border-violet-200 bg-violet-50 p-4">
				<h2 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-violet-900"><Brush class="size-4" /> Printime të personalizuara</h2>
				<ul class="space-y-1.5 text-sm text-violet-900">
					{#each data.custom as c (c.lineId)}
						<li class="flex items-center gap-2">
							<Thumb id={c.front} size="size-8" />
							<a href="/orders/{c.orderId}" class="min-w-0 flex-1 truncate underline decoration-violet-300 underline-offset-2">{c.code} · {c.label}</a>
							<span class="tabular font-semibold">{c.quantity}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{:else}
	<p class="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Keni gjithçka që u duhet porosive të hapura.</p>
{/if}

<div class="mb-4 flex gap-1">
	{#each [['blanks', 'Bluzat pa print'], ['prints', 'Printimet DTF'], ['ledger', 'Lëvizjet']] as const as [key, text] (key)}
		<button onclick={() => (tab = key)} class="rounded-lg px-3 py-1.5 text-sm font-medium {tab === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}">{text}</button>
	{/each}
</div>

{#if tab === 'blanks'}
	<div class="space-y-4">
		{#each data.blanks as g (g.label)}
			<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
				<header class="flex items-baseline justify-between border-b border-slate-100 px-4 py-3">
					<h2 class="text-sm font-semibold text-slate-900">{g.label}</h2>
					<span class="text-xs text-slate-500">{money(g.cost)} / copë</span>
				</header>
				<div class="grid grid-cols-3 gap-px bg-slate-100 sm:grid-cols-6">
					{#each g.sizes as s (s.key)}
						<button onclick={() => pick(s.key, s.have)} class="px-2 py-2.5 text-center {cellTone(s.have, s.short)} hover:ring-2 hover:ring-inset hover:ring-slate-300">
							<span class="block text-xs font-medium text-slate-500">{s.size}</span>
							<span class="tabular block text-lg font-semibold">{s.have}</span>
							{#if s.reserved}<span class="block text-[11px]">{s.reserved} për porosi{#if s.short} · <b>mungojnë {s.short}</b>{/if}</span>{/if}
						</button>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{:else if tab === 'prints'}
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="divide-y divide-slate-100">
			{#each data.prints as p (p.printId)}
				<button onclick={() => pick(p.key, p.have)} class="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
					<Thumb id={p.front} size="size-10" />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-slate-900">{p.design}</p>
						<p class="text-xs text-slate-500">bluzë {COLOR_LABELS[p.color].toLowerCase()} · {p.perSheet} për fletë{#if p.reserved} · {p.reserved} për porosi{/if}</p>
					</div>
					<span class="tabular text-lg font-semibold {p.short ? 'text-amber-700' : p.have ? 'text-slate-900' : 'text-slate-400'}">{p.have}</span>
				</button>
			{:else}
				<p class="px-4 py-6 text-center text-sm text-slate-500">Shtoni dizajne te faqja Dizajnet.</p>
			{/each}
		</div>
	</section>
{:else}
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<ul class="divide-y divide-slate-100 text-sm">
			{#each data.ledger as m (m.id)}
				<li class="flex items-center gap-3 px-4 py-2">
					<div class="min-w-0 flex-1">
						<p class="truncate text-slate-900">{m.label}</p>
						<p class="truncate text-xs text-slate-500">
							{[formatDate(m.at), REASON_LABELS[m.reason], m.note].filter(Boolean).join(' · ')}
							{#if m.orderCode}· <a href="/orders/{m.orderId}" class="underline">{m.orderCode}</a>{/if}
						</p>
					</div>
					<span class="tabular font-semibold {m.delta < 0 ? 'text-rose-700' : 'text-emerald-700'}">{m.delta > 0 ? '+' : ''}{m.delta}</span>
				</li>
			{:else}
				<li class="px-4 py-6 text-center text-slate-500">Ende asnjë lëvizje.</li>
			{/each}
		</ul>
	</section>
{/if}

<section bind:this={form} class="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
	<h2 class="text-sm font-semibold text-slate-900">Numërim / korrigjim</h2>
	<p class="mb-3 text-xs text-slate-500">Shkruani sa copë ka realisht. Diferenca ruhet si lëvizje, që numri të shpjegohet gjithmonë.</p>
	<form method="POST" action="?/count" use:enhance={busy({ after: () => ((subject = ''), (count = '')) })} class="grid gap-2 sm:grid-cols-4">
		<label class="block sm:col-span-2">
			<span class={label}>Çfarë</span>
			<select name="subject" bind:value={subject} required class={field}>
				<option value="" disabled>Zgjidhni…</option>
				<optgroup label="Bluza pa print">
					{#each data.blanks as g (g.label)}{#each g.sizes as s (s.key)}<option value={s.key}>{g.label} · {s.size}</option>{/each}{/each}
				</optgroup>
				<optgroup label="Printime DTF">
					{#each data.prints as p (p.printId)}<option value={p.key}>{p.design} · bluzë {COLOR_LABELS[p.color].toLowerCase()}</option>{/each}
				</optgroup>
			</select>
		</label>
		<label class="block"><span class={label}>Sa ka</span><input name="count" bind:value={count} inputmode="numeric" required class={field} /></label>
		<label class="block"><span class={label}>Shënim</span><input name="note" placeholder="p.sh. e dëmtuar" class={field} /></label>
		<button class="{primary} sm:col-span-4">Ruaj</button>
	</form>
</section>
