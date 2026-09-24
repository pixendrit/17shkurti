<script lang="ts">
	import { enhance } from '$app/forms';
	import Empty from '$lib/components/Empty.svelte';
	import FormError from '$lib/components/FormError.svelte';
	import Thumb from '$lib/components/Thumb.svelte';
	import { busy } from '$lib/client/enhance';
	import { shrink } from '$lib/client/shrink';
	import { COLORS } from '$lib/domain/model';
	import { field, label, primary, secondary, COLOR_LABELS } from '$lib/ui';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Upload from '@lucide/svelte/icons/upload';

	let { data } = $props();
	let showAdd = $state(false);
	let editing = $state<string | null>(null);
</script>

<svelte:head><title>Dizajnet — Hijeshi</title></svelte:head>

<div class="mb-5 flex items-center justify-between">
	<h1 class="text-xl font-semibold text-slate-900">Dizajnet</h1>
	<button onclick={() => (showAdd = !showAdd)} class={primary}><Plus class="size-4" /> Dizajn i ri</button>
</div>

<FormError />

{#if showAdd}
	<form method="POST" action="?/create" use:enhance={busy({ after: () => (showAdd = false) })} class="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="grid gap-3 sm:grid-cols-3">
			<label class="block"><span class={label}>Emri *</span><input name="name" required placeholder="p.sh. Shqiponja" class={field} /></label>
			<label class="block sm:col-span-2"><span class={label}>Shënime</span><input name="notes" placeholder="Madhësia e printit, ku ndodhet skedari…" class={field} /></label>
			<fieldset>
				<legend class={label}>Printohet në bluza</legend>
				<div class="flex gap-4 pt-1.5">
					{#each COLORS as c (c)}<label class="flex items-center gap-1.5 text-sm"><input type="checkbox" name="color" value={c} checked class="size-4 rounded border-slate-300" /> {COLOR_LABELS[c]}</label>{/each}
				</div>
			</fieldset>
			<label class="block"><span class={label}>Sa bluza (para + pas) në një fletë</span><input name="perSheet" value="4" inputmode="numeric" class={field} /></label>
		</div>
		<p class="mt-2 text-xs text-slate-500">Çdo ngjyrë bluze ka printin e vet (dizajni ndryshon mbi të zezë e të bardhë). Fotot i shtoni pasi ta ruani.</p>
		<button class="{primary} mt-3">Ruaj dizajnin</button>
	</form>
{/if}

{#if data.designs.length === 0}
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm"><Empty message="Ende pa dizajne" hint="Shtoni çdo dizajn që printoni." /></section>
{:else}
	<div class="grid gap-3 lg:grid-cols-2">
		{#each data.designs as d (d.id)}
			<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm {d.archived ? 'opacity-60' : ''}">
				{#if editing === d.id}
					<form method="POST" action="?/edit" use:enhance={busy({ reset: false, after: () => (editing = null) })} class="space-y-2">
						<input type="hidden" name="designId" value={d.id} />
						<input type="hidden" name="archived" value={d.archived ? '1' : '0'} />
						<input name="name" value={d.name} required class={field} />
						<input name="notes" value={d.notes} placeholder="Shënime" class={field} />
						<div class="flex gap-2">
							<button class={primary}>Ruaj</button>
							<button type="button" onclick={() => (editing = null)} class={secondary}>Anulo</button>
						</div>
					</form>
					{#if d.sold === 0}
						<form method="POST" action="?/delete" use:enhance={busy({ confirm: `Ta fshij „${d.name}”?` })} class="mt-2">
							<input type="hidden" name="designId" value={d.id} />
							<button class="text-xs font-medium text-red-600 hover:underline">Fshi dizajnin</button>
						</form>
					{/if}
				{:else}
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="truncate font-semibold text-slate-900">{d.name}</p>
							{#if d.notes}<p class="truncate text-sm text-slate-500">{d.notes}</p>{/if}
							<p class="text-xs text-slate-500"><span class="tabular font-semibold text-slate-900">{d.sold}</span> të shitura</p>
						</div>
						<div class="flex shrink-0 gap-1">
							<button onclick={() => (editing = d.id)} aria-label="Ndrysho" class="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"><Pencil class="size-3.5" /></button>
							<form method="POST" action="?/edit" use:enhance={busy()}>
								<input type="hidden" name="designId" value={d.id} />
								<input type="hidden" name="name" value={d.name} />
								<input type="hidden" name="notes" value={d.notes} />
								<input type="hidden" name="archived" value={d.archived ? '0' : '1'} />
								<button class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">{d.archived ? 'Riktheje' : 'Arkivo'}</button>
							</form>
						</div>
					</div>
				{/if}

				<div class="mt-3 space-y-3">
					{#each d.prints as p (p.id)}
						<div class="rounded-lg border border-slate-200 p-3">
							<div class="mb-2 flex items-center justify-between gap-2 text-sm">
								<span class="font-medium text-slate-900">Mbi bluzë {COLOR_LABELS[p.shirtColor].toLowerCase()}</span>
								<span class="text-xs text-slate-500"><span class="tabular font-semibold text-slate-900">{p.have}</span> në stok · {p.sold} të shitura</span>
							</div>
							<div class="grid grid-cols-2 gap-3">
								{#each [['front', 'para'], ['back', 'pas']] as const as [side, text] (side)}
									<form method="POST" action="?/image" enctype="multipart/form-data" use:enhance={busy()}>
										<input type="hidden" name="printId" value={p.id} />
										<input type="hidden" name="side" value={side} />
										<Thumb id={p[side]} size="aspect-square w-full" alt="{d.name} — {text}" />
										<label class="mt-1.5 flex cursor-pointer items-center justify-center gap-1 rounded-md border border-slate-300 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
											<Upload class="size-3" /> {p[side] ? `Ndrysho ${text}` : `Foto ${text}`}
											<input type="file" name="image" accept="image/*" class="sr-only" use:shrink={(url, input) => url && input.form?.requestSubmit()} />
										</label>
									</form>
								{/each}
							</div>
							<form method="POST" action="?/perSheet" use:enhance={busy({ reset: false })} class="mt-2 flex items-center gap-2 text-xs text-slate-600">
								<input type="hidden" name="printId" value={p.id} />
								<span>Në një fletë DTF:</span>
								<input name="perSheet" value={p.perSheet} inputmode="numeric" class="w-14 rounded border border-slate-300 px-2 py-1 text-center text-sm" />
								<span>bluza</span>
								<button class="ml-auto rounded border border-slate-300 px-2 py-1 font-medium hover:bg-slate-50">Ruaj</button>
							</form>
						</div>
					{/each}
					{#each COLORS.filter((c) => !d.prints.some((p) => p.shirtColor === c)) as c (c)}
						<form method="POST" action="?/addPrint" use:enhance={busy()}>
							<input type="hidden" name="designId" value={d.id} />
							<input type="hidden" name="color" value={c} />
							<input type="hidden" name="perSheet" value={d.prints[0]?.perSheet ?? 4} />
							<button class="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">+ Printo edhe mbi bluzë {COLOR_LABELS[c].toLowerCase()}</button>
						</form>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}
