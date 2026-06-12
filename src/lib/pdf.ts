import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { OutlineItem } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy, PDFPageProxy };

export async function loadDocument(data: Uint8Array): Promise<PDFDocumentProxy> {
	// Clone — PDF.js transfers ownership of the buffer and would detach the source.
	const task = pdfjs.getDocument({
		data: data.slice(0),
		// Lean: disable autofetch of the full stream; pull ranges as pages render.
		disableAutoFetch: true,
		disableStream: false
	});
	return task.promise;
}

export async function extractOutline(doc: PDFDocumentProxy): Promise<OutlineItem[]> {
	const raw = await doc.getOutline();
	if (!raw || raw.length === 0) return [];
	const items: OutlineItem[] = [];

	const resolvePage = async (dest: unknown): Promise<number> => {
		try {
			const explicit =
				typeof dest === 'string' ? await doc.getDestination(dest) : (dest as unknown[]);
			if (!explicit || !explicit[0]) return 1;
			const idx = await doc.getPageIndex(explicit[0] as never);
			return idx + 1;
		} catch {
			return 1;
		}
	};

	const walk = async (nodes: typeof raw, depth: number) => {
		for (const n of nodes) {
			const page = await resolvePage(n.dest);
			items.push({ title: n.title, page, depth });
			if (n.items && n.items.length) await walk(n.items, depth + 1);
		}
	};

	await walk(raw, 0);
	return items;
}

// Frees canvas-backed GPU/host memory deterministically (OPTIMIZATION.md §3.2).
export function releaseCanvas(canvas: HTMLCanvasElement | null | undefined) {
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
	canvas.width = 0;
	canvas.height = 0;
}
