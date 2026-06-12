import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			manifest: {
				name: 'Folio',
				short_name: 'Folio',
				description: 'A fast, offline-first PDF reader for papers and books.',
				theme_color: '#0a0a0a',
				background_color: '#000000',
				display: 'standalone',
				orientation: 'any',
				categories: ['productivity', 'education'],
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,mjs}'],
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
				cleanupOutdatedCaches: true,
				navigateFallback: '/',
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-stylesheets',
							expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
						}
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-webfonts',
							expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
							cacheableResponse: { statuses: [0, 200] }
						}
					}
				]
			},
			devOptions: { enabled: false }
		})
	],
	worker: {
		format: 'es'
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('pdfjs-dist')) return 'pdfjs-core';
					if (id.includes('dexie')) return 'storage-core';
					if (id.includes('minisearch')) return 'search-core';
				}
			}
		}
	}
});
