import { fail } from '@sveltejs/kit';
import { addDomain, checkDomain, removeDomain } from '#lib/server/domain-service.ts';
import { findDomain, listPublications } from '#lib/server/domains.ts';
import { SaasDomainsError } from '#lib/server/saas-domains.ts';
import { isReservedHost, isValidHost, normalizeHost } from '#lib/server/hosts.ts';
import type { Actions, PageServerLoad } from './$types';

// This example has no login. In your app, check that the signed-in
// user owns the publication (and the domain) in every action.

export const load: PageServerLoad = () => ({ publications: listPublications() });

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const publicationId = Number(form.get('publicationId'));
		const host = normalizeHost(String(form.get('host') ?? ''));
		const dnsContact = String(form.get('dnsContact') ?? '') || undefined;

		const invalid = (error: string) => fail(400, { publicationId, error });
		if (!isValidHost(host)) return invalid(`"${host}" isn't a valid domain.`);
		if (isReservedHost(host)) return invalid("That's one of our domains.");

		try {
			await addDomain(publicationId, host, dnsContact);
		} catch (e) {
			// Taken here, or by another app on SaaS Custom Domains.
			const taken = e instanceof SaasDomainsError && e.code === 'host_taken';
			if (taken || String(e).includes('UNIQUE')) {
				return invalid(`${host} is already connected to a publication.`);
			}
			console.error(e);
			return invalid('Could not add the domain. Try again.');
		}
	},

	check: async ({ request }) => {
		const domain = findDomain(Number((await request.formData()).get('domainId')));
		if (domain) await checkDomain(domain);
	},

	remove: async ({ request }) => {
		const domain = findDomain(Number((await request.formData()).get('domainId')));
		if (domain) await removeDomain(domain);
	}
};
