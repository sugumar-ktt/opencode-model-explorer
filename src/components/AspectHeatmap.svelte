<script lang="ts">
	import Plot from "svelteplot/Plot.svelte";
	import Cell from "svelteplot/marks/Cell.svelte";
	import Text from "svelteplot/marks/Text.svelte";
	import { Card } from "noph-ui";
	import { COPY } from "../lib/copy";
	import { topByScore } from "../lib/scores";
	import type { AspectMeta, Row } from "../lib/types";

	let { rows, meta }: { rows: Row[]; meta: AspectMeta[] } = $props();
	let narrow = $state(false);

	$effect(() => {
		const query = window.matchMedia("(max-width: 700px)");
		const update = () => (narrow = query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	});
	const top = $derived(topByScore(rows));
	const data = $derived(
		top.flatMap((row) =>
			meta.map((aspect) => ({
				model: row.model,
				aspect: aspect.label,
				value: row.modelData?.aspects?.[aspect.key] ?? null,
			})),
		),
	);
	const modelNames = $derived(top.map((row) => row.model));
	const aspectLabels = $derived(meta.map((aspect) => aspect.label));
</script>

<Card variant="outlined" id="aspects" class="heatmap-card" aria-label="Aspect strengths">
	<div class="heatmap-head">
		<h2 id="heatmapTitle">{COPY.aspects}</h2>
		<p>{COPY.aspectsSubtitle}</p>
		<p class="heat-legend"><span>weak</span><span class="heat-swatch"></span><span>strong</span></p>
	</div>
	{#if data.length === 0}
		<div class="heatmap-skeleton" aria-hidden="true">
			{#each Array(12) as _}<span class="skel"></span>{/each}
		</div>
	{:else}
		<div class="heatmap-scroll"><Plot
			height={Math.max(320, top.length * 28 + 70)}
			maxWidth="1000px"
			margin={{ top: 60, right: 20, bottom: 20, left: narrow ? 120 : 230 }}
			x={{ type: "band", domain: aspectLabels, axis: "top", label: false }}
			y={{ type: "band", domain: modelNames, label: false }}
			color={{ type: "quantize", n: 4, domain: [0, 100], scheme: "purples", label: false }}
		>
			<Cell data={data.filter((cell) => cell.value != null)} x="aspect" y="model" fill="value" inset={0.5} />
			<Text
				data={data.filter((cell) => cell.value != null)}
				x="aspect"
				y="model"
				text={(cell: { value: number | null }) => String(Math.round(cell.value as number))}
				fill={(cell: { value: number | null }) =>
					(cell.value as number) >= 75 ? "#ffffff" : "#0b1020"
				}
				fontSize={10}
				textAnchor="middle"
				dy={4}
			/>
		</Plot></div>
	{/if}
	<div class="sr-only"><table>
		<caption>Aspect strengths for the top 12 models</caption>
		<thead>
			<tr><th>Model</th>{#each aspectLabels as label (label)}<th>{label}</th>{/each}</tr>
		</thead>
		<tbody>
			{#each top as row (row.slug)}
				<tr>
					<th scope="row">{row.model}</th>
					{#each meta as aspect (aspect.key)}<td>{row.modelData?.aspects?.[aspect.key] ?? "—"}</td>{/each}
				</tr>
			{/each}
		</tbody>
	</table></div>
</Card>
