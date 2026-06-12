<script lang="ts">
	import { app, addNote, deleteNote, deleteHighlight } from '../state.svelte';
	import { relTime } from '../time';
	import SessionTimer from './SessionTimer.svelte';
	import type { NoteRecord, HighlightRecord, FlashcardRecord, Tab } from '../types';

	interface Props {
		notes: NoteRecord[];
		highlights: HighlightRecord[];
		flashcards: FlashcardRecord[];
		dueCount: number;
		onreview: () => void;
		ongoto: (page: number) => void;
	}
	let { notes, highlights, flashcards, dueCount, onreview, ongoto }: Props = $props();

	let draft = $state('');
	let replyTo = $state<HighlightRecord | null>(null);

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'notes', label: 'Notes' },
		{ id: 'highlights', label: 'Highlights' },
		{ id: 'outline', label: 'Outline' }
	];

	const counts = $derived<Record<Tab, number>>({
		notes: notes.length,
		highlights: highlights.length,
		outline: app.outline.length
	});

	async function submit() {
		const body = draft.trim();
		if (!body || !app.doc) return;
		await addNote(app.doc.id, app.currentPage, body, replyTo?.id);
		draft = '';
		replyTo = null;
	}

	function startReply(h: HighlightRecord) {
		replyTo = h;
		app.activeTab = 'notes';
		document.getElementById('composer')?.focus();
	}

	function onListClick(e: MouseEvent) {
		// Event delegation (OPTIMIZATION §1.3): one handler, read data attrs.
		const el = (e.target as HTMLElement).closest('[data-page]') as HTMLElement | null;
		const action = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
		if (action) {
			e.stopPropagation();
			const id = action.dataset.id!;
			if (action.dataset.action === 'del-note') deleteNote(id);
			else if (action.dataset.action === 'del-hl') deleteHighlight(id);
			else if (action.dataset.action === 'reply') {
				const h = highlights.find((x) => x.id === id);
				if (h) startReply(h);
			}
			return;
		}
		if (el?.dataset.page) ongoto(Number(el.dataset.page));
	}
</script>

<section class="panel">
	<div class="tabs">
		{#each tabs as t}
			<button class="tab" class:active={app.activeTab === t.id} onclick={() => (app.activeTab = t.id)}>
				{t.label}
				<span class="cnt">{counts[t.id]}</span>
				{#if app.activeTab === t.id}<div class="ind"></div>{/if}
			</button>
		{/each}
	</div>

	{#key app.activeTab}
	<div class="list fade" onclick={onListClick} role="list">
		{#if app.activeTab === 'notes'}
			{#if notes.length === 0}
				<div class="empty">
					<span class="material-symbols-outlined">edit_note</span>
					<p>No notes yet. Write one below.</p>
				</div>
			{/if}
			{#each notes as n (n.id)}
				<div class="card" data-page={n.page} role="listitem">
					<div class="card-head">
						<span class="badge">Pg. {n.page}</span>
						<div class="head-right">
							<span class="time">{relTime(n.createdAt)}</span>
							<button class="mini" data-action="del-note" data-id={n.id} aria-label="Delete">
								<span class="material-symbols-outlined">close</span>
							</button>
						</div>
					</div>
					<p class="body">{n.body}</p>
				</div>
			{/each}
		{:else if app.activeTab === 'highlights'}
			{#if highlights.length === 0}
				<div class="empty">
					<span class="material-symbols-outlined">ink_highlighter</span>
					<p>Select text in the document to highlight it.</p>
				</div>
			{/if}
			{#each highlights as h (h.id)}
				<div class="card hl" data-page={h.page} role="listitem">
					<div class="card-head">
						<span class="badge">Pg. {h.page}</span>
						<div class="head-right">
							<span class="time">{relTime(h.createdAt)}</span>
							<button class="mini" data-action="reply" data-id={h.id} aria-label="Add note">
								<span class="material-symbols-outlined">add_comment</span>
							</button>
							<button class="mini" data-action="del-hl" data-id={h.id} aria-label="Delete">
								<span class="material-symbols-outlined">close</span>
							</button>
						</div>
					</div>
					<p class="body quote">{h.text}</p>
					{#if h.noteId}<span class="linked"><span class="material-symbols-outlined">link</span>Note attached</span>{/if}
				</div>
			{/each}
		{:else}
			{#if app.outline.length === 0}
				<div class="empty">
					<span class="material-symbols-outlined">toc</span>
					<p>This document has no embedded outline.</p>
				</div>
			{/if}
			{#each app.outline as item, i (i)}
				<div
					class="outline-row"
					data-page={item.page}
					role="listitem"
					style="padding-left:{12 + item.depth * 16}px"
				>
					<span class="o-title">{item.title}</span>
					<span class="o-page">{item.page}</span>
				</div>
			{/each}
		{/if}
	</div>
	{/key}

	<div class="bottom">
		<div class="composer" class:reply={replyTo}>
			{#if replyTo}
				<div class="reply-chip">
					<span class="material-symbols-outlined">format_quote</span>
					<span class="reply-text">{replyTo.text}</span>
					<button onclick={() => (replyTo = null)} aria-label="Cancel reply">
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>
			{/if}
			<textarea
				id="composer"
				bind:value={draft}
				placeholder={replyTo ? 'Write the answer for this card…' : 'Add a note…'}
				onkeydown={(e) => {
					if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
				}}
			></textarea>
			<div class="composer-foot">
				<span class="hint">Pg. {app.currentPage} · ⌘↵</span>
				<button class="primary" onclick={submit} disabled={!draft.trim()}>Save</button>
			</div>
		</div>

		<div class="cards-row">
			<div class="stat">
				<div class="stat-head">
					<span class="label">Progress</span>
					<span class="val">{app.progress}%</span>
				</div>
				<div class="bar"><div class="fill" style="width:{app.progress}%"></div></div>
				<div class="stat-foot">
					<span>Pg {app.currentPage}/{app.totalPages}</span>
					<SessionTimer />
				</div>
			</div>
			<div class="stat recall">
				<div>
					<span class="label">Active Recall</span>
					<div class="recall-num">
						{dueCount}<span class="recall-unit">due</span>
						{#if flashcards.length > dueCount}<span class="recall-total">/ {flashcards.length}</span>{/if}
					</div>
				</div>
				<button class="primary sm" onclick={onreview} disabled={flashcards.length === 0}>
					Review
				</button>
			</div>
		</div>
	</div>
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #0e0e0f;
	}
	.tabs {
		display: flex;
		gap: 22px;
		padding: 20px 22px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		flex-shrink: 0;
	}
	.tab {
		position: relative;
		background: none;
		border: none;
		padding: 0 0 12px;
		font: inherit;
		font-size: 14px;
		color: rgba(255, 255, 255, 0.3);
		cursor: pointer;
		transition: color 0.15s ease;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.tab:hover {
		color: rgba(255, 255, 255, 0.7);
	}
	.tab.active {
		color: rgba(255, 255, 255, 0.9);
		font-weight: 500;
	}
	.cnt {
		font-size: 10px;
		font-family: ui-monospace, monospace;
		color: rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.06);
		padding: 1px 6px;
		border-radius: 8px;
	}
	.ind {
		position: absolute;
		bottom: -1px;
		left: 0;
		right: 0;
		height: 1.5px;
		background: rgba(255, 255, 255, 0.7);
		border-radius: 2px;
	}
	.list {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.fade {
		animation: fadein 0.18s ease;
	}
	@keyframes fadein {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
	.card {
		background: #161618;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 14px;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
	}
	.card:hover {
		background: #19191c;
		border-color: rgba(255, 255, 255, 0.1);
	}
	.card:active {
		transform: scale(0.995);
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}
	.head-right {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.badge {
		font-family: ui-monospace, monospace;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.35);
		background: rgba(255, 255, 255, 0.05);
		padding: 2px 8px;
		border-radius: 8px;
	}
	.time {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.25);
	}
	.mini {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.25);
		cursor: pointer;
		display: flex;
		padding: 2px;
		border-radius: 6px;
		transition: all 0.15s ease;
	}
	.mini:hover {
		color: rgba(255, 255, 255, 0.8);
		background: rgba(255, 255, 255, 0.08);
	}
	.mini .material-symbols-outlined {
		font-size: 15px;
	}
	.body {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.65;
		color: rgba(255, 255, 255, 0.72);
	}
	.body.quote {
		border-left: 2px solid rgba(255, 255, 255, 0.2);
		padding-left: 10px;
		color: rgba(255, 255, 255, 0.8);
		font-style: italic;
	}
	.linked {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 8px;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.35);
	}
	.linked .material-symbols-outlined {
		font-size: 12px;
	}
	.outline-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 9px 12px;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.outline-row:hover {
		background: rgba(255, 255, 255, 0.05);
	}
	.o-title {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.7);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.o-page {
		font-family: ui-monospace, monospace;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.3);
		flex-shrink: 0;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 48px 20px;
		text-align: center;
		color: rgba(255, 255, 255, 0.3);
	}
	.empty .material-symbols-outlined {
		font-size: 32px;
		color: rgba(255, 255, 255, 0.18);
	}
	.empty p {
		font-size: 13px;
		margin: 0;
	}
	.bottom {
		flex-shrink: 0;
		padding: 14px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(12, 12, 13, 0.7);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.composer {
		background: #18181a;
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 12px;
		padding: 10px;
		transition: border-color 0.15s ease;
	}
	.composer:focus-within {
		border-color: rgba(255, 255, 255, 0.2);
	}
	.composer.reply {
		border-color: rgba(255, 255, 255, 0.18);
	}
	.reply-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 8px;
		padding: 5px 8px;
		margin-bottom: 8px;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.6);
	}
	.reply-chip .reply-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.reply-chip .material-symbols-outlined {
		font-size: 14px;
	}
	.reply-chip button {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.4);
		cursor: pointer;
		display: flex;
	}
	textarea {
		width: 100%;
		background: none;
		border: none;
		outline: none;
		resize: none;
		height: 64px;
		font: inherit;
		font-size: 13.5px;
		color: rgba(255, 255, 255, 0.88);
		padding: 2px;
	}
	textarea::placeholder {
		color: rgba(255, 255, 255, 0.28);
	}
	.composer-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 6px;
	}
	.hint {
		font-size: 11px;
		font-family: ui-monospace, monospace;
		color: rgba(255, 255, 255, 0.25);
	}
	.primary {
		background: #fff;
		color: #000;
		border: none;
		border-radius: 8px;
		padding: 6px 16px;
		font: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s ease, transform 0.15s ease;
	}
	.primary:hover:not(:disabled) {
		transform: translateY(-1px);
	}
	.primary:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.primary.sm {
		font-size: 12px;
		padding: 6px 14px;
	}
	.cards-row {
		display: flex;
		gap: 10px;
	}
	.stat {
		flex: 1;
		background: #161618;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.stat.recall {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}
	.stat-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgba(255, 255, 255, 0.3);
	}
	.val {
		font-family: ui-monospace, monospace;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.7);
	}
	.bar {
		height: 3px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 4px;
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: rgba(255, 255, 255, 0.7);
		border-radius: 4px;
		transition: width 0.25s ease;
	}
	.stat-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 11px;
		font-family: ui-monospace, monospace;
		color: rgba(255, 255, 255, 0.35);
	}
	.recall-num {
		font-size: 22px;
		font-weight: 300;
		color: rgba(255, 255, 255, 0.9);
		line-height: 1.1;
		margin-top: 2px;
	}
	.recall-unit {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.35);
		margin-left: 4px;
	}
	.recall-total {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.25);
		margin-left: 2px;
	}
</style>
