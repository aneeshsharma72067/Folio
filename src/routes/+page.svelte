<script lang="ts">
	import { onMount } from 'svelte';
	import { app, persistProgress, notesQuery, highlightsQuery, flashcardsQuery } from '$lib/state.svelte';
	import { search } from '$lib/search.svelte';
	import { isDue } from '$lib/sm2';
	import PdfViewer from '$lib/components/PdfViewer.svelte';
	import DetailsPanel from '$lib/components/DetailsPanel.svelte';
	import Library from '$lib/components/Library.svelte';
	import ReviewMode from '$lib/components/ReviewMode.svelte';
	import type { NoteRecord, HighlightRecord, FlashcardRecord } from '$lib/types';

	let view = $state<'library' | 'reader'>('library');
	let reviewing = $state(false);
	let viewer = $state<PdfViewer | null>(null);

	// Mobile bottom-sheet (panel) state — local to reader, no PDF render-path impact.
	let sheetOpen = $state(false);
	let sheetEl = $state<HTMLElement | null>(null);
	let dragging = false;
	let dragStartY = 0;
	let dragY = $state(0);

	function onHandleDown(e: PointerEvent) {
		dragging = true;
		dragStartY = e.clientY;
		dragY = 0;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function onHandleMove(e: PointerEvent) {
		if (!dragging) return;
		dragY = Math.max(0, e.clientY - dragStartY);
	}
	function onHandleUp() {
		if (!dragging) return;
		dragging = false;
		const h = sheetEl?.offsetHeight ?? 1;
		if (dragY > h * 0.25) sheetOpen = false;
		dragY = 0;
	}

	let notes = $state<NoteRecord[]>([]);
	let highlights = $state<HighlightRecord[]>([]);
	let flashcards = $state<FlashcardRecord[]>([]);

	let now = $state(Date.now());
	const dueCount = $derived(flashcards.filter((c) => isDue(c, now)).length);

	// Re-subscribe live queries whenever the open document changes.
	$effect(() => {
		const id = app.doc?.id;
		if (!id) {
			notes = [];
			highlights = [];
			flashcards = [];
			return;
		}
		const s1 = notesQuery(id).subscribe((v) => (notes = v));
		const s2 = highlightsQuery(id).subscribe((v) => (highlights = v));
		const s3 = flashcardsQuery(id).subscribe((v) => (flashcards = v));
		return () => {
			s1.unsubscribe();
			s2.unsubscribe();
			s3.unsubscribe();
		};
	});

	function backToLibrary() {
		persistProgress();
		search.reset();
		app.reset();
		view = 'library';
	}

	function goto(page: number) {
		viewer?.goTo(page);
	}

	onMount(() => {
		const tick = setInterval(() => (now = Date.now()), 30_000);
		const persist = setInterval(() => view === 'reader' && persistProgress(), 15_000);
		const onLeave = () => persistProgress();
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'f' && view === 'reader') {
				e.preventDefault();
				search.open = true;
			}
		};
		window.addEventListener('beforeunload', onLeave);
		window.addEventListener('keydown', onKey);
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) persistProgress();
		});
		return () => {
			clearInterval(tick);
			clearInterval(persist);
			window.removeEventListener('beforeunload', onLeave);
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

<svelte:head>
	<title>Folio</title>
	<meta name="description" content="Folio — a fast, offline-first PDF reader for papers and books." />
</svelte:head>

{#if view === 'library'}
	<Library onopen={() => (view = 'reader')} />
{:else}
	<div class="shell">
		<header class="toolbar">
			<div class="left">
				<button class="icon" onclick={backToLibrary} aria-label="Library" title="Back to library">
					<span class="material-symbols-outlined">grid_view</span>
				</button>
				<div class="zoom">
					<button class="zbtn" onclick={() => (app.zoom = Math.max(0.5, app.zoom - 0.1))} aria-label="Zoom out">
						<span class="material-symbols-outlined">remove</span>
					</button>
					<span class="zlevel">{Math.round(app.zoom * 100)}%</span>
					<button class="zbtn" onclick={() => (app.zoom = Math.min(3, app.zoom + 0.1))} aria-label="Zoom in">
						<span class="material-symbols-outlined">add</span>
					</button>
				</div>
			</div>

			<div class="center">
				<h1>{app.doc?.name ?? 'Untitled'}</h1>
				<span class="sub">Page {app.currentPage} of {app.totalPages || '…'}</span>
			</div>

			<div class="right">
				<button
					class="icon"
					class:active={search.open}
					onclick={() => (search.open = !search.open)}
					aria-label="Search document"
					title="Search (⌘F)"
				>
					<span class="material-symbols-outlined">search</span>
				</button>
				<button class="icon" onclick={() => goto(app.currentPage)} aria-label="Recenter" title="Recenter page">
					<span class="material-symbols-outlined">filter_center_focus</span>
				</button>
				<button
					class="icon panel-toggle"
					class:active={sheetOpen}
					onclick={() => (sheetOpen = !sheetOpen)}
					aria-label="Notes panel"
					title="Notes &amp; highlights"
				>
					<span class="material-symbols-outlined">edit_note</span>
				</button>
			</div>
		</header>

		<main class="work">
			<section class="pdf-col">
				{#if app.pdfData}
					<PdfViewer bind:this={viewer} {highlights} />
				{/if}
			</section>
			<div class="divider"></div>
			<div
				class="sheet-backdrop"
				class:show={sheetOpen}
				onclick={() => (sheetOpen = false)}
				role="presentation"
			></div>
			<aside
				class="panel-col"
				class:open={sheetOpen}
				bind:this={sheetEl}
				style={dragY ? `transform:translateY(${dragY}px);transition:none;` : ''}
			>
				<button
					class="sheet-handle"
					aria-label="Drag to close panel"
					onpointerdown={onHandleDown}
					onpointermove={onHandleMove}
					onpointerup={onHandleUp}
					onpointercancel={onHandleUp}
				>
					<span class="grabber"></span>
				</button>
				<DetailsPanel
					{notes}
					{highlights}
					{flashcards}
					{dueCount}
					onreview={() => (reviewing = true)}
					ongoto={goto}
				/>
			</aside>
		</main>
	</div>
{/if}

{#if reviewing}
	<ReviewMode cards={flashcards} onclose={() => (reviewing = false)} />
{/if}

<style>
	.shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
	}
	.toolbar {
		height: calc(52px + env(safe-area-inset-top));
		padding-top: env(safe-area-inset-top);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-left: calc(16px + env(safe-area-inset-left));
		padding-right: calc(16px + env(safe-area-inset-right));
		background: rgba(10, 10, 10, 0.8);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		z-index: 30;
	}
	/* Panel toggle: mobile-only (sheet trigger). */
	.panel-toggle {
		display: none;
	}
	.sheet-handle {
		display: none;
	}
	.sheet-backdrop {
		display: none;
	}
	.left,
	.right {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
	}
	.right {
		justify-content: flex-end;
	}
	.center {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
		padding: 0 12px;
	}
	.center h1 {
		font-size: 14px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.88);
		margin: 0;
		max-width: 40vw;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.center .sub {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.35);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin-top: 1px;
	}
	.icon {
		width: 34px;
		height: 34px;
		border-radius: 9px;
		border: none;
		background: transparent;
		color: rgba(255, 255, 255, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.icon:hover {
		background: rgba(255, 255, 255, 0.08);
	}
	.icon.active {
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
	}
	.icon .material-symbols-outlined {
		font-size: 20px;
		font-variation-settings: 'wght' 300;
	}
	.zoom {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #1a1a1c;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 999px;
		padding: 3px 8px;
	}
	.zbtn {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		display: flex;
		padding: 2px;
		border-radius: 50%;
		transition: color 0.15s ease;
	}
	.zbtn:hover {
		color: #fff;
	}
	.zbtn .material-symbols-outlined {
		font-size: 16px;
	}
	.zlevel {
		font-family: ui-monospace, monospace;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.8);
		width: 38px;
		text-align: center;
	}
	.work {
		flex: 1;
		display: flex;
		overflow: hidden;
		min-height: 0;
	}
	.pdf-col {
		width: 56%;
		height: 100%;
		min-width: 0;
	}
	.divider {
		width: 1px;
		background: rgba(255, 255, 255, 0.06);
	}
	.panel-col {
		width: 44%;
		height: 100%;
		min-width: 0;
	}

	@media (max-width: 880px) {
		/* PDF goes full-screen; panel becomes a bottom sheet. */
		.work {
			flex-direction: column;
			position: relative;
		}
		.pdf-col {
			width: 100%;
			height: 100%;
		}
		.divider {
			display: none;
		}
		/* Toolbar: zones shrink to content, center flexes into the gap, title ellipsizes. */
		.left,
		.right {
			flex: 0 0 auto;
			gap: 4px;
		}
		.center {
			flex: 1 1 auto;
			min-width: 0;
			align-items: flex-start;
			padding: 0 10px;
		}
		.center h1 {
			max-width: 100%;
		}
		/* Compact zoom: keep ± controls, drop the % readout to reclaim width. */
		.zlevel {
			display: none;
		}
		.zoom {
			padding: 3px 4px;
			gap: 2px;
		}
		.panel-toggle {
			display: flex;
		}

		.sheet-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.45);
			backdrop-filter: blur(2px);
			-webkit-backdrop-filter: blur(2px);
			opacity: 0;
			pointer-events: none;
			transition: opacity 0.25s ease;
			z-index: 55;
		}
		.sheet-backdrop.show {
			opacity: 1;
			pointer-events: auto;
		}

		.panel-col {
			position: fixed;
			inset: auto 0 0 0;
			width: 100%;
			height: min(82dvh, 720px);
			display: flex;
			flex-direction: column;
			transform: translateY(100%);
			transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
			z-index: 60;
			border-radius: 18px 18px 0 0;
			overflow: hidden;
			box-shadow: 0 -20px 50px -16px rgba(0, 0, 0, 0.7);
		}
		.panel-col.open {
			transform: translateY(0);
		}
		.panel-col :global(.panel) {
			flex: 1;
			min-height: 0;
			height: auto;
		}

		.sheet-handle {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
			height: 28px;
			flex-shrink: 0;
			background: #0e0e0f;
			border: none;
			border-radius: 18px 18px 0 0;
			cursor: grab;
			touch-action: none;
		}
		.sheet-handle:active {
			cursor: grabbing;
		}
		.grabber {
			width: 38px;
			height: 4px;
			border-radius: 999px;
			background: rgba(255, 255, 255, 0.22);
		}
	}

	/* Touch devices: bump tap targets to ≥44px (Apple HIG). */
	@media (pointer: coarse) {
		.icon {
			width: 44px;
			height: 44px;
		}
		.zoom {
			padding: 6px 10px;
		}
		.zbtn {
			padding: 6px;
		}
	}
</style>
