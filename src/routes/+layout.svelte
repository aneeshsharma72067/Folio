<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';

	let { children } = $props();
	let toast = $state<'offline' | 'update' | null>(null);
	let updateSW: (() => void) | null = null;

	onMount(async () => {
		// Register the PWA service worker; surface offline-ready / update toasts.
		try {
			// @ts-expect-error - virtual module resolved by vite-plugin-pwa at build time
			const { useRegisterSW } = await import('virtual:pwa-register/svelte');
			const r = useRegisterSW({
				onOfflineReady() {
					toast = 'offline';
					setTimeout(() => (toast = null), 3000);
				},
				onNeedRefresh() {
					toast = 'update';
				}
			});
			updateSW = () => r.updateServiceWorker(true);
		} catch {
			/* SW unavailable in dev — ignore */
		}
	});
</script>

{@render children()}

{#if toast}
	<div class="toast">
		{#if toast === 'offline'}
			<span class="material-symbols-outlined">offline_bolt</span>
			Ready to work offline
		{:else}
			<span class="material-symbols-outlined">refresh</span>
			New version available
			<button onclick={() => updateSW?.()}>Reload</button>
		{/if}
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		bottom: calc(20px + env(safe-area-inset-bottom));
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		background: #1c1c1e;
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.9);
		padding: 10px 16px;
		border-radius: 12px;
		font-size: 13px;
		z-index: 200;
		box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.7);
		animation: rise 0.25s ease;
	}
	.toast .material-symbols-outlined {
		font-size: 18px;
	}
	.toast button {
		background: #fff;
		color: #000;
		border: none;
		border-radius: 7px;
		padding: 4px 12px;
		font: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		margin-left: 4px;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translate(-50%, 12px);
		}
	}
</style>
