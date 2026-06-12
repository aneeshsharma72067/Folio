<script lang="ts">
	import { reviewCard } from '../state.svelte';
	import { isDue } from '../sm2';
	import type { FlashcardRecord } from '../types';

	interface Props {
		cards: FlashcardRecord[];
		onclose: () => void;
	}
	let { cards, onclose }: Props = $props();

	// Snapshot the due queue when review opens (intentionally captures initial value).
	const initialQueue = cards.filter((c) => isDue(c, Date.now()));
	let queue = $state<FlashcardRecord[]>(initialQueue);
	let idx = $state(0);
	let flipped = $state(false);
	let done = $derived(idx >= queue.length);

	const current = $derived(queue[idx]);

	async function grade(quality: number) {
		if (!current) return;
		await reviewCard($state.snapshot(current), quality);
		flipped = false;
		idx += 1;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		else if (e.key === ' ') {
			e.preventDefault();
			flipped = !flipped;
		} else if (flipped && current) {
			if (e.key === '1') grade(2);
			else if (e.key === '2') grade(3);
			else if (e.key === '3') grade(4);
			else if (e.key === '4') grade(5);
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" role="dialog" aria-modal="true">
	<div class="sheet">
		<header class="sheet-head">
			<div class="head-meta">
				<span class="material-symbols-outlined">style</span>
				Active Recall
			</div>
			<div class="counter">
				{#if !done}{Math.min(idx + 1, queue.length)} / {queue.length}{:else}Done{/if}
			</div>
			<button class="close" onclick={onclose} aria-label="Close">
				<span class="material-symbols-outlined">close</span>
			</button>
		</header>

		{#if done}
			<div class="empty">
				<span class="material-symbols-outlined big">task_alt</span>
				<p class="empty-title">All caught up</p>
				<p class="empty-sub">
					{queue.length
						? `Reviewed ${queue.length} card${queue.length > 1 ? 's' : ''}.`
						: 'No cards due right now.'}
				</p>
				<button class="primary" onclick={onclose}>Close</button>
			</div>
		{:else if current}
			<button class="card" class:flipped onclick={() => (flipped = !flipped)}>
				<div class="card-side front">
					<span class="side-label">Prompt</span>
					<p>{current.front}</p>
					<span class="hint">Tap or press space to flip</span>
				</div>
				{#if flipped}
					<div class="card-side back">
						<span class="side-label">Answer</span>
						<p>{current.back || 'No note attached to this highlight yet.'}</p>
					</div>
				{/if}
			</button>

			{#if flipped}
				<div class="grades">
					<button class="grade again" onclick={() => grade(2)}>Again</button>
					<button class="grade hard" onclick={() => grade(3)}>Hard</button>
					<button class="grade good" onclick={() => grade(4)}>Good</button>
					<button class="grade easy" onclick={() => grade(5)}>Easy</button>
				</div>
			{:else}
				<div class="prompt-hint">Recall the answer, then reveal</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 24px;
		padding-top: calc(24px + env(safe-area-inset-top));
		padding-bottom: calc(24px + env(safe-area-inset-bottom));
		animation: fade 0.2s ease;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.sheet {
		width: 100%;
		max-width: 480px;
		background: #141416;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		padding: 20px;
		box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.8);
		animation: rise 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.98);
		}
	}
	.sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 18px;
	}
	.head-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.85);
	}
	.head-meta .material-symbols-outlined {
		font-size: 18px;
		color: rgba(255, 255, 255, 0.6);
	}
	.counter {
		font-family: ui-monospace, monospace;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
	}
	.close {
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		display: flex;
	}
	.close:hover {
		color: #fff;
	}
	.card {
		width: 100%;
		min-height: 240px;
		text-align: left;
		background: linear-gradient(160deg, #1d1d20, #161618);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 16px;
		padding: 24px;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 14px;
		transition: border-color 0.15s ease;
	}
	.card:hover {
		border-color: rgba(255, 255, 255, 0.16);
	}
	.card-side {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.card-side.back {
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding-top: 14px;
		animation: fade 0.2s ease;
	}
	.side-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255, 255, 255, 0.3);
	}
	.card-side p {
		margin: 0;
		font-size: 16px;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.9);
	}
	.card-side.back p {
		font-size: 15px;
		color: rgba(255, 255, 255, 0.7);
	}
	.hint {
		margin-top: auto;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.25);
	}
	.grades {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		margin-top: 16px;
	}
	.grade {
		padding: 12px 0;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.04);
		color: rgba(255, 255, 255, 0.8);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.grade:hover {
		background: rgba(255, 255, 255, 0.1);
		transform: translateY(-1px);
	}
	.again:hover {
		border-color: rgba(255, 120, 120, 0.5);
	}
	.easy:hover {
		border-color: rgba(120, 220, 150, 0.5);
	}
	.prompt-hint {
		text-align: center;
		margin-top: 16px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.3);
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 32px 0;
		text-align: center;
	}
	.material-symbols-outlined.big {
		font-size: 44px;
		color: rgba(255, 255, 255, 0.6);
	}
	.empty-title {
		font-size: 16px;
		color: rgba(255, 255, 255, 0.85);
		margin: 4px 0 0;
	}
	.empty-sub {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.4);
		margin: 0 0 12px;
	}
	.primary {
		background: #fff;
		color: #000;
		border: none;
		border-radius: 8px;
		padding: 8px 20px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	@media (max-width: 480px) {
		.overlay {
			padding-left: 16px;
			padding-right: 16px;
		}
		.card {
			min-height: 200px;
			padding: 20px;
		}
		.grades {
			gap: 6px;
		}
		.grade {
			font-size: 12px;
			padding: 14px 0;
		}
	}
</style>
