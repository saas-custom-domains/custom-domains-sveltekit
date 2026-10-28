import { expect, test } from '@playwright/test';

// Customer domains go through the mock proxy (see playwright.config.ts).
const customerUrl = (host: string, path = '/') => `http://${host}${path}`;

test('connect a domain, serve the publication through the proxy, remove it', async ({ page }) => {
	const host = `acme-${Date.now()}.test`;
	const publication = page.getByTestId('publication-acme');

	await page.goto('/dashboard');
	await publication.getByLabel('Domain').fill(host);
	await publication.getByRole('button', { name: 'Add domain' }).click();
	const row = page.getByTestId(`domain-${host}`);
	await expect(row).toBeVisible();

	// The mock marks *.test as pointed after ~2s and sends webhooks.
	await expect(async () => {
		await page.reload();
		await expect(row).toContainText('Live');
	}).toPass({ timeout: 15_000 });

	await page.goto(customerUrl(host));
	await expect(page.getByRole('heading', { name: 'Acme Weekly' })).toBeVisible();
	await expect(page).toHaveTitle('Acme Weekly');
	// SvelteKit knows the customer's domain, not just the app's.
	await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', customerUrl(host));
	await expect(page.getByText(`Served on ${host}`)).toBeVisible();

	// A form action on the custom domain, through the proxy. Without
	// proxy-headers.ts this is "Cross-site POST form submissions are
	// forbidden".
	await page.getByLabel('Email').fill('reader@example.com');
	await page.getByRole('button', { name: 'Subscribe' }).click();
	await expect(page.getByRole('status')).toHaveText('Subscribed to Acme Weekly.');

	// Client-side navigation stays on the customer's domain.
	await page.getByRole('link', { name: 'Grinder settings we actually use' }).click();
	await expect(page).toHaveURL(customerUrl(host, '/posts/grinder-settings'));
	await expect(page.getByRole('heading', { name: 'Grinder settings' })).toBeVisible();

	// The dashboard isn't reachable on a customer's domain.
	const dashboard = await page.goto(customerUrl(host, '/dashboard'));
	expect(dashboard?.status()).toBe(404);

	await page.goto('/dashboard');
	await row.getByRole('button', { name: 'Remove' }).click();
	await expect(row).toBeHidden();
	const gone = await page.goto(customerUrl(host));
	expect(gone?.status()).toBe(404);
});

test('the form works without JavaScript too', async ({ browser, page }) => {
	const host = `globex-${Date.now()}.test`;
	await page.goto('/dashboard');
	const publication = page.getByTestId('publication-globex');
	await publication.getByLabel('Domain').fill(host);
	await publication.getByRole('button', { name: 'Add domain' }).click();
	await expect(async () => {
		await page.reload();
		await expect(page.getByTestId(`domain-${host}`)).toContainText('Live');
	}).toPass({ timeout: 15_000 });

	const context = await browser.newContext({ javaScriptEnabled: false });
	const noJs = await context.newPage();
	await noJs.goto(customerUrl(host));
	await noJs.getByLabel('Email').fill('reader@example.com');
	await noJs.getByRole('button', { name: 'Subscribe' }).click();
	await expect(noJs.getByRole('status')).toHaveText('Subscribed to Globex Digest.');
	await context.close();

	await page.getByTestId(`domain-${host}`).getByRole('button', { name: 'Remove' }).click();
	await expect(page.getByTestId(`domain-${host}`)).toBeHidden();
});

test('a domain that does not point at us stays pending', async ({ page }) => {
	const host = `news-${Date.now()}.example.com`;
	const publication = page.getByTestId('publication-globex');

	await page.goto('/dashboard');
	await publication.getByLabel('Domain').fill(host);
	await publication.getByLabel('DNS contact email').fill('it@example.com');
	await publication.getByRole('button', { name: 'Add domain' }).click();
	const row = page.getByTestId(`domain-${host}`);
	await row.getByRole('button', { name: 'Check DNS' }).click();
	await expect(row).toContainText('Waiting for DNS');

	await row.getByRole('button', { name: 'Remove' }).click();
	await expect(row).toBeHidden();
});

test('rejects our own domains', async ({ page }) => {
	const publication = page.getByTestId('publication-acme');
	await page.goto('/dashboard');
	await publication.getByLabel('Domain').fill('admin.inkletter.app');
	await publication.getByRole('button', { name: 'Add domain' }).click();
	await expect(publication.getByRole('alert')).toHaveText("That's one of our domains.");
});

test('requests that skip the proxy cannot claim a domain', async ({ request }) => {
	const spoofed = await request.get('/', { headers: { 'X-Served-For': 'acme.test' } });
	expect(spoofed.status()).toBe(403);

	const wrongToken = await request.get('/', {
		headers: { 'X-Served-For': 'acme.test', 'X-SaaS-Domains-Auth-Token': 'guess' }
	});
	expect(wrongToken.status()).toBe(403);
});

test('cross-site form posts to a customer domain are still refused', async ({ page }) => {
	const host = `csrf-${Date.now()}.test`;
	await page.goto('/dashboard');
	const publication = page.getByTestId('publication-acme');
	await publication.getByLabel('Domain').fill(host);
	await publication.getByRole('button', { name: 'Add domain' }).click();
	const row = page.getByTestId(`domain-${host}`);
	await expect(async () => {
		await page.reload();
		await expect(row).toContainText('Live');
	}).toPass({ timeout: 15_000 });

	// Another site with a form that posts to the customer's domain.
	await page.route('http://evil.test/', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: `<form method="POST" action="${customerUrl(host)}">
				<input name="email" value="victim@example.com"><button>Win a prize</button>
			</form>`
		})
	);
	await page.goto('http://evil.test/');
	const [response] = await Promise.all([
		page.waitForResponse(customerUrl(host)),
		page.getByRole('button', { name: 'Win a prize' }).click()
	]);
	expect(response.status()).toBe(403);
	expect(await response.text()).toBe('Cross-site POST form submissions are forbidden');

	await page.goto('/dashboard');
	await row.getByRole('button', { name: 'Remove' }).click();
	await expect(row).toBeHidden();
});

test('publications and the dashboard stay on their own hosts', async ({ request }) => {
	const onAppHost = await request.get('/posts/grinder-settings', { maxRedirects: 0 });
	expect(onAppHost.status()).toBe(404);
	const root = await request.get('/', { maxRedirects: 0 });
	expect(root.headers().location).toBe('/dashboard');
});

test('webhooks need the right token', async ({ request }) => {
	const res = await request.post('/api/webhooks/saascustomdomains?token=x', {
		data: { event: 'domain_dns_proxy_record_valid', domain: { uuid: 'x' } }
	});
	expect(res.status()).toBe(401);
});

test('unknown domains get a 404', async ({ page }) => {
	const res = await page.goto(customerUrl('unknown.test'));
	expect(res?.status()).toBe(404);
});
