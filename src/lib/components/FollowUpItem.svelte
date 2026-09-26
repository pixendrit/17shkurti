<script lang="ts">
	/**
	 * One client to tell something: the message, ready to send by WhatsApp or
	 * to copy into Instagram or Messenger, and a tap to mark them told.
	 */
	import { enhance } from '$app/forms';
	import { busy } from '$lib/client/enhance';
	import { formatDateTime, FOLLOW_UP_TASKS } from '$lib/ui';
	import type { FollowUp } from '$lib/domain/model';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import MessageCircle from '@lucide/svelte/icons/message-circle';

	let {
		orderId,
		code,
		customer,
		stage,
		since,
		message,
		whatsapp,
		showOrder = true
	}: {
		orderId: string;
		code: string;
		customer: string;
		stage: FollowUp;
		since: number;
		message: string;
		whatsapp: string | null;
		showOrder?: boolean;
	} = $props();

	let copied = $state(false);
	let text: HTMLTextAreaElement | undefined = $state();
	let open = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(message);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Some browsers refuse the clipboard: show the text selected instead.
			open = true;
			queueMicrotask(() => text?.select());
		}
	}
	const tone: Record<FollowUp, string> = {
		ready: 'bg-purple-100 text-purple-800',
		shipped: 'bg-cyan-100 text-cyan-900',
		delivered: 'bg-emerald-100 text-emerald-800'
	};
</script>

<div class="px-4 py-3">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<p class="truncate text-sm font-medium text-slate-900">
				{#if showOrder}<a href="/orders/{orderId}" class="hover:underline">{customer}</a> <span class="font-mono text-xs text-slate-400">{code}</span>{:else}{FOLLOW_UP_TASKS[stage]}{/if}
			</p>
			<p class="text-xs text-slate-500">
				<span class="rounded px-1.5 py-0.5 font-medium {tone[stage]}">{FOLLOW_UP_TASKS[stage]}</span> · që nga {formatDateTime(since)}
			</p>
		</div>
		<form method="POST" action="?/notify" use:enhance={busy()}>
			<input type="hidden" name="orderId" value={orderId} />
			<input type="hidden" name="stage" value={stage} />
			<button class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
				<Check class="size-3.5" /> U njoftua
			</button>
		</form>
	</div>
	<button type="button" onclick={() => (open = !open)} class="mt-2 block w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 {open ? '' : 'line-clamp-2'}">{message}</button>
	{#if open}
		<textarea bind:this={text} readonly rows="4" class="mt-2 w-full rounded-lg border border-slate-300 p-2 text-xs" aria-label="Mesazhi">{message}</textarea>
	{/if}
	<div class="mt-2 flex flex-wrap gap-2">
		{#if whatsapp}
			<a href="https://wa.me/{whatsapp}?text={encodeURIComponent(message)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 rounded-lg bg-[#1f9d55] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#188a49]">
				<MessageCircle class="size-3.5" /> WhatsApp
			</a>
		{/if}
		<button type="button" onclick={copy} class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
			<Copy class="size-3.5" /> {copied ? 'U kopjua: ngjite në Instagram/Messenger' : 'Kopjo mesazhin'}
		</button>
	</div>
</div>
