import { describe, expect, it } from 'vitest';
import { isReservedHost, isValidHost, normalizeHost } from './hosts.ts';
import { secureCompare } from './secure-compare.ts';

describe('normalizeHost', () => {
	it('lowercases and strips the port and trailing dot', () => {
		expect(normalizeHost(' News.Acme.com.:443 ')).toBe('news.acme.com');
	});
});

describe('isValidHost', () => {
	it.each(['news.acme.com', 'acme.co.uk', 'xn--bcher-kva.example'])('accepts %s', (host) => {
		expect(isValidHost(host)).toBe(true);
	});
	it.each(['acme', '-acme.com', 'acme..com', 'ac me.com', 'https://a.com'])(
		'rejects %s',
		(host) => {
			expect(isValidHost(host)).toBe(false);
		}
	);
});

describe('isReservedHost', () => {
	it('blocks our own domain and its subdomains', () => {
		expect(isReservedHost('inkletter.app')).toBe(true);
		expect(isReservedHost('admin.inkletter.app')).toBe(true);
		expect(isReservedHost('localhost')).toBe(true);
		expect(isReservedHost('notinkletter.app')).toBe(false);
	});
});

describe('secureCompare', () => {
	it('compares strings of any length', () => {
		expect(secureCompare('abc', 'abc')).toBe(true);
		expect(secureCompare('abd', 'abc')).toBe(false);
		expect(secureCompare('ab', 'abc')).toBe(false);
	});

	it('never matches an unset secret', () => {
		expect(secureCompare('', '')).toBe(false);
		expect(secureCompare('', undefined)).toBe(false);
		expect(secureCompare(null, 'abc')).toBe(false);
	});
});
