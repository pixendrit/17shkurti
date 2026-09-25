<script lang="ts">
	import StatTile from '$lib/components/StatTile.svelte';
	import BarList from '$lib/components/BarList.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import SplitBar from '$lib/components/SplitBar.svelte';
	import { money, plural, monthLabel, CHANNEL_LABELS, COUNTRY_LABELS, DELIVERY_LABELS, EXPENSE_LABELS, PURCHASE_LABELS, COLOR_LABELS, GARMENT_LABELS } from '$lib/ui';
	import type { Channel, Country, DeliveryMethod, ExpenseCategory } from '$lib/domain/model';

	let { data } = $props();
	let showTable = $state(false);

	const ranges = [
		{ days: 30, label: '30 ditë' },
		{ days: 90, label: '90 ditë' },
		{ days: 365, label: '1 vit' },
		{ days: 0, label: 'Gjithë kohën' }
	];
	const pct = (n: number) => `${Math.round(n * 100)}%`;

	// Categorical slots 1–6 in their validated order (see dataviz palette).
	const perShirt = $derived([
		{ label: 'Bluza', value: data.perShirt.blank, color: '#2a78d6' },
		{ label: 'DTF', value: data.perShirt.dtf, color: '#eb6834' },
		{ label: 'Puna', value: data.perShirt.labor, color: '#1baf7a' },
		{ label: 'Paketimi', value: data.perShirt.packaging, color: '#eda100' },
		{ label: 'Posta', value: data.perShirt.delivery, color: '#e87ba4' },
		{ label: 'Fitimi', value: Math.max(0, data.perShirt.profit), color: '#008300' }
	]);

	const note = (n: number, units: number) => `· ${plural(n, 'porosi', 'porosi')} · ${units} copë`;
	const spentLabel = (k: string) =>
		(EXPENSE_LABELS as Record<string, string>)[k] ?? PURCHASE_LABELS[k as 'blanks'] ?? k;
	const designLabel = (k: string) => (k === 'custom' ? 'I personalizuar' : k === 'none' ? 'Pa print' : k);
</script>

<svelte:head><title>Statistika — Hijeshi</title></svelte:head>

<div class="viz-root">
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-xl font-semibold text-slate-900">Statistika</h1>
		<div class="flex gap-1">
			{#each ranges as r (r.days)}
				<a href="/stats?days={r.days}" class="rounded-lg px-3 py-1.5 text-sm font-medium {data.days === r.days ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}">{r.label}</a>
			{/each}
		</div>
	</div>

	<div class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Të ardhurat" value={money(data.revenue)} sub="{plural(data.orderCount, 'shitje', 'shitje')} · {data.unitsSold} copë" />
		<StatTile label="Fitimi neto" value={money(data.net)} sub="pas dhuratave dhe kthimeve" tone={data.net >= 0 ? 'good' : 'warn'} />
		<StatTile label="Fitimi + puna juaj" value={money(data.netWithLabor)} sub="nëse punën e bëni vetë" tone="good" />
		<StatTile label="Marzha e shitjeve" value={pct(data.margin)} sub="mesatarja {money(data.avgOrder)} / porosi" />
	</div>

	<div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Të arkëtuara" value={money(data.collected)} sub="pagesa të marra në periudhë" />
		<StatTile label="Për t'u arkëtuar" value={money(data.outstanding)} sub="tani, nga të gjitha shitjet" tone={data.outstanding > 0 ? 'warn' : 'neutral'} />
		<StatTile label="Dhurata / influencer" value={money(data.gifts.cost)} sub="{plural(data.gifts.orders, 'dhuratë', 'dhurata')} · {data.gifts.units} copë" />
		<StatTile label="Kthime" value={money(data.returns.loss)} sub={plural(data.returns.orders, 'pako e kthyer', 'pako të kthyera')} tone={data.returns.orders ? 'warn' : 'neutral'} />
	</div>

	<section class="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="border-b border-slate-100 px-4 py-3">
			<h2 class="text-sm font-semibold text-slate-900">Ku shkon një bluzë e shitur mesatarisht {money(data.perShirt.price)}</h2>
			<p class="text-xs text-slate-500">Mesatare mbi {data.unitsSold} bluza të shitura</p>
		</header>
		<div class="p-4"><SplitBar parts={perShirt} total={data.perShirt.price} /></div>
	</section>

	<section class="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="border-b border-slate-100 px-4 py-3">
			<h2 class="text-sm font-semibold text-slate-900">Paratë</h2>
			<p class="text-xs text-slate-500">Çfarë hyri dhe çfarë doli me të vërtetë në këtë periudhë</p>
		</header>
		<dl class="divide-y divide-slate-100 text-sm">
			<div class="flex justify-between px-4 py-2"><dt class="text-slate-600">Të arkëtuara nga shitjet</dt><dd class="tabular font-medium text-slate-900">{money(data.collected)}</dd></div>
			{#each data.spentBy as x (x.key)}
				<div class="flex justify-between px-4 py-2"><dt class="text-slate-600">− {spentLabel(x.key)}</dt><dd class="tabular text-slate-700">{money(x.amount)}</dd></div>
			{/each}
			<div class="flex justify-between px-4 py-2"><dt class="text-slate-600">− Posta dhe dorëzimet</dt><dd class="tabular text-slate-700">{money(data.deliveryCosts)}</dd></div>
			<div class="flex justify-between px-4 py-2.5 font-semibold {data.cashBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}"><dt>Bilanci</dt><dd class="tabular">{money(data.cashBalance)}</dd></div>
		</dl>
	</section>

	<section class="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
		<header class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold text-slate-900">Të ardhurat sipas muajve</h2>
				<p class="text-xs text-slate-500">Pa porositë e anuluara</p>
			</div>
			<button onclick={() => (showTable = !showTable)} class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">{showTable ? 'Grafiku' : 'Tabela'}</button>
		</header>
		<div class="p-4">
			{#if showTable}
				<table class="w-full text-sm">
					<thead><tr class="border-b border-slate-100 text-left text-xs text-slate-500"><th class="pb-2 font-medium">Muaji</th><th class="pb-2 text-right font-medium">Porosi</th><th class="pb-2 text-right font-medium">Të ardhura</th><th class="pb-2 text-right font-medium">Fitimi</th></tr></thead>
					<tbody>
						{#each data.byMonth as m (m.month)}
							<tr class="border-b border-slate-50"><td class="py-1.5">{monthLabel(m.month)}</td><td class="tabular py-1.5 text-right">{m.orders}</td><td class="tabular py-1.5 text-right">{money(m.revenue)}</td><td class="tabular py-1.5 text-right">{money(m.profit)}</td></tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<TrendChart points={data.byMonth.map((m) => ({ x: m.month, y: m.revenue }))} format={money} label="Të ardhurat" />
			{/if}
		</div>
	</section>

	<div class="grid gap-4 *:min-w-0 lg:grid-cols-2">
		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">Nga vijnë porositë</h2></header>
			<div class="p-4"><BarList rows={data.byChannel.map((c) => ({ label: CHANNEL_LABELS[c.key as Channel] ?? c.key, value: c.revenue, note: note(c.orders, c.units) }))} format={money} /></div>
		</section>
		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">Sipas shtetit</h2></header>
			<div class="p-4"><BarList rows={data.byCountry.map((c) => ({ label: COUNTRY_LABELS[c.key as Country] ?? c.key, value: c.revenue, note: note(c.orders, c.units) }))} format={money} /></div>
		</section>
		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">Posta apo dorëzim personal</h2></header>
			<div class="p-4"><BarList rows={data.byDelivery.map((c) => ({ label: DELIVERY_LABELS[c.key as DeliveryMethod] ?? c.key, value: c.revenue, note: note(c.orders, c.units) }))} format={money} /></div>
		</section>
		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">Dizajnet më të shitura</h2></header>
			<div class="p-4"><BarList rows={data.byDesign.slice(0, 8).map((d) => ({ label: designLabel(d.key), value: d.units }))} format={(n) => `${n} copë`} /></div>
		</section>
		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">Sipas ngjyrës dhe llojit</h2></header>
			<div class="space-y-4 p-4">
				<BarList rows={data.byColor.map((c) => ({ label: COLOR_LABELS[c.key], value: c.units }))} format={(n) => `${n} copë`} />
				<BarList rows={data.byGarment.map((g) => ({ label: GARMENT_LABELS[g.key], value: g.units }))} format={(n) => `${n} copë`} />
			</div>
		</section>
		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<header class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">Klientët</h2></header>
			<dl class="divide-y divide-slate-100 text-sm">
				<div class="flex justify-between px-4 py-2"><dt class="text-slate-600">Blerës në periudhë</dt><dd class="tabular font-medium">{data.customers}</dd></div>
				<div class="flex justify-between px-4 py-2"><dt class="text-slate-600">Blenë më shumë se një herë</dt><dd class="tabular font-medium">{data.returningCustomers}</dd></div>
			</dl>
		</section>
	</div>
</div>

<style>
	.viz-root {
		--series-1: #2a78d6;
	}
</style>
