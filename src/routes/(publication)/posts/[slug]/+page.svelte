<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.post.title} · {data.publication.name}</title>
</svelte:head>

<article>
	<h2>{data.post.title}</h2>
	<time datetime={data.post.published_on}>{data.post.published_on}</time>
	<p>{data.post.body}</p>
</article>
