import { fail } from '@sveltejs/kit';
import { addSubscriber, listPosts } from '#lib/server/domains.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	posts: listPosts(locals.publication!.id)
});

export const actions: Actions = {
	// The publication comes from the domain (hooks.server.ts), never from
	// the form, so a post to acme.com can't subscribe someone to globex.
	default: async ({ locals, request }) => {
		const publication = locals.publication!;
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!/^\S+@\S+\.\S+$/.test(email)) {
			return fail(400, { email, message: 'Enter a valid email.' });
		}
		addSubscriber(publication.id, email);
		return { message: `Subscribed to ${publication.name}.` };
	}
};
