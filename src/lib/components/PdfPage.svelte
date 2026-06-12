<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { TextLayer } from 'pdfjs-dist';
	import { releaseCanvas } from '../pdf';
	import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
	import type { HighlightRecord } from '../types';

	interface Props {
		doc: PDFDocumentProxy;
		pageNumber: number;
		scale: number;
		width: number; // CSS px target width of the page column
		visible: boolean;
		highlights: HighlightRecord[];
		onsize?: (pageNumber: number, height: number) => void;
	}

	let { doc, pageNumber, scale, width, visible, highlights, onsize }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let textEl = $state<HTMLDivElement | null>(null);
	let page: PDFPageProxy | null = null;
	let rendered = false;
	let renderToken = 0;
	let aspect = $state(1.4142); // A4 fallback until measured
	let cssHeight = $derived(width * aspect);

	const pageHighlights = $derived(highlights.filter((h) => h.page === pageNumber));

	async function render() {
		if (!visible || rendered || !canvas) return;
		const token = ++renderToken;
		if (!page) page = await doc.getPage(pageNumber);
		if (token !== renderToken) return;

		const base = page.getViewport({ scale: 1 });
		aspect = base.height / base.width;
		onsize?.(pageNumber, width * aspect);

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const cssScale = (width / base.width) * scale;
		const viewport = page.getViewport({ scale: cssScale * dpr });

		canvas.width = viewport.width;
		canvas.height = viewport.height;
		canvas.style.width = '100%';
		canvas.style.height = '100%';

		const ctx = canvas.getContext('2d', { alpha: false });
		if (!ctx) return;
		await page.render({ canvas, canvasContext: ctx, viewport, background: '#ffffff' }).promise;
		if (token !== renderToken) return;

		// Text layer for selection — scaled to CSS pixels, not device pixels.
		if (textEl) {
			textEl.replaceChildren();
			const tvp = page.getViewport({ scale: cssScale });
			const tl = new TextLayer({
				textContentSource: await page.getTextContent(),
				container: textEl,
				viewport: tvp
			});
			await tl.render();
		}
		rendered = true;
	}

	function teardown() {
		renderToken++;
		releaseCanvas(canvas);
		textEl?.replaceChildren();
		page?.cleanup();
		rendered = false;
	}

	// Render when visible; release when scrolled out of buffer (memory lifecycle).
	$effect(() => {
		if (visible) {
			tick().then(render);
		} else if (rendered) {
			teardown();
		}
	});

	// Re-render on zoom change while visible.
	$effect(() => {
		scale;
		width;
		if (visible && rendered) {
			rendered = false;
			tick().then(render);
		}
	});

	onDestroy(() => {
		teardown();
		page = null;
	});
</script>

<div
	class="pdf-page"
	data-page={pageNumber}
	style="width:{width}px;height:{cssHeight}px;"
>
	{#if visible}
		<canvas bind:this={canvas} class="pdf-canvas"></canvas>
		<div bind:this={textEl} class="text-layer"></div>
		<div class="hl-layer">
			{#each pageHighlights as h (h.id)}
				{#each h.rects as r}
					<div
						class="hl-rect"
						style="left:{r.x * 100}%;top:{r.y * 100}%;width:{r.w * 100}%;height:{r.h *
							100}%;background:{h.color};"
					></div>
				{/each}
			{/each}
		</div>
	{:else}
		<div class="pdf-placeholder">
			<span class="ph-num">{pageNumber}</span>
		</div>
	{/if}
</div>

<style>
	.pdf-page {
		position: relative;
		margin: 0 auto 20px;
		border-radius: 6px;
		overflow: hidden;
		background: #fff;
		box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.6);
		contain: layout paint;
	}
	.pdf-canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.pdf-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #14141600;
		background-color: #161618;
	}
	.ph-num {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.18);
		font-family: ui-monospace, monospace;
	}
	.text-layer {
		position: absolute;
		inset: 0;
		overflow: hidden;
		line-height: 1;
		opacity: 1;
		z-index: 2;
		color: transparent;
	}
	:global(.text-layer span) {
		position: absolute;
		white-space: pre;
		cursor: text;
		transform-origin: 0 0;
		color: transparent;
	}
	:global(.text-layer ::selection) {
		background: rgba(120, 170, 255, 0.4);
	}
	:global(.text-layer br::selection) {
		background: transparent;
	}
	.hl-layer {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
	}
	.hl-rect {
		position: absolute;
		border-radius: 2px;
		mix-blend-mode: normal;
	}
</style>
