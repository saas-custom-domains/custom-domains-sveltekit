import { expect, it } from 'vitest';
import { pointsAtUs } from './dns-check.ts';

it('counts *.localhost as pointed at us', async () => {
	expect(await pointsAtUs('acme.localhost')).toBe(true);
});
