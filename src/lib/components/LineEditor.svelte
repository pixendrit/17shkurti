<script lang="ts">
	/**
	 * The shirts of an order: one block per kind of shirt. Posts the rows as
	 * the `line` field plus garment-/color-/size-/art-/qty-/price-/id-<key>
	 * fields, and mockups as front-/back-<key> (see forms.parseLines).
	 */
	import Thumb from './Thumb.svelte';
	import { shrink } from '$lib/client/shrink';
	import { newRow, type Row } from '$lib/client/lines';
	import { parseEuro } from '$lib/domain/money';
	import { COLORS, GARMENTS, SIZES, type Print } from '$lib/domain/model';
	import { money, small, COLOR_LABELS, GARMENT_LABELS, imageUrl } from '$lib/ui';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		rows = $bindable(),
		designs,
		kind,
		defaultPrice
	}: {
		rows: Row[];
		designs: { id: string; name: string; prints: Print[] }[];
		kind: 'sale' | 'gift';
		defaultPrice: number;
	} = $props();

	export const printFor = (art: string, color: string) =>
		art.startsWith('design:') ? designs.find((d) => d.id === art.slice(7))?.prints.find((p) => p.shirtColor === color) : undefined;
	const n = (t: string) => Math.max(0, Number.parseInt(t, 10) || 0);
</script>

<div class="mb-3 flex items-center justify-between">
	<h2 class="text-sm font-semibold text-slate-900">Artikujt</h2>
	<button type="button" onclick={() => rows.push(newRow(defaultPrice, rows[rows.length - 1]))} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
		<Plus class="size-3.5" /> Shto artikull
	</button>
</div>

<div class="space-y-3">
	{#each rows as row, i (row.key)}
		{@const k = row.key}
		{@const print = printFor(row.art, row.color)}
		<div class="rounded-lg border p-3 {row.art === 'custom' ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200'}">
			<input type="hidden" name="line" value={k} />
			{#if row.id}<input type="hidden" name="id-{k}" value={row.id} />{/if}
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
						{#each designs as d (d.id)}<option value="design:{d.id}">{d.name}</option>{/each}
						<option value="custom">✎ I personalizuar (me mockup)</option>
					</select>
				</label>
			</div>

			{#if row.art === 'custom'}
				<!-- A personalised print can't be made without knowing exactly what goes on it. -->
				<div class="mt-2 grid grid-cols-2 gap-2">
					{#each [['front', 'Mockup para', 'keptFront'], ['back', 'Mockup pas', 'keptBack']] as const as [side, text, keptKey] (side)}
						{@const shown = row[side] ?? (row[keptKey] ? imageUrl(row[keptKey]!) : null)}
						<label class="block cursor-pointer rounded-lg border-2 border-dashed {shown ? 'border-violet-300' : 'border-violet-400 bg-white'} p-2 text-center">
							{#if shown}
								<img src={shown} alt={text} class="mx-auto aspect-square w-full rounded object-cover" />
								<span class="mt-1 block text-[11px] text-violet-700">Ndrysho</span>
							{:else}
								<span class="block py-6 text-xs font-medium text-violet-800">{text} *</span>
							{/if}
							<input type="file" name="{side}-{k}" accept="image/*" required={!row[keptKey]} class="sr-only" use:shrink={(url) => (row[side] = url)} />
						</label>
					{/each}
				</div>
			{:else if row.art.startsWith('design:')}
				{#if print}
					{#if print.front || print.back}
						<div class="mt-2 flex gap-2"><Thumb id={print.front} size="size-16" alt="para" /><Thumb id={print.back} size="size-16" alt="pas" /></div>
					{/if}
				{:else}
					<p class="mt-2 text-xs font-medium text-amber-700">Ky dizajn nuk ka ende print për bluzë {COLOR_LABELS[row.color].toLowerCase()}: shtojeni te Dizajnet.</p>
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
