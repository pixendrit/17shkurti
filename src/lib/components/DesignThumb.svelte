<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import { imageUrl, type ImageVersions } from '$lib/data/images';
	import type { ImageSide } from '$lib/data/schema';

	let {
		designId,
		images,
		side = 'front',
		size = 'size-12',
		alt = ''
	}: {
		designId: number;
		images?: ImageVersions;
		side?: ImageSide;
		size?: string;
		alt?: string;
	} = $props();

	const v = $derived(images?.[side]);
</script>

<div class="{size} shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
	{#if v}
		<img src={imageUrl(designId, side, v)} {alt} loading="lazy" class="size-full object-cover" />
	{:else}
		<div class="grid size-full place-items-center text-slate-300"><ImageIcon class="size-1/2" /></div>
	{/if}
</div>
