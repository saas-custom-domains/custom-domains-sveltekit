import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Never prerender these pages. adapter-node serves prerendered HTML
// before hooks.server.ts runs, so one publication's page would be
// served on every domain.
export const prerender = false;

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.publication) error(404, 'Not found');
	return { publication: locals.publication, host: url.hostname };
};
