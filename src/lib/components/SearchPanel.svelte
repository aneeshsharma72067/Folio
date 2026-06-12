<script lang="ts">
	import { search } from '../search.svelte';

	interface Props {
		ongoto: (page: number) => void;
	}
	let { ongoto }: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (search.open) inputEl?.focus();
	});

	function onInput() {
		search.run();
	}

	function close() {
		search.open = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
		else if (e.key === 'Enter' && search.hits.length) jump(search.hits[0].page);
	}

	function jump(page: number) {
		ongoto(page);
	}
</script>

{#if search.open}
	<div class="search">
		<div class="bar">
			<span class="material-symbols-outlined">search</span>
			<input
				bind:this={inputEl}
				bind:value={search.query}
				oninput={onInput}
				onkeydown={onKey}
				placeholder={search.building ? 'Indexing…' : 'Search this document'}
				disabled={search.building}
			/>
			{#if search.hits.length}
				<span class="count">{search.hits.length}</span>
			{/if}
			<button class="x" onclick={close} aria-label="Close search">
				<span class="material-symbols-outlined">close</span>
			</button>
		</div>

		{#if search.query.trim().length >= 2 && !search.building}
			<div class="results">
				{#if search.hits.length === 0}
					<p class="empty">No matches</p>
				{:else}
					{#each search.hits as hit (hit.page)}
						<button class="hit" onclick={() => jump(hit.page)}>
							<span class="pg">{hit.page}</span>
							<span class="snip">{hit.snippet}</span>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.search {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 320px;
		max-width: calc(100% - 24px);
		background: rgba(28, 28, 30, 0.92);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		z-index: 50;
		box-shadow: 0 20px 50px -16px rgba(0, 0, 0, 0.8);
		overflow: hidden;
		animation: drop 0.2s ease;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 9px 10px;
	}
	.bar > .material-symbols-outlined {
		font-size: 18px;
		color: rgba(255, 255, 255, 0.4);
	}
	.bar input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: rgba(255, 255, 255, 0.92);
		font: inherit;
		font-size: 13px;
		min-width: 0;
	}
	.bar input::placeholder {
		color: rgba(255, 255, 255, 0.3);
	}
	.count {
		font-size: 11px;
		font-family: ui-monospace, monospace;
		color: rgba(255, 255, 255, 0.4);
	}
	.x {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.5);
		display: flex;
		cursor: pointer;
		padding: 2px;
		border-radius: 6px;
	}
	.x:hover {
		color: #fff;
	}
	.x .material-symbols-outlined {
		font-size: 16px;
	}
	.results {
		max-height: 300px;
		overflow-y: auto;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		padding: 4px;
	}
	.empty {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.35);
		text-align: center;
		padding: 14px;
		margin: 0;
	}
	.hit {
		display: flex;
		gap: 10px;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 8px 9px;
		border-radius: 8px;
		cursor: pointer;
		color: rgba(255, 255, 255, 0.75);
		transition: background 0.12s ease;
	}
	.hit:hover {
		background: rgba(255, 255, 255, 0.06);
	}
	.pg {
		flex-shrink: 0;
		font-family: ui-monospace, monospace;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.4);
		min-width: 20px;
		padding-top: 1px;
	}
	.snip {
		font-size: 12px;
		line-height: 1.4;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
	}

	@media (pointer: coarse) {
		.bar {
			padding: 12px;
		}
		.x {
			min-width: 40px;
			min-height: 40px;
			align-items: center;
			justify-content: center;
		}
		.hit {
			padding: 12px 10px;
		}
	}
</style>
