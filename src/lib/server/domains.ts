import { db } from './db';

export type Publication = { id: number; slug: string; name: string; tagline: string };
export type Post = { slug: string; title: string; body: string; published_on: string };
export type CustomDomain = {
	id: number;
	publication_id: number;
	host: string;
	status: 'pending' | 'active';
	https_ready: number;
	provider_uuid: string | null;
};

// The one lookup every request on a customer domain depends on.
// Keep the UNIQUE index on custom_domains.host.
export function findPublicationByActiveHost(host: string): Publication | null {
	const row = db()
		.prepare(
			`SELECT publications.* FROM publications
			 JOIN custom_domains ON custom_domains.publication_id = publications.id
			 WHERE custom_domains.host = ? AND custom_domains.status = 'active'`
		)
		.get(host);
	return (row as Publication | undefined) ?? null;
}

export function listPosts(publicationId: number): Post[] {
	return db()
		.prepare(
			`SELECT slug, title, body, published_on FROM posts
			 WHERE publication_id = ? ORDER BY published_on DESC`
		)
		.all(publicationId) as Post[];
}

export function findPost(publicationId: number, slug: string): Post | null {
	const row = db()
		.prepare(
			`SELECT slug, title, body, published_on FROM posts
			 WHERE publication_id = ? AND slug = ?`
		)
		.get(publicationId, slug);
	return (row as Post | undefined) ?? null;
}

export function listPublications(): (Publication & { domains: CustomDomain[] })[] {
	const publications = db().prepare('SELECT * FROM publications ORDER BY id').all() as Publication[];
	const domains = db().prepare('SELECT * FROM custom_domains ORDER BY id').all() as CustomDomain[];
	return publications.map((p) => ({
		...p,
		domains: domains.filter((d) => d.publication_id === p.id)
	}));
}

export function findDomain(id: number): CustomDomain | null {
	const row = db().prepare('SELECT * FROM custom_domains WHERE id = ?').get(id);
	return (row as CustomDomain | undefined) ?? null;
}

export function findDomainByProviderUuid(uuid: string): CustomDomain | null {
	const row = db().prepare('SELECT * FROM custom_domains WHERE provider_uuid = ?').get(uuid);
	return (row as CustomDomain | undefined) ?? null;
}

export function insertDomain(publicationId: number, host: string): CustomDomain {
	return db()
		.prepare('INSERT INTO custom_domains (publication_id, host) VALUES (?, ?) RETURNING *')
		.get(publicationId, host) as CustomDomain;
}

export function setStatus(id: number, status: CustomDomain['status']) {
	db().prepare('UPDATE custom_domains SET status = ? WHERE id = ?').run(status, id);
}

export function setHttpsReady(id: number) {
	db().prepare('UPDATE custom_domains SET https_ready = 1 WHERE id = ?').run(id);
}

export function setProviderUuid(id: number, uuid: string) {
	db().prepare('UPDATE custom_domains SET provider_uuid = ? WHERE id = ?').run(uuid, id);
}

export function deleteDomain(id: number) {
	db().prepare('DELETE FROM custom_domains WHERE id = ?').run(id);
}

export function addSubscriber(publicationId: number, email: string) {
	db()
		.prepare('INSERT OR IGNORE INTO subscribers (publication_id, email) VALUES (?, ?)')
		.run(publicationId, email);
}
