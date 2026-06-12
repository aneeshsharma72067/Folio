import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: true
	},
	kit: {
		adapter: adapter({
			fallback: 'index.html',
			precompress: true
		}),
		prerender: { entries: [] },
		serviceWorker: {
			// We use @vite-pwa/sveltekit instead of Kit's built-in SW
			register: false
		}
	}
};

export default config;
