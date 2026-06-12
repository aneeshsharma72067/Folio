<div align="center">

# Folio

**A fast, offline-first, no-account PDF reader for research papers and books.**

Read. Highlight. Turn highlights into spaced-repetition flashcards. Entirely in your browser — no server, no upload, no sign-up.

</div>

---

## What it is

Folio is a single-purpose web app (PWA) for deep reading. You open a PDF from your disk, it renders locally, and everything you do — reading position, notes, highlights, flashcards — is stored in your browser. Close the tab and reopen the same file later: it remembers exactly where you were.

Nothing leaves the device. There is no backend, no account, and no network dependency after the first load. It is designed to stay smooth on low-end phones and 5-year-old laptops.

### Core features

- **Local PDF rendering** — open a file, render it with PDF.js. The file never leaves your machine.
- **Persistent reading position** — last page, total pages, and accumulated session time are saved per document, keyed by a content hash so reopening the same file restores its state.
- **Notes** — page-anchored notes in a composer with Notes / Highlights / Outline tabs. The outline is extracted from the PDF's own bookmark structure.
- **Highlights** — select text to highlight; highlights persist per document and are stored as page-relative rects.
- **Flashcards (active recall)** — a highlight becomes a card front, and the note you attach to it becomes the back. Review with the **SM-2** spaced-repetition algorithm. No AI, pure local logic.
- **In-document search** — fuzzy full-text search across every page, indexed in-memory with MiniSearch.
- **Reading progress** — current page, % complete, live session timer.
- **Offline / installable** — full offline support after first load via a Service Worker; installable on desktop and mobile.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `→` `PageDown` `j` | Next page |
| `←` `PageUp` `k` | Previous page |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom |
| `⌘/Ctrl + F` | Search within document |

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Svelte 5** (runes) | Compiles away — near-zero runtime overhead |
| Meta-framework | **SvelteKit** + `adapter-static` | SPA mode (`ssr = false`), single-fallback static build |
| Build tool | **Vite** | Fast builds, code-split output |
| PDF rendering | **PDF.js** (`pdfjs-dist`) | Off-main-thread rendering via the PDF.js worker |
| Local storage | **Dexie.js** | IndexedDB wrapper; stores PDFs as `Blob`, plus notes/highlights/cards |
| Search | **MiniSearch** | In-memory fuzzy index, one document per page |
| Spaced repetition | **Custom SM-2** | ~30 lines, no dependency |
| Offline / PWA | **`@vite-pwa/sveltekit`** (Workbox) | Auto-generated Service Worker, app-shell precache |
| Styling | **Plain CSS + variables** | No runtime style cost |

The app is **client-only**: `src/routes/+layout.ts` sets `ssr = false` and `prerender = false`, and the static adapter emits an `index.html` SPA fallback.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                         Toolbar                          │
├──────────────────────────────┬───────────────────────────┤
│                              │  Notes / Highlights /      │
│         PDF Viewer           │  Outline  (tabbed)         │
│   (virtual scroll, PDF.js)   │───────────────────────────│
│                              │  Reading progress │ Cards  │
└──────────────────────────────┴───────────────────────────┘
```

### Source map (`src/lib`)

| File | Responsibility |
|---|---|
| `types.ts` | Record shapes (`DocumentRecord`, `NoteRecord`, `HighlightRecord`, `FlashcardRecord`, `OutlineItem`) and the `Tab` string-union. |
| `db.ts` | Dexie database `folio`, `uid()`, and `hashBlob()` (SHA-256 over a bounded prefix + byte length → stable document id). |
| `state.svelte.ts` | `AppState` runes class (current doc, page, zoom, outline, session), `openFile()`, `persistProgress()`, Dexie `liveQuery` collections, and all mutations (notes, highlights, flashcard upsert, review). |
| `pdf.ts` | PDF.js setup (worker URL), `loadDocument()`, `extractOutline()`, `releaseCanvas()` for deterministic canvas memory cleanup. |
| `search.svelte.ts` | `SearchState` runes class — lazy per-PDF MiniSearch index, one record per page, with snippet extraction. |
| `sm2.ts` | SM-2 scheduler (`schedule()`, `isDue()`). |
| `time.ts` | `relTime()` relative-time formatting. |
| `components/` | `PdfViewer`, `PdfPage`, `Library`, `DetailsPanel`, `SearchPanel`, `ReviewMode`, `SessionTimer`. |

### Storage schema (IndexedDB via Dexie)

```
documents   id, lastOpenedAt, addedAt          — PDF blob + reading state
notes       id, docId, page, createdAt         — page-anchored notes
highlights  id, docId, page, createdAt         — text + page-relative rects
flashcards  id, docId, highlightId, nextReview — SM-2 scheduling state
```

`documents.id` is the content hash from `hashBlob()`, so the same file always maps to the same record. PDFs are stored as raw `Blob` (never base64) to avoid the ~33% size inflation.

### How flashcards form

1. You highlight text → a `HighlightRecord` is created.
2. You attach a note to that highlight → `addNote()` links the note (`highlightId`) and calls `upsertFlashcard()`.
3. The card's **front** is the highlight text, **back** is the note body. New cards start at `easeFactor 2.5`, due immediately.
4. `reviewCard(card, quality)` runs SM-2 (`quality`: again=2, hard=3, good=4, easy=5) and reschedules `nextReview`.

Deleting a highlight cascades to its flashcard in a single Dexie transaction.

---

## Getting started

Requires Node and **pnpm**.

```sh
pnpm install
pnpm dev            # dev server
pnpm dev -- --open  # and open a browser tab
```

### Build

```sh
pnpm build      # static SPA → ./build (precompressed: .br + .gz)
pnpm preview    # preview the production build
```

### Type-check

```sh
pnpm check          # one-shot
pnpm check:watch    # watch mode
```

---

## Performance notes

Folio targets **<100ms interaction latency** and a **<150kb gzipped** bundle on low-end hardware. Key patterns:

- **Code-splitting** — `pdfjs-dist`, `dexie`, and `minisearch` are split into separate chunks (`vite.config.ts` `manualChunks`) so the PDF engine never bloats the UI boot payload.
- **Off-main-thread PDF work** — rendering and text extraction run through the PDF.js worker; the main thread stays free for layout and input.
- **Deterministic canvas cleanup** — `releaseCanvas()` zeroes width/height on off-screen pages to release GPU/host memory.
- **Fine-grained reactivity** — rapid mutators (e.g. the session timer) are isolated into leaf components so updates touch a microscopic subtree.
- **String-union types over enums** — `Tab` etc. are compile-time literals, erased at build with no runtime wrapper.

See [`OPTIMIZATION.md`](./OPTIMIZATION.md) for the full architecture and constraints, and [`PLAN.md`](./PLAN.md) for the build plan and design principles.

---

## Design principles

1. **Calm wins** — never show more than what's needed right now.
2. **No color accents** — white opacity only; one white-fill button per view.
3. **Depth through darkness** — surfaces are `#0a0a0a` / `#111` / `#161618`, never flat black.
4. **Typography is the UI** — spacing, weight, and opacity do the work.
5. **Offline is a feature, not a fallback** — everything works on a plane.

---

## Roadmap

- [x] PDF viewer, notes, highlights, flashcards, search, offline PWA
- [ ] Optional AI summarize page/selection via an IP-rate-limited Cloudflare Worker (no backend infra; not in v1)

## Privacy

Folio has no backend. Your PDFs, notes, highlights, and flashcards live only in your browser's IndexedDB and Cache storage. Nothing is uploaded anywhere.
