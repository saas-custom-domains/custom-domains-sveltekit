<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function statusLabel(status: string, httpsReady: number) {
		if (status !== 'active') return 'Waiting for DNS';
		return httpsReady ? 'Live' : 'DNS OK, waiting for HTTPS';
	}
</script>

<svelte:head>
	<title>Inkletter dashboard</title>
</svelte:head>

<main class="dashboard">
	<h1>Inkletter dashboard</h1>
	<p class="muted">Connect a custom domain to each publication.</p>

	{#each data.publications as publication (publication.id)}
		<section data-testid="publication-{publication.slug}">
			<h2>{publication.name}</h2>
			<ul>
				{#each publication.domains as domain (domain.id)}
					<li data-testid="domain-{domain.host}">
						<code>{domain.host}</code>
						<span class="badge" class:ok={domain.status === 'active'}>
							{statusLabel(domain.status, domain.https_ready)}
						</span>
						<form method="POST" action="?/check" use:enhance>
							<input type="hidden" name="domainId" value={domain.id} />
							<button class="link">Check DNS</button>
						</form>
						<form method="POST" action="?/remove" use:enhance>
							<input type="hidden" name="domainId" value={domain.id} />
							<button class="link danger">Remove</button>
						</form>
					</li>
				{/each}
			</ul>
			<form method="POST" action="?/add" use:enhance class="add">
				<input type="hidden" name="publicationId" value={publication.id} />
				<input name="host" required placeholder="news.example.com" aria-label="Domain" />
				<input
					name="dnsContact"
					type="email"
					placeholder="DNS contact (optional)"
					aria-label="DNS contact email"
				/>
				<button>Add domain</button>
				{#if form?.publicationId === publication.id}
					<p role="alert" class="error">{form.error}</p>
				{/if}
			</form>
		</section>
	{/each}
</main>
