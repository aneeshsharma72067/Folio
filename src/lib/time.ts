export function relTime(ts: number, now = Date.now()): string {
	const s = Math.floor((now - ts) / 1000);
	if (s < 45) return 'Just now';
	if (s < 3600) return `${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
	const d = Math.floor(s / 86400);
	if (d === 1) return 'Yesterday';
	if (d < 7) return `${d}d ago`;
	return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
