<script lang="ts">
	import { enhance } from '$app/forms';
	import Package from '@lucide/svelte/icons/package';

	let { form } = $props();
	let pin = $state('');
	let formEl: HTMLFormElement;

	/** Auto-submit as soon as the fourth digit lands — no button hunting. */
	function onInput(e: Event) {
		const el = e.target as HTMLInputElement;
		pin = el.value.replace(/\D/g, '').slice(0, 4);
		el.value = pin;
		if (pin.length === 4) formEl.requestSubmit();
	}
</script>

<svelte:head><title>Hijeshi — Lock</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-900 px-4">
	<div class="w-full max-w-xs text-center">
		<div class="mb-8 flex flex-col items-center gap-3">
			<div class="grid size-12 place-items-center rounded-2xl bg-white/10">
				<Package class="size-6 text-white" />
			</div>
			<div>
				<h1 class="text-lg font-semibold text-white">Hijeshi Shqiptare</h1>
				<p class="text-sm text-slate-400">Enter your code</p>
			</div>
		</div>

		<form method="POST" bind:this={formEl} use:enhance>
			<input
				name="pin"
				inputmode="numeric"
				autocomplete="one-time-code"
				pattern="[0-9]*"
				maxlength="4"
				aria-label="4-digit code"
				oninput={onInput}
				value={pin}
				class="w-full rounded-xl border border-white/10 bg-white/5 py-4 text-center text-3xl
				tracking-[0.6em] text-white placeholder:text-slate-600 focus:border-white/30 focus:outline-none"
				placeholder="••••"
			/>

			{#if form?.error}
				<p class="mt-3 text-sm text-red-400">{form.error}</p>
			{/if}

			<button
				class="mt-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200"
			>
				Unlock
			</button>
		</form>
	</div>
</div>
