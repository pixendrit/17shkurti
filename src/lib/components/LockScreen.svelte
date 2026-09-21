<script lang="ts">
	import Package from '@lucide/svelte/icons/package';
	import { checkPin, hasPin, setPin } from '$lib/client/auth';

	let { onunlock }: { onunlock: () => void } = $props();

	const firstRun = !hasPin();
	let pin = $state('');
	let confirmPin = $state('');
	let error = $state('');
	let stage = $state<'enter' | 'confirm'>('enter');

	async function submit(e: Event) {
		e.preventDefault();
		error = '';

		if (!firstRun) {
			if (await checkPin(pin)) return onunlock();
			error = 'Wrong code.';
			pin = '';
			return;
		}

		if (stage === 'enter') {
			if (!/^\d{4}$/.test(pin)) return (error = 'Pick 4 digits.');
			stage = 'confirm';
			return;
		}

		if (confirmPin !== pin) {
			error = "Codes don't match.";
			confirmPin = '';
			return;
		}
		await setPin(pin);
		onunlock();
	}

	function digits(v: string) {
		return v.replace(/\D/g, '').slice(0, 4);
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-900 px-4">
	<div class="w-full max-w-xs text-center">
		<div class="mb-8 flex flex-col items-center gap-3">
			<div class="grid size-12 place-items-center rounded-2xl bg-white/10">
				<Package class="size-6 text-white" />
			</div>
			<div>
				<h1 class="text-lg font-semibold text-white">Hijeshi Shqiptare</h1>
				<p class="text-sm text-slate-400">
					{#if firstRun}
						{stage === 'enter' ? 'Choose a 4-digit code' : 'Enter it again'}
					{:else}
						Enter your code
					{/if}
				</p>
			</div>
		</div>

		<form onsubmit={submit}>
			{#if firstRun && stage === 'confirm'}
				<input
					inputmode="numeric"
					autocomplete="off"
					maxlength="4"
					aria-label="Confirm code"
					value={confirmPin}
					oninput={(e) => (confirmPin = digits(e.currentTarget.value))}
					class="w-full rounded-xl border border-white/10 bg-white/5 py-4 text-center text-3xl tracking-[0.6em] text-white focus:border-white/30 focus:outline-none"
					placeholder="••••"
				/>
			{:else}
				<input
					inputmode="numeric"
					autocomplete="off"
					maxlength="4"
					aria-label="4-digit code"
					value={pin}
					oninput={(e) => (pin = digits(e.currentTarget.value))}
					class="w-full rounded-xl border border-white/10 bg-white/5 py-4 text-center text-3xl tracking-[0.6em] text-white focus:border-white/30 focus:outline-none"
					placeholder="••••"
				/>
			{/if}

			{#if error}<p class="mt-3 text-sm text-red-400">{error}</p>{/if}

			<button class="mt-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200">
				{firstRun ? (stage === 'enter' ? 'Continue' : 'Save code') : 'Unlock'}
			</button>
		</form>

		{#if firstRun}
			<p class="mt-6 text-xs leading-relaxed text-slate-500">
				Your orders are stored in this browser only — they are never uploaded.
				Use Backup in the menu to save a copy.
			</p>
		{/if}
	</div>
</div>
