import {
	SCD_ACCOUNT_UUID,
	SCD_API_TOKEN,
	SCD_API_URL,
	SCD_UPSTREAM_UUID
} from '$app/env/private';

// A small client for the SaaS Custom Domains API.
// Docs: https://docs.saascustomdomains.com/custom-domains

type DomainResponse = { uuid: string; host: string; status: string };
type VerifyResponse = { dns_status: 'valid' | 'pending' | 'invalid' };

export class SaasDomainsError extends Error {
	// e.g. "host_taken" or "host_invalid" on a 400
	code?: string;

	constructor(
		public status: number,
		body: string
	) {
		super(`SaaS Custom Domains API ${status}: ${body}`);
		try {
			this.code = JSON.parse(body).error_code;
		} catch {
			// 401s have an empty body
		}
	}
}

async function request<T>(method: string, path: string, body?: object): Promise<T> {
	const url =
		`${SCD_API_URL}/api/v1/accounts/${SCD_ACCOUNT_UUID}` +
		`/upstreams/${SCD_UPSTREAM_UUID}/custom_domains${path}`;

	const res = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${SCD_API_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: body && JSON.stringify(body),
		signal: AbortSignal.timeout(10_000)
	});
	if (!res.ok) {
		throw new SaasDomainsError(res.status, await res.text());
	}
	return (await res.json()) as T;
}

export function createDomain(host: string, recipient?: string) {
	return request<DomainResponse>('POST', '', {
		host,
		// We email this address the exact DNS records to add.
		...(recipient && { instructions_recipient: recipient })
	});
}

export function verifyDns(uuid: string) {
	return request<VerifyResponse>('POST', `/${uuid}/verify_dns_records`);
}

export async function deleteDomain(uuid: string) {
	try {
		await request('DELETE', `/${uuid}`);
	} catch (e) {
		// Already gone is fine: the goal is that it doesn't exist.
		if (!(e instanceof SaasDomainsError && e.status === 404)) throw e;
	}
}
