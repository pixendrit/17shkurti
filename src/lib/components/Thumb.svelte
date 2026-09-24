<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import { imageUrl } from '$lib/ui';

	let { id, size = 'size-12', alt = '' }: { id: string | null | undefined; size?: string; alt?: string } = $props();
</script>

<div class="{size} shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
	{#if id}
		<img src={imageUrl(id)} {alt} loading="lazy" class="size-full object-cover" />
	{:else}
		<div class="grid size-full place-items-center text-slate-300"><ImageIcon class="size-1/2" /></div>
	{/if}
</div>
