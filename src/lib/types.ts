// Compile-time string-literal unions — erased at build, no runtime enum wrappers.
export type Tab = 'notes' | 'highlights' | 'outline';

export interface DocumentRecord {
	id: string; // content hash
	name: string;
	blob: Blob; // raw PDF binary, never base64
	lastPage: number;
	totalPages: number;
	sessionTime: number; // accumulated seconds
	addedAt: number; // epoch ms
	lastOpenedAt: number;
}

export interface NoteRecord {
	id: string;
	docId: string;
	page: number;
	body: string;
	createdAt: number;
	highlightId?: string; // optional link back to a highlight
}

export interface HighlightRect {
	x: number; // fractions of page width [0,1]
	y: number;
	w: number;
	h: number;
}

export interface HighlightRecord {
	id: string;
	docId: string;
	page: number;
	text: string;
	color: string;
	rects: HighlightRect[];
	createdAt: number;
	noteId?: string;
}

export interface FlashcardRecord {
	id: string;
	docId: string;
	highlightId: string;
	front: string;
	back: string;
	interval: number; // days
	repetition: number;
	easeFactor: number;
	nextReview: number; // epoch ms
	createdAt: number;
}

export interface OutlineItem {
	title: string;
	page: number;
	depth: number;
}
