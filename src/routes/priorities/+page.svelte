<script lang="ts">
	import { enhance } from '$app/forms';
	import FormError from '$lib/components/FormError.svelte';
	import PriorityCard from '$lib/components/PriorityCard.svelte';
	import { busy } from '$lib/client/enhance';
	import { addDays, weekLabel } from '$lib/domain/time';
	import { field, label, primary } from '$lib/ui';
	import Plus from '@lucide/svelte/icons/plus';
	import Target from '@lucide/svelte/icons/target';

	let { data } = $props();
	let adding = $state<string | null>(null);
	let kind = $state<'goal' | 'daily'>('goal');
	let showPast = $state(false);

	const summary = (items: { status: string }[]) => {
		const done = items.filter((i) => i.status === 'done').length;
		return items.length ? `${done}/${items.length} të kryera` : '';
	};
</script>

<svelte:head><title>Prioritetet — Hijeshi</title></svelte:head>

<h1 class="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900"><Target class="size-5 text-slate-500" /> Prioritetet</h1>
<p class="mb-5 max-w-prose text-sm text-slate-600">Çfarë duhet kryer këtë javë. Qëllimet kanë përqindje dhe afat; ato „çdo ditë” kanë një kuti për çdo ditë, që e shënon kur e ke bërë.</p>

<FormError />

{#snippet week(title: string, w: typeof data.thisWeek, canCarry: boolean)}
	<section class="mb-6">
		<div class="mb-2 flex items-baseline justify-between gap-3">
			<h2 class="text-sm font-semibold text-slate-900">{title} <span class="font-normal text-slate-500">· {weekLabel(w.monday)}</span></h2>
			<span class="text-xs text-slate-500">{summary(w.items)}</span>
		</div>
		<div class="grid gap-3 md:grid-cols-2">
			{#each w.items as p (p.id)}
				<PriorityCard {p} {canCarry} />
			{/each}
			{#if w.monday < data.thisWeek.monday}
				<!-- a past week: nothing more to add -->
			{:else if adding === w.monday}
				<form method="POST" action="?/create" use:enhance={busy({ after: () => (adding = null) })} class="space-y-3 rounded-xl border border-slate-900 bg-white p-4 shadow-sm">
					<input type="hidden" name="week" value={w.monday} />
					<input type="hidden" name="kind" value={kind} />
					<div class="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
						<button type="button" onclick={() => (kind = 'goal')} class="rounded-md py-1.5 {kind === 'goal' ? 'bg-white shadow-sm' : 'text-slate-600'}">Qëllim</button>
						<button type="button" onclick={() => (kind = 'daily')} class="rounded-md py-1.5 {kind === 'daily' ? 'bg-white shadow-sm' : 'text-slate-600'}">Çdo ditë</button>
					</div>
					<label class="block"><span class={label}>Prioriteti</span><input name="title" required placeholder={kind === 'goal' ? 'p.sh. Website live' : 'p.sh. 1 dizajn i ri postohet'} class={field} /></label>
					{#if kind === 'goal'}
						<label class="block"><span class={label}>Afati (jo i detyrueshëm)</span><input type="date" name="due" min={w.monday} value={addDays(w.monday, 6)} class={field} /></label>
					{:else}
						<label class="block"><span class={label}>Nga cila ditë</span><input type="date" name="from" min={w.monday} max={addDays(w.monday, 6)} value={w.monday < data.today ? data.today : w.monday} class={field} /></label>
					{/if}
					<label class="block"><span class={label}>Shënim</span><input name="note" class={field} /></label>
					<div class="flex gap-2">
						<button class="{primary} flex-1">Shto</button>
						<button type="button" onclick={() => (adding = null)} class="rounded-lg border border-slate-300 px-3 text-sm">Anulo</button>
					</div>
				</form>
			{:else}
				<button onclick={() => ((adding = w.monday), (kind = 'goal'))} class="flex min-h-24 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-slate-400 hover:bg-white">
					<Plus class="size-4" /> Shto prioritet
				</button>
			{/if}
		</div>
	</section>
{/snippet}

{@render week('Këtë javë', data.thisWeek, true)}
{@render week('Java tjetër', data.nextWeek, false)}
{#each data.later as w (w.monday)}{@render week('Më vonë', w, false)}{/each}

{#if data.past.length}
	<button onclick={() => (showPast = !showPast)} class="mb-3 text-sm font-medium text-slate-600 underline">{showPast ? 'Fshih' : 'Shfaq'} javët e kaluara ({data.past.length})</button>
	{#if showPast}
		{#each data.past as w (w.monday)}{@render week('Java', w, true)}{/each}
	{/if}
{/if}
