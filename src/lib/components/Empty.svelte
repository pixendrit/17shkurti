<script lang="ts">
	let { message, hint }: { message: string; hint?: string } = $props();
</script>

<div class="py-10 text-center">
	<p class="text-sm font-medium text-slate-700">{message}</p>
	{#if hint}<p class="mt-1 text-xs text-slate-500">{hint}</p>{/if}
</div>
