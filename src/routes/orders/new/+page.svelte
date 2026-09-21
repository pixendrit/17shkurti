<script lang="ts">
	import { PRODUCT_TYPES, SIZES, COLORS, money } from '$lib/constants';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	import { base } from '$app/paths';
	import { createOrder } from '$lib/client/actions';

	let { data } = $props();
	let error = $state<string | null>(null);
	let saving = $state(false);
	let customerName = $state('');
	let phone = $state('');
	let address = $state('');
	let city = $state('');
	let channel = $state('instagram');
	let paymentStatus = $state('unpaid');
	let paymentMethod = $state('cash_on_delivery');
	let notes = $state('');

	async function submit(e: Event) {
		e.preventDefault();
		error = null;
		if (!customerName.trim()) return (error = 'Customer name is required.');
		if (!phone.trim()) return (error = 'Phone number is required.');
		const items = rows
			.filter((r) => r.productType && r.quantity > 0)
			.map((r) => ({ ...r, designId: r.designId ? Number(r.designId) : null }));
		if (items.length === 0) return (error = 'Add at least one item.');

		saving = true;
		try {
			await createOrder({
				customerName: customerName.trim(),
				phone: phone.trim(),
				address: address.trim(),
				city: city.trim(),
				channel,
				paymentStatus,
				paymentMethod,
				shippingFee: Number(shippingFee) || 0,
				discount: Number(discount) || 0,
				notes: notes.trim(),
				items
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not save the order.';
			saving = false;
		}
	}

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
	<a href="{base}/orders" class="text-sm text-slate-500 hover:text-slate-900">← Orders</a>
	<h1 class="text-xl font-semibold text-slate-900">New order</h1>
	<span class="font-mono text-xs text-slate-400">{data.code}</span>
</div>

{#if error}
	<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
{/if}

<form onsubmit={submit} class="space-y-4">
	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-slate-900">Customer</h2>
		<div class="grid gap-3 sm:grid-cols-2">
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Name *</span>
				<input bind:value={customerName} required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Phone *</span>
				<input bind:value={phone} required inputmode="tel" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
			</label>
			<label class="block sm:col-span-2">
				<span class="mb-1 block text-xs font-medium text-slate-600">Address</span>
				<input bind:value={address} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">City</span>
				<input bind:value={city} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Came from</span>
				<select bind:value={channel} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none">
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
							<select bind:value={row.productType} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
								{#each PRODUCT_TYPES as p (p)}<option value={p}>{p}</option>{/each}
							</select>
						</label>
						<label class="block">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Colour</span>
							<select bind:value={row.color} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
								{#each COLORS as c (c)}<option value={c}>{c}</option>{/each}
							</select>
						</label>
						<label class="block">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Size</span>
							<select bind:value={row.size} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
								{#each SIZES as s (s)}<option value={s}>{s}</option>{/each}
							</select>
						</label>
						<label class="block sm:col-span-2">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Design</span>
							<select bind:value={row.designId} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
								<option value="">— Plain / no print —</option>
								{#each data.designs as d (d.id)}<option value={String(d.id)}>{d.name}</option>{/each}
							</select>
						</label>
					</div>
					<div class="mt-2 flex items-end gap-2">
						<label class="block w-20">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Qty</span>
							<input type="number" min="1" bind:value={row.quantity} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
						</label>
						<label class="block w-32">
							<span class="mb-1 block text-[11px] font-medium text-slate-500">Price each</span>
							<input type="number" min="0" step="1" bind:value={row.unitPrice} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
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
				<input type="number" min="0" bind:value={shippingFee} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Discount</span>
				<input type="number" min="0" bind:value={discount} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Paid?</span>
				<select bind:value={paymentStatus} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
					<option value="unpaid">Not yet</option>
					<option value="paid">Paid</option>
				</select>
			</label>
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-600">Method</span>
				<select bind:value={paymentMethod} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
					<option value="cash_on_delivery">Cash on delivery</option>
					<option value="bank_transfer">Bank transfer</option>
					<option value="cash">Cash</option>
				</select>
			</label>
		</div>

		<label class="mt-3 block">
			<span class="mb-1 block text-xs font-medium text-slate-600">Notes</span>
			<textarea bind:value={notes} rows="2" placeholder="Anything they asked for…" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></textarea>
		</label>

		<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
			<span class="text-sm text-slate-600">Total</span>
			<span class="tabular text-lg font-semibold text-slate-900">{money(total)}</span>
		</div>
	</section>

	<div class="flex gap-2">
		<button disabled={saving} class="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
			{saving ? 'Saving…' : 'Save order'}
		</button>
		<a href="{base}/orders" class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">Cancel</a>
	</div>
</form>
