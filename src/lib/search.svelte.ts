import MiniSearch from 'minisearch';
import type { PDFDocumentProxy } from './pdf';

// One indexed doc = one page. Lazy-built on first search, kept per-PDF in memory.
interface PageDoc {
	id: number; // page number
	text: string;
}

export interface SearchHit {
	page: number;
	snippet: string;
}

class SearchState {
	open = $state(false);
	query = $state('');
	hits = $state<SearchHit[]>([]);
	building = $state(false);
	ready = $state(false);

	#index: MiniSearch<PageDoc> | null = null;
	#pageText = new Map<number, string>();

	reset() {
		this.open = false;
		this.query = '';
		this.hits = [];
		this.building = false;
		this.ready = false;
		this.#index = null;
		this.#pageText.clear();
	}

	// Extract every page's text once, feed MiniSearch. Cheap terms, no positions.
	async build(doc: PDFDocumentProxy) {
		if (this.ready || this.building) return;
		this.building = true;
		const idx = new MiniSearch<PageDoc>({
			fields: ['text'],
			storeFields: [],
			searchOptions: { prefix: true, fuzzy: 0.15, combineWith: 'AND' }
		});
		const docs: PageDoc[] = [];
		for (let p = 1; p <= doc.numPages; p++) {
			const page = await doc.getPage(p);
			const content = await page.getTextContent();
			const text = content.items
				.map((it) => ('str' in it ? it.str : ''))
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();
			this.#pageText.set(p, text);
			docs.push({ id: p, text });
			page.cleanup();
		}
		idx.addAll(docs);
		this.#index = idx;
		this.ready = true;
		this.building = false;
	}

	run() {
		const q = this.query.trim();
		if (!this.#index || q.length < 2) {
			this.hits = [];
			return;
		}
		const results = this.#index.search(q).slice(0, 50);
		this.hits = results.map((r) => ({
			page: r.id as number,
			snippet: snippet(this.#pageText.get(r.id as number) ?? '', q)
		}));
	}
}

// First match window, +/-40 chars around the query term.
function snippet(text: string, query: string): string {
	const term = query.split(/\s+/)[0].toLowerCase();
	const i = text.toLowerCase().indexOf(term);
	if (i < 0) return text.slice(0, 90) + (text.length > 90 ? '…' : '');
	const start = Math.max(0, i - 40);
	const end = Math.min(text.length, i + term.length + 50);
	return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

export const search = new SearchState();
