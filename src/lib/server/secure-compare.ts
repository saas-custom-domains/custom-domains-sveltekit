import { timingSafeEqual } from 'node:crypto';

// Constant-time string comparison, so a wrong guess doesn't reveal
// how many leading characters were right. An unset secret never matches.
export function secureCompare(given: string | null, expected: string | undefined): boolean {
	if (!given || !expected) return false;
	const a = Buffer.from(given);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}
