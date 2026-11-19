<script lang="ts">
	import { LinearProgress } from "noph-ui";

	const links = [
		{ id: "capacity", label: "Capacity" },
		{ id: "picks", label: "Picks" },
		{ id: "adoption", label: "Adoption" },
		{ id: "retention", label: "Retention" },
		{ id: "aspects", label: "Aspects" },
		{ id: "models", label: "Models" },
		{ id: "method", label: "Method" },
	];

	let active = $state(links[0].id);
	let progress = $state(0);

	function update() {
		const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
		progress = maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0;

		let current = links[0].id;
		for (const link of links) {
			const section = document.getElementById(link.id);
			if (section && section.getBoundingClientRect().top <= 140) current = link.id;
		}
		active = current;
	}

	$effect(() => {
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		window.addEventListener("hashchange", update);
		const observer = new ResizeObserver(update);
		observer.observe(document.body);
		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
			window.removeEventListener("hashchange", update);
			observer.disconnect();
		};
	});
</script>

<nav class="section-nav" id="sectionNav" aria-label="Page sections">
	<div class="shell inner">
		{#each links as link (link.id)}
			<a
				class="tab"
				href={`#${link.id}`}
				aria-current={active === link.id ? "location" : undefined}
			>{link.label}</a>
		{/each}
	</div>
	<div class="nav-progress">
		<LinearProgress aria-label="Page scroll progress" value={progress} stopIndicator={false} />
	</div>
</nav>
