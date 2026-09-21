<script lang="ts">
	import { PRODUCT_TYPES, SIZES, COLORS, money } from '$lib/constants';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let { data, form } = $props();

	type Row = {
		productType: string;
		color: string;
		size: string;
		designId: string;
		quantity: number;
		unitPrice: number;
	};

	let rows = $state<Row[]>([
		{ productType: 'T-Shirt', color: 'White', size: 'M', designId: '', quantity: 1, unitPrice: 1500 }
	]);
	let shippingFee = $state(0);
	let discount = $state(0);

	const subtotal = $derived(rows.reduce((a, r) => a + r.quantity * r.unitPrice, 0));
	const total = $derived(subtotal + shippingFee - discount);

	function addRow() {
		const last = rows[rows.length - 1];
		rows.push({
			productType: last?.productType ?? 'T-Shirt',
			color: last?.color ?? 'White',
			size: 'M',
			designId: last?.designId ?? '',
			quantity: 1,
			unitPrice: last?.unitPrice ?? 1500
		});
	}
</script>

<svelte:head><title>New order — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center gap-3">
	<a href="/orders" class="text-sm text-slate-500 hover:text-slate-900">← Orders</a>
	<h1 class="text-xl font-semibold text-slate-900">New order</h1>
	<span class="font-mono text-xs text-slate-400">{data.code}</span>
</div>

{#if form?.error}
	<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
{/if}

<form method="POST" class="space-y-4">
	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-slate-900">Customer</h2>
		<div class="grid gap-3 sm:grid-cols-2">
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Name *</span>
				<input name="customerName" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Phone *</span>
				<input name="phone" required inputmode="tel" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
			</label>
			<label class="block sm:col-span-2">
				<span class="mb-1 block text-xs font-medium text-slate-600">Address</span>
				<input name="address" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">City</span>
				<input name="city" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Came from</span>
				<select name="channel" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none">
					<option value="instagram">Instagram</option>
					<option value="messenger">Messenger</option>
					<option value="tiktok">TikTok</option>
					<option value="whatsapp">WhatsApp</option>
					<option value="other">Other</option>
				</select>
			</label>
		</div>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-slate-900">Items</h2>
			<button type="button" onclick={addRow} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
				<Plus class="size-3.5" /> Add item
			</button>
		</div>

		<div class="space-y-3">
			{#each rows as row, i (i)}
				<div class="rounded-lg border border-slate-200 p-3">
					<div class="grid gap-2 sm:grid-cols-6">
						<label class="block sm:col-span-2">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Product</span>
							<select name="productType" bind:value={row.productType} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
								{#each PRODUCT_TYPES as p (p)}<option value={p}>{p}</option>{/each}
							</select>
						</label>
						<label class="block">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Colour</span>
							<select name="color" bind:value={row.color} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
								{#each COLORS as c (c)}<option value={c}>{c}</option>{/each}
							</select>
						</label>
						<label class="block">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Size</span>
							<select name="size" bind:value={row.size} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
								{#each SIZES as s (s)}<option value={s}>{s}</option>{/each}
							</select>
						</label>
						<label class="block sm:col-span-2">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Design</span>
							<select name="designId" bind:value={row.designId} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
								<option value="">— Plain / no print —</option>
								{#each data.designs as d (d.id)}<option value={String(d.id)}>{d.name}</option>{/each}
							</select>
						</label>
					</div>
					<div class="mt-2 flex items-end gap-2">
						<label class="block w-20">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Qty</span>
							<input name="quantity" type="number" min="1" bind:value={row.quantity} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
						</label>
						<label class="block w-32">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Price each</span>
							<input name="unitPrice" type="number" min="0" step="1" bind:value={row.unitPrice} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
						</label>
						<p class="tabular flex-1 text-right text-sm font-medium text-slate-700">
							{money(row.quantity * row.unitPrice)}
						</p>
						{#if rows.length > 1}
							<button type="button" onclick={() => rows.splice(i, 1)} aria-label="Remove item" class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
								<Trash2 class="size-4" />
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-slate-900">Payment</h2>
		<div class="grid gap-3 sm:grid-cols-4">
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Shipping</span>
				<input name="shippingFee" type="number" min="0" bind:value={shippingFee} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Discount</span>
				<input name="discount" type="number" min="0" bind:value={discount} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Paid?</span>
				<select name="paymentStatus" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
					<option value="unpaid">Not yet</option>
					<option value="paid">Paid</option>
				</select>
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Method</span>
				<select name="paymentMethod" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
					<option value="cash_on_delivery">Cash on delivery</option>
					<option value="bank_transfer">Bank transfer</option>
					<option value="cash">Cash</option>
				</select>
			</label>
		</div>

		<label class="mt-3 block">
			<span class="mb-1 block text-xs font-medium text-slate-600">Notes</span>
			<textarea name="notes" rows="2" placeholder="Anything they asked for…" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></textarea>
		</label>

		<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
			<span class="text-sm text-slate-600">Total</span>
			<span class="tabular text-lg font-semibold text-slate-900">{money(total)}</span>
		</div>
	</section>

	<input type="hidden" name="status" value="new" />

	<div class="flex gap-2">
		<button class="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
			Save order
		</button>
		<a href="/orders" class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">Cancel</a>
	</div>
</form>
