import { DOMAINS_PROVIDER } from '$app/env/private';
import * as saasDomains from './saas-domains';
import { pointsAtUs } from './dns-check';
import {
	type CustomDomain,
	deleteDomain,
	insertDomain,
	setProviderUuid,
	setStatus
} from './domains';

const managed = DOMAINS_PROVIDER === 'saascustomdomains';

export async function addDomain(
	publicationId: number,
	host: string,
	dnsContact?: string
): Promise<CustomDomain> {
	const domain = insertDomain(publicationId, host);
	if (!managed) return domain;

	try {
		const res = await saasDomains.createDomain(host, dnsContact);
		setProviderUuid(domain.id, res.uuid);
		return { ...domain, provider_uuid: res.uuid };
	} catch (e) {
		// Don't keep a row the proxy doesn't know about.
		deleteDomain(domain.id);
		throw e;
	}
}

export async function checkDomain(domain: CustomDomain): Promise<boolean> {
	let valid: boolean;
	if (managed && domain.provider_uuid) {
		const res = await saasDomains.verifyDns(domain.provider_uuid);
		valid = res.dns_status === 'valid';
	} else {
		valid = await pointsAtUs(domain.host);
	}
	setStatus(domain.id, valid ? 'active' : 'pending');
	return valid;
}

export async function removeDomain(domain: CustomDomain) {
	// Proxy first, database second: if the API call fails, the row is
	// still here and the user can retry.
	if (managed && domain.provider_uuid) {
		await saasDomains.deleteDomain(domain.provider_uuid);
	}
	deleteDomain(domain.id);
}
