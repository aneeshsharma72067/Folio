<script lang="ts">
	import { onMount } from 'svelte';
	import { app } from '../state.svelte';

	// Isolated leaf so the 1Hz tick only reconciles this tiny subtree.
	let seconds = $state(0);

	function fmt(s: number): string {
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		if (h) return `${h}h ${m}m`;
		if (m) return `${m}m ${sec}s`;
		return `${sec}s`;
	}

	onMount(() => {
		const base = app.doc?.sessionTime ?? 0;
		const start = Date.now();
		const id = setInterval(() => {
			seconds = base + Math.floor((Date.now() - start) / 1000);
		}, 1000);
		return () => clearInterval(id);
	});
</script>

<span class="timer">{fmt(seconds)}</span>

<style>
	.timer {
		font-family: ui-monospace, monospace;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.5);
	}
</style>
