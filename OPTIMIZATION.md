This document defines the core technical architecture, performance constraints, and optimization patterns required to maintain Folio's target of **<100ms interaction latency** and a **<150kb gzipped bundle size** on low-end mobile hardware and legacy laptops.

---

## 1. Zero-Overhead Coding Patterns

Because Folio runs strictly on the client side with no runtime or framework overhead, every byte of JavaScript must justify its existence.

### 1.1 Compile-Time Constants Over Objects

Avoid standard JavaScript objects or runtime enums for state management, configuration, or tracking tabs. They generate unnecessary boilerplate code during compilation.

````

```text
OPTIMIZATION.md generated successfully.

```typescript
// ❌ AVOID: Generates a self-invoking runtime object wrapper
export enum Tab {
  Notes,
  Highlights,
  Outline
}

//  RECOMMENDED: Completely erased at compilation; values inline as raw primitives
export type Tab = 'notes' | 'highlights' | 'outline';

````

### 1.2 Fine-Grained Component Subscriptions

Svelte reactivity is highly optimized, but updating an object or array re-evaluates the entire component block where it is referenced.

- Do not expose frequently mutating variables (like a millisecond timer for `sessionTime`) to a massive parent view component.
- Isolate rapid mutators into small, specialized leaf nodes (e.g., `<SessionTimer />` or `<ProgressBar />`). This localizes DOM reconciliations to a microscopic subtree.

### 1.3 Event Delegation for Virtualized Rows

When rendering highlights, notes, or search results inside an interactive list, do not bind separate `on:click` handlers to every single row node. This creates a large memory footprint.

- Bind a single event listener to the parent container element.
- Read the target element's data attributes (`data-id`, `data-page`) to determine the clicked item context.

```svelte
<div class="list-container" on:click={(e) => handleRowClick(e)}>
  {#each visibleItems as item}
    <div class="row" data-id={item.id} data-page={item.page}>
      {item.text}
    </div>
  {/each}
</div>

```

---

## 2. Main-Thread Offloading via Web Workers

The main browser thread must remain clear for layout, touch inputs, and smooth UI animations. All heavy data transformations and structural calculations must live in separate background contexts.

### 2.1 OffscreenCanvas for PDF rendering

Rendering large PDF vectors onto standard `<canvas>` targets locks up the primary user interface thread, generating massive drops in frame rates during scrolling.

- Initialize an asynchronous communication pipeline with an isolated Web Worker.
- Detach canvas control from the main DOM using `canvas.transferControlToOffscreen()`.
- Send the offscreen canvas element and raw PDF binary stream straight into the worker thread.
- Let the worker call PDF.js internal rendering engines to compute bitmap graphics completely off-main-thread.

```
┌─────────────────────────────────┐          ┌─────────────────────────────────┐
│           MAIN THREAD           │          │          WORKER THREAD          │
├─────────────────────────────────┤          ├─────────────────────────────────┤
│ Instantiates <canvas> element   │          │                                 │
│ Transfers control via APIs ────┼─────────>│ Captures OffscreenCanvas        │
│ Listens for viewport scrolls    │          │ Executes PDF.js decoding        │
│ Dispatches fast layout frames   │          │ Paints canvas pixels directly   │
└─────────────────────────────────┘          └─────────────────────────────────┘

```

### 2.2 Background Indexing with MiniSearch

Building fuzzy text indices dynamically across 500-page academic documents will drop frames and freeze the user UI.

- Wrap text extraction logic and `MiniSearch` index compilation inside a dedicated Search Worker.
- When a PDF file loads, pass raw text streams into the worker.
- The search worker updates its in-memory indexes entirely in the background.
- When the user runs a search phrase, the worker handles the lookup math and returns a simple, small array of results containing exact matches and string locations back to the UI.

---

## 3. Storage & Memory Optimization

Since all data persists natively inside the user's browser profile, aggressive memory lifecycle management is mandatory to prevent tabs from crashing on low-end systems.

### 3.1 Binary Large Object (BLOB) Stream Strategy

- **Never store raw PDFs as base64-encoded strings.** Base64 formatting expands file sizes by roughly 33%, causing substantial overhead when reading data out of IndexedDB.
- Store raw binary assets directly inside Dexie.js database structures using `Blob` or `ArrayBuffer` formats.
- Use the **Cache API** instead of standard IndexedDB fields for large raw document caches wherever possible. The Cache API interacts natively with service workers, allowing direct stream piping without decoding files into JavaScript memory first.

### 3.2 Strict Canvas Destruction Lifecycle

Browsers cap available system hardware memory for `<canvas>` elements across the entire execution environment. Leaving stale canvases alive will cause silent image drops or browser tab restarts.

- When a virtual scrolling page exits the viewport buffer, immediately wipe its canvas surface.
- Set its width and height parameters directly to `0` to signal immediate memory cleanup to the browser's hardware layer.
- Explicitly release reference arrays and clear any internal PDF.js page data hooks using component lifecycle functions (`onDestroy`).

```typescript
// Cleanup pattern for virtual scrolling pages
export function releaseCanvasMemory(canvasElement: HTMLCanvasElement) {
  if (!canvasElement) return;
  const ctx = canvasElement.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasElement.width = 0;
  canvasElement.height = 0;
}
```

---

## 4. DOM Virtualization & Layout Performance

To maintain <100ms interaction latency, the layout DOM footprint must scale relative to screen resolution, never to the size of the underlying file.

### 4.1 Strict Visible + 1 Ahead Virtualization Window

- Limit active DOM nodes to only the items currently inside the visible viewport bounding box, plus exactly one node ahead to smooth out forward scrolling actions.
- Represent non-rendered pages using invisible structural placeholder components (`<div>`) matching the precise aspect-ratio dimensions extracted from the original document header data. This preserves natural scrollbar scaling without forcing the browser to structure actual inner elements.

### 4.2 Hardware-Accelerated Animations

- Use **Motion One** for UI state transitions.
- Restrict active animations exclusively to changes involving `transform` and `opacity`.
- Avoid modifying properties like `height`, `width`, `margin`, or `top`. Changing these forced values triggers expensive global style calculations and layout reflow steps across the entire DOM tree.
- Apply micro-interactions using a duration of `0.15s ease`. Use a duration of `0.25s ease` when opening or closing side layouts and panel screens.

---

## 5. Build, Bundle, & Network Tuning

Ensure that the application bundle remains clean, preventing unoptimized chunks from creeping into production builds.

### 5.1 Vite Dynamic Module Chunking

Prevent PDF.js core library modules from merging directly into your primary UI initialization script payload. Split them cleanly using code-splitting setups inside `vite.config.ts`:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ compilerOptions: { css: true } })],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("pdfjs-dist")) {
            return "pdfjs-core"; // Isolate heavy PDF engine into its own file
          }
          if (id.includes("dexie")) {
            return "storage-core"; // Split storage framework out of UI boot routine
          }
        },
      },
    },
  },
});
```

### 5.2 Content Compression Target Checklist

Before deploying changes to staging or production targets, ensure that your build assets conform to the following file-size budget limits:

- **Primary Application Script:** `< 40kb` (Gzipped)
- **Application Framework CSS:** `< 5kb` (Gzipped)
- **PDF Engine Sub-chunk:** `< 100kb` (Gzipped)
- **Combined Production Footprint:** `< 150kb` (Gzipped)
  """

with open("OPTIMIZATION.md", "w", encoding="utf-8") as f:
f.write(content)

print("OPTIMIZATION.md generated successfully.")

```

```
