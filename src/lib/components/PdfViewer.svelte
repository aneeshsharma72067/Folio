<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { loadDocument, extractOutline, type PDFDocumentProxy } from '../pdf';
	import { app, addHighlight } from '../state.svelte';
	import { search } from '../search.svelte';
	import PdfPage from './PdfPage.svelte';
	import SearchPanel from './SearchPanel.svelte';
	import type { HighlightRecord, HighlightRect } from '../types';

	interface Props {
		highlights: HighlightRecord[];
	}
	let { highlights }: Props = $props();

	let doc = $state<PDFDocumentProxy | null>(null);
	let scrollEl = $state<HTMLDivElement | null>(null);
	let colWidth = $state(680);
	let visiblePages = $state<Set<number>>(new Set([1]));
	let heights = new Map<number, number>(); // measured page heights
	let estHeight = $state(900);
	let selectionBtn = $state<{ x: number; y: number } | null>(null);
	let pendingSel: { page: number; text: string; rects: HighlightRect[] } | null = null;

	let rafScroll = 0;

	async function init() {
		if (!app.pdfData) return;
		doc = await loadDocument(app.pdfData);
		app.totalPages = doc.numPages;
		extractOutline(doc).then((o: typeof app.outline) => (app.outline = o));
		// jump to restored page after layout settles
		requestAnimationFrame(() => requestAnimationFrame(() => goTo(app.currentPage, 'auto')));
		recompute();
	}

	function onScroll() {
		if (rafScroll) return;
		rafScroll = requestAnimationFrame(() => {
			rafScroll = 0;
			recompute();
		});
	}

	// Determine which pages intersect the viewport (+1 ahead buffer).
	function recompute() {
		if (!scrollEl || !doc) return;
		const top = scrollEl.scrollTop;
		const vh = scrollEl.clientHeight;
		const next = new Set<number>();
		let y = 0;
		let current = app.currentPage;
		let bestOverlap = -1;

		for (let p = 1; p <= doc.numPages; p++) {
			const h = (heights.get(p) ?? estHeight) + 20;
			const pTop = y;
			const pBottom = y + h;
			// visible window with one-page lookahead
			if (pBottom > top - 200 && pTop < top + vh + h) next.add(p);
			// page occupying most of viewport center = current
			const overlap = Math.min(pBottom, top + vh) - Math.max(pTop, top);
			if (overlap > bestOverlap) {
				bestOverlap = overlap;
				current = p;
			}
			y += h;
		}
		visiblePages = next;
		if (current !== app.currentPage) app.currentPage = current;
	}

	function onSize(page: number, h: number) {
		const prev = heights.get(page);
		if (prev !== h) {
			heights.set(page, h);
			if (page <= 3) estHeight = h; // refine estimate from early pages
			recompute();
		}
	}

	export function goTo(page: number, behavior: ScrollBehavior = 'smooth') {
		if (!scrollEl || !doc) return;
		const target = Math.min(Math.max(1, page), doc.numPages);
		let y = 0;
		for (let p = 1; p < target; p++) y += (heights.get(p) ?? estHeight) + 20;
		scrollEl.scrollTo({ top: y, behavior });
	}

	// ── Text selection → floating highlight button ─────────────────────────────
	function onMouseUp() {
		const sel = window.getSelection();
		if (!sel || sel.isCollapsed || !sel.toString().trim() || !scrollEl) {
			selectionBtn = null;
			return;
		}
		const range = sel.getRangeAt(0);
		const pageEl = (range.startContainer.parentElement || range.startContainer)
			? findPageEl(range.commonAncestorContainer)
			: null;
		if (!pageEl) {
			selectionBtn = null;
			return;
		}
		const page = Number(pageEl.dataset.page);
		const pageBox = pageEl.getBoundingClientRect();
		const rects: HighlightRect[] = [];
		for (const r of range.getClientRects()) {
			if (r.width < 1 || r.height < 1) continue;
			rects.push({
				x: (r.left - pageBox.left) / pageBox.width,
				y: (r.top - pageBox.top) / pageBox.height,
				w: r.width / pageBox.width,
				h: r.height / pageBox.height
			});
		}
		if (!rects.length) return;
		pendingSel = { page, text: sel.toString().trim(), rects };
		const last = range.getClientRects();
		const r = last[last.length - 1];
		const wrap = scrollEl.getBoundingClientRect();
		selectionBtn = { x: r.right - wrap.left, y: r.bottom - wrap.top + scrollEl.scrollTop };
	}

	function findPageEl(node: Node): HTMLElement | null {
		let el: HTMLElement | null =
			node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
		while (el && !el.dataset.page) el = el.parentElement;
		return el;
	}

	async function commitHighlight() {
		if (!pendingSel || !app.doc) return;
		await addHighlight(app.doc.id, pendingSel.page, pendingSel.text, pendingSel.rects);
		window.getSelection()?.removeAllRanges();
		selectionBtn = null;
		pendingSel = null;
	}

	function onKey(e: KeyboardEvent) {
		if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
		if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'j')
			goTo(app.currentPage + 1);
		else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'k')
			goTo(app.currentPage - 1);
		else if (e.key === '+' || e.key === '=') app.zoom = Math.min(3, app.zoom + 0.1);
		else if (e.key === '-') app.zoom = Math.max(0.5, app.zoom - 0.1);
		else if (e.key === '0') app.zoom = 1;
		else return;
		e.preventDefault();
	}

	function measureWidth() {
		if (!scrollEl) return;
		const avail = scrollEl.clientWidth - 48;
		colWidth = Math.min(820, Math.max(280, avail)) * app.zoom;
	}

	$effect(() => {
		app.zoom;
		measureWidth();
	});

	// Build the search index lazily the first time the search panel is opened.
	$effect(() => {
		if (search.open && doc && !search.ready && !search.building) {
			search.build(doc);
		}
	});

	onMount(() => {
		init();
		window.addEventListener('keydown', onKey);
		const ro = new ResizeObserver(() => {
			measureWidth();
			recompute();
		});
		if (scrollEl) ro.observe(scrollEl);
		return () => {
			window.removeEventListener('keydown', onKey);
			ro.disconnect();
		};
	});

	onDestroy(() => {
		// destroy() exists at runtime; types mark it private in pdfjs v6.
		(doc as unknown as { destroy?: () => void })?.destroy?.();
	});
</script>

<div
	class="viewer"
	bind:this={scrollEl}
	onscroll={onScroll}
	onmouseup={onMouseUp}
	role="document"
>
	{#if doc}
		{#each { length: doc.numPages } as _, i (i)}
			<PdfPage
				{doc}
				pageNumber={i + 1}
				scale={app.zoom}
				width={colWidth}
				visible={visiblePages.has(i + 1)}
				{highlights}
				onsize={onSize}
			/>
		{/each}
	{/if}

	<SearchPanel ongoto={(p) => goTo(p)} />

	{#if selectionBtn}
		<button
			class="hl-btn"
			style="left:{selectionBtn.x}px;top:{selectionBtn.y}px;"
			onmousedown={(e) => e.preventDefault()}
			onclick={commitHighlight}
		>
			<span class="material-symbols-outlined">ink_highlighter</span>
			Highlight
		</button>
	{/if}
</div>

<style>
	.viewer {
		width: 100%;
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 24px 24px calc(80px + env(safe-area-inset-bottom));
		position: relative;
		scroll-behavior: smooth;
		background:
			radial-gradient(120% 80% at 50% 0%, #131315 0%, #0f0f10 60%, #0d0d0e 100%);
	}
	.hl-btn {
		position: absolute;
		transform: translate(8px, 6px);
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 6px;
		background: #fff;
		color: #000;
		font-size: 12px;
		font-weight: 500;
		padding: 6px 12px;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.8);
		animation: pop 0.15s ease;
	}
	.hl-btn .material-symbols-outlined {
		font-size: 16px;
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translate(8px, 10px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translate(8px, 6px) scale(1);
		}
	}
</style>
