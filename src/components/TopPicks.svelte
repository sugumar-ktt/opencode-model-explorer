<script lang="ts">
	import { Card } from "noph-ui";
	import Badge from "./Badge.svelte";
	import { formatPerDollar } from "../lib/format";
	import { COPY } from "../lib/copy";
	import { topPicks } from "../lib/scores";
	import type { Row } from "../lib/types";

	let { rows, loading = false }: { rows: Row[]; loading?: boolean } = $props();
	const picks = $derived(topPicks(rows));
	const items = $derived([
		{ label: "Best overall", pick: picks.overall, text: (row: Row) => `${row.value?.toFixed(1)} Value` },
		{ label: "Best quality", pick: picks.quality, text: (row: Row) => `${Math.round(row.score as number)} Score` },
		{ label: "Best value for money", pick: picks.value, text: (row: Row) => `${formatPerDollar(row.scorePerDollar)} Score/$` },
	]);

	const sweep = $derived(
		picks.overall.winner &&
			picks.overall.winner.slug === picks.quality.winner?.slug &&
			picks.overall.winner.slug === picks.value.winner?.slug,
	);
</script>

<Card variant="outlined" id="picks" class="picks" aria-label="Top picks">
	<div class="picks-head">
		<h2>{COPY.picksTitle}</h2>
		{#if sweep}
			<span class="sweep-badge">Top pick across every category</span>
		{:else}
			<span class="picks-note">{COPY.picksSubtitle}</span>
		{/if}
	</div>
	{#if loading && rows.length === 0}
		<div class="pick hero" aria-hidden="true">
			<span class="pick-label">Top pick</span>
			<span class="pick-model"><span class="skel" style:width="12em"></span></span>
			<span class="pick-metrics">
				<span class="metric skel" style:width="5em"></span>
				<span class="metric skel" style:width="4em"></span>
				<span class="metric skel" style:width="5em"></span>
			</span>
			<span class="pick-next"><span class="skel" style:width="60%"></span></span>
		</div>
	{:else if sweep && picks.overall.winner}
		<div class="pick hero">
			<span class="pick-label">Top pick</span>
			<span class="pick-model">
				{picks.overall.winner.model}
				{#each picks.overall.winner.badges as badge (badge)}<Badge {badge} />{/each}
			</span>
			<span class="pick-metrics">
				<span class="metric">{picks.overall.winner.value?.toFixed(1)} Value</span>
				<span class="metric">{Math.round(picks.overall.winner.score as number)} Score</span>
				<span class="metric">{formatPerDollar(picks.overall.winner.scorePerDollar)} Score/$</span>
			</span>
			<span class="pick-next">
				Next: {picks.overall.runnerUp?.model ?? "—"} · {picks.quality.runnerUp?.model ?? "—"} · {picks.value.runnerUp?.model ?? "—"}
			</span>
		</div>
	{:else}
		{#each items as item, index (item.label)}
			<div class="pick" class:hero={index === 0}>
				<span class="pick-label">{item.label}</span>
				<span class="pick-model">
					{#if item.pick.winner}
						{item.pick.winner.model}
						{#each item.pick.winner.badges as badge (badge)}<Badge {badge} />{/each}
					{:else}
						—
					{/if}
				</span>
				<span class="pick-metric">{item.pick.winner ? item.text(item.pick.winner) : "—"}</span>
				<span class="pick-next">
					{item.pick.runnerUp ? `Next: ${item.pick.runnerUp.model}` : "—"}
				</span>
			</div>
		{/each}
	{/if}
</Card>
