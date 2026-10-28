import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DATABASE_PATH } from '$app/env/private';

let instance: DatabaseSync | undefined;

// One connection per server process, opened on first use so that
// `vite build` never touches it. Swap for Postgres in a real app; the
// queries are plain SQL.
export function db() {
	instance ??= open();
	return instance;
}

function open() {
	if (DATABASE_PATH !== ':memory:') {
		mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
	}
	const db = new DatabaseSync(DATABASE_PATH, { timeout: 5000 });
	migrate(db);
	seed(db);
	return db;
}

function migrate(db: DatabaseSync) {
	db.exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA foreign_keys = ON;

		CREATE TABLE IF NOT EXISTS publications (
			id INTEGER PRIMARY KEY,
			slug TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			tagline TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY,
			publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
			slug TEXT NOT NULL,
			title TEXT NOT NULL,
			body TEXT NOT NULL,
			published_on TEXT NOT NULL,
			UNIQUE (publication_id, slug)
		);

		-- host is stored normalized (lowercase, no port, no trailing dot),
		-- and UNIQUE: one domain belongs to one publication.
		CREATE TABLE IF NOT EXISTS custom_domains (
			id INTEGER PRIMARY KEY,
			publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
			host TEXT NOT NULL UNIQUE,
			status TEXT NOT NULL DEFAULT 'pending'
				CHECK (status IN ('pending', 'active')),
			https_ready INTEGER NOT NULL DEFAULT 0,
			provider_uuid TEXT UNIQUE,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS subscribers (
			id INTEGER PRIMARY KEY,
			publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
			email TEXT NOT NULL,
			UNIQUE (publication_id, email)
		);
	`);
}

function seed(db: DatabaseSync) {
	const { n } = db.prepare('SELECT COUNT(*) AS n FROM publications').get() as { n: number };
	if (n > 0) return;

	const publication = db.prepare(
		'INSERT INTO publications (slug, name, tagline) VALUES (?, ?, ?) RETURNING id'
	);
	const post = db.prepare(
		`INSERT INTO posts (publication_id, slug, title, body, published_on)
		 VALUES (?, ?, ?, ?, ?)`
	);

	const acme = publication.get('acme', 'Acme Weekly', 'Notes from a small coffee roaster.') as {
		id: number;
	};
	post.run(
		acme.id,
		'washed-vs-natural',
		'Washed or natural?',
		'Two beans from the same farm, processed two ways. One tastes of lemon, the other of strawberry jam.',
		'2026-10-23'
	);
	post.run(
		acme.id,
		'grinder-settings',
		'Grinder settings we actually use',
		'Start at 18 for filter and go finer until the cup turns bitter, then back off one step.',
		'2026-10-16'
	);

	const globex = publication.get('globex', 'Globex Digest', 'What our design team read this week.') as {
		id: number;
	};
	post.run(
		globex.id,
		'empty-states',
		'Empty states are onboarding',
		'The first screen a new user sees is usually empty. Treat it as the first lesson.',
		'2026-10-22'
	);
}
