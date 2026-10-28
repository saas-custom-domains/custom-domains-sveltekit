import { error } from '@sveltejs/kit';
import { findPost } from '#lib/server/domains.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const post = findPost(locals.publication!.id, params.slug);
	if (!post) error(404, 'Not found');
	return { post };
};
