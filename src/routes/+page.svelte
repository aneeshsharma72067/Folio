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
			</div>
		</header>

		<main class="work">
			<section class="pdf-col">
				{#if app.pdfData}
					<PdfViewer bind:this={viewer} {highlights} />
				{/if}
			</section>
			<div class="divider"></div>
			<aside class="panel-col">
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
		height: 52px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		background: rgba(10, 10, 10, 0.8);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		z-index: 30;
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
		.work {
			flex-direction: column;
		}
		.pdf-col {
			width: 100%;
			height: 55%;
		}
		.divider {
			width: 100%;
			height: 1px;
		}
		.panel-col {
			width: 100%;
			height: 45%;
		}
		.center h1 {
			max-width: 50vw;
		}
	}
</style>
