import * as saasDomains from './saas-domains';
import {
	type CustomDomain,
	deleteDomain,
	insertDomain,
	setProviderUuid,
	setStatus
} from './domains';

export async function addDomain(
	publicationId: number,
	host: string,
	dnsContact?: string
): Promise<CustomDomain> {
	const domain = insertDomain(publicationId, host);
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

// "Check DNS" in the dashboard. Webhooks usually get there first.
export async function checkDomain(domain: CustomDomain): Promise<boolean> {
	if (!domain.provider_uuid) return false;
	const res = await saasDomains.verifyDns(domain.provider_uuid);
	const valid = res.dns_status === 'valid';
	setStatus(domain.id, valid ? 'active' : 'pending');
	return valid;
}

export async function removeDomain(domain: CustomDomain) {
	// Proxy first, database second: if the API call fails, the row is
	// still here and the user can retry.
	if (domain.provider_uuid) {
		await saasDomains.deleteDomain(domain.provider_uuid);
	}
	deleteDomain(domain.id);
}
