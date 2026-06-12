import type { FlashcardRecord } from './types';

const DAY = 86_400_000;

// SM-2. quality: 0..5 (we map "again"=2, "hard"=3, "good"=4, "easy"=5).
// A quality < 3 resets the learning streak.
export function schedule(card: FlashcardRecord, quality: number, now: number): FlashcardRecord {
	let { interval, repetition, easeFactor } = card;

	if (quality < 3) {
		repetition = 0;
		interval = 1;
	} else {
		repetition += 1;
		if (repetition === 1) interval = 1;
		else if (repetition === 2) interval = 6;
		else interval = Math.round(interval * easeFactor);
	}

	easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
	if (easeFactor < 1.3) easeFactor = 1.3;

	return {
		...card,
		interval,
		repetition,
		easeFactor,
		nextReview: now + interval * DAY
	};
}

export function isDue(card: FlashcardRecord, now: number): boolean {
	return card.nextReview <= now;
}
